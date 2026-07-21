import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createVisualAuditRetryEnvironment,
  validateVisualAuditRetryResults,
} from '../scripts/run-visual-audit-retry-contract.mjs'

const attempt = ({
  durationMs = 1_000,
  parallelIndex,
  retry,
  startTime = '2026-07-21T00:00:00.000Z',
  status,
  title,
}) => ({ durationMs, parallelIndex, retry, startTime, status, title })

const validResults = () => [
  attempt({
    parallelIndex: 0,
    retry: 0,
    status: 'failed',
    title: 'ui audit retry contract / bucket 1 of 2',
  }),
  attempt({
    parallelIndex: 1,
    retry: 0,
    status: 'passed',
    title: 'ui audit retry contract / bucket 2 of 2',
  }),
  attempt({
    parallelIndex: 0,
    retry: 1,
    startTime: '2026-07-21T00:00:02.000Z',
    status: 'passed',
    title: 'ui audit retry contract / bucket 1 of 2',
  }),
]

test('does not forward conflicting color controls to Playwright', () => {
  assert.deepEqual(
    createVisualAuditRetryEnvironment(
      { FORCE_COLOR: '1', NO_COLOR: '1', PATH: '/fixture/bin' },
      { FSUS_VISUAL_PROFILE: 'audit-retry-contract' },
    ),
    {
      FORCE_COLOR: '1',
      FSUS_VISUAL_PROFILE: 'audit-retry-contract',
      PATH: '/fixture/bin',
    },
  )
})

test('accepts one isolated retry with concurrent first attempts', () => {
  assert.deepEqual(validateVisualAuditRetryResults(validResults()), {
    bucketCount: 2,
    resultCount: 3,
  })
})

test('rejects rerunning an unaffected bucket', () => {
  const results = validResults()
  results.push(
    attempt({
      parallelIndex: 1,
      retry: 1,
      status: 'passed',
      title: 'ui audit retry contract / bucket 2 of 2',
    }),
  )
  assert.throws(
    () => validateVisualAuditRetryResults(results),
    /unaffected bucket must run exactly once/u,
  )
})

test('rejects sequential first-attempt execution', () => {
  const results = validResults()
  results[1] = {
    ...results[1],
    startTime: '2026-07-21T00:00:01.500Z',
  }
  assert.throws(
    () => validateVisualAuditRetryResults(results),
    /intervals must overlap/u,
  )
})
