#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  playwrightRegistry,
  playwrightRegistryHash,
  readinessSpec,
  repositoryCommit,
  sha256Path,
  validatePlaywrightPrReadiness,
  validateReadiness,
} from './ci-readiness-contract.mjs'
import { expectedPlaywrightCells } from './playwright-registry.mjs'
import { verifyReleaseIdentity } from './release-profile-identity.mjs'

const args = process.argv.slice(2).filter((arg) => arg !== '--')
const command = args.shift()
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) return args[index + 1]
  const prefix = `--${name}=`
  return (
    args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
  )
}
const options = (name) => {
  const flag = `--${name}`
  const prefix = `${flag}=`
  return args.flatMap((arg, index) => {
    if (arg.startsWith(prefix)) return [arg.slice(prefix.length)]
    if (arg === flag && args[index + 1]) return [args[index + 1]]
    return []
  })
}
const pairs = (values, label) =>
  Object.fromEntries(
    values.map((value) => {
      const separator = value.indexOf('=')
      if (separator <= 0) throw new Error(`${label} must use name=value.`)
      return [value.slice(0, separator), value.slice(separator + 1)]
    }),
  )
const jsonFiles = (root) => {
  const files = []
  const visit = (directory) => {
    for (const entry of readdirSafe(directory)) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(absolute)
      else if (
        entry.name.endsWith('.json') &&
        absolute.includes(`${path.sep}manifests${path.sep}`)
      )
        files.push(absolute)
    }
  }
  visit(root)
  return files.sort()
}

const readdirSafe = (directory) => {
  try {
    return readdirSync(directory, { withFileTypes: true })
  } catch {
    return []
  }
}

const isPlaywrightGate = (gate) =>
  readinessSpec.playwright?.ownerIds?.includes(gate) ?? false

const computeInputFingerprint = (root, explicitInputs) => {
  const inputFiles = explicitInputs.length
    ? explicitInputs
    : [
        'package.json',
        'pnpm-lock.yaml',
        '.github/workflows/_quality.yml',
        'spec/ci/readiness-gates.json',
        'spec/ci/playwright-owners.json',
        'spec/ci/playwright-suites.json',
      ]
  const fingerprint = createHash('sha256')
  for (const input of inputFiles.sort()) {
    const absolute = path.resolve(root, input)
    fingerprint.update(input)
    fingerprint.update('\0')
    if (existsSync(absolute)) fingerprint.update(readFileSync(absolute))
    fingerprint.update('\0')
  }
  return fingerprint.digest('hex')
}

const runIdentity = () => ({
  id: String(option('run-id', process.env.GITHUB_RUN_ID ?? 'local')),
  attempt: String(
    option('run-attempt', process.env.GITHUB_RUN_ATTEMPT ?? '1'),
  ),
})

const baseManifest = (root, gate, group, status) => ({
  schemaVersion: 1,
  workflowGroup: group,
  commitSha: option('commit', process.env.GITHUB_SHA ?? repositoryCommit(root)),
  gate,
  status,
  toolchain: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  inputFingerprint: computeInputFingerprint(root, options('input')),
  createdAt: new Date().toISOString(),
  run: runIdentity(),
})

const emitPlaywright = (root, gate, group) => {
  const evidenceRoot = path.resolve(root, option('evidence-root', '.readiness'))
  const profile = group === 'pr' ? 'pr' : group
  const expected = expectedPlaywrightCells(
    playwrightRegistry,
    [gate],
    profile,
  )
  let plan = null
  const planPath = option('playwright-plan')
  if (planPath) {
    const absolute = path.resolve(root, planPath)
    if (!existsSync(absolute))
      throw new Error(`playwright impact plan is missing: ${planPath}`)
    plan = JSON.parse(readFileSync(absolute, 'utf8'))
    if (plan.schemaVersion !== 1)
      throw new Error('playwright impact plan schemaVersion must be 1.')
  }
  const decisions = new Map(
    (plan?.decisions ?? []).map((decision) => [decision.suiteId, decision]),
  )
  const isPr = group === 'pr'
  if (isPr && !plan)
    throw new Error('emit playwright for pr group requires --playwright-plan.')
  const cellsToRun = isPr
    ? expected.filter((cell) => decisions.get(cell.suiteId)?.decision === 'run')
    : expected
  const skippedSuiteIds = isPr
    ? [
        ...new Set(
          expected
            .map((cell) => cell.suiteId)
            .filter((suiteId, index, all) => all.indexOf(suiteId) === index)
            .filter((suiteId) => decisions.get(suiteId)?.decision === 'skip'),
        ),
      ]
    : []
  const receiptsDir = path.resolve(
    root,
    option(
      'playwright-receipts',
      path.join(evidenceRoot, 'receipts', gate),
    ),
  )
  const emitted = []
  for (const cell of cellsToRun) {
    const receiptFile = `${cell.cellId.replaceAll('/', '-')}.json`
    const receiptPath = path.join(receiptsDir, receiptFile)
    if (!existsSync(receiptPath))
      throw new Error(
        `missing playwright receipt for ${cell.cellId} at ${receiptPath}.`,
      )
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'))
    if (receipt.cellId !== cell.cellId)
      throw new Error(`playwright receipt cellId mismatch for ${cell.cellId}.`)
    if (receipt.status !== 'success')
      throw new Error(
        `playwright receipt ${cell.cellId} status is ${receipt.status}.`,
      )
    const reportSource = receipt.report?.path
      ? path.resolve(root, receipt.report.path)
      : null
    if (!reportSource || !existsSync(reportSource))
      throw new Error(`missing playwright report for ${cell.cellId}.`)
    const receiptRelative = path.relative(evidenceRoot, receiptPath)
    const reportRelative = path.join(
      'receipts',
      gate,
      'reports',
      `${cell.cellId.replaceAll('/', '-')}.json`,
    )
    const reportDest = path.resolve(evidenceRoot, reportRelative)
    mkdirSync(path.dirname(reportDest), { recursive: true })
    copyFileSync(reportSource, reportDest)
    const receiptDigest = sha256Path(receiptPath)
    const reportDigest = sha256Path(reportDest)
    const id = `${gate}-${cell.cellId.replaceAll('/', '-')}`
    const reportSummary = `reports/${id}.json`
    const browser = cell.dimensions.browser
    const revision =
      receipt.toolchain?.[
        browser === 'chromium'
          ? 'chromiumRevision'
          : browser === 'firefox'
            ? 'firefoxRevision'
            : 'webkitRevision'
      ] ?? receipt.toolchain?.chromiumRevision
    const manifest = {
      ...baseManifest(root, gate, group, receipt.status),
      artifacts: [
        {
          name: `receipt-${cell.cellId}`,
          path: receiptRelative,
          sha256: receiptDigest,
        },
        {
          name: `report-${cell.cellId}`,
          path: reportRelative,
          sha256: reportDigest,
        },
      ],
      dimensions: {},
      playwright: {
        decision: 'run',
        suiteId: cell.suiteId,
        cellId: cell.cellId,
        dimensions: cell.dimensions,
        registryHash: playwrightRegistryHash,
        ...(isPr ? { impactPlanDigest: plan.planDigest } : {}),
        tests: receipt.tests,
        config: receipt.config,
        runtime: {
          browser,
          browserRevision: revision ?? 'unknown',
          runtimeMode:
            receipt.runtime?.mode ?? cell.dimensions.runtimeMode ?? null,
        },
        report: { path: reportRelative, sha256: reportDigest },
        receiptPath: receiptRelative,
        receiptDigest,
      },
      reportSummary,
    }
    const output = path.resolve(
      root,
      option('output', path.join(evidenceRoot, 'manifests', `${id}.json`)),
    )
    mkdirSync(path.dirname(output), { recursive: true })
    writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`)
    const reportPath = path.join(evidenceRoot, reportSummary)
    mkdirSync(path.dirname(reportPath), { recursive: true })
    writeFileSync(
      reportPath,
      `${JSON.stringify(
        { gate, status: receipt.status, cellId: cell.cellId },
        null,
        2,
      )}\n`,
    )
    emitted.push(id)
  }
  for (const suiteId of skippedSuiteIds) {
    const id = `${gate}-${suiteId}-skip`
    const reportSummary = `reports/${id}.json`
    const manifest = {
      ...baseManifest(root, gate, group, 'success'),
      artifacts: [],
      dimensions: {},
      playwright: {
        decision: 'skip',
        suiteId,
        registryHash: playwrightRegistryHash,
        impactPlanDigest: plan.planDigest,
        tests: { total: 0, passed: 0, failed: 0, skipped: 0 },
      },
      reportSummary,
    }
    const output = path.resolve(
      root,
      option('output', path.join(evidenceRoot, 'manifests', `${id}.json`)),
    )
    mkdirSync(path.dirname(output), { recursive: true })
    writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`)
    const reportPath = path.join(evidenceRoot, reportSummary)
    mkdirSync(path.dirname(reportPath), { recursive: true })
    writeFileSync(
      reportPath,
      `${JSON.stringify({ gate, status: 'success', suiteId, skip: true }, null, 2)}\n`,
    )
    emitted.push(id)
  }
  console.log(
    `[ci-readiness] playwright emitted=${emitted.join(',') || 'none'} gate=${gate} group=${group}`,
  )
}

if (command === 'plan') {
  const profile = option('group', 'main')
  const required = readinessSpec.profiles[profile]
  if (!required) throw new Error(`Unknown readiness profile: ${profile}.`)
  console.log(
    JSON.stringify(
      {
        schemaVersion: readinessSpec.schemaVersion,
        profile,
        gates: required.map((gate) => ({
          gate,
          ...readinessSpec.owners[gate],
        })),
        artifactBindings: readinessSpec.artifactBindings,
        execution: 'read-only-manifest-aggregation',
      },
      null,
      2,
    ),
  )
} else if (command === 'emit') {
  const root = path.resolve(option('root', '.'))
  const gate = option('gate')
  const group = option('group')
  const status = option('status', 'success')
  if (!gate || !readinessSpec.owners[gate])
    throw new Error(`Unknown leaf gate: ${gate}.`)
  if (!group) throw new Error('--group is required.')
  if (isPlaywrightGate(gate)) {
    emitPlaywright(root, gate, group)
    process.exit(0)
  }
  const dimensions = pairs(options('dimension'), '--dimension')
  const suffix = Object.values(dimensions).join('-')
  const id = [gate, suffix]
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9_.-]+/giu, '-')
  const evidenceRoot = path.resolve(root, option('evidence-root', '.readiness'))
  const reportSummary = `reports/${id}.json`
  const reportPath = path.join(evidenceRoot, reportSummary)
  const artifacts = options('artifact').flatMap((value) => {
    const [name, ...pathParts] = value.split('=')
    const artifactPath = pathParts.join('=')
    const absolute = path.resolve(root, artifactPath)
    if (!existsSync(absolute)) {
      if (status !== 'success') return []
      throw new Error(`Artifact is missing: ${artifactPath}`)
    }
    return [{ name, path: artifactPath, sha256: sha256Path(absolute) }]
  })
  const manifest = {
    ...baseManifest(root, gate, group, status),
    artifacts,
    dimensions,
    reportSummary,
  }
  mkdirSync(path.dirname(reportPath), { recursive: true })
  writeFileSync(
    reportPath,
    `${JSON.stringify({ gate, status, artifacts }, null, 2)}\n`,
  )
  const output = path.resolve(
    root,
    option('output', path.join(evidenceRoot, 'manifests', `${id}.json`)),
  )
  mkdirSync(path.dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(
    `[ci-readiness] emitted=${path.relative(root, output)} status=${status}`,
  )
} else if (command === 'check') {
  const root = path.resolve(option('fixtures', option('root', '.readiness')))
  const files = jsonFiles(root)
  if (files.length === 0)
    throw new Error(`No readiness manifests found under ${root}.`)
  const manifests = files.map((file) => ({
    file: path.relative(root, file),
    manifest: JSON.parse(readFileSync(file, 'utf8')),
  }))
  const first = manifests[0].manifest
  const profile = option('profile', option('group', first.workflowGroup))
  const group = option('workflow-group', first.workflowGroup)
  const commitSha = option('commit', first.commitSha)
  const runId = option('run-id', first.run?.id)
  const runAttempt = option('run-attempt', first.run?.attempt)
  let evidence
  if (profile === 'pr-playwright') {
    const planPath = option('plan-receipt')
    if (!planPath)
      throw new Error('profile pr-playwright requires --plan-receipt.')
    const plan = JSON.parse(
      readFileSync(path.resolve(process.cwd(), planPath), 'utf8'),
    )
    evidence = validatePlaywrightPrReadiness({
      manifests,
      plan,
      group: group === 'pr' ? group : 'pr',
      commitSha,
      runId,
      runAttempt,
      root,
    })
  } else {
    evidence = validateReadiness({
      manifests,
      profile,
      group,
      commitSha,
      runId,
      runAttempt,
      root,
      playwrightGroup: option('playwright-group', profile),
    })
  }
  if (evidence.profile === 'release') {
    evidence.releaseIdentity = verifyReleaseIdentity({
      repoRoot: process.cwd(),
      candidateManifestPath: option('candidate-manifest'),
      releaseTag: option('release-tag'),
      commitSha: evidence.commitSha,
    })
  }
  const output = option('evidence')
  if (output) {
    const absolute = path.resolve(output)
    mkdirSync(path.dirname(absolute), { recursive: true })
    writeFileSync(absolute, `${JSON.stringify(evidence, null, 2)}\n`)
  }
  console.log(
    `[ci-readiness] profile=${evidence.profile} manifests=${evidence.manifests.length} status=ready`,
  )
} else {
  throw new Error('Usage: ci-readiness.mjs <plan|emit|check> [options]')
}
