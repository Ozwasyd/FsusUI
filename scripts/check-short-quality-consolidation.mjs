import { execFileSync } from 'node:child_process'
import { validateGovernanceStages } from './governance-stage-policy.mjs'
import {
  assertIncludesAll,
  assertRegisteredGovernanceScript,
  createPolicyAssert,
  loadGovernanceDocs,
  loadScriptsMap,
  readRepoText,
} from './lib/ci-policy-utils.mjs'

const assert = createPolicyAssert('short-quality')
const scripts = loadScriptsMap()
const reusableQualityWorkflow = readRepoText('.github/workflows/_quality.yml')
const docs = loadGovernanceDocs().toLowerCase()

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
    'Run contract checks',
    'pnpm run check:consumer-contract',
    'pnpm run check:npm-dist-tag',
    'Run lint',
    'pnpm lint',
    'Run token checks',
    'pnpm run tokens:check',
    'pnpm run tokens:lint',
    'Run icon checks',
    'pnpm run icons:check',
    'pnpm run icons:lint',
    'Run conformance',
    'pnpm run conformance',
    'Run governance',
    'pnpm run governance:check',
  ],
  (fragment) => `static-quality must keep identifiable step/command: ${fragment}`,
)

assert(
  /consumer-install:[\s\S]*needs:[\s\S]*static-quality[\s\S]*build-package/.test(
    reusableQualityWorkflow,
  ),
  'consumer-install must depend on static-quality and build-package',
)

assertIncludesAll(
  assert,
  docs,
  ['static-quality', 'short quality', 'shared setup', 'failure output'],
  (fragment) => `docs must describe ${fragment}`,
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
