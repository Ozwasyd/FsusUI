import { artifactGroups, expandInputPatterns } from './test-artifact-cache.mjs'
import {
  assertIncludesAll,
  assertRegisteredGovernanceScript,
  createPolicyAssert,
  loadScriptsMap,
  readRepoText,
} from './lib/ci-policy-utils.mjs'

const assert = createPolicyAssert('test-artifact-cache')
const scripts = loadScriptsMap()
const workflows = `${readRepoText('.github/workflows/quality.yml')}\n${readRepoText('.github/workflows/_quality.yml')}`

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
    'vue/packages/wasm/dist',
    'fsusui-v2-wasm-',
    'vue/packages/wasm/**/*.ts',
    'vue/packages/wasm/**/*.cpp',
    'vue/packages/wasm/**/CMakeLists.txt',
    'scripts/ensure-wasm-artifacts.mjs',
    'scripts/run-wasm-build.mjs',
    'cache-hit',
    'prepare:test-artifacts',
  ],
  (fragment) => `quality workflows must include ${fragment}`,
)

console.log('[test-artifact-cache] ok')
