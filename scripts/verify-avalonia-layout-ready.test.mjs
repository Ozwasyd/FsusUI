import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AVALONIA_LAYOUT_READY_PROTOCOL as protocol,
  AVALONIA_LAYOUT_READY_SPLIT_PROTOCOL as splitProtocol,
  AVALONIA_LAYOUT_READY_THEME_SPLIT_PROTOCOL as themeProtocol,
  THEME_SCENARIO as theme,
  INPUT_SCENARIO as input,
  AVALONIA_LAYOUT_READY_INPUT_SPLIT_PROTOCOL as inputProtocol,
  ORIGINAL_VARIABLE_SCENARIO as remount,
  SUSTAINED_VARIABLE_SCENARIO as sustained,
  expectedAvaloniaLayoutReadyScenarios,
  validateAvaloniaLayoutReady,
} from './verify-avalonia-layout-ready.mjs'

const metrics = ['FrameMs', 'ActionMs', 'RenderAwaitMs', 'MeasureArrangeMs', 'DrawMs', 'MountUnmountMs', 'AllocatedBytes']
const counts = ['RealizedVisuals', 'RealizedContainers', 'PooledContainers', 'RetainedMeasurements', 'LoadedWindows']
const fixture = ({ protocol: chosenProtocol = protocol, partition = null } = {}) => {
  const scenario = partition === null ? remount : ''
  const ids = expectedAvaloniaLayoutReadyScenarios('quick', scenario, { protocol: chosenProtocol, partition })
  const launchId = 'be871883-cfdd-4370-8ce8-47976c396760'
  const raw = Object.fromEntries(ids.map((id) => [
    id,
    {
      Id: id,
      MeasurementProtocol: chosenProtocol,
      RemountPerSample: id !== sustained,
      LongScroll: { Iterations: 256 },
      ...Object.fromEntries([...metrics, ...counts].map((key) => [key, Array(21).fill(1)])),
    },
  ]))
  const summary = {
    SchemaVersion: 2,
    Kind: 'real-avalonia-render-measurement',
    Profile: 'quick',
    MeasurementProtocol: chosenProtocol,
    ...(partition === null ? {} : {
      MeasurementPartition: partition, ProcessId: 42, LaunchId: launchId,
      Environment: { RequestedBackend: 'auto' },
    }),
    Runner: { Samples: 21, Warmups: 1, ScenarioCount: ids.length, LongScrollIterations: 256 },
    Results: ids.map((id) => ({
      ...raw[id],
      DisposalMs: 1,
      ...Object.fromEntries(metrics.map((key) => [key, { Samples: 21, P50: 1, P95: 1, P99: 1, Min: 1, Max: 1 }])),
    })),
  }
  return {
    summary,
    raw,
    verify: (expectedLaunchId = partition === null ? undefined : launchId) =>
      validateAvaloniaLayoutReady(summary, (id) => raw[id], scenario, null, {
        protocol: chosenProtocol, partition, launchId: expectedLaunchId,
      }),
  }
}

test('remount remains a separate required scenario next to sustained scrolling', async () => {
  assert.deepEqual(expectedAvaloniaLayoutReadyScenarios('quick', remount), [remount, sustained])
  assert.deepEqual(expectedAvaloniaLayoutReadyScenarios('quick', sustained), [sustained])
  assert.equal(expectedAvaloniaLayoutReadyScenarios('quick').length, 8)
  assert.equal(expectedAvaloniaLayoutReadyScenarios('full').length, 13)
  assert.deepEqual((await fixture().verify()).scenarios, [remount, sustained])
})

test('rejects old/mixed producers, missing remount, and incorrect mount policy', async () => {
  const mixed = fixture()
  mixed.raw[sustained].MeasurementProtocol = null
  await assert.rejects(mixed.verify, /mixed protocol/u)
  const missing = fixture()
  missing.summary.Results.shift()
  await assert.rejects(missing.verify, /missing, duplicate/u)
  const incorrect = fixture()
  incorrect.raw[sustained].RemountPerSample = true
  await assert.rejects(incorrect.verify, /wrong mount policy/u)
})

test('rejects inconsistent percentile or raw sample count', async () => {
  const statistic = fixture()
  statistic.summary.Results[0].FrameMs.P95 = 0.5
  await assert.rejects(statistic.verify, /raw mismatch/u)
  const truncated = fixture()
  truncated.raw[remount].FrameMs.pop()
  await assert.rejects(truncated.verify, /sample count/u)
})

test('v2 preserves the complete canonical quick matrix and exactly one sustained row', async () => {
  const canonical = fixture({ protocol: splitProtocol, partition: 'canonical' })
  const isolated = fixture({ protocol: splitProtocol, partition: 'sustained' })
  const { scenarios } = await canonical.verify()
  assert.deepEqual([...scenarios, sustained], expectedAvaloniaLayoutReadyScenarios('quick'))
  assert.deepEqual((await isolated.verify()).scenarios, [sustained])
  assert.equal((await isolated.verify()).processId, 42)
  assert.throws(() => expectedAvaloniaLayoutReadyScenarios('quick', remount, {
    protocol: splitProtocol, partition: 'canonical',
  }), /must not filter/u)
})

test('v2 rejects mixed payloads, missing rows, wrong launch, and changed workload', async () => {
  const canonical = fixture({ protocol: splitProtocol, partition: 'canonical' })
  canonical.summary.Results.pop()
  await assert.rejects(canonical.verify, /missing, duplicate/u)
  const isolated = fixture({ protocol: splitProtocol, partition: 'sustained' })
  await assert.rejects(() => isolated.verify('3862c3c5-5a52-43b2-90dc-96c17dafc206'), /wrong native launch ID/u)
  isolated.summary.MeasurementPartition = 'canonical'
  await assert.rejects(isolated.verify, /wrong summary partition/u)
  const duplicatePartition = fixture({ protocol: splitProtocol, partition: 'sustained' })
  duplicatePartition.raw[sustained].MeasurementPartition = 'sustained'
  await assert.rejects(duplicatePartition.verify, /summary only/u)
  const changed = fixture({ protocol: splitProtocol, partition: 'sustained' })
  changed.summary.Runner.LongScrollIterations = 1
  await assert.rejects(changed.verify, /1 !== 256/u)
})


test('v3 isolates exactly theme and sustained while keeping all original quick rows', async () => {
  const canonical = fixture({ protocol: themeProtocol, partition: 'canonical' })
  const isolated = fixture({ protocol: themeProtocol, partition: 'theme' })
  const scrolling = fixture({ protocol: themeProtocol, partition: 'sustained' })
  const { scenarios } = await canonical.verify()
  assert.equal(scenarios.length, 6)
  assert.deepEqual((await isolated.verify()).scenarios, [theme])
  assert.deepEqual([...scenarios, theme, ...(await scrolling.verify()).scenarios],
    expectedAvaloniaLayoutReadyScenarios('quick'))
  assert.throws(() => expectedAvaloniaLayoutReadyScenarios('quick', '', {
    protocol: splitProtocol, partition: 'theme',
  }), /unknown/u)
  assert.throws(() => expectedAvaloniaLayoutReadyScenarios('quick', theme, {
    protocol: themeProtocol, partition: 'theme',
  }), /must not filter/u)
  isolated.raw[theme].MeasurementProtocol = splitProtocol
  await assert.rejects(isolated.verify, /mixed protocol/u)
  canonical.summary.Results.push(isolated.summary.Results[0])
  await assert.rejects(canonical.verify, /missing, duplicate/u)
})


test('v4 keeps fixed first and binds each remaining row to exactly one partition', async () => {
  const get = (partition) => fixture({ protocol: inputProtocol, partition })
  const canonical = get('canonical')
  const isolated = get('input')
  const { scenarios } = await canonical.verify()
  assert.deepEqual(scenarios, [
    'virtual-list-fixed-100k',
    remount,
    'table-v2-two-axis-100k',
    'data-table-sort-select-replace',
    'tree-expand-scroll',
  ])
  assert.deepEqual((await isolated.verify()).scenarios, [input])
  assert.deepEqual((await get('theme').verify()).scenarios, [theme])
  assert.deepEqual((await get('sustained').verify()).scenarios, [sustained])
  assert.deepEqual([...scenarios, input, theme, sustained], expectedAvaloniaLayoutReadyScenarios('quick'))
  assert.throws(() => expectedAvaloniaLayoutReadyScenarios('quick', '', {
    protocol: themeProtocol, partition: 'input',
  }), /unknown/u)
  await assert.rejects(() => isolated.verify('3862c3c5-5a52-43b2-90dc-96c17dafc206'), /wrong native launch ID/u)
  isolated.raw[input].MeasurementProtocol = themeProtocol
  await assert.rejects(isolated.verify, /mixed protocol/u)
  canonical.summary.Results.push(isolated.summary.Results[0])
  await assert.rejects(canonical.verify, /missing, duplicate/u)
})
