import { existsSync, readFileSync } from 'node:fs'
import { resolveFsusViteManualChunk } from './vite-manual-chunks.mjs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const qualityWorkflow = readFileSync('.github/workflows/quality.yml', 'utf8')
const reusableQualityWorkflow = readFileSync(
  '.github/workflows/_quality.yml',
  'utf8',
)
const releaseGovernance = readFileSync('docs/releases/governance.md', 'utf8')
const engineeringHandoff = readFileSync('docs/engineering-handoff.md', 'utf8')
const demoViteConfig = readFileSync(
  'vue/packages/demo-app/vite.config.ts',
  'utf8',
)
const manualChunkPolicy = readFileSync('scripts/vite-manual-chunks.mjs', 'utf8')
const invalidFixtureFile = 'tests/fixtures/release-policy/invalid-cases.json'
const invalidFixtures = JSON.parse(readFileSync(invalidFixtureFile, 'utf8'))

function assert(condition, message) {
  if (!condition) {
    console.error(`[demo-build-path] ${message}`)
    process.exit(1)
  }
}

const hasSafeDemoChunkConfig = (source) =>
  source.includes('chunkSizeWarningLimit: Number.POSITIVE_INFINITY') &&
  source.includes('onlyExplicitManualChunks: false')

const docs = `${releaseGovernance}\n${engineeringHandoff}`.toLowerCase()
const decisionScriptPath = 'scripts/should-run-demo-build.mjs'

assert(
  scripts['check:demo-build-path']?.includes(
    'scripts/check-demo-build-path-policy.mjs',
  ),
  'package.json must expose check:demo-build-path',
)
assert(
  scripts['governance:check']?.includes('check:demo-build-path'),
  'governance:check must include the demo build path policy guard',
)
assert(
  existsSync(decisionScriptPath),
  'demo build path decision script is missing',
)

assert(
  hasSafeDemoChunkConfig(demoViteConfig) &&
    !manualChunkPolicy.includes('FSUS_DEMO_CHUNK_SIZE_WARNING_LIMIT_KB'),
  'demo build must avoid a guessed aggregate chunk limit and allow Rollup to merge static dependencies without circular chunks',
)
assert(
  !hasSafeDemoChunkConfig(invalidFixtures.demoViteConfig),
  'demo build negative fixture must reject explicit-only manual chunks',
)

const gatewayChunkOwner = 'fsus-markdown-feature-gateway'
for (const profile of ['full', 'consumer']) {
  for (const moduleId of [
    '/workspace/vue/packages/wasm/markdown-feature-output-gateway.ts',
    '/workspace/node_modules/@element-plus/wasm/markdown-feature-output-gateway.mjs',
    '/workspace/node_modules/@ozwasyd/element-plus/es/wasm/markdown-feature-output-gateway.mjs',
  ]) {
    assert(
      resolveFsusViteManualChunk(moduleId, { profile }) === gatewayChunkOwner,
      `${profile} must isolate the exact Markdown feature output gateway module`,
    )
  }
}
assert(
  resolveFsusViteManualChunk(
    '/workspace/vue/packages/wasm/markdown-runtime.ts',
  ) === 'fsus-ui' &&
    resolveFsusViteManualChunk(
      '/workspace/vue/packages/wasm/markdown-runtime.ts',
      { profile: 'consumer' },
    ) === 'fsus-wasm',
  'ordinary Markdown runtime must retain its existing full and consumer owners',
)
for (const moduleId of [
  '/workspace/vue/packages/wasm/markdown-feature-output-gateway-sibling.ts',
  '/workspace/vue/packages/wasm/markdown-feature-output-gateway.ts/child.ts',
  '/workspace/vue/packages/wasm/markdown-feature-output-gateway.ts?query',
  '/workspace/vue/packages/wasm/%6darkdown-feature-output-gateway.ts',
]) {
  assert(
    resolveFsusViteManualChunk(moduleId) !== gatewayChunkOwner,
    `gateway chunk owner must reject non-exact module id ${moduleId}`,
  )
}

const decisionScript = existsSync(decisionScriptPath)
  ? readFileSync(decisionScriptPath, 'utf8')
  : ''

for (const fragment of [
  'demo',
  'component',
  'theme',
  'public-api',
  'build-config',
  'FSUSUI_DEMO_BUILD_FILES',
  'GITHUB_OUTPUT',
  'demo-build-run',
  'demo-build-reason',
]) {
  assert(
    decisionScript.includes(fragment),
    `demo build decision script must define/log ${fragment}`,
  )
}

for (const fragment of [
  'Determine PR demo build path impact',
  decisionScriptPath,
  'steps.demo-build-path.outputs.run',
  'pnpm run build:demo',
  'Skip PR demo build',
  'demo-build-run',
  'demo-build-reason',
]) {
  assert(
    qualityWorkflow.includes(fragment),
    `PR workflow must include ${fragment}`,
  )
}

assert(
  scripts['verify:full']?.includes('build:demo'),
  'verify:full must keep full demo build coverage',
)
assert(
  scripts['verify:release']?.includes('verify:full'),
  'verify:release must keep the full demo build through verify:full',
)
assert(
  reusableQualityWorkflow.includes('build-demo') &&
    reusableQualityWorkflow.includes('pnpm run build:demo'),
  'non-PR reusable quality workflow must keep the build-demo job',
)

for (const fragment of [
  'path-aware demo build',
  'demo-build-run',
  'demo-build-reason',
  'build:demo',
]) {
  assert(docs.includes(fragment), `docs must describe ${fragment}`)
}

console.log('[demo-build-path] ok')
