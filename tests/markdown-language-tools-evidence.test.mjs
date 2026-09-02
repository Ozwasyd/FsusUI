import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(
  root,
  'tests/fixtures/markdown-language-tools/linux-evidence-matrix.json',
)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const REQUIRED_CELL_IDS = [
  'chromium-replacement-routing',
  'chromium-local-rejection',
  'chromium-native-attribute-binding',
  'firefox-replacement-routing',
  'firefox-local-rejection',
  'firefox-native-attribute-binding',
  'webkit-all-cells',
  'ibus-cjk-composition-coexistence',
  'mixed-cjk-latin-source-live',
  'nested-syntax',
  'code-url-local-policy',
  'keyboard-representative-path',
  'orca-at-spi-representative-path',
  'source-live-a11y-accessible-name',
]

const SUCCESS_STATUSES = ['real', 'real-routing-simulated-trigger']
const BLOCKED_STATUSES = [
  'external-blocked',
  'external-blocked-manual',
  'baseline-failed',
]
const ALLOWED_STATUSES = [...SUCCESS_STATUSES, ...BLOCKED_STATUSES]

const findSyntheticTrue = (value, pointer = '$') => {
  const hits = []
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      hits.push(...findSyntheticTrue(entry, `${pointer}/${index}`))
    })
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'synthetic' && entry) {
        hits.push(`${pointer}/${key}`)
      }
      hits.push(...findSyntheticTrue(entry, `${pointer}/${key}`))
    }
  }
  return hits
}

test('evidence manifest matches the declared schema and required structure', () => {
  assert.equal(
    manifest.schema,
    'fsusui-markdown-language-tools.linux-evidence-matrix.v1',
  )
  for (const section of [
    'issues',
    'candidate',
    'host',
    'toolVersions',
    'commands',
    'requiredLinuxCells',
    'optionalOffHostCells',
    'acceptanceChecks',
    'aggregate',
  ]) {
    assert.ok(manifest[section], `manifest.${section} must be present`)
  }
  assert.match(manifest.candidate.baseSha, /^[0-9a-f]{40}$/)
  assert.equal(typeof manifest.candidate.productionCodeChanged, 'boolean')
  for (const key of ['os', 'kernel', 'display']) {
    assert.equal(typeof manifest.host[key], 'string')
    assert.ok(manifest.host[key].length > 0, `host.${key} must be non-empty`)
  }
  assert.equal(typeof manifest.toolVersions.playwright, 'string')
  for (const browser of ['chromium', 'firefox', 'webkit']) {
    assert.ok(
      manifest.toolVersions.playwrightBrowsers[browser],
      `playwrightBrowsers.${browser} must be recorded`,
    )
  }
  for (const browser of ['googleChrome', 'firefox']) {
    assert.ok(
      manifest.toolVersions.systemBrowsers[browser],
      `systemBrowsers.${browser} must be recorded`,
    )
  }
  const commandIds = manifest.commands.map((entry) => entry.id)
  assert.equal(new Set(commandIds).size, commandIds.length, 'command ids unique')
  for (const entry of manifest.commands) {
    for (const field of ['id', 'command', 'result']) {
      assert.equal(typeof entry[field], 'string')
      assert.ok(entry[field].length > 0, `command ${field} must be non-empty`)
    }
  }
})

test('no cell records synthetic evidence', () => {
  assert.deepEqual(findSyntheticTrue(manifest), [])
})

test('every required Linux cell uses the honest status vocabulary with required fields', () => {
  const cells = manifest.requiredLinuxCells
  assert.ok(Array.isArray(cells) && cells.length > 0)
  const ids = cells.map((cell) => cell.id)
  assert.equal(new Set(ids).size, ids.length, 'required cell ids unique')
  for (const cell of cells) {
    assert.ok(
      ALLOWED_STATUSES.includes(cell.status),
      `${cell.id}: unknown status ${JSON.stringify(cell.status)}`,
    )
    for (const field of ['requirement', 'status', 'command', 'result']) {
      assert.equal(typeof cell[field], 'string')
      assert.ok(cell[field].length > 0, `${cell.id}.${field} must be non-empty`)
    }
    assert.equal(typeof cell.realNativeEvidence, 'boolean')
    assert.equal(typeof cell.simulated, 'boolean')
    assert.ok(Array.isArray(cell.artifacts), `${cell.id}.artifacts must exist`)
    if (SUCCESS_STATUSES.includes(cell.status)) {
      assert.equal(
        cell.realNativeEvidence,
        true,
        `${cell.id}: a success status must claim real native evidence`,
      )
    }
    if (cell.status === 'real-routing-simulated-trigger') {
      assert.equal(
        cell.simulated,
        true,
        `${cell.id}: a simulated-trigger cell must declare simulated`,
      )
      for (const field of ['proves', 'doesNotProve', 'platformReason']) {
        assert.equal(typeof cell[field], 'string')
        assert.ok(
          cell[field].length > 0,
          `${cell.id}.${field} must state what the simulation does and does not prove`,
        )
      }
    }
    if (cell.status === 'real') {
      assert.equal(
        cell.simulated,
        false,
        `${cell.id}: a real cell must not be simulated`,
      )
    }
  }
})

test('blocked required cells carry precise blocker text instead of faked success', () => {
  for (const cell of manifest.requiredLinuxCells) {
    if (!BLOCKED_STATUSES.includes(cell.status)) continue
    assert.equal(
      cell.realNativeEvidence,
      false,
      `${cell.id}: a blocked cell must not claim real native evidence`,
    )
    assert.equal(
      typeof cell.platformReason,
      'string',
      `${cell.id}: platformReason must explain the blocker`,
    )
    assert.ok(
      cell.platformReason.length >= 40,
      `${cell.id}: platformReason must be precise`,
    )
    if (cell.status === 'baseline-failed') {
      assert.match(
        `${cell.result} ${cell.platformReason}`,
        /base|pre-existing/i,
        `${cell.id}: a baseline-failed cell must state it fails at base`,
      )
    }
  }
})

test('required-cell coverage matches the #398 acceptance surface', () => {
  const ids = manifest.requiredLinuxCells.map((cell) => cell.id)
  for (const required of REQUIRED_CELL_IDS) {
    assert.ok(
      ids.includes(required),
      `required Linux cell ${required} is missing from the manifest`,
    )
  }
})

// Splits "command-a (detail + detail) + command-b" on top-level '+' only,
// ignoring '+' characters nested inside parentheses such as "focus + Enter".
const splitCommandReferences = (command) => {
  const references = []
  let depth = 0
  let current = ''
  for (const character of command) {
    if (character === '(') depth += 1
    if (character === ')') depth -= 1
    if (character === '+' && depth === 0) {
      references.push(current)
      current = ''
    } else {
      current += character
    }
  }
  references.push(current)
  return references.map((reference) => reference.trim())
}

test('cell command references resolve to recorded commands', () => {
  const commandIds = new Set(manifest.commands.map((entry) => entry.id))
  for (const cell of manifest.requiredLinuxCells) {
    const references = splitCommandReferences(cell.command)
    assert.ok(references.length > 0, `${cell.id}: command must reference work`)
    for (const reference of references) {
      const match = reference.match(/^([a-z0-9-]+)/)
      assert.ok(match, `${cell.id}: unparseable command reference`)
      assert.ok(
        commandIds.has(match[1]),
        `${cell.id}: command reference ${match[1]} is not a recorded command id`,
      )
    }
  }
})

test('optional off-host cells are recorded absent and non-blocking', () => {
  assert.ok(manifest.optionalOffHostCells.length > 0)
  for (const cell of manifest.optionalOffHostCells) {
    for (const field of ['id', 'platform', 'scope', 'reason']) {
      assert.equal(typeof cell[field], 'string')
      assert.ok(cell[field].length > 0, `${cell.id}.${field} must be non-empty`)
    }
    assert.equal(cell.status, 'absent-off-host')
    assert.equal(cell.nonBlocking, true)
  }
})

test('aggregate closure fields are consistent with cell statuses', () => {
  const cells = manifest.requiredLinuxCells
  const blockedIds = cells
    .filter((cell) => BLOCKED_STATUSES.includes(cell.status))
    .map((cell) => cell.id)
  assert.deepEqual(
    manifest.aggregate.externalBlockedRequiredCellIds,
    blockedIds,
  )
  const fullyReal = cells.every((cell) =>
    SUCCESS_STATUSES.includes(cell.status),
  )
  assert.equal(manifest.aggregate.requiredLinuxFullyReal, fullyReal)
  assert.equal(
    manifest.aggregate.syntheticOnlyProhibitsRequiredLinuxClosure,
    true,
  )
  assert.equal(manifest.aggregate.parent292MayClose, false)
  assert.match(manifest.aggregate.parent292Reason, /#292/)
})

test('acceptance checks record a criterion, verdict, and evidence for each', () => {
  for (const issue of ['issue398', 'issue399']) {
    const checks = manifest.acceptanceChecks[issue]
    assert.ok(Array.isArray(checks) && checks.length > 0)
    for (const check of checks) {
      assert.equal(typeof check.criterion, 'string')
      assert.ok(check.criterion.length > 0)
      assert.equal(typeof check.met, 'boolean')
      assert.equal(typeof check.evidence, 'string')
      assert.ok(check.evidence.length > 0)
    }
  }
  const machineVerifiable = manifest.acceptanceChecks.issue398.find(
    (check) => check.criterion === 'evidence manifest is machine-verifiable',
  )
  assert.ok(machineVerifiable, 'machine-verifiable criterion must be recorded')
  assert.equal(machineVerifiable.met, true)
  assert.match(
    machineVerifiable.evidence,
    /markdown-language-tools-evidence\.test\.mjs/,
    'machine-verifiable evidence must cite this validator',
  )
})
