import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  computePlaywrightRegistryHash,
  expectedPlaywrightCells,
  loadPlaywrightRegistry,
  stableStringify,
  suiteOwnerGate,
} from './playwright-registry.mjs'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
export const readinessSpec = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'spec/ci/readiness-gates.json'), 'utf8'),
)

export function sha256Path(target) {
  const absolute = path.resolve(target)
  if (!fs.existsSync(absolute))
    throw new Error(`Artifact is missing: ${target}`)
  const hash = createHash('sha256')
  const visit = (current, relative = '') => {
    const stat = fs.statSync(current)
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current).sort())
        visit(path.join(current, entry), path.join(relative, entry))
      return
    }
    hash.update(relative.split(path.sep).join('/'))
    hash.update('\0')
    hash.update(fs.readFileSync(current))
    hash.update('\0')
  }
  visit(
    absolute,
    fs.statSync(absolute).isDirectory() ? '' : path.basename(absolute),
  )
  return hash.digest('hex')
}

export function repositoryCommit(cwd = repoRoot) {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf8',
  }).trim()
}

export const playwrightRegistry = loadPlaywrightRegistry(repoRoot)
export const playwrightRegistryHash =
  computePlaywrightRegistryHash(playwrightRegistry)

const CONFORMANCE_IDENTITY_SOURCES = Object.freeze({
  contractHash: 'spec/components/contracts/v2/contract-v2.json',
  vueBaselineHash: 'spec/baselines/vue-current.json',
  scenarioRegistryHash:
    'tests/conformance/interactions/generated/normalized-traces.json',
  runnerHash: 'vue/tests/markdown-editor/markdown-interaction-trace.spec.ts',
})

const sha256FileContent = (target) =>
  createHash('sha256').update(fs.readFileSync(target)).digest('hex')

export function manifestIdentity(manifest) {
  if (manifest.playwright?.cellId) {
    return `${manifest.gate}[${manifest.playwright.cellId}]`
  }
  if (
    manifest.playwright?.suiteId &&
    manifest.playwright?.decision === 'skip'
  ) {
    return `${manifest.gate}[${manifest.playwright.suiteId}:skip]`
  }
  const dimensions = Object.entries(manifest.dimensions ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(',')
  return dimensions ? `${manifest.gate}[${dimensions}]` : manifest.gate
}

function assertHex(value, label) {
  if (!/^[a-f0-9]{64}$/u.test(value ?? ''))
    throw new Error(`${label} must be a lowercase SHA-256 digest.`)
}

function validateManifestShape(manifest, file) {
  if (manifest.schemaVersion !== 1)
    throw new Error(`${file}: unsupported readiness manifest schema.`)
  for (const field of [
    'workflowGroup',
    'commitSha',
    'gate',
    'status',
    'createdAt',
    'inputFingerprint',
    'reportSummary',
  ]) {
    if (typeof manifest[field] !== 'string' || manifest[field].length === 0)
      throw new Error(`${file}: missing ${field}.`)
  }
  if (!/^[a-f0-9]{40}$/u.test(manifest.commitSha))
    throw new Error(`${file}: commitSha must be a full Git SHA.`)
  assertHex(manifest.inputFingerprint, `${file}: inputFingerprint`)
  if (!manifest.toolchain || typeof manifest.toolchain.node !== 'string')
    throw new Error(`${file}: missing toolchain/runtime identity.`)
  if (
    !manifest.run ||
    !String(manifest.run.id) ||
    !String(manifest.run.attempt)
  )
    throw new Error(`${file}: missing workflow run identity.`)
  if (!Array.isArray(manifest.artifacts))
    throw new Error(`${file}: artifacts must be an array.`)
  for (const artifact of manifest.artifacts) {
    if (!artifact.name || !artifact.path)
      throw new Error(`${file}: artifact name/path is required.`)
    assertHex(artifact.sha256, `${file}: ${artifact.name}`)
  }
}

const PLAYWRIGHT_DIMENSION_KEYS = Object.freeze([
  'browser',
  'viewport',
  'theme',
  'safeArea',
  'runtimeMode',
])

const isPlaywrightGate = (gate) =>
  readinessSpec.playwright?.ownerIds?.includes(gate) ?? false

function validatePlaywrightShape(manifest, file) {
  const block = manifest.playwright
  if (!block || typeof block !== 'object')
    throw new Error(`${file}: playwright gate missing playwright block.`)
  if (block.decision !== 'run' && block.decision !== 'skip')
    throw new Error(`${file}: playwright.decision must be run|skip.`)
  if (!block.suiteId || typeof block.suiteId !== 'string')
    throw new Error(`${file}: playwright.suiteId is required.`)
  if (block.decision === 'run') {
    if (!block.cellId || typeof block.cellId !== 'string')
      throw new Error(`${file}: playwright.cellId is required for run.`)
    if (!block.dimensions || typeof block.dimensions !== 'object')
      throw new Error(`${file}: playwright.dimensions object is required.`)
    for (const key of Object.keys(block.dimensions)) {
      if (!PLAYWRIGHT_DIMENSION_KEYS.includes(key))
        throw new Error(`${file}: unknown playwright dimension ${key}.`)
    }
    if (!block.dimensions.browser)
      throw new Error(`${file}: playwright dimensions must include browser.`)
    if (!block.tests || typeof block.tests !== 'object')
      throw new Error(`${file}: playwright.tests is required for run.`)
    for (const key of ['total', 'passed', 'failed', 'skipped']) {
      if (typeof block.tests[key] !== 'number')
        throw new Error(`${file}: playwright.tests.${key} must be a number.`)
    }
    if (!block.config || typeof block.config.path !== 'string')
      throw new Error(`${file}: playwright.config.path is required.`)
    assertHex(block.config.sha256, `${file}: playwright.config.sha256`)
    if (!block.runtime || typeof block.runtime !== 'object')
      throw new Error(`${file}: playwright.runtime is required.`)
    if (!block.runtime.browser)
      throw new Error(`${file}: playwright.runtime.browser is required.`)
    if (
      typeof block.runtime.browserRevision !== 'string' ||
      block.runtime.browserRevision.length === 0
    )
      throw new Error(
        `${file}: playwright.runtime.browserRevision is required.`,
      )
    if (!block.report || typeof block.report.path !== 'string')
      throw new Error(`${file}: playwright.report.path is required.`)
    assertHex(block.report.sha256, `${file}: playwright.report.sha256`)
    if (!block.receiptPath || typeof block.receiptPath !== 'string')
      throw new Error(`${file}: playwright.receiptPath is required.`)
    assertHex(block.receiptDigest, `${file}: playwright.receiptDigest`)
    if (block.suiteId === 'web-interaction-conformance') {
      const evidence = block.conformance
      if (!evidence || typeof evidence !== 'object')
        throw new Error(`${file}: conformance evidence is required.`)
      for (const key of Object.keys(CONFORMANCE_IDENTITY_SOURCES))
        assertHex(evidence[key], `${file}: conformance.${key}`)
      for (const key of ['scenarioCount', 'actionStepCount']) {
        if (!Number.isInteger(evidence[key]) || evidence[key] <= 0)
          throw new Error(`${file}: conformance.${key} must be positive.`)
      }
      if (
        evidence.traceSchema !== 'fsusui.interaction.v2' ||
        evidence.traceVersion !== 2
      )
        throw new Error(`${file}: conformance trace schema/version mismatch.`)
      assertHex(evidence.traceDigest, `${file}: conformance.traceDigest`)
      if (!Array.isArray(evidence.traces) || evidence.traces.length === 0)
        throw new Error(`${file}: conformance traces are required.`)
      for (const trace of evidence.traces) {
        if (!trace.path)
          throw new Error(`${file}: conformance trace path required.`)
        assertHex(trace.sha256, `${file}: conformance trace digest`)
      }
      if (evidence.nativeImeAutomated !== false)
        throw new Error(`${file}: synthetic IME cannot claim native evidence.`)
      if (
        stableStringify(evidence.nativeImeEvidenceReferences) !==
        stableStringify(['#319', '#320'])
      )
        throw new Error(
          `${file}: native IME evidence must reference #319/#320.`,
        )
    }
  } else {
    if (block.tests && block.tests.total !== 0)
      throw new Error(`${file}: skip manifest must declare zero tests.`)
  }
  assertHex(block.registryHash, `${file}: playwright.registryHash`)
  if (block.impactPlanDigest !== undefined)
    assertHex(block.impactPlanDigest, `${file}: playwright.impactPlanDigest`)
}

function validateOwner(gate, manifests, owner) {
  if (owner.cardinality === 'playwright') return
  if (owner.cardinality === 'single') {
    if (manifests.length !== 1)
      throw new Error(
        `${gate}: expected exactly one execution owner, found ${manifests.length}.`,
      )
    return
  }
  const dimension = owner.dimension
  const values = manifests.map((manifest) => manifest.dimensions?.[dimension])
  if (values.some((value) => !value))
    throw new Error(`${gate}: every manifest must declare ${dimension}.`)
  if (new Set(values).size !== values.length)
    throw new Error(`${gate}: duplicate ${dimension} manifest.`)
  if (owner.cardinality === 'matrix') {
    const missing = owner.values.filter((value) => !values.includes(value))
    const unexpected = values.filter((value) => !owner.values.includes(value))
    if (missing.length || unexpected.length)
      throw new Error(
        `${gate}: matrix mismatch (missing=${missing.join(',') || 'none'}; unexpected=${unexpected.join(',') || 'none'}).`,
      )
    return
  }
  const shards = values.map((value) => {
    const match = /^(\d+)\/(\d+)$/u.exec(value)
    if (!match) throw new Error(`${gate}: invalid shard dimension ${value}.`)
    return { index: Number(match[1]), total: Number(match[2]) }
  })
  const totals = new Set(shards.map(({ total }) => total))
  if (totals.size !== 1)
    throw new Error(`${gate}: shard manifests disagree on total.`)
  const total = shards[0].total
  const indexes = new Set(shards.map(({ index }) => index))
  const missing = Array.from({ length: total }, (_, index) => index + 1).filter(
    (index) => !indexes.has(index),
  )
  if (manifests.length !== total || missing.length)
    throw new Error(
      `${gate}: missing shard(s) ${missing.join(',') || 'unknown'}.`,
    )
}

function verifyManifestIdentity(
  manifest,
  file,
  { group, commitSha, runId, runAttempt },
) {
  const identity = manifestIdentity(manifest)
  if (manifest.workflowGroup !== group)
    throw new Error(`${identity}: workflow group mismatch.`)
  if (manifest.commitSha !== commitSha)
    throw new Error(`${identity}: commit SHA mismatch.`)
  if (String(manifest.run.id) !== String(runId))
    throw new Error(
      `${identity}: stale artifact from workflow run ${manifest.run.id}.`,
    )
  if (String(manifest.run.attempt) !== String(runAttempt))
    throw new Error(
      `${identity}: stale artifact from workflow attempt ${manifest.run.attempt}.`,
    )
  if (manifest.status !== 'success')
    throw new Error(`${identity}: leaf status is ${manifest.status}.`)
  return identity
}

function verifyManifestFiles(manifest, file, identity, root, strict = false) {
  const summary = path.resolve(root, manifest.reportSummary)
  if (!fs.existsSync(summary))
    throw new Error(`${identity}: report summary is missing.`)
  for (const artifact of manifest.artifacts) {
    const artifactPath = path.resolve(root, artifact.path)
    if (strict && !fs.existsSync(artifactPath))
      throw new Error(`${identity}: artifact is missing for ${artifact.name}.`)
    if (
      fs.existsSync(artifactPath) &&
      sha256Path(artifactPath) !== artifact.sha256
    )
      throw new Error(
        `${identity}: artifact digest mismatch for ${artifact.name}.`,
      )
  }
}

function validatePlaywrightRunCell(manifest, file, identity, cell, options) {
  const block = manifest.playwright
  if (block.decision !== 'run')
    throw new Error(`${identity}: expected run decision for ${cell.cellId}.`)
  if (block.suiteId !== cell.suiteId)
    throw new Error(`${identity}: suiteId mismatch (${block.suiteId}).`)
  if (block.cellId !== cell.cellId)
    throw new Error(`${identity}: cellId mismatch (${block.cellId}).`)
  if (stableStringify(block.dimensions) !== stableStringify(cell.dimensions))
    throw new Error(
      `${identity}: dimensions mismatch (${stableStringify(
        block.dimensions,
      )}).`,
    )
  if (block.registryHash !== options.registryHash)
    throw new Error(`${identity}: registry hash mismatch.`)
  if (options.planDigest && block.impactPlanDigest !== options.planDigest)
    throw new Error(`${identity}: impact plan digest mismatch.`)
  if (block.tests.total === 0)
    throw new Error(`${identity}: success with zero tests is fail-closed.`)
  if (block.tests.passed === 0)
    throw new Error(
      `${identity}: success with zero passed tests is fail-closed.`,
    )
  if (block.tests.failed !== 0)
    throw new Error(
      `${identity}: success manifest reports failed=${block.tests.failed}.`,
    )
  if (block.tests.skipped !== 0)
    throw new Error(
      `${identity}: required cell reports skipped=${block.tests.skipped} without platform exemption.`,
    )
  if (
    block.tests.total !==
    block.tests.passed + block.tests.failed + block.tests.skipped
  )
    throw new Error(`${identity}: test counts are inconsistent.`)
  if (!['chromium', 'firefox', 'webkit'].includes(block.runtime.browser))
    throw new Error(`${identity}: unknown browser ${block.runtime.browser}.`)
  const reportPath = path.resolve(options.root, block.report.path)
  if (!fs.existsSync(reportPath))
    throw new Error(`${identity}: report is missing.`)
  if (sha256Path(reportPath) !== block.report.sha256)
    throw new Error(`${identity}: report digest mismatch.`)
  const receiptPath = path.resolve(options.root, block.receiptPath)
  if (!fs.existsSync(receiptPath))
    throw new Error(`${identity}: cell receipt is missing.`)
  if (sha256Path(receiptPath) !== block.receiptDigest)
    throw new Error(`${identity}: cell receipt digest mismatch.`)
  if (cell.suiteId === 'web-interaction-conformance') {
    const evidence = block.conformance
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
    if (
      receipt.owner !== 'playwright-conformance' ||
      receipt.gate !== 'playwright-conformance' ||
      receipt.suiteId !== cell.suiteId ||
      receipt.cellId !== cell.cellId ||
      receipt.project !== cell.project ||
      receipt.dimensions?.browser !== cell.dimensions.browser ||
      receipt.commitSha !== manifest.commitSha ||
      String(receipt.run?.id) !== String(manifest.run.id) ||
      String(receipt.run?.attempt) !== String(manifest.run.attempt)
    )
      throw new Error(
        `${identity}: copied or stale conformance receipt identity.`,
      )
    if (stableStringify(receipt.conformance) !== stableStringify(evidence))
      throw new Error(`${identity}: conformance receipt evidence mismatch.`)
    for (const [key, relative] of Object.entries(
      CONFORMANCE_IDENTITY_SOURCES,
    )) {
      const current = sha256FileContent(
        path.resolve(options.repoRoot, relative),
      )
      if (evidence[key] !== current)
        throw new Error(`${identity}: stale conformance ${key}.`)
    }
    if (evidence.browserRevision !== block.runtime.browserRevision)
      throw new Error(`${identity}: conformance browser revision mismatch.`)
    if (
      stableStringify(evidence.traceBrowsers) !==
        stableStringify([cell.dimensions.browser]) ||
      stableStringify(evidence.traceCandidates) !==
        stableStringify([manifest.commitSha])
    )
      throw new Error(
        `${identity}: copied or stale conformance trace identity.`,
      )
    const traceDigests = []
    let actions = 0
    for (const traceEntry of evidence.traces) {
      const tracePath = path.resolve(options.root, traceEntry.path)
      if (!fs.existsSync(tracePath))
        throw new Error(`${identity}: conformance trace is missing.`)
      const digest = sha256FileContent(tracePath)
      if (digest !== traceEntry.sha256)
        throw new Error(`${identity}: conformance trace digest mismatch.`)
      traceDigests.push(digest)
      const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'))
      if (
        trace.schema !== 'fsusui.interaction.v2' ||
        trace.browser !== cell.dimensions.browser ||
        trace.browserIdentity?.project !== cell.project ||
        trace.candidate !== manifest.commitSha ||
        trace.runtime?.mount !== 'vue' ||
        trace.runtime?.realBrowser !== true
      )
        throw new Error(`${identity}: metadata-only, mock, or copied trace.`)
      const executed = (trace.steps ?? []).filter(
        (step) => step.action !== 'assert',
      )
      if (
        executed.length === 0 ||
        executed.some(
          (step) => step.actual === undefined || step.passed !== true,
        )
      )
        throw new Error(
          `${identity}: trace contains zero/no-op action evidence.`,
        )
      actions += executed.length
    }
    const aggregateTraceDigest = createHash('sha256')
      .update(traceDigests.sort().join('\n'))
      .digest('hex')
    if (aggregateTraceDigest !== evidence.traceDigest)
      throw new Error(`${identity}: aggregate trace digest mismatch.`)
    if (actions !== evidence.actionStepCount)
      throw new Error(`${identity}: action step cardinality mismatch.`)
  }
}

function validatePlaywrightOwnerCells(gate, manifests, options) {
  const expected = expectedPlaywrightCells(
    playwrightRegistry,
    [gate],
    options.profile,
  )
  const expectedByCell = new Map(expected.map((cell) => [cell.cellId, cell]))
  const observed = new Map()
  for (const { manifest, file } of manifests) {
    const identity = manifestIdentity(manifest)
    if (manifest.playwright?.decision === 'skip') {
      throw new Error(
        `${identity}: skip manifest is not allowed in ${options.profile} profile.`,
      )
    }
    const cell = expectedByCell.get(manifest.playwright?.cellId)
    if (!cell) {
      const ownerGate = suiteOwnerGate(playwrightRegistry).get(
        manifest.playwright?.suiteId,
      )
      if (ownerGate && ownerGate !== gate) {
        throw new Error(
          `${identity}: suite ${manifest.playwright.suiteId} is claimed by owner ${ownerGate}, not ${gate}.`,
        )
      }
      throw new Error(`${identity}: unknown playwright cell.`)
    }
    if (observed.has(cell.cellId))
      throw new Error(`${identity}: duplicate playwright cell.`)
    observed.set(cell.cellId, { manifest, file, cell })
    validatePlaywrightRunCell(manifest, file, identity, cell, options)
  }
  const missing = expected
    .map((cell) => cell.cellId)
    .filter((cellId) => !observed.has(cellId))
  if (missing.length)
    throw new Error(
      `${gate}: missing playwright cell(s) ${missing.join(', ')}.`,
    )
}

function aggregateDigest(evidence) {
  const contract = {}
  for (const key of Object.keys(evidence).sort()) {
    if (key === 'aggregateDigest' || key === 'generatedAt') continue
    contract[key] = evidence[key]
  }
  return createHash('sha256').update(stableStringify(contract)).digest('hex')
}

function playwrightEvidence({
  profile,
  planDigest,
  expectedCells,
  observedCells,
  manifestEntries,
}) {
  const cells = [...observedCells].sort((left, right) =>
    `${left.owner}\0${left.cellId}`.localeCompare(
      `${right.owner}\0${right.cellId}`,
    ),
  )
  const browserSummary = {}
  for (const cell of cells) {
    const browser = cell.dimensions?.browser ?? 'unknown'
    browserSummary[browser] = (browserSummary[browser] ?? 0) + 1
  }
  const projectSummary = {}
  for (const cell of cells) {
    const project = cell.project ?? 'unknown'
    projectSummary[project] = (projectSummary[project] ?? 0) + 1
  }
  return {
    registryHash: playwrightRegistryHash,
    profile,
    expectedCellCount: expectedCells.length,
    observedCellCount: observedCells.length,
    cells: cells.map((cell) => ({
      owner: cell.owner,
      gate: cell.gate,
      suiteId: cell.suiteId,
      cellId: cell.cellId,
      dimensions: cell.dimensions,
      decision: cell.decision,
      status: cell.status,
      tests: cell.tests,
      receiptDigest: cell.receiptDigest,
      reportDigest: cell.reportDigest,
      planDigest: cell.planDigest ?? null,
    })),
    runSuiteCount: cells.filter((cell) => cell.decision === 'run').length,
    skipSuiteCount: cells.filter((cell) => cell.decision === 'skip').length,
    browserSummary,
    projectSummary,
    planDigest: planDigest ?? null,
    manifestCount: manifestEntries.length,
  }
}

export function validateReadiness({
  manifests,
  profile,
  group,
  commitSha,
  runId,
  runAttempt,
  root,
  playwrightGroup = profile,
  repoRoot: repo = process.cwd(),
}) {
  const required = readinessSpec.profiles[profile]
  if (!required) throw new Error(`Unknown readiness profile: ${profile}.`)
  const prPlaywrightOnly = playwrightGroup === 'pr'
  const scoped = prPlaywrightOnly
    ? manifests.filter(({ manifest }) => !isPlaywrightGate(manifest.gate))
    : manifests
  if (prPlaywrightOnly) {
    const orphanPlaywright = manifests.filter(({ manifest }) =>
      isPlaywrightGate(manifest.gate),
    )
    if (
      orphanPlaywright.some(({ manifest }) => manifest.workflowGroup !== 'pr')
    )
      throw new Error(
        'playwright manifests in a pr playwright run must use workflowGroup=pr.',
      )
  }
  const requiredGates = prPlaywrightOnly
    ? required.filter((gate) => !isPlaywrightGate(gate))
    : required
  const identities = new Set()
  const manifestEntries = []
  for (const { manifest, file } of scoped) {
    validateManifestShape(manifest, file)
    if (isPlaywrightGate(manifest.gate)) validatePlaywrightShape(manifest, file)
    const identity = verifyManifestIdentity(manifest, file, {
      group,
      commitSha,
      runId,
      runAttempt,
    })
    if (identities.has(identity))
      throw new Error(`Duplicate readiness manifest: ${identity}.`)
    identities.add(identity)
    verifyManifestFiles(
      manifest,
      file,
      identity,
      root,
      isPlaywrightGate(manifest.gate) &&
        manifest.playwright?.decision === 'run',
    )
    manifestEntries.push({ manifest, file, identity })
  }
  const gateManifests = (gate) =>
    manifestEntries.filter(({ manifest }) => manifest.gate === gate)
  for (const gate of requiredGates) {
    const manifestsForGate = gateManifests(gate)
    if (manifestsForGate.length === 0)
      throw new Error(`Missing required leaf manifest: ${gate}.`)
    if (isPlaywrightGate(gate)) {
      validatePlaywrightOwnerCells(gate, manifestsForGate, {
        profile,
        root,
        repoRoot: repo,
        registryHash: playwrightRegistryHash,
        planDigest: undefined,
      })
    } else {
      validateOwner(
        gate,
        manifestsForGate.map(({ manifest }) => manifest),
        readinessSpec.owners[gate],
      )
    }
  }
  if (!prPlaywrightOnly) {
    const unexpected = manifestEntries
      .map(({ manifest }) => manifest.gate)
      .filter((gate) => !readinessSpec.owners[gate])
    if (unexpected.length)
      throw new Error(`Unknown leaf gate: ${unexpected[0]}.`)
  }
  for (const binding of readinessSpec.artifactBindings) {
    const find = (gate) =>
      manifestEntries
        .map(({ manifest }) => manifest)
        .find((manifest) => manifest.gate === gate)
        ?.artifacts.find((artifact) => artifact.name === binding.name)
    const producer = find(binding.producer)
    const consumer = find(binding.consumer)
    if (!producer || !consumer)
      throw new Error(
        `${binding.name}: producer/consumer artifact evidence missing.`,
      )
    if (producer.sha256 !== consumer.sha256)
      throw new Error(`${binding.name}: producer/consumer digest mismatch.`)
  }
  const expectedCells = prPlaywrightOnly
    ? []
    : requiredGates.flatMap((gate) =>
        isPlaywrightGate(gate)
          ? expectedPlaywrightCells(playwrightRegistry, [gate], profile)
          : [],
      )
  const observedCells = []
  for (const { manifest } of manifestEntries) {
    if (!isPlaywrightGate(manifest.gate)) continue
    const block = manifest.playwright
    observedCells.push({
      owner: manifest.gate,
      gate: manifest.gate,
      suiteId: block.suiteId,
      cellId: block.cellId,
      dimensions: block.dimensions ?? {},
      decision: block.decision,
      status: manifest.status,
      tests: block.tests,
      receiptDigest: block.receiptDigest ?? null,
      reportDigest: block.report?.sha256 ?? null,
      planDigest: block.impactPlanDigest ?? null,
      project: null,
    })
  }
  const evidence = {
    schemaVersion: 1,
    profile,
    workflowGroup: group,
    commitSha,
    run: { id: String(runId), attempt: String(runAttempt) },
    generatedAt: new Date().toISOString(),
    manifests: manifestEntries
      .map(({ manifest, identity }) => ({
        identity,
        inputFingerprint: manifest.inputFingerprint,
        artifacts: manifest.artifacts,
      }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
    playwright: playwrightEvidence({
      profile,
      expectedCells,
      observedCells,
      manifestEntries,
    }),
  }
  evidence.playwright.aggregateDigest = aggregateDigest(evidence)
  return evidence
}

export function validatePlaywrightPrReadiness({
  manifests,
  plan,
  group = 'pr',
  commitSha,
  runId,
  runAttempt,
  root,
  repoRoot: repo = process.cwd(),
}) {
  const registry = playwrightRegistry
  const registryHash = playwrightRegistryHash
  if (plan?.schemaVersion !== 1)
    throw new Error('playwright impact plan schemaVersion must be 1.')
  const contract = {}
  for (const key of Object.keys(plan).sort()) {
    if (key === 'planDigest' || key === 'generatedAt') continue
    contract[key] = plan[key]
  }
  const digest = createHash('sha256')
    .update(JSON.stringify(contract))
    .digest('hex')
  if (digest !== plan.planDigest)
    throw new Error('playwright impact plan digest is invalid.')
  if (plan.registryHash && plan.registryHash !== registryHash)
    throw new Error('playwright impact plan registry hash mismatch.')

  const profileSuites = registry.suites.profiles.pr.suiteIds
  const decisions = new Map(
    plan.decisions.map((decision) => [decision.suiteId, decision]),
  )
  for (const suiteId of profileSuites) {
    if (!decisions.has(suiteId))
      throw new Error(`playwright impact plan missing decision for ${suiteId}.`)
  }
  const expectedCells = []
  for (const suiteId of profileSuites) {
    const decision = decisions.get(suiteId)
    if (decision.decision === 'run') {
      const suite = registry.suites.suites.find((entry) => entry.id === suiteId)
      for (const cell of suite.cells) {
        expectedCells.push({
          owner: suiteOwnerGate(registry).get(suiteId),
          suiteId,
          cellId: cell.id,
          project: cell.project,
          dimensions: cell.dimensions,
          decision: 'run',
        })
      }
    }
  }
  const identities = new Set()
  const manifestEntries = []
  for (const { manifest, file } of manifests) {
    validateManifestShape(manifest, file)
    validatePlaywrightShape(manifest, file)
    const identity = verifyManifestIdentity(manifest, file, {
      group,
      commitSha,
      runId,
      runAttempt,
    })
    if (identities.has(identity))
      throw new Error(`Duplicate readiness manifest: ${identity}.`)
    identities.add(identity)
    verifyManifestFiles(
      manifest,
      file,
      identity,
      root,
      isPlaywrightGate(manifest.gate) &&
        manifest.playwright?.decision === 'run',
    )
    manifestEntries.push({ manifest, file, identity })
  }
  const observedCells = []
  const runCellIds = new Set()
  const skipSuiteIds = new Set()
  for (const { manifest, file, identity } of manifestEntries) {
    const block = manifest.playwright
    if (!profileSuites.includes(block.suiteId))
      throw new Error(
        `${identity}: suite ${block.suiteId} is not in the PR profile.`,
      )
    const decision = decisions.get(block.suiteId)
    if (!decision)
      throw new Error(`${identity}: suite not selected in PR impact plan.`)
    const ownerGate = suiteOwnerGate(registry).get(block.suiteId)
    if (ownerGate !== manifest.gate)
      throw new Error(
        `${identity}: suite ${block.suiteId} is claimed by owner ${ownerGate}, not ${manifest.gate}.`,
      )
    if (block.registryHash !== registryHash)
      throw new Error(`${identity}: registry hash mismatch.`)
    if (block.impactPlanDigest !== plan.planDigest)
      throw new Error(`${identity}: impact plan digest mismatch.`)
    if (decision.decision === 'run') {
      if (block.decision !== 'run')
        throw new Error(
          `${identity}: expected run receipt but found ${block.decision}.`,
        )
      const cell = expectedCells.find((entry) => entry.cellId === block.cellId)
      if (!cell)
        throw new Error(`${identity}: unexpected playwright cell in PR run.`)
      if (runCellIds.has(cell.cellId))
        throw new Error(`${identity}: duplicate playwright cell.`)
      runCellIds.add(cell.cellId)
      validatePlaywrightRunCell(manifest, file, identity, cell, {
        root,
        repoRoot: repo,
        registryHash,
        planDigest: plan.planDigest,
      })
      observedCells.push({
        owner: manifest.gate,
        gate: manifest.gate,
        suiteId: block.suiteId,
        cellId: block.cellId,
        dimensions: block.dimensions,
        decision: 'run',
        status: manifest.status,
        tests: block.tests,
        receiptDigest: block.receiptDigest,
        reportDigest: block.report?.sha256 ?? null,
        planDigest: plan.planDigest,
        project: cell.project,
      })
    } else {
      if (block.decision !== 'skip')
        throw new Error(
          `${identity}: expected skip manifest but found ${block.decision}.`,
        )
      if (block.cellId)
        throw new Error(`${identity}: skip manifest must not declare a cell.`)
      if (skipSuiteIds.has(block.suiteId))
        throw new Error(`${identity}: duplicate skip manifest for suite.`)
      skipSuiteIds.add(block.suiteId)
      observedCells.push({
        owner: manifest.gate,
        gate: manifest.gate,
        suiteId: block.suiteId,
        cellId: null,
        dimensions: {},
        decision: 'skip',
        status: manifest.status,
        tests: block.tests,
        receiptDigest: null,
        reportDigest: null,
        planDigest: plan.planDigest,
        project: null,
      })
    }
  }
  const missingCells = expectedCells.filter(
    (cell) => !runCellIds.has(cell.cellId),
  )
  if (missingCells.length)
    throw new Error(
      `PR playwright missing run cell(s): ${missingCells
        .map((cell) => cell.cellId)
        .join(', ')}.`,
    )
  for (const suiteId of profileSuites) {
    const decision = decisions.get(suiteId)
    if (decision.decision === 'skip' && !skipSuiteIds.has(suiteId))
      throw new Error(`PR playwright missing skip manifest for ${suiteId}.`)
    if (decision.decision === 'run' && skipSuiteIds.has(suiteId))
      throw new Error(`PR playwright run suite ${suiteId} has skip manifest.`)
  }
  const evidence = {
    schemaVersion: 1,
    profile: 'pr-playwright',
    workflowGroup: group,
    commitSha,
    run: { id: String(runId), attempt: String(runAttempt) },
    generatedAt: new Date().toISOString(),
    manifests: manifestEntries
      .map(({ manifest, identity }) => ({
        identity,
        inputFingerprint: manifest.inputFingerprint,
        artifacts: manifest.artifacts,
      }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
    playwright: playwrightEvidence({
      profile: 'pr',
      planDigest: plan.planDigest,
      expectedCells,
      observedCells,
      manifestEntries,
    }),
  }
  evidence.playwright.aggregateDigest = aggregateDigest(evidence)
  return evidence
}
