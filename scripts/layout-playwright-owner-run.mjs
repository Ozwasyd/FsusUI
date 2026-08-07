#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
  validatePlanIsolation,
} from './layout-playwright-plan.mjs'
import { runCell } from './layout-playwright-runner.mjs'
import {
  loadReceiptsFromDirectory,
  verifyOwnerReceipts,
} from './layout-playwright-verify.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_CELLS = Object.freeze([
  'dom-layout/desktop-light',
  'dom-layout/mobile-light',
  'dom-layout/desktop-dark',
  'dom-layout/mobile-dark',
  'geometry-smoke/chromium',
])

const fail = (message) => {
  throw new Error(message)
}

const option = (args, name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) return args[index + 1]
  const prefix = `--${name}=`
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

const hasFlag = (args, name) => args.includes(`--${name}`)

const readRepositoryCommit = () => {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  })
  return result.status === 0 ? result.stdout.trim() : ''
}

const runPrepare = (runtimeDir, checkOnly = false) => {
  const args = [
    'scripts/prepare-visual-runtime.mjs',
    ...(checkOnly ? ['--check'] : []),
    `--runtime-dir=${runtimeDir}`,
  ]
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(
      `visual runtime ${checkOnly ? 'check' : 'prepare'} failed (${result.status ?? 'no status'}):\n${result.stdout}\n${result.stderr}`,
    )
  }
}

const waitForServer = async (url, timeoutMs = 90_000) => {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.status === 200) return true
      lastError = new Error(`server responded ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500))
  }
  throw lastError ?? new Error(`server readiness timeout: ${url}`)
}

async function main(argv = process.argv.slice(2)) {
  const ownerId = option(argv, 'owner', 'playwright-layout')
  const group = option(argv, 'group', 'main')
  const requestedCell = option(argv, 'cell')
  const runtimeDir = option(argv, 'runtime-dir', '.tmp/visual-runtime-playwright')
  const evidenceDir = option(argv, 'evidence-dir', '.tmp/playwright-layout')
  const serverPort = Number(option(argv, 'server-port', '4181'))
  const skipPrepare = hasFlag(argv, 'skip-prepare')
  const dryRun = hasFlag(argv, 'dry-run')

  const registry = loadPlaywrightSuiteRegistry()
  const owners = loadPlaywrightOwners()
  const plan = planOwnerCells(ownerId, group, registry, owners)
  if (group === 'main' || group === 'nightly' || group === 'release') {
    assertOwnerFixedCells(plan, [...DEFAULT_CELLS])
  }
  const isolation = validatePlanIsolation(plan)
  if (isolation.length > 0) {
    fail(`owner plan isolation failed: ${isolation.join('; ')}`)
  }
  const cells = requestedCell
    ? plan.cells.filter((cell) => cell.id === requestedCell)
    : plan.cells
  if (requestedCell && cells.length === 0) {
    fail(`unknown cell ${requestedCell} for owner ${ownerId} group ${group}`)
  }

  const commitSha = process.env.GITHUB_SHA ?? readRepositoryCommit()
  console.log(
    `[playwright-layout] owner=${ownerId} group=${group} cells=${cells.length} commit=${commitSha} digest=${plan.digest}`,
  )
  if (dryRun) {
    for (const cell of cells) {
      console.log(`- ${cell.id} ${cell.command}`)
    }
    return
  }

  if (!skipPrepare) {
    console.log(`[playwright-layout] preparing visual runtime once: ${runtimeDir}`)
    runPrepare(runtimeDir)
  }
  runPrepare(runtimeDir, true)

  const serverUrl = `http://127.0.0.1:${serverPort}`
  let server
  const results = []
  let overallFailed = false
  try {
    server = spawn(
      process.execPath,
      [
        'scripts/serve-visual-runtime.mjs',
        '--suite=preview',
        '--host=127.0.0.1',
        `--port=${serverPort}`,
        `--runtime-dir=${runtimeDir}`,
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    await waitForServer(serverUrl)
    for (const cell of cells) {
      const result = await runCell(ownerId, cell.id, group, {
        runtimeDir,
        evidenceDir,
        serverUrl,
      })
      results.push(result)
      if (!result.ok) overallFailed = true
    }
  } finally {
    if (server && !server.killed) server.kill('SIGTERM')
  }

  const receipts = loadReceiptsFromDirectory(
    resolve(root, plan.receiptDirectory),
  )
  const { summary, failed } = verifyOwnerReceipts(
    ownerId,
    group,
    receipts,
    plan,
    {
      runtimeManifestPath: `${runtimeDir}/manifest.json`,
      expectedCommitSha: commitSha || undefined,
    },
  )
  const evidence = {
    schemaVersion: 1,
    owner: ownerId,
    gate: plan.gate,
    group,
    commitSha,
    planDigest: plan.digest,
    runtimeManifest: `${runtimeDir}/manifest.json`,
    cells: results,
    aggregate: summary,
  }
  const evidencePath = resolve(root, evidenceDir, 'evidence.json')
  mkdirSync(dirname(evidencePath), { recursive: true })
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)

  const finalStatus = overallFailed || failed ? 'failure' : 'success'
  console.log(
    `[playwright-layout] owner=${ownerId} group=${group} status=${finalStatus} cells=${summary.cells.length} evidence=${evidencePath.slice(root.length + 1)}`,
  )
  if (finalStatus !== 'success') process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
