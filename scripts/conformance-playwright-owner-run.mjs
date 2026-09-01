#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadConformanceOwnerPlan } from './conformance-playwright-plan.mjs'
import { runConformanceCell } from './conformance-playwright-runner.mjs'
import {
  loadConformanceReceiptsFromDirectory,
  verifyConformanceOwnerReceipts,
} from './conformance-playwright-verify.mjs'
import { filterOwnerPlanByImpact } from './playwright-impact-filter.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const option = (args, name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) return args[index + 1]
  const prefix = `--${name}=`
  return (
    args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
  )
}

const hasFlag = (args, name) => args.includes(`--${name}`)

const repositoryCommit = () =>
  spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim()

export async function runConformanceOwner(argv = process.argv.slice(2)) {
  const ownerId = option(argv, 'owner', 'playwright-conformance')
  const group = option(argv, 'group', 'main')
  const requestedCell = option(argv, 'cell')
  const evidenceDir = option(
    argv,
    'evidence-dir',
    '.tmp/playwright-conformance',
  )
  const impactPlanPath = option(argv, 'impact-plan', '')
  const dryRun = hasFlag(argv, 'dry-run')
  const plan = loadConformanceOwnerPlan(group)
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
    throw new Error(
      `unknown cell ${requestedCell} for ${ownerId} group ${group}`,
    )
  }
  const commitSha = process.env.GITHUB_SHA ?? repositoryCommit()

  if (cells.length === 0) {
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
      `[playwright-conformance] owner=${ownerId} group=${group} status=success (skipped)`,
    )
    return { status: 'success', skipped: true }
  }

  console.log(
    `[playwright-conformance] owner=${ownerId} group=${group} cells=${cells.length} commit=${commitSha} digest=${plan.digest}`,
  )
  if (dryRun) {
    for (const cell of cells) console.log(`- ${cell.id} ${cell.command}`)
    return { status: 'success', dryRun: true }
  }

  const results = []
  let overallFailed = false
  for (const cell of cells) {
    const result = await runConformanceCell(ownerId, cell.id, group, {
      evidenceDir,
    })
    results.push(result)
    if (!result.ok) overallFailed = true
  }

  const receipts = loadConformanceReceiptsFromDirectory(
    resolve(root, selectedPlan.receiptDirectory),
  )
  const { summary, failed } = await verifyConformanceOwnerReceipts(
    ownerId,
    group,
    receipts,
    selectedPlan,
    { evidenceDir, expectedCommitSha: commitSha || undefined },
  )
  const finalStatus = overallFailed || failed ? 'failure' : 'success'
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
    status: finalStatus,
  }
  const evidencePath = resolve(root, evidenceDir, 'evidence.json')
  mkdirSync(dirname(evidencePath), { recursive: true })
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(
    `[playwright-conformance] owner=${ownerId} group=${group} status=${finalStatus} cells=${summary.cells.length}`,
  )
  if (finalStatus !== 'success') process.exitCode = 1
  return { status: finalStatus, evidencePath }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await runConformanceOwner()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
