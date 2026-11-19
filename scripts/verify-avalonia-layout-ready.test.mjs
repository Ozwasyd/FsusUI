import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AVALONIA_LAYOUT_READY_PROTOCOL as protocol,
  ORIGINAL_VARIABLE_SCENARIO as remount,
  SUSTAINED_VARIABLE_SCENARIO as sustained,
  expectedAvaloniaLayoutReadyScenarios,
  validateAvaloniaLayoutReady,
} from './verify-avalonia-layout-ready.mjs'

const metrics = [
  'FrameMs',
  'ActionMs',
  'RenderAwaitMs',
  'MeasureArrangeMs',
  'DrawMs',
  'MountUnmountMs',
  'AllocatedBytes',
]
const counts = [
  'RealizedVisuals',
  'RealizedContainers',
  'PooledContainers',
  'RetainedMeasurements',
  'LoadedWindows',
]
const fixture = () => {
  const scenario = remount
  const raw = Object.fromEntries(
    [remount, sustained].map((id) => [
      id,
      {
        Id: id,
        MeasurementProtocol: protocol,
        RemountPerSample: id === remount,
        LongScroll: { Iterations: 256 },
        ...Object.fromEntries(
          [...metrics, ...counts].map((key) => [key, Array(21).fill(1)]),
        ),
      },
    ]),
  )
  const summary = {
    SchemaVersion: 2,
    Kind: 'real-avalonia-render-measurement',
    Profile: 'quick',
    MeasurementProtocol: protocol,
    Runner: {
      Samples: 21,
      Warmups: 1,
      ScenarioCount: 2,
      LongScrollIterations: 256,
    },
    Results: [remount, sustained].map((id) => ({
      ...raw[id],
      DisposalMs: 1,
      ...Object.fromEntries(
        metrics.map((key) => [
          key,
          { Samples: 21, P50: 1, P95: 1, P99: 1, Min: 1, Max: 1 },
        ]),
      ),
    })),
  }
  return {
    summary,
    raw,
    verify: () =>
      validateAvaloniaLayoutReady(summary, (id) => raw[id], scenario),
  }
}

test('remount remains a separate required scenario next to sustained scrolling', async () => {
  assert.deepEqual(expectedAvaloniaLayoutReadyScenarios('quick', remount), [
    remount,
    sustained,
  ])
  assert.deepEqual(expectedAvaloniaLayoutReadyScenarios('quick', sustained), [
    sustained,
  ])
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

test('isolated sustained diagnostic is valid only under its explicit filter, never the formal quick matrix', async () => {
  const { summary, raw } = fixture()
  summary.Results = summary.Results.filter((row) => row.Id === sustained)
  summary.Runner.ScenarioCount = 1
  const readRaw = (id) => raw[id]
  const result = await validateAvaloniaLayoutReady(summary, readRaw, sustained)
  assert.deepEqual(result.scenarios, [sustained])
  assert.equal(result.samples, 21)
  assert.equal(result.warmups, 1)
  await assert.rejects(
    validateAvaloniaLayoutReady(summary, readRaw),
    /missing, duplicate, reordered/u,
  )
  await assert.rejects(
    validateAvaloniaLayoutReady(summary, readRaw, remount),
    /missing, duplicate, reordered/u,
  )
  const formalPlan = {
    platforms: { avalonia: { run: true, scenario: null } },
    measurement: { profile: 'quick', samples: 21, warmups: 1 },
  }
  await assert.rejects(
    validateAvaloniaLayoutReady(summary, readRaw, sustained, formalPlan),
    /filter differs from impact plan/u,
  )
})
