import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (file) => readFile(path.join(root, file), 'utf8')
const [web, avalonia, docs, packageJson, quality, reusable, staticBudget] =
  await Promise.all([
    read('scripts/web-render-performance.mjs'),
    read('dotnet/FsusUI.Avalonia.Demo/RenderPerformanceRunner.cs'),
    read('docs/performance/real-render-benchmarks.md'),
    read('package.json'),
    read('.github/workflows/quality.yml'),
    read('.github/workflows/_quality.yml'),
    read('scripts/avalonia-performance-budget.mjs'),
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
  "['select-v2', 100_000]",
  "['table', 1_000]",
  '[60, 120].flatMap',
  "['enabled', 'reduced', 'disabled']",
  'scenarioDefinitions.flatMap',
  'Tracing.start',
  'workerProbe',
  'workerPoolBurstProbe',
  'wasmProbe',
]) {
  if (!web.includes(token)) failures.push(`web runner missing ${token}`)
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
if (!quality.includes('pr-real-render-performance'))
  failures.push('PR quick matrix missing')
if (!quality.includes('performance-baseline'))
  failures.push('same-runner PR baseline missing')
if (!reusable.includes("inputs.group == 'main' && 'quick' || 'full'"))
  failures.push('nightly/release full matrix missing')
if (!staticBudget.includes('static-fixture-budget-validation'))
  failures.push('static budget artifact is not labelled as fixture validation')

if (failures.length)
  throw new Error(
    `Real-render performance contract failed:\n${failures.join('\n')}`,
  )
console.info('Real-render performance contract passed.')
