#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  latestStableVersion,
  resolveCurrentVersion,
  resolveLatestVersion,
  SUPPORTED_FRESHNESS_DATASOURCES,
} from './dependency-freshness-adapters.mjs'
import {
  evaluateFreshnessEntry,
  extractPullRequestTarget,
  selectRenovatePullRequests,
  validateExceptionRegistry,
  validateFreshnessException,
} from './dependency-freshness-evaluator.mjs'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const now = '2026-09-07T12:00:00Z'
const entry = {
  id: 'npm-workspace-root',
  datasource: 'npm',
  packageName: 'semver',
}

function exception(overrides = {}) {
  return {
    id: 'npm-workspace-root-20260901',
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

const currentWithException = evaluateFreshnessEntry({
  entry,
  currentVersion: '2.0.0',
  latestVersion: '2.0.0',
  exceptions: [exception({ currentVersion: '2.0.0', targetVersion: '2.0.0' })],
  now,
})
assert.equal(currentWithException.state, 'stale')
assert.ok(
  currentWithException.errors.includes('state-not-exact-one:current,exception'),
)

const pullRequestWithException = evaluateFreshnessEntry({
  entry,
  currentVersion: '1.0.0',
  latestVersion: '2.0.0',
  pullRequests: [{ number: 2, title: 'latest target', targetVersion: '2.0.0' }],
  exceptions: [exception()],
  now,
})
assert.equal(pullRequestWithException.state, 'stale')
assert.ok(
  pullRequestWithException.errors.includes(
    'state-not-exact-one:latest-target-pr,exception',
  ),
)

const currentWithPullRequest = evaluateFreshnessEntry({
  entry,
  currentVersion: '2.0.0',
  latestVersion: '2.0.0',
  pullRequests: [
    { number: 2, title: 'current target', targetVersion: '2.0.0' },
  ],
  now,
})
assert.equal(currentWithPullRequest.state, 'stale')
assert.ok(
  currentWithPullRequest.errors.includes(
    'state-not-exact-one:current,latest-target-pr',
  ),
)

const staleActiveException = evaluateFreshnessEntry({
  entry,
  currentVersion: '1.0.0',
  latestVersion: '2.0.0',
  exceptions: [exception({ currentVersion: '0.9.0' })],
  now,
})
assert.equal(staleActiveException.state, 'stale')
assert.ok(
  staleActiveException.errors.includes(
    'exception-current-stale:npm-workspace-root-20260901',
  ),
)

const registry = validateExceptionRegistry(
  { schemaVersion: 1, exceptions: [exception(), exception()] },
  [entry],
  now,
)
assert.ok(
  registry.errors.includes(
    'exception-duplicate-id:npm-workspace-root-20260901',
  ),
)

const expiredHistory = exception({
  id: 'npm-workspace-root-20260801',
  currentVersion: '0.9.0',
  targetVersion: '1.0.0',
  createdAt: '2026-08-01T12:00:00Z',
  expiresAt: '2026-08-15T12:00:00Z',
})
const renewed = exception({ id: 'npm-workspace-root-20260902' })
const renewedRegistry = validateExceptionRegistry(
  { schemaVersion: 1, exceptions: [expiredHistory, renewed] },
  [entry],
  now,
)
assert.deepEqual(renewedRegistry.errors, [])
assert.equal(renewedRegistry.byDependency.get(entry.id).length, 2)
const renewedResult = evaluateFreshnessEntry({
  entry,
  currentVersion: '1.0.0',
  latestVersion: '2.0.0',
  exceptions: renewedRegistry.byDependency.get(entry.id),
  now,
})
assert.equal(renewedResult.state, 'exception')
assert.equal(renewedResult.selectedException.id, renewed.id)

const expiredOnly = evaluateFreshnessEntry({
  entry,
  currentVersion: '0.9.0',
  latestVersion: '1.0.0',
  exceptions: [expiredHistory],
  now,
})
assert.equal(expiredOnly.state, 'stale')

const concurrentExceptions = evaluateFreshnessEntry({
  entry,
  currentVersion: '1.0.0',
  latestVersion: '2.0.0',
  exceptions: [renewed, exception({ id: 'npm-workspace-root-20260903' })],
  now,
})
assert.equal(concurrentExceptions.state, 'stale')
assert.ok(
  concurrentExceptions.errors.includes('exception-active-not-exact-one'),
)

function pullRequest(overrides = {}) {
  return {
    number: 1,
    title: 'chore(deps): update dependency vue to 3.6.0',
    body: '',
    headRefName: 'renovate/vue-3.x',
    url: 'https://example.invalid/pull/1',
    createdAt: now,
    labels: [],
    statusCheckRollup: [],
    ...overrides,
  }
}

const vueEntry = { id: 'npm-vue', datasource: 'npm', packageName: 'vue' }
assert.equal(
  selectRenovatePullRequests([pullRequest()], vueEntry)[0].targetVersion,
  '3.6.0',
)
const scopedEntry = {
  id: 'npm-floating-ui-dom',
  datasource: 'npm',
  packageName: '@floating-ui/dom',
}
assert.equal(
  selectRenovatePullRequests(
    [
      pullRequest({
        title: 'chore(deps): update dependency @floating-ui/dom to 2.0.0',
      }),
    ],
    scopedEntry,
  )[0].targetVersion,
  '2.0.0',
)
assert.equal(
  selectRenovatePullRequests(
    [
      pullRequest({
        title: 'chore(deps): update frontend dependencies',
        body: [
          '| Package | Type | Update | Change |',
          '| --- | --- | --- | --- |',
          '| [vue](https://npmjs.com/package/vue) | dependencies | minor | `3.5.32` -> `3.6.0` |',
          '| [vue-router](https://npmjs.com/package/vue-router) | dependencies | major | `4.6.4` -> `5.0.0` |',
        ].join('\n'),
      }),
    ],
    vueEntry,
  )[0].targetVersion,
  '3.6.0',
)
assert.deepEqual(
  selectRenovatePullRequests(
    [
      pullRequest({
        title: 'chore(deps): update dependency vue-router to 5.0.0',
      }),
    ],
    vueEntry,
  ),
  [],
)

const surface = JSON.parse(
  readFileSync(
    path.join(repoRoot, 'config/dependencies/update-surface.json'),
    'utf8',
  ),
).surfaces
const surfaceDatasources = new Set(surface.map((item) => item.datasource))
assert.deepEqual(surfaceDatasources, SUPPORTED_FRESHNESS_DATASOURCES)

const currentByPackage = new Map()
for (const item of surface) {
  const currentVersion = resolveCurrentVersion(item, repoRoot)
  assert.ok(
    currentVersion,
    `${item.id} must have authoritative current evidence`,
  )
  currentByPackage.set(item.packageName, currentVersion)
}

const latestLookups = {
  npm: (packageName) => currentByPackage.get(packageName),
  nuget: (packageName) => [currentByPackage.get(packageName)],
  githubTags: (packageName) => [currentByPackage.get(packageName)],
  githubReleases: (packageName) => [currentByPackage.get(packageName)],
  dotnet: () => ({
    'releases-index': [
      {
        'channel-version': '10.0',
        'latest-sdk': '10.0.108',
        'support-phase': 'active',
      },
      {
        'channel-version': '11.0',
        'latest-sdk': '11.0.100-preview.7',
        'support-phase': 'preview',
      },
    ],
  }),
  node: () => [{ version: 'v22.14.0', lts: 'Jod' }],
}
for (const item of surface) {
  const currentVersion = resolveCurrentVersion(item, repoRoot)
  assert.ok(
    resolveLatestVersion(item, currentVersion, latestLookups),
    `${item.id} must have a latest-version adapter`,
  )
}

const nugetEntry = surface.find((item) => item.id === 'nuget-avalonia')
assert.match(resolveCurrentVersion(nugetEntry, repoRoot), /^\d+\.\d+/u)
assert.equal(
  resolveLatestVersion(nugetEntry, '11.3.12', {
    nuget: () => ['11.3.12', '12.0.0-preview.1'],
  }),
  '11.3.12',
)

const checkoutEntry = surface.find(
  (item) => item.id === 'github-action-actions-checkout',
)
assert.equal(resolveCurrentVersion(checkoutEntry, repoRoot), 'v4')
assert.equal(
  resolveLatestVersion(checkoutEntry, 'v4', {
    githubTags: () => ['v7.0.1', 'v7', 'v8-beta'],
  }),
  '7',
)
assert.equal(latestStableVersion(['v5.0.0-rc.1', 'v4.2.0'], 'v4'), '4')

for (const datasource of SUPPORTED_FRESHNESS_DATASOURCES) {
  const unavailable = resolveLatestVersion(
    { id: 'unavailable', datasource, packageName: 'unavailable' },
    '1.0.0',
    {
      npm: () => null,
      nuget: () => null,
      githubTags: () => null,
      githubReleases: () => null,
      dotnet: () => null,
      node: () => null,
    },
  )
  assert.equal(unavailable, null, `${datasource} unavailable must fail closed`)
}
assert.equal(
  resolveCurrentVersion(
    { id: 'unknown', datasource: 'unknown', packageName: 'unknown' },
    repoRoot,
  ),
  null,
)
assert.equal(
  resolveLatestVersion(
    { id: 'unknown', datasource: 'unknown', packageName: 'unknown' },
    null,
    latestLookups,
  ),
  null,
)

console.log('Dependency freshness evaluator tests passed.')
