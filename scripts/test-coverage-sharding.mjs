#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assertFinalThresholdResult,
  sha256File,
  validateShardManifests,
} from './coverage-contract.mjs'
import { createCoveragePlan, createCoverageMatrix } from './coverage-plan.mjs'
import { createCapacityPlan } from './ci-capacity.mjs'

const capacity = createCapacityPlan(
  {
    availableParallelism: 16,
    cpuCount: 16,
    totalMemoryBytes: 32 * 1024 ** 3,
  },
  {},
  { unitTestFileCount: 600 },
)

const small = createCoveragePlan(capacity, { testFileCount: 120 })
assert.equal(small.mode, 'single')
assert.equal(small.shardCount, 1)

const measuredSlow = createCoveragePlan(capacity, {
  testFileCount: 120,
  env: {
    FSUSUI_COVERAGE_KNOWN_SECONDS: '181',
    FSUSUI_COVERAGE_DURATION_BUDGET_SECONDS: '240',
  },
})
assert.equal(measuredSlow.mode, 'sharded')
assert.equal(measuredSlow.durationBudgetSeconds, 240)

const parallel = createCoveragePlan(capacity, { testFileCount: 600 })
assert.equal(parallel.mode, 'sharded')
assert.ok(parallel.shardCount > 1)
assert.ok(
  parallel.shardCount * parallel.workersPerShard <=
    capacity.budgets.parallelLaneLimit,
)
assert.equal(createCoverageMatrix(parallel).length, parallel.shardCount)

const constrained = createCoveragePlan(capacity, {
  testFileCount: 600,
  env: { FSUSUI_COVERAGE_SHARDS: '99', FSUSUI_COVERAGE_WORKERS: '99' },
})
assert.ok(constrained.shardCount <= 8)
assert.ok(
  constrained.shardCount * constrained.workersPerShard <=
    capacity.budgets.parallelLaneLimit,
)

const fixtures = JSON.parse(
  readFileSync('tests/fixtures/coverage-sharding/contracts.json', 'utf8'),
)
assert.equal(validateShardManifests(fixtures.valid).total, 2)
assert.throws(
  () =>
    validateShardManifests(fixtures.valid, {
      expectedIdentity: { ...fixtures.valid[0], commitSha: 'new-commit' },
    }),
  /stale for current commitSha/u,
)
for (const name of [
  'missingShard',
  'duplicateShard',
  'shaMismatch',
  'configMismatch',
  'wrongTotal',
  'durationFailure',
]) {
  const options =
    name === 'durationFailure' ? { durationBudgetSeconds: 30 } : undefined
  assert.throws(
    () => validateShardManifests(fixtures[name], options),
    Error,
    name,
  )
}
assert.throws(
  () => assertFinalThresholdResult(fixtures.thresholdFailureExitCode),
  /merged coverage thresholds failed/u,
)
assert.doesNotThrow(() => assertFinalThresholdResult(0))

const artifactRoot = mkdtempSync(join(tmpdir(), 'fsusui-coverage-contract-'))
try {
  mkdirSync(join(artifactRoot, 'blobs'))
  mkdirSync(join(artifactRoot, 'fragments'))
  const artifactManifests = fixtures.valid.map((manifest) => {
    const blobPath = `blobs/shard-${manifest.index}.json`
    const coverageFragmentPath = `fragments/shard-${manifest.index}.json`
    writeFileSync(join(artifactRoot, blobPath), `blob-${manifest.index}`)
    writeFileSync(
      join(artifactRoot, coverageFragmentPath),
      `coverage-${manifest.index}`,
    )
    return {
      ...manifest,
      blobPath,
      blobDigest: sha256File(join(artifactRoot, blobPath)),
      coverageFragmentPath,
      coverageFragmentDigest: sha256File(
        join(artifactRoot, coverageFragmentPath),
      ),
    }
  })
  assert.equal(
    validateShardManifests(artifactManifests, { rootDir: artifactRoot }).total,
    2,
  )
  writeFileSync(join(artifactRoot, artifactManifests[0].blobPath), 'stale')
  assert.throws(
    () => validateShardManifests(artifactManifests, { rootDir: artifactRoot }),
    /artifact digest mismatch/u,
  )
} finally {
  rmSync(artifactRoot, { recursive: true, force: true })
}

console.log('[coverage-sharding] fixtures ok')
