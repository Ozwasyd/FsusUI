import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  deriveAlignment,
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
        owner: 'FsusUI Core',
        scenarioIds: ['scenario.partial.input.value', 'scenario.partial.a11y'],
        bindings: { avalonia: { status: 'bound' } },
        coverage: { missing: 1, partial: 0 },
        inputs: [
          {
            kind: 'input',
            name: 'value',
            status: 'missing',
            scenarioIds: ['scenario.partial.input.value'],
            governance: {
              reason: 'No matching real Avalonia public member.',
              owner: 'FsusUI Core',
              testPolicy: 'contract',
              reviewPolicy: 'pr-review',
            },
          },
        ],
        requirements: {
          a11y: ['The control must expose an accessible name and role.'],
        },
      },
    ],
  }
  const alignment = deriveAlignment(registry)
  assert.equal(alignment.statuses[0].status, 'partial')
  assert.deepEqual(alignment.gaps[0], {
    contract: 'partial',
    status: 'partial',
    reason: 'No matching real Avalonia public member.',
    owner: 'FsusUI Core',
    requiredMembers: [
      {
        kind: 'input',
        name: 'value',
        status: 'missing',
        reason: 'No matching real Avalonia public member.',
        owner: 'FsusUI Core',
        testPolicy: 'contract',
        reviewPolicy: 'pr-review',
        scenarioIds: ['scenario.partial.input.value'],
      },
    ],
    requiredScenarios: [
      'scenario.partial.input.value',
      'scenario.partial.a11y',
    ],
    requiredEvidence: [
      'required-member-coverage',
      'same-identity-a11y-evidence',
      'same-identity-cross-platform-comparison',
    ],
    evidencePolicy: {
      realExecution: true,
      allowSkip: false,
      allowOverrideWithoutGovernance: false,
    },
    missingMembers: 1,
    partialMembers: 0,
    missingArtifacts: [
      'required-member-coverage',
      'same-identity-a11y-evidence',
      'same-identity-cross-platform-comparison',
    ],
  })
  assert.throws(
    () => validateReadiness({ ...alignment, stable: ['partial'] }),
    /is partial/,
  )

  const compared = deriveAlignment(registry, {
    verdict: 'pass',
    identity: { contract: 'partial' },
  })
  assert.deepEqual(compared.gaps[0].missingArtifacts, [
    'required-member-coverage',
  ])
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
