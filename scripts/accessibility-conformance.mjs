import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const generatedBy = 'scripts/accessibility-conformance.mjs'
const contractPath = 'tests/conformance/accessibility/contracts.json'
const snapshotPath = 'tests/conformance/accessibility/automation-snapshots.json'
const runtimeScenarioPath =
  'tests/conformance/accessibility/avalonia-runtime-scenarios.json'
const runtimeEvidencePath =
  '.tmp/conformance-v2/accessibility/avalonia-generated.json'
const runtimeVerificationPath =
  '.tmp/conformance-v2/accessibility/avalonia-generated-verification.json'
const runtimeHelperPath =
  'dotnet/FsusUI.Avalonia.HeadlessTests/AccessibilityRuntimeEvidence.cs'
const rootConformanceRunnerPath = 'scripts/run-conformance-v2.mjs'
const invalidFixturePath =
  'tests/fixtures/accessibility-conformance/invalid-cases.json'

const outputPaths = {
  report: 'tests/conformance/accessibility/artifacts/automation-report.json',
  avaloniaTests:
    'dotnet/FsusUI.Avalonia.HeadlessTests/Generated/AccessibilityConformanceTests.cs',
}

const requiredContractFields = [
  'accessibleName',
  'role',
  'value',
  'disabledState',
  'selectedState',
  'checkedState',
  'expandedState',
  'invalidState',
  'keyboardNavigation',
]

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const readJson = (relativePath) => JSON.parse(read(relativePath))

const sha256 = (content) =>
  crypto.createHash('sha256').update(content).digest('hex')

const toPosix = (value) => value.split(path.sep).join('/')

const parseValue = (value) => {
  const trimmed = value.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return trimmed.replace(/^['"]|['"]$/g, '')
}

const parseOverrideFile = (relativePath) => {
  const entries = []
  let current
  let pendingKey
  const absolutePath = path.join(root, relativePath)
  for (const line of fs.readFileSync(absolutePath, 'utf8').split('\n')) {
    const start = line.match(/^ {2}- id:\s*(.+)$/)
    if (start) {
      pendingKey = undefined
      current = {
        id: parseValue(start[1]),
        file: toPosix(path.relative(root, absolutePath)),
      }
      entries.push(current)
      continue
    }
    if (!current) continue
    if (pendingKey) {
      const continuation = line.match(/^ {6,}(.+)$/)
      if (continuation) {
        current[pendingKey] = parseValue(continuation[1])
        pendingKey = undefined
        continue
      }
    }
    const field = line.match(/^ {4}([A-Za-z][A-Za-z0-9]*):\s*(.*)$/)
    if (field) {
      if (field[2].trim() === '') {
        pendingKey = field[1]
      } else {
        current[field[1]] = parseValue(field[2])
        pendingKey = undefined
      }
    }
  }
  return entries
}

const collectAccessibilityOverrides = () => {
  const overrideRoot = path.join(root, 'spec/platform-overrides')
  return fs
    .readdirSync(overrideRoot)
    .filter((file) => file.endsWith('.yaml'))
    .sort()
    .flatMap((file) =>
      parseOverrideFile(`spec/platform-overrides/${file}`).filter(
        (entry) => entry.area === 'accessibility',
      ),
    )
}

const csString = (value) =>
  `"${String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')}"`

const csNullable = (value, render) =>
  value === null || value === undefined ? 'null' : render(value)

const csBoolean = (value) => (value ? 'true' : 'false')

const deepClone = (value) => JSON.parse(JSON.stringify(value))

const setByPath = (target, dottedPath, value) => {
  const parts = dottedPath.split('.')
  let cursor = target
  for (const part of parts.slice(0, -1)) {
    cursor = cursor[part]
  }
  cursor[parts.at(-1)] = value
}

const findOverride = (snapshot, overrides) => {
  if (!snapshot.overrideId) return undefined
  return overrides.find((override) => override.id === snapshot.overrideId)
}

const overrideAllows = (snapshot, override) => {
  if (!override) return false
  if (override.status !== 'accepted') return false
  if (override.area !== 'accessibility') return false
  if (
    override.component !== 'all' &&
    override.component !== snapshot.component
  ) {
    return false
  }
  if (override.platform !== 'all' && override.platform !== snapshot.platform) {
    return false
  }
  return true
}

const expectedStateValue = (contract, stateName) => {
  const expected = contract.expectedStates?.[stateName]
  return expected === undefined ? null : expected
}

const validateContract = (contract) => {
  const errors = []
  for (const field of requiredContractFields) {
    if (!(field in contract)) {
      errors.push(`${contract.id} contract missing ${field}`)
    }
  }
  if (!Array.isArray(contract.keyboardNavigation)) {
    errors.push(`${contract.id} keyboardNavigation must be an array`)
  }
  return errors
}

const validateSnapshot = (contract, snapshot, overrides) => {
  const errors = []
  const allowedByOverride = []
  const override = findOverride(snapshot, overrides)

  if (snapshot.overrideId && !override) {
    errors.push(
      `${snapshot.id} unregistered accessibility override ${snapshot.overrideId}`,
    )
  }
  if (snapshot.overrideId && override && !overrideAllows(snapshot, override)) {
    errors.push(
      `${snapshot.id} accessibility override ${snapshot.overrideId} does not apply`,
    )
  }
  if (snapshot.evidenceSource === 'visual-only') {
    errors.push(`${snapshot.id} automation evidence required`)
  }
  if (snapshot.evidenceSource !== 'declared-expectation') {
    errors.push(
      `${snapshot.id} static snapshot must be labeled declared-expectation`,
    )
  }
  if (
    !snapshot.evidenceArtifact?.startsWith(
      'tests/conformance/accessibility/artifacts/',
    )
  ) {
    errors.push(
      `${snapshot.id} evidence artifact must use deterministic accessibility path`,
    )
  }
  if (snapshot.role !== contract.role) {
    if (overrideAllows(snapshot, override)) {
      allowedByOverride.push({
        field: 'role',
        expected: contract.role,
        actual: snapshot.role,
        overrideId: override.id,
      })
    } else {
      errors.push(
        `${snapshot.id} wrong role: expected ${contract.role}, got ${snapshot.role}`,
      )
    }
  }
  if (
    contract.accessibleName === 'required' &&
    !String(snapshot.accessibleName ?? '').trim()
  ) {
    errors.push(`${snapshot.id} missing accessible name`)
  }
  if (contract.value === 'required' && snapshot.value === undefined) {
    errors.push(`${snapshot.id} missing value`)
  }

  for (const field of [
    'disabled',
    'selected',
    'checked',
    'expanded',
    'invalid',
  ]) {
    const contractField = `${field}State`
    if (contract[contractField] !== 'required') continue
    const expected = expectedStateValue(contract, field)
    if (snapshot.states?.[field] !== expected) {
      errors.push(
        `${snapshot.id} wrong state ${field}: expected ${expected}, got ${snapshot.states?.[field]}`,
      )
    }
  }

  for (const key of contract.keyboardNavigation) {
    if (!snapshot.keyboard?.includes(key)) {
      errors.push(`${snapshot.id} missing keyboard navigation ${key}`)
    }
  }
  if (!snapshot.keyboardOperable) {
    errors.push(`${snapshot.id} non-keyboard-operable control`)
  }

  return {
    id: snapshot.id,
    component: snapshot.component,
    platform: snapshot.platform,
    role: snapshot.role,
    accessibleName: snapshot.accessibleName,
    value: snapshot.value ?? null,
    states: snapshot.states,
    keyboard: snapshot.keyboard,
    tabOrder: snapshot.tabOrder,
    evidenceSource: snapshot.evidenceSource,
    evidenceArtifact: snapshot.evidenceArtifact,
    allowedByOverride,
    passed: errors.length === 0,
    errors,
  }
}

const validateAppiumGates = (snapshotData) => {
  const errors = []
  const gates = snapshotData.appiumReleaseGates ?? []
  for (const platform of ['windows', 'macos']) {
    const gate = gates.find(
      (entry) =>
        entry.platform === platform &&
        entry.runner === 'appium' &&
        entry.status === 'configured',
    )
    if (!gate) {
      errors.push(`${platform} Appium accessibility release gate missing`)
      continue
    }
    if (
      !gate.artifact?.startsWith(
        'tests/conformance/accessibility/artifacts/appium/',
      )
    ) {
      errors.push(`${platform} Appium gate artifact path is not deterministic`)
    }
  }
  return errors
}

const validateTabOrder = (snapshots) => {
  const tabStops = snapshots
    .filter((snapshot) => snapshot.tabOrder !== null)
    .map((snapshot) => snapshot.tabOrder)
  const unique = new Set(tabStops)
  if (unique.size !== tabStops.length) {
    return ['broken tab order: duplicate tabOrder value']
  }
  if (tabStops.some((value) => !Number.isInteger(value) || value < 1)) {
    return ['broken tab order: tabOrder must be a positive integer']
  }
  return []
}

const validateData = (contracts, snapshotData, overrides) => {
  const contractMap = new Map(
    contracts.controls.map((contract) => [contract.id, contract]),
  )
  const contractErrors = contracts.controls.flatMap(validateContract)
  const snapshotResults = []
  const errors = [...contractErrors, ...validateAppiumGates(snapshotData)]

  for (const contract of contracts.controls) {
    const evidence = snapshotData.snapshots.find(
      (snapshot) => snapshot.component === contract.id,
    )
    if (!evidence) {
      errors.push(`${contract.id} automation evidence required`)
    }
  }

  for (const snapshot of snapshotData.snapshots) {
    const contract = contractMap.get(snapshot.component)
    if (!contract) {
      errors.push(
        `${snapshot.id} references unknown component ${snapshot.component}`,
      )
      continue
    }
    const result = validateSnapshot(contract, snapshot, overrides)
    snapshotResults.push(result)
    errors.push(...result.errors)
  }
  errors.push(...validateTabOrder(snapshotData.snapshots))

  return {
    snapshotResults,
    errors,
  }
}

const runtimeFactoryControls = new Set([
  'FsusAlert',
  'FsusButton',
  'FsusCheckbox',
  'FsusDataTable',
  'FsusDialog',
  'FsusDrawer',
  'FsusDropdown',
  'FsusForm',
  'FsusIconButton',
  'FsusImageViewer',
  'FsusInboxLayout',
  'FsusInput',
  'FsusInputNumber',
  'FsusLink',
  'FsusMarkdownEditor',
  'FsusMenu',
  'FsusMessageBox',
  'FsusMetricList',
  'FsusPerceptionChallenge',
  'FsusPerceptionCharacterChallenge',
  'FsusPopconfirm',
  'FsusPopover',
  'FsusPublicShell',
  'FsusRadio',
  'FsusResponsiveCollection',
  'FsusSettingsSection',
  'FsusSiteHeader',
  'FsusSwitch',
  'FsusTableV2',
  'FsusTabs',
  'FsusTextEditor',
  'FsusTextarea',
  'FsusTextViewer',
  'FsusThemeModeToggle',
  'FsusTooltip',
  'FsusTree',
  'FsusTreeTable',
  'FsusVirtualList',
])

const runtimeGovernanceValid = (entry, context, errors) => {
  for (const field of ['reason', 'owner', 'testPolicy', 'reviewAfter']) {
    if (typeof entry?.[field] !== 'string' || !entry[field].trim()) {
      errors.push(`${context} missing ${field}`)
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry?.reviewAfter ?? '')) {
    errors.push(`${context} reviewAfter must be YYYY-MM-DD`)
  }
}

const validateRootAccessibilityStage = (source) => {
  const required =
    "run('execution:avalonia-accessibility', 'pnpm', ['run', 'a11y:runtime'])"
  return source.split(required).length === 2
    ? []
    : [
        'root conformance must execute the Avalonia accessibility runtime stage exactly once',
      ]
}

const resolveRuntimeScenarios = (
  snapshotData,
  runtimeData,
  contractRegistry,
) => {
  const errors = []
  if (runtimeData.schemaVersion !== 2) {
    errors.push('Avalonia runtime scenario schemaVersion must be 2')
  }
  if (runtimeData.coverage !== 'all-declared-snapshots') {
    errors.push(
      'Avalonia runtime coverage must include all declared accessibility snapshots',
    )
  }
  const contractBindings = new Map()
  for (const binding of runtimeData.contractBindings ?? []) {
    const context = `runtime contract binding ${binding?.snapshotId ?? '<unknown>'}`
    if (
      typeof binding?.snapshotId !== 'string' ||
      !snapshotData.snapshots.some(
        (snapshot) => snapshot.id === binding.snapshotId,
      )
    ) {
      errors.push(`${context} references unknown snapshot`)
    }
    if (contractBindings.has(binding?.snapshotId)) {
      errors.push(`${context} is duplicated`)
    }
    if (typeof binding?.contractId !== 'string' || !binding.contractId) {
      errors.push(`${context} missing contractId`)
    }
    contractBindings.set(binding?.snapshotId, binding?.contractId)
  }
  const bindingGaps = new Map()
  for (const gap of runtimeData.bindingGaps ?? []) {
    const context = `runtime binding gap ${gap?.snapshotId ?? '<unknown>'}`
    if (
      typeof gap?.snapshotId !== 'string' ||
      !snapshotData.snapshots.some((snapshot) => snapshot.id === gap.snapshotId)
    ) {
      errors.push(`${context} references unknown snapshot`)
    }
    if (bindingGaps.has(gap?.snapshotId)) {
      errors.push(`${context} is duplicated`)
    }
    runtimeGovernanceValid(gap, context, errors)
    bindingGaps.set(gap?.snapshotId, gap)
  }
  const implementationGaps = new Map()
  runtimeGovernanceValid(
    {
      ...runtimeData.implementationGapPolicy,
      reason: 'Generated from each exact observed field disposition.',
    },
    'runtime implementation gap policy',
    errors,
  )
  const expandedImplementationGaps = Object.entries(
    runtimeData.implementationGapObservations ?? {},
  ).flatMap(([snapshotId, observations]) =>
    Object.entries(observations).map(([field, observed]) => {
      const control = snapshotData.snapshots.find(
        (snapshot) => snapshot.id === snapshotId,
      )?.control
      return {
        snapshotId,
        field,
        observed,
        reason:
          observed === null
            ? `The current ${control} AutomationPeer does not expose ${field}.`
            : `The current ${control} AutomationPeer exposes ${JSON.stringify(observed)} instead of the declared value for ${field}.`,
        ...runtimeData.implementationGapPolicy,
      }
    }),
  )
  for (const gap of expandedImplementationGaps) {
    const context = `runtime implementation gap ${gap?.snapshotId ?? '<unknown>'}.${gap?.field ?? '<unknown>'}`
    if (
      typeof gap?.snapshotId !== 'string' ||
      !snapshotData.snapshots.some((snapshot) => snapshot.id === gap.snapshotId)
    ) {
      errors.push(`${context} references unknown snapshot`)
    }
    if (
      typeof gap?.field !== 'string' ||
      ![
        'role',
        'name',
        'value',
        'selection',
        'caret',
        'tree.children',
        'tree.roles',
        'focus.tabOrder',
        'states.disabled',
        'states.selected',
        'states.checkedState',
        'states.expanded',
        'states.invalid',
      ].includes(gap.field)
    ) {
      errors.push(`${context} uses unsupported field`)
    }
    if (!Object.hasOwn(gap ?? {}, 'observed')) {
      errors.push(`${context} missing observed`)
    }
    runtimeGovernanceValid(gap, context, errors)
    const key = `${gap?.snapshotId}:${gap?.field}`
    if (implementationGaps.has(key)) {
      errors.push(`${context} is duplicated`)
    }
    implementationGaps.set(key, gap)
  }

  const scenarios = snapshotData.snapshots.map((snapshot) => {
    const context = `runtime scenario avalonia-${snapshot.id}`
    if (!runtimeFactoryControls.has(snapshot.control)) {
      errors.push(`${context} has no explicit production-control factory`)
    }
    const matches = contractRegistry.contracts.filter(
      (contract) =>
        contract.bindings?.avalonia?.status === 'bound' &&
        contract.bindings.avalonia.type?.split('.').at(-1) === snapshot.control,
    )
    const exactMatches = matches.filter((contract) =>
      contract.scenarioIds?.some((scenarioId) => scenarioId.endsWith('.a11y')),
    )
    const preferredContractId = contractBindings.get(snapshot.id)
    const preferred = preferredContractId
      ? exactMatches.find((contract) => contract.id === preferredContractId)
      : null
    if (preferredContractId && !preferred) {
      errors.push(`${context} explicit Contract V2 binding is invalid`)
    }
    if (exactMatches.length > 1 && !preferred) {
      errors.push(`${context} has ambiguous Contract V2 accessibility bindings`)
    }
    const contract = preferred ?? exactMatches[0]
    const bindingGap = bindingGaps.get(snapshot.id)
    if (contract && bindingGap) {
      errors.push(`${context} has a stale Contract V2 binding gap`)
    } else if (!contract && !bindingGap) {
      errors.push(`${context} is missing a Contract V2 binding gap`)
    }
    const gaps = [...implementationGaps.values()].filter(
      (gap) => gap.snapshotId === snapshot.id,
    )
    return {
      id: `avalonia-${snapshot.id}`,
      contractId: contract?.id ?? null,
      contractScenarioId:
        contract?.scenarioIds.find((scenarioId) =>
          scenarioId.endsWith('.a11y'),
        ) ?? null,
      checkpoint:
        snapshot.id === 'markdown-editor-atomic'
          ? 'automation-peer-atomic-projection'
          : 'automation-peer-mounted',
      snapshotId: snapshot.id,
      factory: snapshot.control,
      bindingDisposition: contract ? 'exact' : 'unbound',
      bindingGap: bindingGap ?? null,
      implementationGaps: gaps,
    }
  })
  for (const snapshotId of bindingGaps.keys()) {
    if (!scenarios.some((scenario) => scenario.snapshotId === snapshotId)) {
      errors.push(`runtime binding gap ${snapshotId} is orphaned`)
    }
  }
  for (const snapshotId of contractBindings.keys()) {
    if (!scenarios.some((scenario) => scenario.snapshotId === snapshotId)) {
      errors.push(`runtime contract binding ${snapshotId} is orphaned`)
    }
  }
  return { scenarios, errors }
}

const validateRuntimeScenarios = (
  contracts,
  snapshotData,
  runtimeData,
  contractRegistry,
) => {
  const resolved = resolveRuntimeScenarios(
    snapshotData,
    runtimeData,
    contractRegistry,
  )
  const errors = [...resolved.errors]
  const rootRunner = read(rootConformanceRunnerPath)
  const requiredRootStage =
    "run('execution:avalonia-accessibility', 'pnpm', ['run', 'a11y:runtime'])"
  errors.push(...validateRootAccessibilityStage(rootRunner))
  const bypassedRootRunner = rootRunner.replace(requiredRootStage, '')
  if (validateRootAccessibilityStage(bypassedRootRunner).length === 0) {
    throw new Error('root accessibility runtime bypass mutation survived')
  }
  for (const scenario of resolved.scenarios) {
    const contract = contracts.controls.find(
      (entry) =>
        entry.id ===
        snapshotData.snapshots.find(
          (snapshot) => snapshot.id === scenario.snapshotId,
        )?.component,
    )
    for (const gap of scenario.implementationGaps) {
      const contractField =
        {
          role: 'role',
          name: 'accessibleName',
          value: 'value',
          'states.disabled': 'disabledState',
          'states.selected': 'selectedState',
          'states.checkedState': 'checkedState',
          'states.expanded': 'expandedState',
          'states.invalid': 'invalidState',
        }[gap.field] ?? ''
      if (
        contractField !== 'role' &&
        contract?.[contractField] !== 'required'
      ) {
        errors.push(
          `runtime implementation gap ${gap.snapshotId}.${gap.field} is not a required contract field`,
        )
      }
    }
  }
  return errors
}

const applyInvalidMutation = (contracts, snapshotData, mutation) => {
  const nextContracts = deepClone(contracts)
  const nextSnapshots = deepClone(snapshotData)
  const snapshot = nextSnapshots.snapshots.find(
    (entry) => entry.id === mutation.snapshotId,
  )
  if (!snapshot)
    throw new Error(`invalid fixture references ${mutation.snapshotId}`)
  setByPath(snapshot, mutation.path, mutation.value)
  return {
    contracts: nextContracts,
    snapshotData: nextSnapshots,
  }
}

const validateInvalidFixtures = (contracts, snapshotData, overrides) => {
  const invalid = readJson(invalidFixturePath)
  for (const testCase of invalid.cases ?? []) {
    let message = ''
    try {
      const mutated = applyInvalidMutation(
        contracts,
        snapshotData,
        testCase.mutation,
      )
      const result = validateData(
        mutated.contracts,
        mutated.snapshotData,
        overrides,
      )
      message = result.errors.join('\n')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    if (!message.includes(testCase.expectedError)) {
      throw new Error(
        `${testCase.name} expected ${testCase.expectedError}, got ${message || 'success'}`,
      )
    }
  }
}

const renderAutomationReport = (
  contracts,
  snapshotData,
  runtimeScenarios,
  results,
) =>
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedBy,
      sources: [
        {
          path: contractPath,
          sha256: sha256(read(contractPath)),
        },
        {
          path: snapshotPath,
          sha256: sha256(read(snapshotPath)),
        },
        {
          path: runtimeScenarioPath,
          sha256: sha256(read(runtimeScenarioPath)),
        },
      ],
      requiredContractFields,
      summary: {
        controls: contracts.controls.length,
        declaredExpectations: results.length,
        declarationValidationPassed: results.filter((result) => result.passed)
          .length,
        declarationOnlySnapshots: snapshotData.snapshots.filter(
          (snapshot) => snapshot.evidenceSource === 'declared-expectation',
        ).length,
        metadataOnlyGeneratedTests: 0,
        metadataOnlyRuntimeCoverage: 0,
        realRuntimeScenarioDeclarations: runtimeScenarios.length,
        exactContractRuntimeBindings: runtimeScenarios.filter(
          (scenario) => scenario.bindingDisposition === 'exact',
        ).length,
        unboundRuntimeDispositions: runtimeScenarios.filter(
          (scenario) => scenario.bindingDisposition === 'unbound',
        ).length,
        appiumReleaseGates: snapshotData.appiumReleaseGates.length,
        allowedByOverride: results.reduce(
          (count, result) => count + result.allowedByOverride.length,
          0,
        ),
      },
      appiumReleaseGates: snapshotData.appiumReleaseGates,
      declaredExpectations: results.map((result) => ({
        ...result,
        evidenceKind: 'declared-expectation',
        real: false,
        countsAsRuntimeCoverage: false,
      })),
      declaredRuntimeScenarios: runtimeScenarios.map((scenario) => ({
        ...scenario,
        realEvidenceArtifact: runtimeEvidencePath,
        evidenceKind: 'runtime-input-declaration',
        real: false,
        countsAsRuntimeCoverage: false,
        alignmentEligible: false,
      })),
    },
    null,
    2,
  )}\n`

const renderSnapshotArtifact = (snapshot) =>
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedBy,
      evidenceKind: 'declared-expectation',
      real: false,
      countsAsRuntimeCoverage: false,
      snapshot,
    },
    null,
    2,
  )}\n`

const renderAppiumGateArtifact = (gate) =>
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedBy,
      gate,
      requiredForStableRelease: true,
    },
    null,
    2,
  )}\n`

const renderAvaloniaTests = (results, runtimeScenarios) => {
  const resultById = new Map(results.map((result) => [result.id, result]))
  const rows = runtimeScenarios
    .map((scenario) => {
      const result = resultById.get(scenario.snapshotId)
      if (!result) {
        throw new Error(
          `runtime scenario ${scenario.id} references missing ${scenario.snapshotId}`,
        )
      }
      const implementationGaps = (scenario.implementationGaps ?? [])
        .map(
          (gap) =>
            `new AccessibilityRuntimeGap(${[
              csString(gap.field),
              csString(JSON.stringify(gap.observed)),
              csString(gap.reason),
              csString(gap.owner),
              csString(gap.testPolicy),
              csString(gap.reviewAfter),
            ].join(', ')})`,
        )
        .join(', ')
      return `    yield return new AccessibilityRuntimeScenario(${[
        csString(scenario.id),
        csNullable(scenario.contractId, csString),
        csNullable(scenario.contractScenarioId, csString),
        csString(scenario.checkpoint),
        csString(scenario.snapshotId),
        csString(scenario.factory),
        csString(scenario.bindingDisposition),
        csString(result.role),
        csString(result.accessibleName),
        csNullable(result.value, csString),
        csNullable(result.states?.disabled, csBoolean),
        csNullable(result.states?.selected, csBoolean),
        csNullable(result.states?.checked, csBoolean),
        csNullable(result.states?.expanded, csBoolean),
        csNullable(result.states?.invalid, csBoolean),
        result.tabOrder ?? 0,
        `[${implementationGaps}]`,
      ].join(', ')});`
    })
    .join('\n')

  return `// <auto-generated />
// Generated by scripts/accessibility-conformance.mjs. Do not edit manually.
using System.Collections.Generic;
using Avalonia.Headless.XUnit;

namespace FsusUI.Avalonia.HeadlessTests.Generated;

public class AccessibilityConformanceTests
{
  private static IEnumerable<AccessibilityRuntimeScenario> RealScenarios()
  {
${rows}
  }

  [AvaloniaFact]
  public void CapturesRealAutomationPeerEvidence() =>
    AccessibilityRuntimeEvidence.Capture(RealScenarios());
}
`
}

const renderAll = () => {
  const contracts = readJson(contractPath)
  const snapshotData = readJson(snapshotPath)
  const runtimeData = readJson(runtimeScenarioPath)
  const contractRegistry = readJson(
    'spec/components/contracts/v2/contract-v2.json',
  )
  const overrides = collectAccessibilityOverrides()
  validateInvalidFixtures(contracts, snapshotData, overrides)
  const result = validateData(contracts, snapshotData, overrides)
  result.errors.push(
    ...validateRuntimeScenarios(
      contracts,
      snapshotData,
      runtimeData,
      contractRegistry,
    ),
  )
  if (result.errors.length > 0) {
    throw new Error(
      `accessibility conformance failed:\n- ${result.errors.join('\n- ')}`,
    )
  }
  const runtimeScenarios = resolveRuntimeScenarios(
    snapshotData,
    runtimeData,
    contractRegistry,
  ).scenarios

  const files = {
    [outputPaths.report]: renderAutomationReport(
      contracts,
      snapshotData,
      runtimeScenarios,
      result.snapshotResults,
    ),
    [outputPaths.avaloniaTests]: renderAvaloniaTests(
      result.snapshotResults,
      runtimeScenarios,
    ),
  }
  for (const snapshot of snapshotData.snapshots) {
    files[snapshot.evidenceArtifact] = renderSnapshotArtifact(snapshot)
  }
  for (const gate of snapshotData.appiumReleaseGates) {
    files[gate.artifact] = renderAppiumGateArtifact(gate)
  }
  return files
}

const prettierConfig = await resolveConfig(path.join(root, 'package.json'))

const formatGeneratedContent = async (relativePath, content) => {
  if (relativePath.endsWith('.cs')) return content
  return format(content, {
    ...(prettierConfig ?? {}),
    filepath: path.join(root, relativePath),
  })
}

const renderFormatted = async () => {
  const files = renderAll()
  return Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([relativePath, content]) => [
        relativePath,
        await formatGeneratedContent(relativePath, content),
      ]),
    ),
  )
}

const writeFiles = (files) => {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, content)
    console.log(`wrote ${relativePath}`)
  }
}

const checkFiles = (files) => {
  const failures = []
  for (const [relativePath, expected] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath)
    if (!fs.existsSync(absolutePath)) {
      failures.push(`${relativePath} is missing`)
      continue
    }
    if (fs.readFileSync(absolutePath, 'utf8') !== expected) {
      failures.push(`${relativePath} is stale`)
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `Accessibility conformance artifacts are not current:\n${failures.join('\n')}`,
    )
  }
  console.log('Accessibility conformance automation evidence passed.')
}

const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

const runtimeRunnerHash = () => {
  const hash = crypto.createHash('sha256')
  for (const relativePath of [
    generatedBy,
    outputPaths.avaloniaTests,
    runtimeHelperPath,
    runtimeScenarioPath,
    rootConformanceRunnerPath,
  ]) {
    hash.update(fs.readFileSync(path.join(root, relativePath)))
  }
  return hash.digest('hex')
}

const normalizeContractRole = (role) =>
  (
    ({
      'text-input': 'edit',
      spinbutton: 'spinner',
      radio: 'radiobutton',
      tablist: 'tab',
      link: 'hyperlink',
      grid: 'datagrid',
      textbox: 'edit',
    })[role] ?? role
  ).toLowerCase()

const requiredNodeFields = [
  'role',
  'name',
  'description',
  'value',
  'selection',
  'caret',
  'states',
  'liveRegion',
  'logicalParent',
  'children',
  'focus',
]

const validateRuntimeEvidence = (evidenceSet) => {
  const errors = []
  const results = []
  const contracts = readJson(contractPath)
  const snapshotData = readJson(snapshotPath)
  const runtimeData = readJson(runtimeScenarioPath)
  const registry = readJson('spec/components/contracts/v2/contract-v2.json')
  const runtimeScenarios = resolveRuntimeScenarios(
    snapshotData,
    runtimeData,
    registry,
  ).scenarios
  const current = {
    candidate: git('rev-parse', 'HEAD'),
    contractHash: sha256(read('spec/components/contracts/v2/contract-v2.json')),
    webBaselineHash: sha256(read('spec/baselines/vue-current.json')),
    avaloniaBaselineHash: sha256(
      read('spec/avalonia/semantic/FsusUI.Avalonia.semantic.json'),
    ),
    accessibilityContractHash: sha256(read(contractPath)),
    declaredSnapshotHash: sha256(read(snapshotPath)),
    runnerHash: runtimeRunnerHash(),
    scenarioSetHash: sha256(read(runtimeScenarioPath)),
    sourceTreeHash: git('rev-parse', 'HEAD^{tree}'),
    workspaceClean:
      git('status', '--porcelain', '--untracked-files=all') === '',
  }
  if (evidenceSet?.schema !== 'fsusui.accessibility-evidence-set.v2') {
    errors.push('runtime evidence schema invalid')
  }
  if (evidenceSet?.real !== true) {
    errors.push('runtime evidence is metadata-only')
  }
  if (evidenceSet?.legacySnapshotCoverage !== 0) {
    errors.push('legacy snapshot rows must provide zero runtime coverage')
  }
  for (const [field, value] of Object.entries(current)) {
    if (evidenceSet?.identity?.[field] !== value) {
      errors.push(`runtime identity ${field} mismatch`)
    }
  }
  if (current.workspaceClean !== true) {
    errors.push('runtime evidence verifier requires a clean tracked workspace')
  }
  if (!Array.isArray(evidenceSet?.evidence)) {
    errors.push('runtime evidence records missing')
    return { errors, results }
  }
  const evidenceByScenario = new Map(
    evidenceSet.evidence.map((entry) => [
      entry.identity?.runtimeScenario,
      entry,
    ]),
  )
  if (evidenceByScenario.size !== evidenceSet.evidence.length) {
    errors.push('runtime evidence contains duplicate scenario identities')
  }
  for (const scenario of runtimeScenarios) {
    const context = `runtime evidence ${scenario.id}`
    const evidence = evidenceByScenario.get(scenario.id)
    const snapshot = snapshotData.snapshots.find(
      (entry) => entry.id === scenario.snapshotId,
    )
    const contract = contracts.controls.find(
      (entry) => entry.id === snapshot?.component,
    )
    const contractV2 = scenario.contractId
      ? registry.contracts.find((entry) => entry.id === scenario.contractId)
      : null
    if (!evidence || !snapshot || !contract) {
      errors.push(`${context} authority binding missing`)
      continue
    }
    if (
      scenario.bindingDisposition === 'exact' &&
      (!contractV2 ||
        !contractV2.scenarioIds?.includes(scenario.contractScenarioId))
    ) {
      errors.push(`${context} Contract V2 scenario binding missing`)
    }
    if (
      evidence.schema !== 'fsusui.conformance-evidence.v2' ||
      evidence.kind !== 'accessibility-tree' ||
      evidence.platform !== 'avalonia' ||
      evidence.real !== true
    ) {
      errors.push(`${context} is not real Avalonia accessibility evidence`)
    }
    if (
      evidence.alignmentEligible !== false ||
      evidence.coverageScope !== 'avalonia-accessibility-tree-only'
    ) {
      errors.push(`${context} must not promote cross-platform alignment`)
    }
    for (const [field, value] of Object.entries({
      snapshotId: scenario.snapshotId,
      factory: scenario.factory,
      bindingDisposition: scenario.bindingDisposition,
    })) {
      if (evidence.scenarioInput?.[field] !== value) {
        errors.push(`${context} scenario input ${field} mismatch`)
      }
    }
    if (
      evidence.runtime?.realControl !== true ||
      evidence.runtime?.headless !== true ||
      evidence.runtime?.mock !== false
    ) {
      errors.push(`${context} did not construct a real headless control`)
    }
    for (const [field, value] of Object.entries({
      candidate: current.candidate,
      contractHash: current.contractHash,
      webBaselineHash: current.webBaselineHash,
      avaloniaBaselineHash: current.avaloniaBaselineHash,
      accessibilityContractHash: current.accessibilityContractHash,
      declaredSnapshotHash: current.declaredSnapshotHash,
      runtimeScenarioSetHash: current.scenarioSetHash,
      runtimeScenario: scenario.id,
      contractScenario: scenario.contractScenarioId,
      contract: scenario.contractId,
      checkpoint: scenario.checkpoint,
      runnerHash: current.runnerHash,
      sourceTreeHash: current.sourceTreeHash,
      workspaceClean: true,
    })) {
      if (evidence.identity?.[field] !== value) {
        errors.push(`${context} identity ${field} mismatch`)
      }
    }
    for (const [field, value] of Object.entries({
      theme: 'light',
      density: 'default',
      direction: 'ltr',
      motion: 'reduced',
    })) {
      if (evidence.identity?.[field] !== value) {
        errors.push(`${context} identity ${field} mismatch`)
      }
    }
    if (
      typeof evidence.identity?.locale !== 'string' ||
      evidence.identity.locale.length === 0
    ) {
      errors.push(`${context} identity locale missing`)
    }
    if (
      evidence.accessibility?.source !== 'real-avalonia-automation-peer' ||
      evidence.accessibility?.sameExecution !== true
    ) {
      errors.push(`${context} AutomationPeer source binding missing`)
    }
    const nodes = evidence.accessibility?.nodes
    if (!Array.isArray(nodes) || nodes.length === 0) {
      errors.push(`${context} AutomationPeer tree missing`)
      continue
    }
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    if (nodeById.size !== nodes.length) {
      errors.push(`${context} AutomationPeer node ids duplicate`)
    }
    const rootNode = nodeById.get('root')
    if (!rootNode) {
      errors.push(`${context} root AutomationPeer node missing`)
      continue
    }
    for (const [index, node] of nodes.entries()) {
      for (const field of requiredNodeFields) {
        if (!Object.hasOwn(node, field)) {
          errors.push(`${context} nodes[${index}].${field} missing`)
        }
      }
      for (const field of [
        'disabled',
        'readOnly',
        'invalid',
        'selected',
        'expanded',
        'checkedState',
      ]) {
        if (!Object.hasOwn(node.states ?? {}, field)) {
          errors.push(`${context} nodes[${index}].states.${field} missing`)
        }
      }
      for (const childId of node.children ?? []) {
        const child = nodeById.get(childId)
        if (!child) {
          errors.push(
            `${context} node ${node.id} references unknown ${childId}`,
          )
        } else if (child.logicalParent !== node.id) {
          errors.push(`${context} node ${childId} logical parent mismatch`)
        }
      }
    }
    const mismatches = []
    const unavailableFields = []
    const problemActual = new Map()
    const mismatch = (field, message, actual) => {
      mismatches.push(message)
      problemActual.set(field, actual)
    }
    const expectedRole = normalizeContractRole(contract.role)
    if (rootNode.role !== expectedRole) {
      mismatch(
        'role',
        `role expected=${expectedRole} actual=${rootNode.role}`,
        rootNode.role,
      )
    }
    if (rootNode.name !== snapshot.accessibleName) {
      mismatch(
        'name',
        `name expected=${JSON.stringify(snapshot.accessibleName)} actual=${JSON.stringify(rootNode.name)}`,
        rootNode.name,
      )
    }
    if (contract.value === 'required' && rootNode.value !== snapshot.value) {
      mismatch(
        'value',
        `value expected=${JSON.stringify(snapshot.value)} actual=${JSON.stringify(rootNode.value)}`,
        rootNode.value,
      )
    }
    for (const field of ['disabled', 'selected', 'expanded', 'invalid']) {
      if (contract[`${field}State`] !== 'required') continue
      const actual = rootNode.states[field]
      const expected = snapshot.states[field]
      if (actual === null || actual === undefined) {
        unavailableFields.push(`states.${field}`)
        problemActual.set(`states.${field}`, actual ?? null)
      } else if (actual !== expected) {
        mismatch(
          `states.${field}`,
          `states.${field} expected=${expected} actual=${actual}`,
          actual,
        )
      }
    }
    if (contract.checkedState === 'required') {
      const actual = rootNode.states.checkedState
      const expected =
        snapshot.states.checked === true
          ? 'on'
          : snapshot.states.checked === false
            ? 'off'
            : null
      if (actual === null || actual === undefined) {
        unavailableFields.push('states.checkedState')
        problemActual.set('states.checkedState', actual ?? null)
      } else if (actual !== expected) {
        mismatch(
          'states.checkedState',
          `states.checkedState expected=${expected} actual=${actual}`,
          actual,
        )
      }
    }
    if (rootNode.focus?.tabOrder !== snapshot.tabOrder) {
      mismatch(
        'focus.tabOrder',
        `focus.tabOrder expected=${snapshot.tabOrder} actual=${rootNode.focus?.tabOrder}`,
        rootNode.focus?.tabOrder ?? null,
      )
    }
    if (scenario.factory === 'FsusMarkdownEditor') {
      if (rootNode.selection === null) {
        mismatch(
          'selection',
          'MarkdownEditor selection peer status missing',
          null,
        )
      }
      if (rootNode.caret === null) {
        mismatch('caret', 'MarkdownEditor caret peer status missing', null)
      }
      if (rootNode.children.length === 0) {
        mismatch(
          'tree.children',
          'MarkdownEditor atomic AutomationPeer children missing',
          [],
        )
      }
      const descendantRoles = nodes.slice(1).map((node) => node.role)
      if (
        !descendantRoles.includes('group') ||
        !descendantRoles.includes('button')
      ) {
        mismatch(
          'tree.roles',
          'MarkdownEditor atomic group/action AutomationPeer tree missing',
          descendantRoles,
        )
      }
    }
    const declaredGaps = new Map(
      (scenario.implementationGaps ?? []).map((gap) => [gap.field, gap]),
    )
    for (const [field, actual] of problemActual) {
      const gap = declaredGaps.get(field)
      if (!gap) {
        errors.push(`${context} problem field ${field} is undeclared`)
      } else if (JSON.stringify(actual) !== JSON.stringify(gap.observed)) {
        errors.push(
          `${context} implementation gap ${field} observed value drift`,
        )
      }
    }
    for (const field of declaredGaps.keys()) {
      if (!problemActual.has(field)) {
        errors.push(`${context} implementation gap ${field} is stale`)
      }
    }
    results.push({
      id: scenario.id,
      contract: scenario.contractId,
      contractScenario: scenario.contractScenarioId,
      bindingDisposition: scenario.bindingDisposition,
      bindingGap: scenario.bindingGap,
      real: true,
      availableFieldsMatch: mismatches.length === 0,
      contractMatch:
        problemActual.size === 0 && scenario.bindingDisposition === 'exact',
      complete:
        problemActual.size === 0 && scenario.bindingDisposition === 'exact',
      unavailableFields,
      implementationGaps: scenario.implementationGaps ?? [],
      mismatches,
      nodeCount: nodes.length,
    })
  }
  if (evidenceByScenario.size !== runtimeScenarios.length) {
    errors.push('runtime evidence scenario count does not match declarations')
  }
  return { errors, results }
}

const assertRuntimeMutation = (name, evidence, mutate, expected) => {
  const candidate = deepClone(evidence)
  mutate(candidate)
  const result = validateRuntimeEvidence(candidate)
  if (!result.errors.some((message) => message.includes(expected))) {
    throw new Error(
      `runtime accessibility mutation ${name} survived; expected ${expected}, got ${result.errors.join('; ') || 'success'}`,
    )
  }
}

const verifyRuntimeEvidence = () => {
  const absolutePath = path.join(root, runtimeEvidencePath)
  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `${runtimeEvidencePath} is missing; run the generated Avalonia accessibility test`,
    )
  }
  const evidence = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  const positive = validateRuntimeEvidence(evidence)
  if (positive.errors.length > 0) {
    throw new Error(
      `runtime accessibility evidence failed:\n- ${positive.errors.join('\n- ')}`,
    )
  }
  const find = (candidate, scenarioId) =>
    candidate.evidence.find(
      (entry) => entry.identity.runtimeScenario === scenarioId,
    )
  const mutations = [
    [
      'role-drift',
      (candidate) => {
        candidate.evidence[0].accessibility.nodes[0].role = 'article'
      },
      'problem field role is undeclared',
    ],
    [
      'normalized-role-drift',
      (candidate) => {
        const tabs = find(candidate, 'avalonia-tabs-main')
        tabs.accessibility.nodes[0].role = 'tablist'
      },
      'problem field role is undeclared',
    ],
    [
      'name-drift',
      (candidate) => {
        candidate.evidence[0].accessibility.nodes[0].name = 'Fixture name'
      },
      'problem field name is undeclared',
    ],
    [
      'state-drift',
      (candidate) => {
        candidate.evidence[0].accessibility.nodes[0].states.disabled = true
      },
      'problem field states.disabled is undeclared',
    ],
    [
      'tab-order-drift',
      (candidate) => {
        candidate.evidence[0].accessibility.nodes[0].focus.tabOrder = 999
      },
      'problem field focus.tabOrder is undeclared',
    ],
    [
      'tree-drift',
      (candidate) => {
        const markdown = find(candidate, 'avalonia-markdown-editor-atomic')
        markdown.accessibility.nodes[0].children = []
        markdown.accessibility.nodes.splice(1)
      },
      'problem field tree.children is undeclared',
    ],
    [
      'identity-drift',
      (candidate) => {
        candidate.evidence[0].identity.contractHash = '0'.repeat(64)
      },
      'identity contractHash mismatch',
    ],
    [
      'binding-disposition-drift',
      (candidate) => {
        const unbound = candidate.evidence.find(
          (entry) => entry.scenarioInput.bindingDisposition === 'unbound',
        )
        unbound.scenarioInput.bindingDisposition = 'exact'
      },
      'scenario input bindingDisposition mismatch',
    ],
    [
      'undeclared-required-field',
      (candidate) => {
        const markdown = find(candidate, 'avalonia-markdown-editor-atomic')
        markdown.accessibility.nodes[0].states.invalid = null
      },
      'problem field states.invalid is undeclared',
    ],
    [
      'stale-implementation-gap',
      (candidate) => {
        const form = find(candidate, 'avalonia-form-display-name')
        form.accessibility.nodes[0].role = 'group'
      },
      'implementation gap role is stale',
    ],
    [
      'observed-gap-drift',
      (candidate) => {
        const form = find(candidate, 'avalonia-form-display-name')
        form.accessibility.nodes[0].role = 'pane'
      },
      'implementation gap role observed value drift',
    ],
    [
      'omitted-scenario',
      (candidate) => {
        candidate.evidence.pop()
      },
      'authority binding missing',
    ],
    [
      'duplicate-scenario',
      (candidate) => {
        candidate.evidence.push(deepClone(candidate.evidence[0]))
      },
      'duplicate scenario identities',
    ],
    [
      'unconstructed-control',
      (candidate) => {
        candidate.evidence[0].runtime.realControl = false
      },
      'did not construct a real headless control',
    ],
  ]
  for (const [name, mutate, expected] of mutations) {
    assertRuntimeMutation(name, evidence, mutate, expected)
  }
  writeFiles({
    [runtimeVerificationPath]: `${JSON.stringify(
      {
        schema: 'fsusui.accessibility-verification.v2',
        evidence: runtimeEvidencePath,
        identity: evidence.identity,
        realScenarios: positive.results,
        summary: {
          scenarios: positive.results.length,
          complete: positive.results.filter((entry) => entry.complete).length,
          partial: positive.results.filter((entry) => !entry.complete).length,
          metadataOnlyCoverage: 0,
          mutationsKilled: mutations.length,
        },
      },
      null,
      2,
    )}\n`,
  })
  console.log(
    `Accessibility runtime evidence passed: ${positive.results.length} real scenarios; ${mutations.length}/${mutations.length} mutations killed.`,
  )
}

const command = process.argv[2] ?? 'check'

try {
  const files = await renderFormatted()
  if (command === 'generate') writeFiles(files)
  else if (command === 'check') checkFiles(files)
  else if (command === 'runtime-check') {
    checkFiles(files)
    verifyRuntimeEvidence()
  } else
    throw new Error(
      'Usage: node scripts/accessibility-conformance.mjs <generate|check|runtime-check>',
    )
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
