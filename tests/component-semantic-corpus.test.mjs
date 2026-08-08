import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import {
  assertCaseKilled,
  assertPositiveGreen,
  planVisualScenarios,
  renderRequirementsFor,
  runCorpus,
  verifyCorpusCoverage,
} from '../scripts/check-component-semantic-corpus.mjs'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const fixtureRoot = join(
  repositoryRoot,
  'tests/fixtures/component-semantic-rules',
)
const registryPath = join(
  repositoryRoot,
  'spec/components/component-surface-semantic-registry.json',
)

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

let corpusPromise
const getCorpus = () => {
  corpusPromise ??= readJson(join(fixtureRoot, 'corpus.json'))
  return corpusPromise
}

let reportPromise
const getReport = () => {
  reportPromise ??= runCorpus({
    candidateIdentity: {
      repository: 'Ozwasyd/FsusUI',
      revision: 'candidate-head',
    },
  })
  return reportPromise
}

test('CSC-403-01 corpus manifest maps every issue 293 through 310 to real mutations', async () => {
  const [corpus, registry] = await Promise.all([
    getCorpus(),
    readJson(registryPath),
  ])
  assert.equal(corpus.schemaVersion, 'fsusui.component-semantic-corpus.v1')
  assert.equal(corpus.issue, 403)
  assert.equal(registry.rules.length, 45)
  assert.deepEqual(
    corpus.issueCoverage.map(({ issue }) => issue),
    Array.from({ length: 18 }, (_, index) => index + 293),
  )
  await verifyCorpusCoverage(corpus, registry)
  const namedInjections = new Set(
    corpus.cases
      .filter((corpusCase) => corpusCase.injection)
      .map((corpusCase) => corpusCase.injection),
  )
  for (const injection of [
    '12px option row',
    '44px option row',
    '12px tree row',
    '12px date cell',
    'neutral-only selected option',
    'Rate uses primary/selection token',
    'ancestor opacity disabled',
    '11px uppercase table header',
    'transition:none under reduced motion',
    'legacy scaleX(0) enter motion',
    'legacy list motion overtravel',
  ]) {
    assert.ok(namedInjections.has(injection), `missing ${injection}`)
  }
})

test('CSC-403-02 every negative mutation is killed by its unique locatable rule in an isolated compiled cascade', async () => {
  const report = await getReport()
  const corpus = await getCorpus()
  assert.equal(report.cases.length, corpus.cases.length)
  for (const corpusCase of report.cases) {
    assert.equal(corpusCase.killed, true, `${corpusCase.id} was not killed`)
    assert.ok(corpusCase.failures.length > 0)
    for (const failure of corpusCase.failures) {
      assert.equal(failure.ruleId, corpusCase.ruleId)
      assert.equal(
        failure.actual.source.path,
        `mutations/${corpusCase.mutation}`,
      )
      assert.equal(failure.actual.source.owner.kind, 'implementation')
      assert.ok(failure.selector)
      assert.ok(failure.scope?.theme)
      assert.ok(failure.scope?.density)
      assert.ok(failure.scope?.media)
      assert.ok(failure.expected?.canonicalReference)
      assert.ok(failure.actual.value)
    }
  }
})

test('CSC-403-03 positive fixtures stay green', async () => {
  const report = await getReport()
  const corpus = await getCorpus()
  assert.equal(report.positiveFixtures.length, corpus.positiveFixtures.length)
  for (const positive of report.positiveFixtures) {
    assert.equal(positive.green, true, `${positive.id} was killed`)
    assert.deepEqual(positive.failures, [])
  }
})

test('CSC-403-04 static unknowns become blocking visual scenarios bound to canonical rules and candidate identity', async () => {
  const [report, registry, corpus] = await Promise.all([
    getReport(),
    readJson(registryPath),
    getCorpus(),
  ])
  const baseline = report.baseline
  assert.ok(baseline.staticUnknowns.length > 0)
  const scenarios = planVisualScenarios({
    analysis: baseline,
    candidateIdentity: report.candidateIdentity,
    registry,
  })
  assert.equal(scenarios.length, baseline.staticUnknowns.length)
  const scenarioByRule = new Map(
    scenarios.map((scenario) => [scenario.ruleId, scenario]),
  )
  assert.equal(scenarioByRule.size, scenarios.length, 'duplicate scenario ids')
  for (const unknown of baseline.staticUnknowns) {
    const scenario = scenarioByRule.get(unknown.ruleId)
    assert.ok(scenario, `${unknown.ruleId} has no scenario`)
    assert.equal(scenario.status, 'blocking')
    assert.equal(scenario.componentId, unknown.componentId)
    assert.equal(scenario.partId, unknown.partId)
    assert.equal(scenario.ruleId, unknown.ruleId)
    assert.ok(scenario.selector)
    assert.ok(scenario.scope?.theme)
    assert.deepEqual(scenario.states, [
      'default',
      'hover',
      'focus-visible',
      'disabled',
    ])
    assert.ok(scenario.themes.includes('light'))
    assert.ok(scenario.viewports.length > 0)
    assert.ok(scenario.viewports.every((viewport) => viewport.width > 0))
    assert.ok(scenario.zooms.length > 0)
    assert.ok(scenario.inputs.length > 0)
    assert.ok(scenario.expectedSemanticEvidence.length > 0)
    assert.deepEqual(scenario.candidateIdentity, {
      repository: 'Ozwasyd/FsusUI',
      revision: 'candidate-head',
    })
    assert.ok(scenario.renderRequirements.length >= 1)
    const rule = registry.rules.find(
      ({ componentId, partId }) =>
        componentId === scenario.componentId && partId === scenario.partId,
    )
    assert.ok(rule)
    assert.deepEqual(
      scenario.renderRequirements,
      renderRequirementsFor(rule, unknown),
    )
  }
  const roleToScenario = new Map(
    scenarios.map((scenario) => [scenario.ruleId, scenario]),
  )
  for (const required of [
    'card-stack',
    'motif-repetition',
    'focus-selected-layering',
    'range-continuity',
    'semantic-evidence-capture',
  ]) {
    assert.ok(
      scenarios.some((scenario) =>
        scenario.renderRequirements.some(({ id }) => id === required),
      ),
      `no scenario carries ${required} render requirement`,
    )
  }
  assert.ok(roleToScenario.has('web.dialog.overlay-root'))
  assert.equal(corpus.nonGoals.length, 6)
})

test('CSC-403-05 mutation runs leave the worktree clean', async () => {
  const report = await getReport()
  assert.equal(report.worktreeClean, true)
})

test('CSC-403-06 negative corpus detects a weakened checker and an unchecked compiled cascade', async () => {
  const [corpus, report] = await Promise.all([getCorpus(), getReport()])
  const registry = await readJson(registryPath)
  const weakened = {
    diagnostics: [],
    staticUnknowns: [],
    compiledCssDigest: '0'.repeat(64),
    registryDigest: '0'.repeat(64),
  }
  const first = corpus.cases[0]
  assert.throws(
    () => assertCaseKilled(weakened, first),
    /was not killed/u,
    'weakened checker must fail the corpus',
  )
  const notCompiled = {
    ...weakened,
    diagnostics: report.baseline.diagnostics,
  }
  assert.throws(
    () => assertCaseKilled(notCompiled, first),
    /was not killed/u,
    'mutations absent from the compiled cascade must fail the corpus',
  )
  const positive = corpus.positiveFixtures[0]
  const killedPositive = {
    diagnostics: [
      {
        status: 'fail',
        ruleId: positive.ruleId,
        property: 'min-height',
        actual: { source: { path: `mutations/${positive.mutation}` } },
      },
    ],
    staticUnknowns: [],
    compiledCssDigest: '0'.repeat(64),
    registryDigest: '0'.repeat(64),
  }
  assert.throws(
    () => assertPositiveGreen(killedPositive, positive),
    /must stay green/u,
    'killed positive fixture must fail the corpus',
  )
  assert.ok(registry.rules.length === 45)
})
