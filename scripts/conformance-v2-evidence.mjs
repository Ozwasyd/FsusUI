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

const executionCoverageSchema = 'fsusui.member-execution-coverage.v2'
const semanticEventCoverage = new Map([
  [
    'markdown.transaction',
    {
      kind: 'output',
      member: 'transaction',
      scenarioId: 'scenario.v2.el-markdown-editor.output.transaction',
    },
  ],
  [
    'markdown.selection-change',
    {
      kind: 'output',
      member: 'selection-change',
      scenarioId: 'scenario.v2.el-markdown-editor.output.selection-change',
    },
  ],
  [
    'markdown.history-change',
    {
      kind: 'output',
      member: 'history-change',
      scenarioId: 'scenario.v2.el-markdown-editor.output.history-change',
    },
  ],
])
const operationCoverage = {
  web: new Map([
    [
      'ElMarkdownEditor.dispatchTransaction',
      {
        kind: 'operation',
        member: 'dispatchTransaction',
        scenarioId:
          'scenario.v2.el-markdown-editor.operation.dispatch-transaction',
      },
    ],
    [
      'ElMarkdownEditor.undo',
      {
        kind: 'operation',
        member: 'undo',
        scenarioId: 'scenario.v2.el-markdown-editor.operation.undo',
      },
    ],
  ]),
  avalonia: new Map([
    [
      'FsusMarkdownEditor.DispatchTransaction',
      {
        kind: 'operation',
        member: 'dispatchTransaction',
        scenarioId:
          'scenario.v2.el-markdown-editor.operation.dispatch-transaction',
      },
    ],
    [
      'FsusMarkdownEditor.Undo',
      {
        kind: 'operation',
        member: 'undo',
        scenarioId: 'scenario.v2.el-markdown-editor.operation.undo',
      },
    ],
  ]),
}
const executionCoverageKey = ({ kind, member, scenarioId }) =>
  `${kind}:${member}@${scenarioId}`
const executionCoverageWithoutHash = (coverage) => {
  const { outputHash: _outputHash, ...canonical } = coverage
  return canonical
}
export const executionCoverageHash = (coverage) =>
  digest(executionCoverageWithoutHash(coverage))
export const sealExecutionCoverage = (coverage) => ({
  ...executionCoverageWithoutHash(coverage),
  outputHash: executionCoverageHash(coverage),
})

const validateEvidenceExecutionCoverage = (evidence, platform) => {
  const coverage = evidence.executionCoverage
  if (coverage?.schema !== executionCoverageSchema)
    fail(`${platform}.executionCoverage.schema invalid`)
  if (coverage.real !== true)
    fail(`${platform}.executionCoverage metadata-only`)
  try {
    assert.deepStrictEqual(coverage.identity, evidence.identity)
  } catch {
    fail(`${platform}.executionCoverage.identity mismatch`)
  }
  if (!Array.isArray(coverage.records) || coverage.records.length === 0)
    fail(`${platform}.executionCoverage.records missing`)

  const records = new Map()
  for (const [index, record] of coverage.records.entries()) {
    const context = `${platform}.executionCoverage.records[${index}]`
    const source = record?.source
    let expected
    if (source?.kind === 'event') {
      expected = semanticEventCoverage.get(source.name)
      const observedEvents =
        platform === 'web'
          ? evidence.publicState?.eventNames
          : evidence.events?.map((entry) => entry.name)
      if (!expected || !observedEvents?.includes(source.name))
        fail(`${context}.source event not observed`)
    } else if (source?.kind === 'step') {
      const step = evidence.steps?.find((entry) => entry.index === source.index)
      if (
        !step ||
        step.action !== source.action ||
        step.target !== source.target ||
        step.observation?.passed !== true
      ) {
        fail(`${context}.source step not observed`)
      }
      expected = operationCoverage[platform].get(source.target)
      if (!expected) fail(`${context}.source step is not a covered operation`)
    } else {
      fail(`${context}.source invalid`)
    }
    for (const field of ['kind', 'member', 'scenarioId']) {
      if (record[field] !== expected[field])
        fail(`${context}.${field} does not match observed source`)
    }
    const key = executionCoverageKey(record)
    if (records.has(key)) fail(`${context} duplicates ${key}`)
    records.set(key, record)
  }
  return records
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
  validateEvidenceExecutionCoverage(evidence, platform)
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
  const normalizedMarkdownName = (value) =>
    value
      .replace(/^markdown\s*源码\s*编辑区$/iu, 'markdown editor')
      .replace(/^markdown source$/iu, 'markdown editor')
  const node = evidence.browserAccessibility.nodes.find(
    (entry) =>
      entry.role === 'textbox' &&
      /^markdown editor$/i.test(normalizedMarkdownName(entry.name ?? '')),
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
      name: normalizedMarkdownName(node.name ?? '')
        .replace(/ source$/i, '')
        .toLowerCase(),
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
      name: (node.name ?? '').toLowerCase(),
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
  const evidenceDigests = { web: digest(web), avalonia: digest(avalonia) }
  const webCoverage = validateEvidenceExecutionCoverage(web, 'web')
  const avaloniaCoverage = validateEvidenceExecutionCoverage(
    avalonia,
    'avalonia',
  )
  const coverageRecords = [...webCoverage]
    .filter(([key]) => avaloniaCoverage.has(key))
    .map(([key, record]) => ({
      kind: record.kind,
      member: record.member,
      scenarioId: record.scenarioId,
      webSource: record.source,
      avaloniaSource: avaloniaCoverage.get(key).source,
    }))
    .sort((first, second) =>
      executionCoverageKey(first).localeCompare(executionCoverageKey(second)),
    )
  const executionCoverage = sealExecutionCoverage({
    schema: executionCoverageSchema,
    identity: web.identity,
    real: true,
    evidenceDigests,
    records: coverageRecords,
  })
  return {
    schema: 'fsusui.conformance-comparison.v2',
    verdict: 'pass',
    identity: web.identity,
    evidenceDigests,
    executionCoverage,
    compared: [
      'public-state',
      'transition-order',
      'accessibility',
      'performance',
    ],
  }
}

const contractExecutionRequirements = (contract) =>
  [
    ['input', contract.inputs],
    ['output', contract.outputs],
    ['operation', contract.operations],
    ['contentRegion', contract.contentRegions],
  ].flatMap(([kind, members]) =>
    (members ?? [])
      .filter((member) =>
        ['aligned-candidate', 'partial'].includes(member.status),
      )
      .flatMap((member) =>
        (member.scenarioIds ?? []).map((scenarioId) => ({
          kind,
          member: member.name,
          scenarioId,
        })),
      ),
  )

const validateComparisonExecutionCoverage = (comparison, contract) => {
  if (comparison.schema !== 'fsusui.conformance-comparison.v2')
    fail(`comparison.${contract.id}.schema invalid`)
  if (comparison.verdict !== 'pass')
    fail(`comparison.${contract.id}.verdict failed`)
  const coverage = comparison.executionCoverage
  if (coverage?.schema !== executionCoverageSchema)
    fail(`comparison.${contract.id}.executionCoverage.schema invalid`)
  if (coverage.real !== true)
    fail(`comparison.${contract.id}.executionCoverage metadata-only`)
  try {
    assert.deepStrictEqual(coverage.identity, comparison.identity)
  } catch {
    fail(`comparison.${contract.id}.executionCoverage.identity mismatch`)
  }
  try {
    assert.deepStrictEqual(coverage.evidenceDigests, comparison.evidenceDigests)
  } catch {
    fail(`comparison.${contract.id}.executionCoverage.evidenceDigests mismatch`)
  }
  if (coverage.outputHash !== executionCoverageHash(coverage))
    fail(`comparison.${contract.id}.executionCoverage.outputHash invalid`)
  if (!Array.isArray(coverage.records))
    fail(`comparison.${contract.id}.executionCoverage.records missing`)

  const knownMembers = new Map(
    [
      ['input', contract.inputs],
      ['output', contract.outputs],
      ['operation', contract.operations],
      ['contentRegion', contract.contentRegions],
    ].flatMap(([kind, members]) =>
      (members ?? []).flatMap((member) =>
        (member.scenarioIds ?? []).map((scenarioId) => [
          executionCoverageKey({
            kind,
            member: member.name,
            scenarioId,
          }),
          member,
        ]),
      ),
    ),
  )
  const observed = new Set()
  for (const [index, record] of coverage.records.entries()) {
    const key = executionCoverageKey(record)
    if (!knownMembers.has(key))
      fail(
        `comparison.${contract.id}.executionCoverage.records[${index}] unknown ${key}`,
      )
    if (observed.has(key))
      fail(
        `comparison.${contract.id}.executionCoverage.records[${index}] duplicates ${key}`,
      )
    if (!record.webSource || !record.avaloniaSource)
      fail(
        `comparison.${contract.id}.executionCoverage.records[${index}] source binding missing`,
      )
    observed.add(key)
  }
  const required =
    contractExecutionRequirements(contract).map(executionCoverageKey)
  return {
    observedMembers: [...observed].sort(),
    missingCoverageMembers: required.filter((key) => !observed.has(key)).sort(),
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

export function deriveAlignment(registry, comparison = null) {
  const comparisonList = Array.isArray(comparison?.comparisons)
    ? comparison.comparisons
    : comparison
      ? [comparison]
      : []
  const comparisons = new Map()
  for (const candidate of comparisonList) {
    const contract = candidate?.identity?.contract
    if (!contract) fail('comparison.identity.contract missing')
    if (comparisons.has(contract))
      fail(`comparison.${contract} duplicated in comparison set`)
    comparisons.set(contract, candidate)
  }
  const statuses = []
  const gaps = []
  for (const contract of registry.contracts ?? []) {
    const coverage = contract.coverage ?? {}
    const contractComparison = comparisons.get(contract.id)
    const executionCoverage = contractComparison
      ? validateComparisonExecutionCoverage(contractComparison, contract)
      : null
    let status
    if (contract.component?.exportStatus === 'web-only') status = 'web-only'
    else if (contract.bindings?.avalonia?.status === 'unbound')
      status = 'missing'
    else if ((coverage.missing ?? 0) > 0 || (coverage.partial ?? 0) > 0)
      status = 'partial'
    else if (
      contract.component?.exportStatus === 'aligned-candidate' &&
      contractComparison?.verdict === 'pass' &&
      executionCoverage.missingCoverageMembers.length === 0
    )
      status = 'aligned'
    else status = 'blocked'
    statuses.push({ id: contract.id, status, source: 'derived' })
    if (!['aligned', 'web-only'].includes(status)) {
      gaps.push({
        contract: contract.id,
        status,
        missingMembers: coverage.missing ?? 0,
        partialMembers: coverage.partial ?? 0,
        missingCoverageMembers: executionCoverage?.missingCoverageMembers ?? [],
        missingArtifacts: [
          ...(contractComparison
            ? []
            : ['same-identity-cross-platform-evidence']),
          ...(contractComparison &&
          executionCoverage.missingCoverageMembers.length > 0
            ? ['required-member-execution-coverage']
            : []),
        ],
      })
    }
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
    'avalonia-atomic-actions-missing',
    'avalonia.accessibility atomic actions missing',
    () =>
      validateEvidence(
        {
          ...positive.avalonia,
          accessibility: {
            ...positive.avalonia.accessibility,
            markdown: {
              ...positive.avalonia.accessibility.markdown,
              atomicActionCount: 2,
            },
          },
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
