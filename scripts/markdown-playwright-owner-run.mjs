#!/usr/bin/env node
/* global fetch, setTimeout */

import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadMarkdownOwnerPlan } from './markdown-playwright-plan.mjs'
import {
  computeMarkdownCellRuntime,
  runMarkdownCell,
} from './markdown-playwright-runner.mjs'
import { filterOwnerPlanByImpact } from './playwright-impact-filter.mjs'
import {
  loadMarkdownReceiptsFromDirectory,
  verifyMarkdownOwnerReceipts,
} from './markdown-playwright-verify.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

const buildDemoOnce = () => {
  const result = spawnSync('pnpm', ['run', 'build:demo'], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`demo build failed with status ${result.status ?? -1}`)
  }
}

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

async function main(argv = process.argv.slice(2)) {
  const ownerId = option(argv, 'owner', 'playwright-markdown')
  const group = option(argv, 'group', 'main')
  const requestedCell = option(argv, 'cell')
  const evidenceDir = option(argv, 'evidence-dir', '.tmp/playwright-markdown')
  const impactPlanPath = option(argv, 'impact-plan', '')
  const dryRun = hasFlag(argv, 'dry-run')

  const plan = loadMarkdownOwnerPlan(group)
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
      `[playwright-markdown] owner=${ownerId} group=${group} has no cells selected; generating skip receipt`,
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
      `[playwright-markdown] owner=${ownerId} group=${group} status=success (skipped)`,
    )
    return
  }

  console.log(
    `[playwright-markdown] owner=${ownerId} group=${group} cells=${cells.length} commit=${commitSha} digest=${plan.digest}`,
  )
  if (dryRun) {
    for (const cell of cells) {
      console.log(`- ${cell.id} ${cell.command}`)
    }
    return
  }

  const serverPort = Number(
    option(
      argv,
      'server-port',
      process.env.FSUS_MARKDOWN_EDITOR_PORT ?? '5191',
    ),
  )
  const serverUrl = `http://127.0.0.1:${serverPort}`
  const precomputedRuntime = await computeMarkdownCellRuntime(cells[0])
  buildDemoOnce()
  const server = spawn(
    'pnpm',
    [
      '-C',
      'vue/packages/demo-app',
      'exec',
      'vite',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(serverPort),
      '--strictPort',
    ],
    { cwd: root, stdio: 'ignore' },
  )
  let results = []
  let overallFailed = false
  try {
    await waitForServer(serverUrl)
    const concurrency = Math.max(
      1,
      Math.min(
        cells.length,
        Number(process.env.FSUS_PLAYWRIGHT_CELL_CONCURRENCY) || 3,
      ),
    )
    results = new Array(cells.length)
    let cursor = 0
    async function cellWorker() {
      while (cursor < cells.length) {
        const index = cursor
        cursor += 1
        const cell = cells[index]
        const result = await runMarkdownCell(ownerId, cell.id, group, {
          evidenceDir,
          externalServer: true,
          precomputedRuntime,
          runtimeManifestId: (entry) => `${entry.suiteId}-${entry.project}`,
          envOverrides: {
            FSUS_MARKDOWN_EDITOR_PORT: String(serverPort),
          },
        })
        results[index] = result
        if (!result.ok) overallFailed = true
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => cellWorker()))
  } finally {
    server.kill('SIGTERM')
  }

  const receipts = loadMarkdownReceiptsFromDirectory(
    resolve(root, selectedPlan.receiptDirectory),
  )
  const { summary, failed } = await verifyMarkdownOwnerReceipts(
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
    cells: results,
    aggregate: summary,
  }
  const evidencePath = resolve(root, evidenceDir, 'evidence.json')
  mkdirSync(dirname(evidencePath), { recursive: true })
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)

  const finalStatus = overallFailed || failed ? 'failure' : 'success'
  console.log(
    `[playwright-markdown] owner=${ownerId} group=${group} status=${finalStatus} cells=${summary.cells.length}`,
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
