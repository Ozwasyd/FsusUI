import { describe, expect, it } from 'vitest'
import {
  getFsusRenderPipelineAdapter,
  createFsusWorkerExecutor,
  registerFsusRenderPipelineAdapter,
  resolveFsusRenderPipelineConfig,
  resolveFsusRenderPipelineHardwareProfile,
  useFsusRenderPipelineHardwareProfile,
  useFsusRenderPipelineRuntime,
  useFsusRenderScheduler,
  useFsusVirtualWindow,
} from '../../packages/element-plus/render-pipeline'

import type {
  FsusRenderPipelineAdapter,
  FsusRenderHardwareProfile,
  FsusResolvedRenderPipelineAcceleration,
  FsusRenderPipelineDiagnosticEvent,
  FsusRenderPipelineDocument,
  FsusRenderPipelineEstimate,
  FsusRenderPipelineStrategy,
  FsusRenderPipelineWorkerOptions,
  FsusWorkerExecutorEvent,
  RenderPipelineConfigContract,
} from '../../packages/element-plus/render-pipeline'

describe('render pipeline public api', () => {
  it('exposes the layered public entrypoint', () => {
    const config: RenderPipelineConfigContract = {
      mode: 'auto',
      thresholds: { htmlBytes: 128_000 },
    }
    const estimate: FsusRenderPipelineEstimate = { htmlBytes: 256_000 }
    const document: FsusRenderPipelineDocument<string> = { units: ['unit'] }
    const strategy: FsusRenderPipelineStrategy = 'chunked-main'
    const hardwareProfile: FsusRenderHardwareProfile = 'gpu-compositor'
    const acceleration: FsusResolvedRenderPipelineAcceleration = {
      mode: 'auto',
      compositor: 'auto',
      contentVisibility: 'auto',
      layerBudget: 80,
    }
    const workerOptions: FsusRenderPipelineWorkerOptions = {
      createWorker: () => ({ terminate: () => undefined }) as Worker,
    }
    const workerEvent: FsusWorkerExecutorEvent = {
      name: 'public-api-worker',
      pendingCount: 0,
      type: 'worker-created',
    }
    const diagnostic: FsusRenderPipelineDiagnosticEvent = {
      strategy,
      type: 'render-start',
    }

    expect(resolveFsusRenderPipelineConfig(config).thresholds.htmlBytes).toBe(
      128_000,
    )
    expect(estimate.htmlBytes).toBe(256_000)
    expect(document.units).toEqual(['unit'])
    expect(strategy).toBe('chunked-main')
    expect(hardwareProfile).toBe('gpu-compositor')
    expect(acceleration.layerBudget).toBe(80)
    expect(typeof resolveFsusRenderPipelineHardwareProfile).toBe('function')
    expect(typeof useFsusRenderPipelineHardwareProfile).toBe('function')
    expect(typeof useFsusRenderPipelineRuntime).toBe('function')
    expect(typeof useFsusVirtualWindow).toBe('function')
    expect(typeof useFsusRenderScheduler).toBe('function')
    expect(typeof createFsusWorkerExecutor).toBe('function')
    expect(typeof workerOptions.createWorker).toBe('function')
    expect(workerEvent.type).toBe('worker-created')
    expect(diagnostic.strategy).toBe('chunked-main')
  })

  it('allows external adapters to register through the public entrypoint', () => {
    const adapter: FsusRenderPipelineAdapter<string, string> = {
      id: 'public-entry-adapter',
      estimate: () => ({ items: 1 }),
      estimateSize: () => 20,
      fingerprint: (source) => source,
      keyOf: (unit) => unit,
      prepare: async (source) => ({ units: [source] }),
    }
    const unregister = registerFsusRenderPipelineAdapter(adapter)

    expect(getFsusRenderPipelineAdapter('public-entry-adapter')?.id).toBe(
      adapter.id,
    )

    unregister()
    expect(getFsusRenderPipelineAdapter('public-entry-adapter')).toBeUndefined()
  })
})
