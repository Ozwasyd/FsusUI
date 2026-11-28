import type { ComputedRef, InjectionKey, MaybeRef, Ref } from 'vue'
import type {
  FsusErrorDetail,
  FsusRenderPipelineComponentPolicy,
} from './component-policies'
import type {
  FsusWorkerExecutorEventType,
  FsusWorkerExecutorOptions,
  FsusWorkerTaskLane,
} from './worker-pool'

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

export type FsusRenderStageStats = {
  ewmaMs: number
  p50Ms: number
  p95Ms: number
  sampleCount: number
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

export type FsusRenderPipelineStrategyCacheEntry = {
  durationMs?: number
  durationEwmaMs?: number
  expiresAt: number
  profileVersion?: string
  sampleCount: number
  strategy: FsusRenderPipelineStrategy
  updatedAt: number
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
    render: () => Promise<void>
    renderedStrategy: Ref<FsusRenderPipelineStrategy>
  }

export type FsusRenderPipelineContext = {
  chooseStrategy: (
    estimate: FsusRenderEstimate,
    config: FsusResolvedRenderPipelineConfig,
    canUseWorker?: boolean,
  ) => FsusRenderPipelineStrategy
  clearAdapters: () => void
  clearDiagnostics: () => void
  clearStrategyCache: () => void
  clearStrategyResolvers: () => void
  createStrategyCacheKey: <TSource, TUnit>(params: {
    adapter: FsusRenderPipelineAdapter<TSource, TUnit> | null
    canUseWorker: boolean
    config: FsusResolvedRenderPipelineConfig
    source: TSource
  }) => string
  emitDiagnostic: (event: FsusRenderPipelineDiagnosticEvent) => void
  getAdapter: <TSource = unknown, TUnit = unknown>(
    adapterId: string,
  ) => FsusRenderPipelineAdapter<TSource, TUnit> | undefined
  getCachedStrategy: (
    cacheKey: string,
    profileVersion?: string,
  ) => FsusRenderPipelineStrategyCacheEntry | undefined
  getDiagnosticsSnapshot: () => readonly FsusRenderPipelineDiagnosticEvent[]
  inspectStrategyCache: (
    cacheKey: string,
  ) => FsusRenderPipelineStrategyCacheEntry | undefined
  invalidateStrategyProfile: (profileVersion: string) => void
  listAdapters: () => FsusRenderPipelineAdapter<unknown, unknown>[]
  registerAdapter: <TSource, TUnit>(
    adapter: FsusRenderPipelineAdapter<TSource, TUnit>,
  ) => () => void
  registerDiagnosticSink: (
    sink: FsusRenderPipelineDiagnosticSink,
  ) => () => void
  registerStrategyResolver: (
    resolver: FsusRenderPipelineStrategyResolver,
    options?: FsusRenderPipelineStrategyResolverOptions,
  ) => () => void
  setCachedStrategy: (
    cacheKey: string,
    entry: Pick<
      FsusRenderPipelineStrategyCacheEntry,
      'durationMs' | 'strategy'
    > & {
      profileVersion?: string
      ttlMs?: number
    },
  ) => void
}

export type FsusRenderPipelineContextInjectionKey =
  InjectionKey<FsusRenderPipelineContext>
