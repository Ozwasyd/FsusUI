import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { URL } from 'node:url'
import {
  nativePartitionPath,
  nativeSplitProtocol,
  readNativeBinding,
  supportedNativeProtocol,
} from './run-avalonia-layout-ready.mjs'
import {
  SUSTAINED_VARIABLE_SCENARIO,
  THEME_SCENARIO,
  verifyAvaloniaLayoutReady,
} from './verify-avalonia-layout-ready.mjs'

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))
const policyPath = new URL(
  '../tests/performance/render-performance-policy.json',
  import.meta.url,
)

export function identifyNativeProtocol(declared, summaries) {
  const recorded = summaries.map(
    (summary) => summary.MeasurementProtocol || null,
  )
  const effective = declared || recorded.find(Boolean) || null
  if (effective === null) return null
  assert.ok(supportedNativeProtocol(effective), 'unsupported Avalonia protocol')
  assert.ok(
    recorded.every((value) => value === effective),
    'declared and recorded native protocols must match in all arms',
  )
  return effective
}

export function requireSplitPlan(plan) {
  assert.equal(
    plan?.platforms?.avalonia?.run,
    true,
    'split requires native impact plan',
  )
  assert.equal(
    plan.platforms.avalonia.scenario ?? '',
    '',
    'split requires full quick scenario scope',
  )
  assert.equal(
    plan.measurement?.profile,
    'quick',
    'split requires quick profile',
  )
  assert.equal(
    plan.measurement?.samples,
    21,
    'split requires original sample count',
  )
  assert.equal(
    plan.measurement?.warmups,
    1,
    'split requires original warmup count',
  )
}

function checkIsolatedAbsolute(summary, policy, scenario, label) {
  const result = summary.Results[0]
  assert.equal(result.Id, scenario)
  assert.ok(
    Number.isFinite(result.FrameMs.P95) &&
      result.FrameMs.P95 <= policy.maxP95FrameMs,
    `${label} absolute frame p95 runaway limit`,
  )
  assert.ok(
    Number.isFinite(result.AllocatedBytes.Max) &&
      result.AllocatedBytes.Max <= policy.maxPeakAllocatedBytesPerSample,
    `${label} absolute allocation runaway limit`,
  )
  const retained = result.RetainedVisuals?.AfterUnload
  assert.ok(
    Number.isSafeInteger(retained) &&
      retained >= 0 &&
      retained <= policy.maxRetainedVisuals,
    `${label} absolute retained visuals runaway limit`,
  )
}

export const checkSustainedAbsolute = (summary, policy) =>
  checkIsolatedAbsolute(summary, policy, SUSTAINED_VARIABLE_SCENARIO, 'sustained')
export const checkThemeAbsolute = (summary, policy) =>
  checkIsolatedAbsolute(summary, policy, THEME_SCENARIO, 'theme')

export function checkHistoricalSplitDisposal({ theme, sustained }) {
  for (const [partition, summary] of [
    ['theme', theme],
    ['sustained', sustained],
  ]) {
    if (!summary) continue
    assert.equal(
      summary.Results[0].RetainedVisuals?.ReturnedToBaseline,
      true,
      `historical ${partition} visual disposal evidence`,
    )
  }
}

// Keep the historical-format canonical file and the isolated result intact on disk.
export async function verifyAvaloniaSplitArm(
  output,
  { productSha, driverHash, plan, startedAt, protocol = nativeSplitProtocol },
) {
  requireSplitPlan(plan)
  const binding = await readNativeBinding(
    output,
    productSha,
    driverHash,
    '',
    protocol,
  )
  const summaries = new Map()
  for (const { partition, launchId } of binding.partitions) {
    const directory = nativePartitionPath(output, partition)
    await verifyAvaloniaLayoutReady(directory, {
      impactPlan: plan,
      protocol,
      partition,
      launchId,
    })
    const summary = await readJson(path.join(directory, 'summary.json'))
    assert.equal(
      summary.Runner.LongScrollIterations,
      256,
      'split requires original long-scroll work',
    )
    assert.ok(
      Number.isFinite(Date.parse(summary.GeneratedAt)),
      'split timestamps required',
    )
    if (startedAt !== undefined)
      assert.ok(
        Date.parse(summary.GeneratedAt) >= startedAt,
        'stale split launch',
      )
    for (const key of [
      'RenderingBackend',
      'PlatformGraphicsBackend',
      'WindowPlatform',
    ]) {
      assert.ok(
        typeof summary.Environment?.[key] === 'string' &&
          summary.Environment[key].length > 0 &&
          summary.Environment[key] !== 'unresolved',
        `split must resolve ${key}`,
      )
    }
    const previous = [...summaries.values()].at(-1)
    if (previous) {
      assert.deepEqual(previous.Environment, summary.Environment, 'split runtime or backend changed')
      assert.ok(Date.parse(previous.GeneratedAt) <= Date.parse(summary.GeneratedAt), 'split launch order changed')
    }
    summaries.set(partition, summary)
  }
  const { canonical, theme, sustained } = Object.fromEntries(summaries)
  if (binding.historical) checkHistoricalSplitDisposal({ theme, sustained })
  const policy = await readJson(policyPath)
  checkSustainedAbsolute(sustained, policy.avalonia)
  if (theme) checkThemeAbsolute(theme, policy.avalonia)
  return theme ? { canonical, theme, sustained } : { canonical, sustained }
}
