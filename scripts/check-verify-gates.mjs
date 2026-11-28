import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const qualityWorkflow = readFileSync('.github/workflows/quality.yml', 'utf8')
const reusableQualityWorkflow = readFileSync(
  '.github/workflows/_quality.yml',
  'utf8',
)
const capacitySuite = readFileSync('scripts/run-capacity-suite.mjs', 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[verify-gates] ${message}`)
    process.exit(1)
  }
}

function workflowJob(name) {
  const marker = `\n  ${name}:\n`
  const start = qualityWorkflow.indexOf(marker)
  assert(start !== -1, `quality workflow must define ${name}`)
  const body = qualityWorkflow.slice(start + marker.length)
  const nextJob = body.search(/\n {2}[A-Za-z0-9_-]+:\n/)
  return nextJob === -1 ? body : body.slice(0, nextJob)
}

assert(scripts['verify:pr-fast'], 'package.json must expose verify:pr-fast')
assert(scripts['verify:full'], 'package.json must expose verify:full')
assert(
  scripts.verify?.includes('verify:full'),
  'verify must remain a safe alias for verify:full',
)
assert(
  scripts['verify:full']?.includes('prepare:test-artifacts') &&
    scripts['verify:full']?.includes('conformance:v2') &&
    scripts['verify:full']?.includes('_verify:parallel') &&
    scripts['verify:full']?.includes('build:demo'),
  'verify:full must prepare artifacts, derive Contract V2 alignment, run the parallel quality gates, and build the demo',
)
assert(
  scripts['verify:release']?.includes('verify:full'),
  'verify:release must include the full gate',
)
assert(
  scripts['verify:pr-fast']?.includes('_verify:pr-fast:parallel'),
  'verify:pr-fast must use the explicit PR-fast parallel group',
)
for (const script of ['_verify:pr-fast:parallel', '_verify:parallel']) {
  assert(
    scripts[script]?.includes('run-capacity-suite.mjs'),
    `${script} must use the capacity scheduler and collect every failure`,
  )
}
assert(
  scripts['_test:unit:parallel']?.includes('run-capacity-unit.mjs'),
  '_test:unit:parallel must use the capacity Unit planner',
)
for (const script of ['typecheck', 'typecheck:no-cache']) {
  assert(
    scripts[script]?.includes('run-capacity-typecheck.mjs'),
    `${script} must use capacity-based Typecheck batches`,
  )
}
assert(
  scripts['test:visual:full']?.includes('scripts/run-visual-tests.mjs'),
  'test:visual:full must use the visual orchestration runner',
)
assert(
  scripts['typecheck:affected']?.includes(
    'scripts/run-affected-gate.mjs typecheck',
  ),
  'typecheck:affected must use the affected gate runner instead of full typecheck',
)
assert(
  scripts['test:unit:affected']?.includes('scripts/run-affected-gate.mjs unit'),
  'test:unit:affected must use the affected gate runner instead of full unit groups',
)
assert(
  scripts['check:foundation-style-boundary']?.includes(
    'scripts/check-foundation-style-boundary.mjs',
  ),
  'package.json must expose the foundation style boundary checker',
)
assert(
  capacitySuite.includes("'lint'") &&
    capacitySuite.includes("'typecheck:affected'") &&
    capacitySuite.includes("'test:unit:affected'") &&
    capacitySuite.includes("'tokens:check'") &&
    capacitySuite.includes("'icons:check'"),
  'PR-fast group must cover lint, affected typecheck/unit, tokens, and icons',
)
assert(
  capacitySuite.split("'check:foundation-style-boundary'").length - 1 === 2,
  'PR-fast and full verification must enforce the foundation style boundary',
)
assert(
  ![qualityWorkflow, reusableQualityWorkflow].some((workflow) =>
    /(?:real-render-performance|perf:render|avalonia:performance)/u.test(
      workflow,
    ),
  ),
  'hosted quality workflows must not run or require render benchmarks',
)

const qualityJob = workflowJob('quality')
const prFastJob = workflowJob('pr-fast')
assert(
  qualityWorkflow.includes('merge_group:') &&
    qualityWorkflow.includes('checks_requested'),
  'quality workflow must listen for merge_group checks_requested events',
)
assert(
  qualityWorkflow.includes('concurrency:') &&
    qualityWorkflow.includes(
      "cancel-in-progress: ${{ github.event_name == 'pull_request' || github.event_name == 'merge_group' }}",
    ),
  'PR and merge-group quality runs must cancel superseded candidates',
)
assert(
  qualityJob.includes('uses: ./.github/workflows/_quality.yml'),
  'quality workflow must call _quality.yml',
)
assert(
  prFastJob.includes('if: always()') &&
    prFastJob.includes('- quality') &&
    prFastJob.includes('QUALITY_RESULT'),
  'required pr-fast check must aggregate quality result',
)

console.log('[verify-gates] ok')
