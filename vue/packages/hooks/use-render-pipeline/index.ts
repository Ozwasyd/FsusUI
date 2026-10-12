import {
  computed,
  isRef,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  unref,
  watch,
} from 'vue'
import {
  createFsusError,
  createFsusRenderPipelineComponentPolicy,
  fsusErr,
  fsusOk,
  fsusTryAsync,
  getFsusRenderPipelineComponentPolicy,
  getFsusRenderPipelineComponentPolicyAuthority,
  isFsusErr,
  isFsusOk,
  type FsusRenderPipelineComponentPolicy,
  type FsusErrorDetail,
  type FsusResult,
} from '@element-plus/utils'

import { getGlobalConfigFeed } from '@element-plus/components/config-provider/src/hooks/use-global-config'

import type { ComputedRef, MaybeRef, Ref } from 'vue'

import { FsusVirtualSizeIndex } from './virtual-window-index'
import {
  createFsusWorkerExecutor,
  type FsusWorkerExecutorEvent,
  type FsusWorkerExecutorEventType,
  type FsusWorkerExecutorOptions,
  type FsusWorkerTaskLane,
  type FsusWorkerResourceInspection,
  type FsusWorkerTaskScope,
  type FsusWorkerTaskControlResult,
} from './worker-pool'

export { FsusVirtualSizeIndex } from './virtual-window-index'
export {
  createFsusWorkerExecutor,
  resolveFsusWorkerPoolSize,
} from './worker-pool'
export type {
  FsusWorkerCancelMessage,
  FsusWorkerExecutorEvent,
  FsusWorkerExecutorEventType,
  FsusWorkerExecutorOptions,
  FsusWorkerPoolSizingInput,
  FsusWorkerResponse,
  FsusWorkerRunMessage,
  FsusWorkerRunOptions,
  FsusWorkerTaskLane,
  FsusWorkerResourceInspection,
  FsusWorkerTaskScope,
  FsusWorkerTaskControlResult,
} from './worker-pool'

export {
  clearFsusRenderPipelineComponentPolicies,
  createFsusRenderPipelineComponentPolicies,
  createFsusRenderPipelineComponentPolicy,
  getFsusComponentName,
  getFsusRenderPipelineComponentPolicy,
  listFsusRenderPipelineComponentPolicies,
  registerFsusDefaultRenderPipelineComponentPolicies,
  registerFsusRenderPipelineComponentPolicies,
  registerFsusRenderPipelineComponentPolicy,
  registerFsusRenderPipelineComponentPolicyByName,
  resolveFsusInstallComponentName,
} from '@element-plus/utils'

export type {
  FsusRenderPipelineComponentEstimate,
  FsusRenderPipelineComponentPolicy,
  FsusRenderPipelineComponentRole,
} from '@element-plus/utils'

export type FsusRenderPipelineMode = 'auto' | 'enabled' | 'disabled'
export type FsusRenderPipelineWorkerMode = 'auto' | 'enabled' | 'disabled'
export type FsusRenderPipelineHardwareMode = 'auto' | 'gpu' | 'cpu'
export type FsusRenderPipelineCompositorMode = 'auto' | 'enabled' | 'disabled'
export type FsusRenderPipelineAdaptiveMode = 'auto' | 'enabled' | 'disabled'
export type FsusRenderHardwareProfile = 'gpu-compositor' | 'cpu-threaded'
export type FsusRenderPipelineStrategy =
  | 'sync'
  | 'chunked-main'
  | 'chunked-worker'
  | 'disabled'
export type FsusRenderSchedulerPriority =
  | 'user-blocking'
  | 'visible'
  | 'background'
export type FsusRenderMotionMode = 'enabled' | 'reduced' | 'disabled'
export type FsusRenderComputeProfile = 'low' | 'normal' | 'high'
export type FsusRenderMemoryProfile = 'low' | 'normal' | 'high'
export type FsusRenderPipelineStage =
  | 'queue-wait'
  | 'worker-compute'
  | 'worker-transfer'
  | 'prepare'
  | 'vue-commit'
  | 'style-layout'
  | 'next-paint'
  | 'total'

export type FsusRenderRefreshProfile = {
  framePeriodMs: number
  hz: number
  mainThreadBudgetMs: number
  rafDriftMs: number
  sampleCount: number
}

export type FsusRenderCapabilityProfile = {
  compositorCapability: boolean
  computeCalibration: {
    mainOpsPerMs: number
    workerConcurrency: number
  }
  computeProfile: FsusRenderComputeProfile
  contentVisibilityCapability: boolean
  lowPower: boolean
  memoryProfile: FsusRenderMemoryProfile
  motionMode: FsusRenderMotionMode
  refreshProfile: FsusRenderRefreshProfile
  version: string
  visibility: 'visible' | 'hidden'
}

export type FsusScheduledWork =
  | { done: true }
  | { done: false; continuation: () => FsusScheduledWork }

export type FsusRenderPipelineEstimate = {
  htmlBytes?: number
  nodes?: number
  items?: number
}

export type FsusRenderEstimate = FsusRenderPipelineEstimate

export type FsusRenderPipelineAccelerationConfig = {
  mode?: FsusRenderPipelineHardwareMode
  compositor?: FsusRenderPipelineCompositorMode
  contentVisibility?: FsusRenderPipelineCompositorMode
  layerBudget?: number
}

export type FsusRenderPipelineConfig = {
  adaptive?: FsusRenderPipelineAdaptiveMode
  mode?: FsusRenderPipelineMode
  worker?: FsusRenderPipelineWorkerMode
  thresholds?: {
    htmlBytes?: number
    estimatedNodes?: number
    itemCount?: number
  }
  budget?: {
    dynamicFrameMs?: boolean
    frameMs?: number
    overscanPx?: number
    measureBatch?: number
  }
  acceleration?: FsusRenderPipelineAccelerationConfig
}

export type FsusResolvedRenderPipelineAcceleration = {
  mode: FsusRenderPipelineHardwareMode
  compositor: FsusRenderPipelineCompositorMode
  contentVisibility: FsusRenderPipelineCompositorMode
  layerBudget: number
}

export type FsusResolvedRenderPipelineConfig = {
  adaptive: FsusRenderPipelineAdaptiveMode
  mode: FsusRenderPipelineMode
  worker: FsusRenderPipelineWorkerMode
  thresholds: {
    htmlBytes: number
    estimatedNodes: number
    itemCount: number
  }
  budget: {
    dynamicFrameMs: boolean
    frameMs: number
    overscanPx: number
    measureBatch: number
  }
  acceleration: FsusResolvedRenderPipelineAcceleration
}

export type FsusRenderPipelineDocument<TUnit> = {
  units: readonly TUnit[]
  html?: string
  metadata?: unknown
}

export type FsusRenderDocument<TUnit> = FsusRenderPipelineDocument<TUnit>

export type FsusRenderPipelineWorkerPoolMode = 'runtime' | 'shared'

export type FsusRenderPipelineWorkerOptions = FsusWorkerExecutorOptions & {
  createWorker: () => Worker
  pool?: FsusRenderPipelineWorkerPoolMode
  poolKey?: string
}

export type FsusRenderPipelineDiagnosticEvent = {
  adapterId?: string
  budget?: {
    frameMs: number
    layerBudget: number
    measureBatch: number
    overscanPx: number
  }
  cache?: 'hit' | 'miss' | 'bypass'
  cloneBytes?: number
  durationMs?: number
  error?: FsusErrorDetail
  fallbackReason?: string
  generation?: number
  key?: string
  lane?: FsusWorkerTaskLane
  phase?: string
  stage?: FsusRenderPipelineStage
  stageStats?: FsusRenderStageStats
  pendingCount?: number
  queueDepth?: number
  queueWaitDurationMs?: number
  retryCount?: number
  strategy: FsusRenderPipelineStrategy
  timestamp?: number
  workerCount?: number
  workerId?: number
  type:
    | 'render-start'
    | 'render-complete'
    | 'render-error'
    | 'stage-sample'
    | 'strategy-cache'
    | 'worker-fallback'
    | FsusWorkerExecutorEventType
}

export type FsusRenderPipelineDiagnosticSink = (
  event: FsusRenderPipelineDiagnosticEvent,
) => void

export type FsusRenderPipelineDomAttrs = Record<string, string>

export type FsusRenderPipelineUnitAttrsOptions = {
  baseAttrs?: FsusRenderPipelineDomAttrs | null
  disableContentVisibilityOnOverflow?: boolean
  layerBudget?: number
  renderedCount?: number
  unitIndex?: number
}

export type FsusRenderPipelineDiagnosticsBuffer = {
  clear: () => void
  push: (event: FsusRenderPipelineDiagnosticEvent) => void
  snapshot: () => readonly FsusRenderPipelineDiagnosticEvent[]
}

export type FsusRenderPipelineAdaptiveSignals = {
  queueDepth?: number
  rafDriftMs?: number
  renderDurationMs?: number
  stages?: Partial<Record<FsusRenderPipelineStage, FsusRenderStageStats>>
}

export type FsusRenderSchedulerTaskOptions = {
  key?: string
  priority?: FsusRenderSchedulerPriority
  signal?: AbortSignal
}

export type FsusRenderStageStats = {
  ewmaMs: number
  p50Ms: number
  p95Ms: number
  sampleCount: number
}

export type FsusRenderPipelineAdapter<TSource, TUnit> = {
  id: string
  fingerprint: (source: TSource) => string
  estimate: (source: TSource) => FsusRenderEstimate
  prepare: (
    source: TSource,
    signal: AbortSignal,
    strategy: FsusRenderPipelineStrategy,
  ) => Promise<FsusRenderDocument<TUnit>>
  keyOf: (unit: TUnit, index: number) => string
  estimateSize: (unit: TUnit, index: number) => number
  canUseWorker?: (source: TSource) => boolean
  worker?: FsusRenderPipelineWorkerOptions
}

export type FsusRenderPipelineState<TUnit> = {
  document: Ref<FsusRenderPipelineDocument<TUnit> | null>
  error: Ref<FsusErrorDetail | null>
  loading: Ref<boolean>
  strategy:
    | ComputedRef<FsusRenderPipelineStrategy>
    | Ref<FsusRenderPipelineStrategy>
}

export type FsusRenderPipelineStrategyContext = {
  canUseWorker: boolean
  config: FsusResolvedRenderPipelineConfig
  estimate: FsusRenderEstimate
}

export type FsusRenderPipelineStrategyResolver = (
  context: FsusRenderPipelineStrategyContext,
) => FsusRenderPipelineStrategy | null | undefined

export type FsusRenderPipelineStrategyResolverOptions = {
  priority?: number
}

export type FsusResolvedRenderPipelineComponentPolicy =
  FsusRenderPipelineComponentPolicy & {
    strategy: FsusRenderPipelineStrategy
  }

export type FsusVirtualWindowItem<TUnit> = {
  index: number
  key: string
  offset: number
  size: number
  unit: TUnit
}

export type FsusVirtualWindowDiagnosticEvent = {
  batchSize?: number
  cacheSize?: number
  correction?: number
  itemCount: number
  reason?: 'insert-or-reorder' | 'measurement' | 'units'
  type:
    | 'index-rebuild'
    | 'measurement-batch'
    | 'measurement-cache'
    | 'scroll-correction'
}

export type FsusViewport = HTMLElement | Window

export type FsusRenderPipelineRuntimeOptions<TSource, TUnit> = {
  adapter?: MaybeRef<
    FsusRenderPipelineAdapter<TSource, TUnit> | null | undefined
  >
  adapterId?: MaybeRef<string | null | undefined>
  componentName?: MaybeRef<string | null | undefined>
  // Original producers for the exact source and adapter supplied below.
  sourceAuthority?: FsusRenderPipelineAuthority
  adapterAuthority?: FsusRenderPipelineAuthority
  config?: MaybeRef<FsusRenderPipelineConfig | null | undefined>
  estimate?: MaybeRef<FsusRenderPipelineEstimate | null | undefined>
  onDiagnostic?: (event: FsusRenderPipelineDiagnosticEvent) => void
  source: MaybeRef<TSource>
}

export type FsusRenderPipelineRuntimeState<TSource, TUnit> =
  FsusRenderPipelineState<TUnit> & {
    adapter: ComputedRef<FsusRenderPipelineAdapter<TSource, TUnit> | null>
    canUseWorker: ComputedRef<boolean>
    capabilityProfile: ComputedRef<FsusRenderCapabilityProfile>
    compositor: ComputedRef<boolean>
    config: ComputedRef<FsusResolvedRenderPipelineConfig>
    contentVisibility: ComputedRef<boolean>
    estimate: ComputedRef<FsusRenderPipelineEstimate>
    diagnostics: Ref<readonly FsusRenderPipelineDiagnosticEvent[]>
    hardwareAttrs: ComputedRef<Record<string, string>>
    hardwareProfile: ComputedRef<FsusRenderHardwareProfile>
    policy: ComputedRef<FsusResolvedRenderPipelineComponentPolicy | null>
    authority: FsusRenderPipelineAuthority
    adapterResourceProvider: FsusRenderPipelineAdapterResourceProvider
    inspectResources: () => FsusRenderPipelineRuntimeResourceInspection
    pause: () => FsusRenderPipelineRuntimeResourceInspection
    resume: () => FsusRenderPipelineRuntimeResourceInspection
    render: () => Promise<void>
    renderedStrategy: Ref<FsusRenderPipelineStrategy>
  }

export type FsusRenderPipelineAdapterInvocationResourceInspection = Readonly<{
  ownerKey: string
  scope: 'runtime-owned-adapter-invocations'
  pendingInvocations: number
  invocationIds: readonly symbol[]
  admission: 'active' | 'paused' | 'disposed'
  cancellationCapability: 'cooperative-abort-signal-only'
  internalCancellationCompletion: 'unsupported'
  settlement: 'original-prepare-finally'
  internalResources: 'unsupported'
}>

export type FsusRenderPipelineAdapterResourceProvider = Readonly<{
  ownerKey: string
  authority: FsusRenderPipelineAuthority
  inspectResources: () => FsusRenderPipelineAdapterInvocationResourceInspection
  // These are real runtime controls, not control over arbitrary adapter internals.
  pause: () => FsusRenderPipelineRuntimeResourceInspection
  resume: () => FsusRenderPipelineRuntimeResourceInspection
}>

export type FsusRenderPipelineRuntimeResourceInspection = {
  readonly ownerKey: string
  readonly paused: boolean
  readonly disposed: boolean
  readonly authorityFeed: ReturnType<
    ReturnType<typeof createRenderPipelineProducerAuthority>['inspect']
  >
  readonly rafHandles: number
  readonly idleHandles: number
  readonly timers: number
  readonly uncancellableCallbacks: number
  readonly retainedListeners: number
  readonly pendingRenders: number
  readonly pendingRenderAdmissions: number
  readonly pendingControlTransitions: number
  readonly pendingAdapterJobs: number
  readonly adapterResources: 'unknown'
  readonly adapterInvocationResources: FsusRenderPipelineAdapterInvocationResourceInspection
  readonly workerCallbackFailure: {
    readonly count: number
    readonly error: FsusErrorDetail
    readonly eventType: FsusWorkerExecutorEvent['type'] | 'unknown'
    readonly phase: 'adapter-event' | 'runtime-event' | 'error-notification'
    readonly workerId: number | null
  } | null
  readonly pendingWorkerCallbackFailureNotification: FsusRenderPipelineRuntimeResourceInspection['workerCallbackFailure']
  readonly workerResources: {
    readonly status: 'available' | 'not-created'
    readonly scopes: readonly {
      readonly inspection: Omit<FsusWorkerResourceInspection, 'pool' | 'shared'>
      readonly lastControl: {
        readonly operation: 'suspend' | 'cancel' | 'resume'
        readonly status: FsusWorkerTaskControlResult['status']
        readonly affectedTaskIds: readonly number[]
        readonly unavailableTaskIds: readonly number[]
      } | null
    }[]
    // Pool/shared fields are context only, never single-renderer usage.
    readonly pools: readonly {
      readonly mode: FsusRenderPipelineWorkerPoolMode
      readonly pool: FsusWorkerResourceInspection['pool']
      readonly shared: FsusWorkerResourceInspection['shared']
      readonly disposed: boolean
      readonly registry: FsusSharedWorkerRegistryInspection | null
    }[]
  }
  readonly retainedSharedOwners: number
  readonly hardware: ReturnType<
    ReturnType<typeof useFsusRenderPipelineHardwareProfile>['inspectResources']
  >
  readonly recoverable: false
}

const defaultRenderPipelineConfig: FsusResolvedRenderPipelineConfig = {
  adaptive: 'auto',
  mode: 'auto',
  worker: 'auto',
  thresholds: {
    htmlBytes: 128_000,
    estimatedNodes: 1_500,
    itemCount: 500,
  },
  budget: {
    dynamicFrameMs: true,
    frameMs: 7.5,
    overscanPx: 800,
    measureBatch: 32,
  },
  acceleration: {
    mode: 'auto',
    compositor: 'auto',
    contentVisibility: 'auto',
    layerBudget: 80,
  },
}

const cpuThreadedRenderPipelineDefaults: FsusResolvedRenderPipelineConfig = {
  ...defaultRenderPipelineConfig,
  thresholds: {
    htmlBytes: 64_000,
    estimatedNodes: 800,
    itemCount: 250,
  },
  budget: {
    dynamicFrameMs: true,
    frameMs: 7.5,
    overscanPx: 480,
    measureBatch: 16,
  },
}

const positive = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback

const normalizeHardwareMode = (
  mode: unknown,
): FsusRenderPipelineHardwareMode =>
  mode === 'gpu' || mode === 'cpu' ? mode : 'auto'

const normalizeCompositorMode = (
  mode: unknown,
): FsusRenderPipelineCompositorMode =>
  mode === 'enabled' || mode === 'disabled' ? mode : 'auto'

const normalizeAdaptiveMode = (
  mode: unknown,
): FsusRenderPipelineAdaptiveMode =>
  mode === 'enabled' || mode === 'disabled' ? mode : 'auto'

export const resolveFsusRenderPipelineConfig = (
  config?: FsusRenderPipelineConfig | null,
  hardwareProfile?: FsusRenderHardwareProfile,
): FsusResolvedRenderPipelineConfig => {
  const isCpuProfile =
    hardwareProfile === 'cpu-threaded' || config?.acceleration?.mode === 'cpu'
  const defaults = isCpuProfile
    ? cpuThreadedRenderPipelineDefaults
    : defaultRenderPipelineConfig

  return {
    adaptive: normalizeAdaptiveMode(config?.adaptive),
    mode:
      config?.mode === 'enabled' || config?.mode === 'disabled'
        ? config.mode
        : defaultRenderPipelineConfig.mode,
    worker:
      config?.worker === 'enabled' || config?.worker === 'disabled'
        ? config.worker
        : defaultRenderPipelineConfig.worker,
    thresholds: {
      htmlBytes: positive(
        config?.thresholds?.htmlBytes,
        defaults.thresholds.htmlBytes,
      ),
      estimatedNodes: positive(
        config?.thresholds?.estimatedNodes,
        defaults.thresholds.estimatedNodes,
      ),
      itemCount: positive(
        config?.thresholds?.itemCount,
        defaults.thresholds.itemCount,
      ),
    },
    budget: {
      dynamicFrameMs:
        config?.budget?.dynamicFrameMs ?? config?.budget?.frameMs === undefined,
      frameMs: positive(config?.budget?.frameMs, defaults.budget.frameMs),
      overscanPx: positive(
        config?.budget?.overscanPx,
        defaults.budget.overscanPx,
      ),
      measureBatch: Math.max(
        1,
        Math.floor(
          positive(config?.budget?.measureBatch, defaults.budget.measureBatch),
        ),
      ),
    },
    acceleration: {
      mode: normalizeHardwareMode(config?.acceleration?.mode),
      compositor: normalizeCompositorMode(config?.acceleration?.compositor),
      contentVisibility: normalizeCompositorMode(
        config?.acceleration?.contentVisibility,
      ),
      layerBudget: Math.max(
        1,
        Math.floor(
          positive(
            config?.acceleration?.layerBudget,
            defaultRenderPipelineConfig.acceleration.layerBudget,
          ),
        ),
      ),
    },
  }
}

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const roundBudgetNumber = (value: number) => Math.round(value * 100) / 100

const percentile = (sorted: readonly number[], ratio: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0

export const estimateFsusRenderRefreshProfile = (
  deltas: readonly number[],
): FsusRenderRefreshProfile => {
  const samples = deltas
    .filter((value) => Number.isFinite(value) && value >= 4 && value <= 40)
    .sort((left, right) => left - right)
  const trim = samples.length >= 10 ? Math.floor(samples.length * 0.1) : 0
  const trimmed = samples.slice(trim, samples.length - trim || undefined)
  const median = percentile(samples, 0.5) || 1000 / 60
  const mean = trimmed.length
    ? trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length
    : median
  const framePeriodMs = roundBudgetNumber((median + mean) / 2)
  const idealPeriod = 1000 / Math.max(1, Math.round(1000 / framePeriodMs))
  return {
    framePeriodMs,
    hz: Math.round(1000 / framePeriodMs),
    mainThreadBudgetMs: roundBudgetNumber(
      clampNumber(framePeriodMs * 0.45, 2, 7.5),
    ),
    rafDriftMs: roundBudgetNumber(
      samples.reduce((sum, value) => sum + Math.abs(value - idealPeriod), 0) /
        Math.max(1, samples.length),
    ),
    sampleCount: samples.length,
  }
}

export type FsusRenderPipelineAuthority = Readonly<{
  issueTicket: () => object | null
  isCurrent: (ticket: unknown) => boolean
  subscribe: (listener: () => void) => () => void
  getFailures: () => readonly unknown[]
}>

const authorityNativePromise = Promise
const authorityNativePromisePrototype = Promise.prototype
const authorityNativePromiseThen = Function.prototype.call.bind(
  Promise.prototype.then,
)
const authorityNativePromiseSpecies = Object.getOwnPropertyDescriptor(
  Promise,
  Symbol.species,
)

const createRenderPipelineProducerAuthority = (missingFeeds: string[] = []) => {
  let ticket: object | null = null
  let snapshots: Array<{
    current: (value: unknown) => boolean
    value: object
  }> = []
  let depth = 0
  let brokenFeed = false
  let closed = false
  let draining = false
  const archivedForeignFailures = new Set<unknown>()
  const feedFailures: unknown[] = []
  const asyncFeedObservers = new Set<{
    source: object
    listener: () => void
    subscriptionId: symbol
    state: 'pending' | 'unavailable'
    continuation: object | null
  }>()
  const observeAsyncFeed = (
    source: object,
    subscription: { id: symbol; listener: () => void },
  ) => {
    const record = {
      source,
      listener: subscription.listener,
      subscriptionId: subscription.id,
      state: 'pending' as 'pending' | 'unavailable',
      continuation: null as object | null,
    }
    asyncFeedObservers.add(record)
    try {
      const prototype = Object.getPrototypeOf(source)
      const ownConstructor = Object.getOwnPropertyDescriptor(
        source,
        'constructor',
      )
      const prototypeConstructor = Object.getOwnPropertyDescriptor(
        authorityNativePromisePrototype,
        'constructor',
      )
      const species = Object.getOwnPropertyDescriptor(
        authorityNativePromise,
        Symbol.species,
      )
      // Prototype/constructor are eligibility checks, not Promise brand proof.
      // The original intrinsic validates the brand without consulting .then.
      // Accept only the captured native species; callbacks touch private data only,
      // so the actual native continuation fulfills rather than rejecting unhandled.
      if (
        prototype !== authorityNativePromisePrototype ||
        (ownConstructor &&
          (!('value' in ownConstructor) ||
            ownConstructor.value !== authorityNativePromise)) ||
        !prototypeConstructor ||
        !('value' in prototypeConstructor) ||
        prototypeConstructor.value !== authorityNativePromise ||
        !authorityNativePromiseSpecies?.get ||
        !species ||
        species.get !== authorityNativePromiseSpecies.get ||
        species.set !== undefined ||
        'value' in species
      ) {
        record.state = 'unavailable'
        return
      }
      record.continuation = authorityNativePromiseThen(
        source,
        () => {
          asyncFeedObservers.delete(record)
        },
        (cause: unknown) => {
          // Feed already permanently broken/quarantined. No external callback or
          // unverified await/then is invoked from either intrinsic reaction.
          feedFailures.push(
            Object.freeze({
              cause,
              listener: record.listener,
              subscriptionId: record.subscriptionId,
              phase: 'async-feed-rejection',
            }),
          )
          asyncFeedObservers.delete(record)
        },
      )
    } catch (cause) {
      record.state = 'unavailable'
      feedFailures.push(
        Object.freeze({
          cause,
          listener: record.listener,
          subscriptionId: record.subscriptionId,
          phase: 'async-feed-observation',
        }),
      )
    }
  }
  const missing = new Set(missingFeeds)
  const listeners = new Set<{
    id: symbol
    listener: () => void
    quarantined: boolean
  }>()
  const dependencies = new Map<
    object,
    {
      issue: () => object | null
      current: (value: unknown) => boolean
      unsubscribe: (() => void) | null
      registering: boolean
      getFailures?: () => readonly unknown[]
      id: symbol
      source: object
      canRelease: () => boolean
      unsubscribed: boolean
      releaseRequested: boolean
    }
  >()
  const retiringDependencies = new Set<
    ReturnType<typeof dependencies.get> & {}
  >()
  const notifyListeners = () => {
    for (const subscription of [...listeners]) {
      if (!listeners.has(subscription) || subscription.quarantined) continue
      try {
        const result: unknown = subscription.listener()
        if (
          result !== null &&
          (typeof result === 'object' || typeof result === 'function')
        ) {
          brokenFeed = true
          subscription.quarantined = true
          feedFailures.push({
            cause: new TypeError(
              'fsus_pipeline_authority_feed_return_unavailable',
            ),
            message: 'fsus_pipeline_authority_feed_return_unavailable',
            listener: subscription.listener,
            subscriptionId: subscription.id,
          })
          observeAsyncFeed(result, subscription)
        }
      } catch (cause) {
        brokenFeed = true
        feedFailures.push(
          Object.freeze({
            cause,
            listener: subscription.listener,
            subscriptionId: subscription.id,
          }),
        )
      }
    }
  }
  const change = <T>(action: () => T, enter?: () => void): T => {
    depth += 1
    ticket = null
    snapshots = []
    const finish = () => {
      // Closed producers report actual post-action progress before leaving their
      // revoked interval, so parents can release only now-settled dependencies.
      if (closed && depth === 1) notifyListeners()
      depth -= 1
      if (
        depth === 0 &&
        !draining &&
        (closed ||
          retiringDependencies.size > 0 ||
          [...dependencies.values()].some((entry) => entry.releaseRequested))
      )
        drainClosedDependencies()
    }
    try {
      enter?.()
      if (depth === 1) notifyListeners()
      const result = action()
      // Keep async producer continuations inside the same revoked interval.
      if (result instanceof Promise) return result.finally(finish) as T
      finish()
      return result
    } catch (cause) {
      finish()
      throw cause
    }
  }
  const boundary =
    <TArgs extends unknown[], TResult>(action: (...args: TArgs) => TResult) =>
    (...args: TArgs): TResult =>
      change(() => action(...args))
  const getFailures = () =>
    change(() => {
      const foreign: unknown[] = []
      for (const dependency of [
        ...dependencies.values(),
        ...retiringDependencies,
      ]) {
        if (!dependency.getFailures) continue
        try {
          foreign.push(...dependency.getFailures())
        } catch (cause) {
          brokenFeed = true
          feedFailures.push(
            Object.freeze({ cause, dependencyId: dependency.id }),
          )
        }
      }
      return Object.freeze([
        ...feedFailures,
        ...archivedForeignFailures,
        ...foreign,
      ])
    })
  const authority: FsusRenderPipelineAuthority = Object.freeze({
    getFailures,
    issueTicket: () => {
      if (closed || depth > 0 || brokenFeed || missing.size > 0) return null
      if (ticket) {
        if (snapshots.every((entry) => entry.current(entry.value)))
          return ticket
        ticket = null
      }
      const next: typeof snapshots = []
      for (const dependency of dependencies.values()) {
        if (dependency.registering || !dependency.unsubscribe) return null
        const value = dependency.issue()
        if (!value) return null
        next.push({ current: dependency.current, value })
      }
      snapshots = next
      ticket = {}
      return ticket
    },
    // Only private identity and captured pure dependency checks; no census reads.
    isCurrent: (value) => {
      if (
        closed ||
        depth > 0 ||
        brokenFeed ||
        missing.size > 0 ||
        !ticket ||
        value !== ticket
      )
        return false
      try {
        return snapshots.every((entry) => entry.current(entry.value))
      } catch {
        return false
      }
    },
    subscribe: (listener) =>
      change(() => {
        if (closed) throw new Error('fsus_pipeline_authority_closed')
        if (typeof listener !== 'function')
          throw new TypeError('fsus_pipeline_authority_listener_invalid')
        const subscription = {
          id: Symbol('fsus-pipeline-authority-subscription'),
          listener,
          quarantined: false,
        }
        listeners.add(subscription)
        return boundary(() => {
          listeners.delete(subscription)
        })
      }),
  })
  const retainDependency = (
    source: unknown,
    missingName: string,
    canRelease: () => boolean = () => true,
    onRevoked?: () => void,
  ) =>
    change(() => {
      if (closed) throw new Error('fsus_pipeline_authority_closed')
      if (source === authority) return
      if (!source || typeof source !== 'object') {
        missing.add(missingName)
        return
      }
      const existing = dependencies.get(source)
      if (existing) {
        existing.releaseRequested = false
        return
      }
      const candidate = source as Partial<FsusRenderPipelineAuthority>
      const issue = candidate.issueTicket,
        current = candidate.isCurrent,
        subscribe = candidate.subscribe,
        readFailures = candidate.getFailures
      if (
        typeof issue !== 'function' ||
        typeof current !== 'function' ||
        typeof subscribe !== 'function'
      ) {
        missing.add(missingName)
        return
      }
      const dependency = {
        issue,
        current,
        unsubscribe: null as (() => void) | null,
        registering: true,
        getFailures:
          typeof readFailures === 'function' ? readFailures : undefined,
        id: Symbol('fsus-pipeline-authority-dependency'),
        source,
        canRelease,
        unsubscribed: false,
        releaseRequested: false,
      }
      // Publish the actual in-progress registration before foreign subscribe.
      dependencies.set(source, dependency)
      try {
        const unsubscribe = subscribe(() => change(() => onRevoked?.()))
        if (typeof unsubscribe !== 'function') {
          missing.add(missingName)
          brokenFeed = true
          return
        }
        dependency.unsubscribe = unsubscribe
        if (typeof readFailures !== 'function')
          missing.add(`${missingName}:failure-feed`)
      } catch (cause) {
        missing.add(missingName)
        brokenFeed = true
        feedFailures.push(
          Object.freeze({
            cause,
            source: missingName,
            dependencyId: dependency.id,
          }),
        )
      } finally {
        dependency.registering = false
      }
    })
  const releaseRecord = (
    dependency: ReturnType<typeof dependencies.get> & {},
  ) => {
    try {
      if (
        dependency.registering ||
        !dependency.unsubscribe ||
        !dependency.canRelease()
      )
        return false
      // Detach before foreign code; a reentrant binding gets an independent record.
      if (dependencies.get(dependency.source) === dependency)
        dependencies.delete(dependency.source)
      retiringDependencies.add(dependency)
      if (dependency.getFailures)
        for (const failure of dependency.getFailures())
          archivedForeignFailures.add(failure)
      if (!dependency.unsubscribed) {
        dependency.unsubscribe()
        dependency.unsubscribed = true
      }
      if (dependency.getFailures)
        for (const failure of dependency.getFailures())
          archivedForeignFailures.add(failure)
      retiringDependencies.delete(dependency)
      return true
    } catch (cause) {
      brokenFeed = true
      feedFailures.push(
        Object.freeze({
          cause,
          dependencyId: dependency.id,
          phase: 'dependency-release',
        }),
      )
      // Actual retained record is kept for another explicit/progress drain.
      return false
    }
  }
  const releaseDependency = (source: object) =>
    change(() => {
      const records = [...retiringDependencies].filter(
        (entry) => entry.source === source,
      )
      const current = dependencies.get(source)
      if (current) {
        current.releaseRequested = true
        records.push(current)
      }
      for (const record of records) releaseRecord(record)
    })
  const drainClosedDependencies = () => {
    draining = true
    try {
      change(() => {
        for (const dependency of [
          ...retiringDependencies,
          ...dependencies.values(),
        ]) {
          if (
            closed ||
            dependency.releaseRequested ||
            retiringDependencies.has(dependency)
          )
            releaseRecord(dependency)
        }
      })
    } finally {
      draining = false
    }
  }
  const close = () =>
    change(() => {
      closed = true
    })
  const recordFailure = (cause: unknown, phase: string, resource: unknown) =>
    change(() => {
      brokenFeed = true
      feedFailures.push(Object.freeze({ cause, phase, resource }))
    })
  return {
    authority,
    recordFailure,
    boundary,
    change,
    retainDependency,
    releaseDependency,
    close,
    // Rejected/in-flight releases remain counted; terminal closure never mints.
    inspect: () =>
      Object.freeze({
        activeChangesAtRead: depth,
        subscriptions: listeners.size,
        quarantinedSubscriptions: [...listeners].filter(
          (entry) => entry.quarantined,
        ).length,
        retainedDependencyRecords:
          dependencies.size + retiringDependencies.size,
        retainedOwnedSubscriptionHandles: [
          ...dependencies.values(),
          ...retiringDependencies,
        ].filter((entry) => entry.unsubscribe !== null && !entry.unsubscribed)
          .length,
        pendingSubscriptionRegistrations: [
          ...dependencies.values(),
          ...retiringDependencies,
        ].filter((entry) => entry.registering || entry.unsubscribe === null)
          .length,
        dependencyReleaseObligations: Object.freeze(
          [...dependencies.values(), ...retiringDependencies]
            .filter(
              (entry) =>
                closed ||
                entry.releaseRequested ||
                retiringDependencies.has(entry),
            )
            .map((entry) =>
              Object.freeze({
                dependencyId: entry.id,
                source: entry.source,
                unsubscribe: entry.unsubscribe,
                unsubscribed: entry.unsubscribed,
                registering: entry.registering,
                releaseRequested: entry.releaseRequested,
              }),
            ),
        ),
        retiringDependencyRecords: retiringDependencies.size,
        closed,
        pendingAsyncFeedObservers: [...asyncFeedObservers].filter(
          (record) => record.state === 'pending',
        ).length,
        unavailableAsyncFeedObservations: Object.freeze(
          [...asyncFeedObservers].filter(
            (record) => record.state === 'unavailable',
          ),
        ),
        foreignSubscriptionActivity: 'unknown' as const,
        feedFailures: getFailures(),
        missingFeeds: Object.freeze([...missing]),
        brokenFeed,
        completeCustody: false as const,
      }),
  }
}

// Bind only the original selected Ref registered by the controlled config producer.
// A computed projection, arbitrary Ref/props or plain object has no inherited feed.
const retainRenderPipelineConfigAuthority = (
  producerAuthority: ReturnType<typeof createRenderPipelineProducerAuthority>,
  config: unknown,
) =>
  producerAuthority.change(() => {
    producerAuthority.retainDependency(
      isRef(config) ? getGlobalConfigFeed(config) : undefined,
      'controlled-global-config-authority',
    )
  })

const renderPipelineModuleAuthority = createRenderPipelineProducerAuthority()

const attemptRenderPipelineCleanup = (
  producerAuthority: ReturnType<typeof createRenderPipelineProducerAuthority>,
  actions: Array<{ resource: unknown; action: () => void }>,
) => {
  let failed = false
  let firstCause: unknown
  for (const { resource, action } of actions) {
    try {
      action()
    } catch (cause) {
      producerAuthority.recordFailure(cause, 'resource-cleanup', resource)
      if (!failed) firstCause = cause
      failed = true
    }
  }
  if (failed) throw firstCause
}

// Own only callbacks requested here. Opaque platform work remains unknown.
const createRenderPipelineCallbackResources = (
  producerAuthority: ReturnType<typeof createRenderPipelineProducerAuthority>,
) => {
  type Entry = {
    kind: 'raf' | 'idle' | 'timeout'
    cancelled: boolean
    cancel: (() => void) | null
    allocation: 'pending' | 'registered' | 'unavailable'
    cancelRequest?: () => void
  }
  const entries = new Set<Entry>()
  const schedule = (
    kind: Entry['kind'],
    request: (run: () => void) => (() => void) | null,
    run: () => void,
  ) => {
    const entry: Entry = {
      kind,
      cancelled: false,
      cancel: null,
      allocation: 'pending',
    }
    entries.add(entry)
    try {
      entry.cancel = request(
        producerAuthority.boundary(() => {
          entries.delete(entry)
          if (!entry.cancelled) run()
        }),
      )
      entry.allocation = 'registered'
    } catch (error) {
      // A throwing allocator does not prove that no callback was registered.
      entry.allocation = 'unavailable'
      producerAuthority.recordFailure(error, 'callback-allocation', entry)
      throw error
    }
    const cancelRequest = producerAuthority.boundary(() => {
      if (!entries.has(entry)) return
      entry.cancelled = true
      if (entry.cancel) {
        try {
          entry.cancel()
          entries.delete(entry)
        } catch (cause) {
          producerAuthority.recordFailure(cause, 'callback-cancel', entry)
          throw cause
        }
      }
    })
    entry.cancelRequest = cancelRequest
    return cancelRequest
  }
  const frame = (run: () => void) => {
    const cancel =
      typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null
    return schedule(
      'raf',
      (callback) => {
        const handle = requestAnimationFrame(callback)
        return cancel ? () => cancel(handle) : null
      },
      run,
    )
  }
  const idle = (run: () => void) => {
    const cancel =
      typeof cancelIdleCallback === 'function' ? cancelIdleCallback : null
    return schedule(
      'idle',
      (callback) => {
        const handle = requestIdleCallback(callback, { timeout: 50 })
        return cancel ? () => cancel(handle) : null
      },
      run,
    )
  }
  const timeout = (run: () => void) =>
    schedule(
      'timeout',
      (callback) => {
        const handle = setTimeout(callback, 0)
        return producerAuthority.boundary(() => clearTimeout(handle))
      },
      run,
    )
  const cancelAll = (isCurrent: () => boolean = () => true) => {
    const actions = [...entries].map((entry) => ({
      resource: entry,
      action: () => {
        if (!isCurrent() || !entries.has(entry)) return
        entry.cancelled = true
        if (entry.cancel) {
          entry.cancel()
          entries.delete(entry)
        }
      },
    }))
    attemptRenderPipelineCleanup(producerAuthority, actions)
  }
  const inspect = () =>
    Object.freeze({
      rafHandles: [...entries].filter(
        (entry) => entry.kind === 'raf' && entry.allocation === 'registered',
      ).length,
      idleHandles: [...entries].filter(
        (entry) => entry.kind === 'idle' && entry.allocation === 'registered',
      ).length,
      timers: [...entries].filter(
        (entry) =>
          entry.kind === 'timeout' && entry.allocation === 'registered',
      ).length,
      callbackRegistrationObligations: Object.freeze(
        [...entries]
          .filter((entry) => entry.allocation !== 'registered')
          .map((entry) =>
            Object.freeze({
              kind: entry.kind,
              allocation: entry.allocation,
              cancelled: entry.cancelled,
            }),
          ),
      ),
      uncancellableCallbacks: [...entries].filter(
        (entry) => entry.allocation === 'registered' && !entry.cancel,
      ).length,
    })
  return {
    cancelAll: producerAuthority.boundary(cancelAll),
    isPending: (cancel: () => void) =>
      [...entries].some((entry) => entry.cancelRequest === cancel),
    isCancelled: (cancel: () => void) =>
      [...entries].some(
        (entry) => entry.cancelRequest === cancel && entry.cancelled,
      ),
    frame: producerAuthority.boundary(frame),
    idle: producerAuthority.boundary(idle),
    inspect: producerAuthority.boundary(inspect),
    timeout: producerAuthority.boundary(timeout),
  }
}

export const createFsusRafRefreshSampler = ({
  onSample,
  requestFrame = (callback: FrameRequestCallback) =>
    requestAnimationFrame(callback),
  cancelFrame = typeof cancelAnimationFrame === 'function'
    ? cancelAnimationFrame
    : undefined,
  sampleSize = 24,
}: {
  onSample: (profile: FsusRenderRefreshProfile) => void
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (handle: number) => void
  sampleSize?: number
}) => {
  const producerAuthority = createRenderPipelineProducerAuthority()

  const deltas: number[] = []
  let previous: number | null = null
  let handle: number | null = null
  let stopped = false
  const sample = producerAuthority.boundary((timestamp: number) => {
    handle = null
    if (stopped) {
      producerAuthority.close()
      return
    }
    if (previous !== null) deltas.push(timestamp - previous)
    previous = timestamp
    if (deltas.length >= Math.max(4, sampleSize)) {
      stopped = true
      try {
        onSample(estimateFsusRenderRefreshProfile(deltas))
      } catch (cause) {
        producerAuthority.recordFailure(cause, 'sampler-publication', onSample)
        throw cause
      } finally {
        producerAuthority.close()
      }
      return
    }
    handle = requestFrame(sample)
  })
  producerAuthority.change(() => {
    handle = requestFrame(sample)
  })
  const stop = producerAuthority.boundary(() => {
    stopped = true
    if (handle !== null && cancelFrame) {
      try {
        cancelFrame(handle)
        handle = null
      } catch (cause) {
        producerAuthority.recordFailure(cause, 'sampler-cancel', handle)
        throw cause
      }
    }
    if (handle === null) producerAuthority.close()
  })
  return Object.assign(stop, {
    authority: producerAuthority.authority,
    inspectResources: producerAuthority.boundary(() =>
      Object.freeze({
        rafHandles: handle === null ? 0 : 1,
        uncancellableCallbacks: handle !== null && !cancelFrame ? 1 : 0,
        stopped,
      }),
    ),
  })
}

export const createFsusRenderStageHistory =
  renderPipelineModuleAuthority.boundary(
    (limit: number = 32, alpha: number = 0.25) => {
      const samples = new Map<FsusRenderPipelineStage, number[]>()
      const ewma = new Map<FsusRenderPipelineStage, number>()
      const record = (stage: FsusRenderPipelineStage, durationMs: number) => {
        if (!Number.isFinite(durationMs) || durationMs < 0) return
        const values = samples.get(stage) ?? []
        values.push(durationMs)
        if (values.length > limit) values.shift()
        samples.set(stage, values)
        ewma.set(
          stage,
          ewma.has(stage)
            ? ewma.get(stage)! * (1 - alpha) + durationMs * alpha
            : durationMs,
        )
      }
      const snapshot = (
        stage: FsusRenderPipelineStage,
      ): FsusRenderStageStats => {
        const values = [...(samples.get(stage) ?? [])].sort((a, b) => a - b)
        return {
          ewmaMs: roundBudgetNumber(ewma.get(stage) ?? 0),
          p50Ms: roundBudgetNumber(percentile(values, 0.5)),
          p95Ms: roundBudgetNumber(percentile(values, 0.95)),
          sampleCount: values.length,
        }
      }
      return {
        record: renderPipelineModuleAuthority.boundary(record),
        snapshot: renderPipelineModuleAuthority.boundary(snapshot),
      }
    },
  )

export const resolveFsusAdaptiveRenderPipelineConfig = (
  config: FsusResolvedRenderPipelineConfig,
  hardwareProfile: FsusRenderHardwareProfile,
  signals: FsusRenderPipelineAdaptiveSignals = {},
): FsusResolvedRenderPipelineConfig => {
  if (config.adaptive === 'disabled') return config

  const hasRuntimeSignals =
    signals.queueDepth !== undefined ||
    signals.rafDriftMs !== undefined ||
    signals.renderDurationMs !== undefined ||
    signals.stages !== undefined
  if (!hasRuntimeSignals) return config

  const frameMs = Math.max(1, config.budget.frameMs)
  const renderDurationMs = Math.max(
    signals.renderDurationMs ?? 0,
    signals.stages?.prepare?.p95Ms ?? 0,
    signals.stages?.['vue-commit']?.p95Ms ?? 0,
    signals.stages?.['style-layout']?.p95Ms ?? 0,
  )
  const rafDriftMs = signals.rafDriftMs ?? 0
  const queueDepth = signals.queueDepth ?? 0
  let factor = hardwareProfile === 'cpu-threaded' ? 0.75 : 1

  if (
    queueDepth > 2 ||
    renderDurationMs > frameMs * 4 ||
    rafDriftMs > frameMs * 2
  ) {
    factor *= 0.75
  } else if (renderDurationMs > frameMs * 2 || rafDriftMs > frameMs) {
    factor *= 0.875
  } else if (
    config.adaptive === 'enabled' ||
    (hardwareProfile === 'gpu-compositor' &&
      queueDepth === 0 &&
      renderDurationMs > 0 &&
      renderDurationMs < frameMs * 0.75 &&
      rafDriftMs < frameMs * 0.5)
  ) {
    factor *= 1.1
  }

  const clamped = clampNumber(factor, 0.5, 1.5)

  return {
    ...config,
    budget: {
      dynamicFrameMs: config.budget.dynamicFrameMs,
      frameMs: Math.max(1, roundBudgetNumber(config.budget.frameMs * clamped)),
      measureBatch: Math.max(
        1,
        Math.floor(config.budget.measureBatch * clamped),
      ),
      overscanPx: Math.max(1, Math.floor(config.budget.overscanPx * clamped)),
    },
    acceleration: {
      ...config.acceleration,
      layerBudget: Math.max(
        1,
        Math.floor(config.acceleration.layerBudget * clamped),
      ),
    },
  }
}

const DEFAULT_DIAGNOSTICS_BUFFER_LIMIT = 128
const diagnosticSinks = new Set<FsusRenderPipelineDiagnosticSink>()

const readRenderPipelineNow = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

export const createFsusRenderPipelineDiagnosticsBuffer = (
  limit = DEFAULT_DIAGNOSTICS_BUFFER_LIMIT,
): FsusRenderPipelineDiagnosticsBuffer => {
  const events: FsusRenderPipelineDiagnosticEvent[] = []
  const normalizedLimit = Math.max(
    1,
    Math.floor(
      typeof limit === 'number' && Number.isFinite(limit)
        ? limit
        : DEFAULT_DIAGNOSTICS_BUFFER_LIMIT,
    ),
  )

  return {
    clear: () => {
      events.length = 0
    },
    push: (event) => {
      events.push(event)
      if (events.length > normalizedLimit) {
        events.splice(0, events.length - normalizedLimit)
      }
    },
    snapshot: () => events.slice(),
  }
}

const renderPipelineDiagnosticsBuffer =
  createFsusRenderPipelineDiagnosticsBuffer()

const emitFsusRenderPipelineDiagnostic = renderPipelineModuleAuthority.boundary(
  (
    event: FsusRenderPipelineDiagnosticEvent,
    isCurrent: () => boolean = () => true,
  ) => {
    const normalized = {
      timestamp: readRenderPipelineNow(),
      ...event,
    }
    renderPipelineDiagnosticsBuffer.push(normalized)
    for (const sink of Array.from(diagnosticSinks)) {
      if (!isCurrent()) break
      sink(normalized)
    }
  },
)

export const registerFsusRenderPipelineDiagnosticSink =
  renderPipelineModuleAuthority.boundary(
    (sink: FsusRenderPipelineDiagnosticSink) => {
      diagnosticSinks.add(sink)
      return renderPipelineModuleAuthority.boundary(() => {
        diagnosticSinks.delete(sink)
      })
    },
  )

export const getFsusRenderPipelineDiagnosticsSnapshot =
  renderPipelineModuleAuthority.boundary(() =>
    renderPipelineDiagnosticsBuffer.snapshot(),
  )

export const clearFsusRenderPipelineDiagnostics =
  renderPipelineModuleAuthority.boundary(() => {
    renderPipelineDiagnosticsBuffer.clear()
    diagnosticSinks.clear()
  })

export const shouldUseFsusRenderPipeline = (
  estimate: FsusRenderEstimate,
  config: FsusResolvedRenderPipelineConfig,
) => {
  if (config.mode === 'disabled') return false
  if (config.mode === 'enabled') return true

  return (
    (estimate.htmlBytes ?? 0) >= config.thresholds.htmlBytes ||
    (estimate.nodes ?? 0) >= config.thresholds.estimatedNodes ||
    (estimate.items ?? 0) >= config.thresholds.itemCount
  )
}

const canCreateWorker = () =>
  typeof Worker !== 'undefined' && typeof URL !== 'undefined'

const supportsCssProperty = (property: string, value: string) =>
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports(property, value)

const supportsCompositorTransforms = () =>
  typeof CSS === 'undefined'
    ? true
    : supportsCssProperty('transform', 'translate3d(0, 0, 0)')

const supportsContentVisibility = () =>
  supportsCssProperty('content-visibility', 'auto')

const isReducedMotionPreferred = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let renderPipelineLowPower = false
let calibratedMainOpsPerMs: number | null = null

export const calibrateFsusMainThreadThroughput =
  renderPipelineModuleAuthority.boundary(() => {
    if (calibratedMainOpsPerMs !== null) return calibratedMainOpsPerMs
    const operations = 50_000
    const startedAt = readRenderPipelineNow()
    let checksum = 0
    for (let index = 0; index < operations; index++) {
      checksum = (checksum * 33 + index) >>> 0
    }
    const elapsedMs = Math.max(0.1, readRenderPipelineNow() - startedAt)
    calibratedMainOpsPerMs = Math.round(
      (operations + (checksum & 1)) / elapsedMs,
    )
    return calibratedMainOpsPerMs
  })

const resolveAutoHardwareProfile = (): FsusRenderHardwareProfile => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 'cpu-threaded'
  }

  if (!supportsCompositorTransforms()) {
    return 'cpu-threaded'
  }

  const concurrency =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0
  if (concurrency > 0 && concurrency <= 2) {
    return 'cpu-threaded'
  }

  return 'gpu-compositor'
}

export const resolveFsusRenderCapabilityProfile = (
  refreshProfile: FsusRenderRefreshProfile = estimateFsusRenderRefreshProfile(
    Array.from({ length: 12 }, () => 1000 / 60),
  ),
  overrides: { lowPower?: boolean; mainOpsPerMs?: number } = {},
): FsusRenderCapabilityProfile => {
  const concurrency =
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 0 : 0
  const memory =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      : undefined
  const mainOpsPerMs =
    overrides.mainOpsPerMs ?? calibrateFsusMainThreadThroughput()
  const computeProfile: FsusRenderComputeProfile =
    mainOpsPerMs < 25_000 ? 'low' : mainOpsPerMs >= 100_000 ? 'high' : 'normal'
  const memoryProfile: FsusRenderMemoryProfile =
    memory !== undefined && memory <= 2
      ? 'low'
      : memory !== undefined && memory >= 8
        ? 'high'
        : 'normal'
  const visibility =
    typeof document !== 'undefined' && document.visibilityState === 'hidden'
      ? 'hidden'
      : 'visible'
  const motionMode: FsusRenderMotionMode = isReducedMotionPreferred()
    ? 'reduced'
    : 'enabled'
  const compositorCapability = supportsCompositorTransforms()
  const contentVisibilityCapability = supportsContentVisibility()
  return {
    compositorCapability,
    computeCalibration: {
      mainOpsPerMs,
      workerConcurrency: Math.max(
        1,
        Math.min(4, Math.floor(concurrency / 2) || 1),
      ),
    },
    computeProfile,
    contentVisibilityCapability,
    lowPower: overrides.lowPower ?? renderPipelineLowPower,
    memoryProfile,
    motionMode,
    refreshProfile,
    version: [
      computeProfile,
      memoryProfile,
      compositorCapability ? 'compositor' : 'no-compositor',
      contentVisibilityCapability ? 'cv' : 'no-cv',
      refreshProfile.hz,
      visibility,
      (overrides.lowPower ?? renderPipelineLowPower) ? 'low-power' : 'power-ok',
    ].join(':'),
    visibility,
  }
}

export const resolveFsusRenderPipelineHardwareProfile = (
  config?: FsusRenderPipelineConfig | FsusResolvedRenderPipelineConfig | null,
): FsusRenderHardwareProfile => {
  const mode = normalizeHardwareMode(config?.acceleration?.mode)
  if (mode === 'gpu') return 'gpu-compositor'
  if (mode === 'cpu') return 'cpu-threaded'
  return resolveAutoHardwareProfile()
}

export const resolveFsusRenderPipelineCompositorEnabled = (
  config: FsusResolvedRenderPipelineConfig,
  _hardwareProfile: FsusRenderHardwareProfile,
) => {
  const mode = config.acceleration.compositor
  if (mode === 'enabled') return true
  if (mode === 'disabled') return false
  if (config.acceleration.mode === 'cpu') return false
  return supportsCompositorTransforms()
}

export const resolveFsusRenderPipelineContentVisibilityEnabled = (
  config: FsusResolvedRenderPipelineConfig,
  _hardwareProfile: FsusRenderHardwareProfile,
) => {
  const mode = config.acceleration.contentVisibility
  if (mode === 'enabled') return supportsContentVisibility()
  if (mode === 'disabled') return false
  return supportsContentVisibility()
}

export const resolveFsusRenderPipelineHardwareAttrs = ({
  compositor,
  contentVisibility,
  layerBudget,
  hardwareProfile,
}: {
  compositor: boolean
  contentVisibility: boolean
  layerBudget?: number
  hardwareProfile: FsusRenderHardwareProfile
}) => ({
  'data-fsus-compositor': compositor ? 'enabled' : 'disabled',
  'data-fsus-content-visibility': contentVisibility ? 'enabled' : 'disabled',
  'data-fsus-render-layer-budget': String(
    Math.max(1, Math.floor(positive(layerBudget, 1))),
  ),
  'data-fsus-render-hardware': hardwareProfile,
})

export const resolveFsusRenderPipelineUnitAttrs = ({
  baseAttrs,
  disableContentVisibilityOnOverflow = false,
  layerBudget,
  renderedCount,
  unitIndex,
}: FsusRenderPipelineUnitAttrsOptions): FsusRenderPipelineDomAttrs => {
  const attrs: FsusRenderPipelineDomAttrs = { ...(baseAttrs ?? {}) }
  const attrBudget = Number(attrs['data-fsus-render-layer-budget'])
  const normalizedLayerBudget = Math.max(
    1,
    Math.floor(
      positive(layerBudget, Number.isFinite(attrBudget) ? attrBudget : 1),
    ),
  )
  const overRenderedBudget =
    typeof renderedCount === 'number' &&
    Number.isFinite(renderedCount) &&
    renderedCount > normalizedLayerBudget
  const overUnitBudget =
    typeof unitIndex === 'number' &&
    Number.isFinite(unitIndex) &&
    unitIndex >= normalizedLayerBudget

  attrs['data-fsus-render-layer-budget'] = String(normalizedLayerBudget)

  if (overRenderedBudget || overUnitBudget) {
    attrs['data-fsus-compositor'] = 'disabled'
    if (disableContentVisibilityOnOverflow || overRenderedBudget) {
      attrs['data-fsus-content-visibility'] = 'disabled'
    }
  }

  return attrs
}

export const useFsusRenderPipelineHardwareProfile = (
  config?: MaybeRef<FsusRenderPipelineConfig | null | undefined>,
) => {
  const producerAuthority = createRenderPipelineProducerAuthority()
  producerAuthority.retainDependency(
    renderPipelineModuleAuthority.authority,
    'module-hardware-authority',
  )
  retainRenderPipelineConfigAuthority(producerAuthority, config)

  const refreshProfile = shallowRef(estimateFsusRenderRefreshProfile([]))
  const visibilityVersion = ref(0)
  const lowPower = ref(renderPipelineLowPower)
  let mounted = false
  let paused = false
  let disposed = false
  let generation = 0
  type VisibilityBinding = {
    target: Document
    listener: () => void
    registering: boolean
    releasing: boolean
    installed: boolean
    retired: boolean
  }
  let visibilityBinding: VisibilityBinding | null = null
  const visibilityBindings = new Set<VisibilityBinding>()
  const releaseVisibilityBinding = (binding: VisibilityBinding) => {
    binding.retired = true
    if (binding.registering || binding.releasing) return
    binding.releasing = true
    try {
      binding.target.removeEventListener('visibilitychange', binding.listener)
      visibilityBindings.delete(binding)
      if (visibilityBinding === binding) visibilityBinding = null
    } finally {
      binding.releasing = false
    }
  }
  const batteryJobs = new Set<symbol>()
  const samplers = new Set<ReturnType<typeof createFsusRafRefreshSampler>>()
  const stopSamplers = () => {
    attemptRenderPipelineCleanup(
      producerAuthority,
      [...samplers].map((stop) => ({
        resource: stop,
        action: () => {
          stop()
          if (stop.inspectResources().rafHandles === 0) {
            samplers.delete(stop)
            producerAuthority.releaseDependency(stop.authority)
          }
        },
      })),
    )
  }
  const startSampler = () => {
    stopSamplers()
    if (
      !mounted ||
      paused ||
      disposed ||
      typeof requestAnimationFrame !== 'function'
    )
      return
    const sampleGeneration = generation
    const stop = createFsusRafRefreshSampler({
      onSample: producerAuthority.boundary((sample) => {
        if (!paused && !disposed && sampleGeneration === generation) {
          refreshProfile.value = sample
        }
      }),
    })
    producerAuthority.retainDependency(
      stop.authority,
      'sampler-authority',
      () => stop.inspectResources().rafHandles === 0,
    )
    samplers.add(stop)
    // Keep the real binding until its actual RAF settles; natural completion
    // then drains it through the existing source progress notification.
    producerAuthority.releaseDependency(stop.authority)
  }
  const onVisibilityChange = producerAuthority.boundary(() => {
    if (paused || disposed) return
    const visibilityGeneration = generation
    visibilityVersion.value += 1
    if (visibilityGeneration === generation) startSampler()
  })
  const connect = () => {
    if (!mounted || paused || disposed) return
    const connectGeneration = generation
    startSampler()
    if (paused || disposed || connectGeneration !== generation) return
    if (
      (!visibilityBinding || visibilityBinding.retired) &&
      typeof document !== 'undefined'
    ) {
      const binding: VisibilityBinding = {
        target: document,
        registering: true,
        releasing: false,
        installed: false,
        retired: false,
        listener: producerAuthority.boundary(() => {
          if (
            !binding.retired &&
            binding === visibilityBinding &&
            connectGeneration === generation
          )
            onVisibilityChange()
        }),
      }
      visibilityBinding = binding
      visibilityBindings.add(binding)
      let failed = false
      let firstCause: unknown
      try {
        const add = binding.target.addEventListener
        if (
          !paused &&
          !disposed &&
          connectGeneration === generation &&
          !binding.retired &&
          visibilityBinding === binding
        ) {
          add.call(binding.target, 'visibilitychange', binding.listener)
          binding.installed = true
        } else binding.retired = true
      } catch (cause) {
        producerAuthority.recordFailure(
          cause,
          'visibility-registration',
          binding.target,
        )
        failed = true
        firstCause = cause
        binding.retired = true
      } finally {
        binding.registering = false
      }
      if (
        binding.retired ||
        paused ||
        disposed ||
        connectGeneration !== generation ||
        visibilityBinding !== binding
      ) {
        try {
          releaseVisibilityBinding(binding)
        } catch (cause) {
          producerAuthority.recordFailure(
            cause,
            'visibility-late-release',
            binding.target,
          )
          if (!failed) firstCause = cause
          failed = true
        }
      }
      if (failed) throw firstCause
    }
    if (paused || disposed || connectGeneration !== generation) return
    if (typeof navigator !== 'undefined') {
      const getBattery = (
        navigator as Navigator & {
          getBattery?: () => Promise<{ charging: boolean; level: number }>
        }
      ).getBattery
      if (paused || disposed || connectGeneration !== generation) return
      if (typeof getBattery === 'function') {
        const batteryGeneration = generation
        const job = Symbol('battery-query')
        batteryJobs.add(job)
        void Promise.resolve()
          .then(
            producerAuthority.boundary(() => {
              if (paused || disposed || batteryGeneration !== generation)
                return null
              return getBattery.call(navigator)
            }),
          )
          .then(
            producerAuthority.boundary((battery) => {
              if (
                !battery ||
                paused ||
                disposed ||
                batteryGeneration !== generation
              )
                return
              const nextLowPower = !battery.charging && battery.level <= 0.2
              const current = () =>
                !paused && !disposed && batteryGeneration === generation
              if (!current()) return
              renderPipelineModuleAuthority.change(() => {
                if (current()) renderPipelineLowPower = nextLowPower
              })
              if (current()) lowPower.value = nextLowPower
            }),
          )
          .catch(
            producerAuthority.boundary((cause) => {
              producerAuthority.recordFailure(cause, 'battery-query', job)
            }),
          )
          .finally(producerAuthority.boundary(() => batteryJobs.delete(job)))
      }
    }
  }
  const inspectResources = () => {
    let rafHandles = 0
    let uncancellableCallbacks = 0
    for (const stop of samplers) {
      const inspection = stop.inspectResources()
      rafHandles += inspection.rafHandles
      uncancellableCallbacks += inspection.uncancellableCallbacks
      if (inspection.rafHandles === 0) {
        samplers.delete(stop)
        producerAuthority.releaseDependency(stop.authority)
      }
    }
    return Object.freeze({
      paused,
      disposed,
      authorityFeed: producerAuthority.inspect(),
      rafHandles,
      uncancellableCallbacks,
      retainedListeners: visibilityBindings.size,
      visibilityRegistrations: Object.freeze(
        [...visibilityBindings].map((binding) =>
          Object.freeze({
            target: binding.target,
            registering: binding.registering,
            releasing: binding.releasing,
            installed: binding.installed,
            retired: binding.retired,
          }),
        ),
      ),
      nativePlatformState: 'unknown' as const,
      pendingBatteryQueries: batteryJobs.size,
      batteryCancellation: batteryJobs.size
        ? ('unavailable' as const)
        : ('idle' as const),
      // Resumption here does not restore a disposed renderer snapshot.
      recoverable: false as const,
    })
  }
  const pause = () => {
    if (!paused) {
      paused = true
      generation += 1
    }
    const bindings = [...visibilityBindings]
    for (const binding of bindings) binding.retired = true
    attemptRenderPipelineCleanup(producerAuthority, [
      { resource: Object.freeze([...samplers]), action: stopSamplers },
      ...bindings.map((binding) => ({
        resource: binding.target,
        action: () => releaseVisibilityBinding(binding),
      })),
    ])
    return inspectResources()
  }
  const resume = () => {
    if (disposed) throw new Error('fsus_render_pipeline_hardware_disposed')
    if (paused) {
      pause()
      if (disposed || !paused) return inspectResources()
      paused = false
      const resumeGeneration = ++generation
      visibilityVersion.value += 1
      if (resumeGeneration === generation) connect()
    }
    return inspectResources()
  }
  onMounted(
    producerAuthority.boundary(() => {
      mounted = true
      connect()
    }),
  )
  onBeforeUnmount(
    producerAuthority.boundary(() => {
      disposed = true
      mounted = false
      try {
        pause()
      } finally {
        producerAuthority.close()
      }
    }),
  )
  const capabilityProfile = computed(
    producerAuthority.boundary(() => {
      visibilityVersion.value
      return resolveFsusRenderCapabilityProfile(refreshProfile.value, {
        lowPower: lowPower.value,
      })
    }),
  )
  const baseConfig = computed(
    producerAuthority.boundary(() => {
      const input = unref(config)
      const resolved = resolveFsusRenderPipelineConfig(input)
      return input?.budget?.dynamicFrameMs === false ||
        (input?.budget?.frameMs !== undefined &&
          input?.budget?.dynamicFrameMs !== true)
        ? resolved
        : {
            ...resolved,
            budget: {
              ...resolved.budget,
              frameMs:
                capabilityProfile.value.visibility === 'hidden' ||
                capabilityProfile.value.lowPower
                  ? Math.min(
                      2,
                      capabilityProfile.value.refreshProfile.mainThreadBudgetMs,
                    )
                  : capabilityProfile.value.refreshProfile.mainThreadBudgetMs,
            },
          }
    }),
  )
  const profile = computed(
    producerAuthority.boundary(() =>
      resolveFsusRenderPipelineHardwareProfile(baseConfig.value),
    ),
  )
  const resolvedConfig = computed(
    producerAuthority.boundary(() =>
      resolveFsusRenderPipelineConfig(baseConfig.value, profile.value),
    ),
  )
  const compositor = computed(
    producerAuthority.boundary(() =>
      resolveFsusRenderPipelineCompositorEnabled(
        resolvedConfig.value,
        profile.value,
      ),
    ),
  )
  const contentVisibility = computed(
    producerAuthority.boundary(() =>
      resolveFsusRenderPipelineContentVisibilityEnabled(
        resolvedConfig.value,
        profile.value,
      ),
    ),
  )
  const attrs = computed(
    producerAuthority.boundary(() =>
      resolveFsusRenderPipelineHardwareAttrs({
        compositor: compositor.value,
        contentVisibility: contentVisibility.value,
        hardwareProfile: profile.value,
        layerBudget: resolvedConfig.value.acceleration.layerBudget,
      }),
    ),
  )

  return {
    authority: producerAuthority.authority,
    inspectResources: producerAuthority.boundary(inspectResources),
    pause: producerAuthority.boundary(pause),
    resume: producerAuthority.boundary(resume),
    attrs,
    capabilityProfile,
    compositor,
    config: resolvedConfig,
    contentVisibility,
    profile,
    refreshProfile,
  }
}

const renderPipelineAdapters = new Map<
  string,
  FsusRenderPipelineAdapter<unknown, unknown>
>()

const adapterRegistrations = new WeakMap<
  FsusRenderPipelineAdapter<unknown, unknown>,
  { active: boolean; previous?: FsusRenderPipelineAdapter<unknown, unknown> }
>()

const normalizeAdapterId = (adapterId: string) => adapterId.trim()

export const registerFsusRenderPipelineAdapter =
  renderPipelineModuleAuthority.boundary(
    <TSource, TUnit>(adapter: FsusRenderPipelineAdapter<TSource, TUnit>) => {
      const adapterId = normalizeAdapterId(adapter.id)
      if (!adapterId) {
        throw new Error('fsus_render_pipeline_adapter_id_required')
      }

      const descriptor = { ...adapter }
      const worker = descriptor.worker ? { ...descriptor.worker } : undefined
      const normalizedAdapter = Object.freeze({
        ...descriptor,
        id: adapterId,
        worker: worker
          ? Object.freeze({
              ...worker,
              laneQueueLimits: worker.laneQueueLimits
                ? Object.freeze({ ...worker.laneQueueLimits })
                : undefined,
            })
          : undefined,
      }) as FsusRenderPipelineAdapter<unknown, unknown>
      const registration = {
        active: true,
        previous: renderPipelineAdapters.get(adapterId),
      }
      adapterRegistrations.set(normalizedAdapter, registration)
      renderPipelineAdapters.set(adapterId, normalizedAdapter)

      return renderPipelineModuleAuthority.boundary(() => {
        if (!registration.active) return
        registration.active = false
        if (renderPipelineAdapters.get(adapterId) !== normalizedAdapter) return
        let previous = registration.previous
        while (previous && !adapterRegistrations.get(previous)?.active)
          previous = adapterRegistrations.get(previous)?.previous
        if (previous) renderPipelineAdapters.set(adapterId, previous)
        else renderPipelineAdapters.delete(adapterId)
      })
    },
  )

export const getFsusRenderPipelineAdapter =
  renderPipelineModuleAuthority.boundary(
    <TSource = unknown, TUnit = unknown>(adapterId: string) =>
      renderPipelineAdapters.get(normalizeAdapterId(adapterId)) as
        | FsusRenderPipelineAdapter<TSource, TUnit>
        | undefined,
  )

export const listFsusRenderPipelineAdapters =
  renderPipelineModuleAuthority.boundary(() =>
    Array.from(renderPipelineAdapters.values()),
  )

export const clearFsusRenderPipelineAdapters =
  renderPipelineModuleAuthority.boundary(() => {
    renderPipelineAdapters.clear()
  })

type FsusRenderPipelineStrategyResolverEntry = {
  order: number
  priority: number
  resolver: FsusRenderPipelineStrategyResolver
}

const strategyResolvers = new Set<FsusRenderPipelineStrategyResolverEntry>()
let strategyResolverOrder = 0
let strategyResolverVersion = 0

export type FsusRenderPipelineStrategyCacheEntry = {
  durationMs?: number
  durationEwmaMs?: number
  expiresAt: number
  profileVersion?: string
  sampleCount: number
  strategy: FsusRenderPipelineStrategy
  updatedAt: number
}

const STRATEGY_CACHE_LIMIT = 128
const STRATEGY_CACHE_TTL_MS = 60_000
export const createFsusRenderPipelineStrategyCache =
  renderPipelineModuleAuthority.boundary(
    ({
      limit = STRATEGY_CACHE_LIMIT,
      now: readNow = readRenderPipelineNow,
      ttlMs = STRATEGY_CACHE_TTL_MS,
    }: {
      limit?: number
      now?: () => number
      ttlMs?: number
    } = {}) => {
      const entries = new Map<string, FsusRenderPipelineStrategyCacheEntry>()
      const get = (cacheKey: string, profileVersion?: string) => {
        if (!cacheKey) return undefined
        const entry = entries.get(cacheKey)
        if (
          !entry ||
          entry.expiresAt <= readNow() ||
          (profileVersion !== undefined &&
            entry.profileVersion !== profileVersion)
        ) {
          entries.delete(cacheKey)
          return undefined
        }
        return entry
      }
      const set = (
        cacheKey: string,
        entry: Pick<
          FsusRenderPipelineStrategyCacheEntry,
          'durationMs' | 'strategy'
        > & { profileVersion?: string; ttlMs?: number },
      ) => {
        if (!cacheKey) return
        const previous = entries.get(cacheKey)
        const durationEwmaMs =
          entry.durationMs === undefined
            ? previous?.durationEwmaMs
            : previous?.durationEwmaMs === undefined
              ? entry.durationMs
              : previous.durationEwmaMs * 0.75 + entry.durationMs * 0.25
        const updatedAt = readNow()
        entries.delete(cacheKey)
        entries.set(cacheKey, {
          ...entry,
          durationEwmaMs,
          expiresAt: updatedAt + positive(entry.ttlMs, ttlMs),
          sampleCount: (previous?.sampleCount ?? 0) + 1,
          updatedAt,
        })
        if (entries.size > limit) {
          const firstKey = entries.keys().next().value
          if (firstKey) entries.delete(firstKey)
        }
      }
      const invalidateProfile = (profileVersion: string) => {
        for (const [key, entry] of entries) {
          if (entry.profileVersion !== profileVersion) entries.delete(key)
        }
      }
      return {
        clear: renderPipelineModuleAuthority.boundary(() => entries.clear()),
        get: renderPipelineModuleAuthority.boundary(get),
        invalidateProfile:
          renderPipelineModuleAuthority.boundary(invalidateProfile),
        set: renderPipelineModuleAuthority.boundary(set),
      }
    },
  )

const strategyCache = createFsusRenderPipelineStrategyCache()

const stringifyRenderPipelineConfigSignature = (
  config: FsusResolvedRenderPipelineConfig,
  canUseWorker: boolean,
) =>
  [
    config.adaptive,
    config.mode,
    config.worker,
    config.thresholds.htmlBytes,
    config.thresholds.estimatedNodes,
    config.thresholds.itemCount,
    config.budget.dynamicFrameMs ? 'dynamic-frame' : 'fixed-frame',
    config.budget.frameMs,
    config.budget.overscanPx,
    config.budget.measureBatch,
    config.acceleration.mode,
    config.acceleration.compositor,
    config.acceleration.contentVisibility,
    config.acceleration.layerBudget,
    canUseWorker ? 'worker' : 'main',
    strategyResolverVersion,
  ].join('|')

const readAdapterFingerprint = <TSource, TUnit>(
  adapter: FsusRenderPipelineAdapter<TSource, TUnit>,
  source: TSource,
) => {
  try {
    return adapter.fingerprint(source)
  } catch {
    return ''
  }
}

const createStrategyCacheKey = <TSource, TUnit>({
  adapter,
  canUseWorker,
  config,
  source,
}: {
  adapter: FsusRenderPipelineAdapter<TSource, TUnit> | null
  canUseWorker: boolean
  config: FsusResolvedRenderPipelineConfig
  source: TSource
}) => {
  if (!adapter) return ''
  const fingerprint = readAdapterFingerprint(adapter, source)
  if (!fingerprint) return ''
  return [
    adapter.id,
    fingerprint,
    stringifyRenderPipelineConfigSignature(config, canUseWorker),
  ].join('\u0000')
}

const getCachedStrategy = (cacheKey: string, profileVersion?: string) => {
  return strategyCache.get(cacheKey, profileVersion)
}

const setCachedStrategy = (
  cacheKey: string,
  entry: Pick<
    FsusRenderPipelineStrategyCacheEntry,
    'durationMs' | 'strategy'
  > & {
    profileVersion?: string
    ttlMs?: number
  },
) => {
  strategyCache.set(cacheKey, entry)
}

export const clearFsusRenderPipelineStrategyCache = strategyCache.clear

export const inspectFsusRenderPipelineStrategyCache =
  renderPipelineModuleAuthority.boundary((cacheKey: string) =>
    strategyCache.get(cacheKey),
  )

export const registerFsusRenderPipelineStrategyResolver =
  renderPipelineModuleAuthority.boundary(
    (
      resolver: FsusRenderPipelineStrategyResolver,
      options: FsusRenderPipelineStrategyResolverOptions = {},
    ) => {
      const entry = {
        order: strategyResolverOrder++,
        priority:
          typeof options.priority === 'number' &&
          Number.isFinite(options.priority)
            ? options.priority
            : 0,
        resolver,
      }
      strategyResolvers.add(entry)
      strategyResolverVersion += 1
      strategyCache.clear()
      return renderPipelineModuleAuthority.boundary(() => {
        strategyResolvers.delete(entry)
        strategyResolverVersion += 1
        strategyCache.clear()
      })
    },
  )

export const clearFsusRenderPipelineStrategyResolvers =
  renderPipelineModuleAuthority.boundary(() => {
    strategyResolvers.clear()
    strategyResolverVersion += 1
    strategyCache.clear()
  })

export const resolveFsusRenderPipelineComponentPolicy = (
  componentName: string,
  config: FsusResolvedRenderPipelineConfig,
  options: {
    canUseWorker?: boolean
    estimate?: FsusRenderEstimate
  } = {},
): FsusResolvedRenderPipelineComponentPolicy => {
  const normalizedName = componentName.trim()
  const policy =
    getFsusRenderPipelineComponentPolicy(normalizedName) ??
    createFsusRenderPipelineComponentPolicy(normalizedName)

  const estimate = {
    ...policy.estimate,
    ...options.estimate,
  }

  const strategy =
    config.mode === 'disabled'
      ? 'disabled'
      : policy.budgeted
        ? chooseFsusRenderPipelineStrategy(
            estimate,
            config,
            options.canUseWorker,
          )
        : 'sync'

  return {
    ...policy,
    estimate,
    strategy,
  }
}

const chooseDefaultFsusRenderPipelineStrategy = ({
  canUseWorker = false,
  config,
  estimate,
}: FsusRenderPipelineStrategyContext): FsusRenderPipelineStrategy => {
  if (!shouldUseFsusRenderPipeline(estimate, config)) {
    return config.mode === 'disabled' ? 'disabled' : 'sync'
  }

  if (config.worker !== 'disabled' && canUseWorker && canCreateWorker()) {
    return 'chunked-worker'
  }

  return 'chunked-main'
}

export const chooseFsusRenderPipelineStrategy = (
  estimate: FsusRenderEstimate,
  config: FsusResolvedRenderPipelineConfig,
  canUseWorker = false,
): FsusRenderPipelineStrategy => {
  const context = { canUseWorker, config, estimate }

  const resolvers = Array.from(strategyResolvers).sort(
    (left, right) => right.priority - left.priority || left.order - right.order,
  )

  for (const { resolver } of resolvers) {
    const resolved = resolver(context)
    if (resolved) return resolved
  }

  return chooseDefaultFsusRenderPipelineStrategy(context)
}

export const resolveFsusRenderPipelineCache = ({
  budgeted = true,
  config,
  estimatedItemSize,
  explicitCache,
  strategy,
}: {
  budgeted?: boolean
  config: FsusResolvedRenderPipelineConfig
  estimatedItemSize: number
  explicitCache?: number
  strategy: FsusRenderPipelineStrategy
}) => {
  const propCache =
    typeof explicitCache === 'number' && Number.isFinite(explicitCache)
      ? Math.max(1, Math.floor(explicitCache))
      : 1

  if (!budgeted || strategy === 'sync' || strategy === 'disabled') {
    return propCache
  }

  const itemSize =
    typeof estimatedItemSize === 'number' &&
    Number.isFinite(estimatedItemSize) &&
    estimatedItemSize > 0
      ? estimatedItemSize
      : 1

  return Math.max(propCache, Math.ceil(config.budget.overscanPx / itemSize))
}

export const useFsusRenderScheduler = (
  budget: MaybeRef<{ frameMs?: number } | undefined> = undefined,
) => {
  type SchedulerEntry = {
    cleanup: (() => void) | null
    key?: string
    priority: FsusRenderSchedulerPriority
    task: () => void | FsusScheduledWork
  }

  const queues: Record<FsusRenderSchedulerPriority, Set<SchedulerEntry>> = {
    background: new Set(),
    'user-blocking': new Set(),
    visible: new Set(),
  }
  let cancelFlush: (() => void) | null = null
  let scheduledFlushPriority: FsusRenderSchedulerPriority | null = null
  const keyedEntries = new Map<string, SchedulerEntry>()

  const priorities: FsusRenderSchedulerPriority[] = [
    'user-blocking',
    'visible',
    'background',
  ]
  const priorityRank: Record<FsusRenderSchedulerPriority, number> = {
    background: 0,
    visible: 1,
    'user-blocking': 2,
  }
  const postTaskPriorityMap: Record<FsusRenderSchedulerPriority, string> = {
    background: 'background',
    visible: 'user-visible',
    'user-blocking': 'user-blocking',
  }

  const hasPending = () =>
    priorities.some((priority) => queues[priority].size > 0)

  const getNextEntry = () => {
    for (const priority of priorities) {
      const entry = queues[priority].values().next().value
      if (entry) return entry
    }
    return null
  }

  const getHighestPendingPriority = () =>
    priorities.find((priority) => queues[priority].size > 0) ?? 'background'

  const removeEntry = (entry: SchedulerEntry) => {
    queues[entry.priority].delete(entry)
    if (entry.key && keyedEntries.get(entry.key) === entry) {
      keyedEntries.delete(entry.key)
    }
    entry.cleanup?.()
    entry.cleanup = null
  }

  const flush = () => {
    cancelFlush = null
    scheduledFlushPriority = null
    const startedAt =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    const frameMs =
      unref(budget)?.frameMs ?? defaultRenderPipelineConfig.budget.frameMs
    const effectiveFrameMs =
      typeof document !== 'undefined' && document.visibilityState === 'hidden'
        ? Math.min(2, frameMs)
        : renderPipelineLowPower
          ? Math.min(3, frameMs)
          : frameMs

    let entry = getNextEntry()
    let ranBackgroundChunk = false
    while (entry) {
      queues[entry.priority].delete(entry)
      const result = entry.task()
      const continuation =
        result && typeof result === 'object' && result.done === false
          ? result.continuation
          : null
      if (continuation) {
        entry.task = continuation
        queues[entry.priority].add(entry)
      } else {
        removeEntry(entry)
      }

      if (entry.priority === 'background') ranBackgroundChunk = true

      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (
        hasPending() &&
        (now - startedAt >= effectiveFrameMs || ranBackgroundChunk)
      ) {
        requestFlush()
        return
      }
      entry = getNextEntry()
    }
  }

  const requestFlush = () => {
    const flushPriority = getHighestPendingPriority()
    if (cancelFlush) {
      if (
        scheduledFlushPriority &&
        priorityRank[flushPriority] <= priorityRank[scheduledFlushPriority]
      ) {
        return
      }
      cancelFlush()
      cancelFlush = null
    }
    scheduledFlushPriority = flushPriority

    const scheduler = (
      globalThis as {
        scheduler?: {
          postTask?: (
            callback: () => void,
            options?: { priority?: string; signal?: AbortSignal },
          ) => Promise<unknown>
        }
      }
    ).scheduler

    if (typeof scheduler?.postTask === 'function') {
      const flushController = new AbortController()
      cancelFlush = () => {
        flushController.abort()
        scheduledFlushPriority = null
      }
      void scheduler
        .postTask(
          () => {
            if (!flushController.signal.aborted) flush()
          },
          {
            priority: postTaskPriorityMap[flushPriority],
            signal: flushController.signal,
          },
        )
        .catch(() => {
          if (!flushController.signal.aborted) flush()
        })
      return
    }

    if (
      queues.background.size > 0 &&
      queues['user-blocking'].size === 0 &&
      queues.visible.size === 0 &&
      typeof requestIdleCallback === 'function'
    ) {
      const idle = requestIdleCallback(() => flush())
      cancelFlush = () => {
        scheduledFlushPriority = null
        cancelIdleCallback(idle)
      }
      return
    }

    if (typeof requestAnimationFrame === 'function') {
      const frame = requestAnimationFrame(flush)
      cancelFlush = () => {
        scheduledFlushPriority = null
        cancelAnimationFrame(frame)
      }
      return
    }

    const timeout = setTimeout(flush, 0)
    cancelFlush = () => {
      scheduledFlushPriority = null
      clearTimeout(timeout)
    }
  }

  const schedule = (
    task: () => void | FsusScheduledWork,
    options: FsusRenderSchedulerTaskOptions = {},
  ) => {
    const priority = options.priority ?? 'visible'
    if (options.signal?.aborted) return () => undefined

    const entry: SchedulerEntry = {
      cleanup: null,
      key: options.key,
      priority,
      task,
    }

    const cancel = () => removeEntry(entry)
    if (options.signal) {
      options.signal.addEventListener('abort', cancel, { once: true })
      entry.cleanup = () => options.signal?.removeEventListener('abort', cancel)
    }

    if (entry.key) {
      const previous = keyedEntries.get(entry.key)
      if (previous) removeEntry(previous)
      keyedEntries.set(entry.key, entry)
    }
    queues[priority].add(entry)
    requestFlush()
    return cancel
  }

  const cancel = () => {
    cancelFlush?.()
    cancelFlush = null
    for (const priority of priorities) {
      for (const entry of queues[priority]) {
        removeEntry(entry)
      }
    }
  }

  onBeforeUnmount(cancel)

  return {
    cancel,
    schedule,
  }
}

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

type AnyFsusWorkerExecutor = ReturnType<
  typeof createFsusWorkerExecutor<unknown, unknown>
>

type FsusSharedWorkerRegistryInspection = {
  readonly owners: number
  readonly listeners: number
  readonly pendingCleanupMicrotasks: number
  readonly attribution: 'unattributable'
}

type FsusSharedWorkerExecutorEntry = {
  executor: AnyFsusWorkerExecutor
  listeners: Set<(event: FsusWorkerExecutorEvent) => void>
  owners: Set<symbol>
  cleanupChecks: { pending: number }
  producerAuthority: ReturnType<typeof createRenderPipelineProducerAuthority>
  disposeIfUnused: () => void
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
  const producerAuthority = createRenderPipelineProducerAuthority()

  let entry = sharedWorkerExecutors.get(poolKey)
  if (!entry) {
    const registryAuthority = createRenderPipelineProducerAuthority()
    const listeners = new Set<(event: FsusWorkerExecutorEvent) => void>()
    const owners = new Set<symbol>()
    const cleanupChecks = { pending: 0 }
    const disposeIfUnused = () => {
      const activeEntry = sharedWorkerExecutors.get(poolKey)
      if (
        !activeEntry ||
        activeEntry !== entry ||
        activeEntry.owners.size > 0 ||
        activeEntry.listeners.size > 0 ||
        activeEntry.cleanupChecks.pending > 0
      )
        return
      const inspection = activeEntry.executor.inspectResources()
      if (
        inspection.pendingCount !== 0 ||
        inspection.activeCount !== 0 ||
        inspection.tasks.length !== 0 ||
        inspection.resources.cancelTimeoutCount !== 0 ||
        inspection.pool.retainCount !== 0
      )
        return
      sharedWorkerExecutors.delete(poolKey)
      activeEntry.executor.dispose()
    }
    entry = {
      executor: createFsusWorkerExecutor<unknown, unknown>(createWorker, {
        ...options,
        name: options.name ?? poolKey,
        onEvent: registryAuthority.boundary((event) => {
          options.onEvent?.(event)
          for (const activeListener of Array.from(listeners)) {
            activeListener(event)
          }
          if (owners.size === 0 && listeners.size === 0) {
            cleanupChecks.pending += 1
            queueMicrotask(
              registryAuthority.boundary(() => {
                cleanupChecks.pending -= 1
                disposeIfUnused()
              }),
            )
          }
        }),
      }),
      listeners,
      owners,
      cleanupChecks,
      producerAuthority: registryAuthority,
      disposeIfUnused,
    }
    sharedWorkerExecutors.set(poolKey, entry)
  }

  const owner = Symbol('shared-worker-owner')
  const ownedEntry = entry
  producerAuthority.retainDependency(
    ownedEntry.producerAuthority.authority,
    'shared-registry-authority',
  )
  let released = false
  ownedEntry.producerAuthority.change(() => {
    ownedEntry.owners.add(owner)
    ownedEntry.listeners.add(listener)
  })
  return {
    authority: producerAuthority.authority,
    inspectSubscription: producerAuthority.boundary(() => ({
      retainedOwner: ownedEntry.owners.has(owner),
      listenerActive: ownedEntry.listeners.has(listener),
    })),
    inspectRegistry: producerAuthority.boundary(
      (): FsusSharedWorkerRegistryInspection =>
        Object.freeze({
          owners: ownedEntry.owners.size,
          listeners: ownedEntry.listeners.size,
          pendingCleanupMicrotasks: ownedEntry.cleanupChecks.pending,
          attribution: 'unattributable',
        }),
    ),
    pauseListener: producerAuthority.boundary(() =>
      ownedEntry.producerAuthority.change(() =>
        ownedEntry.listeners.delete(listener),
      ),
    ),
    resumeListener: producerAuthority.boundary(() => {
      if (released || ownedEntry.executor.inspectResources().disposed) {
        throw new Error('fsus_shared_worker_subscription_unavailable')
      }
      ownedEntry.producerAuthority.change(() =>
        ownedEntry.listeners.add(listener),
      )
    }),
    cleanup: producerAuthority.boundary(() => {
      if (released) return
      released = true
      try {
        ownedEntry.producerAuthority.change(() => {
          ownedEntry.listeners.delete(listener)
          ownedEntry.owners.delete(owner)
          ownedEntry.disposeIfUnused()
        })
      } finally {
        if (
          !ownedEntry.listeners.has(listener) &&
          !ownedEntry.owners.has(owner)
        )
          producerAuthority.close()
      }
    }),
    executor: ownedEntry.executor as ReturnType<
      typeof createFsusWorkerExecutor<TRequest, TResponse>
    >,
  }
}

const isWindowViewport = (viewport: FsusViewport): viewport is Window =>
  (typeof window !== 'undefined' && viewport === window) ||
  (typeof Window !== 'undefined' && viewport instanceof Window)

const getViewportScrollTop = (viewport: FsusViewport | null) => {
  if (!viewport) return 0
  if (isWindowViewport(viewport)) {
    return viewport.scrollY || document.documentElement.scrollTop || 0
  }
  return viewport.scrollTop
}

const getViewportHeight = (viewport: FsusViewport | null) => {
  if (!viewport) return 0
  if (isWindowViewport(viewport)) {
    return viewport.innerHeight
  }
  return viewport.clientHeight
}

const setViewportScrollTop = (viewport: FsusViewport | null, value: number) => {
  if (!viewport) return
  if (isWindowViewport(viewport)) {
    viewport.scrollTo({ top: value })
    return
  }
  viewport.scrollTop = value
}

export const useFsusVirtualWindow = <TUnit>(options: {
  estimateSize: (unit: TUnit, index: number) => number
  getKey: (unit: TUnit, index: number) => string
  getViewport: () => FsusViewport | null
  itemSize?: MaybeRef<number | undefined>
  measureBatch?: MaybeRef<number | undefined>
  measurementCacheLimit?: MaybeRef<number | undefined>
  minVisibleItems?: MaybeRef<number | undefined>
  onDiagnostic?: (event: FsusVirtualWindowDiagnosticEvent) => void
  overscanPx?: MaybeRef<number | undefined>
  units: Readonly<Ref<readonly TUnit[]>>
  // Exact original units/key/estimate, viewport/ref and parameter publications.
  unitsAuthority?: FsusRenderPipelineAuthority
  viewportAuthority?: FsusRenderPipelineAuthority
  configAuthority?: FsusRenderPipelineAuthority
}) => {
  const producerAuthority = createRenderPipelineProducerAuthority()
  let inputGeneration = 0
  let unitsGeneration = 0
  const revokeInput = () => {
    inputGeneration += 1
  }
  const scrollOffset = ref(0)
  const viewportSize = ref(0)
  const indexVersion = ref(0)
  const initialize = () => {
    try {
      producerAuthority.change(() => {
        producerAuthority.retainDependency(
          options.unitsAuthority,
          'external-units-authority',
          () => true,
          revokeInput,
        )
        producerAuthority.retainDependency(
          options.viewportAuthority,
          'external-viewport-authority',
          () => true,
          revokeInput,
        )
        producerAuthority.retainDependency(
          options.configAuthority,
          'external-virtual-config-authority',
          () => true,
          revokeInput,
        )
      })

      const initializationGeneration = inputGeneration
      const initialUnits = options.units.value
      const assertInitializationCurrent = () => {
        if (
          initializationGeneration !== inputGeneration ||
          options.units.value !== initialUnits ||
          initializationGeneration !== inputGeneration
        )
          throw new Error('fsus_virtual_window_initialization_superseded')
      }
      assertInitializationCurrent()
      const fixedItemSize = producerAuthority.change(() =>
        positive(unref(options.itemSize), 0),
      )

      const createVariableState = () => {
        const keys: string[] = []
        const keyToIndex = new Map<string, number>()
        const estimatedSizes: number[] = []
        const values: number[] = []

        initialUnits.forEach((unit, index) => {
          const key = options.getKey(unit, index)
          assertInitializationCurrent()
          if (keyToIndex.has(key)) {
            throw new Error(`useFsusVirtualWindow requires unique keys: ${key}`)
          }
          const estimate = positive(options.estimateSize(unit, index), 1)
          assertInitializationCurrent()
          keys.push(key)
          keyToIndex.set(key, index)
          estimatedSizes.push(estimate)
          values.push(estimate)
        })

        assertInitializationCurrent()
        return {
          elementKeys: new WeakMap<Element, string>(),
          estimatedSizes,
          index: new FsusVirtualSizeIndex(values),
          keys,
          keyToIndex,
          measuredSizes: new Map<string, number>(),
          observedElements: new Map<string, HTMLElement>(),
          pendingMeasurements: new Map<string, number>(),
        }
      }

      const variableState = producerAuthority.change(() =>
        fixedItemSize > 0 ? null : createVariableState(),
      )
      assertInitializationCurrent()
      return { fixedItemSize, variableState, assertInitializationCurrent }
    } catch (cause) {
      producerAuthority.recordFailure(cause, 'virtual-initialization', options)
      producerAuthority.close()
      throw cause
    }
  }
  const { fixedItemSize, variableState, assertInitializationCurrent } =
    initialize()
  const callbacks = createRenderPipelineCallbackResources(producerAuthority)
  let measurementFrame: (() => void) | null = null
  let scrollFrame: (() => void) | null = null
  let paused = false
  let disposed = false
  let generation = 0
  let connected = false
  let connectionGeneration = 0
  let listenerViewport: FsusViewport | null = null
  let resizeTarget: Window | null = null
  let stopUnitsWatch: (() => void) | null = null
  type ViewportBinding = {
    target: FsusViewport
    type: 'scroll' | 'resize'
    listener: () => void
    installed: boolean
    registering: boolean
    retired: boolean
  }
  const viewportBindings = new Set<ViewportBinding>()
  let observerGeneration = 0
  const viewportJobs = new Set<symbol>()
  const afterViewportTick = (run: () => void) => {
    const job = Symbol('viewport-tick')
    const tickGeneration = generation
    viewportJobs.add(job)
    void nextTick(
      producerAuthority.boundary(() => {
        if (!paused && !disposed && tickGeneration === generation) run()
      }),
    ).finally(producerAuthority.boundary(() => viewportJobs.delete(job)))
  }
  let resizeObserver: ResizeObserver | null = null
  type RefToken = { key: string; elements: Set<Element>; inFlight: number }
  const refGenerations = new Map<string, RefToken>()
  const refTokens = new Set<RefToken>()
  type ResizeTarget = {
    element: Element
    observing: number
    releasing: boolean
    retired: boolean
    deferredObserve: boolean
  }
  type ResizeBinding = {
    observer: ResizeObserver | null
    constructionTarget: Element | null
    targets: Set<Element>
    targetStates: Map<Element, ResizeTarget>
    registering: boolean
    constructorStarted: boolean
    operations: number
    releasing: boolean
    retired: boolean
    drainingTargets: boolean
  }
  let resizeBinding: ResizeBinding | null = null
  const resizeBindings = new Set<ResizeBinding>()
  const observedTargets = new Set<Element>()
  const observerCallbacks = new Set<symbol>()
  const trackObserverCallback =
    <TArgs extends unknown[]>(run: (...args: TArgs) => void) =>
    (...args: TArgs) => {
      const callback = Symbol('virtual-observer-callback')
      try {
        producerAuthority.change(
          () => run(...args),
          () => {
            observerCallbacks.add(callback)
          },
        )
      } finally {
        producerAuthority.change(() => observerCallbacks.delete(callback))
      }
    }
  let viewport: FsusViewport | null = null

  const totalSize = computed(
    producerAuthority.boundary(() => {
      if (fixedItemSize > 0) return options.units.value.length * fixedItemSize
      indexVersion.value
      return variableState?.index.total ?? 0
    }),
  )

  const range = computed(
    producerAuthority.boundary(() => {
      const overscan =
        unref(options.overscanPx) ??
        defaultRenderPipelineConfig.budget.overscanPx
      const startOffset = Math.max(0, scrollOffset.value - overscan)
      const endOffset = scrollOffset.value + viewportSize.value + overscan
      const count = options.units.value.length
      const minVisibleItems = Math.max(
        1,
        Math.floor(positive(unref(options.minVisibleItems), 1)),
      )
      let start = 0
      let end = 0

      if (fixedItemSize > 0) {
        start = Math.max(0, Math.ceil(startOffset / fixedItemSize) - 1)
        end = Math.min(count, Math.floor(endOffset / fixedItemSize) + 1)
      } else if (variableState) {
        indexVersion.value
        start = variableState.index.findFirstEndAtLeast(startOffset)
        const lastVisible = variableState.index.findFirstEndGreater(endOffset)
        end = lastVisible >= count ? count : lastVisible + 1
      }

      return {
        end: Math.min(count, Math.max(end, start + minVisibleItems)),
        start,
      }
    }),
  )

  const offsetForIndex = (index: number) =>
    fixedItemSize > 0
      ? Math.max(0, index) * fixedItemSize
      : (variableState?.index.prefixSize(index) ?? 0)

  const visibleItems: ComputedRef<FsusVirtualWindowItem<TUnit>[]> = computed(
    producerAuthority.boundary(() => {
      indexVersion.value
      const visibleGeneration = inputGeneration
      const visibleUnits = unitsGeneration
      const units = options.units.value
      const currentRange = range.value
      const items: FsusVirtualWindowItem<TUnit>[] = []
      let offset = offsetForIndex(currentRange.start)
      for (
        let index = currentRange.start;
        index < currentRange.end;
        index += 1
      ) {
        const unit = units[index]
        if (unit === undefined) break
        const size =
          fixedItemSize > 0
            ? fixedItemSize
            : (variableState?.index.get(index) ?? 0)
        const key = options.getKey(unit, index)
        if (
          disposed ||
          visibleGeneration !== inputGeneration ||
          visibleUnits !== unitsGeneration
        )
          return []
        items.push({
          index,
          key,
          offset,
          size,
          unit,
        })
        offset += size
      }
      return items
    }),
  )

  const topSpacer = computed(
    producerAuthority.boundary(() => offsetForIndex(range.value.start)),
  )
  const bottomSpacer = computed(
    producerAuthority.boundary(() =>
      Math.max(0, totalSize.value - offsetForIndex(range.value.end)),
    ),
  )

  const emitDiagnostic = (
    event: Omit<FsusVirtualWindowDiagnosticEvent, 'itemCount'>,
  ) => {
    options.onDiagnostic?.({
      ...event,
      itemCount: options.units.value.length,
    })
  }

  const readViewport = () => {
    if (paused || disposed) return
    const readGeneration = generation
    const readInputGeneration = inputGeneration
    const connection = connectionGeneration
    const nextViewport = options.getViewport()
    if (
      paused ||
      disposed ||
      readGeneration !== generation ||
      readInputGeneration !== inputGeneration ||
      connection !== connectionGeneration
    )
      return
    if (connected && listenerViewport !== nextViewport) {
      disconnect()
      attachListeners(nextViewport)
    }
    viewport = nextViewport
    const activeConnection = connectionGeneration
    const nextScrollOffset = getViewportScrollTop(viewport)
    if (
      paused ||
      disposed ||
      readGeneration !== generation ||
      readInputGeneration !== inputGeneration ||
      activeConnection !== connectionGeneration
    )
      return
    scrollOffset.value = nextScrollOffset
    if (
      paused ||
      disposed ||
      readGeneration !== generation ||
      readInputGeneration !== inputGeneration ||
      activeConnection !== connectionGeneration
    )
      return
    const nextHeight = getViewportHeight(viewport)
    if (
      paused ||
      disposed ||
      readGeneration !== generation ||
      readInputGeneration !== inputGeneration ||
      activeConnection !== connectionGeneration
    )
      return
    viewportSize.value = nextHeight
  }

  const scheduleViewportRead = producerAuthority.boundary(() => {
    if (
      paused ||
      disposed ||
      (scrollFrame &&
        callbacks.isPending(scrollFrame) &&
        !callbacks.isCancelled(scrollFrame))
    )
      return
    if (typeof requestAnimationFrame !== 'function') {
      readViewport()
      return
    }
    scrollFrame = callbacks.frame(() => {
      scrollFrame = null
      readViewport()
    })
  })

  const flushMeasurements = () => {
    measurementFrame = null
    if (paused || disposed || !variableState?.pendingMeasurements.size) return
    const measurementGeneration = generation
    const measurementInput = inputGeneration
    const measurementUnits = unitsGeneration
    const isCurrent = () =>
      !paused &&
      !disposed &&
      measurementGeneration === generation &&
      measurementInput === inputGeneration &&
      measurementUnits === unitsGeneration

    const batchSize = Math.max(
      1,
      Math.floor(positive(unref(options.measureBatch), 32)),
    )
    if (!isCurrent()) return
    const entries: Array<[string, number]> = []
    for (const entry of variableState.pendingMeasurements) {
      entries.push(entry)
      variableState.pendingMeasurements.delete(entry[0])
      if (entries.length >= batchSize) break
    }

    const anchorIndex = range.value.start
    if (!isCurrent()) return
    let scrollCorrection = 0
    let changed = false

    for (const [key, nextSize] of entries) {
      const index = variableState.keyToIndex.get(key)
      if (index === undefined || !Number.isFinite(nextSize) || nextSize <= 0)
        continue
      const previous = variableState.index.get(index)
      if (previous === nextSize) continue

      variableState.measuredSizes.delete(key)
      variableState.measuredSizes.set(key, nextSize)
      changed = variableState.index.update(index, nextSize) || changed
      if (index < anchorIndex) scrollCorrection += nextSize - previous
    }

    const cacheLimit = Math.max(
      1,
      Math.floor(positive(unref(options.measurementCacheLimit), 2048)),
    )
    if (!isCurrent()) return
    for (const [key] of variableState.measuredSizes) {
      if (variableState.measuredSizes.size <= cacheLimit) break
      if (variableState.observedElements.has(key)) continue
      variableState.measuredSizes.delete(key)
      const index = variableState.keyToIndex.get(key)
      if (index === undefined) continue
      const previous = variableState.index.get(index)
      const estimate = variableState.estimatedSizes[index] ?? previous
      changed = variableState.index.update(index, estimate) || changed
      if (index < anchorIndex) scrollCorrection += estimate - previous
    }

    if (changed) indexVersion.value += 1
    if (!isCurrent()) return
    emitDiagnostic({ batchSize: entries.length, type: 'measurement-batch' })
    if (!isCurrent()) return
    emitDiagnostic({
      cacheSize: variableState.measuredSizes.size,
      type: 'measurement-cache',
    })
    if (!isCurrent()) return

    if (Math.abs(scrollCorrection) > 0.5) {
      const nextOffset = getViewportScrollTop(viewport) + scrollCorrection
      if (!isCurrent()) return
      setViewportScrollTop(viewport, nextOffset)
      if (!isCurrent()) return
      scrollOffset.value = nextOffset
      if (!isCurrent()) return
      emitDiagnostic({
        correction: scrollCorrection,
        reason: 'measurement',
        type: 'scroll-correction',
      })
      if (!isCurrent()) return
      readViewport()
      if (!isCurrent()) return
    }

    if (variableState.pendingMeasurements.size) {
      if (typeof requestAnimationFrame === 'function') {
        measurementFrame = callbacks.frame(flushMeasurements)
      } else {
        flushMeasurements()
      }
    }
  }

  const queueMeasurement = (key: string, size: number) => {
    if (
      paused ||
      disposed ||
      !variableState ||
      !variableState.keyToIndex.has(key)
    )
      return
    variableState.pendingMeasurements.set(key, size)
    if (
      !measurementFrame ||
      !callbacks.isPending(measurementFrame) ||
      callbacks.isCancelled(measurementFrame)
    ) {
      if (typeof requestAnimationFrame === 'function') {
        measurementFrame = callbacks.frame(flushMeasurements)
      } else {
        flushMeasurements()
      }
    }
  }

  const pruneRefTokens = () => {
    // Native calls can reenter before their late cleanup finishes. Retain those
    // actual obligations; only quiescent, identity-matched records are removed.
    if (
      [...resizeBindings].some(
        (binding) =>
          binding.registering || binding.operations > 0 || binding.releasing,
      )
    )
      return
    const obligated = (element: Element) =>
      [...resizeBindings].some((binding) => {
        if (binding.retired && binding.constructionTarget === element)
          return true
        const target = binding.targetStates.get(element)
        return (
          !!target &&
          (binding.retired ||
            target.retired ||
            target.observing > 0 ||
            target.releasing ||
            target.deferredObserve)
        )
      })
    for (const token of [...refTokens]) {
      if (token.inFlight > 0) continue
      const current = refGenerations.get(token.key) === token
      const desired = current
        ? variableState?.observedElements.get(token.key)
        : undefined
      for (const element of token.elements)
        if (element !== desired && !obligated(element))
          token.elements.delete(element)
      if (desired || [...token.elements].some(obligated)) continue
      if (refGenerations.get(token.key) === token)
        refGenerations.delete(token.key)
      refTokens.delete(token)
    }
  }
  const reconcileObservedTargets = () => {
    observedTargets.clear()
    for (const binding of resizeBindings)
      for (const target of binding.targets) observedTargets.add(target)
  }
  const releaseResizeBinding = (binding: ResizeBinding) => {
    binding.retired = true
    if (
      binding.registering ||
      binding.operations > 0 ||
      binding.releasing ||
      !binding.observer
    )
      return
    binding.releasing = true
    try {
      binding.observer.disconnect()
      resizeBindings.delete(binding)
      binding.targets.clear()
      binding.targetStates.clear()
      if (resizeBinding === binding) {
        resizeBinding = null
        resizeObserver = null
      }
      reconcileObservedTargets()
    } finally {
      binding.releasing = false
      pruneRefTokens()
    }
  }
  const releaseResizeTarget = (
    binding: ResizeBinding,
    target: ResizeTarget,
  ) => {
    if (
      !target.retired ||
      target.observing > 0 ||
      target.releasing ||
      binding.registering ||
      !binding.observer
    )
      return
    target.releasing = true
    binding.operations += 1
    try {
      const observer = binding.observer
      const unobserve = observer.unobserve
      if (target.retired && binding.observer === observer) {
        unobserve.call(observer, target.element)
        if (
          target.retired &&
          binding.targetStates.get(target.element) === target
        ) {
          binding.targetStates.delete(target.element)
          binding.targets.delete(target.element)
          reconcileObservedTargets()
        }
      }
    } finally {
      binding.operations -= 1
      target.releasing = false
      pruneRefTokens()
    }
    // A genuine replacement observe during unobserve waits until the old call
    // returns; it cannot be erased by that late unobserve's native side effect.
    if (
      target.deferredObserve &&
      !target.retired &&
      !binding.retired &&
      resizeBinding === binding
    ) {
      target.deferredObserve = false
      if (target.element instanceof HTMLElement) observeElement(target.element)
    }
  }
  const operateResizeBinding = (binding: ResizeBinding, action: () => void) => {
    binding.operations += 1
    let failed = false
    let firstCause: unknown
    try {
      action()
    } catch (cause) {
      producerAuthority.recordFailure(
        cause,
        'resize-operation',
        binding.observer,
      )
      failed = true
      firstCause = cause
    } finally {
      binding.operations -= 1
    }
    if (!binding.retired && resizeBinding === binding && !disposed) {
      for (const target of [...binding.targetStates.values()]) {
        if (!target.retired) continue
        try {
          releaseResizeTarget(binding, target)
        } catch (cause) {
          producerAuthority.recordFailure(
            cause,
            'resize-target-late-release',
            target.element,
          )
          if (!failed) firstCause = cause
          failed = true
        }
      }
    }
    if (binding.retired || resizeBinding !== binding || disposed) {
      try {
        releaseResizeBinding(binding)
      } catch (cause) {
        producerAuthority.recordFailure(
          cause,
          'resize-late-release',
          binding.observer,
        )
        if (!failed) firstCause = cause
        failed = true
      }
    }
    pruneRefTokens()
    if (failed) throw firstCause
  }
  const unobserveElement = (element: Element, current: () => boolean) => {
    const bindings = [...resizeBindings].filter((binding) =>
      binding.targets.has(element),
    )
    attemptRenderPipelineCleanup(
      producerAuthority,
      bindings.map((binding) => ({
        resource: binding.observer,
        action: () =>
          operateResizeBinding(binding, () => {
            if (!current()) return
            const target = binding.targetStates.get(element)
            if (!target) return
            target.retired = true
            releaseResizeTarget(binding, target)
          }),
      })),
    )
  }
  const drainDeferredResizeTargets = (binding: ResizeBinding) => {
    if (
      binding.drainingTargets ||
      binding.registering ||
      !binding.observer ||
      binding.retired ||
      binding !== resizeBinding ||
      paused ||
      disposed
    )
      return
    binding.drainingTargets = true
    try {
      attemptRenderPipelineCleanup(
        producerAuthority,
        [...binding.targetStates.values()]
          .filter(
            (target) =>
              target.deferredObserve && !target.retired && !target.releasing,
          )
          .map((target) => ({
            resource: target.element,
            action: () => {
              if (target.element instanceof HTMLElement)
                observeElement(target.element)
            },
          })),
      )
    } finally {
      binding.drainingTargets = false
    }
  }
  const observeElement = (element: HTMLElement) => {
    if (paused || disposed || !variableState) return
    const control = generation
    const key = variableState.elementKeys.get(element)
    if (key === undefined) return
    const refs = refGenerations.get(key)
    const desired = () => {
      return (
        key !== undefined && variableState.observedElements.get(key) === element
      )
    }
    const current = () =>
      !paused &&
      !disposed &&
      control === generation &&
      refs === refGenerations.get(key) &&
      desired()
    if (!current()) return
    if (!resizeBinding || resizeBinding.retired) {
      const observerEpoch = ++observerGeneration
      const binding: ResizeBinding = {
        observer: null,
        constructionTarget: element,
        targets: new Set(),
        targetStates: new Map(),
        registering: true,
        constructorStarted: false,
        operations: 0,
        releasing: false,
        retired: false,
        drainingTargets: false,
      }
      resizeBinding = binding
      resizeBindings.add(binding)
      const bindingCurrent = () =>
        !paused &&
        !disposed &&
        control === generation &&
        binding === resizeBinding &&
        !binding.retired
      let failed = false
      let firstCause: unknown
      try {
        const Observer = globalThis.ResizeObserver
        if (!bindingCurrent()) binding.retired = true
        else if (typeof Observer !== 'function') {
          resizeBindings.delete(binding)
          if (resizeBinding === binding) resizeBinding = null
        } else {
          binding.constructorStarted = true
          binding.observer = new Observer(
            trackObserverCallback(
              producerAuthority.boundary(
                (
                  entries: ResizeObserverEntry[],
                  reportedObserver: ResizeObserver,
                ) => {
                  // Retain a real callback-reported handle if construction threw or
                  // is still returning; no synthetic observer is manufactured.
                  if (
                    !binding.observer &&
                    binding.constructorStarted &&
                    reportedObserver
                  )
                    binding.observer = reportedObserver
                  if (
                    binding.retired ||
                    disposed ||
                    resizeBinding !== binding
                  ) {
                    try {
                      releaseResizeBinding(binding)
                    } catch (cause) {
                      producerAuthority.recordFailure(
                        cause,
                        'resize-callback-late-release',
                        binding.observer,
                      )
                    }
                    return
                  }
                  if (
                    binding.retired ||
                    binding.registering ||
                    binding !== resizeBinding ||
                    !binding.observer ||
                    paused ||
                    disposed ||
                    observerEpoch !== observerGeneration
                  )
                    return
                  const callbackControl = generation,
                    callbackInput = inputGeneration,
                    callbackUnits = unitsGeneration
                  const callbackCurrent = () =>
                    !paused &&
                    !disposed &&
                    !binding.retired &&
                    binding === resizeBinding &&
                    observerEpoch === observerGeneration &&
                    callbackControl === generation &&
                    callbackInput === inputGeneration &&
                    callbackUnits === unitsGeneration
                  for (const entry of entries) {
                    if (!callbackCurrent()) return
                    const target = entry.target
                    if (!callbackCurrent()) return
                    const key = variableState.elementKeys.get(target)
                    if (
                      !key ||
                      variableState.observedElements.get(key) !== target
                    )
                      continue
                    const refs = refGenerations.get(key)
                    const size =
                      entry.borderBoxSize?.[0]?.blockSize ??
                      entry.contentRect.height ??
                      (target instanceof HTMLElement ? target.offsetHeight : 0)
                    if (
                      !callbackCurrent() ||
                      variableState.observedElements.get(key) !== target ||
                      refs !== refGenerations.get(key)
                    )
                      continue
                    queueMeasurement(key, size)
                  }
                },
              ),
            ),
          )
        }
      } catch (cause) {
        producerAuthority.recordFailure(cause, 'resize-constructor', element)
        failed = true
        firstCause = cause
        binding.retired = true
      } finally {
        binding.registering = false
      }
      if (!binding.constructorStarted) {
        resizeBindings.delete(binding)
        if (resizeBinding === binding) resizeBinding = null
      }
      if (!bindingCurrent()) {
        try {
          releaseResizeBinding(binding)
        } catch (cause) {
          producerAuthority.recordFailure(
            cause,
            'resize-constructor-late-release',
            binding.observer,
          )
          if (!failed) firstCause = cause
          failed = true
        }
      } else if (binding.observer) {
        resizeObserver = binding.observer
        binding.constructionTarget = null
      }
      if (failed) throw firstCause
    }
    const binding = resizeBinding
    if (!binding || binding.retired) return
    if (!current()) {
      drainDeferredResizeTargets(binding)
      return
    }
    let target = binding.targetStates.get(element)
    if (!target) {
      target = {
        element,
        observing: 0,
        releasing: false,
        retired: false,
        deferredObserve: false,
      }
      binding.targetStates.set(element, target)
    }
    target.retired = false
    binding.targets.add(element)
    reconcileObservedTargets()
    if (target.releasing || binding.registering || !binding.observer) {
      target.deferredObserve = true
      return
    }
    target.deferredObserve = false
    const ownedTarget = target
    try {
      operateResizeBinding(binding, () => {
        ownedTarget.observing += 1
        try {
          const observer = binding.observer!
          const observe = observer.observe
          if (
            !current() ||
            binding !== resizeBinding ||
            binding.retired ||
            ownedTarget.retired ||
            resizeObserver !== observer
          )
            return
          observe.call(observer, element)
          if (
            !current() ||
            binding !== resizeBinding ||
            binding.retired ||
            resizeObserver !== observer
          )
            return
        } finally {
          ownedTarget.observing -= 1
        }
      })
    } finally {
      drainDeferredResizeTargets(binding)
    }
  }

  const setUnitRef = (key: string, element: Element | null) => {
    if (disposed || !variableState) return
    const previousElement = variableState.observedElements.get(key)
    if (previousElement === element || (!previousElement && element === null))
      return
    const refs: RefToken = { key, elements: new Set<Element>(), inFlight: 1 }
    if (previousElement) refs.elements.add(previousElement)
    if (element) refs.elements.add(element)
    refTokens.add(refs)
    refGenerations.set(key, refs)
    try {
      const control = generation,
        input = inputGeneration,
        units = unitsGeneration
      const current = () =>
        !disposed && refs === refGenerations.get(key) && control === generation
      variableState.pendingMeasurements.delete(key)
      if (previousElement) {
        unobserveElement(previousElement, current)
        if (
          !current() ||
          variableState.observedElements.get(key) !== previousElement
        )
          return
        variableState.elementKeys.delete(previousElement)
        variableState.observedElements.delete(key)
      }
      if (
        !current() ||
        !(element instanceof HTMLElement) ||
        !variableState.keyToIndex.has(key)
      )
        return
      const previousKey = variableState.elementKeys.get(element)
      if (previousKey && previousKey !== key) {
        variableState.observedElements.delete(previousKey)
        variableState.pendingMeasurements.delete(previousKey)
      }
      variableState.observedElements.set(key, element)
      variableState.elementKeys.set(element, key)
      const height = element.offsetHeight
      if (!current() || variableState.observedElements.get(key) !== element)
        return
      if (input === inputGeneration && units === unitsGeneration)
        queueMeasurement(key, height)
      if (!current() || variableState.observedElements.get(key) !== element)
        return
      observeElement(element)
      if (!current() || variableState.observedElements.get(key) !== element)
        return
    } finally {
      refs.inFlight -= 1
      pruneRefTokens()
    }
  }

  const syncUnits = (nextUnits: readonly TUnit[]) => {
    if (disposed || !variableState) return
    const syncGeneration = ++unitsGeneration
    const syncInput = inputGeneration
    const syncControl = generation
    const current = () =>
      !disposed &&
      syncGeneration === unitsGeneration &&
      syncInput === inputGeneration &&
      syncControl === generation
    const previousStart = range.value.start
    if (!current()) return
    const anchorKey = variableState.keys[previousStart]
    const anchorDelta = scrollOffset.value - offsetForIndex(previousStart)
    const nextKeys: string[] = []
    const seen = new Set<string>()
    for (let index = 0; index < nextUnits.length; index += 1) {
      const unit = nextUnits[index]
      if (unit === undefined) continue
      const key = options.getKey(unit, index)
      if (!current()) return
      if (seen.has(key)) {
        throw new Error(`useFsusVirtualWindow requires unique keys: ${key}`)
      }
      seen.add(key)
      nextKeys.push(key)
    }

    const sharedLength = Math.min(variableState.keys.length, nextKeys.length)
    let prefixMatches = true
    for (let index = 0; index < sharedLength; index += 1) {
      if (variableState.keys[index] !== nextKeys[index]) {
        prefixMatches = false
        break
      }
    }

    if (prefixMatches && nextKeys.length >= variableState.keys.length) {
      for (let index = 0; index < sharedLength; index += 1) {
        const unit = nextUnits[index]
        if (unit === undefined) continue
        const estimate = positive(options.estimateSize(unit, index), 1)
        if (!current()) return
        variableState.estimatedSizes[index] = estimate
        if (!variableState.measuredSizes.has(nextKeys[index] ?? '')) {
          variableState.index.update(index, estimate)
        }
      }
      for (
        let index = variableState.keys.length;
        index < nextKeys.length;
        index += 1
      ) {
        const unit = nextUnits[index]
        const key = nextKeys[index]
        if (unit === undefined || key === undefined) continue
        const estimate = positive(options.estimateSize(unit, index), 1)
        if (!current()) return
        variableState.keys.push(key)
        variableState.keyToIndex.set(key, index)
        variableState.estimatedSizes.push(estimate)
        variableState.index.append(estimate)
      }
    } else if (prefixMatches) {
      for (let index = 0; index < sharedLength; index += 1) {
        const unit = nextUnits[index]
        if (unit === undefined) continue
        const estimate = positive(options.estimateSize(unit, index), 1)
        if (!current()) return
        variableState.estimatedSizes[index] = estimate
        if (!variableState.measuredSizes.has(nextKeys[index] ?? '')) {
          variableState.index.update(index, estimate)
        }
      }
      for (
        let index = nextKeys.length;
        index < variableState.keys.length;
        index += 1
      ) {
        const key = variableState.keys[index]
        if (!key) continue
        const element = variableState.observedElements.get(key)
        if (element) {
          const observer = resizeObserver
          const refs = refGenerations.get(key)
          unobserveElement(element, current)
          if (
            !current() ||
            resizeObserver !== observer ||
            refs !== refGenerations.get(key) ||
            variableState.observedElements.get(key) !== element
          )
            return
          observedTargets.delete(element)
          variableState.elementKeys.delete(element)
        }
        variableState.observedElements.delete(key)
        variableState.pendingMeasurements.delete(key)
        variableState.measuredSizes.delete(key)
        variableState.keyToIndex.delete(key)
        pruneRefTokens()
      }
      variableState.keys.length = nextKeys.length
      variableState.estimatedSizes.length = nextKeys.length
      variableState.index.truncate(nextKeys.length)
    } else {
      for (const [key, element] of variableState.observedElements) {
        if (seen.has(key)) continue
        const observer = resizeObserver
        const refs = refGenerations.get(key)
        unobserveElement(element, current)
        if (
          !current() ||
          resizeObserver !== observer ||
          refs !== refGenerations.get(key) ||
          variableState.observedElements.get(key) !== element
        )
          return
        observedTargets.delete(element)
        variableState.elementKeys.delete(element)
        variableState.observedElements.delete(key)
        variableState.pendingMeasurements.delete(key)
        pruneRefTokens()
      }
      for (const key of variableState.measuredSizes.keys()) {
        if (!seen.has(key)) variableState.measuredSizes.delete(key)
      }

      const estimates: number[] = []
      const values: number[] = []
      const keyToIndex = new Map<string, number>()
      for (let index = 0; index < nextUnits.length; index += 1) {
        const unit = nextUnits[index]
        const key = nextKeys[index]
        if (unit === undefined || key === undefined) continue
        const estimate = positive(options.estimateSize(unit, index), 1)
        if (!current()) return
        estimates.push(estimate)
        values.push(variableState.measuredSizes.get(key) ?? estimate)
        keyToIndex.set(key, index)
      }
      variableState.keys = nextKeys
      variableState.keyToIndex = keyToIndex
      variableState.estimatedSizes = estimates
      variableState.index.rebuild(values)
      emitDiagnostic({ reason: 'insert-or-reorder', type: 'index-rebuild' })
      if (!current()) return
    }

    if (!current()) return
    indexVersion.value += 1
    if (!current()) return
    if (anchorKey) {
      const nextAnchorIndex = variableState.keyToIndex.get(anchorKey)
      if (nextAnchorIndex !== undefined) {
        const nextOffset = offsetForIndex(nextAnchorIndex) + anchorDelta
        const correction = nextOffset - scrollOffset.value
        if (Math.abs(correction) > 0.5) {
          setViewportScrollTop(viewport, nextOffset)
          if (!current()) return
          scrollOffset.value = nextOffset
          emitDiagnostic({
            correction,
            reason: 'units',
            type: 'scroll-correction',
          })
        }
      }
    }
    if (current() && !paused) afterViewportTick(readViewport)
  }

  const attachListeners = (target: FsusViewport | null) => {
    connected = true
    listenerViewport = target
    resizeTarget =
      target && isWindowViewport(target)
        ? target
        : typeof window !== 'undefined'
          ? window
          : null
    const connection = connectionGeneration
    const bind = (
      bindingTarget: FsusViewport | null,
      type: ViewportBinding['type'],
    ) => {
      if (
        !bindingTarget ||
        paused ||
        disposed ||
        connection !== connectionGeneration
      )
        return
      const binding: ViewportBinding = {
        target: bindingTarget,
        type,
        installed: false,
        registering: true,
        retired: false,
        listener: producerAuthority.boundary(() => {
          if (!binding.retired && connection === connectionGeneration)
            scheduleViewportRead()
        }),
      }
      viewportBindings.add(binding)
      let registrationFailed = false
      let firstRegistrationCause: unknown
      try {
        bindingTarget.addEventListener(
          type,
          binding.listener,
          type === 'scroll' ? { passive: true } : undefined,
        )
        binding.installed = true
      } catch (cause) {
        producerAuthority.recordFailure(
          cause,
          'viewport-listener-registration',
          binding.target,
        )
        registrationFailed = true
        firstRegistrationCause = cause
      } finally {
        binding.registering = false
      }
      // Reentrant retirement cannot drop a registration whose add was in-flight.
      if (binding.retired || connection !== connectionGeneration) {
        binding.retired = true
        try {
          binding.target.removeEventListener(binding.type, binding.listener)
          viewportBindings.delete(binding)
        } catch (cause) {
          producerAuthority.recordFailure(
            cause,
            'viewport-listener-release',
            binding.target,
          )
          if (!registrationFailed) firstRegistrationCause = cause
          registrationFailed = true
        }
      }
      if (registrationFailed) throw firstRegistrationCause
    }
    bind(target, 'scroll')
    bind(resizeTarget, 'resize')
  }
  const disconnect = () => {
    const connection = ++connectionGeneration
    connected = false
    const bindings = [...viewportBindings]
    for (const binding of bindings) binding.retired = true
    try {
      attemptRenderPipelineCleanup(
        producerAuthority,
        bindings.map((binding) => ({
          resource: binding.target,
          action: () => {
            if (binding.registering) return
            binding.target.removeEventListener(binding.type, binding.listener)
            viewportBindings.delete(binding)
          },
        })),
      )
    } finally {
      if (connection === connectionGeneration) {
        listenerViewport = null
        resizeTarget = null
        viewport = null
      }
    }
  }
  const connect = () => {
    if (paused || disposed) return
    disconnect()
    const connectGeneration = generation
    const connectInput = inputGeneration
    const connection = connectionGeneration
    const nextViewport = options.getViewport()
    if (
      paused ||
      disposed ||
      connectGeneration !== generation ||
      connectInput !== inputGeneration ||
      connection !== connectionGeneration
    )
      return
    viewport = nextViewport
    attachListeners(viewport)
    readViewport()
  }
  const inspectResources = () =>
    Object.freeze({
      paused,
      disposed,
      authorityFeed: producerAuthority.inspect(),
      ...callbacks.inspect(),
      scrollFrame: scrollFrame !== null && callbacks.isPending(scrollFrame),
      measurementFrame:
        measurementFrame !== null && callbacks.isPending(measurementFrame),
      observers: new Set(
        [...resizeBindings].flatMap((binding) =>
          binding.observer ? [binding.observer] : [],
        ),
      ).size,
      observerRegistrations: Object.freeze(
        [...resizeBindings].map((binding) =>
          Object.freeze({
            hasHandle: binding.observer !== null,
            registering: binding.registering,
            constructorStarted: binding.constructorStarted,
            operations: binding.operations,
            releasing: binding.releasing,
            retired: binding.retired,
            retainedTargets: binding.targets.size,
            targetRegistrations: Object.freeze(
              [...binding.targetStates.values()].map((target) =>
                Object.freeze({
                  element: target.element,
                  observing: target.observing,
                  releasing: target.releasing,
                  retired: target.retired,
                  deferredObserve: target.deferredObserve,
                }),
              ),
            ),
          }),
        ),
      ),
      unknownObserverRegistrations: [...resizeBindings].filter(
        (binding) => !binding.observer,
      ).length,
      observedElements: observedTargets.size,
      retainedElements: variableState?.observedElements.size ?? 0,
      pendingMeasurements: variableState?.pendingMeasurements.size ?? 0,
      measuredSizes: variableState?.measuredSizes.size ?? 0,
      indexedUnits: variableState?.keys.length ?? 0,
      pendingViewportTicks: viewportJobs.size,
      retainedListeners: viewportBindings.size,
      listenerRegistrations: Object.freeze(
        [...viewportBindings].map((binding) =>
          Object.freeze({
            target: binding.target,
            type: binding.type,
            installed: binding.installed,
            registering: binding.registering,
            retired: binding.retired,
          }),
        ),
      ),
      retainedUnitWatchers: stopUnitsWatch ? 1 : 0,
      retainedRefTokens: refTokens.size,
      currentRefKeys: refGenerations.size,
      inFlightRefOperations: [...refTokens].reduce(
        (count, token) => count + token.inFlight,
        0,
      ),
      refTokenRecords: Object.freeze(
        [...refTokens].map((token) =>
          Object.freeze({
            key: token.key,
            current: refGenerations.get(token.key) === token,
            inFlight: token.inFlight,
            retainedElements: token.elements.size,
          }),
        ),
      ),
      // ResizeObserver's platform-internal queue is not exposed by this source.
      observerInternalCallbacks: 'unknown' as const,
      observerCallbackResources: Object.freeze({
        scope: 'virtual-source-delivered-callbacks' as const,
        activeCallbacks: observerCallbacks.size,
        callbackIds: Object.freeze([...observerCallbacks]),
        settlement: 'source-callback-finally' as const,
        futurePlatformDelivery: 'unsupported-until-source-entry' as const,
        internalQueueControl: 'unsupported' as const,
      }),
      recoverable: false as const,
    })
  const pause = () => {
    if (!paused) {
      paused = true
      generation += 1
    }
    observerGeneration += 1
    const pauseGeneration = generation
    const current = () => disposed || (paused && pauseGeneration === generation)
    const observers = [...resizeBindings]
    for (const binding of observers) binding.retired = true
    const watchStop = stopUnitsWatch
    attemptRenderPipelineCleanup(producerAuthority, [
      {
        resource: Object.freeze(
          [...viewportBindings].map((binding) => binding.target),
        ),
        action: () => {
          if (current()) disconnect()
        },
      },
      {
        resource: callbacks,
        action: () => {
          callbacks.cancelAll(current)
          if (current()) {
            if (scrollFrame && !callbacks.isPending(scrollFrame))
              scrollFrame = null
            if (measurementFrame && !callbacks.isPending(measurementFrame))
              measurementFrame = null
          }
        },
      },
      ...observers.map((binding) => ({
        resource: binding.observer,
        action: () => {
          if (current()) releaseResizeBinding(binding)
        },
      })),
      {
        resource: watchStop,
        action: () => {
          if (disposed && watchStop) {
            watchStop()
            if (stopUnitsWatch === watchStop) stopUnitsWatch = null
          }
        },
      },
      {
        resource: variableState,
        action: () => {
          if (!current()) return
          variableState?.pendingMeasurements.clear()
          if (disposed && resizeBindings.size === 0 && variableState) {
            variableState.observedElements.clear()
            variableState.elementKeys = new WeakMap<Element, string>()
            variableState.measuredSizes.clear()
            pruneRefTokens()
          }
        },
      },
    ])
    return inspectResources()
  }
  const resume = () => {
    if (disposed) throw new Error('fsus_virtual_window_disposed')
    if (paused) {
      pause()
      if (disposed || !paused) return inspectResources()
      paused = false
      const resumeGeneration = ++generation
      connect()
      for (const [key, element] of variableState?.observedElements ?? []) {
        if (paused || disposed || resumeGeneration !== generation) break
        const input = inputGeneration,
          units = unitsGeneration,
          refs = refGenerations.get(key)
        const height = element.offsetHeight
        if (
          paused ||
          disposed ||
          resumeGeneration !== generation ||
          input !== inputGeneration ||
          units !== unitsGeneration
        )
          break
        if (
          refs !== refGenerations.get(key) ||
          variableState?.observedElements.get(key) !== element
        )
          continue
        queueMeasurement(key, height)
        if (
          paused ||
          disposed ||
          resumeGeneration !== generation ||
          input !== inputGeneration ||
          units !== unitsGeneration
        )
          break
        if (
          refs !== refGenerations.get(key) ||
          variableState?.observedElements.get(key) !== element
        )
          continue
        observeElement(element)
      }
    }
    return inspectResources()
  }
  try {
    onMounted(
      producerAuthority.boundary(() => {
        afterViewportTick(connect)
      }),
    )

    stopUnitsWatch = watch(
      options.units,
      producerAuthority.boundary(syncUnits),
      {
        flush: 'sync',
      },
    )
    assertInitializationCurrent()
  } catch (cause) {
    disposed = true
    try {
      pause()
    } catch (cleanupCause) {
      producerAuthority.recordFailure(
        cleanupCause,
        'virtual-setup-cleanup',
        options,
      )
    }
    producerAuthority.recordFailure(cause, 'virtual-setup', options)
    producerAuthority.close()
    throw cause
  }

  onBeforeUnmount(
    producerAuthority.boundary(() => {
      disposed = true
      try {
        pause()
      } finally {
        producerAuthority.close()
      }
    }),
  )

  const observerResourceProvider = Object.freeze({
    scope: 'virtual-local-observer-resources' as const,
    authority: producerAuthority.authority,
    inspectResources: producerAuthority.boundary(inspectResources),
    pause: producerAuthority.boundary(pause),
    resume: producerAuthority.boundary(resume),
    unsupported: Object.freeze([
      'platform-internal-observer-queue',
      'future-callback-delivery-before-source-entry',
    ] as const),
  })
  return {
    authority: producerAuthority.authority,
    observerResourceProvider,
    inspectResources: producerAuthority.boundary(inspectResources),
    pause: producerAuthority.boundary(pause),
    resume: producerAuthority.boundary(resume),
    bottomSpacer,
    connect: producerAuthority.boundary(connect),
    readViewport: producerAuthority.boundary(readViewport),
    range,
    scrollOffset,
    setUnitRef: producerAuthority.boundary(setUnitRef),
    topSpacer,
    totalSize,
    viewportSize,
    visibleItems,
  }
}

let renderPipelineRuntimeId = 0

export const useFsusRenderPipelineRuntime = <TSource, TUnit>(
  options: FsusRenderPipelineRuntimeOptions<TSource, TUnit>,
): FsusRenderPipelineRuntimeState<TSource, TUnit> => {
  const producerAuthority = createRenderPipelineProducerAuthority()
  producerAuthority.change(() => {
    producerAuthority.retainDependency(
      options.sourceAuthority,
      'external-source-authority',
    )
    producerAuthority.retainDependency(
      options.adapterAuthority,
      'external-adapter-authority',
    )
  })
  producerAuthority.retainDependency(
    renderPipelineModuleAuthority.authority,
    'module-registry-authority',
  )
  producerAuthority.change(() => {
    producerAuthority.retainDependency(
      getFsusRenderPipelineComponentPolicyAuthority(),
      'component-policy-authority',
    )
    retainRenderPipelineConfigAuthority(producerAuthority, options.config)
  })

  const documentRef = shallowRef<FsusRenderPipelineDocument<TUnit> | null>(null)
  const error = shallowRef<FsusErrorDetail | null>(null)
  const diagnostics = shallowRef<readonly FsusRenderPipelineDiagnosticEvent[]>(
    [],
  )
  const loading = ref(false)
  const renderedStrategy = shallowRef<FsusRenderPipelineStrategy>('sync')
  let taskId = 0
  let paused = false
  let disposed = false
  let workerUsed = false
  let preservedWorkerTask = false
  let renderRequestedWhilePaused = false
  let controlTransition = Symbol('initial-control')
  const controlTransitions = new Set<symbol>()
  const callbacks = createRenderPipelineCallbackResources(producerAuthority)
  const waits = new Set<() => void>()
  const renders = new Set<symbol>()
  const adapterJobs = new Set<symbol>()
  const workerTaskKey = `render-runtime-${++renderPipelineRuntimeId}`
  let workerCallbackFailure: FsusRenderPipelineRuntimeResourceInspection['workerCallbackFailure'] =
    null
  let pendingWorkerCallbackFailureNotification: FsusRenderPipelineRuntimeResourceInspection['workerCallbackFailure'] =
    null
  let publishedWorkerCallbackFailureCount = 0
  let publishingWorkerCallbackFailure = false
  const recordWorkerCallbackFailure = (
    event: {
      type: FsusWorkerExecutorEvent['type'] | 'unknown'
      workerId?: number
    },
    cause: unknown,
    phase: NonNullable<
      FsusRenderPipelineRuntimeResourceInspection['workerCallbackFailure']
    >['phase'],
  ) => {
    // Plain owned state: reporting must not invoke another callback mid-cleanup.
    workerCallbackFailure = Object.freeze({
      count: (workerCallbackFailure?.count ?? 0) + 1,
      error: createFsusError(
        'infra',
        'fsus_render_pipeline_worker_callback_failed',
        {
          cause,
        },
      ),
      eventType: event.type,
      phase,
      workerId: event.workerId ?? null,
    })
    // Notification failures stay diagnostic; only source failures need delivery.
    if (phase !== 'error-notification')
      pendingWorkerCallbackFailureNotification = workerCallbackFailure
  }
  const invokeWorkerCallback = (
    callback: ((event: FsusWorkerExecutorEvent) => void) | undefined,
    event: FsusWorkerExecutorEvent,
    phase: 'adapter-event' | 'runtime-event',
  ) => {
    let identity: {
      type: FsusWorkerExecutorEvent['type'] | 'unknown'
      workerId?: number
    } = { type: 'unknown' }
    try {
      // Capture metadata before user code can mutate the shared event object.
      identity = { type: event.type, workerId: event.workerId }
      callback?.(event)
    } catch (cause) {
      // Let the original executor finish all slot/task cleanup and settlement.
      recordWorkerCallbackFailure(identity, cause, phase)
    }
  }
  const publishWorkerCallbackFailure = () => {
    const failure = pendingWorkerCallbackFailureNotification
    if (
      !failure ||
      publishingWorkerCallbackFailure ||
      failure.count <= publishedWorkerCallbackFailureCount
    )
      return
    publishingWorkerCallbackFailure = true
    try {
      error.value = failure.error
    } catch (cause) {
      recordWorkerCallbackFailure(
        { type: failure.eventType, workerId: failure.workerId ?? undefined },
        cause,
        'error-notification',
      )
    } finally {
      // Mark only the attempted snapshot; reentrant source failures stay pending.
      publishedWorkerCallbackFailureCount = failure.count
      if (pendingWorkerCallbackFailureNotification === failure)
        pendingWorkerCallbackFailureNotification = null
      publishingWorkerCallbackFailure = false
    }
  }
  let controller: AbortController | null = null
  type RuntimeWorkerExecutor = ReturnType<
    typeof createFsusWorkerExecutor<
      TSource,
      FsusRenderPipelineDocument<TUnit> | null
    >
  >
  let workerExecutor: RuntimeWorkerExecutor | null = null
  let workerExecutorAdapter: FsusRenderPipelineAdapter<TSource, TUnit> | null =
    null
  let workerExecutorShared = false
  let workerExecutorSharedCleanup: (() => void) | null = null
  let workerExecutorPauseListener: (() => void) | null = null
  let workerExecutorResumeListener: (() => void) | null = null
  let workerExecutorListenerActive = false
  let workerExecutorInspectSubscription:
    | (() => { retainedOwner: boolean; listenerActive: boolean })
    | null = null
  let workerExecutorInspectRegistry:
    | (() => FsusSharedWorkerRegistryInspection)
    | null = null
  type WorkerScopeRecord = {
    executor: RuntimeWorkerExecutor
    scope: FsusWorkerTaskScope
    inspectRegistry: (() => FsusSharedWorkerRegistryInspection) | null
    sharedPool: boolean
    settled: boolean
    lastControl: FsusRenderPipelineRuntimeResourceInspection['workerResources']['scopes'][number]['lastControl']
  }
  const workerScopes = new Set<WorkerScopeRecord>()
  const retiringExecutors = new Set<{
    executor: RuntimeWorkerExecutor | null
    shared: boolean
    retainedOwner: boolean
    listenerActive: boolean
    inspectRegistry: (() => FsusSharedWorkerRegistryInspection) | null
    inspectSubscription:
      | (() => { retainedOwner: boolean; listenerActive: boolean })
      | null
  }>()
  const workerAuthorityCanRelease = (executor: RuntimeWorkerExecutor) => {
    if (workerExecutor === executor) return false
    if ([...retiringExecutors].some((entry) => entry.executor === executor))
      return false
    for (const record of workerScopes) {
      if (record.executor !== executor) continue
      if (!record.settled) return false
      const resources = executor.inspectResources(record.scope)
      if (
        resources.tasks.length ||
        resources.pendingCount ||
        resources.activeCount ||
        resources.resources.abortListenerCount ||
        resources.resources.cancelTimeoutCount ||
        resources.resources.requestTimeoutCount
      )
        return false
    }
    return true
  }
  const controlWorkerScope = (
    record: WorkerScopeRecord,
    operation: 'suspend' | 'cancel' | 'resume',
    isCurrent: () => boolean = () => true,
  ) => {
    const result =
      operation === 'suspend'
        ? record.executor.suspendTasks(record.scope)
        : operation === 'resume'
          ? record.executor.resumeTasks(record.scope)
          : record.executor.cancelTasks(record.scope, { hardCancel: false })
    if (isCurrent()) {
      record.lastControl = Object.freeze({
        operation,
        status: result.status,
        affectedTaskIds: Object.freeze([...result.affectedTaskIds]),
        unavailableTaskIds: Object.freeze([...result.unavailableTaskIds]),
      })
    }
    return result.inspection
  }
  const inspectWorkerResources =
    (): FsusRenderPipelineRuntimeResourceInspection['workerResources'] => {
      const scopes: FsusRenderPipelineRuntimeResourceInspection['workerResources']['scopes'][number][] =
        []
      const pools = new Map<
        RuntimeWorkerExecutor,
        FsusRenderPipelineRuntimeResourceInspection['workerResources']['pools'][number]
      >()
      for (const record of workerScopes) {
        const { pool, shared, ...inspection } =
          record.executor.inspectResources(record.scope)
        pools.set(record.executor, {
          mode: record.sharedPool ? 'shared' : 'runtime',
          pool,
          shared,
          disposed: inspection.disposed,
          registry: record.inspectRegistry?.() ?? null,
        })
        if (record.settled && inspection.tasks.length === 0) {
          workerScopes.delete(record)
          continue
        }
        scopes.push(
          Object.freeze({ inspection, lastControl: record.lastControl }),
        )
      }
      for (const retired of retiringExecutors) {
        if (!retired.executor || pools.has(retired.executor)) continue
        const inspection = retired.executor.inspectResources()
        pools.set(retired.executor, {
          mode: retired.shared ? 'shared' : 'runtime',
          pool: inspection.pool,
          shared: inspection.shared,
          disposed: inspection.disposed,
          registry: retired.inspectRegistry?.() ?? null,
        })
      }
      if (workerExecutor && !pools.has(workerExecutor)) {
        const inspection = workerExecutor.inspectResources()
        pools.set(workerExecutor, {
          mode: workerExecutorShared ? 'shared' : 'runtime',
          pool: inspection.pool,
          shared: inspection.shared,
          disposed: inspection.disposed,
          registry: workerExecutorInspectRegistry?.() ?? null,
        })
      }
      return Object.freeze({
        status: workerUsed ? 'available' : 'not-created',
        scopes: Object.freeze(scopes),
        pools: Object.freeze([...pools.values()]),
      })
    }
  const ownedQueueDepth = () => {
    let depth = 0
    for (const record of workerScopes) {
      const inspection = record.executor.inspectResources(record.scope)
      depth += inspection.queueDepth
      if (record.settled && inspection.tasks.length === 0)
        workerScopes.delete(record)
    }
    return depth
  }
  const adaptiveSignals = shallowRef<FsusRenderPipelineAdaptiveSignals>({})
  const stageHistory = createFsusRenderStageHistory()

  const isCurrentNotification = () => {
    const generation = taskId
    const transition = controlTransition
    return producerAuthority.boundary(
      () =>
        generation === taskId &&
        transition === controlTransition &&
        !paused &&
        !disposed,
    )
  }
  const recordStage = (
    stage: FsusRenderPipelineStage,
    durationMs: number,
    strategy: FsusRenderPipelineStrategy,
  ) => {
    const isCurrent = isCurrentNotification()
    if (!isCurrent()) return
    stageHistory.record(stage, durationMs)
    const stageStats = stageHistory.snapshot(stage)
    adaptiveSignals.value = {
      ...adaptiveSignals.value,
      stages: { ...adaptiveSignals.value.stages, [stage]: stageStats },
    }
    if (!isCurrent()) return
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
    const isCurrent = isCurrentNotification()
    if (!isCurrent()) return
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
    if (!isCurrent()) return
    diagnostics.value = [...diagnostics.value.slice(-31), nextEvent]
    if (!isCurrent()) return
    options.onDiagnostic?.(nextEvent)
    if (!isCurrent()) return
    emitFsusRenderPipelineDiagnostic(nextEvent, isCurrent)
  }

  const sourceRef = computed(
    producerAuthority.boundary(() => unref(options.source)),
  )

  const hardwareRuntime = useFsusRenderPipelineHardwareProfile(
    producerAuthority.change(() => options.config),
  )
  producerAuthority.retainDependency(
    hardwareRuntime.authority,
    'hardware-authority',
    () => {
      const resources = hardwareRuntime.inspectResources()
      return (
        resources.disposed &&
        resources.pendingBatteryQueries === 0 &&
        resources.rafHandles === 0 &&
        resources.retainedListeners === 0
      )
    },
  )
  const capabilityProfile = hardwareRuntime.capabilityProfile
  watch(
    capabilityProfile,
    producerAuthority.boundary((profile) => {
      strategyCache.invalidateProfile(profile.version)
      adaptiveSignals.value = {
        ...adaptiveSignals.value,
        rafDriftMs: profile.refreshProfile.rafDriftMs,
      }
    }),
    { immediate: true },
  )
  const config = computed(
    producerAuthority.boundary(() =>
      resolveFsusAdaptiveRenderPipelineConfig(
        hardwareRuntime.config.value,
        hardwareRuntime.profile.value,
        adaptiveSignals.value,
      ),
    ),
  )
  const hardwareProfile = hardwareRuntime.profile
  const compositor = computed(
    producerAuthority.boundary(() =>
      resolveFsusRenderPipelineCompositorEnabled(
        config.value,
        hardwareProfile.value,
      ),
    ),
  )
  const contentVisibility = computed(
    producerAuthority.boundary(() =>
      resolveFsusRenderPipelineContentVisibilityEnabled(
        config.value,
        hardwareProfile.value,
      ),
    ),
  )
  const hardwareAttrs = computed(
    producerAuthority.boundary(() =>
      resolveFsusRenderPipelineHardwareAttrs({
        compositor: compositor.value,
        contentVisibility: contentVisibility.value,
        hardwareProfile: hardwareProfile.value,
        layerBudget: config.value.acceleration.layerBudget,
      }),
    ),
  )

  const componentPolicy = computed<FsusRenderPipelineComponentPolicy | null>(
    producerAuthority.boundary(() => {
      const componentName = unref(options.componentName)?.trim()
      if (!componentName) return null
      return (
        getFsusRenderPipelineComponentPolicy(componentName) ??
        createFsusRenderPipelineComponentPolicy(componentName)
      )
    }),
  )

  const adapter = computed(
    producerAuthority.boundary(() => {
      const directAdapter = unref(options.adapter)
      if (directAdapter) return directAdapter

      const explicitAdapterId = unref(options.adapterId)?.trim()
      const policyAdapterId = componentPolicy.value?.adapterId?.trim()
      const adapterId = explicitAdapterId || policyAdapterId
      if (!adapterId) return null

      return getFsusRenderPipelineAdapter<TSource, TUnit>(adapterId) ?? null
    }),
  )

  const estimate = computed<FsusRenderPipelineEstimate>(
    producerAuthority.boundary(() => ({
      ...componentPolicy.value?.estimate,
      ...adapter.value?.estimate(sourceRef.value),
      ...unref(options.estimate),
    })),
  )

  const canUseWorker = computed(
    producerAuthority.boundary(
      () =>
        (adapter.value?.canUseWorker?.(sourceRef.value) ??
          !!adapter.value?.worker) &&
        !!adapter.value,
    ),
  )

  const policy = computed(
    producerAuthority.boundary(() => {
      const componentName = componentPolicy.value?.componentName
      if (!componentName) return null
      return resolveFsusRenderPipelineComponentPolicy(
        componentName,
        config.value,
        {
          canUseWorker: canUseWorker.value,
          estimate: estimate.value,
        },
      )
    }),
  )

  const strategyCacheKey = computed(
    producerAuthority.boundary(() =>
      createStrategyCacheKey({
        adapter: adapter.value,
        canUseWorker: canUseWorker.value,
        config: config.value,
        source: sourceRef.value,
      }),
    ),
  )

  const strategy = computed<FsusRenderPipelineStrategy>(
    producerAuthority.boundary(() => {
      const cached = getCachedStrategy(
        strategyCacheKey.value,
        capabilityProfile.value.version,
      )
      if (cached) return cached.strategy
      if (policy.value) return policy.value.strategy
      return chooseFsusRenderPipelineStrategy(
        estimate.value,
        config.value,
        canUseWorker.value,
      )
    }),
  )

  const clearWorkerExecutor = () => {
    const cleanup = workerExecutorSharedCleanup
    const retired = {
      executor: workerExecutor,
      shared: workerExecutorShared,
      retainedOwner: !!cleanup,
      listenerActive: workerExecutorListenerActive,
      inspectRegistry: workerExecutorInspectRegistry,
      inspectSubscription: workerExecutorInspectSubscription,
    }
    // Detach before callbacks: an old cleanup must never clear a new owner.
    workerExecutor = null
    workerExecutorAdapter = null
    workerExecutorShared = false
    workerExecutorSharedCleanup = null
    workerExecutorPauseListener = null
    workerExecutorResumeListener = null
    workerExecutorListenerActive = false
    workerExecutorInspectRegistry = null
    workerExecutorInspectSubscription = null
    retiringExecutors.add(retired)
    let completed = false
    try {
      cleanup?.()
      retired.retainedOwner = false
      retired.listenerActive = false
      if (retired.executor && !retired.shared) retired.executor.dispose()
      completed = true
    } finally {
      // A thrown callback does not prove cleanup completed.
      if (completed) {
        retiringExecutors.delete(retired)
        if (
          retired.executor &&
          'authority' in retired.executor &&
          retired.executor.authority &&
          typeof retired.executor.authority === 'object'
        )
          producerAuthority.releaseDependency(retired.executor.authority)
      }
    }
    publishWorkerCallbackFailure()
  }

  const getWorkerExecutor = (
    activeAdapter: FsusRenderPipelineAdapter<TSource, TUnit>,
    isCurrent: () => boolean,
  ) => {
    const workerOptions = activeAdapter.worker
    if (!workerOptions) return null
    workerUsed = true

    if (workerExecutor && workerExecutorAdapter === activeAdapter) {
      return workerExecutor
    }

    clearWorkerExecutor()
    if (!isCurrent()) return null
    workerExecutorAdapter = activeAdapter
    const workerEventListener = (event: FsusWorkerExecutorEvent) => {
      const eventTransition = controlTransition
      const isCurrent = () =>
        eventTransition === controlTransition &&
        !paused &&
        !disposed &&
        event.key === `${workerTaskKey}:${activeAdapter.id}` &&
        event.generation === taskId
      if (!isCurrent()) return
      recordDiagnostic({
        cloneBytes: event.cloneBytes,
        durationMs: event.durationMs,
        error: event.error,
        generation: event.generation,
        key: event.key,
        lane: event.lane,
        queueDepth: ownedQueueDepth(),
        queueWaitDurationMs: event.queueWaitDurationMs,
        retryCount: event.retryCount,
        strategy: renderedStrategy.value,
        type: event.type,
        // Shared slot counts cannot describe this renderer.
        workerCount: workerExecutorShared ? undefined : event.workerCount,
        workerId: event.workerId,
      })
      if (!isCurrent()) return
      adaptiveSignals.value = {
        ...adaptiveSignals.value,
        queueDepth: ownedQueueDepth(),
      }
      if (!isCurrent()) return
      if (event.type === 'request-resolve') {
        if (event.computeDurationMs !== undefined) {
          recordStage(
            'worker-compute',
            event.computeDurationMs,
            renderedStrategy.value,
          )
        }
        if (!isCurrent()) return
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
        listener: producerAuthority.boundary((event) =>
          invokeWorkerCallback(workerEventListener, event, 'runtime-event'),
        ),
        options: {
          ...executorOptions,
          onEvent: producerAuthority.boundary((event) =>
            invokeWorkerCallback(workerOptions.onEvent, event, 'adapter-event'),
          ),
        },
        poolKey:
          workerOptions.poolKey ?? workerOptions.name ?? activeAdapter.id,
      })
      producerAuthority.retainDependency(
        shared.authority,
        'shared-registry-authority',
      )
      workerExecutor = shared.executor
      producerAuthority.retainDependency(
        'authority' in workerExecutor ? workerExecutor.authority : undefined,
        'worker-authority',
        () => workerAuthorityCanRelease(shared.executor),
      )
      workerExecutorShared = true
      workerExecutorSharedCleanup = shared.cleanup
      workerExecutorPauseListener = shared.pauseListener
      workerExecutorResumeListener = shared.resumeListener
      workerExecutorListenerActive = true
      workerExecutorInspectRegistry = shared.inspectRegistry
      workerExecutorInspectSubscription = shared.inspectSubscription
      return workerExecutor
    }

    workerExecutor = createFsusWorkerExecutor<
      TSource,
      FsusRenderPipelineDocument<TUnit> | null
    >(workerOptions.createWorker, {
      ...executorOptions,
      onEvent: producerAuthority.boundary((event) => {
        invokeWorkerCallback(workerOptions.onEvent, event, 'adapter-event')
        invokeWorkerCallback(workerEventListener, event, 'runtime-event')
      }),
    })
    producerAuthority.retainDependency(
      'authority' in workerExecutor ? workerExecutor.authority : undefined,
      'worker-authority',
      (() => {
        const executor = workerExecutor
        return () => workerAuthorityCanRelease(executor)
      })(),
    )
    workerExecutorShared = false

    return workerExecutor
  }

  const waitForBoundary = (signal: AbortSignal, fallback: boolean) =>
    new Promise<void>((resolve) => {
      if (signal.aborted || paused || disposed) {
        resolve()
        return
      }
      let settled = false
      let cancel: (() => void) | null = null
      const complete = () => {
        if (settled) return
        settled = true
        cancel?.()
        signal.removeEventListener('abort', complete)
        waits.delete(complete)
        resolve()
      }
      waits.add(complete)
      signal.addEventListener('abort', complete, { once: true })
      try {
        if (fallback && typeof requestIdleCallback === 'function') {
          cancel = callbacks.idle(complete)
        } else if (typeof requestAnimationFrame === 'function') {
          cancel = callbacks.frame(() => {
            cancel = null
            if (fallback) cancel = callbacks.timeout(complete)
            else complete()
          })
        } else if (fallback) {
          cancel = callbacks.timeout(complete)
        } else complete()
      } catch (error) {
        complete()
        throw error
      }
    })
  const waitForWorkerFallbackBudget = (signal: AbortSignal) =>
    waitForBoundary(signal, true)

  const prepareAdapter = (
    activeAdapter: FsusRenderPipelineAdapter<TSource, TUnit>,
    input: TSource,
    signal: AbortSignal,
    activeStrategy: FsusRenderPipelineStrategy,
  ) => {
    const job = Symbol('adapter-prepare')
    adapterJobs.add(job)
    return fsusTryAsync(
      () => activeAdapter.prepare(input, signal, activeStrategy),
      'fsus_render_pipeline_prepare_failed',
      'infra',
    ).finally(producerAuthority.boundary(() => adapterJobs.delete(job)))
  }

  const prepareDocument = async (
    activeAdapter: FsusRenderPipelineAdapter<TSource, TUnit>,
    input: TSource,
    activeStrategy: FsusRenderPipelineStrategy,
    signal: AbortSignal,
    generation: number,
  ): Promise<FsusResult<FsusRenderPipelineDocument<TUnit>>> => {
    const isCurrentPreparation = () =>
      generation === taskId && !paused && !disposed && !signal.aborted
    if (!isCurrentPreparation()) {
      return fsusErr(
        createFsusError('infra', 'fsus_render_pipeline_prepare_paused'),
      )
    }
    if (activeStrategy === 'chunked-worker') {
      const executor = getWorkerExecutor(activeAdapter, isCurrentPreparation)

      if (!isCurrentPreparation()) {
        return fsusErr(
          createFsusError('infra', 'fsus_render_pipeline_prepare_paused'),
        )
      }
      if (executor) {
        const record: WorkerScopeRecord = {
          executor,
          scope: { generation, key: `${workerTaskKey}:${activeAdapter.id}` },
          inspectRegistry: workerExecutorInspectRegistry,
          sharedPool: workerExecutorShared,
          settled: false,
          lastControl: null,
        }
        workerScopes.add(record)
        let workerDocument: Awaited<ReturnType<typeof executor.run>>
        try {
          workerDocument = await executor.run(input, {
            ...record.scope,
            lane: 'throughput',
            signal,
          })
        } finally {
          record.settled = true
          if (executor.inspectResources(record.scope).tasks.length === 0)
            workerScopes.delete(record)
        }
        publishWorkerCallbackFailure()
        if (workerDocument.ok && workerDocument.value) {
          if (isCurrentPreparation()) renderedStrategy.value = 'chunked-worker'
          return fsusOk(workerDocument.value)
        }

        const workerError = isFsusOk(workerDocument)
          ? createFsusError(
              'protocol',
              'fsus_render_pipeline_worker_empty_result',
            )
          : workerDocument.error
        if (isCurrentPreparation()) {
          recordDiagnostic({
            error: workerError,
            fallbackReason: workerError.message,
            phase: 'prepare',
            strategy: 'chunked-worker',
            type: 'worker-fallback',
          })
          await waitForWorkerFallbackBudget(signal)
          if (!isCurrentPreparation()) return fsusErr(workerError)
          const fallbackDocument = await prepareAdapter(
            activeAdapter,
            input,
            signal,
            'chunked-main',
          )
          if (isFsusErr(fallbackDocument)) return fallbackDocument
          if (isCurrentPreparation()) renderedStrategy.value = 'chunked-main'
          return fallbackDocument
        }

        return fsusErr(workerError)
      }
    }

    const preparedDocument = await prepareAdapter(
      activeAdapter,
      input,
      signal,
      activeStrategy,
    )
    if (isFsusErr(preparedDocument)) return preparedDocument
    if (isCurrentPreparation()) renderedStrategy.value = activeStrategy
    return preparedDocument
  }

  const renderOnce = async () => {
    if (paused || disposed) return
    const currentTaskId = ++taskId
    const previousController = controller
    const renderController = new AbortController()
    controller = renderController
    const signal = renderController.signal
    const isCurrentRender = () =>
      currentTaskId === taskId &&
      controller === renderController &&
      !signal.aborted &&
      !paused &&
      !disposed
    previousController?.abort()
    if (!isCurrentRender()) return
    const input = sourceRef.value
    if (!isCurrentRender()) return
    const activeAdapter = adapter.value
    if (!isCurrentRender()) return
    const activeStrategy = strategy.value
    if (!isCurrentRender()) return
    const activeStrategyCacheKey = strategyCacheKey.value
    const activeStrategyCacheEntry = getCachedStrategy(
      activeStrategyCacheKey,
      capabilityProfile.value.version,
    )
    const startedAt = now()
    const queuedAt = startedAt

    if (!isCurrentRender()) return

    loading.value = true
    if (!isCurrentRender()) return
    error.value = null
    if (!isCurrentRender()) return
    renderedStrategy.value = activeStrategy
    if (!isCurrentRender()) return
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
    if (!isCurrentRender()) return
    recordStage('queue-wait', Math.max(0, now() - queuedAt), activeStrategy)
    if (!isCurrentRender()) return

    if (!activeAdapter) {
      const missingAdapterError = createFsusError(
        'invariant',
        'fsus_render_pipeline_adapter_missing',
      )
      error.value = missingAdapterError
      if (!isCurrentRender()) return
      documentRef.value = null
      if (!isCurrentRender()) return
      loading.value = false
      if (!isCurrentRender()) return
      recordDiagnostic({
        error: missingAdapterError,
        phase: 'prepare',
        strategy: activeStrategy,
        type: 'render-error',
      })
      return
    }

    const prepareStartedAt = now()
    const nextDocument = await prepareDocument(
      activeAdapter,
      input,
      activeStrategy,
      signal,
      currentTaskId,
    )
    if (!isCurrentRender()) {
      if (currentTaskId === taskId) loading.value = false
      return
    }

    recordStage('prepare', now() - prepareStartedAt, renderedStrategy.value)
    if (!isCurrentRender()) return
    if (isFsusOk(nextDocument)) {
      const commitStartedAt = now()
      documentRef.value = nextDocument.value
      await nextTick()
      if (!isCurrentRender()) return
      recordStage('vue-commit', now() - commitStartedAt, renderedStrategy.value)
      if (!isCurrentRender()) return
      const layoutStartedAt = now()
      await waitForBoundary(signal, false)
      if (!isCurrentRender()) return
      recordStage(
        'style-layout',
        now() - layoutStartedAt,
        renderedStrategy.value,
      )
      if (!isCurrentRender()) return
      const paintStartedAt = now()
      await waitForBoundary(signal, false)
      if (!isCurrentRender()) return
      recordStage('next-paint', now() - paintStartedAt, renderedStrategy.value)
      if (!isCurrentRender()) return
      const durationMs = now() - startedAt
      recordStage('total', durationMs, renderedStrategy.value)
      if (!isCurrentRender()) return
      setCachedStrategy(activeStrategyCacheKey, {
        durationMs,
        profileVersion: capabilityProfile.value.version,
        strategy: renderedStrategy.value,
      })
      adaptiveSignals.value = {
        ...adaptiveSignals.value,
        queueDepth: ownedQueueDepth(),
        renderDurationMs: durationMs,
      }
      if (!isCurrentRender()) return
      recordDiagnostic({
        durationMs,
        phase: 'commit',
        strategy: renderedStrategy.value,
        type: 'render-complete',
      })
    } else {
      const durationMs = now() - startedAt
      error.value = nextDocument.error
      if (!isCurrentRender()) return
      documentRef.value = null
      if (!isCurrentRender()) return
      adaptiveSignals.value = {
        ...adaptiveSignals.value,
        queueDepth: ownedQueueDepth(),
        renderDurationMs: durationMs,
      }
      if (!isCurrentRender()) return
      recordDiagnostic({
        durationMs,
        error: nextDocument.error,
        phase: 'commit',
        strategy: renderedStrategy.value,
        type: 'render-error',
      })
    }

    if (isCurrentRender()) {
      loading.value = false
    }
  }

  const inspectAdapterResources =
    (): FsusRenderPipelineAdapterInvocationResourceInspection =>
      Object.freeze({
        ownerKey: workerTaskKey,
        scope: 'runtime-owned-adapter-invocations',
        pendingInvocations: adapterJobs.size,
        invocationIds: Object.freeze([...adapterJobs]),
        admission: disposed ? 'disposed' : paused ? 'paused' : 'active',
        cancellationCapability: 'cooperative-abort-signal-only',
        internalCancellationCompletion: 'unsupported',
        settlement: 'original-prepare-finally',
        internalResources: 'unsupported',
      })
  const inspectResources = (): FsusRenderPipelineRuntimeResourceInspection =>
    Object.freeze({
      ownerKey: workerTaskKey,
      paused,
      disposed,
      authorityFeed: producerAuthority.inspect(),
      ...callbacks.inspect(),
      retainedListeners:
        waits.size +
        ((workerExecutorInspectSubscription?.().listenerActive ??
        workerExecutorListenerActive)
          ? 1
          : 0) +
        [...retiringExecutors].filter(
          (entry) =>
            entry.inspectSubscription?.().listenerActive ??
            entry.listenerActive,
        ).length,
      retainedSharedOwners:
        ((workerExecutorInspectSubscription?.().retainedOwner ??
        !!workerExecutorSharedCleanup)
          ? 1
          : 0) +
        [...retiringExecutors].filter(
          (entry) =>
            entry.inspectSubscription?.().retainedOwner ?? entry.retainedOwner,
        ).length,
      pendingRenders: renders.size,
      pendingRenderAdmissions: renderRequestedWhilePaused ? 1 : 0,
      pendingControlTransitions: controlTransitions.size,
      pendingAdapterJobs: adapterJobs.size,
      adapterResources: 'unknown',
      adapterInvocationResources: inspectAdapterResources(),
      workerCallbackFailure,
      pendingWorkerCallbackFailureNotification,
      workerResources: inspectWorkerResources(),
      hardware: hardwareRuntime.inspectResources(),
      recoverable: false,
    })
  const transitionControl = (
    operation: 'pause' | 'resume' | 'dispose',
    apply: (isCurrent: () => boolean) => void,
  ) => {
    const transition = Symbol(operation)
    controlTransition = transition
    controlTransitions.add(transition)
    try {
      apply(() => controlTransition === transition)
    } finally {
      controlTransitions.delete(transition)
    }
    publishWorkerCallbackFailure()
    return inspectResources()
  }
  const pause = () => {
    if (paused || disposed) return inspectResources()
    return transitionControl('pause', (isCurrent) => {
      paused = true
      preservedWorkerTask = false
      // Snapshot owned scopes; callbacks may admit an unrelated new generation.
      for (const record of [...workerScopes]) {
        const inspection = controlWorkerScope(record, 'suspend', isCurrent)
        if (!isCurrent()) return
        if (
          !renderRequestedWhilePaused &&
          record.scope.generation === taskId &&
          inspection.tasks.some(
            (task) =>
              task.state === 'suspended' && task.promiseState === 'pending',
          )
        )
          preservedWorkerTask = true
        if (
          inspection.tasks.some(
            (task) =>
              task.state === 'running' ||
              task.state === 'canceling' ||
              task.state === 'settling',
          )
        ) {
          controlWorkerScope(record, 'cancel', isCurrent)
          if (!isCurrent()) return
        }
      }
      if (!preservedWorkerTask) {
        taskId += 1
        const previousController = controller
        controller = null
        previousController?.abort()
        if (!isCurrent()) return
      }
      for (const settle of [...waits]) {
        settle()
        if (!isCurrent()) return
      }
      callbacks.cancelAll(isCurrent)
      if (!isCurrent()) return
      loading.value = false
      if (!isCurrent()) return
      hardwareRuntime.pause()
      if (!isCurrent()) return
      workerExecutorPauseListener?.()
      if (!isCurrent()) return
      workerExecutorListenerActive = false
    })
  }
  const resume = () => {
    if (disposed) throw new Error('fsus_render_pipeline_runtime_disposed')
    if (!paused) return inspectResources()
    return transitionControl('resume', (isCurrent) => {
      const resumeTaskId = taskId
      paused = false
      workerExecutorResumeListener?.()
      if (!isCurrent()) return
      workerExecutorListenerActive = !!workerExecutorSharedCleanup
      hardwareRuntime.resume()
      if (!isCurrent()) return
      if (renderRequestedWhilePaused) {
        preservedWorkerTask = false
        void render()
        return
      }
      if (taskId === resumeTaskId) {
        loading.value = preservedWorkerTask && renders.size > 0
        if (!isCurrent()) return
      }
      preservedWorkerTask = false
      for (const record of [...workerScopes]) {
        if (
          record.scope.generation === taskId &&
          record.executor.inspectResources(record.scope).resources
            .suspendedTaskCount > 0
        ) {
          controlWorkerScope(record, 'resume', isCurrent)
          if (!isCurrent()) return
        }
      }
    })
  }
  const render = producerAuthority.boundary(async () => {
    if (disposed) return
    if (paused) {
      // Coalesce intent, invalidate the suspended input, and admit latest source
      // only after resume. Its real cancellation resources remain in the census.
      renderRequestedWhilePaused = true
      preservedWorkerTask = false
      taskId += 1
      const previousController = controller
      controller = null
      previousController?.abort()
      return
    }
    renderRequestedWhilePaused = false
    const job = Symbol('render')
    const renderTaskId = taskId + 1
    renders.add(job)
    try {
      await renderOnce()
    } finally {
      renders.delete(job)
      if (taskId === renderTaskId) loading.value = false
    }
  })
  onBeforeUnmount(
    producerAuthority.boundary(() => {
      // Terminalize before abort/worker events can reenter render or resume.
      disposed = true
      try {
        transitionControl('dispose', (isCurrent) => {
          paused = true
          preservedWorkerTask = false
          renderRequestedWhilePaused = false
          taskId += 1
          const previousController = controller
          controller = null
          previousController?.abort()
          if (!isCurrent()) return
          for (const record of [...workerScopes]) {
            controlWorkerScope(record, 'cancel', isCurrent)
            if (!isCurrent()) return
          }
          for (const settle of [...waits]) {
            settle()
            if (!isCurrent()) return
          }
          callbacks.cancelAll(isCurrent)
          if (!isCurrent()) return
          loading.value = false
          if (!isCurrent()) return
          hardwareRuntime.pause()
          if (!isCurrent()) return
          clearWorkerExecutor()
        })
      } finally {
        producerAuthority.close()
      }
    }),
  )

  const adapterResourceProvider: FsusRenderPipelineAdapterResourceProvider =
    Object.freeze({
      ownerKey: workerTaskKey,
      authority: producerAuthority.authority,
      inspectResources: producerAuthority.boundary(inspectAdapterResources),
      pause: producerAuthority.boundary(pause),
      resume: producerAuthority.boundary(resume),
    })
  return {
    authority: producerAuthority.authority,
    adapterResourceProvider,
    inspectResources: producerAuthority.boundary(inspectResources),
    pause: producerAuthority.boundary(pause),
    resume: producerAuthority.boundary(resume),
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
