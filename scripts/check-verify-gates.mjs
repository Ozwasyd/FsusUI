import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const qualityWorkflow = readFileSync('.github/workflows/quality.yml', 'utf8')
const releaseGovernance = readFileSync('docs/release-governance.md', 'utf8')
const engineeringHandoff = readFileSync('docs/engineering-handoff.md', 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[verify-gates] ${message}`)
    process.exit(1)
  }
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
for (const script of [
  '_verify:pr-fast:parallel',
  '_verify:parallel',
  '_test:unit:parallel',
  'typecheck',
  'typecheck:no-cache',
]) {
  assert(
    scripts[script]?.includes('run-p --continue-on-error'),
    `${script} must collect every parallel failure before exiting`,
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
  scripts['_verify:pr-fast:parallel']?.includes('lint') &&
    scripts['_verify:pr-fast:parallel']?.includes('typecheck:affected') &&
    scripts['_verify:pr-fast:parallel']?.includes('test:unit:affected') &&
    scripts['_verify:pr-fast:parallel']?.includes('tokens:check') &&
    scripts['_verify:pr-fast:parallel']?.includes('icons:check') &&
    scripts['_verify:pr-fast:parallel']?.includes('build:package-smoke'),
  'PR-fast group must cover lint, affected typecheck/unit, tokens, icons, and package smoke',
)
assert(
  scripts['_verify:pr-fast:parallel']?.includes(
    'check:foundation-style-boundary',
  ) && scripts['_verify:parallel']?.includes('check:foundation-style-boundary'),
  'PR-fast and full verification must enforce the foundation style boundary',
)
assert(
  qualityWorkflow.includes('pnpm run verify:pr-fast') &&
    qualityWorkflow.includes("github.event_name == 'pull_request'"),
  'PR workflow must run verify:pr-fast by default',
)
assert(
  qualityWorkflow.includes("github.event_name == 'push'") &&
    qualityWorkflow.includes("inputs.group == 'main'") &&
    qualityWorkflow.includes("inputs.group == 'nightly'") &&
    qualityWorkflow.includes("inputs.group == 'release'") &&
    qualityWorkflow.includes('uses: ./.github/workflows/_quality.yml'),
  'non-PR quality workflow must split reusable gates into main, nightly, and release groups',
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
