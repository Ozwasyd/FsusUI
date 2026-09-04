import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  deriveAlignment,
  sealExecutionCoverage,
  validateCoverage,
  validateEvidence,
  validateOverride,
  validateReadiness,
} from '../scripts/conformance-v2-evidence.mjs'

import {
  alignmentHash as stableReadinessAlignmentHash,
  currentIdentity as stableReadinessCurrentIdentity,
  readAlignment as stableReadinessReadAlignment,
} from '../scripts/avalonia-stable-readiness-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scenario = (name) => `scenario.v2.${name}.input.value`
const comparisonFor = (name, records = []) => {
  const identity = { contract: `component-v2.${name}` }
  const evidenceDigests = { web: `${name}-web`, avalonia: `${name}-avalonia` }
  return {
    schema: 'fsusui.conformance-comparison.v2',
    verdict: 'pass',
    identity,
    evidenceDigests,
    executionCoverage: sealExecutionCoverage({
      schema: 'fsusui.member-execution-coverage.v2',
      identity,
      real: true,
      evidenceDigests,
      records,
    }),
  }
}

test('evidence rejects headless and fixture-only paths', () => {
  assert.throws(
    () =>
      validateEvidence(
        { schema: 'fsusui.conformance-evidence.v2', identity: {} },
        'avalonia',
      ),
    /identity\.executionId/,
  )
})

test('coverage rejects metadata-only generated tests', () => {
  assert.throws(
    () =>
      validateCoverage({
        requiredMembers: ['document'],
        memberScenarios: { document: ['metadata'] },
        executions: { metadata: { real: false } },
      }),
    /metadata-only/,
  )
})

test('platform overrides require exact governed fields', () => {
  assert.throws(
    () =>
      validateOverride({
        field: 'state.*',
        reason: 'x',
        owner: 'x',
        testPolicy: 'x',
        reviewPolicy: 'x',
      }),
    /broad override/,
  )
})

test('alignment is derived and readiness excludes partial contracts', () => {
  const registry = {
    contracts: [
      {
        id: 'partial',
        bindings: { avalonia: { status: 'bound' } },
        coverage: { missing: 1, partial: 0 },
      },
    ],
  }
  const alignment = deriveAlignment(registry)
  assert.equal(alignment.statuses[0].status, 'partial')
  assert.throws(
    () => validateReadiness({ ...alignment, stable: ['partial'] }),
    /is partial/,
  )
})

test('alignment preserves unbound web-only exports without creating gaps', () => {
  const alignment = deriveAlignment({
    contracts: [
      {
        id: 'component-v2.web-only',
        component: { exportStatus: 'web-only' },
        bindings: { avalonia: { status: 'unbound' } },
        coverage: { missing: 0, partial: 0 },
      },
    ],
  })
  assert.deepEqual(alignment.statuses, [
    {
      id: 'component-v2.web-only',
      status: 'web-only',
      source: 'derived',
    },
  ])
  assert.deepEqual(alignment.gaps, [])
  assert.deepEqual(alignment.stable, [])
})

test('comparison sets align only exact statically complete contracts', () => {
  const contracts = ['first', 'second', 'no-evidence'].map((name) => ({
    id: `component-v2.${name}`,
    component: { exportStatus: 'aligned-candidate' },
    bindings: { avalonia: { status: 'bound' } },
    inputs: [
      {
        name: 'value',
        status: 'aligned-candidate',
        scenarioIds: [scenario(name)],
      },
    ],
    coverage: { missing: 0, partial: 0 },
  }))
  const comparison = {
    schema: 'fsusui.conformance-comparison-set.v2',
    comparisons: ['first', 'second'].map((name) =>
      comparisonFor(name, [
        {
          kind: 'input',
          member: 'value',
          scenarioId: scenario(name),
          webSource: { kind: 'step', index: 0 },
          avaloniaSource: { kind: 'step', index: 0 },
        },
      ]),
    ),
  }
  const alignment = deriveAlignment({ contracts }, comparison)
  assert.deepEqual(alignment.stable, [
    'component-v2.first',
    'component-v2.second',
  ])
  assert.equal(
    alignment.statuses.find((entry) => entry.id === 'component-v2.no-evidence')
      .status,
    'blocked',
  )
  assert.throws(
    () =>
      deriveAlignment(
        { contracts },
        {
          comparisons: [comparison.comparisons[0], comparison.comparisons[0]],
        },
      ),
    /duplicated in comparison set/u,
  )
})

test('alignment blocks an otherwise complete contract with incomplete executed-member coverage', () => {
  const contract = {
    id: 'component-v2.coverage-required',
    component: { exportStatus: 'aligned-candidate' },
    bindings: { avalonia: { status: 'bound' } },
    inputs: [
      {
        name: 'value',
        status: 'aligned-candidate',
        scenarioIds: [scenario('coverage-required')],
      },
    ],
    coverage: { missing: 0, partial: 0 },
  }
  const comparison = comparisonFor('coverage-required')
  const alignment = deriveAlignment({ contracts: [contract] }, comparison)
  assert.equal(alignment.statuses[0].status, 'blocked')
  assert.deepEqual(alignment.gaps[0].missingCoverageMembers, [
    `input:value@${scenario('coverage-required')}`,
  ])
  assert.deepEqual(alignment.gaps[0].missingArtifacts, [
    'required-member-execution-coverage',
  ])
})

test('execution coverage rejects absent, metadata-only, forged, and mutated ledgers', () => {
  const contract = {
    id: 'component-v2.coverage-integrity',
    component: { exportStatus: 'aligned-candidate' },
    bindings: { avalonia: { status: 'bound' } },
    inputs: [],
    coverage: { missing: 0, partial: 0 },
  }
  const comparison = comparisonFor('coverage-integrity')
  const derive = (candidate) =>
    deriveAlignment({ contracts: [contract] }, candidate)

  assert.throws(
    () => derive({ ...comparison, executionCoverage: undefined }),
    /executionCoverage\.schema invalid/u,
  )
  assert.throws(
    () =>
      derive({
        ...comparison,
        executionCoverage: sealExecutionCoverage({
          ...comparison.executionCoverage,
          real: false,
        }),
      }),
    /metadata-only/u,
  )
  assert.throws(
    () =>
      derive({
        ...comparison,
        executionCoverage: sealExecutionCoverage({
          ...comparison.executionCoverage,
          identity: { contract: 'component-v2.forged' },
        }),
      }),
    /identity mismatch/u,
  )
  assert.throws(
    () =>
      derive({
        ...comparison,
        executionCoverage: {
          ...comparison.executionCoverage,
          records: [
            {
              kind: 'input',
              member: 'forged',
              scenarioId: 'scenario.v2.forged',
              webSource: {},
              avaloniaSource: {},
            },
          ],
        },
      }),
    /outputHash invalid/u,
  )
})

test('T762-01 stable readiness rejects missing, stale, and tampered alignment', () => {
  const expected = stableReadinessCurrentIdentity()
  const valid = JSON.parse(
    fs.readFileSync(
      path.join(root, '.tmp/conformance-v2/alignment.json'),
      'utf8',
    ),
  )
  const currentExpected = {
    ...stableReadinessCurrentIdentity(),
    candidate: valid.identity.candidate,
  }

  assert.throws(
    () =>
      stableReadinessReadAlignment('.tmp/conformance-v2/absent.json', expected),
    /is missing; run the governed producer/u,
  )

  assert.throws(
    () =>
      stableReadinessReadAlignment('.tmp/conformance-v2/alignment.json', {
        ...currentExpected,
        contractHash: '0'.repeat(64),
      }),
    /identity contractHash is stale/u,
  )

  assert.throws(
    () =>
      stableReadinessReadAlignment('.tmp/conformance-v2/alignment.json', {
        ...currentExpected,
        candidate: '0'.repeat(40),
      }),
    /identity candidate is stale/u,
  )

  const tampered = {
    ...valid,
    statuses: valid.statuses.slice(0, 1),
    identity: {
      ...valid.identity,
      alignmentHash: stableReadinessAlignmentHash({
        ...valid,
        statuses: valid.statuses.slice(1),
      }),
    },
  }
  const tamperedPath = path.join(os.tmpdir(), 'fsusui-t762-alignment.json')
  fs.writeFileSync(tamperedPath, `${JSON.stringify(tampered, null, 2)}\n`)
  try {
    assert.throws(
      () => stableReadinessReadAlignment(tamperedPath, currentExpected),
      /integrity hash is invalid/u,
    )
  } finally {
    fs.rmSync(tamperedPath, { force: true })
  }
})
