import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const generatedBy = 'scripts/accessibility-conformance.mjs'
const contractPath = 'tests/conformance/accessibility/contracts.json'
const snapshotPath = 'tests/conformance/accessibility/automation-snapshots.json'
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
  `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`

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

const renderAutomationReport = (contracts, snapshotData, results) =>
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
      ],
      requiredContractFields,
      summary: {
        controls: contracts.controls.length,
        snapshots: results.length,
        passed: results.filter((result) => result.passed).length,
        appiumReleaseGates: snapshotData.appiumReleaseGates.length,
        allowedByOverride: results.reduce(
          (count, result) => count + result.allowedByOverride.length,
          0,
        ),
      },
      appiumReleaseGates: snapshotData.appiumReleaseGates,
      snapshots: results,
    },
    null,
    2,
  )}\n`

const renderSnapshotArtifact = (snapshot) =>
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedBy,
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

const renderAvaloniaTests = (results) => {
  const rows = results
    .map(
      (result) =>
        `    yield return new object[] { ${csString(result.id)}, ${csString(
          result.component,
        )}, ${csString(result.role)}, ${csString(result.accessibleName)}, ${
          result.keyboard.length
        }, ${result.tabOrder ?? 0} };`,
    )
    .join('\n')

  return `// <auto-generated />
// Generated by scripts/accessibility-conformance.mjs. Do not edit manually.
using System.Collections.Generic;

namespace FsusUI.Avalonia.HeadlessTests.Generated;

public class AccessibilityConformanceTests
{
  public static IEnumerable<object[]> AutomationSnapshots()
  {
${rows}
  }

  [Theory]
  [MemberData(nameof(AutomationSnapshots))]
  public void GeneratedAutomationSnapshotHasRequiredSemantics(
    string id,
    string component,
    string role,
    string accessibleName,
    int keyboardCount,
    int tabOrder)
  {
    Assert.False(string.IsNullOrWhiteSpace(id));
    Assert.False(string.IsNullOrWhiteSpace(component));
    Assert.False(string.IsNullOrWhiteSpace(role));
    Assert.False(string.IsNullOrWhiteSpace(accessibleName));
    Assert.True(keyboardCount > 0);
    Assert.True(tabOrder > 0);
  }
}
`
}

const renderAll = () => {
  const contracts = readJson(contractPath)
  const snapshotData = readJson(snapshotPath)
  const overrides = collectAccessibilityOverrides()
  validateInvalidFixtures(contracts, snapshotData, overrides)
  const result = validateData(contracts, snapshotData, overrides)
  if (result.errors.length > 0) {
    throw new Error(
      `accessibility conformance failed:\n- ${result.errors.join('\n- ')}`,
    )
  }

  const files = {
    [outputPaths.report]: renderAutomationReport(
      contracts,
      snapshotData,
      result.snapshotResults,
    ),
    [outputPaths.avaloniaTests]: renderAvaloniaTests(result.snapshotResults),
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

const command = process.argv[2] ?? 'check'

try {
  const files = await renderFormatted()
  if (command === 'generate') writeFiles(files)
  else if (command === 'check') checkFiles(files)
  else
    throw new Error(
      'Usage: node scripts/accessibility-conformance.mjs <generate|check>',
    )
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
