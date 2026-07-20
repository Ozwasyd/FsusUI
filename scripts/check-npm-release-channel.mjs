import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import {
  assertCandidateMatchesPlan,
  checkChannelMonotonicity,
  compareReleaseVersions,
  createReleasePlan,
} from './npm-release-channel-lib.mjs'

const fixtureRoot = new URL(
  '../tests/fixtures/npm-release-channel/',
  import.meta.url,
)
const fixtures = JSON.parse(readFileSync(new URL('cases.json', fixtureRoot)))

for (const { version, channel } of fixtures.plans) {
  const plan = createReleasePlan({
    packageName: '@ozwasyd/element-plus',
    version,
  })
  assert.equal(plan.distTag, channel)
  assert.equal(
    plan.concurrencyGroup,
    `publish-npm-registry.npmjs.org-ozwasyd-element-plus-${channel}`,
  )
}
assert.notEqual(
  createReleasePlan({ packageName: '@ozwasyd/element-plus', version: '1.5.1' })
    .concurrencyGroup,
  createReleasePlan({
    packageName: '@ozwasyd/element-plus',
    version: '1.6.0-preview.1',
  }).concurrencyGroup,
)

assert.equal(compareReleaseVersions('1.6.0-beta.10', '1.6.0-beta.2'), 1)
assert.equal(compareReleaseVersions('1.6.0-rc.1', '1.6.0-beta.9'), 1)
assert.equal(compareReleaseVersions('1.6.0', '1.6.0-rc.9'), 1)

const automaticCases = [
  ...fixtures.automatic.map(({ action, ...input }) => [input, action]),
]
for (const [input, action] of automaticCases)
  assert.equal(checkChannelMonotonicity(input).action, action)

for (const input of fixtures.rejected)
  assert.throws(() => checkChannelMonotonicity(input))

const stablePlan = createReleasePlan({
  packageName: '@ozwasyd/element-plus',
  version: '1.5.1',
})
assert.doesNotThrow(() =>
  assertCandidateMatchesPlan(
    new URL('candidate-manifest.json', fixtureRoot),
    stablePlan,
  ),
)
assert.throws(() =>
  assertCandidateMatchesPlan(
    new URL('drifted-candidate-manifest.json', fixtureRoot),
    stablePlan,
  ),
)

assert.equal(
  checkChannelMonotonicity({
    candidate: '1.5.0',
    current: '1.5.1',
    candidateExists: true,
    mode: 'recovery',
    reason: 'Restore a validated previous release',
    expectedCurrent: '1.5.1',
  }).action,
  'recover',
)
assert.equal(
  checkChannelMonotonicity({
    candidate: '1.6.0-beta.2',
    current: '1.5.1',
    candidateExists: true,
    mode: 'recovery',
    reason: 'Repair a next tag that points to stable',
    expectedCurrent: '1.5.1',
  }).action,
  'recover',
)
assert.throws(() =>
  checkChannelMonotonicity({
    candidate: '1.5.0',
    current: '1.5.1',
    candidateExists: true,
    mode: 'recovery',
    reason: '',
    expectedCurrent: '1.5.1',
  }),
)

console.log('npm release channel plan and monotonicity fixtures passed.')
