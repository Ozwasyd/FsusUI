import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const qualityWorkflow = readFileSync('.github/workflows/quality.yml', 'utf8')
const releaseGovernance = readFileSync('docs/releases/governance.md', 'utf8')
const engineeringHandoff = readFileSync('docs/engineering-handoff.md', 'utf8')
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
    scripts['verify:full']?.includes('_verify:parallel') &&
    scripts['verify:full']?.includes('build:demo'),
  'verify:full must preserve the previous verify gate',
)
assert(
  scripts['verify:release']?.includes('verify:full'),
  'verify:release must include the full gate',
)
assert(
  scripts['verify:pr-fast']?.includes('_verify:pr-fast:parallel'),
  'verify:pr-fast must use the explicit PR-fast parallel group',
)
assert(
  scripts['verify:pr-fast']?.includes('build:theme') &&
    scripts['verify:pr-fast'].indexOf('build:theme') <
      scripts['verify:pr-fast'].indexOf('_verify:pr-fast:parallel'),
  'verify:pr-fast must prepare theme artifacts before package smoke enters the parallel group',
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
  scripts['build:package-smoke']?.includes(
    'scripts/check-package-build-smoke.mjs',
  ),
  'build:package-smoke must use the lightweight package smoke checker',
)
assert(
  scripts['check:foundation-style-boundary']?.includes(
    'scripts/check-foundation-style-boundary.mjs',
  ),
  'package.json must expose the foundation style boundary checker',
)
assert(
  !scripts['typecheck:affected']?.includes('pnpm run typecheck'),
  'typecheck:affected must not call full typecheck',
)
assert(
  !scripts['build:package-smoke']?.includes('pnpm run build'),
  'build:package-smoke must not call the full package build',
)
assert(
  capacitySuite.includes("'lint'") &&
    capacitySuite.includes("'typecheck:affected'") &&
    capacitySuite.includes("'test:unit:affected'") &&
    capacitySuite.includes("'tokens:check'") &&
    capacitySuite.includes("'icons:check'") &&
    capacitySuite.includes("'build:package-smoke'"),
  'PR-fast group must cover lint, affected typecheck/unit, tokens, icons, and package smoke',
)
assert(
  capacitySuite.split("'check:foundation-style-boundary'").length - 1 === 2,
  'PR-fast and full verification must enforce the foundation style boundary',
)

const prFeedbackJob = workflowJob('pr-feedback')
const prRenderJob = workflowJob('pr-real-render-performance')
const premergeMainJob = workflowJob('premerge-main')
const prFastJob = workflowJob('pr-fast')
const mergeGroupPrFastJob = workflowJob('merge-group-pr-fast')
const mergeGroupRenderJob = workflowJob('merge-group-real-render-performance')
const mainJob = workflowJob('main')

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
  prFeedbackJob.includes("github.event_name == 'pull_request'") &&
    prFeedbackJob.includes('pnpm run verify:pr-fast'),
  'PR workflow must keep verify:pr-fast as an early feedback job',
)
assert(
  prRenderJob.includes("github.event_name == 'pull_request'"),
  'PR workflow must keep differential real-render performance feedback',
)
assert(
  premergeMainJob.includes(
    "github.event_name == 'pull_request' || github.event_name == 'merge_group'",
  ) &&
    premergeMainJob.includes('uses: ./.github/workflows/_quality.yml') &&
    premergeMainJob.includes('group: main'),
  'PR heads and merge-group candidates must run the complete main quality profile before merge',
)
assert(
  prFastJob.includes('if: always()') &&
    prFastJob.includes('pr-feedback') &&
    prFastJob.includes('pr-real-render-performance') &&
    prFastJob.includes('premerge-main') &&
    prFastJob.includes('PREMERGE_MAIN_RESULT') &&
    !prFastJob.includes('pnpm run verify:pr-fast'),
  'required pr-fast check must aggregate fast feedback, render feedback, and complete premerge main quality',
)
assert(
  mergeGroupPrFastJob.includes('name: pr-fast') &&
    mergeGroupPrFastJob.includes("github.event_name == 'merge_group'") &&
    mergeGroupPrFastJob.includes('premerge-main'),
  'merge-group candidates must preserve the existing required pr-fast check context',
)
assert(
  mergeGroupRenderJob.includes('name: pr-real-render-performance') &&
    mergeGroupRenderJob.includes("github.event_name == 'merge_group'") &&
    mergeGroupRenderJob.includes('premerge-main'),
  'merge-group candidates must preserve the existing required render check context',
)
assert(
  mainJob.includes("github.event_name == 'push'") &&
    mainJob.includes("inputs.group == 'main'") &&
    mainJob.includes('uses: ./.github/workflows/_quality.yml') &&
    mainJob.includes('group: main') &&
    qualityWorkflow.includes("inputs.group == 'nightly'") &&
    qualityWorkflow.includes("inputs.group == 'release'"),
  'post-merge main, nightly, and release quality must keep using reusable quality profiles',
)
assert(
  releaseGovernance.includes('verify:pr-fast') &&
    releaseGovernance.includes('verify:full') &&
    releaseGovernance.includes('verify:release') &&
    releaseGovernance.includes('--continue-on-error'),
  'release governance docs must explain verify gate selection',
)
assert(
  engineeringHandoff.includes('verify:pr-fast') &&
    engineeringHandoff.includes('verify:full') &&
    engineeringHandoff.includes('verify:release'),
  'engineering handoff docs must explain verify gate selection',
)

console.log('[verify-gates] ok')
