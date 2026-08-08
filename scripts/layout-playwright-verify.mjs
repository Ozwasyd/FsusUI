#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  loadPlaywrightOwners,
  planOwnerCells,
} from './layout-playwright-plan.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const REQUIRED_RECEIPT_KEYS = Object.freeze([
  'schemaVersion',
  'owner',
  'gate',
  'suiteId',
  'cellId',
  'project',
  'dimensions',
  'commitSha',
  'workflowGroup',
  'run',
  'toolchain',
  'runtime',
  'config',
  'tests',
  'report',
  'status',
  'startedAt',
  'endedAt',
])

const fail = (message) => {
  throw new Error(message)
}

export const sha256File = (file) => {
  if (!existsSync(file)) fail(`file missing for digest: ${file}`)
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

export function validateCellReceipt(receipt, cell) {
  for (const key of REQUIRED_RECEIPT_KEYS) {
    if (!(key in receipt)) fail(`receipt for ${cell?.id ?? 'cell'} missing ${key}`)
  }
  if (receipt.schemaVersion !== 1) fail('receipt schemaVersion must be 1')
  if (receipt.cellId !== cell?.id) fail(`receipt cellId mismatch: ${receipt.cellId}`)
  if (receipt.suiteId !== cell?.suiteId) fail(`receipt suiteId mismatch: ${receipt.suiteId}`)
  if (receipt.project !== cell?.project) fail(`receipt project mismatch: ${receipt.project}`)
  if (receipt.status !== 'success' && receipt.status !== 'failure') {
    fail(`receipt status must be success|failure, got ${receipt.status}`)
  }
  if (!/^[0-9a-f]{40}$/u.test(receipt.commitSha)) {
    fail('receipt commitSha must be a full 40-hex SHA')
  }
  if (!receipt.runtime?.manifestDigest || !receipt.runtime?.sourceFingerprint) {
    fail('receipt runtime manifest digest/sourceFingerprint required')
  }
  if (!/^[0-9a-f]{64}$/u.test(receipt.runtime.manifestDigest)) {
    fail('receipt runtime manifestDigest must be 64 hex chars')
  }
  if (!/^[0-9a-f]{64}$/u.test(receipt.runtime.sourceFingerprint)) {
    fail('receipt runtime sourceFingerprint must be 64 hex chars')
  }
  if (!receipt.config?.sha256 || receipt.config.sha256.length !== 64) {
    fail('receipt config sha256 required')
  }
  if (typeof receipt.tests?.total !== 'number' || typeof receipt.tests.passed !== 'number') {
    fail('receipt tests.total/passed must be numbers')
  }
  if (typeof receipt.tests.failed !== 'number' || typeof receipt.tests.skipped !== 'number') {
    fail('receipt tests.failed/skipped must be numbers')
  }
  if (receipt.status === 'success' && receipt.tests.passed === 0) {
    fail(`receipt ${receipt.cellId} reports zero passed tests; 0-test/skip-all is fail-closed`)
  }
  if (receipt.status === 'success' && !receipt.report?.path) {
    fail(`receipt ${receipt.cellId} missing report path`)
  }
  if (receipt.report?.sha256 && receipt.report.sha256.length !== 64) {
    fail('receipt report sha256 must be 64 hex chars')
  }
  if (receipt.dimensions?.browser && receipt.dimensions.browser.includes('-')) {
    fail(`receipt browser must not be composite: ${receipt.dimensions.browser}`)
  }
  if (typeof receipt.toolchain?.chromiumRevision !== 'string') {
    fail('receipt toolchain.chromiumRevision must be a string')
  }
  if (
    receipt.toolchain.firefoxRevision !== undefined &&
    typeof receipt.toolchain.firefoxRevision !== 'string'
  ) {
    fail('receipt toolchain.firefoxRevision must be a string when present')
  }
  if (
    receipt.toolchain.webkitRevision !== undefined &&
    typeof receipt.toolchain.webkitRevision !== 'string'
  ) {
    fail('receipt toolchain.webkitRevision must be a string when present')
  }
  return true
}

export function loadReceiptsFromDirectory(directory) {
  const absolute = resolve(root, directory)
  if (!existsSync(absolute)) return []
  const receipts = []
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = resolve(current, entry.name)
      if (entry.isDirectory()) visit(target)
      else if (entry.name.endsWith('.json')) {
        receipts.push(JSON.parse(readFileSync(target, 'utf8')))
      }
    }
  }
  visit(absolute)
  return receipts
}

export function verifyOwnerReceipts(
  ownerId,
  group,
  receipts,
  plan,
  options = {},
) {
  if (!plan || plan.owner !== ownerId || plan.group !== group) {
    fail('owner-verify requires the matching owner plan')
  }
  const expected = new Map(plan.cells.map((cell) => [cell.id, cell]))
  const actual = new Map(receipts.map((receipt) => [receipt.cellId, receipt]))
  const summary = { owner: ownerId, gate: plan.gate, group, cells: [] }
  let failed = false

  const manifest = options.runtimeManifestPath
    ? JSON.parse(readFileSync(resolve(root, options.runtimeManifestPath), 'utf8'))
    : null
  const expectedManifestDigest = options.runtimeManifestPath
    ? sha256File(resolve(root, options.runtimeManifestPath))
    : null

  for (const [cellId, cell] of expected) {
    const receipt = actual.get(cellId)
    const entry = { cellId, status: receipt?.status ?? 'missing', tests: receipt?.tests ?? null }
    summary.cells.push(entry)
    if (!receipt) {
      failed = true
      console.error(`[playwright-layout] missing receipt for ${cellId}`)
      continue
    }
    try {
      validateCellReceipt(receipt, cell)
      if (receipt.owner !== ownerId) {
        fail(`receipt owner mismatch: ${receipt.owner}`)
      }
      if (receipt.gate !== plan.gate) {
        fail(`receipt gate mismatch: ${receipt.gate}`)
      }
      if (
        options.expectedCommitSha &&
        receipt.commitSha !== options.expectedCommitSha
      ) {
        fail(
          `receipt ${cellId} binds ${receipt.commitSha}, expected ${options.expectedCommitSha}`,
        )
      }
      if (expectedManifestDigest) {
        if (receipt.runtime.manifestDigest !== expectedManifestDigest) {
          fail(`receipt ${cellId} runtime manifestDigest does not match current runtime`)
        }
        if (receipt.runtime.sourceFingerprint !== manifest.sourceFingerprint) {
          fail(`receipt ${cellId} runtime sourceFingerprint does not match current runtime`)
        }
      }
      if (receipt.status !== 'success') {
        fail(`cell ${cellId} status=${receipt.status}`)
      }
    } catch (error) {
      failed = true
      console.error(
        `[playwright-layout] invalid receipt ${cellId}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  for (const receipt of receipts) {
    if (!expected.has(receipt.cellId)) {
      failed = true
      console.error(`[playwright-layout] unexpected receipt ${receipt.cellId}`)
    }
  }
  summary.status = failed ? 'failure' : 'success'
  return { summary, failed }
}

const option = (args, name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) return args[index + 1]
  const prefix = `--${name}=`
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

function main(argv = process.argv.slice(2)) {
  const command = argv[0]
  if (command !== 'owner-verify') {
    fail('Usage: layout-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--runtime-manifest <path>] [--commit-sha <sha>] [--evidence-out <path>]')
  }
  const ownerId = option(argv, 'owner')
  const group = option(argv, 'group', 'main')
  const receiptsDir = option(argv, 'receipts-dir')
  if (!ownerId || !receiptsDir) fail('owner-verify requires --owner and --receipts-dir')
  const owners = loadPlaywrightOwners()
  const plan = planOwnerCells(
    ownerId,
    group,
    loadPlaywrightSuiteRegistry(),
    owners,
  )
  const receipts = loadReceiptsFromDirectory(receiptsDir)
  const { summary, failed } = verifyOwnerReceipts(ownerId, group, receipts, plan, {
    runtimeManifestPath: option(argv, 'runtime-manifest'),
    expectedCommitSha: option(argv, 'commit-sha'),
  })
  const evidenceOut = option(argv, 'evidence-out')
  if (evidenceOut) {
    const absolute = resolve(root, evidenceOut)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, `${JSON.stringify(summary, null, 2)}\n`)
  }
  console.log(
    `[playwright-layout] owner=${ownerId} group=${group} status=${summary.status} cells=${summary.cells.length}`,
  )
  if (failed) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
