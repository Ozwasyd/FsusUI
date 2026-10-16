#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadConformanceOwnerPlan } from './conformance-playwright-plan.mjs'
import { loadPlaywrightImpactPlan } from './playwright-impact-filter.mjs'
import {
  readBrowserToolchain,
  runMarkdownCell,
  sha256File,
} from './markdown-playwright-runner.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function resolveConformanceInteractionIdentity({
  repositoryRoot = root,
  group,
  impactPlan,
  env = process.env,
}) {
  const git = (args) =>
    spawnSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' })
  const requireSha = (value, label) => {
    if (typeof value !== 'string' || !/^[a-f0-9]{40}$/u.test(value)) {
      throw new Error(`conformance ${label} must be an exact commit SHA`)
    }
    return value
  }
  const head = git(['rev-parse', '--verify', 'HEAD^{commit}'])
  if (head.status !== 0)
    throw new Error('conformance checkout commit unavailable')
  const candidate = requireSha(head.stdout.trim(), 'candidate')
  for (const key of ['GITHUB_SHA', 'FSUS_INTERACTION_CANDIDATE']) {
    if (env[key] !== undefined && env[key] !== candidate) {
      throw new Error(`conformance ${key} does not match checkout ${candidate}`)
    }
  }
  let baseline
  if (group === 'pr') {
    baseline = requireSha(impactPlan?.baseRef, 'impact-plan baseRef')
  } else if (env.FSUS_INTERACTION_BASELINE !== undefined) {
    baseline = requireSha(env.FSUS_INTERACTION_BASELINE, 'baseline')
  } else {
    const mergeBase = git(['merge-base', candidate, 'origin/main'])
    if (mergeBase.status !== 0) {
      throw new Error(
        `conformance baseline unavailable: ${mergeBase.stderr.trim()}`,
      )
    }
    baseline = requireSha(mergeBase.stdout.trim(), 'baseline')
  }
  if (
    env.FSUS_INTERACTION_BASELINE !== undefined &&
    env.FSUS_INTERACTION_BASELINE !== baseline
  ) {
    throw new Error(
      'conformance FSUS_INTERACTION_BASELINE does not match baseline',
    )
  }
  const commit = git(['cat-file', 'commit', candidate])
  if (commit.status !== 0)
    throw new Error('conformance checkout object unavailable')
  const parents =
    commit.stdout.split('\n\n', 1)[0].match(/^parent ([a-f0-9]{40})$/gmu) ?? []
  const directParent = parents.includes(`parent ${baseline}`)
  if (
    group === 'pr' &&
    (/^refs\/pull\/\d+\/merge$/u.test(env.GITHUB_REF ?? '') ||
      env.GITHUB_EVENT_NAME === 'merge_group') &&
    parents[0] !== `parent ${baseline}`
  ) {
    throw new Error(
      'conformance impact-plan baseRef does not match merge checkout base',
    )
  }
  const hasBaseline = () => {
    const object = git(['cat-file', '-t', baseline])
    return object.status === 0 && object.stdout.trim() === 'commit'
  }
  if (!hasBaseline()) {
    // A shallow merge retains parent identities, but not necessarily their objects.
    if (group !== 'pr' || !directParent) {
      throw new Error(
        `conformance baseline ${baseline} is unavailable or unrelated`,
      )
    }
    const fetched = git(['fetch', '--no-tags', '--depth=1', 'origin', baseline])
    if (fetched.status !== 0 || !hasBaseline()) {
      throw new Error(
        `conformance baseline object acquisition failed: ${fetched.stderr.trim()}`,
      )
    }
  }
  if (
    !directParent &&
    git(['merge-base', '--is-ancestor', baseline, candidate]).status !== 0
  ) {
    throw new Error(
      `conformance baseline ${baseline} is unrelated to ${candidate}`,
    )
  }
  return { baseline, candidate }
}

export const CONFORMANCE_IDENTITY_SOURCES = Object.freeze({
  contract: 'spec/components/contracts/v2/contract-v2.json',
  vueBaseline: 'spec/baselines/vue-current.json',
  scenarioRegistry:
    'tests/conformance/interactions/generated/normalized-traces.json',
  runner: 'vue/tests/markdown-editor/markdown-interaction-trace.spec.ts',
})

export const CONFORMANCE_FINGERPRINT_INPUTS = Object.freeze({
  'web-interaction-conformance': [
    'vue/playwright.conformance-interaction.config.ts',
    ...Object.values(CONFORMANCE_IDENTITY_SOURCES),
    'vue/packages/wasm/markdown-interaction-trace.ts',
    'vue/packages/components/**',
    'vue/packages/demo-app/package.json',
    'vue/packages/demo-app/index.html',
    'vue/packages/demo-app/vite.config.ts',
    'vue/packages/demo-app/tsconfig.json',
    'vue/packages/demo-app/src/**',
  ],
})

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const collectAttachments = (value, output = []) => {
  if (Array.isArray(value)) {
    for (const item of value) collectAttachments(item, output)
    return output
  }
  if (!value || typeof value !== 'object') return output
  if (Array.isArray(value.attachments)) output.push(...value.attachments)
  for (const nested of Object.values(value)) collectAttachments(nested, output)
  return output
}

const attachmentBody = (attachment) => {
  if (typeof attachment.body === 'string') {
    return Buffer.from(attachment.body, 'base64')
  }
  if (typeof attachment.path === 'string' && existsSync(attachment.path)) {
    return readFileSync(attachment.path)
  }
  return null
}

const readInteractionTraces = (parsedReport) => {
  const traces = []
  for (const attachment of collectAttachments(parsedReport)) {
    if (
      attachment.contentType !== 'application/json' ||
      !String(attachment.name ?? '').endsWith('.interaction-trace.json')
    ) {
      continue
    }
    const body = attachmentBody(attachment)
    if (!body) continue
    const trace = JSON.parse(body.toString('utf8'))
    if (String(trace.scenario ?? '').includes('.mutation.')) continue
    traces.push({ name: attachment.name, body, trace })
  }
  return traces.sort((left, right) => left.name.localeCompare(right.name))
}

const sourceIdentity = () => ({
  contractHash: sha256File(
    resolve(root, CONFORMANCE_IDENTITY_SOURCES.contract),
  ),
  vueBaselineHash: sha256File(
    resolve(root, CONFORMANCE_IDENTITY_SOURCES.vueBaseline),
  ),
  scenarioRegistryHash: sha256File(
    resolve(root, CONFORMANCE_IDENTITY_SOURCES.scenarioRegistry),
  ),
  runnerHash: sha256File(resolve(root, CONFORMANCE_IDENTITY_SOURCES.runner)),
})

const selectedBrowserRevision = (receipt, browser) => {
  const key = `${browser}Revision`
  return receipt.toolchain?.[key]
}

export function validateConformanceReceipt(receipt, cell) {
  const evidence = receipt.conformance
  if (!evidence || typeof evidence !== 'object') {
    throw new Error(`receipt ${cell.id} missing conformance evidence`)
  }
  const current = sourceIdentity()
  for (const [key, expected] of Object.entries(current)) {
    if (evidence[key] !== expected) {
      throw new Error(`receipt ${cell.id} ${key} does not match current source`)
    }
  }
  if (evidence.scenarioCount <= 0) {
    throw new Error(`receipt ${cell.id} reports zero scenarios`)
  }
  if (evidence.actionStepCount <= 0) {
    throw new Error(`receipt ${cell.id} reports zero action steps`)
  }
  if (receipt.tests.skipped > 0) {
    throw new Error(`receipt ${cell.id} contains skipped required scenarios`)
  }
  if (!Array.isArray(evidence.traces) || evidence.traces.length === 0) {
    throw new Error(`receipt ${cell.id} missing interaction trace artifacts`)
  }
  if (
    !evidence.browserRevision ||
    evidence.browserRevision !==
      selectedBrowserRevision(receipt, cell.dimensions.browser)
  ) {
    throw new Error(`receipt ${cell.id} browser revision identity mismatch`)
  }
  if (
    JSON.stringify(evidence.traceBrowsers) !==
      JSON.stringify([cell.dimensions.browser]) ||
    JSON.stringify(evidence.traceCandidates) !==
      JSON.stringify([receipt.commitSha])
  ) {
    throw new Error(
      `receipt ${cell.id} trace candidate/browser identity mismatch`,
    )
  }
  if (evidence.nativeImeAutomated !== false) {
    throw new Error(
      `receipt ${cell.id} synthetic IME cannot claim native evidence`,
    )
  }
  if (
    !Array.isArray(evidence.representativeComponents) ||
    evidence.representativeComponents.length === 0
  ) {
    throw new Error(`receipt ${cell.id} missing representative component set`)
  }
  if (
    JSON.stringify(evidence.nativeImeEvidenceReferences) !==
    JSON.stringify(['#319', '#320'])
  ) {
    throw new Error(
      `receipt ${cell.id} must reference #319/#320 native IME evidence`,
    )
  }

  const traceDigests = []
  let actions = 0
  for (const entry of evidence.traces) {
    const absolute = resolve(root, entry.path)
    if (!existsSync(absolute) || sha256File(absolute) !== entry.sha256) {
      throw new Error(`receipt ${cell.id} trace digest mismatch: ${entry.path}`)
    }
    const trace = JSON.parse(readFileSync(absolute, 'utf8'))
    traceDigests.push(entry.sha256)
    if (
      trace.schema !== 'fsusui.interaction.v2' ||
      trace.contractRegistry?.schemaVersion !== 2 ||
      trace.contractRegistry?.source !== CONFORMANCE_IDENTITY_SOURCES.contract
    ) {
      throw new Error(
        `receipt ${cell.id} trace schema/contract identity invalid`,
      )
    }
    if (
      trace.browser !== cell.dimensions.browser ||
      trace.browserIdentity?.name !== cell.dimensions.browser ||
      trace.browserIdentity?.project !== cell.project ||
      !trace.browserIdentity?.version
    ) {
      throw new Error(`receipt ${cell.id} trace browser identity invalid`)
    }
    if (
      trace.candidate !== receipt.commitSha ||
      trace.runtime?.mount !== 'vue' ||
      trace.runtime?.realBrowser !== true
    ) {
      throw new Error(
        `receipt ${cell.id} trace is stale, mock, or metadata-only`,
      )
    }
    const executed =
      trace.steps?.filter((step) => step.action !== 'assert') ?? []
    if (
      executed.length === 0 ||
      executed.some((step) => step.actual === undefined || step.passed !== true)
    ) {
      throw new Error(
        `receipt ${cell.id} trace has no-op or failed action evidence`,
      )
    }
    actions += executed.length
  }
  if (actions !== evidence.actionStepCount) {
    throw new Error(`receipt ${cell.id} action step cardinality mismatch`)
  }
  if (evidence.traceDigest !== sha256(traceDigests.sort().join('\n'))) {
    throw new Error(`receipt ${cell.id} aggregate trace digest mismatch`)
  }
  return true
}

const receiptExtension = async ({ cell, parsedReport, evidenceDir }) => {
  const traces = readInteractionTraces(parsedReport)
  if (traces.length === 0) {
    throw new Error(
      `cell ${cell.id} produced no real interaction trace attachments`,
    )
  }
  const traceDirectory = `${evidenceDir}/traces/${cell.project}`
  const traceRecords = traces.map(({ name, body, trace }) => {
    const relative = `${traceDirectory}/${name}`
    const absolute = resolve(root, relative)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, body)
    return { relative, trace }
  })
  const records = traceRecords.map(({ relative }) => ({
    path: relative,
    sha256: sha256File(resolve(root, relative)),
  }))
  const representativeComponents = [
    ...new Set(
      traceRecords.map(({ trace }) => trace.runtime?.component).filter(Boolean),
    ),
  ].sort()
  const nativeImeEvidenceReferences = [
    ...new Set(
      traceRecords.flatMap(
        ({ trace }) => trace.nativeImeEvidence?.issueRefs ?? [],
      ),
    ),
  ].sort()
  const actionStepCount = traceRecords.reduce(
    (total, { trace }) =>
      total + trace.steps.filter((step) => step.action !== 'assert').length,
    0,
  )
  return {
    conformance: {
      ...sourceIdentity(),
      browserRevision: null,
      representativeComponents,
      scenarioCount: traceRecords.length,
      actionStepCount,
      traceSchema: 'fsusui.interaction.v2',
      traceVersion: 2,
      traceBrowsers: [
        ...new Set(traceRecords.map(({ trace }) => trace.browser)),
      ].sort(),
      traceCandidates: [
        ...new Set(traceRecords.map(({ trace }) => trace.candidate)),
      ].sort(),
      traceDigest: sha256(
        records
          .map((record) => record.sha256)
          .sort()
          .join('\n'),
      ),
      traces: records,
      nativeImeAutomated: false,
      nativeImeEvidenceReferences,
    },
  }
}

export async function runConformanceCell(ownerId, cellId, group, options = {}) {
  const interactionIdentity = resolveConformanceInteractionIdentity({
    group,
    impactPlan: options.impactPlan,
  })
  return runMarkdownCell(ownerId, cellId, group, {
    ...options,
    interactionIdentity,
    planLoader: loadConformanceOwnerPlan,
    fingerprintInputsBySuite: CONFORMANCE_FINGERPRINT_INPUTS,
    logPrefix: 'playwright-conformance',
    receiptExtension: async (context) => {
      const extension = await receiptExtension(context)
      const browser = context.cell.dimensions.browser
      extension.conformance.browserRevision =
        readBrowserToolchain()[`${browser}Revision`] ?? null
      return extension
    },
    validateReceipt: validateConformanceReceipt,
    runtimeManifestId: (cell) => `${cell.suiteId}-${cell.project}`,
    evidenceDir: options.evidenceDir ?? '.tmp/playwright-conformance',
  })
}

const option = (args, name, fallback) => {
  const index = args.indexOf(`--${name}`)
  if (index >= 0) return args[index + 1]
  const prefix = `--${name}=`
  return (
    args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const cellId = option(process.argv.slice(2), 'cell')
  if (!cellId) throw new Error('cell-run requires --cell')
  const result = await runConformanceCell(
    option(process.argv.slice(2), 'owner', 'playwright-conformance'),
    cellId,
    option(process.argv.slice(2), 'group', 'main'),
    {
      evidenceDir: option(process.argv.slice(2), 'evidence-dir'),
      impactPlan: loadPlaywrightImpactPlan(
        root,
        option(process.argv.slice(2), 'impact-plan'),
      ),
    },
  )
  if (!result.ok) process.exitCode = 1
}
