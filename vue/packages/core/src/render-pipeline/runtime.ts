import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  unref,
  watch,
} from 'vue'
import type { MaybeRef } from 'vue'
import {
  createFsusError,
  createFsusRenderPipelineComponentPolicy,
  fsusErr,
  fsusOk,
  fsusTryAsync,
  getFsusRenderPipelineComponentPolicy,
  isFsusErr,
  isFsusOk,
  type FsusErrorDetail,
  type FsusRenderPipelineComponentPolicy,
  type FsusResult,
} from './component-policies'
import {
  createFsusRenderStageHistory,
  readRenderPipelineNow,
  resolveFsusAdaptiveRenderPipelineConfig,
} from './config'
import { emitDefaultFsusRenderPipelineDiagnostic } from './diagnostics'
import {
  resolveFsusRenderPipelineCompositorEnabled,
  resolveFsusRenderPipelineContentVisibilityEnabled,
  resolveFsusRenderPipelineHardwareAttrs,
  useFsusRenderPipelineHardwareProfile,
} from './hardware-profile'
import {
  chooseFsusRenderPipelineStrategy,
  createDefaultRenderPipelineStrategyCacheKey,
  defaultStrategyCache,
  getFsusRenderPipelineAdapter,
  injectFsusRenderPipelineContext,
  resolveFsusRenderPipelineComponentPolicy,
} from './registry'
import {
  createFsusWorkerExecutor,
  type FsusWorkerExecutorEvent,
  type FsusWorkerExecutorOptions,
} from './worker-pool'
import type {
  FsusRenderPipelineAdapter,
  FsusRenderPipelineAdaptiveSignals,
  FsusRenderPipelineConfig,
  FsusRenderPipelineDiagnosticEvent,
  FsusRenderPipelineDocument,
  FsusRenderPipelineEstimate,
  FsusRenderPipelineRuntimeOptions,
  FsusRenderPipelineRuntimeState,
  FsusRenderPipelineStage,
  FsusRenderPipelineState,
  FsusRenderPipelineStrategy,
} from './types'

type AnyFsusWorkerExecutor = ReturnType<
  typeof createFsusWorkerExecutor<unknown, unknown>
>

type FsusSharedWorkerExecutorEntry = {
  executor: AnyFsusWorkerExecutor
  listeners: Set<(event: FsusWorkerExecutorEvent) => void>
}

const sharedWorkerExecutors = new Map<string, FsusSharedWorkerExecutorEntry>()

const getSharedWorkerExecutor = <TRequest, TResponse>({
  createWorker,
  listener,
  options,
  poolKey,
}: {
  createWorker: () => Worker
  listener: (event: FsusWorkerExecutorEvent) => void
  options: FsusWorkerExecutorOptions
  poolKey: string
}) => {
  let entry = sharedWorkerExecutors.get(poolKey)
  if (!entry) {
    const listeners = new Set<(event: FsusWorkerExecutorEvent) => void>()
    const disposeIfUnused = () => {
      const activeEntry = sharedWorkerExecutors.get(poolKey)
      if (
        activeEntry &&
        activeEntry.listeners.size === 0 &&
        activeEntry.executor.getPendingCount() === 0
      ) {
        sharedWorkerExecutors.delete(poolKey)
        activeEntry.executor.dispose()
      }
    }
    entry = {
      executor: createFsusWorkerExecutor<unknown, unknown>(createWorker, {
        ...options,
        name: options.name ?? poolKey,
        onEvent: (event) => {
          options.onEvent?.(event)
          for (const activeListener of Array.from(listeners)) {
            activeListener(event)
          }
          if (listeners.size === 0) queueMicrotask(disposeIfUnused)
        },
      }),
      listeners,
    }
    sharedWorkerExecutors.set(poolKey, entry)
  }

  entry.listeners.add(listener)
  return {
    cleanup: () => {
      entry?.listeners.delete(listener)
      if (
        entry?.listeners.size === 0 &&
        entry.executor.getPendingCount() === 0
      ) {
        sharedWorkerExecutors.delete(poolKey)
        entry.executor.dispose()
      }
    },
    executor: entry.executor as ReturnType<
      typeof createFsusWorkerExecutor<TRequest, TResponse>
    >,
  }
}

let renderPipelineRuntimeId = 0

export const useFsusRenderPipelineRuntime = <TSource, TUnit>(
  options: FsusRenderPipelineRuntimeOptions<TSource, TUnit>,
): FsusRenderPipelineRuntimeState<TSource, TUnit> => {
  const injectedContext = injectFsusRenderPipelineContext()
  const emitDiagnostic =
    injectedContext?.emitDiagnostic ?? emitDefaultFsusRenderPipelineDiagnostic
  const invalidateProfile =
    injectedContext?.invalidateStrategyProfile ??
    defaultStrategyCache.invalidateProfile
  const getAdapter = injectedContext?.getAdapter ?? getFsusRenderPipelineAdapter
  const chooseStrategy =
    injectedContext?.chooseStrategy ?? chooseFsusRenderPipelineStrategy
  const createCacheKey =
    injectedContext?.createStrategyCacheKey ??
    createDefaultRenderPipelineStrategyCacheKey
  const getCached =
    injectedContext?.getCachedStrategy ?? defaultStrategyCache.get
  const setCached =
    injectedContext?.setCachedStrategy ?? defaultStrategyCache.set
  const documentRef = shallowRef<FsusRenderPipelineDocument<TUnit> | null>(null)
  const error = shallowRef<FsusErrorDetail | null>(null)
  const diagnostics = shallowRef<readonly FsusRenderPipelineDiagnosticEvent[]>(
    [],
  )
  const loading = ref(false)
  const renderedStrategy = shallowRef<FsusRenderPipelineStrategy>('sync')
  let taskId = 0
  const workerTaskKey = `render-runtime-${++renderPipelineRuntimeId}`
  let controller: AbortController | null = null
  let workerExecutor: ReturnType<
    typeof createFsusWorkerExecutor<
      TSource,
      FsusRenderPipelineDocument<TUnit> | null
    >
  > | null = null
  let workerExecutorAdapter: FsusRenderPipelineAdapter<TSource, TUnit> | null =
    null
  let workerExecutorShared = false
  let workerExecutorSharedCleanup: (() => void) | null = null
  const adaptiveSignals = shallowRef<FsusRenderPipelineAdaptiveSignals>({})
  const stageHistory = createFsusRenderStageHistory()

  const recordStage = (
    stage: FsusRenderPipelineStage,
    durationMs: number,
    strategy: FsusRenderPipelineStrategy,
  ) => {
    stageHistory.record(stage, durationMs)
    const stageStats = stageHistory.snapshot(stage)
    adaptiveSignals.value = {
      ...adaptiveSignals.value,
      stages: { ...adaptiveSignals.value.stages, [stage]: stageStats },
    }
    recordDiagnostic({
      durationMs,
      phase: stage,
      stage,
      stageStats,
      strategy,
      type: 'stage-sample',
    })
  }

  const recordDiagnostic = (event: FsusRenderPipelineDiagnosticEvent) => {
    const nextEvent = {
      adapterId: adapter.value?.id,
      budget: {
        frameMs: config.value.budget.frameMs,
        layerBudget: config.value.acceleration.layerBudget,
        measureBatch: config.value.budget.measureBatch,
        overscanPx: config.value.budget.overscanPx,
      },
      timestamp: readRenderPipelineNow(),
      ...event,
    }
    diagnostics.value = [...diagnostics.value.slice(-31), nextEvent]
    options.onDiagnostic?.(nextEvent)
    emitDiagnostic(nextEvent)
  }

  const sourceRef = computed(() => unref(options.source))

  const hardwareRuntime = useFsusRenderPipelineHardwareProfile(
    computed(() => unref(options.config)),
  )
  const capabilityProfile = hardwareRuntime.capabilityProfile
  watch(
    capabilityProfile,
    (profile) => {
      invalidateProfile(profile.version)
      adaptiveSignals.value = {
        ...adaptiveSignals.value,
        rafDriftMs: profile.refreshProfile.rafDriftMs,
      }
    },
    { immediate: true },
  )
  const config = computed(() =>
    resolveFsusAdaptiveRenderPipelineConfig(
      hardwareRuntime.config.value,
      hardwareRuntime.profile.value,
      adaptiveSignals.value,
    ),
  )
  const hardwareProfile = hardwareRuntime.profile
  const compositor = computed(() =>
    resolveFsusRenderPipelineCompositorEnabled(
      config.value,
      hardwareProfile.value,
    ),
  )
  const contentVisibility = computed(() =>
    resolveFsusRenderPipelineContentVisibilityEnabled(
      config.value,
      hardwareProfile.value,
    ),
  )
  const hardwareAttrs = computed(() =>
    resolveFsusRenderPipelineHardwareAttrs({
      compositor: compositor.value,
      contentVisibility: contentVisibility.value,
      hardwareProfile: hardwareProfile.value,
      layerBudget: config.value.acceleration.layerBudget,
    }),
  )

  const componentPolicy = computed<FsusRenderPipelineComponentPolicy | null>(
    () => {
      const componentName = unref(options.componentName)?.trim()
      if (!componentName) return null
      return (
        getFsusRenderPipelineComponentPolicy(componentName) ??
        createFsusRenderPipelineComponentPolicy(componentName)
      )
    },
  )

  const adapter = computed(() => {
    const directAdapter = unref(options.adapter)
    if (directAdapter) return directAdapter

    const explicitAdapterId = unref(options.adapterId)?.trim()
    const policyAdapterId = componentPolicy.value?.adapterId?.trim()
    const adapterId = explicitAdapterId || policyAdapterId
    if (!adapterId) return null

    return getAdapter<TSource, TUnit>(adapterId) ?? null
  })

  const estimate = computed<FsusRenderPipelineEstimate>(() => ({
    ...componentPolicy.value?.estimate,
    ...adapter.value?.estimate(sourceRef.value),
    ...unref(options.estimate),
  }))

  const canUseWorker = computed(
    () =>
      (adapter.value?.canUseWorker?.(sourceRef.value) ??
        !!adapter.value?.worker) &&
      !!adapter.value,
  )

  const policy = computed(() => {
    const componentName = componentPolicy.value?.componentName
    if (!componentName) return null
    return resolveFsusRenderPipelineComponentPolicy(
      componentName,
      config.value,
      {
        canUseWorker: canUseWorker.value,
        chooseStrategy,
        estimate: estimate.value,
      },
    )
  })

  const strategyCacheKey = computed(() =>
    createCacheKey({
      adapter: adapter.value,
      canUseWorker: canUseWorker.value,
      config: config.value,
      source: sourceRef.value,
    }),
  )

  const strategy = computed<FsusRenderPipelineStrategy>(() => {
    const cached = getCached(
      strategyCacheKey.value,
      capabilityProfile.value.version,
    )
    if (cached) return cached.strategy
    if (policy.value) return policy.value.strategy
    return chooseStrategy(estimate.value, config.value, canUseWorker.value)
  })

  const clearWorkerExecutor = () => {
    workerExecutorSharedCleanup?.()
    workerExecutorSharedCleanup = null
    if (workerExecutor && !workerExecutorShared) {
      workerExecutor.dispose()
    }
    workerExecutor = null
    workerExecutorAdapter = null
    workerExecutorShared = false
  }

  const getWorkerExecutor = (
    activeAdapter: FsusRenderPipelineAdapter<TSource, TUnit>,
  ) => {
    const workerOptions = activeAdapter.worker
    if (!workerOptions) return null

    if (workerExecutor && workerExecutorAdapter === activeAdapter) {
      return workerExecutor
    }

    clearWorkerExecutor()
    workerExecutorAdapter = activeAdapter
    const workerEventListener = (event: FsusWorkerExecutorEvent) => {
      recordDiagnostic({
        cloneBytes: event.cloneBytes,
        durationMs: event.durationMs,
        error: event.error,
        generation: event.generation,
        key: event.key,
        lane: event.lane,
        pendingCount: event.pendingCount,
        queueDepth: event.queueDepth ?? event.pendingCount,
        queueWaitDurationMs: event.queueWaitDurationMs,
        retryCount: event.retryCount,
        strategy: renderedStrategy.value,
        type: event.type,
        workerCount: event.workerCount,
        workerId: event.workerId,
      })
      adaptiveSignals.value = {
        ...adaptiveSignals.value,
        queueDepth: event.pendingCount,
      }
      if (event.type === 'request-resolve') {
        if (event.computeDurationMs !== undefined) {
          recordStage(
            'worker-compute',
            event.computeDurationMs,
            renderedStrategy.value,
          )
        }
        if (event.transferDurationMs !== undefined) {
          recordStage(
            'worker-transfer',
            event.transferDurationMs,
            renderedStrategy.value,
          )
        }
      }
    }
    const executorOptions: FsusWorkerExecutorOptions = {
      backgroundDeferMs: workerOptions.backgroundDeferMs,
      idleTerminateMs: workerOptions.idleTerminateMs,
      isMainThreadBusy: workerOptions.isMainThreadBusy,
      laneQueueLimits: workerOptions.laneQueueLimits,
      maxQueue: workerOptions.maxQueue,
      maxWorkers: workerOptions.maxWorkers,
      name: workerOptions.name ?? activeAdapter.id,
      requireGenerationEcho: workerOptions.requireGenerationEcho,
      requestTimeoutMs: workerOptions.requestTimeoutMs,
      reservedCores: workerOptions.reservedCores,
      serializeError: workerOptions.serializeError,
      structuredCloneLimitBytes: workerOptions.structuredCloneLimitBytes,
    }

    if (workerOptions.pool === 'shared') {
      const shared = getSharedWorkerExecutor<
        TSource,
        FsusRenderPipelineDocument<TUnit> | null
      >({
        createWorker: workerOptions.createWorker,
        listener: workerEventListener,
        options: {
          ...executorOptions,
          onEvent: workerOptions.onEvent,
        },
        poolKey:
          workerOptions.poolKey ?? workerOptions.name ?? activeAdapter.id,
      })
      workerExecutor = shared.executor
      workerExecutorShared = true
      workerExecutorSharedCleanup = shared.cleanup
      return workerExecutor
    }

    workerExecutor = createFsusWorkerExecutor<
      TSource,
      FsusRenderPipelineDocument<TUnit> | null
    >(workerOptions.createWorker, {
      ...executorOptions,
      onEvent: (event) => {
        workerOptions.onEvent?.(event)
        workerEventListener(event)
      },
    })
    workerExecutorShared = false

    return workerExecutor
  }

  const waitForWorkerFallbackBudget = (signal: AbortSignal) =>
    new Promise<void>((resolve) => {
      if (signal.aborted) {
        resolve()
        return
      }
      let settled = false
      const complete = () => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', complete)
        resolve()
      }
      signal.addEventListener('abort', complete, { once: true })
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(complete, { timeout: 50 })
      } else if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => setTimeout(complete, 0))
      } else {
        setTimeout(complete, 0)
      }
    })

  const prepareDocument = async (
    activeAdapter: FsusRenderPipelineAdapter<TSource, TUnit>,
    input: TSource,
    activeStrategy: FsusRenderPipelineStrategy,
    signal: AbortSignal,
    generation: number,
  ): Promise<FsusResult<FsusRenderPipelineDocument<TUnit>>> => {
    if (activeStrategy === 'chunked-worker') {
      const executor = getWorkerExecutor(activeAdapter)

      if (executor) {
        const workerDocument = await executor.run(input, {
          generation,
          key: `${workerTaskKey}:${activeAdapter.id}`,
          lane: 'throughput',
          signal,
        })
        if (workerDocument.ok && workerDocument.value) {
          renderedStrategy.value = 'chunked-worker'
          return fsusOk(workerDocument.value)
        }

        const workerError = isFsusOk(workerDocument)
          ? createFsusError(
              'protocol',
              'fsus_render_pipeline_worker_empty_result',
            )
          : workerDocument.error
        if (!signal.aborted) {
          recordDiagnostic({
            error: workerError,
            fallbackReason: workerError.message,
            phase: 'prepare',
            strategy: 'chunked-worker',
            type: 'worker-fallback',
          })
          await waitForWorkerFallbackBudget(signal)
          if (signal.aborted) return fsusErr(workerError)
          const fallbackDocument = await fsusTryAsync(
            () => activeAdapter.prepare(input, signal, 'chunked-main'),
            'fsus_render_pipeline_prepare_failed',
            'infra',
          )
          if (isFsusErr(fallbackDocument)) return fallbackDocument
          renderedStrategy.value = 'chunked-main'
          return fallbackDocument
        }

        return fsusErr(workerError)
      }
    }

    const preparedDocument = await fsusTryAsync(
      () => activeAdapter.prepare(input, signal, activeStrategy),
      'fsus_render_pipeline_prepare_failed',
      'infra',
    )
    if (isFsusErr(preparedDocument)) return preparedDocument
    renderedStrategy.value = activeStrategy
    return preparedDocument
  }

  const render = async () => {
    const currentTaskId = ++taskId
    controller?.abort()
    controller = new AbortController()
    const input = sourceRef.value
    const activeAdapter = adapter.value
    const activeStrategy = strategy.value
    const activeStrategyCacheKey = strategyCacheKey.value
    const activeStrategyCacheEntry = getCached(
      activeStrategyCacheKey,
      capabilityProfile.value.version,
    )
    const startedAt = readRenderPipelineNow()
    const queuedAt = startedAt

    loading.value = true
    error.value = null
    renderedStrategy.value = activeStrategy
    recordDiagnostic({
      cache: activeStrategyCacheKey
        ? activeStrategyCacheEntry
          ? 'hit'
          : 'miss'
        : 'bypass',
      phase: 'prepare',
      strategy: activeStrategy,
      type: 'render-start',
    })
    recordStage(
      'queue-wait',
      Math.max(0, readRenderPipelineNow() - queuedAt),
      activeStrategy,
    )

    if (!activeAdapter) {
      const missingAdapterError = createFsusError(
        'invariant',
        'fsus_render_pipeline_adapter_missing',
      )
      error.value = missingAdapterError
      documentRef.value = null
      loading.value = false
      recordDiagnostic({
        error: missingAdapterError,
        phase: 'prepare',
        strategy: activeStrategy,
        type: 'render-error',
      })
      return
    }

    const prepareStartedAt = readRenderPipelineNow()
    const nextDocument = await prepareDocument(
      activeAdapter,
      input,
      activeStrategy,
      controller.signal,
      currentTaskId,
    )
    recordStage(
      'prepare',
      readRenderPipelineNow() - prepareStartedAt,
      renderedStrategy.value,
    )

    if (currentTaskId !== taskId || controller.signal.aborted) {
      loading.value = false
      return
    }

    if (isFsusOk(nextDocument)) {
      const commitStartedAt = readRenderPipelineNow()
      documentRef.value = nextDocument.value
      await nextTick()
      if (currentTaskId !== taskId || controller.signal.aborted) return
      recordStage(
        'vue-commit',
        readRenderPipelineNow() - commitStartedAt,
        renderedStrategy.value,
      )
      const nextFrame = () =>
        new Promise<void>((resolve) => {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve())
          } else resolve()
        })
      const layoutStartedAt = readRenderPipelineNow()
      await nextFrame()
      if (currentTaskId !== taskId || controller.signal.aborted) return
      recordStage(
        'style-layout',
        readRenderPipelineNow() - layoutStartedAt,
        renderedStrategy.value,
      )
      const paintStartedAt = readRenderPipelineNow()
      await nextFrame()
      if (currentTaskId !== taskId || controller.signal.aborted) return
      recordStage(
        'next-paint',
        readRenderPipelineNow() - paintStartedAt,
        renderedStrategy.value,
      )
      const durationMs = readRenderPipelineNow() - startedAt
      recordStage('total', durationMs, renderedStrategy.value)
      setCached(activeStrategyCacheKey, {
        durationMs,
        profileVersion: capabilityProfile.value.version,
        strategy: renderedStrategy.value,
      })
      adaptiveSignals.value = {
        ...adaptiveSignals.value,
        queueDepth: workerExecutor?.getPendingCount() ?? 0,
        renderDurationMs: durationMs,
      }
      recordDiagnostic({
        durationMs,
        phase: 'commit',
        strategy: renderedStrategy.value,
        type: 'render-complete',
      })
    } else {
      const durationMs = readRenderPipelineNow() - startedAt
      error.value = nextDocument.error
      documentRef.value = null
      adaptiveSignals.value = {
        ...adaptiveSignals.value,
        queueDepth: workerExecutor?.getPendingCount() ?? 0,
        renderDurationMs: durationMs,
      }
      recordDiagnostic({
        durationMs,
        error: nextDocument.error,
        phase: 'commit',
        strategy: renderedStrategy.value,
        type: 'render-error',
      })
    }

    if (currentTaskId === taskId) {
      loading.value = false
    }
  }

  onBeforeUnmount(() => {
    taskId += 1
    controller?.abort()
    clearWorkerExecutor()
  })

  return {
    adapter,
    canUseWorker,
    capabilityProfile,
    compositor,
    config,
    contentVisibility,
    diagnostics,
    document: documentRef,
    error,
    estimate,
    hardwareAttrs,
    hardwareProfile,
    loading,
    policy,
    render,
    renderedStrategy,
    strategy,
  }
}

export const useFsusRenderPipeline = <TSource, TUnit>(
  adapter: FsusRenderPipelineAdapter<TSource, TUnit>,
  source: MaybeRef<TSource>,
  options: MaybeRef<{ config?: FsusRenderPipelineConfig | null } | undefined>,
): FsusRenderPipelineState<TUnit> & {
  render: () => Promise<void>
} =>
  useFsusRenderPipelineRuntime({
    adapter,
    config: computed(() => unref(options)?.config),
    source,
  })
