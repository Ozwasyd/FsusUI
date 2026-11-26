import { artifactGroups, expandInputPatterns } from './test-artifact-cache.mjs'
import {
  assertIncludesAll,
  assertRegisteredGovernanceScript,
  createPolicyAssert,
  loadGovernanceDocs,
  loadScriptsMap,
  readRepoText,
} from './lib/ci-policy-utils.mjs'

const assert = createPolicyAssert('test-artifact-cache')
const scripts = loadScriptsMap()
const workflows = `${readRepoText('.github/workflows/quality.yml')}\n${readRepoText('.github/workflows/_quality.yml')}`
const docs = loadGovernanceDocs().toLowerCase()

const wasmBundleFingerprint = artifactGroups.wasm.fingerprints.find(
  (fingerprint) => fingerprint.id === 'bundle',
)
assert(wasmBundleFingerprint, 'WASM bundle fingerprint must exist')
const wasmBundleInputs = await expandInputPatterns(
  wasmBundleFingerprint.inputPatterns,
)
assert(
  wasmBundleInputs.includes(
    'vue/packages/wasm/markdown-feature-output-gateway.ts',
  ),
  'WASM bundle fingerprint must include the Markdown feature output gateway owner',
)
assert(
  !wasmBundleInputs.some(
    (inputPath) =>
      inputPath.startsWith('vue/packages/wasm/build/') ||
      inputPath.startsWith('vue/packages/wasm/dist/'),
  ),
  'WASM bundle fingerprint must exclude generated build and dist artifacts',
)

assert(
  scripts['prepare:test-artifacts']?.includes(
    'scripts/prepare-test-artifacts.mjs',
  ),
  'prepare:test-artifacts must use the source-hash aware wrapper',
)
assert(
  !scripts['prepare:test-artifacts']?.includes(
    'run-p ensure:icons ensure:wasm',
  ),
  'prepare:test-artifacts must not directly run both ensure scripts on every test entry',
)
assertRegisteredGovernanceScript(
  assert,
  scripts,
  'check:test-artifact-cache',
  'scripts/check-test-artifact-cache-policy.mjs',
  'the test artifact cache policy guard',
)
assert(
  scripts['build:wasm']?.includes('ensure-wasm-artifacts.mjs --force'),
  'build:wasm must keep the explicit force regeneration path',
)
assertIncludesAll(
  assert,
  workflows,
  [
    'actions/cache@v4',
    'vue/packages/icons-vue/dist',
    'vue/packages/wasm/dist',
    'fsusui-test-artifacts-icons-',
    'fsusui-test-artifacts-wasm-',
    'vue/packages/icons-vue/src/**',
    'vue/packages/icons-vue/build/**',
    'scripts/ensure-icons-artifacts.mjs',
    'vue/packages/wasm/**/*.ts',
    'vue/packages/wasm/**/*.cpp',
    'vue/packages/wasm/**/CMakeLists.txt',
    'scripts/ensure-wasm-artifacts.mjs',
    'scripts/run-wasm-build.mjs',
    'icons-cache-hit',
    'wasm-cache-hit',
    'cache-hit',
    'prepare:test-artifacts',
  ],
  (fragment) => `quality workflows must include ${fragment}`,
)
assertIncludesAll(
  assert,
  docs,
  [
    'test artifact cache',
    'cache hit',
    'cache miss',
    'prepare:test-artifacts',
    'build:wasm',
  ],
  (fragment) => `docs must describe ${fragment}`,
)

console.log('[test-artifact-cache] ok')
