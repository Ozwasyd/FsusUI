import { execFileSync } from 'node:child_process'
import { validateGovernanceStages } from './governance-stage-policy.mjs'
import {
  assertIncludesAll,
  assertRegisteredGovernanceScript,
  createPolicyAssert,
  loadScriptsMap,
  readRepoText,
} from './lib/ci-policy-utils.mjs'

const assert = createPolicyAssert('short-quality')
const scripts = loadScriptsMap()
const reusableQualityWorkflow = readRepoText('.github/workflows/_quality.yml')

assertRegisteredGovernanceScript(
  assert,
  scripts,
  'check:short-quality-consolidation',
  'scripts/check-short-quality-consolidation.mjs',
  'the short quality consolidation guard',
)
assert(
  reusableQualityWorkflow.includes('static-quality:'),
  'reusable quality workflow must define one static-quality job',
)

for (const job of [
  'contract',
  'lint',
  'tokens',
  'icons',
  'conformance',
  'governance',
]) {
  assert(
    !new RegExp(String.raw`\n  ${job}:\n`).test(reusableQualityWorkflow),
    `short ${job} job must be folded into static-quality`,
  )
}

assertIncludesAll(
  assert,
  reusableQualityWorkflow,
  [
    'pnpm run check:consumer-contract',
    'pnpm run check:npm-dist-tag',
    'Run lint',
    'pnpm run lint',
    'Run token checks',
    'pnpm run tokens:check',
    'pnpm run tokens:lint',
    'Run icon checks',
    'pnpm run icons:check',
    'pnpm run icons:lint',
  ],
  (fragment) => `static-quality must keep identifiable step/command: ${fragment}`,
)

assert(
  /consumer-verify:[\s\S]*needs:[\s\S]*build-package/.test(
    reusableQualityWorkflow,
  ),
  'consumer-verify must depend on build-package',
)

validateGovernanceStages({
  scripts,
  reusable: reusableQualityWorkflow,
  readiness: readRepoText('.github/workflows/_quality-readiness.yml'),
  quality: readRepoText('.github/workflows/quality.yml'),
  capacity: readRepoText('scripts/run-capacity-suite.mjs'),
})

execFileSync(
  process.execPath,
  ['--test', 'tests/governance-stage-policy.test.mjs'],
  { stdio: 'inherit' },
)

console.log('[short-quality] ok')
