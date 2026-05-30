import { describe, expect, it } from 'vitest'
import {
  getFsusRenderPipelineAdapter,
  getFsusRenderPipelineDiagnosticsSnapshot,
  registerFsusRenderPipelineDiagnosticSink,
  createFsusWorkerExecutor,
  createFsusRenderPipelineDiagnosticsBuffer,
  registerFsusRenderPipelineAdapter,
  resolveFsusAdaptiveRenderPipelineConfig,
  resolveFsusRenderPipelineConfig,
  resolveFsusRenderPipelineUnitAttrs,
  resolveFsusRenderPipelineHardwareProfile,
  useFsusRenderPipelineHardwareProfile,
  useFsusRenderPipelineRuntime,
  useFsusRenderScheduler,
  useFsusVirtualWindow,
} from '../../packages/element-plus/render-pipeline'

import type {
  FsusRenderPipelineAdapter,
  FsusRenderPipelineAdaptiveMode,
  FsusRenderPipelineAdaptiveSignals,
  FsusRenderPipelineDomAttrs,
  FsusRenderHardwareProfile,
  FsusResolvedRenderPipelineAcceleration,
  FsusRenderPipelineDiagnosticEvent,
  FsusRenderPipelineDiagnosticSink,
  FsusRenderPipelineDiagnosticsBuffer,
  FsusRenderPipelineDocument,
  FsusRenderPipelineEstimate,
  FsusRenderPipelineStrategy,
  FsusRenderSchedulerPriority,
  FsusRenderSchedulerTaskOptions,
  FsusRenderPipelineWorkerOptions,
  FsusRenderPipelineWorkerPoolMode,
  FsusRenderPipelineUnitAttrsOptions,
  FsusWorkerExecutorEvent,
  RenderPipelineConfigContract,
} from '../../packages/element-plus/render-pipeline'

describe('render pipeline public api', () => {
  it('exposes the layered public entrypoint', () => {
    const config: RenderPipelineConfigContract = {
      adaptive: 'auto',
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
    const workerPool: FsusRenderPipelineWorkerPoolMode = 'runtime'
    const workerOptions: FsusRenderPipelineWorkerOptions = {
      createWorker: () => ({ terminate: () => undefined }) as Worker,
      pool: workerPool,
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
    const adaptiveMode: FsusRenderPipelineAdaptiveMode = 'auto'
    const adaptiveSignals: FsusRenderPipelineAdaptiveSignals = {
      renderDurationMs: 1,
    }
    const schedulerPriority: FsusRenderSchedulerPriority = 'visible'
    const schedulerOptions: FsusRenderSchedulerTaskOptions = {
      priority: schedulerPriority,
    }
    const domAttrs: FsusRenderPipelineDomAttrs = {
      'data-fsus-compositor': 'enabled',
      'data-fsus-content-visibility': 'enabled',
      'data-fsus-render-layer-budget': '1',
    }
    const unitAttrsOptions: FsusRenderPipelineUnitAttrsOptions = {
      baseAttrs: domAttrs,
      unitIndex: 1,
    }
    const diagnosticBuffer: FsusRenderPipelineDiagnosticsBuffer =
      createFsusRenderPipelineDiagnosticsBuffer()
    const diagnosticSink: FsusRenderPipelineDiagnosticSink = (event) =>
      diagnosticBuffer.push(event)

    expect(resolveFsusRenderPipelineConfig(config).thresholds.htmlBytes).toBe(
      128_000,
    )
    expect(resolveFsusRenderPipelineConfig(config).adaptive).toBe(adaptiveMode)
    expect(
      resolveFsusAdaptiveRenderPipelineConfig(
        resolveFsusRenderPipelineConfig(config),
        'gpu-compositor',
        adaptiveSignals,
      ).budget.measureBatch,
    ).toBeGreaterThan(0)
    expect(estimate.htmlBytes).toBe(256_000)
    expect(document.units).toEqual(['unit'])
    expect(strategy).toBe('chunked-main')
    expect(hardwareProfile).toBe('gpu-compositor')
    expect(acceleration.layerBudget).toBe(80)
    expect(typeof resolveFsusRenderPipelineHardwareProfile).toBe('function')
    expect(typeof useFsusRenderPipelineHardwareProfile).toBe('function')
    expect(resolveFsusRenderPipelineUnitAttrs(unitAttrsOptions)).toMatchObject({
      'data-fsus-compositor': 'disabled',
    })
    expect(typeof useFsusRenderPipelineRuntime).toBe('function')
    expect(typeof useFsusVirtualWindow).toBe('function')
    expect(typeof useFsusRenderScheduler).toBe('function')
    expect(typeof createFsusWorkerExecutor).toBe('function')
    expect(typeof getFsusRenderPipelineDiagnosticsSnapshot).toBe('function')
    expect(typeof registerFsusRenderPipelineDiagnosticSink).toBe('function')
    expect(typeof diagnosticSink).toBe('function')
    expect(schedulerOptions.priority).toBe('visible')
    expect(workerPool).toBe('runtime')
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
