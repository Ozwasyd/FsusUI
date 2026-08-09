#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadMarkdownOwnerPlan } from './markdown-playwright-plan.mjs'
import { runMarkdownCell } from './markdown-playwright-runner.mjs'
import {
  loadMarkdownReceiptsFromDirectory,
  verifyMarkdownOwnerReceipts,
} from './markdown-playwright-verify.mjs'

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

async function main(argv = process.argv.slice(2)) {
  const ownerId = option(argv, 'owner', 'playwright-markdown')
  const group = option(argv, 'group', 'main')
  const requestedCell = option(argv, 'cell')
  const evidenceDir = option(argv, 'evidence-dir', '.tmp/playwright-markdown')
  const dryRun = hasFlag(argv, 'dry-run')

  const plan = loadMarkdownOwnerPlan(group)
  const cells = requestedCell
    ? plan.cells.filter((cell) => cell.id === requestedCell)
    : plan.cells
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

  const results = []
  let overallFailed = false
  for (const cell of cells) {
    const result = await runMarkdownCell(ownerId, cell.id, group, { evidenceDir })
    results.push(result)
    if (!result.ok) overallFailed = true
  }

  const receipts = loadMarkdownReceiptsFromDirectory(
    resolve(root, plan.receiptDirectory),
  )
  const { summary, failed } = await verifyMarkdownOwnerReceipts(
    ownerId,
    group,
    receipts,
    plan,
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
