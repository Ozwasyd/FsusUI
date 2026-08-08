#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadMarkdownOwnerPlan } from './markdown-playwright-plan.mjs'
import { sha256File, validateCellReceipt } from './layout-playwright-verify.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const fail = (message) => {
  throw new Error(message)
}

export function loadMarkdownReceiptsFromDirectory(directory) {
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

export async function verifyMarkdownOwnerReceipts(
  ownerId,
  group,
  receipts,
  plan,
  options = {},
) {
  if (!plan || plan.owner !== ownerId || plan.group !== group) {
    fail('markdown owner verify requires the matching owner plan')
  }
  const expected = new Map(plan.cells.map((cell) => [cell.id, cell]))
  const actual = new Map(receipts.map((receipt) => [receipt.cellId, receipt]))
  const summary = { owner: ownerId, gate: plan.gate, group, cells: [] }
  let failed = false

  for (const [cellId, cell] of expected) {
    const receipt = actual.get(cellId)
    const entry = { cellId, status: receipt?.status ?? 'missing', tests: receipt?.tests ?? null }
    summary.cells.push(entry)
    if (!receipt) {
      failed = true
      console.error(`[playwright-markdown] missing receipt for ${cellId}`)
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
      if (receipt.runtime?.runtimeMode !== 'native') {
        fail(`receipt ${cellId} runtimeMode must be native`)
      }
      if (
        options.expectedCommitSha &&
        receipt.commitSha !== options.expectedCommitSha
      ) {
        fail(
          `receipt ${cellId} binds ${receipt.commitSha}, expected ${options.expectedCommitSha}`,
        )
      }
      const manifestPath = resolve(
        root,
        options.evidenceDir ?? '.tmp/playwright-markdown',
        'runtime-manifests',
        `${cell.suiteId}.json`,
      )
      if (!existsSync(manifestPath)) {
        fail(`markdown runtime manifest missing: ${manifestPath}`)
      }
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      if (receipt.runtime.manifestDigest !== sha256File(manifestPath)) {
        fail(`receipt ${cellId} runtime manifestDigest does not match current runtime`)
      }
      if (receipt.runtime.sourceFingerprint !== manifest.sourceFingerprint) {
        fail(`receipt ${cellId} runtime sourceFingerprint does not match current runtime`)
      }
      if (manifest.fingerprintInputs && manifest.fingerprintInputs.length > 0) {
        for (const input of manifest.fingerprintInputs) {
          if (!receipt.runtime.fingerprintInputs?.includes(input)) {
            fail(`receipt ${cellId} runtime fingerprint inputs do not match current runtime`)
          }
        }
      }
      if (receipt.status !== 'success') {
        fail(`cell ${cellId} status=${receipt.status}`)
      }
    } catch (error) {
      failed = true
      console.error(
        `[playwright-markdown] invalid receipt ${cellId}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  for (const receipt of receipts) {
    if (!expected.has(receipt.cellId)) {
      failed = true
      console.error(`[playwright-markdown] unexpected receipt ${receipt.cellId}`)
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

async function main(argv = process.argv.slice(2)) {
  const command = argv[0]
  if (command !== 'owner-verify') {
    fail('Usage: markdown-playwright-verify.mjs owner-verify --owner <id> --group <g> --receipts-dir <dir> [--evidence-dir <dir>] [--commit-sha <sha>] [--evidence-out <path>]')
  }
  const ownerId = option(argv, 'owner')
  const group = option(argv, 'group', 'main')
  const receiptsDir = option(argv, 'receipts-dir')
  if (!ownerId || !receiptsDir) fail('owner-verify requires --owner and --receipts-dir')
  const plan = loadMarkdownOwnerPlan(group)
  const receipts = loadMarkdownReceiptsFromDirectory(receiptsDir)
  const { summary, failed } = await verifyMarkdownOwnerReceipts(ownerId, group, receipts, plan, {
    evidenceDir: option(argv, 'evidence-dir'),
    expectedCommitSha: option(argv, 'commit-sha'),
  })
  const evidenceOut = option(argv, 'evidence-out')
  if (evidenceOut) {
    const absolute = resolve(root, evidenceOut)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, `${JSON.stringify(summary, null, 2)}\n`)
  }
  console.log(
    `[playwright-markdown] owner=${ownerId} group=${group} status=${summary.status} cells=${summary.cells.length}`,
  )
  if (failed) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
