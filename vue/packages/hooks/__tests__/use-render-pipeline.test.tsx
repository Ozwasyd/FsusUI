import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  chooseFsusRenderPipelineStrategy,
  clearFsusRenderPipelineAdapters,
  clearFsusRenderPipelineComponentPolicies,
  clearFsusRenderPipelineDiagnostics,
  clearFsusRenderPipelineStrategyResolvers,
  createFsusWorkerExecutor,
  createFsusRafRefreshSampler,
  createFsusRenderStageHistory,
  createFsusRenderPipelineStrategyCache,
  createFsusRenderPipelineDiagnosticsBuffer,
  getFsusRenderPipelineDiagnosticsSnapshot,
  getFsusRenderPipelineAdapter,
  getFsusRenderPipelineComponentPolicy,
  estimateFsusRenderRefreshProfile,
  registerFsusRenderPipelineDiagnosticSink,
  registerFsusRenderPipelineAdapter,
  registerFsusRenderPipelineComponentPolicy,
  registerFsusRenderPipelineStrategyResolver,
  resolveFsusWorkerPoolSize,
  resolveFsusAdaptiveRenderPipelineConfig,
  resolveFsusRenderPipelineCompositorEnabled,
  resolveFsusRenderPipelineComponentPolicy,
  resolveFsusRenderPipelineCache,
  resolveFsusRenderPipelineConfig,
  resolveFsusRenderCapabilityProfile,
  resolveFsusRenderPipelineContentVisibilityEnabled,
  resolveFsusRenderPipelineHardwareProfile,
  resolveFsusRenderPipelineHardwareAttrs,
  resolveFsusRenderPipelineUnitAttrs,
  shouldUseFsusRenderPipeline,
  useFsusRenderPipelineHardwareProfile,
  useFsusRenderPipelineRuntime,
  useFsusRenderScheduler,
  useFsusVirtualWindow,
} from '../use-render-pipeline'

type TestWorkerPayload = {
  generation?: number
  id: number
  key?: string
  lane?: string
  request?: unknown
  type?: 'cancel' | 'run'
}

class TestWorker {
  static instances: TestWorker[] = []

  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  posts: TestWorkerPayload[] = []
  transfers: Transferable[][] = []
  terminated = false

  constructor() {
    TestWorker.instances.push(this)
  }

  postMessage(message: TestWorkerPayload, transfer: Transferable[] = []) {
    if (this.terminated) {
      throw new Error('test_worker_terminated')
    }
    this.posts.push(message)
    this.transfers.push(transfer)
  }

  terminate() {
    this.terminated = true
  }

  resolve(
    result: unknown,
    postIndex = this.posts.length - 1,
    timings?: { computeDurationMs?: number },
  ) {
    const post = this.posts[postIndex]
    if (!post) throw new Error('test_worker_post_missing')
    this.onmessage?.({ data: { id: post.id, result, timings } } as MessageEvent)
  }

  reject(error: unknown, postIndex = this.posts.length - 1) {
    const post = this.posts[postIndex]
    if (!post) throw new Error('test_worker_post_missing')
    this.onmessage?.({ data: { error, id: post.id } } as MessageEvent)
  }

  fail(error = new Error('test_worker_failure')) {
    this.onerror?.({
      error,
      message: error.message,
      preventDefault: vi.fn(),
    } as unknown as ErrorEvent)
  }
}

describe('use-render-pipeline', () => {
  afterEach(() => {
    TestWorker.instances = []
    clearFsusRenderPipelineDiagnostics()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('chooses chunked rendering from content budget instead of component names', () => {
    const config = resolveFsusRenderPipelineConfig()

    expect(
      shouldUseFsusRenderPipeline({ htmlBytes: 12_000, items: 20 }, config),
    ).toBe(false)
    expect(
      shouldUseFsusRenderPipeline({ htmlBytes: 180_000, items: 20 }, config),
    ).toBe(true)
    expect(
      chooseFsusRenderPipelineStrategy({ items: 800 }, config, false),
    ).toBe('chunked-main')
    expect(
      chooseFsusRenderPipelineStrategy(
        { htmlBytes: 180_000 },
        { ...config, worker: 'enabled' },
        true,
      ),
    ).toBe(typeof Worker === 'undefined' ? 'chunked-main' : 'chunked-worker')
  })

  it('normalizes acceleration config and resolves hardware profile', () => {
    vi.stubGlobal('CSS', {
      supports: vi.fn((property: string, value: string) =>
        property === 'transform'
          ? value === 'translate3d(0, 0, 0)'
          : property === 'content-visibility' && value === 'auto',
      ),
    })

    const cpuConfig = resolveFsusRenderPipelineConfig({
      acceleration: { mode: 'cpu' },
    })
    expect(cpuConfig.acceleration.mode).toBe('cpu')
    expect(cpuConfig.budget.dynamicFrameMs).toBe(true)
    expect(cpuConfig.budget.frameMs).toBe(7.5)
    expect(cpuConfig.budget.overscanPx).toBe(480)
    expect(cpuConfig.thresholds.htmlBytes).toBe(64_000)
    expect(resolveFsusRenderPipelineHardwareProfile(cpuConfig)).toBe(
      'cpu-threaded',
    )

    const gpuConfig = resolveFsusRenderPipelineConfig({
      acceleration: {
        mode: 'gpu',
        compositor: 'enabled',
        contentVisibility: 'enabled',
      },
    })
    const profile = resolveFsusRenderPipelineHardwareProfile(gpuConfig)
    expect(profile).toBe('gpu-compositor')
    expect(resolveFsusRenderPipelineCompositorEnabled(gpuConfig, profile)).toBe(
      true,
    )
    expect(
      resolveFsusRenderPipelineContentVisibilityEnabled(gpuConfig, profile),
    ).toBe(true)
  })

  it('adapts render budgets within the configured clamp', () => {
    const config = resolveFsusRenderPipelineConfig({
      adaptive: 'enabled',
      budget: { frameMs: 8, measureBatch: 32, overscanPx: 800 },
    })
    expect(config.budget.dynamicFrameMs).toBe(false)

    const degraded = resolveFsusAdaptiveRenderPipelineConfig(
      config,
      'cpu-threaded',
      { queueDepth: 3, renderDurationMs: 80 },
    )
    expect(degraded.budget.frameMs).toBeGreaterThanOrEqual(4)
    expect(degraded.budget.frameMs).toBeLessThan(config.budget.frameMs)
    expect(degraded.budget.measureBatch).toBeGreaterThanOrEqual(16)
    expect(degraded.budget.overscanPx).toBeGreaterThanOrEqual(400)

    const expanded = resolveFsusAdaptiveRenderPipelineConfig(
      config,
      'gpu-compositor',
      { queueDepth: 0, renderDurationMs: 1 },
    )
    expect(expanded.budget.measureBatch).toBeGreaterThan(
      config.budget.measureBatch,
    )
    expect(expanded.budget.overscanPx).toBeGreaterThan(config.budget.overscanPx)

    const disabledConfig = { ...config, adaptive: 'disabled' as const }
    const disabled = resolveFsusAdaptiveRenderPipelineConfig(
      disabledConfig,
      'cpu-threaded',
      { queueDepth: 9, renderDurationMs: 1_000 },
    )
    expect(disabled).toBe(disabledConfig)
  })

  it('exposes hardware attrs through the runtime hook', () => {
    let hardware:
      | ReturnType<typeof useFsusRenderPipelineHardwareProfile>
      | undefined
    let pipeline:
      | ReturnType<typeof useFsusRenderPipelineRuntime<string, string>>
      | undefined

    const Probe = defineComponent({
      setup() {
        const config = {
          acceleration: { mode: 'cpu' as const },
          mode: 'enabled' as const,
        }
        hardware = useFsusRenderPipelineHardwareProfile(config)
        pipeline = useFsusRenderPipelineRuntime<string, string>({
          adapter: {
            id: 'hardware-runtime',
            canUseWorker: () => false,
            estimate: () => ({ items: 800 }),
            estimateSize: () => 20,
            fingerprint: (value) => value,
            keyOf: (unit) => unit,
            prepare: async (value) => ({ units: [value] }),
          },
          config,
          source: 'source',
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    expect(hardware!.profile.value).toBe('cpu-threaded')
    expect(hardware!.compositor.value).toBe(false)
    expect(pipeline!.hardwareProfile.value).toBe('cpu-threaded')
    expect(pipeline!.hardwareAttrs.value).toMatchObject({
      'data-fsus-compositor': 'disabled',
      'data-fsus-content-visibility': 'disabled',
      'data-fsus-render-hardware': 'cpu-threaded',
    })
    wrapper.unmount()
  })

  it('enables content visibility independently from the cpu profile', () => {
    vi.stubGlobal('CSS', {
      supports: vi.fn((property: string) => property === 'content-visibility'),
    })
    const config = resolveFsusRenderPipelineConfig({
      acceleration: { mode: 'cpu' },
    })
    expect(
      resolveFsusRenderPipelineContentVisibilityEnabled(config, 'cpu-threaded'),
    ).toBe(true)
    expect(
      resolveFsusRenderPipelineCompositorEnabled(config, 'cpu-threaded'),
    ).toBe(false)
  })

  it('derives distinct budgets for 60/90/120/144 Hz samples', () => {
    const profile = (hz: number) =>
      estimateFsusRenderRefreshProfile(
        Array.from({ length: 24 }, () => 1000 / hz),
      )

    expect([60, 90, 120, 144].map((hz) => profile(hz).hz)).toEqual([
      60, 90, 120, 144,
    ])
    expect(
      new Set([60, 90, 120, 144].map((hz) => profile(hz).mainThreadBudgetMs))
        .size,
    ).toBe(4)
    expect(profile(120).mainThreadBudgetMs).toBeLessThan(4)
    expect(profile(144).mainThreadBudgetMs).toBeLessThan(
      profile(120).mainThreadBudgetMs,
    )
  })

  it('samples real rAF drift and keeps motion separate from capabilities', () => {
    const callbacks: FrameRequestCallback[] = []
    const samples: ReturnType<typeof estimateFsusRenderRefreshProfile>[] = []
    const stop = createFsusRafRefreshSampler({
      cancelFrame: vi.fn(),
      onSample: (sample) => samples.push(sample),
      requestFrame: (callback) => {
        callbacks.push(callback)
        return callbacks.length
      },
      sampleSize: 4,
    })
    for (const timestamp of [0, 8.33, 16.9, 25.05, 33.4]) {
      callbacks.shift()?.(timestamp)
    }
    expect(samples[0]).toMatchObject({ hz: 120, sampleCount: 4 })
    expect(samples[0]!.rafDriftMs).toBeGreaterThan(0)
    expect(callbacks).toHaveLength(0)
    stop()

    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(8)
    vi.stubGlobal('CSS', { supports: vi.fn(() => true) })
    const profile = resolveFsusRenderCapabilityProfile(samples[0], {
      mainOpsPerMs: 200_000,
    })
    expect(profile.motionMode).toBe('reduced')
    expect(profile.computeProfile).toBe('high')
    expect(profile.computeCalibration).toMatchObject({
      mainOpsPerMs: 200_000,
      workerConcurrency: 4,
    })
    expect(profile.compositorCapability).toBe(true)
    expect(profile.contentVisibilityCapability).toBe(true)
    expect(
      resolveFsusRenderPipelineHardwareProfile({
        acceleration: { mode: 'auto' },
      }),
    ).toBe('gpu-compositor')
  })

  it('maintains sliding stage statistics instead of one total sample', () => {
    const history = createFsusRenderStageHistory(3, 0.5)
    history.record('prepare', 2)
    history.record('prepare', 4)
    history.record('prepare', 100)
    history.record('prepare', 6)
    const stats = history.snapshot('prepare')
    expect(stats.sampleCount).toBe(3)
    expect(stats.p50Ms).toBe(6)
    expect(stats.ewmaMs).toBeGreaterThan(6)
    expect(history.snapshot('vue-commit').sampleCount).toBe(0)
  })

  it('expires, recalibrates and invalidates strategy cache by profile', () => {
    let clock = 100
    const cache = createFsusRenderPipelineStrategyCache({
      now: () => clock,
      ttlMs: 50,
    })
    cache.set('article', {
      durationMs: 10,
      profileVersion: '60hz:visible',
      strategy: 'chunked-main',
    })
    cache.set('article', {
      durationMs: 30,
      profileVersion: '60hz:visible',
      strategy: 'chunked-main',
    })
    expect(cache.get('article', '60hz:visible')).toMatchObject({
      durationEwmaMs: 15,
      sampleCount: 2,
    })
    expect(cache.get('article', '120hz:visible')).toBeUndefined()

    cache.set('article', {
      durationMs: 5,
      profileVersion: '120hz:visible',
      strategy: 'sync',
    })
    cache.invalidateProfile('120hz:hidden')
    expect(cache.get('article')).toBeUndefined()
    cache.set('article', {
      profileVersion: '120hz:hidden',
      strategy: 'sync',
    })
    clock = 151
    expect(cache.get('article')).toBeUndefined()
  })

  it('derives per-unit DOM performance attrs from the shared layer budget', () => {
    const baseAttrs = resolveFsusRenderPipelineHardwareAttrs({
      compositor: true,
      contentVisibility: true,
      hardwareProfile: 'gpu-compositor',
      layerBudget: 2,
    })

    expect(
      resolveFsusRenderPipelineUnitAttrs({
        baseAttrs,
        layerBudget: 2,
        unitIndex: 1,
      }),
    ).toMatchObject({
      'data-fsus-compositor': 'enabled',
      'data-fsus-content-visibility': 'enabled',
      'data-fsus-render-layer-budget': '2',
    })

    expect(
      resolveFsusRenderPipelineUnitAttrs({
        baseAttrs,
        layerBudget: 2,
        unitIndex: 2,
      }),
    ).toMatchObject({
      'data-fsus-compositor': 'disabled',
      'data-fsus-content-visibility': 'enabled',
      'data-fsus-render-layer-budget': '2',
    })

    expect(
      resolveFsusRenderPipelineUnitAttrs({
        baseAttrs,
        disableContentVisibilityOnOverflow: true,
        layerBudget: 2,
        renderedCount: 3,
      }),
    ).toMatchObject({
      'data-fsus-compositor': 'disabled',
      'data-fsus-content-visibility': 'disabled',
      'data-fsus-render-layer-budget': '2',
    })
  })

  it('allows render strategies to be hot-plugged without component changes', () => {
    const config = resolveFsusRenderPipelineConfig()
    const unregister = registerFsusRenderPipelineStrategyResolver((context) =>
      context.estimate.items === 42 ? 'disabled' : undefined,
    )

    expect(chooseFsusRenderPipelineStrategy({ items: 42 }, config, true)).toBe(
      'disabled',
    )
    expect(
      chooseFsusRenderPipelineStrategy({ items: 800 }, config, false),
    ).toBe('chunked-main')

    unregister()
    expect(chooseFsusRenderPipelineStrategy({ items: 42 }, config, true)).toBe(
      'sync',
    )
    clearFsusRenderPipelineStrategyResolvers()
  })

  it('orders hot-plugged render strategies by priority', () => {
    const config = resolveFsusRenderPipelineConfig()
    const unregisterLow = registerFsusRenderPipelineStrategyResolver(
      () => 'disabled',
      { priority: 1 },
    )
    const unregisterHigh = registerFsusRenderPipelineStrategyResolver(
      () => 'chunked-main',
      { priority: 10 },
    )

    expect(chooseFsusRenderPipelineStrategy({ items: 1 }, config, true)).toBe(
      'chunked-main',
    )

    unregisterHigh()
    expect(chooseFsusRenderPipelineStrategy({ items: 1 }, config, true)).toBe(
      'disabled',
    )

    unregisterLow()
  })

  it('schedules 60 Hz render work by priority and supports cancellation', async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const calls: string[] = []
    let scheduler: ReturnType<typeof useFsusRenderScheduler> | undefined
    const Probe = defineComponent({
      setup() {
        scheduler = useFsusRenderScheduler(
          ref({
            frameMs: estimateFsusRenderRefreshProfile(
              Array.from({ length: 12 }, () => 1000 / 60),
            ).mainThreadBudgetMs,
          }),
        )
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    scheduler!.schedule(
      () => {
        calls.push('background')
      },
      {
        priority: 'background',
      },
    )
    const cancelVisible = scheduler!.schedule(
      () => {
        calls.push('visible')
      },
      {
        priority: 'visible',
      },
    )
    scheduler!.schedule(
      () => {
        calls.push('user-blocking')
      },
      {
        priority: 'user-blocking',
      },
    )
    cancelVisible()

    frames.shift()?.(0)
    await nextTick()

    expect(calls).toEqual(['user-blocking', 'background'])
    wrapper.unmount()
  })

  it('maps render scheduler priority to native postTask priority', () => {
    const postTasks: Array<{
      callback: () => void
      priority: string | undefined
    }> = []
    vi.stubGlobal('scheduler', {
      postTask: vi.fn(
        (callback: () => void, options?: { priority?: string }) => {
          postTasks.push({ callback, priority: options?.priority })
          return new Promise(() => undefined)
        },
      ),
    })

    const calls: string[] = []
    let scheduler: ReturnType<typeof useFsusRenderScheduler> | undefined
    const Probe = defineComponent({
      setup() {
        scheduler = useFsusRenderScheduler(ref({ frameMs: 100 }))
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    scheduler!.schedule(
      () => {
        calls.push('background')
      },
      {
        priority: 'background',
      },
    )
    scheduler!.schedule(
      () => {
        calls.push('visible')
      },
      {
        priority: 'visible',
      },
    )

    expect(postTasks.map((task) => task.priority)).toEqual([
      'background',
      'user-visible',
    ])
    postTasks[0]!.callback()
    postTasks[1]!.callback()

    expect(calls).toEqual(['visible', 'background'])
    wrapper.unmount()
  })

  it('yields 120 Hz cooperative continuations and lets input preempt them', async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const calls: string[] = []
    let scheduler: ReturnType<typeof useFsusRenderScheduler> | undefined
    const Probe = defineComponent({
      setup() {
        scheduler = useFsusRenderScheduler(
          ref({
            frameMs: estimateFsusRenderRefreshProfile(
              Array.from({ length: 12 }, () => 1000 / 120),
            ).mainThreadBudgetMs,
          }),
        )
        return () => h('div')
      },
    })
    const wrapper = mount(Probe)
    const chunk3 = () => {
      calls.push('background-3')
      return { done: true as const }
    }
    const chunk2 = () => {
      calls.push('background-2')
      return { done: false as const, continuation: chunk3 }
    }
    scheduler!.schedule(
      () => {
        calls.push('background-1')
        return { done: false, continuation: chunk2 }
      },
      { key: 'index', priority: 'background' },
    )
    frames.shift()?.(0)
    scheduler!.schedule(
      () => {
        calls.push('input')
      },
      {
        priority: 'user-blocking',
      },
    )
    frames.shift()?.(8.33)
    frames.shift()?.(16.66)
    frames.shift()?.(24.99)
    await nextTick()
    expect(calls).toEqual([
      'background-1',
      'input',
      'background-2',
      'background-3',
    ])
    wrapper.unmount()
  })

  it('coalesces keyed work and aborts queued continuations uniformly', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const calls: string[] = []
    const abort = new AbortController()
    let scheduler: ReturnType<typeof useFsusRenderScheduler> | undefined
    const Probe = defineComponent({
      setup() {
        scheduler = useFsusRenderScheduler(ref({ frameMs: 7.5 }))
        return () => h('div')
      },
    })
    const wrapper = mount(Probe)
    scheduler!.schedule(
      () => {
        calls.push('stale')
      },
      { key: 'render' },
    )
    scheduler!.schedule(
      () => {
        calls.push('latest')
      },
      { key: 'render' },
    )
    scheduler!.schedule(
      () => ({
        done: false,
        continuation: () => {
          calls.push('aborted-continuation')
          return { done: true }
        },
      }),
      { priority: 'background', signal: abort.signal },
    )
    frames.shift()?.(0)
    abort.abort()
    frames.shift()?.(16.67)
    expect(calls).toEqual(['latest'])
    wrapper.unmount()
  })

  it('registers component render policies separately from component code', () => {
    clearFsusRenderPipelineComponentPolicies()
    const config = resolveFsusRenderPipelineConfig()
    const unregister = registerFsusRenderPipelineComponentPolicy({
      budgeted: true,
      componentName: 'ElHeavyProbe',
      estimate: { items: 800 },
      role: 'virtual-list',
    })

    expect(getFsusRenderPipelineComponentPolicy('ElHeavyProbe')?.role).toBe(
      'virtual-list',
    )
    expect(
      resolveFsusRenderPipelineComponentPolicy('ElHeavyProbe', config).strategy,
    ).toBe('chunked-main')
    expect(
      resolveFsusRenderPipelineComponentPolicy('ElLightProbe', config).strategy,
    ).toBe('sync')

    unregister()
    expect(getFsusRenderPipelineComponentPolicy('ElHeavyProbe')).toBeUndefined()
  })

  it('registers external adapters and resolves them through the runtime', async () => {
    clearFsusRenderPipelineAdapters()
    clearFsusRenderPipelineComponentPolicies()
    const source = ref('external source')
    let pipeline:
      | ReturnType<typeof useFsusRenderPipelineRuntime<string, string>>
      | undefined

    const unregisterAdapter = registerFsusRenderPipelineAdapter<string, string>(
      {
        id: 'external-adapter',
        canUseWorker: () => false,
        estimate: (value) => ({ htmlBytes: value.length * 20_000 }),
        estimateSize: () => 24,
        fingerprint: (value) => value,
        keyOf: (unit) => unit,
        prepare: async (value, _signal, strategy) => ({
          metadata: { strategy },
          units: [`${strategy}:${value}`],
        }),
      },
    )
    const unregisterPolicy = registerFsusRenderPipelineComponentPolicy({
      adapterId: 'external-adapter',
      budgeted: true,
      componentName: 'ElExternalProbe',
      role: 'chunk-adapter',
    })

    const Probe = defineComponent({
      setup() {
        pipeline = useFsusRenderPipelineRuntime<string, string>({
          componentName: 'ElExternalProbe',
          config: { mode: 'auto' },
          source,
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    expect(getFsusRenderPipelineAdapter('external-adapter')).toBeDefined()
    await pipeline!.render()

    expect(pipeline!.strategy.value).toBe('chunked-main')
    expect(pipeline!.document.value?.units).toEqual([
      'chunked-main:external source',
    ])

    wrapper.unmount()
    unregisterPolicy()
    unregisterAdapter()
    clearFsusRenderPipelineAdapters()
  })

  it('publishes diagnostics through local and registered buffers', async () => {
    const buffer = createFsusRenderPipelineDiagnosticsBuffer(2)
    const unregisterSink = registerFsusRenderPipelineDiagnosticSink((event) =>
      buffer.push(event),
    )
    let pipeline:
      | ReturnType<typeof useFsusRenderPipelineRuntime<string, string>>
      | undefined

    const Probe = defineComponent({
      setup() {
        pipeline = useFsusRenderPipelineRuntime<string, string>({
          adapter: {
            id: 'diagnostic-runtime',
            canUseWorker: () => false,
            estimate: () => ({ items: 900 }),
            estimateSize: () => 20,
            fingerprint: (value) => value,
            keyOf: (unit) => unit,
            prepare: async (value) => ({ units: [value] }),
          },
          config: { mode: 'enabled' },
          source: 'diagnostic source',
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    await pipeline!.render()

    expect(pipeline!.diagnostics.value[0]).toMatchObject({
      adapterId: 'diagnostic-runtime',
      cache: 'miss',
      type: 'render-start',
    })
    expect(buffer.snapshot()).toHaveLength(2)
    expect(
      new Set(
        pipeline!.diagnostics.value
          .filter((event) => event.type === 'stage-sample')
          .map((event) => event.stage),
      ),
    ).toEqual(
      new Set([
        'queue-wait',
        'prepare',
        'vue-commit',
        'style-layout',
        'next-paint',
        'total',
      ]),
    )
    expect(
      getFsusRenderPipelineDiagnosticsSnapshot().some(
        (event) => event.adapterId === 'diagnostic-runtime',
      ),
    ).toBe(true)

    unregisterSink()
    wrapper.unmount()
  })

  it('derives virtual cache from the shared render budget only for chunked strategies', () => {
    const config = resolveFsusRenderPipelineConfig({
      budget: { overscanPx: 240 },
    })

    expect(
      resolveFsusRenderPipelineCache({
        config,
        estimatedItemSize: 30,
        explicitCache: 2,
        strategy: 'sync',
      }),
    ).toBe(2)
    expect(
      resolveFsusRenderPipelineCache({
        config,
        estimatedItemSize: 30,
        explicitCache: 2,
        strategy: 'chunked-main',
      }),
    ).toBe(8)
  })

  it('calculates a virtual window and updates measured sizes in batches', async () => {
    const units = ref(
      Array.from({ length: 20 }, (_, index) => ({
        key: `row-${index}`,
        label: `Row ${index}`,
      })),
    )

    const Probe = defineComponent({
      setup() {
        const viewportRef = ref<HTMLElement | null>(null)
        const virtualWindow = useFsusVirtualWindow({
          estimateSize: () => 40,
          getKey: (unit) => unit.key,
          getViewport: () => viewportRef.value,
          measureBatch: ref(8),
          overscanPx: ref(40),
          units,
        })

        return () =>
          h(
            'div',
            {
              ref: viewportRef,
              style: 'height: 120px; overflow-y: auto;',
            },
            [
              h('div', {
                'data-top': '',
                style: `height: ${virtualWindow.topSpacer.value}px`,
              }),
              ...virtualWindow.visibleItems.value.map((item) =>
                h(
                  'div',
                  {
                    key: item.key,
                    ref: (element) =>
                      virtualWindow.setUnitRef(item.key, element as Element),
                    'data-row': item.key,
                    style: 'height: 40px;',
                  },
                  item.unit.label,
                ),
              ),
              h('div', {
                'data-bottom': '',
                style: `height: ${virtualWindow.bottomSpacer.value}px`,
              }),
            ],
          )
      },
    })

    const wrapper = mount(Probe, { attachTo: document.body })
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))

    expect(wrapper.findAll('[data-row]').length).toBeGreaterThan(1)
    expect(wrapper.findAll('[data-row]').length).toBeLessThan(20)

    const viewport = wrapper.element as HTMLElement
    viewport.scrollTop = 320
    viewport.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await nextTick()

    expect(wrapper.find('[data-row="row-7"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('supports an opt-in initial floor for virtual window items', () => {
    const units = ref(
      Array.from({ length: 10 }, (_, index) => ({
        key: `chunk-${index}`,
        label: `Chunk ${index}`,
      })),
    )

    const Probe = defineComponent({
      setup() {
        const virtualWindow = useFsusVirtualWindow({
          estimateSize: () => 400,
          getKey: (unit) => unit.key,
          getViewport: () => null,
          minVisibleItems: ref(3),
          overscanPx: ref(0),
          units,
        })

        return () =>
          h(
            'div',
            virtualWindow.visibleItems.value.map((item) =>
              h('div', { 'data-row': item.key }, item.unit.label),
            ),
          )
      },
    })

    const wrapper = mount(Probe)
    expect(wrapper.findAll('[data-row]').map((row) => row.text())).toEqual([
      'Chunk 0',
      'Chunk 1',
      'Chunk 2',
    ])
    wrapper.unmount()
  })

  it('keeps stale async pipeline results out of the document state', async () => {
    const { useFsusRenderPipeline } = await import('../use-render-pipeline')
    const source = ref('first')
    const resolves: Array<(value: { units: string[] }) => void> = []

    let pipeline:
      | {
          document: { value: { units: readonly string[] } | null }
          render: () => Promise<void>
        }
      | undefined

    const Probe = defineComponent({
      setup() {
        pipeline = useFsusRenderPipeline<string, string>(
          {
            id: 'test',
            canUseWorker: () => false,
            estimate: () => ({ items: 800 }),
            estimateSize: () => 20,
            fingerprint: (value) => value,
            keyOf: (unit) => unit,
            prepare: (value) =>
              new Promise((resolve) => {
                resolves.push(() => resolve({ units: [value] }))
              }),
          },
          source,
          ref({ config: { mode: 'enabled' } }),
        )
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    const first = pipeline!.render()
    source.value = 'second'
    const second = pipeline!.render()

    resolves[1]?.({ units: ['second'] })
    await second
    resolves[0]?.({ units: ['first'] })
    await first

    expect(pipeline!.document.value?.units).toEqual(['second'])
    wrapper.unmount()
  })

  it('does not commit a pending render after component unmount', async () => {
    let resolvePrepare: ((value: { units: string[] }) => void) | undefined
    let pipeline:
      | ReturnType<typeof useFsusRenderPipelineRuntime<string, string>>
      | undefined
    const Probe = defineComponent({
      setup() {
        pipeline = useFsusRenderPipelineRuntime({
          adapter: {
            id: 'unmount-guard',
            estimate: () => ({ items: 800 }),
            estimateSize: () => 20,
            fingerprint: (value: string) => value,
            keyOf: (unit: string) => unit,
            prepare: () =>
              new Promise((resolve) => {
                resolvePrepare = resolve
              }),
          },
          config: { mode: 'enabled' },
          source: 'pending',
        })
        return () => h('div')
      },
    })
    const wrapper = mount(Probe)
    const render = pipeline!.render()
    wrapper.unmount()
    resolvePrepare?.({ units: ['late'] })
    await render
    expect(pipeline!.document.value).toBeNull()
  })

  it('manages worker requests with lifecycle guards and idle termination', async () => {
    vi.useFakeTimers()
    const events: string[] = []
    const executor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      {
        idleTerminateMs: 20,
        name: 'test-worker',
        onEvent: (event) => events.push(event.type),
        requestTimeoutMs: 50,
      },
    )

    const render = executor.run('first')
    const worker = TestWorker.instances[0]
    expect(worker.posts).toEqual([
      {
        generation: 0,
        id: 1,
        key: undefined,
        lane: 'throughput',
        request: 'first',
        type: 'run',
      },
    ])

    worker.resolve('done')
    await expect(render).resolves.toEqual({ ok: true, value: 'done' })
    expect(executor.getPendingCount()).toBe(0)
    expect(events).toEqual(
      expect.arrayContaining([
        'worker-created',
        'request-start',
        'request-resolve',
      ]),
    )

    vi.advanceTimersByTime(20)
    expect(worker.terminated).toBe(true)
  })

  it('sizes pools from cores and memory while reserving render capacity', () => {
    expect(
      resolveFsusWorkerPoolSize({
        deviceMemoryGb: 16,
        hardwareConcurrency: 16,
      }),
    ).toBe(4)
    expect(
      resolveFsusWorkerPoolSize({
        deviceMemoryGb: 2,
        hardwareConcurrency: 16,
      }),
    ).toBe(1)
    expect(
      resolveFsusWorkerPoolSize({
        hardwareConcurrency: 4,
        maxWorkers: 4,
        reservedCores: 2,
      }),
    ).toBe(2)
  })

  it('schedules latency lanes first without starving throughput or background', async () => {
    const executor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      {
        laneQueueLimits: { background: 4, latency: 8, throughput: 4 },
        maxQueue: 16,
        maxWorkers: 1,
      },
    )
    const blocker = executor.run('blocker', { lane: 'throughput' })
    const background = executor.run('background', { lane: 'background' })
    const throughput = executor.run('throughput', { lane: 'throughput' })
    const latency = Array.from({ length: 5 }, (_, index) =>
      executor.run(`latency-${index}`, { lane: 'latency' }),
    )
    const worker = TestWorker.instances[0]!

    for (let index = 0; index < 8; index += 1) {
      const postIndex = worker.posts.length - 1
      const request = String(worker.posts[postIndex]?.request)
      worker.resolve(request, postIndex)
      await Promise.resolve()
    }

    await Promise.all([blocker, background, throughput, ...latency])
    expect(
      worker.posts
        .filter((post) => post.type === 'run')
        .map((post) => post.request),
    ).toEqual([
      'blocker',
      'latency-0',
      'latency-1',
      'latency-2',
      'latency-3',
      'throughput',
      'background',
      'latency-4',
    ])
    executor.dispose()
  })

  it('cancels stale generations in the worker protocol', async () => {
    const events: string[] = []
    const executor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      {
        maxWorkers: 1,
        onEvent: (event) => events.push(event.type),
      },
    )
    const stale = executor.run('stale', {
      generation: 1,
      key: 'query',
      lane: 'latency',
    })
    const latest = executor.run('latest', {
      generation: 2,
      key: 'query',
      lane: 'latency',
    })
    const worker = TestWorker.instances[0]!

    expect(worker.posts.map((post) => post.type)).toEqual(['run', 'cancel'])
    await expect(stale).resolves.toMatchObject({
      error: { code: 'aborted' },
      ok: false,
    })
    worker.resolve('ignored-stale-result', 0)
    await Promise.resolve()
    expect(worker.posts.map((post) => post.type)).toEqual([
      'run',
      'cancel',
      'run',
    ])
    worker.resolve('latest-result', 2)
    await expect(latest).resolves.toEqual({
      ok: true,
      value: 'latest-result',
    })
    expect(events).toContain('request-cancel')
    executor.dispose()
  })

  it('coalesces continuous input to one queued latest generation', async () => {
    const executor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      { maxQueue: 4, maxWorkers: 1 },
    )
    const requests = Array.from({ length: 12 }, (_, index) =>
      executor.run(`query-${index}`, {
        generation: index + 1,
        key: 'continuous-query',
        lane: 'latency',
      }),
    )
    const worker = TestWorker.instances[0]!

    expect(executor.getPendingCount()).toBe(1)
    expect(executor.getQueueDepth()).toBe(1)
    expect(worker.posts.filter((post) => post.type === 'run')).toHaveLength(1)

    worker.resolve('ignored-stale-result', 0)
    await Promise.resolve()
    expect(worker.posts.filter((post) => post.type === 'run')).toHaveLength(2)
    expect(worker.posts.at(-1)).toMatchObject({
      generation: 12,
      request: 'query-11',
      type: 'run',
    })
    worker.resolve('latest-result', worker.posts.length - 1)

    const results = await Promise.all(requests)
    expect(results.slice(0, -1).every((result) => result.ok === false)).toBe(
      true,
    )
    expect(results.at(-1)).toEqual({ ok: true, value: 'latest-result' })
    executor.dispose()
  })

  it('propagates AbortSignal as a cancel message', async () => {
    const executor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      { maxWorkers: 1 },
    )
    const controller = new AbortController()
    const result = executor.run('abort-me', {
      generation: 4,
      key: 'editor',
      signal: controller.signal,
    })
    const worker = TestWorker.instances[0]!
    controller.abort()

    await expect(result).resolves.toMatchObject({
      error: { code: 'aborted' },
      ok: false,
    })
    expect(worker.posts.at(-1)).toMatchObject({
      generation: 4,
      key: 'editor',
      type: 'cancel',
    })
    executor.dispose()
  })

  it('enforces clone and queue budgets with drop diagnostics', async () => {
    const events: Array<{ cloneBytes?: number; type: string }> = []
    const cloneExecutor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      {
        onEvent: (event) => events.push(event),
        structuredCloneLimitBytes: 16,
      },
    )
    await expect(
      cloneExecutor.run('payload exceeding budget'),
    ).resolves.toMatchObject({
      error: { code: 'protocol', message: 'fsus_worker_clone_budget_exceeded' },
      ok: false,
    })
    expect(cloneExecutor.getWorkerCount()).toBe(0)
    expect(events.at(-1)).toMatchObject({ type: 'request-drop' })
    expect(events.at(-1)?.cloneBytes).toBeGreaterThan(16)

    const queueExecutor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      {
        laneQueueLimits: { background: 1 },
        maxQueue: 1,
        maxWorkers: 1,
      },
    )
    const active = queueExecutor.run('active')
    const queued = queueExecutor.run('queued', { lane: 'background' })
    const dropped = queueExecutor.run('dropped', { lane: 'background' })
    await expect(dropped).resolves.toMatchObject({
      error: { message: 'fsus_worker_lane_queue_full' },
      ok: false,
    })
    const worker = TestWorker.instances.at(-1)!
    worker.resolve('active')
    await active
    worker.resolve('queued', worker.posts.length - 1)
    await queued
    queueExecutor.dispose()
  })

  it('passes transferable buffers without counting them as cloned payload', async () => {
    class TransferWorker extends TestWorker {
      override postMessage(
        message: TestWorkerPayload,
        transfer: Transferable[] = [],
      ) {
        const cloned = structuredClone(message, { transfer })
        super.postMessage(cloned, transfer)
      }
    }
    const executor = createFsusWorkerExecutor<Uint8Array, number>(
      () => new TransferWorker() as unknown as Worker,
      { maxWorkers: 1, structuredCloneLimitBytes: 8 },
    )
    const buffer = new ArrayBuffer(1024)
    const request = new Uint8Array(buffer)
    const result = executor.run(request, { transfer: [buffer] })
    const worker = TestWorker.instances.at(-1)!

    expect(buffer.byteLength).toBe(0)
    expect(worker.transfers[0]).toHaveLength(1)
    worker.resolve(1024)
    await expect(result).resolves.toEqual({ ok: true, value: 1024 })
    executor.dispose()
  })

  it('defers background work while the main thread reports pending input', async () => {
    vi.useFakeTimers()
    let busy = true
    const executor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      {
        backgroundDeferMs: 10,
        isMainThreadBusy: () => busy,
        maxWorkers: 1,
      },
    )
    const result = executor.run('background', { lane: 'background' })
    const worker = TestWorker.instances[0]!
    expect(worker.posts).toHaveLength(0)

    busy = false
    vi.advanceTimersByTime(10)
    expect(worker.posts).toHaveLength(1)
    worker.resolve('done')
    await expect(result).resolves.toEqual({ ok: true, value: 'done' })
    executor.dispose()
  })

  it('retries an opted-in task on a replacement worker after a crash', async () => {
    const events: string[] = []
    const executor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      { maxWorkers: 1, onEvent: (event) => events.push(event.type) },
    )
    const result = executor.run('retry', { retryOnCrash: true })
    TestWorker.instances[0]!.fail(new Error('first worker crashed'))

    expect(TestWorker.instances).toHaveLength(2)
    TestWorker.instances[1]!.resolve('recovered')
    await expect(result).resolves.toEqual({ ok: true, value: 'recovered' })
    expect(events).toEqual(
      expect.arrayContaining(['worker-crash', 'request-retry']),
    )
    executor.dispose()
  })

  it('cleans up aborted and timed out worker requests', async () => {
    vi.useFakeTimers()
    const executor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      { idleTerminateMs: 20, requestTimeoutMs: 30 },
    )

    const controller = new AbortController()
    const aborted = executor.run('abort', controller.signal)
    controller.abort()
    await expect(aborted).resolves.toMatchObject({
      error: { code: 'aborted' },
      ok: false,
    })
    expect(executor.getPendingCount()).toBe(0)

    const timedOut = executor.run('timeout')
    const worker = TestWorker.instances[TestWorker.instances.length - 1]
    vi.advanceTimersByTime(30)
    await expect(timedOut).resolves.toMatchObject({
      error: { code: 'timeout', message: 'fsus_worker_request_timeout' },
      ok: false,
    })
    expect(worker.terminated).toBe(true)
  })

  it('isolates a worker crash from tasks running on healthy pool workers', async () => {
    const executor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      { maxWorkers: 2, requestTimeoutMs: 1_000 },
    )
    const first = executor.run('first')
    const second = executor.run('second')
    const [failedWorker, healthyWorker] = TestWorker.instances

    failedWorker!.fail(new Error('worker exploded'))

    await expect(first).resolves.toMatchObject({
      error: { code: 'infra', message: 'worker exploded' },
      ok: false,
    })
    healthyWorker!.resolve('healthy')
    await expect(second).resolves.toEqual({ ok: true, value: 'healthy' })
    expect(executor.getPendingCount()).toBe(0)
    expect(failedWorker!.terminated).toBe(true)
    expect(healthyWorker!.terminated).toBe(false)
    executor.dispose()
  })

  it('uses adapter worker configuration through the unified runtime', async () => {
    vi.stubGlobal('Worker', TestWorker)
    const source = ref('worker source')
    const prepare = vi.fn(async (value: string, _signal: AbortSignal) => ({
      units: [`main:${value}`],
    }))
    let pipeline:
      | ReturnType<typeof useFsusRenderPipelineRuntime<string, string>>
      | undefined

    const Probe = defineComponent({
      setup() {
        pipeline = useFsusRenderPipelineRuntime<string, string>({
          adapter: {
            id: 'worker-runtime',
            canUseWorker: () => true,
            estimate: () => ({ items: 800 }),
            estimateSize: () => 20,
            fingerprint: (value) => value,
            keyOf: (unit) => unit,
            prepare,
            worker: {
              createWorker: () => new TestWorker() as unknown as Worker,
              requestTimeoutMs: 1_000,
            },
          },
          config: { mode: 'enabled', worker: 'enabled' },
          source,
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    const render = pipeline!.render()
    const worker = TestWorker.instances[0]
    worker.resolve(
      { metadata: { source: 'worker' }, units: ['worker:source'] },
      undefined,
      { computeDurationMs: 0.25 },
    )
    await render

    expect(pipeline!.strategy.value).toBe('chunked-worker')
    expect(pipeline!.renderedStrategy.value).toBe('chunked-worker')
    expect(pipeline!.document.value?.units).toEqual(['worker:source'])
    expect(prepare).not.toHaveBeenCalled()
    expect(
      pipeline!.diagnostics.value
        .filter((event) => event.type === 'stage-sample')
        .map((event) => event.stage),
    ).toEqual(expect.arrayContaining(['worker-compute', 'worker-transfer']))
    wrapper.unmount()
  })

  it('shares worker executors by pool key without coupling runtimes', async () => {
    vi.stubGlobal('Worker', TestWorker)
    const adapter = {
      id: 'shared-worker-runtime',
      canUseWorker: () => true,
      estimate: () => ({ items: 800 }),
      estimateSize: () => 20,
      fingerprint: (value: string) => value,
      keyOf: (unit: string) => unit,
      prepare: async (value: string) => ({ units: [`main:${value}`] }),
      worker: {
        createWorker: () => new TestWorker() as unknown as Worker,
        maxWorkers: 2,
        pool: 'shared' as const,
        poolKey: 'shared-worker-test',
        requestTimeoutMs: 1_000,
      },
    }
    const firstSource = ref('first')
    const secondSource = ref('second')
    let first:
      | ReturnType<typeof useFsusRenderPipelineRuntime<string, string>>
      | undefined
    let second:
      | ReturnType<typeof useFsusRenderPipelineRuntime<string, string>>
      | undefined

    const Probe = defineComponent({
      setup() {
        first = useFsusRenderPipelineRuntime<string, string>({
          adapter,
          config: { mode: 'enabled', worker: 'enabled' },
          source: firstSource,
        })
        second = useFsusRenderPipelineRuntime<string, string>({
          adapter,
          config: { mode: 'enabled', worker: 'enabled' },
          source: secondSource,
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    const firstRender = first!.render()
    const secondRender = second!.render()
    const [firstWorker, secondWorker] = TestWorker.instances

    expect(TestWorker.instances).toHaveLength(2)
    expect(firstWorker!.posts).toHaveLength(1)
    expect(secondWorker!.posts).toHaveLength(1)

    firstWorker!.resolve({ units: ['worker:first'] }, 0)
    secondWorker!.resolve({ units: ['worker:second'] }, 0)
    await firstRender
    await secondRender

    expect(first!.document.value?.units).toEqual(['worker:first'])
    expect(second!.document.value?.units).toEqual(['worker:second'])
    wrapper.unmount()
    expect(firstWorker!.terminated).toBe(true)
    expect(secondWorker!.terminated).toBe(true)
  })

  it('falls back to chunked-main when adapter worker rendering fails', async () => {
    vi.stubGlobal('Worker', TestWorker)
    const source = ref('fallback source')
    const prepare = vi.fn(
      async (
        value: string,
        _signal: AbortSignal,
        strategy: 'sync' | 'chunked-main' | 'chunked-worker' | 'disabled',
      ) => ({
        metadata: { strategy },
        units: [`${strategy}:${value}`],
      }),
    )
    let pipeline:
      | ReturnType<typeof useFsusRenderPipelineRuntime<string, string>>
      | undefined

    const Probe = defineComponent({
      setup() {
        pipeline = useFsusRenderPipelineRuntime<string, string>({
          adapter: {
            id: 'worker-fallback-runtime',
            canUseWorker: () => true,
            estimate: () => ({ items: 800 }),
            estimateSize: () => 20,
            fingerprint: (value) => value,
            keyOf: (unit) => unit,
            prepare,
            worker: {
              createWorker: () => new TestWorker() as unknown as Worker,
              requestTimeoutMs: 1_000,
            },
          },
          config: { mode: 'enabled', worker: 'enabled' },
          source,
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    const render = pipeline!.render()
    const worker = TestWorker.instances[0]
    const idleCallbacks: IdleRequestCallback[] = []
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      idleCallbacks.push(callback)
      return idleCallbacks.length
    })
    worker.reject({ message: 'worker failed', name: 'WorkerError' })
    await Promise.resolve()
    expect(prepare).not.toHaveBeenCalled()
    idleCallbacks.at(-1)?.({
      didTimeout: false,
      timeRemaining: () => 8,
    })
    await render

    expect(prepare).toHaveBeenCalledWith(
      'fallback source',
      expect.any(AbortSignal),
      'chunked-main',
    )
    expect(pipeline!.renderedStrategy.value).toBe('chunked-main')
    expect(pipeline!.document.value?.units).toEqual([
      'chunked-main:fallback source',
    ])
    expect(
      pipeline!.diagnostics.value.some(
        (event) => event.type === 'worker-fallback',
      ),
    ).toBe(true)
    wrapper.unmount()
  })
})
