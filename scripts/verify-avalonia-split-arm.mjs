import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { URL } from 'node:url'
import {
  nativePartitionPath,
  nativeSplitProtocol,
  readNativeBinding,
} from './run-avalonia-layout-ready.mjs'
import {
  SUSTAINED_VARIABLE_SCENARIO,
  verifyAvaloniaLayoutReady,
} from './verify-avalonia-layout-ready.mjs'

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))
const policyPath = new URL(
  '../tests/performance/render-performance-policy.json',
  import.meta.url,
)

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

export function checkSustainedAbsolute(summary, policy) {
  const result = summary.Results[0]
  assert.equal(result.Id, SUSTAINED_VARIABLE_SCENARIO)
  assert.ok(
    Number.isFinite(result.FrameMs.P95) &&
      result.FrameMs.P95 <= policy.maxP95FrameMs,
    'sustained absolute frame p95 runaway limit',
  )
  assert.ok(
    Number.isFinite(result.AllocatedBytes.Max) &&
      result.AllocatedBytes.Max <= policy.maxPeakAllocatedBytesPerSample,
    'sustained absolute allocation runaway limit',
  )
  const retained = result.RetainedVisuals?.AfterUnload
  assert.ok(
    Number.isSafeInteger(retained) &&
      retained >= 0 &&
      retained <= policy.maxRetainedVisuals,
    'sustained absolute retained visuals runaway limit',
  )
}

// Keep the historical-format canonical file and the isolated result intact on disk.
export async function verifyAvaloniaSplitArm(
  output,
  { productSha, driverHash, plan, startedAt },
) {
  requireSplitPlan(plan)
  const binding = await readNativeBinding(
    output,
    productSha,
    driverHash,
    '',
    nativeSplitProtocol,
  )
  const summaries = []
  for (const { partition, launchId } of binding.partitions) {
    const directory = nativePartitionPath(output, partition)
    await verifyAvaloniaLayoutReady(directory, {
      impactPlan: plan,
      protocol: nativeSplitProtocol,
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
    summaries.push(summary)
  }
  const [canonical, sustained] = summaries
  assert.deepEqual(
    canonical.Environment,
    sustained.Environment,
    'split runtime or backend changed',
  )
  assert.ok(
    Date.parse(canonical.GeneratedAt) <= Date.parse(sustained.GeneratedAt),
    'split launch order changed',
  )
  const policy = await readJson(policyPath)
  checkSustainedAbsolute(sustained, policy.avalonia)
  return { canonical, sustained }
}
