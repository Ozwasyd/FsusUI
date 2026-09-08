#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  evaluateFreshnessEntry,
  extractPullRequestTarget,
  validateExceptionRegistry,
  validateFreshnessException,
} from './dependency-freshness-evaluator.mjs'

const now = '2026-09-07T12:00:00Z'
const entry = {
  id: 'npm-workspace-root',
  datasource: 'npm',
  packageName: 'semver',
}

function exception(overrides = {}) {
  return {
    dependencyId: entry.id,
    datasource: entry.datasource,
    packageName: entry.packageName,
    currentVersion: '1.0.0',
    targetVersion: '2.0.0',
    reason: 'Controlled upgrade deferral',
    evidence: 'https://example.invalid/evidence',
    owner: 'dependency-governance',
    createdAt: '2026-09-01T12:00:00Z',
    expiresAt: '2026-09-15T12:00:00Z',
    ...overrides,
  }
}

assert.deepEqual(
  validateFreshnessException(exception(), {
    entry,
    currentVersion: '1.0.0',
    latestVersion: '2.0.0',
    now,
  }),
  [],
)
assert.ok(
  validateFreshnessException(exception({ expiresAt: '2026-09-15T12:00:01Z' }), {
    entry,
    currentVersion: '1.0.0',
    latestVersion: '2.0.0',
    now,
  }).includes('exception-ttl'),
)
assert.deepEqual(
  validateFreshnessException(
    exception({
      vulnerability: true,
      createdAt: '2026-09-05T12:00:00Z',
      expiresAt: '2026-09-08T12:00:00Z',
    }),
    { entry, currentVersion: '1.0.0', latestVersion: '2.0.0', now },
  ),
  [],
)
assert.ok(
  validateFreshnessException(
    exception({
      vulnerability: true,
      createdAt: '2026-09-05T12:00:00Z',
      expiresAt: '2026-09-08T12:00:01Z',
    }),
    { entry, currentVersion: '1.0.0', latestVersion: '2.0.0', now },
  ).includes('exception-ttl'),
)
const missingOwner = exception()
delete missingOwner.owner
assert.ok(
  validateFreshnessException(missingOwner, {
    entry,
    currentVersion: '1.0.0',
    latestVersion: '2.0.0',
    now,
  }).includes('exception-field:owner'),
)
assert.ok(
  validateFreshnessException(exception({ targetVersion: '1.9.0' }), {
    entry,
    currentVersion: '1.0.0',
    latestVersion: '2.0.0',
    now,
  }).includes('exception-target-version'),
)

const titlePullRequest = {
  title: 'chore(deps): update npm-workspace-root to v2.0.0',
  body: '',
}
assert.equal(extractPullRequestTarget(titlePullRequest, entry), '2.0.0')
assert.equal(
  extractPullRequestTarget(
    {
      title: 'chore(deps): update frontend dependencies',
      body: [
        '| Package | Type | New value |',
        '| --- | --- | --- |',
        '| `semver` | patch | `2.0.0` |',
      ].join('\n'),
    },
    entry,
  ),
  '2.0.0',
)

const unavailable = evaluateFreshnessEntry({
  entry,
  currentVersion: null,
  latestVersion: '2.0.0',
  now,
})
assert.equal(unavailable.state, 'skipped')
assert.ok(unavailable.errors.includes('incomplete-version-evidence'))

const wrongTarget = evaluateFreshnessEntry({
  entry,
  currentVersion: '1.0.0',
  latestVersion: '2.0.0',
  pullRequests: [{ number: 1, title: 'old target', targetVersion: '1.9.0' }],
  now,
})
assert.equal(wrongTarget.state, 'stale')
assert.deepEqual(wrongTarget.blockerReasons, ['pr-target-not-latest'])

const latestTarget = evaluateFreshnessEntry({
  entry,
  currentVersion: '1.0.0',
  latestVersion: '2.0.0',
  pullRequests: [{ number: 2, title: 'latest target', targetVersion: '2.0.0' }],
  now,
})
assert.equal(latestTarget.state, 'latest-target-pr')

const covered = evaluateFreshnessEntry({
  entry,
  currentVersion: '1.0.0',
  latestVersion: '2.0.0',
  exception: exception(),
  now,
})
assert.equal(covered.state, 'exception')
assert.deepEqual(covered.errors, [])

const registry = validateExceptionRegistry(
  { schemaVersion: 1, exceptions: [exception(), exception()] },
  [entry],
  now,
)
assert.ok(registry.errors.includes(`exception-duplicate:${entry.id}`))

console.log('Dependency freshness evaluator tests passed.')
