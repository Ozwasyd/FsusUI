import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
export const driverHash =
  '00177df9361a989eee97bfe5d0d9e2cb29888352c908e5072498d334ab8b7701'
export const sustained = 'virtual-list-variable-100k-sustained'
export const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex')
export function createGcOverlay(source) {
  assert.equal(sha256(source), driverHash, 'unsupported measurement driver')
  const replace = (old, next) => {
    assert.equal(source.split(old).length, 2, `non-unique anchor: ${old}`)
    source = source.replace(old, next)
  }
  replace(
    '  private static void Render(Control control)',
    `  private static int diagnosticSample = -1;
  private static void DiagnosticMark(string phase)
  {
    if (activeScenario == "${sustained}" && diagnosticSample >= 0)
      DiagnosticEvents.Log.Phase(activeScenario, diagnosticSample, phase);
  }

  private static void Render(Control control)`,
  )
  replace(
    '        var allocationBefore = GC.GetAllocatedBytesForCurrentThread();',
    '        diagnosticSample = index;\n        DiagnosticMark("sample-start");\n        var allocationBefore = GC.GetAllocatedBytesForCurrentThread();',
  )
  for (const [old, phase] of [
    ['        var actionFinishedMs =', 'action-end'],
    ['        var layoutWatch =', 'layout-start'],
    ['        host.Arrange(new Rect(0, 0, 1120, 700));', 'measure-end'],
    ['        layoutWatch.Stop();', 'layout-end'],
    ['        var drawWatch =', 'draw-start'],
    ['        drawWatch.Stop();', 'draw-end'],
    ['        await WaitForRenderAsync();', 'dispatch-start'],
    ['        totalWatch.Stop();', 'dispatch-end'],
  ])
    replace(old, `        DiagnosticMark("${phase}");\n${old}`)
  replace(
    '        loadedWindows.Add(virtualization.LoadedWindow);',
    '        loadedWindows.Add(virtualization.LoadedWindow);\n        DiagnosticMark("sample-end");\n        diagnosticSample = -1;',
  )
  replace(
    '      LogPhase("prepare-mount");',
    '      DiagnosticEvents.Snapshot(activeScenario, "scenario-start");\n      LogPhase("prepare-mount");',
  )
  replace(
    '      var gc0Before =',
    '      DiagnosticEvents.Snapshot(activeScenario, "before-measured");\n      var gc0Before =',
  )
  replace(
    '      // Dispose-backed bitmap',
    '      DiagnosticEvents.Snapshot(activeScenario, "after-measured");\n      // Dispose-backed bitmap',
  )
  replace(
    '      LogPhase("scenario-complete");',
    '      DiagnosticEvents.Snapshot(activeScenario, "scenario-complete");\n      LogPhase("scenario-complete");',
  )
  replace(
    `    using var bitmap = new RenderTargetBitmap(new PixelSize(1120, 700), new Vector(96, 96));
    bitmap.Render(control);`,
    `    if (activeScenario != "${sustained}" || diagnosticSample < 0)
    {
      using var bitmap = new RenderTargetBitmap(new PixelSize(1120, 700), new Vector(96, 96));
      bitmap.Render(control);
      return;
    }
    DiagnosticMark("bitmap-create-start");
    using (var bitmap = new RenderTargetBitmap(new PixelSize(1120, 700), new Vector(96, 96)))
    {
      DiagnosticMark("bitmap-create-end");
      DiagnosticMark("bitmap-render-start");
      bitmap.Render(control);
      DiagnosticMark("bitmap-render-end");
      DiagnosticMark("bitmap-dispose-start");
    }
    DiagnosticMark("bitmap-dispose-end");`,
  )
  return (
    source +
    `
[System.Diagnostics.Tracing.EventSource(Name="FsusUI-RenderPhases")]
internal sealed class DiagnosticEvents : System.Diagnostics.Tracing.EventSource
{
  public static readonly DiagnosticEvents Log = new();
  [System.Diagnostics.Tracing.Event(1)]
  public void Phase(string scenario, int sample, string phase)
  { if (IsEnabled()) WriteEvent(1, scenario, sample, phase); }
  [System.Diagnostics.Tracing.Event(2)]
  public void Heap(string scenario, string phase, string data)
  { if (IsEnabled()) WriteEvent(2, scenario, phase, data); }
  public static void Snapshot(string scenario, string phase)
  {
    if (scenario != "${sustained}") return;
    var g = GC.GetGCMemoryInfo();
    Log.Heap(scenario, phase, JsonSerializer.Serialize(new {
      g.HeapSizeBytes, g.FragmentedBytes, g.TotalCommittedBytes,
      g.MemoryLoadBytes, g.TotalAvailableMemoryBytes, g.Index, g.Generation,
      ManagedBytes = GC.GetTotalMemory(false), TotalAllocatedBytes = GC.GetTotalAllocatedBytes(false),
      Gen0 = GC.CollectionCount(0), Gen1 = GC.CollectionCount(1), Gen2 = GC.CollectionCount(2)
    }));
  }
}
`
  )
}
export const diagnosticArms = Object.freeze([
  { name: 'A-isolated', product: 'baseline', scenario: sustained },
  { name: 'B-prefix', product: 'candidate', scenario: '' },
  { name: 'B-isolated', product: 'candidate', scenario: sustained },
  { name: 'A-prefix', product: 'baseline', scenario: '' },
])
