import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  chooseFsusRenderPipelineStrategy,
  clearFsusRenderPipelineAdapters,
  clearFsusRenderPipelineComponentPolicies,
  clearFsusRenderPipelineStrategyResolvers,
  createFsusWorkerExecutor,
  getFsusRenderPipelineAdapter,
  getFsusRenderPipelineComponentPolicy,
  registerFsusRenderPipelineAdapter,
  registerFsusRenderPipelineComponentPolicy,
  registerFsusRenderPipelineStrategyResolver,
  resolveFsusRenderPipelineCompositorEnabled,
  resolveFsusRenderPipelineComponentPolicy,
  resolveFsusRenderPipelineCache,
  resolveFsusRenderPipelineConfig,
  resolveFsusRenderPipelineContentVisibilityEnabled,
  resolveFsusRenderPipelineHardwareProfile,
  shouldUseFsusRenderPipeline,
  useFsusRenderPipelineHardwareProfile,
  useFsusRenderPipelineRuntime,
  useFsusVirtualWindow,
} from '../use-render-pipeline'

type TestWorkerPayload = {
  id: number
  request: unknown
}

class TestWorker {
  static instances: TestWorker[] = []

  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  posts: TestWorkerPayload[] = []
  terminated = false

  constructor() {
    TestWorker.instances.push(this)
  }

  postMessage(message: TestWorkerPayload) {
    if (this.terminated) {
      throw new Error('test_worker_terminated')
    }
    this.posts.push(message)
  }

  terminate() {
    this.terminated = true
  }

  resolve(result: unknown, postIndex = this.posts.length - 1) {
    const post = this.posts[postIndex]
    if (!post) throw new Error('test_worker_post_missing')
    this.onmessage?.({ data: { id: post.id, result } } as MessageEvent)
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
    expect(cpuConfig.budget.frameMs).toBe(4)
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
    expect(worker.posts).toEqual([{ id: 1, request: 'first' }])

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

  it('resolves all pending requests with errors when the worker fails', async () => {
    const executor = createFsusWorkerExecutor<string, string>(
      () => new TestWorker() as unknown as Worker,
      { requestTimeoutMs: 1_000 },
    )
    const first = executor.run('first')
    const second = executor.run('second')
    const worker = TestWorker.instances[0]

    worker.fail(new Error('worker exploded'))

    await expect(first).resolves.toMatchObject({
      error: { code: 'infra', message: 'worker exploded' },
      ok: false,
    })
    await expect(second).resolves.toMatchObject({
      error: { code: 'infra', message: 'worker exploded' },
      ok: false,
    })
    expect(executor.getPendingCount()).toBe(0)
    expect(worker.terminated).toBe(true)
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
    worker.resolve({ metadata: { source: 'worker' }, units: ['worker:source'] })
    await render

    expect(pipeline!.strategy.value).toBe('chunked-worker')
    expect(pipeline!.renderedStrategy.value).toBe('chunked-worker')
    expect(pipeline!.document.value?.units).toEqual(['worker:source'])
    expect(prepare).not.toHaveBeenCalled()
    wrapper.unmount()
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
    worker.reject({ message: 'worker failed', name: 'WorkerError' })
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
