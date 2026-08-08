#!/usr/bin/env node
/* global fetch, setTimeout */

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadVisualReuseOwnerPlan } from './visual-reuse-playwright-plan.mjs'
import { runVisualReuseCell } from './visual-reuse-playwright-runner.mjs'
import {
  loadVisualReuseReceiptsFromDirectory,
  verifyVisualReuseOwnerReceipts,
} from './visual-reuse-playwright-verify.mjs'
import { sha256File } from './layout-playwright-verify.mjs'

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

const runPrepare = (runtimeDir) => {
  console.log(`[visual-runtime-reuse] preparing visual runtime: ${runtimeDir}`)
  const result = spawnSync(
    process.execPath,
    ['scripts/prepare-visual-runtime.mjs', `--runtime-dir=${runtimeDir}`],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  if (result.status !== 0) {
    throw new Error(
      `visual runtime prepare failed (${result.status ?? 'no status'}):\n${result.stdout}\n${result.stderr}`,
    )
  }
}

const runRuntimeCheck = (runtimeDir) => {
  console.log(`[visual-runtime-reuse] checking runtime: ${runtimeDir}`)
  const result = spawnSync(
    process.execPath,
    ['scripts/prepare-visual-runtime.mjs', '--check', `--runtime-dir=${runtimeDir}`],
    { cwd: root, encoding: 'utf8' },
  )
  if (result.status !== 0) {
    throw new Error(
      `visual runtime check failed (${result.status ?? 'no status'}):\n${result.stdout}\n${result.stderr}`,
    )
  }
}

async function main(argv = process.argv.slice(2)) {
  const ownerId = option(argv, 'owner', 'visual-runtime-reuse')
  const group = option(argv, 'group', 'main')
  const requestedCell = option(argv, 'cell')
  const evidenceDir = option(argv, 'evidence-dir', '.tmp/visual-runtime-reuse')
  const runtimeDir = option(argv, 'runtime-dir', '.tmp/visual-runtime-reuse-runtime')
  const serverPort = Number(option(argv, 'server-port', '4182'))
  const skipPrepare = hasFlag(argv, 'skip-prepare')
  const dryRun = hasFlag(argv, 'dry-run')

  const plan = loadVisualReuseOwnerPlan(group)
  const cells = requestedCell
    ? plan.cells.filter((cell) => cell.id === requestedCell)
    : plan.cells
  if (requestedCell && cells.length === 0) {
    fail(`unknown cell ${requestedCell} for owner ${ownerId} group ${group}`)
  }

  const commitSha = process.env.GITHUB_SHA ?? readRepositoryCommit()
  console.log(
    `[visual-runtime-reuse] owner=${ownerId} group=${group} cells=${cells.length} commit=${commitSha} digest=${plan.digest}`,
  )
  if (dryRun) {
    for (const cell of cells) {
      console.log(`- ${cell.id} ${cell.command}`)
    }
    return
  }

  // Step 1: Prepare runtime once
  if (!skipPrepare) {
    runPrepare(runtimeDir)
  }
  runRuntimeCheck(runtimeDir)

  // Step 2: Capture before-digest of runtime
  const manifestPath = `${runtimeDir}/manifest.json`
  const beforeManifestDigest = sha256File(resolve(root, manifestPath))

  // Step 3: Start preview server
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

    // Step 4: Run all cells
    for (const cell of cells) {
      const result = await runVisualReuseCell(ownerId, cell.id, group, {
        runtimeDir,
        evidenceDir,
        serverUrl,
      })
      results.push(result)
      if (!result.ok) overallFailed = true
    }
  } finally {
    // Step 5: Stop server
    if (server && !server.killed) server.kill('SIGTERM')
  }

  // Step 6: Capture after-digest and verify no rebuild
  const afterManifestDigest = sha256File(resolve(root, manifestPath))
  if (afterManifestDigest !== beforeManifestDigest) {
    overallFailed = true
    console.error(
      `[visual-runtime-reuse] RUNTIME INTEGRITY FAILURE: manifest digest changed during suite execution (before=${beforeManifestDigest}, after=${afterManifestDigest})`,
    )
  }

  // Step 7: Verify receipts
  const receipts = loadVisualReuseReceiptsFromDirectory(
    resolve(root, plan.receiptDirectory),
  )
  const { summary, failed } = await verifyVisualReuseOwnerReceipts(
    ownerId,
    group,
    receipts,
    plan,
    {
      runtimeDir,
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
    runtimeMode: plan.runtimeMode,
    runtimeIntegrity: {
      beforeManifestDigest,
      afterManifestDigest,
      manifestIdentical: beforeManifestDigest === afterManifestDigest,
    },
    cells: results,
    aggregate: summary,
  }
  const evidencePath = resolve(root, evidenceDir, 'evidence.json')
  mkdirSync(dirname(evidencePath), { recursive: true })
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)

  const finalStatus = overallFailed || failed ? 'failure' : 'success'
  console.log(
    `[visual-runtime-reuse] owner=${ownerId} group=${group} status=${finalStatus} cells=${summary.cells.length} evidence=${evidencePath.slice(root.length + 1)}`,
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
