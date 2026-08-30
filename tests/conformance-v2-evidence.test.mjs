import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deriveAlignment,
  validateCoverage,
  validateEvidence,
  validateOverride,
  validateReadiness,
} from '../scripts/conformance-v2-evidence.mjs'
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
