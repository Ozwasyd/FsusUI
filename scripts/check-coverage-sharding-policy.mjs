import { existsSync, readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const reusableQualityWorkflow = readFileSync(
  '.github/workflows/_quality.yml',
  'utf8',
)
const releaseGovernance = readFileSync('docs/release-governance.md', 'utf8')
const engineeringHandoff = readFileSync('docs/engineering-handoff.md', 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[coverage-sharding] ${message}`)
    process.exit(1)
  }
}

const runnerPath = 'scripts/run-coverage.mjs'
const docs = `${releaseGovernance}\n${engineeringHandoff}`.toLowerCase()

assert(
  scripts['check:coverage-sharding']?.includes(
    'scripts/check-coverage-sharding-policy.mjs',
  ),
  'package.json must expose check:coverage-sharding',
)
assert(
  scripts['governance:check']?.includes('check:coverage-sharding'),
  'governance:check must include the coverage sharding policy guard',
)
assert(
  scripts['_test:coverage']?.includes(runnerPath),
  '_test:coverage must run scripts/run-coverage.mjs',
)
assert(existsSync(runnerPath), 'coverage runner script is missing')

const runner = existsSync(runnerPath) ? readFileSync(runnerPath, 'utf8') : ''

for (const fragment of [
  'FSUSUI_COVERAGE_SHARDS',
  'FSUSUI_COVERAGE_SHARD_THRESHOLD_SECONDS',
  'DEFAULT_SHARD_THRESHOLD_SECONDS = 180',
  '--shard=',
  '--reporter=blob',
  '--merge-reports',
  'coverage-shard',
  'coverage-merge=before-thresholds',
  'duration-seconds',
  'duration-threshold',
]) {
  assert(
    runner.includes(fragment),
    `coverage runner must define/log ${fragment}`,
  )
}

const coverageJob = reusableQualityWorkflow.match(
  /\n {2}coverage:\n([\s\S]*?)(?=\n {2}[a-zA-Z][\w-]*:\n|$)/u,
)?.[1] ?? ''

assert(coverageJob, '_quality.yml must define a coverage job')

for (const fragment of [
  'FSUSUI_COVERAGE_SHARD_THRESHOLD_SECONDS: 180',
  'pnpm test:coverage',
  'coverage-report',
]) {
  assert(coverageJob.includes(fragment), `coverage job must include ${fragment}`)
}

for (const fragment of [
  'coverage sharding',
  '44.1s',
  '180s',
  'fsusui_coverage_shards',
  'fsusui_coverage_shard_threshold_seconds',
  'merge-reports',
  'merged before coverage thresholds',
]) {
  assert(docs.includes(fragment), `docs must describe ${fragment}`)
}

console.log('[coverage-sharding] ok')
