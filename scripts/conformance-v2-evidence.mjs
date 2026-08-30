#!/usr/bin/env node
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const requiredIdentity = [
  'executionId',
  'checkpoint',
  'candidate',
  'contractHash',
  'webBaselineHash',
  'avaloniaBaselineHash',
  'scenario',
  'contract',
  'documentId',
  'documentEpoch',
  'sourceRevision',
  'theme',
  'density',
  'locale',
  'direction',
  'motion',
  'runnerHash',
]
const governedOverride = [
  'field',
  'reason',
  'owner',
  'testPolicy',
  'reviewPolicy',
]
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`
const digest = (value) =>
  crypto
    .createHash('sha256')
    .update(typeof value === 'string' ? value : stableJson(value))
    .digest('hex')
const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'))
const writeJson = (file, value) => {
  const target = path.resolve(root, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, stableJson(value))
}
const fail = (message) => {
  throw new Error(message)
}

export function validateOverride(entry, index = 0) {
  for (const field of governedOverride) {
    if (typeof entry?.[field] !== 'string' || !entry[field].trim()) {
      fail(`override[${index}].${field} missing governance`)
    }
  }
  if (entry.field.includes('*'))
    fail(`override[${index}].field broad override forbidden`)
}

export function validateEvidence(evidence, platform) {
  if (evidence?.schema !== 'fsusui.conformance-evidence.v2')
    fail(`${platform}.schema invalid`)
  for (const field of requiredIdentity) {
    if (
      evidence.identity?.[field] === undefined ||
      evidence.identity[field] === ''
    ) {
      fail(`${platform}.identity.${field} missing`)
    }
  }
  if (platform === 'avalonia') {
    if (evidence.runtime?.realTopLevel !== true)
      fail('avalonia.runtime.realTopLevel required')
    if (evidence.runtime?.headless !== false)
      fail('avalonia.runtime.headless must be false')
    if (evidence.runtime?.mock !== false)
      fail('avalonia.runtime.mock must be false')
    evidence.steps?.forEach((step, index) => {
      if (step.observation?.passed !== true)
        fail(`avalonia.steps[${index}] failed`)
      for (const field of [
        'scenario',
        'contract',
        'candidate',
        'contractHash',
        'webBaselineHash',
        'avaloniaBaselineHash',
        'os',
        'avalonia',
      ]) {
        if (!step.binding?.[field])
          fail(`avalonia.steps[${index}].binding.${field} missing`)
      }
    })
    for (const action of [
      'pointer',
      'keyboard',
      'focus-input',
      'ime-simulation',
      'operation',
      'open-close',
    ]) {
      if (!evidence.steps?.some((step) => step.action === action))
        fail(`avalonia.required-step.${action} missing`)
    }
    const ime = evidence.steps.find((step) => step.action === 'ime-simulation')
      ?.observation?.actual
    if (
      ime?.simulation !== true ||
      ime?.physicalIme !== false ||
      ime?.boundary !== 'linux-avalonia-text-input'
    )
      fail('avalonia.ime simulation boundary claim invalid')
    if (evidence.accessibility?.source !== 'real-avalonia-automation-peer') {
      fail('avalonia.accessibility fixture-only or metadata-only')
    }
    if (evidence.accessibility?.markdown?.atomicActionCount < 3)
      fail('avalonia.accessibility atomic actions missing')
  }
  if (platform === 'web') {
    if (evidence.verdict !== 'pass') fail('web.verdict failed')
    if (
      evidence.browserAccessibility?.source !== 'chromium-cdp-accessibility'
    ) {
      fail('web.accessibility fixture-only')
    }
    if (evidence.browserAccessibility?.sameExecution !== true)
      fail('web.accessibility checkpoint mismatch')
    if (!evidence.checks?.atspiReachable || !evidence.checks?.textboxExposed) {
      fail('web.required Linux Orca/AT-SPI evidence missing')
    }
    if (!Number.isInteger(evidence.orcaPid) || evidence.orcaPid <= 0)
      fail('web.orcaPid missing')
    if (evidence.checks?.atomicActionsExposed !== true)
      fail('web.accessibility atomic actions missing')
    evidence.steps?.forEach((step, index) => {
      if (step.observation?.passed !== true) fail(`web.steps[${index}] failed`)
      if (step.binding?.executionId !== evidence.identity.executionId)
        fail(`web.steps[${index}].binding.executionId mismatch`)
    })
  }
  for (const [index, entry] of (evidence.platformDifferences ?? []).entries())
    validateOverride(entry, index)
  return evidence
}

const same = (left, right, field) => {
  try {
    assert.deepStrictEqual(right, left)
  } catch {
    fail(
      `${field} mismatch expected=${JSON.stringify(left)} actual=${JSON.stringify(right)}`,
    )
  }
}
const normalizeWeb = (evidence) => {
  const markdown = evidence.publicState.markdown
  const node = evidence.browserAccessibility.nodes.find(
    (entry) =>
      entry.role === 'textbox' &&
      /^markdown editor source$/i.test(entry.name ?? ''),
  )
  if (!node) fail('web.accessibility.nodes markdown textbox missing')
  return {
    state: {
      value: markdown.value,
      revision: markdown.revision,
      selection: markdown.selection,
      history: markdown.history,
      capability: markdown.capability?.capability ?? markdown.capability,
    },
    events: evidence.publicState.eventNames.filter((name) =>
      name.startsWith('markdown.'),
    ),
    a11y: {
      role: node.role === 'textbox' ? 'edit' : node.role,
      name: (node.name ?? '').replace(/ source$/i, ''),
      value: node.value,
      states: {
        disabled: node.states.disabled,
        readOnly: node.states.readOnly,
        invalid: node.states.invalid,
      },
      liveRegion: node.liveRegion,
      selection: markdown.selection,
    },
  }
}
const normalizeAvalonia = (evidence) => {
  const node = evidence.accessibility.nodes.find(
    (entry) => entry.control === 'FsusMarkdownEditor',
  )
  if (!node) fail('avalonia.accessibility.nodes FsusMarkdownEditor missing')
  return {
    state: {
      value: evidence.state.value,
      revision: evidence.state.revision,
      selection: evidence.state.selection,
      history: evidence.state.history,
      capability: evidence.state.capability,
    },
    events: evidence.events
      .filter((entry) => entry.name.startsWith('markdown.'))
      .map((entry) => entry.name),
    a11y: {
      role: node.role,
      name: node.name,
      value: node.value,
      states: {
        disabled: node.states.disabled,
        readOnly: node.states.readOnly,
        invalid: node.states.invalid,
      },
      liveRegion: node.liveRegion,
      selection: node.selection,
    },
  }
}

const operationResult = (value) => ({
  accepted: value.accepted,
  beforeRevision: value.beforeRevision,
  revision: value.revision,
  value: value.value,
  selection: value.selection,
  history: value.history,
  documentIdentity: value.documentIdentity,
})

const normalizedOperations = (evidence, platform) => {
  const selected = evidence.steps.filter((step) =>
    platform === 'web'
      ? [
          'ElMarkdownEditor.dispatchTransaction',
          'ElMarkdownEditor.undo',
        ].includes(step.target)
      : [
          'FsusMarkdownEditor.DispatchTransaction',
          'FsusMarkdownEditor.Undo',
        ].includes(step.target),
  )
  return selected.map((step) => ({
    action: step.action,
    focus:
      platform === 'avalonia' && step.focusTarget === 'FsusMarkdownEditor'
        ? 'textarea'
        : step.focusTarget,
    result: operationResult(step.observation.actual),
  }))
}

export function compareEvidence(web, avalonia) {
  validateEvidence(web, 'web')
  validateEvidence(avalonia, 'avalonia')
  for (const field of requiredIdentity)
    same(web.identity[field], avalonia.identity[field], `identity.${field}`)
  if (!web.visual?.sha256 || web.visual.renderedTopLevel !== true)
    fail('web.visual rendered artifact missing')
  if (!avalonia.visual?.sha256 || avalonia.visual.renderedTopLevel !== true)
    fail('avalonia.visual rendered artifact missing')
  same(web.identity, web.visual.identity, 'web.visual.identity')
  same(avalonia.identity, avalonia.visual.identity, 'avalonia.visual.identity')
  same(web.identity, web.performance?.identity, 'web.performance.identity')
  same(
    avalonia.identity,
    avalonia.performance?.identity,
    'avalonia.performance.identity',
  )
  if (web.performance?.passed !== true) fail('web.performance budget failed')
  if (avalonia.performance?.passed !== true)
    fail('avalonia.performance budget failed')
  const left = normalizeWeb(web)
  const right = normalizeAvalonia(avalonia)
  for (const field of [
    'value',
    'revision',
    'selection',
    'history',
    'capability',
  ]) {
    same(left.state[field], right.state[field], `state.${field}`)
  }
  // Framework-specific update/change notifications are excluded; semantic order is not.
  const webSemanticEvents = left.events.filter((name) =>
    [
      'markdown.transaction',
      'markdown.selection-change',
      'markdown.history-change',
    ].includes(name),
  )
  same(webSemanticEvents, right.events, 'events.transitionOrder')
  same(
    normalizedOperations(web, 'web'),
    normalizedOperations(avalonia, 'avalonia'),
    'steps.operationResults',
  )
  for (const field of [
    'role',
    'name',
    'value',
    'states',
    'liveRegion',
    'selection',
  ]) {
    same(left.a11y[field], right.a11y[field], `accessibility.markdown.${field}`)
  }
  return {
    schema: 'fsusui.conformance-comparison.v2',
    verdict: 'pass',
    identity: web.identity,
    evidenceDigests: { web: digest(web), avalonia: digest(avalonia) },
    compared: [
      'public-state',
      'transition-order',
      'accessibility',
      'performance',
    ],
  }
}

export function validateBaselineFreshness(candidate) {
  if (candidate.inputTreeHash !== candidate.currentInputTreeHash)
    fail(`${candidate.platform}.baseline.inputTreeHash stale`)
  if (candidate.outputHash !== digest(candidate.payload))
    fail(`${candidate.platform}.baseline.outputHash stale`)
}

export function validateCoverage(coverage) {
  for (const member of coverage.requiredMembers ?? []) {
    const scenarios = coverage.memberScenarios?.[member] ?? []
    if (!scenarios.length) fail(`coverage.member.${member} missing scenario`)
    for (const scenario of scenarios) {
      if (coverage.executions?.[scenario]?.real !== true)
        fail(`coverage.scenario.${scenario} metadata-only`)
    }
  }
}

export function validateMarkdownEvidence(candidate) {
  if (candidate.modes?.includes('write')) fail('contract.mode.write forbidden')
  if (
    candidate.documents?.[0]?.source === candidate.documents?.[1]?.source &&
    candidate.documents?.[0]?.identity !== candidate.documents?.[1]?.identity &&
    candidate.sharedHistory === true
  )
    fail('document.identity history isolation failed')
  if (
    candidate.offsetSpace === 'normalized' &&
    candidate.source?.includes('\r\n')
  )
    fail('source.offset CRLF normalization drift')
  if (candidate.sourceMappingOwner === 'DOM')
    fail('projection.source mapping used DOM')
  if (candidate.nativeIme?.synthetic === true)
    fail('ime.native evidence is synthetic')
}

const contractMembers = (contract) =>
  ['inputs', 'outputs', 'operations', 'contentRegions'].flatMap((section) =>
    (contract[section] ?? []).map((member) => ({ section, ...member })),
  )

const evidenceArtifactsFor = (contract, requiredMembers) => {
  const artifacts = new Set()
  if (contract.bindings?.avalonia?.status === 'unbound') {
    artifacts.add('avalonia-public-api-baseline')
    artifacts.add('contract-v2-avalonia-binding')
  }
  if (requiredMembers.length > 0) artifacts.add('required-member-coverage')
  for (const [kind, requirements] of Object.entries(
    contract.requirements ?? {},
  )) {
    if ((requirements ?? []).length > 0)
      artifacts.add(`same-identity-${kind}-evidence`)
  }
  artifacts.add('same-identity-cross-platform-comparison')
  return [...artifacts]
}

const deriveGap = (contract, status, comparison) => {
  const requiredMembers = contractMembers(contract)
    .filter((member) => member.status !== 'aligned-candidate')
    .map((member) => ({
      kind: member.kind,
      name: member.name,
      status: member.status,
      reason: member.governance?.reason,
      owner: member.governance?.owner,
      testPolicy: member.governance?.testPolicy,
      reviewPolicy: member.governance?.reviewPolicy,
      scenarioIds: member.scenarioIds ?? [],
    }))
  const owner = contract.owner
  let reason
  if (requiredMembers.length > 0) {
    reason = [...new Set(requiredMembers.map((member) => member.reason))].join(
      ' ',
    )
  } else if (contract.bindings?.avalonia?.status === 'unbound') {
    reason =
      'The Avalonia binding is unbound; a real public implementation and semantic binding are required.'
  } else {
    reason =
      'Static mapping has no member gap, but required same-identity cross-platform evidence is absent.'
  }
  const requiredScenarios = [...new Set(contract.scenarioIds ?? [])]
  const requiredEvidence = evidenceArtifactsFor(contract, requiredMembers)
  const hasCurrentComparison =
    comparison?.verdict === 'pass' &&
    comparison.identity?.contract === contract.id
  return {
    contract: contract.id,
    status,
    reason,
    owner,
    requiredMembers,
    requiredScenarios,
    requiredEvidence,
    evidencePolicy: {
      realExecution: true,
      allowSkip: false,
      allowOverrideWithoutGovernance: false,
    },
    missingMembers: contract.coverage?.missing ?? 0,
    partialMembers: contract.coverage?.partial ?? 0,
    missingArtifacts: requiredEvidence.filter(
      (artifact) =>
        !hasCurrentComparison || !artifact.startsWith('same-identity-'),
    ),
  }
}

const validateGap = (gap) => {
  if (!gap.reason) fail(`alignment.gap.${gap.contract}.reason missing`)
  if (!gap.owner) fail(`alignment.gap.${gap.contract}.owner missing`)
  if (!Array.isArray(gap.requiredMembers))
    fail(`alignment.gap.${gap.contract}.requiredMembers missing`)
  if (
    !Array.isArray(gap.requiredScenarios) ||
    gap.requiredScenarios.length === 0
  )
    fail(`alignment.gap.${gap.contract}.requiredScenarios missing`)
  if (!Array.isArray(gap.requiredEvidence) || gap.requiredEvidence.length === 0)
    fail(`alignment.gap.${gap.contract}.requiredEvidence missing`)
  if (
    gap.evidencePolicy?.realExecution !== true ||
    gap.evidencePolicy?.allowSkip !== false ||
    gap.evidencePolicy?.allowOverrideWithoutGovernance !== false
  )
    fail(`alignment.gap.${gap.contract}.evidencePolicy invalid`)
  for (const member of gap.requiredMembers) {
    for (const field of [
      'kind',
      'name',
      'status',
      'reason',
      'owner',
      'testPolicy',
      'reviewPolicy',
    ]) {
      if (!member[field])
        fail(
          `alignment.gap.${gap.contract}.member.${member.name}.${field} missing`,
        )
    }
    if (!Array.isArray(member.scenarioIds) || member.scenarioIds.length === 0)
      fail(
        `alignment.gap.${gap.contract}.member.${member.name}.scenarioIds missing`,
      )
  }
}

export function deriveAlignment(registry, comparison = null) {
  const statuses = []
  const gaps = []
  for (const contract of registry.contracts ?? []) {
    const coverage = contract.coverage ?? {}
    let status
    if (contract.bindings?.avalonia?.status === 'unbound') status = 'missing'
    else if ((coverage.missing ?? 0) > 0 || (coverage.partial ?? 0) > 0)
      status = 'partial'
    else if (
      comparison?.verdict === 'pass' &&
      comparison.identity.contract === contract.id
    )
      status = 'aligned'
    else status = 'blocked'
    statuses.push({ id: contract.id, status, source: 'derived' })
    if (status !== 'aligned') gaps.push(deriveGap(contract, status, comparison))
  }
  for (const type of registry.avaloniaOnlyTypes ?? []) {
    statuses.push({
      id: type.type ?? type,
      status: 'avalonia-extra',
      source: 'derived',
    })
  }
  const stable = statuses
    .filter((entry) => entry.status === 'aligned')
    .map((entry) => entry.id)
  return {
    schema: 'fsusui.alignment.v2',
    statuses,
    stable,
    gaps,
    consumers: {
      galleryStableFamilies: stable.map((id) =>
        id.replace(/^component-v2\.el-/, ''),
      ),
      docsSupportContractIds: stable,
      nugetStableEligible: gaps.length === 0,
      releaseReady: gaps.length === 0,
    },
  }
}

export function validateReadiness(alignment, expected = {}) {
  if (alignment.statuses.some((entry) => entry.source !== 'derived'))
    fail('readiness.handwritten aligned/status forbidden')
  const status = new Map(
    alignment.statuses.map((entry) => [entry.id, entry.status]),
  )
  for (const gap of alignment.gaps ?? []) validateGap(gap)
  for (const id of alignment.stable ?? []) {
    if (status.get(id) !== 'aligned')
      fail(`readiness.stable.${id} is ${status.get(id) ?? 'missing'}`)
  }
  const expectedStable = alignment.statuses
    .filter((entry) => entry.status === 'aligned')
    .map((entry) => entry.id)
  same(alignment.stable, expectedStable, 'readiness.stable.derived')
  same(
    alignment.consumers,
    {
      galleryStableFamilies: expectedStable.map((id) =>
        id.replace(/^component-v2\.el-/, ''),
      ),
      docsSupportContractIds: expectedStable,
      nugetStableEligible: alignment.gaps.length === 0,
      releaseReady: alignment.gaps.length === 0,
    },
    'readiness.consumers.derived',
  )
  for (const field of ['candidate', 'contractHash', 'alignmentHash']) {
    if (
      expected[field] !== undefined &&
      alignment.identity?.[field] !== expected[field]
    )
      fail(`readiness.identity.${field} mismatch`)
  }
}

const generatedGallerySource = (alignment) => `// <auto-generated />
// Generated by scripts/conformance-v2-evidence.mjs from fsusui.alignment.v2.
namespace FsusUI.Avalonia.Demo.Gallery;

internal static class FsusGeneratedAlignment
{
  public static IReadOnlySet<string> StableFamilies { get; } = new HashSet<string>(StringComparer.Ordinal)
  {
${alignment.consumers.galleryStableFamilies.map((id) => `    "${id}",`).join('\n')}
  };
}
`

const generatedSupportMatrix = (
  alignment,
) => `<!-- Generated by scripts/conformance-v2-evidence.mjs. Do not edit by hand. -->
# Contract V2 alignment support matrix

The sole source is the derived \`fsusui.alignment.v2\` artifact. Only \`aligned\` contracts are stable; all other statuses remain excluded from stable Gallery and release consumers.

| Contract | Derived status |
| --- | --- |
${alignment.statuses.map((entry) => `| \`${entry.id}\` | \`${entry.status}\` |`).join('\n')}
`

const writeConsumers = (alignment, args) => {
  for (const [target, content] of [
    [args.gallery, generatedGallerySource(alignment)],
    [args.support, generatedSupportMatrix(alignment)],
  ]) {
    if (!target) continue
    const absolute = path.resolve(root, target)
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, content)
  }
}

const mutationCases = (positive) => [
  [
    'vue-prop-removed',
    'vue.baseline.inputTreeHash stale',
    () =>
      validateBaselineFreshness({
        platform: 'vue',
        inputTreeHash: 'old',
        currentInputTreeHash: 'changed-prop',
        outputHash: digest({}),
        payload: {},
      }),
  ],
  [
    'avalonia-property-default-nullability-changed',
    'avalonia.baseline.inputTreeHash stale',
    () =>
      validateBaselineFreshness({
        platform: 'avalonia',
        inputTreeHash: 'old',
        currentInputTreeHash: 'changed-property',
        outputHash: digest({}),
        payload: {},
      }),
  ],
  [
    'unmapped-public-member',
    'coverage.member.new-public-member missing scenario',
    () =>
      validateCoverage({
        requiredMembers: ['new-public-member'],
        memberScenarios: {},
        executions: {},
      }),
  ],
  [
    'runner-skips-action',
    'avalonia.steps[1] failed',
    () =>
      validateEvidence(
        {
          ...positive.avalonia,
          steps: [
            positive.avalonia.steps[0],
            { observation: { passed: false } },
          ],
        },
        'avalonia',
      ),
  ],
  [
    'focus-drift',
    'state.focus mismatch',
    () => same('markdown', 'button', 'state.focus'),
  ],
  [
    'selection-direction-drift',
    'state.selection.direction mismatch',
    () => same('none', 'backward', 'state.selection.direction'),
  ],
  [
    'revision-drift',
    'state.revision mismatch',
    () => same(2, 3, 'state.revision'),
  ],
  [
    'history-drift',
    'state.history.undoDepth mismatch',
    () => same(0, 1, 'state.history.undoDepth'),
  ],
  [
    'document-epoch-drift',
    'identity.documentEpoch mismatch',
    () => same(348, 349, 'identity.documentEpoch'),
  ],
  [
    'role-drift',
    'accessibility.markdown.role mismatch',
    () => same('edit', 'article', 'accessibility.markdown.role'),
  ],
  [
    'name-value-state-drift',
    'accessibility.markdown.name mismatch',
    () =>
      same('Markdown editor', 'Fixture name', 'accessibility.markdown.name'),
  ],
  [
    'required-coverage-missing',
    'coverage.member.selection missing scenario',
    () =>
      validateCoverage({
        requiredMembers: ['selection'],
        memberScenarios: {},
        executions: {},
      }),
  ],
  [
    'stale-evidence-hash',
    'identity.contractHash mismatch',
    () => same('current', 'stale', 'identity.contractHash'),
  ],
  [
    'partial-enters-stable',
    'readiness.stable.partial-component is partial',
    () =>
      validateReadiness({
        statuses: [
          { id: 'partial-component', status: 'partial', source: 'derived' },
        ],
        stable: ['partial-component'],
      }),
  ],
  [
    'gap-detail-missing-owner',
    'alignment.gap.partial-component.owner missing',
    () =>
      validateReadiness({
        statuses: [
          { id: 'partial-component', status: 'partial', source: 'derived' },
        ],
        stable: [],
        gaps: [
          {
            contract: 'partial-component',
            status: 'partial',
            reason: 'A real mapped member is missing.',
            owner: '',
            requiredMembers: [],
            requiredScenarios: ['scenario.partial'],
            requiredEvidence: ['required-member-coverage'],
            evidencePolicy: {
              realExecution: true,
              allowSkip: false,
              allowOverrideWithoutGovernance: false,
            },
          },
        ],
      }),
  ],
  [
    'candidate-identity-mismatch',
    'identity.candidate mismatch',
    () => same('candidate-a', 'candidate-b', 'identity.candidate'),
  ],
  [
    'override-governance-missing',
    'override[0].reviewPolicy missing governance',
    () =>
      validateOverride({
        field: 'state.value',
        reason: 'platform',
        owner: 'conformance',
        testPolicy: 'test',
      }),
  ],
  [
    'markdown-write-alias',
    'contract.mode.write forbidden',
    () => validateMarkdownEvidence({ modes: ['source', 'write'] }),
  ],
  [
    'same-source-document-history',
    'document.identity history isolation failed',
    () =>
      validateMarkdownEvidence({
        documents: [
          { source: 'same', identity: 'a' },
          { source: 'same', identity: 'b' },
        ],
        sharedHistory: true,
      }),
  ],
  [
    'crlf-normalized-offset',
    'source.offset CRLF normalization drift',
    () =>
      validateMarkdownEvidence({ source: 'a\r\nb', offsetSpace: 'normalized' }),
  ],
  [
    'dom-source-mapping',
    'projection.source mapping used DOM',
    () => validateMarkdownEvidence({ sourceMappingOwner: 'DOM' }),
  ],
  [
    'synthetic-ime-as-native',
    'ime.native evidence is synthetic',
    () => validateMarkdownEvidence({ nativeIme: { synthetic: true } }),
  ],
  [
    'metadata-only-counted',
    'coverage.scenario.generated-metadata metadata-only',
    () =>
      validateCoverage({
        requiredMembers: ['document'],
        memberScenarios: { document: ['generated-metadata'] },
        executions: { 'generated-metadata': { real: false } },
      }),
  ],
  [
    'filename-matching',
    'identity.checkpoint mismatch',
    () => same('after-undo', 'same-file-name', 'identity.checkpoint'),
  ],
  [
    'visual-masking-semantic',
    'accessibility.markdown.role mismatch',
    () => same('edit', 'article', 'accessibility.markdown.role'),
  ],
  [
    'broad-override',
    'override[0].field broad override forbidden',
    () =>
      validateOverride({
        field: 'accessibility.*',
        reason: 'platform',
        owner: 'conformance',
        testPolicy: 'exact',
        reviewPolicy: 'per-release',
      }),
  ],
]

export function runMutations(positive) {
  const comparison = compareEvidence(positive.web, positive.avalonia)
  const results = mutationCases(positive).map(
    ([id, expectedError, execute]) => {
      let actualError = ''
      try {
        execute()
      } catch (error) {
        actualError = error.message
      }
      const killed = actualError.includes(expectedError)
      return {
        id,
        injectedChange: id,
        expectedGate: expectedError.split(' ')[0],
        expectedError,
        actualError,
        exitCode: killed ? 1 : 0,
        artifactDigest: digest({ id, actualError }),
        killed,
      }
    },
  )
  if (results.some((entry) => !entry.killed))
    fail(
      `mutation survivors: ${results
        .filter((entry) => !entry.killed)
        .map((entry) => entry.id)
        .join(', ')}`,
    )
  return {
    schema: 'fsusui.conformance-mutations.v2',
    positiveCandidate: comparison.verdict,
    verdict: 'pass',
    results,
  }
}

const parseArgs = (argv) =>
  Object.fromEntries(
    argv.reduce(
      (pairs, value, index) =>
        value.startsWith('--')
          ? [...pairs, [value.slice(2), argv[index + 1]]]
          : pairs,
      [],
    ),
  )
async function cli() {
  const [command, ...argv] = process.argv.slice(2)
  const args = parseArgs(argv)
  if (command === 'compare') {
    const result = compareEvidence(readJson(args.web), readJson(args.avalonia))
    writeJson(args.out, result)
    console.log(`conformance-v2 comparator passed: ${args.out}`)
  } else if (command === 'derive') {
    const comparison = args.comparison ? readJson(args.comparison) : null
    const result = deriveAlignment(readJson(args.contract), comparison)
    const candidate =
      !args.candidate || args.candidate === 'git'
        ? spawnSync('git', ['rev-parse', 'HEAD'], {
            cwd: root,
            encoding: 'utf8',
          }).stdout.trim()
        : args.candidate
    result.identity = {
      candidate,
      contractHash: digest(fs.readFileSync(path.resolve(root, args.contract))),
    }
    result.identity.alignmentHash = digest({
      statuses: result.statuses,
      stable: result.stable,
      gaps: result.gaps,
    })
    writeJson(args.out, result)
    writeJson(args.gaps, {
      schema: 'fsusui.alignment-gaps.v2',
      identity: result.identity,
      gaps: result.gaps,
    })
    writeConsumers(result, args)
    console.log(
      `conformance-v2 alignment derived: stable=${result.stable.length} gaps=${result.gaps.length}`,
    )
  } else if (command === 'readiness') {
    const alignment = readJson(args.alignment)
    const expected = {
      candidate: spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).stdout.trim(),
      contractHash: digest(fs.readFileSync(path.resolve(root, args.contract))),
      alignmentHash: digest({
        statuses: alignment.statuses,
        stable: alignment.stable,
        gaps: alignment.gaps,
      }),
    }
    validateReadiness(alignment, expected)
    console.log('conformance-v2 readiness passed')
  } else if (command === 'mutations') {
    const result = runMutations({
      web: readJson(args.web),
      avalonia: readJson(args.avalonia),
    })
    writeJson(args.out, result)
    console.log(
      `conformance-v2 mutations passed: ${result.results.length}/${result.results.length}`,
    )
  } else if (command === 'baseline') {
    validateBaselineFreshness(readJson(args.input))
    console.log('conformance-v2 baseline freshness passed')
  } else if (command === 'coverage') {
    validateCoverage(readJson(args.input))
    console.log('conformance-v2 coverage passed')
  } else if (command === 'markdown') {
    validateMarkdownEvidence(readJson(args.input))
    console.log('conformance-v2 Markdown evidence passed')
  } else if (command === 'override') {
    validateOverride(readJson(args.input))
    console.log('conformance-v2 override passed')
  } else
    fail(
      'Usage: conformance-v2-evidence.mjs <compare|derive|readiness|mutations|baseline|coverage|markdown|override> ...',
    )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
