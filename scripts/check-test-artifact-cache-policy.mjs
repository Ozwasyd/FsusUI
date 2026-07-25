import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const qualityWorkflow = readFileSync('.github/workflows/quality.yml', 'utf8')
const reusableQualityWorkflow = readFileSync(
  '.github/workflows/_quality.yml',
  'utf8',
)
const releaseGovernance = readFileSync('docs/releases/governance.md', 'utf8')
const engineeringHandoff = readFileSync('docs/engineering-handoff.md', 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[test-artifact-cache] ${message}`)
    process.exit(1)
  }
}

const workflows = `${qualityWorkflow}\n${reusableQualityWorkflow}`
const docs = `${releaseGovernance}\n${engineeringHandoff}`

assert(
  scripts['prepare:test-artifacts']?.includes(
    'scripts/prepare-test-artifacts.mjs',
  ),
  'prepare:test-artifacts must use the source-hash aware wrapper',
)
assert(
  !scripts['prepare:test-artifacts']?.includes('run-p ensure:icons ensure:wasm'),
  'prepare:test-artifacts must not directly run both ensure scripts on every test entry',
)
assert(
  scripts['check:test-artifact-cache']?.includes(
    'scripts/check-test-artifact-cache-policy.mjs',
  ),
  'package.json must expose check:test-artifact-cache',
)
assert(
  scripts['governance:check']?.includes('check:test-artifact-cache'),
  'governance:check must include the test artifact cache policy guard',
)
assert(
  scripts['build:wasm']?.includes('ensure-wasm-artifacts.mjs --force'),
  'build:wasm must keep the explicit force regeneration path',
)
assert(
  workflows.includes('actions/cache@v4'),
  'quality workflows must restore/save generated artifact caches',
)
for (const path of ['vue/packages/icons-vue/dist', 'vue/packages/wasm/dist']) {
  assert(workflows.includes(path), `artifact cache paths must include ${path}`)
}
for (const fragment of [
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
]) {
  assert(workflows.includes(fragment), `cache key must include ${fragment}`)
}
for (const fragment of [
  'icons-cache-hit',
  'wasm-cache-hit',
  'cache-hit',
  'prepare:test-artifacts',
]) {
  assert(
    workflows.includes(fragment),
    `quality workflow logs must expose ${fragment}`,
  )
}
for (const fragment of [
  'test artifact cache',
  'cache hit',
  'cache miss',
  'prepare:test-artifacts',
  'build:wasm',
]) {
  assert(
    docs.toLowerCase().includes(fragment),
    `docs must describe ${fragment}`,
  )
}

console.log('[test-artifact-cache] ok')
