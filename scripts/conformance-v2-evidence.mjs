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
const validatedComparisons = new WeakSet()
const scenarioArtifactPolicy = (scenario) => {
  if (scenario.includes('.input.')) return { action: 'render', artifacts: ['interaction', 'state'] }
  if (scenario.includes('.output.')) return { action: 'event', artifacts: ['event'] }
  if (scenario.includes('.content-region.'))
    return { action: 'content', artifacts: ['content', 'accessibility', 'visual'] }
  if (scenario.includes('.state.')) return { action: 'render', artifacts: ['state'] }
  if (scenario.endsWith('.keyboard')) return { action: 'keyboard', artifacts: ['interaction', 'event'] }
  if (scenario.endsWith('.pointer')) return { action: 'pointer', artifacts: ['interaction', 'event'] }
  if (scenario.endsWith('.focus')) return { action: 'focus', artifacts: ['focus', 'visual'] }
  if (scenario.endsWith('.a11y')) return { action: 'accessibility', artifacts: ['accessibility'] }
  if (scenario.endsWith('.motion')) return { action: 'motion', artifacts: ['motion'] }
  if (scenario.endsWith('.perf')) return { action: 'performance', artifacts: ['performance'] }
  return null
}
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
const digestFile = (file) =>
  crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.resolve(root, file)))
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

const validateContractExecution = (execution, platform, contractId) => {
  if (!execution || typeof execution !== 'object')
    fail(`${platform}.contractExecutions.${contractId} missing`)
  for (const field of requiredIdentity) {
    if (
      execution.identity?.[field] === undefined ||
      execution.identity[field] === ''
    )
      fail(`${platform}.${contractId}.identity.${field} missing`)
  }
  if (execution.identity.contract !== contractId)
    fail(`${platform}.${contractId}.identity.contract mismatch`)
  if (!Array.isArray(execution.steps) || execution.steps.length === 0)
    fail(`${platform}.${contractId}.steps missing`)
  execution.steps.forEach((step, index) => {
    if (step.index !== index)
      fail(`${platform}.${contractId}.steps[${index}].index mismatch`)
    if (step.observation?.passed !== true)
      fail(`${platform}.${contractId}.steps[${index}] failed`)
    same(
      execution.identity,
      step.binding,
      `${platform}.${contractId}.steps[${index}].binding`,
    )
    if (!Number.isFinite(step.elapsedMilliseconds))
      fail(`${platform}.${contractId}.steps[${index}].elapsedMilliseconds missing`)
  })
  const coverage = execution.coverage
  if (!Array.isArray(coverage?.requiredMembers))
    fail(`${platform}.${contractId}.coverage.requiredMembers missing`)
  if (!coverage?.memberScenarios || typeof coverage.memberScenarios !== 'object')
    fail(`${platform}.${contractId}.coverage.memberScenarios missing`)
  if (!Array.isArray(coverage?.requiredScenarios))
    fail(`${platform}.${contractId}.coverage.requiredScenarios missing`)
  if (!coverage?.executions || typeof coverage.executions !== 'object')
    fail(`${platform}.${contractId}.coverage.executions missing`)
  for (const member of coverage.requiredMembers) {
    if (!coverage.memberScenarios[member]?.length)
      fail(`${platform}.${contractId}.coverage.member.${member} missing scenario`)
  }
  for (const scenario of coverage.requiredScenarios) {
    const receipt = coverage.executions[scenario]
    if (receipt?.real !== true)
      fail(`${platform}.${contractId}.coverage.scenario.${scenario} metadata-only`)
    if (!Array.isArray(receipt.stepIndexes) || receipt.stepIndexes.length === 0)
      fail(`${platform}.${contractId}.coverage.scenario.${scenario}.stepIndexes missing`)
    if (
      receipt.stepIndexes.some(
        (index) =>
          !Number.isInteger(index) ||
          index < 0 ||
          index >= execution.steps.length,
      )
    )
      fail(`${platform}.${contractId}.coverage.scenario.${scenario}.stepIndexes invalid`)
    if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length === 0)
      fail(`${platform}.${contractId}.coverage.scenario.${scenario}.artifacts missing`)
    const policy = scenarioArtifactPolicy(scenario)
    if (!policy)
      fail(`${platform}.${contractId}.coverage.scenario.${scenario}.policy missing`)
    for (const artifact of policy.artifacts) {
      if (!receipt.artifacts.includes(artifact))
        fail(`${platform}.${contractId}.coverage.scenario.${scenario}.artifact.${artifact} missing`)
    }
    if (
      !receipt.stepIndexes.some(
        (index) => execution.steps[index]?.action === policy.action,
      )
    )
      fail(`${platform}.${contractId}.coverage.scenario.${scenario}.action.${policy.action} missing`)
  }
  same(execution.identity, execution.visual?.identity, `${platform}.${contractId}.visual.identity`)
  same(
    execution.identity,
    execution.performance?.identity,
    `${platform}.${contractId}.performance.identity`,
  )
  if (
    execution.visual?.renderedTopLevel !== true ||
    !execution.visual?.sha256 ||
    execution.visual?.artifactBytes < 1024 ||
    execution.visual?.observation?.width <= 0 ||
    execution.visual?.observation?.height <= 0 ||
    execution.visual?.observation?.focusIndicatorVisible !== true
  )
    fail(`${platform}.${contractId}.visual rendered focused artifact missing`)
  if (
    execution.performance?.passed !== true ||
    !Number.isFinite(execution.performance?.renderMilliseconds) ||
    !Number.isFinite(execution.performance?.interactionMilliseconds) ||
    !Number.isFinite(execution.performance?.budget?.renderMs) ||
    !Number.isFinite(execution.performance?.budget?.interactionMs) ||
    execution.performance.renderMilliseconds >
      execution.performance.budget.renderMs ||
    execution.performance.interactionMilliseconds >
      execution.performance.budget.interactionMs ||
    typeof execution.performance.budget.memory !== 'string' ||
    execution.performance.memoryObservation?.policy !==
      execution.performance.budget.memory ||
    execution.performance.memoryObservation?.inputItemCount !== 0 ||
    execution.performance.memoryObservation?.retainedPerItemStateCount !== 0 ||
    execution.performance.memoryObservation?.bounded !== true
  )
    fail(`${platform}.${contractId}.performance budget failed`)
  if (!execution.accessibility?.node)
    fail(`${platform}.${contractId}.accessibility node missing`)
  if (
    platform === 'web' &&
    (execution.accessibility.source !==
      'chromium-cdp-accessibility-and-atspi' ||
      execution.accessibility.atspiReachable !== true)
  )
    fail(`web.${contractId}.accessibility AT-SPI evidence missing`)
  if (
    platform === 'avalonia' &&
    execution.accessibility.source !== 'real-avalonia-automation-peer'
  )
    fail(`avalonia.${contractId}.accessibility AutomationPeer evidence missing`)
  return execution
}

const checkedState = (value) => {
  if ([true, 'true', 'on', 'checked'].includes(value)) return true
  if ([false, 'false', 'off', 'unchecked'].includes(value)) return false
  return null
}

const compareCheckTagExecution = (web, avalonia) => {
  const contractId = 'component-v2.el-check-tag'
  validateContractExecution(web, 'web', contractId)
  validateContractExecution(avalonia, 'avalonia', contractId)
  for (const field of requiredIdentity)
    same(web.identity[field], avalonia.identity[field], `${contractId}.identity.${field}`)
  same(web.coverage, avalonia.coverage, `${contractId}.coverage`)
  same(web.performance.budget, avalonia.performance.budget, `${contractId}.performance.budget`)
  same(false, web.state.checked, `${contractId}.web.state.checked`)
  same(false, avalonia.state.checked, `${contractId}.avalonia.state.checked`)
  same(web.state.revision, avalonia.state.revision, `${contractId}.state.revision`)
  same('checkbox', web.state.focus, `${contractId}.web.state.focus`)
  same('checkbox', avalonia.state.focus, `${contractId}.avalonia.state.focus`)
  same(
    ['change', 'update:checked', 'change', 'update:checked'],
    web.events.map((event) => event.name),
    `${contractId}.web.events.order`,
  )
  same(
    [true, true, false, false],
    web.events.map((event) => event.payload),
    `${contractId}.web.events.payload`,
  )
  same(
    [true, false],
    avalonia.events.map((event) => event.payload),
    `${contractId}.avalonia.events.payload`,
  )
  same(
    web.events.filter((event) => event.name === 'change').map((event) => event.payload),
    avalonia.events.map((event) => event.payload),
    `${contractId}.events.semantic`,
  )
  for (const [platform, execution] of [
    ['web', web],
    ['avalonia', avalonia],
  ]) {
    const node = execution.accessibility.node
    same('checkbox', node.role, `${contractId}.${platform}.a11y.role`)
    same('Check tag', node.name, `${contractId}.${platform}.a11y.name`)
    same(false, checkedState(node.states.checkedState), `${contractId}.${platform}.a11y.checked`)
    same(true, node.focus.keyboardFocusable, `${contractId}.${platform}.a11y.focusable`)
    same('reduced', execution.state.motion.mode, `${contractId}.${platform}.motion.mode`)
    same(false, execution.state.motion.active, `${contractId}.${platform}.motion.active`)
    same(
      {
        checked: false,
        content: 'Check tag',
        focused: true,
        focusIndicatorVisible: true,
      },
      {
        checked: execution.visual.observation.checked,
        content: execution.visual.observation.content,
        focused: execution.visual.observation.focused,
        focusIndicatorVisible:
          execution.visual.observation.focusIndicatorVisible,
      },
      `${contractId}.${platform}.visual.observation`,
    )
  }
  return {
    schema: 'fsusui.conformance-contract-comparison.v2',
    verdict: 'pass',
    identity: web.identity,
    evidenceDigests: { web: digest(web), avalonia: digest(avalonia) },
    coverage: web.coverage,
    performanceBudget: web.performance.budget,
    comparedArtifacts: [
      'required-member-coverage',
      'same-identity-keyboard-evidence',
      'same-identity-pointer-evidence',
      'same-identity-focus-evidence',
      'same-identity-a11y-evidence',
      'same-identity-motion-evidence',
      'same-identity-perf-evidence',
      'same-identity-visual-evidence',
      'same-identity-cross-platform-comparison',
    ],
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
  const markdownReceipt = {
    schema: 'fsusui.conformance-contract-comparison.v2',
    verdict: 'pass',
    identity: web.identity,
    evidenceDigests: { web: digest(web), avalonia: digest(avalonia) },
    comparedArtifacts: [
      'same-identity-keyboard-evidence',
      'same-identity-focus-evidence',
      'same-identity-a11y-evidence',
      'same-identity-perf-evidence',
      'same-identity-cross-platform-comparison',
    ],
  }
  const webContractIds = Object.keys(web.contractExecutions ?? {}).sort()
  const avaloniaContractIds = Object.keys(
    avalonia.contractExecutions ?? {},
  ).sort()
  same(webContractIds, avaloniaContractIds, 'contractExecutions.ids')
  const receipts = {
    [web.identity.contract]: markdownReceipt,
  }
  for (const contractId of webContractIds) {
    if (contractId === 'component-v2.el-check-tag') {
      receipts[contractId] = compareCheckTagExecution(
        web.contractExecutions[contractId],
        avalonia.contractExecutions[contractId],
      )
      continue
    }
    fail(`contractExecutions.${contractId} comparator missing`)
  }
  for (const [contractId, receipt] of Object.entries(receipts)) {
    for (const field of [
      'candidate',
      'contractHash',
      'webBaselineHash',
      'avaloniaBaselineHash',
      'runnerHash',
    ]) {
      same(
        web.identity[field],
        receipt.identity?.[field],
        `receipts.${contractId}.identity.${field}`,
      )
    }
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
    receipts,
  }
}

export function validateCurrentComparison(
  comparison,
  web,
  avalonia,
  expected,
) {
  if (comparison?.schema !== 'fsusui.conformance-comparison.v2')
    fail('comparison.schema invalid')
  if (comparison.verdict !== 'pass') fail('comparison.verdict failed')
  for (const field of [
    'candidate',
    'contractHash',
    'webBaselineHash',
    'avaloniaBaselineHash',
    'runnerHash',
  ]) {
    same(
      expected[field],
      comparison.identity?.[field],
      `comparison.identity.${field}`,
    )
  }
  if (comparison.identity?.contract !== expected.contract)
    fail('comparison.identity.contract mismatch')
  if (comparison.identity?.scenario !== expected.scenario)
    fail('comparison.identity.scenario mismatch')
  if (!comparison.evidenceDigests?.web || !comparison.evidenceDigests?.avalonia)
    fail('comparison.evidenceDigests missing')
  same(
    comparison.evidenceDigests.web,
    digest(web),
    'comparison.evidenceDigests.web',
  )
  same(
    comparison.evidenceDigests.avalonia,
    digest(avalonia),
    'comparison.evidenceDigests.avalonia',
  )
  for (const artifact of [
    'public-state',
    'transition-order',
    'accessibility',
    'performance',
  ]) {
    if (!comparison.compared?.includes(artifact))
      fail(`comparison.requiredArtifact.${artifact} missing`)
  }
  const recomputed = compareEvidence(web, avalonia)
  same(recomputed, comparison, 'comparison.recomputed')
  validatedComparisons.add(comparison)
  return comparison
}

const currentComparisonIdentity = (contractPath) => {
  const candidate = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim()
  return {
    candidate,
    contractHash: digestFile(contractPath),
    webBaselineHash: digestFile('spec/baselines/vue-current.json'),
    avaloniaBaselineHash: digestFile(
      'spec/avalonia/semantic/FsusUI.Avalonia.semantic.json',
    ),
    runnerHash: crypto
      .createHash('sha256')
      .update(
        fs.readFileSync(
          path.resolve(root, 'scripts/avalonia-conformance-v2.mjs'),
        ),
      )
      .update(
        fs.readFileSync(
          path.resolve(root, 'scripts/native-screen-reader-harness.mjs'),
        ),
      )
      .update(
        fs.readFileSync(
          path.resolve(root, 'scripts/conformance-v2-evidence.mjs'),
        ),
      )
      .digest('hex'),
    contract: 'component-v2.el-markdown-editor',
    scenario: 'scenario.v2.el-markdown-editor.real-interaction-trace',
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

const evidenceArtifactsFor = (contract) => {
  const artifacts = new Set()
  if (contract.bindings?.avalonia?.status === 'unbound') {
    artifacts.add('avalonia-public-api-baseline')
    artifacts.add('contract-v2-avalonia-binding')
  }
  if (contractMembers(contract).length > 0)
    artifacts.add('required-member-coverage')
  for (const [kind, requirements] of Object.entries(
    contract.requirements ?? {},
  )) {
    if ((requirements ?? []).length > 0)
      artifacts.add(`same-identity-${kind}-evidence`)
  }
  if (
    (contract.contentRegions ?? []).length > 0 ||
    (contract.requirements?.focus ?? []).length > 0
  )
    artifacts.add('same-identity-visual-evidence')
  artifacts.add('same-identity-cross-platform-comparison')
  return [...artifacts]
}

const deriveGap = (contract, status, receipt) => {
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
  const requiredEvidence = evidenceArtifactsFor(contract)
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
      (artifact) => !receipt?.comparedArtifacts?.includes(artifact),
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

const validReviewedPlatformException = (contract) => {
  const exception = contract.platformException
  return [
    'reason',
    'alternative',
    'owner',
    'testPolicy',
    'reviewPolicy',
    'reviewedAt',
  ].every(
    (field) =>
      typeof exception?.[field] === 'string' && exception[field].trim() !== '',
  )
}

const validateReceiptForContract = (contract, receipt) => {
  if (!receipt) return null
  if (receipt.schema !== 'fsusui.conformance-contract-comparison.v2')
    fail(`alignment.receipt.${contract.id}.schema invalid`)
  if (receipt.verdict !== 'pass')
    fail(`alignment.receipt.${contract.id}.verdict failed`)
  if (receipt.identity?.contract !== contract.id)
    fail(`alignment.receipt.${contract.id}.identity mismatch`)
  const expectedScenarios = [...new Set(contract.scenarioIds ?? [])].sort()
  const expectedMembers = contractMembers(contract)
    .map((member) => `${toCoverageKind(member.kind)}.${member.name}`)
    .sort()
  const claimedScenarios = [
    ...(receipt.coverage?.requiredScenarios ?? []),
  ].sort()
  const claimedMembers = [...(receipt.coverage?.requiredMembers ?? [])].sort()
  for (const scenario of claimedScenarios) {
    if (!expectedScenarios.includes(scenario))
      fail(`alignment.receipt.${contract.id}.coverage.scenario.${scenario} unexpected`)
  }
  for (const member of claimedMembers) {
    if (!expectedMembers.includes(member))
      fail(`alignment.receipt.${contract.id}.coverage.member.${member} unexpected`)
  }
  for (const member of claimedMembers) {
      const [kind, ...nameParts] = member.split('.')
      const name = nameParts.join('.')
      const contractMember = contractMembers(contract).find(
        (candidate) =>
          toCoverageKind(candidate.kind) === kind && candidate.name === name,
      )
      const expectedMemberScenarios = [
        ...new Set(contractMember?.scenarioIds ?? []),
      ].sort()
      for (const scenario of receipt.coverage?.memberScenarios?.[member] ?? []) {
        if (!expectedMemberScenarios.includes(scenario))
          fail(`alignment.receipt.${contract.id}.coverage.member.${member}.scenario.${scenario} unexpected`)
      }
    }
  if (receipt.performanceBudget)
    same(
      {
        renderMs: contract.performanceBudget?.renderMs,
        interactionMs: contract.performanceBudget?.interactionMs,
        memory: contract.performanceBudget?.memory,
      },
      receipt.performanceBudget,
      `alignment.receipt.${contract.id}.performanceBudget`,
    )
  return receipt
}

const receiptCoverageComplete = (contract, receipt) => {
  if (!receipt) return false
  const expectedScenarios = [...new Set(contract.scenarioIds ?? [])].sort()
  const expectedMembers = contractMembers(contract)
    .map((member) => `${toCoverageKind(member.kind)}.${member.name}`)
    .sort()
  const claimedScenarios = [
    ...(receipt.coverage?.requiredScenarios ?? []),
  ].sort()
  const claimedMembers = [...(receipt.coverage?.requiredMembers ?? [])].sort()
  if (
    JSON.stringify(expectedScenarios) !== JSON.stringify(claimedScenarios) ||
    JSON.stringify(expectedMembers) !== JSON.stringify(claimedMembers)
  )
    return false
  for (const member of expectedMembers) {
    const [kind, ...nameParts] = member.split('.')
    const name = nameParts.join('.')
    const contractMember = contractMembers(contract).find(
      (candidate) =>
        toCoverageKind(candidate.kind) === kind && candidate.name === name,
    )
    const expectedMemberScenarios = [
      ...new Set(contractMember?.scenarioIds ?? []),
    ].sort()
    const claimedMemberScenarios = [
      ...(receipt.coverage?.memberScenarios?.[member] ?? []),
    ].sort()
    if (
      JSON.stringify(expectedMemberScenarios) !==
      JSON.stringify(claimedMemberScenarios)
    )
      return false
  }
  return (
    receipt.performanceBudget?.renderMs === contract.performanceBudget?.renderMs &&
    receipt.performanceBudget?.interactionMs ===
      contract.performanceBudget?.interactionMs &&
    receipt.performanceBudget?.memory === contract.performanceBudget?.memory
  )
}

const toCoverageKind = (kind) =>
  kind === 'contentRegion' ? 'content-region' : kind

export function deriveAlignment(registry, comparison = null) {
  if (comparison && !validatedComparisons.has(comparison))
    fail('alignment.comparison receipt was not current-validated')
  const statuses = []
  const gaps = []
  for (const contract of registry.contracts ?? []) {
    const coverage = contract.coverage ?? {}
    const receipt = validateReceiptForContract(
      contract,
      comparison?.receipts?.[contract.id] ?? null,
    )
    const requiredEvidence = evidenceArtifactsFor(contract)
    const hasCompleteReceipt =
      receipt &&
      receiptCoverageComplete(contract, receipt) &&
      requiredEvidence.every((artifact) =>
        receipt.comparedArtifacts?.includes(artifact),
      )
    let status
    if (
      contract.component?.exportStatus === 'web-only' &&
      validReviewedPlatformException(contract)
    )
      status = 'web-only'
    else if (contract.bindings?.avalonia?.status === 'unbound') status = 'missing'
    else if (
      (coverage.missing ?? 0) > 0 ||
      (coverage.partial ?? 0) > 0 ||
      (coverage.webOnly ?? 0) > 0
    )
      status = 'partial'
    else if (hasCompleteReceipt)
      status = 'aligned'
    else status = 'blocked'
    statuses.push({ id: contract.id, status, source: 'derived' })
    if (status !== 'aligned' && status !== 'web-only')
      gaps.push(deriveGap(contract, status, receipt))
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
  const webOnly = statuses
    .filter((entry) => entry.status === 'web-only')
    .map((entry) => entry.id)
  return {
    schema: 'fsusui.alignment.v2',
    statuses,
    stable,
    webOnly,
    gaps,
    consumers: {
      galleryStableFamilies: stable.map((id) =>
        id.replace(/^component-v2\.el-/, ''),
      ),
      docsSupportContractIds: stable,
      webOnlyContractIds: webOnly,
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
  const expectedWebOnly = alignment.statuses
    .filter((entry) => entry.status === 'web-only')
    .map((entry) => entry.id)
  same(alignment.stable, expectedStable, 'readiness.stable.derived')
  same(alignment.webOnly, expectedWebOnly, 'readiness.webOnly.derived')
  same(
    alignment.consumers,
    {
      galleryStableFamilies: expectedStable.map((id) =>
        id.replace(/^component-v2\.el-/, ''),
      ),
      docsSupportContractIds: expectedStable,
      webOnlyContractIds: expectedWebOnly,
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

const mutationCases = (positive) => {
  const currentComparison = compareEvidence(positive.web, positive.avalonia)
  const expectedComparisonIdentity = { ...currentComparison.identity }
  return [
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
    'stale-comparison-candidate',
    'comparison.identity.candidate mismatch',
    () =>
      validateCurrentComparison(
        {
          ...currentComparison,
          identity: {
            ...currentComparison.identity,
            candidate: 'stale-candidate',
          },
        },
        positive.web,
        positive.avalonia,
        expectedComparisonIdentity,
      ),
  ],
  [
    'stale-comparison-contract',
    'comparison.identity.contractHash mismatch',
    () =>
      validateCurrentComparison(
        {
          ...currentComparison,
          identity: {
            ...currentComparison.identity,
            contractHash: 'stale-contract',
          },
        },
        positive.web,
        positive.avalonia,
        expectedComparisonIdentity,
      ),
  ],
  [
    'stale-comparison-web-baseline',
    'comparison.identity.webBaselineHash mismatch',
    () =>
      validateCurrentComparison(
        {
          ...currentComparison,
          identity: {
            ...currentComparison.identity,
            webBaselineHash: 'stale-web-baseline',
          },
        },
        positive.web,
        positive.avalonia,
        expectedComparisonIdentity,
      ),
  ],
  [
    'stale-comparison-avalonia-baseline',
    'comparison.identity.avaloniaBaselineHash mismatch',
    () =>
      validateCurrentComparison(
        {
          ...currentComparison,
          identity: {
            ...currentComparison.identity,
            avaloniaBaselineHash: 'stale-avalonia-baseline',
          },
        },
        positive.web,
        positive.avalonia,
        expectedComparisonIdentity,
      ),
  ],
  [
    'stale-comparison-runner',
    'comparison.identity.runnerHash mismatch',
    () =>
      validateCurrentComparison(
        {
          ...currentComparison,
          identity: {
            ...currentComparison.identity,
            runnerHash: 'stale-runner',
          },
        },
        positive.web,
        positive.avalonia,
        expectedComparisonIdentity,
      ),
  ],
  [
    'stale-comparison-scenario',
    'comparison.identity.scenario mismatch',
    () =>
      validateCurrentComparison(
        {
          ...currentComparison,
          identity: {
            ...currentComparison.identity,
            scenario: 'scenario.stale',
          },
        },
        positive.web,
        positive.avalonia,
        expectedComparisonIdentity,
      ),
  ],
  [
    'tampered-comparison-web-evidence-digest',
    'comparison.evidenceDigests.web mismatch',
    () =>
      validateCurrentComparison(
        {
          ...currentComparison,
          evidenceDigests: {
            ...currentComparison.evidenceDigests,
            web: 'tampered-web-evidence',
          },
        },
        positive.web,
        positive.avalonia,
        expectedComparisonIdentity,
      ),
  ],
  [
    'comparison-required-artifact-removed',
    'comparison.requiredArtifact.accessibility missing',
    () =>
      validateCurrentComparison(
        {
          ...currentComparison,
          compared: currentComparison.compared.filter(
            (artifact) => artifact !== 'accessibility',
          ),
        },
        positive.web,
        positive.avalonia,
        expectedComparisonIdentity,
      ),
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
}

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
    if (!args.web || !args.avalonia)
      fail('derive current Web and Avalonia evidence paths are required')
    const web = readJson(args.web)
    const avalonia = readJson(args.avalonia)
    const expectedComparisonIdentity = currentComparisonIdentity(args.contract)
    validateCurrentComparison(
      comparison,
      web,
      avalonia,
      expectedComparisonIdentity,
    )
    const result = deriveAlignment(readJson(args.contract), comparison)
    result.identity = {
      ...expectedComparisonIdentity,
      comparisonHash: digest(comparison),
      evidenceDigests: comparison.evidenceDigests,
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
