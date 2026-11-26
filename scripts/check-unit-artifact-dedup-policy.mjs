import {
  assertExcludesAll,
  assertIncludesAll,
  assertRegisteredGovernanceScript,
  createPolicyAssert,
  extractWorkflowJob,
  loadGovernanceDocs,
  loadScriptsMap,
  readRepoText,
} from './lib/ci-policy-utils.mjs'

const assert = createPolicyAssert('unit-artifact-dedup')
const scripts = loadScriptsMap()
const reusableQualityWorkflow = readRepoText('.github/workflows/_quality.yml')
const unitArtifactsJob = extractWorkflowJob(
  reusableQualityWorkflow,
  'unit-artifacts',
)
const unitJob = extractWorkflowJob(reusableQualityWorkflow, 'unit')
const docs = loadGovernanceDocs()

assertRegisteredGovernanceScript(
  assert,
  scripts,
  'check:unit-artifact-dedup',
  'scripts/check-unit-artifact-dedup-policy.mjs',
  'the unit artifact dedup policy guard',
)
assert(
  scripts['check:test-artifacts-ready']?.includes(
    'scripts/check-test-artifacts-ready.mjs',
  ),
  'package.json must expose check:test-artifacts-ready',
)
assert(unitArtifactsJob, '_quality.yml must define a unit-artifacts job')
assert(unitJob, '_quality.yml must define a unit job')

assertIncludesAll(
  assert,
  unitArtifactsJob,
  [
    'pnpm run prepare:test-artifacts',
    'actions/upload-artifact@v4',
    'name: unit-test-artifacts',
    'vue/packages/icons-vue/dist',
    'vue/packages/wasm/dist',
    'icons-cache-hit',
    'wasm-cache-hit',
  ],
  (fragment) => `unit-artifacts job must include ${fragment}`,
)
assertIncludesAll(
  assert,
  unitJob,
  [
    '- capacity',
    '- unit-artifacts',
    'actions/download-artifact@v4',
    'name: unit-test-artifacts',
    'pnpm run check:test-artifacts-ready',
  ],
  (fragment) => `unit shards must include ${fragment}`,
)
assertExcludesAll(
  assert,
  unitJob,
  [
    'pnpm run prepare:test-artifacts',
    'pnpm run ensure:icons',
    'pnpm run ensure:wasm',
    'emscripten-core/setup-emsdk',
    'actions/cache@v4',
  ],
  (forbidden) => `unit shards must not run artifact setup step: ${forbidden}`,
)
assertIncludesAll(
  assert,
  docs,
  [
    'unit-test-artifacts',
    'check:test-artifacts-ready',
    'vitest run --shard',
    'unit-artifacts',
  ],
  (fragment) => `docs must describe unit shard artifact flow: ${fragment}`,
)

console.log('[unit-artifact-dedup] ok')
