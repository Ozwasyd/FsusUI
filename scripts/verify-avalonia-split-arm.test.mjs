import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  nativeSplitProtocol,
  readNativeBinding,
} from './run-avalonia-layout-ready.mjs'
import {
  checkSustainedAbsolute,
  identifyNativeProtocol,
  requireSplitPlan,
} from './verify-avalonia-split-arm.mjs'

const scope = {
  platforms: { avalonia: { run: true, scenario: null } },
  measurement: { profile: 'quick', samples: 21, warmups: 1 },
}
test('rejects narrowed and altered formal split scope', () => {
  requireSplitPlan(scope)
  for (const change of [
    (p) => {
      p.platforms.avalonia.scenario = 'virtual-list'
    },
    (p) => {
      p.measurement.samples = 61
    },
    (p) => {
      p.measurement.warmups = 0
    },
    (p) => {
      p.measurement.profile = 'full'
    },
  ]) {
    const p = structuredClone(scope)
    change(p)
    assert.throws(() => requireSplitPlan(p))
  }
})

test('sustained alone cannot bypass any unchanged absolute control', () => {
  const policy = {
    maxP95FrameMs: 30,
    maxPeakAllocatedBytesPerSample: 2048,
    maxRetainedVisuals: 4,
  }
  const sample = {
    Results: [
      {
        Id: 'virtual-list-variable-100k-sustained',
        FrameMs: { P95: 30 },
        AllocatedBytes: { Max: 2048 },
        RetainedVisuals: { AfterUnload: 4 },
      },
    ],
  }
  checkSustainedAbsolute(sample, policy)
  for (const change of [
    (r) => {
      r.FrameMs.P95 += 0.1
    },
    (r) => {
      r.AllocatedBytes.Max += 1
    },
    (r) => {
      r.RetainedVisuals.AfterUnload += 1
    },
  ]) {
    const s = structuredClone(sample)
    change(s.Results[0])
    assert.throws(() => checkSustainedAbsolute(s, policy))
  }
})

const digest = (s) => createHash('sha256').update(s).digest('hex')
test('two-process binding rejects a missing child, substituted payload, and duplicate PID', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'fsus-split-binding-'))
  const productSha = 'a'.repeat(40)
  const driverSha = 'b'.repeat(64)
  const manifest = path.join(output, 'measurement-layout-binding.json')
  try {
    const partitions = []
    for (const [i, partition] of ['canonical', 'sustained'].entries()) {
      const directory =
        partition === 'canonical' ? output : path.join(output, partition)
      const launchId = `00000000-0000-0000-0000-00000000000${i + 1}`
      const processId = i + 100
      await mkdir(path.join(directory, 'raw'), { recursive: true })
      const summary = JSON.stringify({
        GitSha: productSha,
        MeasurementProtocol: nativeSplitProtocol,
        MeasurementPartition: partition,
        LaunchId: launchId,
        ProcessId: processId,
      })
      const raw = JSON.stringify({ Id: partition })
      await writeFile(path.join(directory, 'summary.json'), summary)
      await writeFile(path.join(directory, 'raw', `${partition}.raw.json`), raw)
      partitions.push({
        partition,
        launchId,
        processId,
        artifacts: {
          'summary.json': digest(summary),
          [`raw/${partition}.raw.json`]: digest(raw),
        },
      })
    }
    const common = {
      schemaVersion: 2,
      protocol: nativeSplitProtocol,
      productSha,
      effectiveDriverSha256: driverSha,
      originalDriverSha256: driverSha,
      scenario: '',
      demoAssemblySha256: driverSha,
      historical: false,
    }
    await writeFile(manifest, JSON.stringify({ ...common, partitions }))
    assert.equal(
      (
        await readNativeBinding(
          output,
          productSha,
          driverSha,
          '',
          nativeSplitProtocol,
        )
      ).partitions.length,
      2,
    )
    await writeFile(
      manifest,
      JSON.stringify({ ...common, partitions: partitions.slice(0, 1) }),
    )
    await assert.rejects(
      readNativeBinding(output, productSha, driverSha, '', nativeSplitProtocol),
      /split manifest incomplete/u,
    )
    await writeFile(manifest, JSON.stringify({ ...common, partitions }))
    const sustainedSummary = path.join(output, 'sustained', 'summary.json')
    const modified = JSON.stringify({
      GitSha: productSha,
      MeasurementProtocol: nativeSplitProtocol,
      MeasurementPartition: 'sustained',
      LaunchId: partitions[1].launchId,
      ProcessId: partitions[0].processId,
    })
    await writeFile(sustainedSummary, modified)
    await assert.rejects(
      readNativeBinding(output, productSha, driverSha, '', nativeSplitProtocol),
      /distinct process identities/u,
    )
    await writeFile(sustainedSummary, modified.replace('100', '900'))
    await assert.rejects(
      readNativeBinding(output, productSha, driverSha, '', nativeSplitProtocol),
      /partition artifact mismatch/u,
    )
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})

test('all four declared and recorded protocols must agree in both directions', () => {
  const v1 = 'variable-list-layout-ready.v1'
  const v2 = nativeSplitProtocol
  const inputs = (...protocols) =>
    protocols.map((MeasurementProtocol) => ({ MeasurementProtocol }))
  assert.equal(identifyNativeProtocol(v2, inputs(v2, v2, v2, v2)), v2)
  assert.equal(identifyNativeProtocol(undefined, inputs(v1, v1, v1, v1)), v1)
  assert.equal(identifyNativeProtocol(undefined, inputs(null, null)), null)
  for (const [declared, sample] of [
    [v1, inputs(v2, v2, v2, v2)],
    [v2, inputs(v1, v1, v1, v1)],
    [v2, inputs(v2, v2, v2, null)],
    [undefined, inputs(v2, v2, v2, v1)],
  ])
    assert.throws(
      () => identifyNativeProtocol(declared, sample),
      /protocols must match/u,
    )
})
