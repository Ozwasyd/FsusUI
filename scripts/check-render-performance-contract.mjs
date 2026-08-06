import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (file) => readFile(path.join(root, file), 'utf8')
const [
  web,
  avalonia,
  docs,
  packageJson,
  quality,
  reusable,
  staticBudget,
  impactPlanner,
  ownership,
  impactFixtures,
  performanceFixture,
  markdownFeatureFixture,
  markdownFeatureMigration,
] = await Promise.all([
  read('scripts/web-render-performance.mjs'),
  read('dotnet/FsusUI.Avalonia.Demo/RenderPerformanceRunner.cs'),
  read('docs/performance/real-render-benchmarks.md'),
  read('package.json'),
  read('.github/workflows/quality.yml'),
  read('.github/workflows/_quality.yml'),
  read('scripts/avalonia-performance-budget.mjs'),
  read('scripts/render-performance-impact-plan.mjs'),
  read('spec/ci/pr-render-performance-ownership.json'),
  read('tests/fixtures/render-performance-impact-plan/cases.json'),
  read('vue/packages/demo-app/src/PerformanceFixture.vue'),
  read('vue/packages/demo-app/src/markdown-feature-performance.ts'),
  read('docs/migration/markdown-feature-output-gateway.md'),
])

const failures = []
for (const token of [
  "['virtual-list-fixed', 1_000]",
  "['virtual-list-fixed', 10_000]",
  "['virtual-list-fixed', 100_000]",
  "['virtual-list-variable', 100_000]",
  "['virtual-grid', 100_000]",
  "['markdown-cold', 24 * 1024]",
  "['markdown-hot', 1024 * 1024]",
  "['markdown-feature-activation', 4_096]",
  "['select-v2', 100_000]",
  "['table', 1_000]",
  "['data-pipeline-table', 100_000]",
  '[60, 120].flatMap',
  "['enabled', 'reduced', 'disabled']",
  'scenarioDefinitions.flatMap',
  'Tracing.start',
  'workerProbe',
  'workerPoolBurstProbe',
  'wasmProbe',
  'dataPipelineProbe',
  'revision !== activationRevisions[index - 1] + 1',
  'samples !== 5',
  "scenario === 'markdown-feature-activation'",
  'if (measureDomParses)',
  'DOM parser instrumentation is unavailable',
  'iteration, measureDomParses',
  'domParseOperationStats',
  'domParseOperations.some((entry) => entry.unsupported.length > 0)',
  'domParseOperationTotal(entry.counts) <= 0',
  'Number.isFinite(before)',
  'beforeDom.max',
  'afterDom.max > beforeDom.max',
  "entry.scenario === 'markdown-feature-activation'",
  "['p50', 'p95']",
  'after > before * 1.05',
]) {
  if (!web.includes(token)) failures.push(`web runner missing ${token}`)
}
for (const token of [
  ':content-version="markdownContentVersion"',
  '@features-activated="captureMarkdownFeatureActivation"',
  'await cycle.completion',
  'activationRevision: completedMarkdownActivationRevision.value',
]) {
  if (!performanceFixture.includes(token))
    failures.push(`Markdown feature fixture missing ${token}`)
}
for (const token of [
  "'code-highlight'",
  "'latex'",
  "'mermaid'",
  "'sequenceDiagram'",
  String.raw`\begin{aligned}`,
  "'```typescript'",
  'markdown_feature_activation_already_pending',
]) {
  if (!markdownFeatureFixture.includes(token))
    failures.push(`Markdown feature activation contract missing ${token}`)
}
for (const token of [
  'RenderTargetBitmap',
  'MeasureArrangeMs',
  'ScrollToIndex',
  'ScrollToCell',
  'SortBy',
  'Expand',
  'RequestedThemeVariant',
  'RenderingBackend',
  'GetAllocatedBytesForCurrentThread',
  'CollectionCount',
]) {
  if (!avalonia.includes(token))
    failures.push(`Avalonia runner missing ${token}`)
}
for (const token of [
  'Budget definitions',
  'Static fixtures',
  'Real measurements',
  'pnpm perf:render',
  'p50, p95 and p99',
  'same GitHub runner',
]) {
  if (!docs.includes(token)) failures.push(`documentation missing ${token}`)
}
if (!packageJson.includes('"perf:render"'))
  failures.push('single reproduction command missing')
const buildDemoCommand = JSON.parse(packageJson).scripts?.['build:demo'] ?? ''
if (
  !buildDemoCommand.includes('pnpm run ensure:wasm') ||
  !buildDemoCommand.includes('pnpm run -C vue/packages/demo-app build') ||
  buildDemoCommand.indexOf('pnpm run ensure:wasm') >
    buildDemoCommand.indexOf('pnpm run -C vue/packages/demo-app build')
) {
  failures.push('Release demo owner must materialize Wasm before demo build')
}
if (!markdownFeatureMigration.includes('pnpm run build:demo'))
  failures.push('Markdown feature migration missing complete Release demo owner')
if (
  markdownFeatureMigration.includes('pnpm -C vue/packages/demo-app build')
) {
  failures.push(
    'Markdown feature migration must not use a bare demo build for paired Release measurement',
  )
}
if (!quality.includes('pr-real-render-performance'))
  failures.push('PR quick matrix missing')
if (!quality.includes('performance-baseline'))
  failures.push('same-runner PR baseline missing')
for (const token of [
  'Plan PR real-render impact before heavy setup',
  'cache-dependency-path',
  'performance-impact-plan.json',
  'Measure same-runner baseline first',
  'Measure current quick matrix',
]) {
  if (!quality.includes(token))
    failures.push(`PR impact workflow missing ${token}`)
}
for (const token of [
  'emscripten-core/setup-emsdk@v15',
  'Prepare baseline WASM artifacts',
  'Prepare current WASM artifacts',
  'pnpm run ensure:wasm',
]) {
  if (!quality.includes(token))
    failures.push(`PR real-render artifact preflight missing ${token}`)
}
for (const token of [
  'emscripten-core/setup-emsdk@v15',
  'pnpm run ensure:wasm',
]) {
  if (!reusable.includes(token))
    failures.push(`Reusable real-render artifact preflight missing ${token}`)
}
if (
  quality.indexOf('Plan PR real-render impact before heavy setup') >
  quality.indexOf('Install current dependencies')
)
  failures.push('PR impact plan must precede dependency installation')
if (
  quality.indexOf('Measure same-runner baseline first') >
  quality.indexOf('Measure current quick matrix')
)
  failures.push('PR measurements must remain sequential baseline then current')
for (const token of [
  'Git base is unavailable; selecting both full quick sets.',
  'GITHUB_OUTPUT',
  'planDigest',
]) {
  if (!impactPlanner.includes(token))
    failures.push(`impact planner missing ${token}`)
}
for (const scope of ['web-only', 'avalonia-only', 'both', 'skip']) {
  if (!ownership.includes(`"scope": "${scope}"`))
    failures.push(`ownership registry missing ${scope}`)
  if (!impactFixtures.includes(`"scope": "${scope}"`))
    failures.push(`impact fixtures missing ${scope}`)
}
if (!impactFixtures.includes('unknown becomes both'))
  failures.push('impact fixtures missing unknown safe fallback')
if (!reusable.includes("inputs.group == 'main' && 'quick' || 'full'"))
  failures.push('nightly/release full matrix missing')
if (!staticBudget.includes('static-fixture-budget-validation'))
  failures.push('static budget artifact is not labelled as fixture validation')

if (failures.length)
  throw new Error(
    `Real-render performance contract failed:\n${failures.join('\n')}`,
  )
await import('./test-render-performance-impact-plan.mjs')
console.info('Real-render performance contract passed.')
