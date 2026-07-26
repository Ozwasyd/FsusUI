import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const workflow = readFileSync('.github/workflows/_quality.yml', 'utf8')
const runner = readFileSync('scripts/run-coverage.mjs', 'utf8')
const planner = readFileSync('scripts/coverage-plan.mjs', 'utf8')
const contract = readFileSync('scripts/coverage-contract.mjs', 'utf8')
const docs =
  `${readFileSync('docs/releases/governance.md', 'utf8')}\n${readFileSync('docs/engineering-handoff.md', 'utf8')}`.toLowerCase()

for (const path of [
  'scripts/run-coverage.mjs',
  'scripts/coverage-plan.mjs',
  'scripts/coverage-contract.mjs',
  'scripts/test-coverage-sharding.mjs',
  'tests/fixtures/coverage-sharding/contracts.json',
])
  assert.ok(existsSync(path), `${path} is required`)

assert.ok(scripts['coverage:plan']?.includes('coverage-plan.mjs --dry-run'))
assert.ok(scripts['coverage:run']?.includes('run-coverage.mjs run'))
assert.ok(scripts['coverage:merge']?.includes('run-coverage.mjs merge'))
assert.ok(scripts['_test:coverage']?.includes('run-coverage.mjs run'))
assert.ok(
  scripts['check:coverage-sharding']?.includes('test-coverage-sharding.mjs'),
)
assert.ok(scripts['governance:check']?.includes('check:coverage-sharding'))

assert.ok(runner.includes('Promise.all('), 'local shards must run concurrently')
assert.ok(runner.includes("from 'fast-glob'"), 'coverage must use stable globbing')
assert.ok(planner.includes("from 'fast-glob'"), 'coverage plan must use stable globbing')
assert.ok(!runner.includes('globSync') && !planner.includes('globSync'))
assert.ok(
  !runner.includes('spawnSync'),
  'coverage shard runner must not use spawnSync',
)
for (const fragment of [
  'shard-manifest',
  'coverage-final.json',
  'coverage-merge=before-thresholds',
  'final-threshold-evaluation=once',
  'thresholdsApplied: false',
])
  assert.ok(
    runner.includes(fragment),
    `coverage runner must contain ${fragment}`,
  )
for (const fragment of [
  'effectiveCpu',
  'effectiveMemoryMiB',
  'minFilesPerShard',
  'shardMemoryMiB',
  'shardCount *',
  'FSUSUI_COVERAGE_DURATION_BUDGET_SECONDS',
])
  assert.ok(
    planner.includes(fragment),
    `coverage planner must contain ${fragment}`,
  )
for (const fragment of [
  'coverage shards incomplete',
  'duplicate coverage shard',
  'commitSha',
  'configDigest',
  'selectionDigest',
  'artifact digest mismatch',
])
  assert.ok(
    contract.includes(fragment),
    `coverage contract must contain ${fragment}`,
  )

for (const fragment of [
  'coverage-plan:',
  'coverage-shard:',
  'coverage-merge:',
  'fromjson(needs.coverage-plan.outputs.matrix)',
  'fsusui_coverage_shard_index',
  'fsusui_coverage_shard_total',
  'merge-multiple: true',
])
  assert.ok(
    workflow.toLowerCase().includes(fragment),
    `workflow must contain ${fragment}`,
  )
assert.ok(
  !workflow.includes('FSUSUI_COVERAGE_SHARD_THRESHOLD_SECONDS: 180'),
  'Actions must not use one fixed runner duration as a correctness condition',
)

for (const fragment of [
  'coverage:plan --dry-run',
  'coverage:run',
  'coverage:merge',
  'same commit',
  'final merged result',
  'cpu',
  'memory',
])
  assert.ok(docs.includes(fragment), `docs must describe ${fragment}`)

console.log('[coverage-sharding] policy ok')
