import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

export const AVALONIA_LAYOUT_READY_PROTOCOL = 'variable-list-layout-ready.v1'
export const SUSTAINED_VARIABLE_SCENARIO = 'virtual-list-variable-100k-sustained'
export const ORIGINAL_VARIABLE_SCENARIO = 'virtual-list-variable-100k'
const quick = ['virtual-list-fixed-100k', ORIGINAL_VARIABLE_SCENARIO,
  'table-v2-two-axis-100k', 'data-table-sort-select-replace',
  'tree-expand-scroll', 'input-continuous', 'theme-switch']
const full = ['virtual-list-fixed-1k', 'virtual-list-fixed-10k', 'virtual-list-fixed-100k',
  'virtual-list-variable-1k', 'virtual-list-variable-10k', ORIGINAL_VARIABLE_SCENARIO,
  'table-v2-two-axis-10k', ...quick.slice(2)]
const statistics = ['FrameMs', 'ActionMs', 'RenderAwaitMs', 'MeasureArrangeMs',
  'DrawMs', 'MountUnmountMs', 'AllocatedBytes']
const counts = ['RealizedVisuals', 'RealizedContainers', 'PooledContainers',
  'RetainedMeasurements', 'LoadedWindows']
const finite = (v, label) => assert.ok(typeof v === 'number' && Number.isFinite(v) && v >= 0, `${label}: non-finite/negative value`)

export function expectedAvaloniaLayoutReadyScenarios(profile, scenario = '') {
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
export async function validateAvaloniaLayoutReady(summary, readRaw, scenario = '', impactPlan = null) {
  assert.equal(summary?.SchemaVersion, 2)
  assert.equal(summary.Kind, 'real-avalonia-render-measurement')
  assert.equal(summary.MeasurementProtocol, AVALONIA_LAYOUT_READY_PROTOCOL)
  if (impactPlan) {
    assert.equal(impactPlan.platforms?.avalonia?.run, true, 'impact plan excludes native measurements')
    assert.equal(summary.Profile, impactPlan.measurement?.profile)
    const selected = impactPlan.platforms.avalonia.scenario ?? ''
    if (scenario) assert.equal(scenario, selected, 'filter differs from impact plan')
    scenario = selected
  }
  const ids = expectedAvaloniaLayoutReadyScenarios(summary.Profile, scenario)
  assert.ok(Array.isArray(summary.Results), 'missing native Results')
  assert.deepEqual(summary.Results.map(row => row.Id), ids, 'missing, duplicate, reordered or mixed native scenarios')
  assert.equal(impactPlan, null, 'calibration must not impersonate a formal impact plan')
  assert.equal(summary.Profile, 'quick')
  assert.equal(scenario, SUSTAINED_VARIABLE_SCENARIO)
  const samples = 61
  const warmups = impactPlan?.measurement?.warmups ?? (summary.Profile === 'full' ? 3 : 1)
  assert.ok(Number.isInteger(samples) && samples > 0)
  assert.ok(Number.isInteger(warmups) && warmups >= 0)
  assert.equal(summary.Runner?.Samples, samples)
  assert.equal(summary.Runner.Warmups, warmups)
  assert.equal(summary.Runner.ScenarioCount, ids.length)
  assert.ok(Number.isInteger(summary.Runner.LongScrollIterations) && summary.Runner.LongScrollIterations > 0)
  for (const row of summary.Results) {
    const raw = await readRaw(row.Id)
    assert.equal(raw?.Id, row.Id, 'raw identity mismatch')
    for (const item of [row, raw]) {
      assert.equal(item.MeasurementProtocol, AVALONIA_LAYOUT_READY_PROTOCOL, `${row.Id}: mixed protocol`)
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
  return { protocol: AVALONIA_LAYOUT_READY_PROTOCOL, profile: summary.Profile, scenarios: ids, samples, warmups }
}

export async function verifyAvaloniaLayoutReady(directory, { scenario = '', impactPlan = null } = {}) {
  const summary = JSON.parse(await readFile(path.join(directory, 'summary.json'), 'utf8'))
  const result = await validateAvaloniaLayoutReady(summary,
    async id => JSON.parse(await readFile(path.join(directory, 'raw', `${id}.raw.json`), 'utf8')),
    scenario, impactPlan)
  const rawFiles = (await readdir(path.join(directory, 'raw'))).filter(name => name.endsWith('.raw.json')).sort()
  assert.deepEqual(rawFiles, result.scenarios.map(id => `${id}.raw.json`).sort(), 'extra/mixed native raw outputs')
  return result
}
