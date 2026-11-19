import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  createGcOverlay,
  diagnosticArms,
  sustained,
  driverHash,
  sha256,
} from './avalonia-gc-overlay.mjs'
import {
  diagnosticArguments,
  productShas,
} from './run-avalonia-gc-diagnostic.mjs'
const source = await readFile(
  new URL(
    '../dotnet/FsusUI.Avalonia.Demo/RenderPerformanceRunner.cs',
    import.meta.url,
  ),
  'utf8',
)
test('overlay pins exact original source and refuses drift or double application', () => {
  assert.equal(sha256(source), driverHash)
  const result = createGcOverlay(source)
  assert.throws(
    () => createGcOverlay(source + '\n'),
    /unsupported measurement driver/,
  )
  assert.throws(() => createGcOverlay(result), /unsupported measurement driver/)
})
test('bitmap instrumentation retains fresh targets and deterministic disposal', () => {
  const result = createGcOverlay(source)
  assert.equal(
    (
      result.match(
        /new RenderTargetBitmap\(new PixelSize\(1120, 700\), new Vector\(96, 96\)\)/g,
      ) || []
    ).length,
    2,
  )
  assert.ok(result.includes('using (var bitmap = new RenderTargetBitmap'))
  const render = result.slice(
    result.indexOf('  private static void Render(Control control)'),
    result.indexOf('  private static Task WaitForRenderAsync'),
  )
  const names = [
    'bitmap-create-start',
    'bitmap-create-end',
    'bitmap-render-start',
    'bitmap-render-end',
    'bitmap-dispose-start',
    'bitmap-dispose-end',
  ]
  assert.deepEqual(
    [...render.matchAll(/DiagnosticMark\("([^"]+)"\)/g)].map((x) => x[1]),
    names,
  )
  assert.ok(result.includes('diagnosticSample = -1;'))
  assert.ok(
    result.includes(
      `activeScenario == "${sustained}" && diagnosticSample >= 0`,
    ),
  )
})
test('product factories, readiness and percentiles are unchanged', () => {
  const result = createGcOverlay(source)
  for (const signature of [
    '  private static void EnsureVariableListLayoutReady',
    '  private static (string, Func<Control>, Action<Control, int>) VirtualList',
  ]) {
    const start = source.indexOf(signature)
    assert.ok(start >= 0)
    const end = source.indexOf('\n  private static ', start + signature.length)
    assert.ok(result.includes(source.slice(start, end)))
  }
  assert.ok(
    result.includes(
      'GC.Collect(2, GCCollectionMode.Forced, blocking: true, compacting: false);',
    ),
  )
})
test('four fresh arms preserve exact full prefix or exact isolated selector; no backend override', () => {
  assert.deepEqual(
    diagnosticArms.map((x) => x.name),
    ['A-isolated', 'B-prefix', 'B-isolated', 'A-prefix'],
  )
  assert.equal(
    productShas.candidate,
    '4923ba3e148efc84792bef0c5c7593a706b5efc7',
  )
  for (const arm of diagnosticArms) {
    const args = diagnosticArguments('/Demo.dll', '/output', arm.scenario)
    assert.equal(args.includes('--scenario'), Boolean(arm.scenario))
    assert.equal(args.includes('--backend'), false)
    assert.deepEqual(args.slice(1, 10), [
      '--render-performance',
      '--profile',
      'quick',
      '--warmups',
      '1',
      '--samples',
      '21',
      '--long-scroll-iterations',
      '256',
    ])
  }
})
