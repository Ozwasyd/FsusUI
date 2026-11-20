import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

export const AVALONIA_LAYOUT_READY_PROTOCOL = 'variable-list-layout-ready.v1'
export const AVALONIA_LAYOUT_READY_SPLIT_PROTOCOL = 'variable-list-layout-ready.v2'
export const AVALONIA_LAYOUT_READY_THEME_SPLIT_PROTOCOL = 'variable-list-layout-ready.v3'
export const AVALONIA_LAYOUT_READY_INPUT_SPLIT_PROTOCOL = 'variable-list-layout-ready.v4'
export const INPUT_SCENARIO = 'input-continuous'
export const THEME_SCENARIO = 'theme-switch'
const isSplit = protocol => protocol === AVALONIA_LAYOUT_READY_SPLIT_PROTOCOL ||
  protocol === AVALONIA_LAYOUT_READY_THEME_SPLIT_PROTOCOL ||
  protocol === AVALONIA_LAYOUT_READY_INPUT_SPLIT_PROTOCOL
export const SUSTAINED_VARIABLE_SCENARIO = 'virtual-list-variable-100k-sustained'
export const ORIGINAL_VARIABLE_SCENARIO = 'virtual-list-variable-100k'
const quick = ['virtual-list-fixed-100k', ORIGINAL_VARIABLE_SCENARIO,
  'table-v2-two-axis-100k', 'data-table-sort-select-replace',
  'tree-expand-scroll', INPUT_SCENARIO, THEME_SCENARIO]
const full = ['virtual-list-fixed-1k', 'virtual-list-fixed-10k', 'virtual-list-fixed-100k',
  'virtual-list-variable-1k', 'virtual-list-variable-10k', ORIGINAL_VARIABLE_SCENARIO,
  'table-v2-two-axis-10k', ...quick.slice(2)]
const statistics = ['FrameMs', 'ActionMs', 'RenderAwaitMs', 'MeasureArrangeMs',
  'DrawMs', 'MountUnmountMs', 'AllocatedBytes']
const counts = ['RealizedVisuals', 'RealizedContainers', 'PooledContainers',
  'RetainedMeasurements', 'LoadedWindows']
const finite = (v, label) => assert.ok(typeof v === 'number' && Number.isFinite(v) && v >= 0, `${label}: non-finite/negative value`)

export function expectedAvaloniaLayoutReadyScenarios(
  profile, scenario = '', { protocol = AVALONIA_LAYOUT_READY_PROTOCOL, partition = null } = {},
) {
  assert.ok(
    protocol === AVALONIA_LAYOUT_READY_PROTOCOL ||
      isSplit(protocol),
    'unknown native measurement protocol',
  )
  if (isSplit(protocol)) {
    assert.equal(profile, 'quick', 'split native measurement requires quick profile')
    assert.equal(scenario, '', 'split native measurement must not filter scenarios')
    const isolatedInput = protocol === AVALONIA_LAYOUT_READY_INPUT_SPLIT_PROTOCOL
    if (isolatedInput && partition === 'input') return [INPUT_SCENARIO]
    if ((isolatedInput || protocol === AVALONIA_LAYOUT_READY_THEME_SPLIT_PROTOCOL) && partition === 'theme') return [THEME_SCENARIO]
    assert.ok(partition === 'canonical' || partition === 'sustained', 'unknown native measurement partition')
    if (partition === 'sustained') return [SUSTAINED_VARIABLE_SCENARIO]
    if (isolatedInput) return quick.slice(0, -2)
    return protocol === AVALONIA_LAYOUT_READY_THEME_SPLIT_PROTOCOL ? quick.slice(0, -1) : [...quick]
  }
  assert.equal(partition, null, 'legacy measurement has no partition')
  assert.ok(profile === 'quick' || profile === 'full', 'unknown native profile')
  assert.equal(typeof scenario, 'string', 'scenario filter must be a string')
  const filter = scenario.trim() ? scenario.toLowerCase() : ''
  const ids = [...(profile === 'full' ? full : quick), SUSTAINED_VARIABLE_SCENARIO]
    .filter(id => id.toLowerCase().includes(filter))
  assert.ok(ids.length, 'native filter selected no scenarios')
  return ids
}

// Semantic validation only: source/driver/output SHA bindings belong to the launcher.
// readRaw receives a validated scenario ID and returns its parsed raw JSON.
export async function validateAvaloniaLayoutReady(
  summary, readRaw, scenario = '', impactPlan = null,
  { protocol = AVALONIA_LAYOUT_READY_PROTOCOL, partition = null, launchId = undefined } = {},
) {
  assert.equal(summary?.SchemaVersion, 2)
  assert.equal(summary.Kind, 'real-avalonia-render-measurement')
  assert.equal(summary.MeasurementProtocol, protocol)
  if (impactPlan) {
    assert.equal(impactPlan.platforms?.avalonia?.run, true, 'impact plan excludes native measurements')
    assert.equal(summary.Profile, impactPlan.measurement?.profile)
    const selected = impactPlan.platforms.avalonia.scenario ?? ''
    if (scenario) assert.equal(scenario, selected, 'filter differs from impact plan')
    scenario = selected
  }
  const ids = expectedAvaloniaLayoutReadyScenarios(summary.Profile, scenario, { protocol, partition })
  const split = isSplit(protocol)
  if (split) {
    assert.equal(summary.MeasurementPartition, partition, 'wrong summary partition')
    assert.ok(Number.isSafeInteger(summary.ProcessId) && summary.ProcessId > 0, 'invalid native process ID')
    assert.match(summary.LaunchId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u)
    assert.notEqual(summary.LaunchId, '00000000-0000-0000-0000-000000000000', 'empty launch ID')
    if (launchId !== undefined) assert.equal(summary.LaunchId, launchId, 'wrong native launch ID')
    assert.equal(summary.Environment?.RequestedBackend, 'auto')
  } else {
    assert.equal(launchId, undefined, 'legacy measurement has no launch ID')
    assert.equal(summary.MeasurementPartition, undefined, 'unexpected legacy summary partition')
  }
  assert.ok(Array.isArray(summary.Results), 'missing native Results')
  assert.deepEqual(summary.Results.map(row => row.Id), ids, 'missing, duplicate, reordered or mixed native scenarios')
  const samples = impactPlan?.measurement?.samples ?? (summary.Profile === 'full' ? 12 : 21)
  const warmups = impactPlan?.measurement?.warmups ?? (summary.Profile === 'full' ? 3 : 1)
  assert.ok(Number.isInteger(samples) && samples > 0)
  assert.ok(Number.isInteger(warmups) && warmups >= 0)
  assert.equal(summary.Runner?.Samples, samples)
  assert.equal(summary.Runner.Warmups, warmups)
  assert.equal(summary.Runner.ScenarioCount, ids.length)
  assert.ok(Number.isInteger(summary.Runner.LongScrollIterations) && summary.Runner.LongScrollIterations > 0)
  if (split) {
    assert.equal(samples, 21)
    assert.equal(warmups, 1)
    assert.equal(summary.Runner.LongScrollIterations, 256)
  }
  for (const row of summary.Results) {
    const raw = await readRaw(row.Id)
    assert.equal(raw?.Id, row.Id, 'raw identity mismatch')
    for (const item of [row, raw]) {
      assert.equal(item.MeasurementProtocol, protocol, `${row.Id}: mixed protocol`)
      assert.equal(item.MeasurementPartition, undefined, `${row.Id}: partition belongs in summary only`)
      assert.equal(item.RemountPerSample, row.Id !== SUSTAINED_VARIABLE_SCENARIO, `${row.Id}: wrong mount policy`)
      assert.equal(item.LongScroll?.Iterations, summary.Runner.LongScrollIterations)
    }
    for (const key of [...statistics, ...counts]) {
      const values = raw[key]
      assert.ok(Array.isArray(values) && values.length === samples, `${row.Id}.${key}: sample count`)
      values.forEach(v => finite(v, `${row.Id}.${key}`))
      if (statistics.includes(key)) {
        const sorted = [...values].sort((a, b) => a - b)
        const stat = row[key]
        assert.equal(stat?.Samples, samples, `${row.Id}.${key}.Samples`)
        for (const [name, fraction] of [['P50', .5], ['P95', .95], ['P99', .99]]) {
          finite(stat[name], `${row.Id}.${key}.${name}`)
          assert.equal(stat[name], sorted[Math.ceil(samples * fraction) - 1], `${row.Id}.${key}.${name}: raw mismatch`)
        }
        assert.equal(stat.Min, sorted[0]); assert.equal(stat.Max, sorted.at(-1))
      }
    }
    finite(row.DisposalMs, `${row.Id}.DisposalMs`)
  }
  return {
    protocol, profile: summary.Profile, scenarios: ids, samples, warmups,
    ...(split ? { partition, processId: summary.ProcessId, launchId: summary.LaunchId } : {}),
  }
}

export async function verifyAvaloniaLayoutReady(
  directory,
  { scenario = '', impactPlan = null, protocol = AVALONIA_LAYOUT_READY_PROTOCOL, partition = null, launchId = undefined } = {},
) {
  const summary = JSON.parse(await readFile(path.join(directory, 'summary.json'), 'utf8'))
  const result = await validateAvaloniaLayoutReady(summary,
    async id => JSON.parse(await readFile(path.join(directory, 'raw', `${id}.raw.json`), 'utf8')),
    scenario, impactPlan, { protocol, partition, launchId })
  const rawFiles = (await readdir(path.join(directory, 'raw'))).filter(name => name.endsWith('.raw.json')).sort()
  assert.deepEqual(rawFiles, result.scenarios.map(id => `${id}.raw.json`).sort(), 'extra/mixed native raw outputs')
  return result
}
