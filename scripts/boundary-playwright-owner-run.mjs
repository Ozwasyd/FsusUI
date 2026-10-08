#!/usr/bin/env node
/* global AbortSignal, URL, clearTimeout, fetch, setTimeout */

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
import { runBoundaryCell } from './boundary-playwright-runner.mjs'
import { filterOwnerPlanByImpact } from './playwright-impact-filter.mjs'
import {
  loadBoundaryReceiptsFromDirectory,
  verifyBoundaryOwnerReceipts,
} from './boundary-playwright-verify.mjs'
import { loadPlaywrightSuiteRegistry } from './playwright-suites.mjs'
import { BOUNDARY_FIXED_CELLS } from './boundary-playwright-plan.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

export const waitForBoundaryServer = async (
  server,
  url,
  timeoutMs = 90_000,
) => {
  const address = new URL(url)
  const ready = await new Promise((resolvePromise, reject) => {
    const finish = (error, message) => {
      clearTimeout(timer)
      server.off('error', onError)
      server.off('exit', onExit)
      server.off('message', onMessage)
      if (error) reject(error)
      else resolvePromise(message)
    }
    const onError = (error) => finish(error)
    const onExit = (code, signal) =>
      finish(
        new Error(
          `boundary server exited before binding ${url} (${signal ?? code})`,
        ),
      )
    const onMessage = (message) => {
      if (message?.type !== 'visual-runtime-ready') return
      if (
        message.host !== address.hostname ||
        message.port !== Number(address.port) ||
        typeof message.fingerprint !== 'string' ||
        !message.fingerprint
      ) {
        finish(
          new Error(`boundary server bind acknowledgement mismatched ${url}`),
        )
        return
      }
      finish(null, message)
    }
    const timer = setTimeout(
      () => finish(new Error(`boundary server bind timeout: ${url}`)),
      timeoutMs,
    )
    server.once('error', onError)
    server.once('exit', onExit)
    server.on('message', onMessage)
    if (server.exitCode !== null || server.signalCode !== null) {
      onExit(server.exitCode, server.signalCode)
    }
  })
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (
    server.exitCode !== null ||
    server.signalCode !== null ||
    response.status !== 200 ||
    response.headers.get('X-Fsus-Visual-Runtime') !== ready.fingerprint
  ) {
    fail(`boundary server ownership/readiness validation failed: ${url}`)
  }
}

async function main(argv = process.argv.slice(2)) {
  const ownerId = option(argv, 'owner', 'playwright-boundary')
  const group = option(argv, 'group', 'main')
  const requestedCell = option(argv, 'cell')
  const runtimeDir = option(argv, 'runtime-dir', '.tmp/visual-runtime-playwright')
  const evidenceDir = option(argv, 'evidence-dir', '.tmp/playwright-boundary')
  const serverPort = Number(option(argv, 'server-port', '4181'))
  const impactPlanPath = option(argv, 'impact-plan', '')
  const skipPrepare = hasFlag(argv, 'skip-prepare')
  const dryRun = hasFlag(argv, 'dry-run')

  const registry = loadPlaywrightSuiteRegistry()
  const owners = loadPlaywrightOwners()
  const plan = planOwnerCells(ownerId, group, registry, owners)
  if (group === 'main' || group === 'nightly' || group === 'release') {
    assertOwnerFixedCells(plan, [...BOUNDARY_FIXED_CELLS])
  }
  const isolation = validatePlanIsolation(plan)
  if (isolation.length > 0) {
    fail(`boundary owner plan isolation failed: ${isolation.join('; ')}`)
  }
  const { plan: selectedPlan, impactPlanDigest } = filterOwnerPlanByImpact({
    root,
    plan,
    group,
    impactPlanPath,
  })
  const cells = requestedCell
    ? selectedPlan.cells.filter((cell) => cell.id === requestedCell)
    : selectedPlan.cells
  if (requestedCell && cells.length === 0) {
    fail(`unknown cell ${requestedCell} for owner ${ownerId} group ${group}`)
  }

  const commitSha = process.env.GITHUB_SHA ?? readRepositoryCommit()

  if (cells.length === 0) {
    console.log(
      `[playwright-boundary] owner=${ownerId} group=${group} has no cells selected (PR profile excludes all suites); generating skip receipt`,
    )
    const skipReceipt = {
      schemaVersion: 1,
      owner: ownerId,
      gate: plan.gate,
      group,
      commitSha,
      planDigest: plan.digest,
      impactPlanDigest,
      runtimeMode: plan.runtimeMode,
      skipReason: 'no cells selected for profile',
      status: 'success',
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
    }
    const evidencePath = resolve(root, evidenceDir, 'evidence.json')
    mkdirSync(dirname(evidencePath), { recursive: true })
    writeFileSync(evidencePath, `${JSON.stringify(skipReceipt, null, 2)}\n`)
    console.log(
      `[playwright-boundary] owner=${ownerId} group=${group} status=success (skipped) evidence=${evidencePath.slice(root.length + 1)}`,
    )
    return
  }

  console.log(
    `[playwright-boundary] owner=${ownerId} group=${group} cells=${cells.length} commit=${commitSha} digest=${plan.digest}`,
  )
  if (dryRun) {
    for (const cell of cells) {
      console.log(`- ${cell.id} ${cell.command}`)
    }
    return
  }

  if (!skipPrepare) {
    console.log(`[playwright-boundary] preparing visual runtime once: ${runtimeDir}`)
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
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
    )
    server.stdout.pipe(process.stdout)
    server.stderr.pipe(process.stderr)
    await waitForBoundaryServer(server, serverUrl)
    for (const cell of cells) {
      const result = await runBoundaryCell(ownerId, cell.id, group, {
        evidenceDir,
        serverUrl,
      })
      results.push(result)
      if (!result.ok) overallFailed = true
    }
  } finally {
    if (server && !server.killed) server.kill('SIGTERM')
  }

  const receipts = loadBoundaryReceiptsFromDirectory(
    resolve(root, selectedPlan.receiptDirectory),
  )
  const { summary, failed } = await verifyBoundaryOwnerReceipts(
    ownerId,
    group,
    receipts,
    selectedPlan,
    {
      evidenceDir,
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
    impactPlanDigest,
    runtimeMode: plan.runtimeMode,
    runtimeManifest: `${runtimeDir}/manifest.json`,
    cells: results,
    aggregate: summary,
  }
  const evidencePath = resolve(root, evidenceDir, 'evidence.json')
  mkdirSync(dirname(evidencePath), { recursive: true })
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)

  const finalStatus = overallFailed || failed ? 'failure' : 'success'
  console.log(
    `[playwright-boundary] owner=${ownerId} group=${group} status=${finalStatus} cells=${summary.cells.length} evidence=${evidencePath.slice(root.length + 1)}`,
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
