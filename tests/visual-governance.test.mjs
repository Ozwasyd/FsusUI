import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = (relative) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
const clone = (value) => JSON.parse(JSON.stringify(value))
const registryFixture = () =>
  clone(
    readJson(
      'tests/fixtures/component-surface-semantic-registry/valid-registry.json',
    ),
  )
const loadRegistrySubject = () =>
  import('../scripts/check-component-surface-semantic-registry.mjs')
const loadGate = () => import('../scripts/check-visual-governance.mjs')
const loadReportSchema = () =>
  clone(readJson('spec/components/visual-governance-report.schema.json'))
const reportSchemaWithoutEvidenceMinimum = () => {
  const schema = loadReportSchema()
  delete schema.$defs.scenario.properties.expectedSemanticEvidence.minItems
  return schema
}
const reportSchemaAllowingDirtyWorktree = () => {
  const schema = loadReportSchema()
  schema.properties.worktreeClean = { type: 'boolean' }
  return schema
}

const revision = 'a'.repeat(40)
const candidateIdentity = {
  repository: 'Ozwasyd/FsusUI',
  revision,
}
const scenarioIdentity = clone(candidateIdentity)

const validAllowlistEntry = (registry) => {
  const rule = registry.rules[0]
  const selector = rule.selectorOwnership.selectors.find(
    ({ platform }) => platform === 'web',
  )
  return {
    ruleId: rule.id,
    component: rule.componentId,
    part: rule.partId,
    selector: selector.selector,
    file: selector.source.path,
    reason: 'temporary known deviation tracked by issue 404 governance',
    owner: { id: 'fsusui.web.vue', kind: 'implementation' },
    testPolicy: 'covered by the semantic mutation corpus negative case',
    reviewAfter: '2099-01-01',
    removalCondition: 'removed when the canonical token lands',
  }
}

const expectRegistryRejected = async (registry, expectedCode) => {
  const subject = await loadRegistrySubject()
  const assets = await subject.loadComponentSurfaceSemanticRegistry({
    root,
    registryPath:
      'tests/fixtures/component-surface-semantic-registry/valid-registry.json',
  })
  await assert.rejects(
    subject.validateComponentSurfaceSemanticRegistry({
      ...assets,
      registry,
      root,
    }),
    (error) =>
      error instanceof subject.SemanticRegistryContractError &&
      error.code === expectedCode,
  )
}

const scenario = (overrides = {}) => ({
  scenarioId: 'web.select.option-row.light.default',
  status: 'blocking',
  componentId: 'web.select',
  partId: 'option-row',
  ruleId: 'web.select.option-row',
  selector: '.el-select-dropdown__item',
  scope: { theme: 'light', density: 'default', media: 'screen' },
  fields: ['height'],
  verificationRequirement: 'visual-evidence-required',
  reasonCode: 'static-value-unknown',
  states: ['default'],
  themes: ['light'],
  viewports: [{ id: 'desktop', width: 1280, height: 800 }],
  zooms: [1],
  inputs: ['mouse'],
  expectedSemanticEvidence: [
    {
      sourceId: 'token-contract',
      path: 'spec/tokens/tokens.json',
      pointer: '/tokens/density.select.option.y',
    },
  ],
  renderRequirements: [],
  candidateIdentity: clone(scenarioIdentity),
  ...overrides,
})

const corpus = (overrides = {}) => ({
  candidateIdentity: clone(candidateIdentity),
  baseline: {
    compiledCssDigest: 'c'.repeat(64),
    registryDigest: 'd'.repeat(64),
    diagnostics: [
      {
        ruleId: 'web.select.option-row',
        componentId: 'web.select',
        partId: 'option-row',
        surfaceRole: 'overlay.option-row',
        selector: '.el-select-dropdown__item',
        scope: { theme: 'light', density: 'default', media: 'screen' },
        property: 'height',
        status: 'fail',
        expected: {
          canonicalReference: {
            sourceId: 'token-contract',
            path: 'spec/tokens/tokens.json',
            pointer: '/tokens/density.select.option.y',
          },
        },
        actual: {
          source: {
            path: 'vue/packages/theme-chalk/src/select-dropdown.scss',
            line: 12,
            column: 3,
            owner: { id: 'fsusui.web.vue', kind: 'implementation' },
          },
          value: '36px',
        },
      },
    ],
    staticUnknowns: [],
  },
  cases: [
    {
      id: 'negative-01',
      mutation: 'negative-01.scss',
      ruleId: 'web.select.option-row',
      killed: true,
      failures: [],
    },
  ],
  positiveFixtures: [
    {
      id: 'positive-01',
      mutation: 'positive-01.scss',
      ruleId: 'web.select.option-row',
      green: true,
      failures: [],
    },
  ],
  scenarios: [scenario()],
  worktreeClean: true,
  ...overrides,
})

const expectGateRejected = async (subject, report, schema, expectedCode) => {
  await assert.rejects(
    async () => subject.validateVisualGovernanceReport(report, schema),
    (error) =>
      error instanceof subject.VisualGovernanceError &&
      error.code === expectedCode,
  )
}

test('T404-00 acceptance mapping freezes issue 404 gate boundaries', async () => {
  const gate = await loadGate()
  const packageJson = readJson('package.json')
  const quality = fs.readFileSync(
    path.join(root, '.github/workflows/_quality.yml'),
    'utf8',
  )
  assert.equal(
    packageJson.scripts['check:visual-governance'],
    'node ./scripts/with-node-heap.mjs node ./scripts/check-visual-governance.mjs',
  )
  assert(
    packageJson.scripts['governance:check'].includes('check:visual-governance'),
  )
  const governanceStep = quality
    .split(/\n(?=\s*- name:)/u)
    .find((block) => block.includes('pnpm run governance:check'))
  assert(governanceStep, 'static-quality must run governance:check')
  assert(
    !governanceStep.includes('continue-on-error'),
    'the governance gate must not be skippable',
  )
  assert(
    gate.VisualGovernanceError &&
      typeof gate.buildVisualGovernanceReport === 'function' &&
      typeof gate.validateVisualGovernanceReport === 'function',
    'gate exports report builder and validator',
  )
})

test('T404-01 allowlist entries require every governance field and exact owned targets', async () => {
  const registry = registryFixture()
  const entry = validAllowlistEntry(registry)
  for (const field of [
    'ruleId',
    'component',
    'part',
    'selector',
    'file',
    'reason',
    'owner',
    'testPolicy',
    'reviewAfter',
    'removalCondition',
  ]) {
    const missing = clone(registry)
    missing.allowlist = [{ ...entry }]
    if (field === 'owner') {
      delete missing.allowlist[0].owner
    } else {
      delete missing.allowlist[0][field]
    }
    await expectRegistryRejected(missing, 'registry-allowlist-entry-invalid')
  }
  const expired = registryFixture()
  expired.allowlist = [{ ...entry, reviewAfter: '2000-01-01' }]
  await expectRegistryRejected(expired, 'registry-allowlist-expired')
  const permanent = registryFixture()
  permanent.allowlist = [{ ...entry, removalCondition: 'permanent exception' }]
  await expectRegistryRejected(
    permanent,
    'registry-allowlist-permanent-exception',
  )
  const noPolicy = registryFixture()
  noPolicy.allowlist = [{ ...entry, testPolicy: 'none' }]
  await expectRegistryRejected(
    noPolicy,
    'registry-allowlist-test-policy-required',
  )
  const broad = registryFixture()
  broad.allowlist = [{ ...entry, component: 'web.*' }]
  await expectRegistryRejected(broad, 'registry-allowlist-broad-entry')
  const mismatched = registryFixture()
  mismatched.allowlist = [{ ...entry, part: 'panel' }]
  await expectRegistryRejected(mismatched, 'registry-allowlist-mismatch')
  const unowned = registryFixture()
  unowned.allowlist = [{ ...entry, selector: '.el-unknown__item' }]
  await expectRegistryRejected(unowned, 'registry-allowlist-mismatch')
  const duplicated = registryFixture()
  duplicated.allowlist = [clone(entry), clone(entry)]
  await expectRegistryRejected(duplicated, 'registry-allowlist-duplicate')
  const wildcard = registryFixture()
  wildcard.allowlist = ['*']
  await expectRegistryRejected(wildcard, 'registry-unbounded-allowlist')
})

test('T404-02 structured report binds one candidate and every violation is locatable', async () => {
  const gate = await loadGate()
  const registry = readJson(
    'spec/components/component-surface-semantic-registry.json',
  )
  const registrySchema = readJson(
    'spec/components/component-surface-semantic-registry.schema.json',
  )
  const report = await gate.buildVisualGovernanceReport({
    candidateIdentity,
    registry,
    registrySchema,
    corpus: corpus(),
  })
  assert.equal(report.issue, 404)
  assert.equal(report.schemaVersion, 'fsusui.visual-governance-report.v1')
  assert.equal(report.candidate.repository, 'Ozwasyd/FsusUI')
  assert.match(report.candidate.revision, /^[a-f0-9]{40}$/u)
  assert.equal(report.generated.sourceRevision, report.candidate.revision)
  assert.equal(report.digests.algorithm, 'sha256')
  assert.match(report.digests.registry, /^[a-f0-9]{64}$/u)
  assert.match(report.digests.schema, /^[a-f0-9]{64}$/u)
  assert.match(report.digests.checkers.corpus, /^[a-f0-9]{64}$/u)
  assert.equal(report.allowlist.count, registry.allowlist.length)
  const violation = report.baseline.violations[0]
  assert.equal(violation.componentId, 'web.select')
  assert.equal(violation.surfaceRole, 'overlay.option-row')
  assert.equal(violation.selector, '.el-select-dropdown__item')
  assert.equal(violation.reasonCode, null)
  assert.deepEqual(violation.scope, {
    theme: 'light',
    density: 'default',
    media: 'screen',
  })
  assert.equal(
    violation.expected.canonicalReference.pointer,
    '/tokens/density.select.option.y',
  )
  assert.equal(
    violation.actual.source.path,
    'vue/packages/theme-chalk/src/select-dropdown.scss',
  )
  assert.equal(violation.actual.source.line, 12)
  assert.equal(violation.actual.value, '36px')
  assert.equal(report.visualScenarios.total, 1)
  assert.equal(
    report.visualScenarios.scenarios[0].candidateIdentity.revision,
    revision,
  )
  assert.equal(
    gate.validateVisualGovernanceReport(report, loadReportSchema()),
    true,
  )
})

test('T404-03 mutation report proves every negative is killed and positives stay green', async () => {
  const gate = await loadGate()
  const registry = readJson(
    'spec/components/component-surface-semantic-registry.json',
  )
  const base = await gate.buildVisualGovernanceReport({
    candidateIdentity,
    registry,
    registrySchema: readJson(
      'spec/components/component-surface-semantic-registry.schema.json',
    ),
    corpus: corpus(),
  })
  assert.equal(base.mutationSummary.cases.killed, 1)
  assert.equal(base.mutationSummary.cases.notKilled.length, 0)
  assert.equal(base.mutationSummary.positiveFixtures.green, 1)
  const notKilled = clone(base)
  notKilled.mutationSummary.cases.notKilled = ['negative-01']
  await expectGateRejected(
    gate,
    notKilled,
    loadReportSchema(),
    'report-mutation-not-killed',
  )
  const positiveFailed = clone(base)
  positiveFailed.mutationSummary.positiveFixtures.failed = ['positive-01']
  await expectGateRejected(
    gate,
    positiveFailed,
    loadReportSchema(),
    'report-positive-fixture-failed',
  )
})

test('T404-04 missing required visual evidence or candidate identity mismatch fails', async () => {
  const gate = await loadGate()
  const registry = readJson(
    'spec/components/component-surface-semantic-registry.json',
  )
  const base = await gate.buildVisualGovernanceReport({
    candidateIdentity,
    registry,
    registrySchema: readJson(
      'spec/components/component-surface-semantic-registry.schema.json',
    ),
    corpus: corpus(),
  })
  const missingEvidence = clone(base)
  missingEvidence.visualScenarios.scenarios[0].expectedSemanticEvidence = []
  await expectGateRejected(
    gate,
    missingEvidence,
    reportSchemaWithoutEvidenceMinimum(),
    'report-visual-evidence-missing',
  )
  await expectGateRejected(
    gate,
    missingEvidence,
    loadReportSchema(),
    'report-schema-invalid',
  )
  const mismatched = clone(base)
  mismatched.visualScenarios.scenarios[0].candidateIdentity = {
    repository: 'Ozwasyd/FsusUI',
    revision: 'b'.repeat(40),
  }
  await expectGateRejected(
    gate,
    mismatched,
    loadReportSchema(),
    'report-candidate-mismatch',
  )
})

test('T404-05 dirty worktree and generated drift cannot pass the gate', async () => {
  const gate = await loadGate()
  const registry = readJson(
    'spec/components/component-surface-semantic-registry.json',
  )
  const base = await gate.buildVisualGovernanceReport({
    candidateIdentity,
    registry,
    registrySchema: readJson(
      'spec/components/component-surface-semantic-registry.schema.json',
    ),
    corpus: corpus({ worktreeClean: false }),
  })
  assert.equal(base.worktreeClean, false)
  await expectGateRejected(
    gate,
    base,
    reportSchemaAllowingDirtyWorktree(),
    'report-worktree-dirty',
  )
  await expectGateRejected(
    gate,
    base,
    loadReportSchema(),
    'report-schema-invalid',
  )
})

test('T404-06 verify-gates requires the composite gate wiring', () => {
  execFileSync('node', ['scripts/check-verify-gates.mjs'], {
    cwd: root,
    encoding: 'utf8',
  })
})
