import {
  computed,
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
  isFsusErr,
  isFsusOk,
  type FsusRenderPipelineComponentPolicy,
  type FsusErrorDetail,
  type FsusResult,
} from '@element-plus/utils'

import type { ComputedRef, MaybeRef, Ref } from 'vue'

import { FsusVirtualSizeIndex } from './virtual-window-index'
import {
  createFsusWorkerExecutor,
  type FsusWorkerExecutorEvent,
  type FsusWorkerExecutorEventType,
  type FsusWorkerExecutorOptions,
  type FsusWorkerTaskLane,
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

export const createFsusRafRefreshSampler = ({
  onSample,
  requestFrame = (callback: FrameRequestCallback) =>
    requestAnimationFrame(callback),
  cancelFrame = (handle: number) => cancelAnimationFrame(handle),
  sampleSize = 24,
}: {
  onSample: (profile: FsusRenderRefreshProfile) => void
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (handle: number) => void
  sampleSize?: number
}) => {
  const deltas: number[] = []
  let previous: number | null = null
  let handle = 0
  let stopped = false
  const sample = (timestamp: number) => {
    if (stopped) return
    if (previous !== null) deltas.push(timestamp - previous)
    previous = timestamp
    if (deltas.length >= Math.max(4, sampleSize)) {
      onSample(estimateFsusRenderRefreshProfile(deltas))
      stopped = true
      return
    }
    handle = requestFrame(sample)
  }
  handle = requestFrame(sample)
  return () => {
    stopped = true
    cancelFrame(handle)
  }
}

export const createFsusRenderStageHistory = (limit = 32, alpha = 0.25) => {
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
  const snapshot = (stage: FsusRenderPipelineStage): FsusRenderStageStats => {
    const values = [...(samples.get(stage) ?? [])].sort((a, b) => a - b)
    return {
      ewmaMs: roundBudgetNumber(ewma.get(stage) ?? 0),
      p50Ms: roundBudgetNumber(percentile(values, 0.5)),
      p95Ms: roundBudgetNumber(percentile(values, 0.95)),
      sampleCount: values.length,
    }
  }
  return { record, snapshot }
}

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

const emitFsusRenderPipelineDiagnostic = (
  event: FsusRenderPipelineDiagnosticEvent,
) => {
  const normalized = {
    timestamp: readRenderPipelineNow(),
    ...event,
  }
  renderPipelineDiagnosticsBuffer.push(normalized)
  for (const sink of Array.from(diagnosticSinks)) {
    sink(normalized)
  }
}

export const registerFsusRenderPipelineDiagnosticSink = (
  sink: FsusRenderPipelineDiagnosticSink,
) => {
  diagnosticSinks.add(sink)
  return () => {
    diagnosticSinks.delete(sink)
  }
}

export const getFsusRenderPipelineDiagnosticsSnapshot = () =>
  renderPipelineDiagnosticsBuffer.snapshot()

export const clearFsusRenderPipelineDiagnostics = () => {
  renderPipelineDiagnosticsBuffer.clear()
  diagnosticSinks.clear()
}

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

export const calibrateFsusMainThreadThroughput = () => {
  if (calibratedMainOpsPerMs !== null) return calibratedMainOpsPerMs
  const operations = 50_000
  const startedAt = readRenderPipelineNow()
  let checksum = 0
  for (let index = 0; index < operations; index++) {
    checksum = (checksum * 33 + index) >>> 0
  }
  const elapsedMs = Math.max(0.1, readRenderPipelineNow() - startedAt)
  calibratedMainOpsPerMs = Math.round((operations + (checksum & 1)) / elapsedMs)
  return calibratedMainOpsPerMs
}

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
  const refreshProfile = shallowRef(
    estimateFsusRenderRefreshProfile(
      Array.from({ length: 12 }, () => 1000 / 60),
    ),
  )
  const visibilityVersion = ref(0)
  const lowPower = ref(renderPipelineLowPower)
  let stopSampler: (() => void) | null = null
  const startSampler = () => {
    stopSampler?.()
    if (typeof requestAnimationFrame !== 'function') return
    stopSampler = createFsusRafRefreshSampler({
      onSample: (sample) => {
        refreshProfile.value = sample
      },
    })
  }
  const onVisibilityChange = () => {
    visibilityVersion.value += 1
    startSampler()
  }
  onMounted(() => {
    startSampler()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
    if (typeof navigator !== 'undefined') {
      const getBattery = (
        navigator as Navigator & {
          getBattery?: () => Promise<{ charging: boolean; level: number }>
        }
      ).getBattery
      if (typeof getBattery === 'function') {
        void getBattery
          .call(navigator)
          .then((battery) => {
            renderPipelineLowPower = !battery.charging && battery.level <= 0.2
            lowPower.value = renderPipelineLowPower
          })
          .catch(() => undefined)
      }
    }
  })
  onBeforeUnmount(() => {
    stopSampler?.()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })
  const capabilityProfile = computed(() => {
    visibilityVersion.value
    return resolveFsusRenderCapabilityProfile(refreshProfile.value, {
      lowPower: lowPower.value,
    })
  })
  const baseConfig = computed(() => {
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
  })
  const profile = computed(() =>
    resolveFsusRenderPipelineHardwareProfile(baseConfig.value),
  )
  const resolvedConfig = computed(() =>
    resolveFsusRenderPipelineConfig(baseConfig.value, profile.value),
  )
  const compositor = computed(() =>
    resolveFsusRenderPipelineCompositorEnabled(
      resolvedConfig.value,
      profile.value,
    ),
  )
  const contentVisibility = computed(() =>
    resolveFsusRenderPipelineContentVisibilityEnabled(
      resolvedConfig.value,
      profile.value,
    ),
  )
  const attrs = computed(() =>
    resolveFsusRenderPipelineHardwareAttrs({
      compositor: compositor.value,
      contentVisibility: contentVisibility.value,
      hardwareProfile: profile.value,
      layerBudget: resolvedConfig.value.acceleration.layerBudget,
    }),
  )

  return {
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

const normalizeAdapterId = (adapterId: string) => adapterId.trim()

export const registerFsusRenderPipelineAdapter = <TSource, TUnit>(
  adapter: FsusRenderPipelineAdapter<TSource, TUnit>,
) => {
  const adapterId = normalizeAdapterId(adapter.id)
  if (!adapterId) {
    throw new Error('fsus_render_pipeline_adapter_id_required')
  }

  const normalizedAdapter = {
    ...adapter,
    id: adapterId,
  } as FsusRenderPipelineAdapter<unknown, unknown>
  const previous = renderPipelineAdapters.get(adapterId)
  renderPipelineAdapters.set(adapterId, normalizedAdapter)

  return () => {
    if (previous) {
      renderPipelineAdapters.set(adapterId, previous)
    } else {
      renderPipelineAdapters.delete(adapterId)
    }
  }
}

export const getFsusRenderPipelineAdapter = <
  TSource = unknown,
  TUnit = unknown,
>(
  adapterId: string,
) =>
  renderPipelineAdapters.get(normalizeAdapterId(adapterId)) as
    | FsusRenderPipelineAdapter<TSource, TUnit>
    | undefined

export const listFsusRenderPipelineAdapters = () =>
  Array.from(renderPipelineAdapters.values())

export const clearFsusRenderPipelineAdapters = () => {
  renderPipelineAdapters.clear()
}

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
export const createFsusRenderPipelineStrategyCache = ({
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
      (profileVersion !== undefined && entry.profileVersion !== profileVersion)
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
  return { clear: () => entries.clear(), get, invalidateProfile, set }
}

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

export const inspectFsusRenderPipelineStrategyCache = (cacheKey: string) =>
  strategyCache.get(cacheKey)

export const registerFsusRenderPipelineStrategyResolver = (
  resolver: FsusRenderPipelineStrategyResolver,
  options: FsusRenderPipelineStrategyResolverOptions = {},
) => {
  const entry = {
    order: strategyResolverOrder++,
    priority:
      typeof options.priority === 'number' && Number.isFinite(options.priority)
        ? options.priority
        : 0,
    resolver,
  }
  strategyResolvers.add(entry)
  strategyResolverVersion += 1
  strategyCache.clear()
  return () => {
    strategyResolvers.delete(entry)
    strategyResolverVersion += 1
    strategyCache.clear()
  }
}

export const clearFsusRenderPipelineStrategyResolvers = () => {
  strategyResolvers.clear()
  strategyResolverVersion += 1
  strategyCache.clear()
}

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
  units: Ref<readonly TUnit[]>
}) => {
  const scrollOffset = ref(0)
  const viewportSize = ref(0)
  const indexVersion = ref(0)
  const fixedItemSize = positive(unref(options.itemSize), 0)

  const createVariableState = () => {
    const keys: string[] = []
    const keyToIndex = new Map<string, number>()
    const estimatedSizes: number[] = []
    const values: number[] = []

    options.units.value.forEach((unit, index) => {
      const key = options.getKey(unit, index)
      if (keyToIndex.has(key)) {
        throw new Error(`useFsusVirtualWindow requires unique keys: ${key}`)
      }
      const estimate = positive(options.estimateSize(unit, index), 1)
      keys.push(key)
      keyToIndex.set(key, index)
      estimatedSizes.push(estimate)
      values.push(estimate)
    })

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

  const variableState = fixedItemSize > 0 ? null : createVariableState()
  let measurementFrame = 0
  let scrollFrame = 0
  let resizeObserver: ResizeObserver | null = null
  let viewport: FsusViewport | null = null

  const totalSize = computed(() => {
    if (fixedItemSize > 0) return options.units.value.length * fixedItemSize
    indexVersion.value
    return variableState?.index.total ?? 0
  })

  const range = computed(() => {
    const overscan =
      unref(options.overscanPx) ?? defaultRenderPipelineConfig.budget.overscanPx
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
  })

  const offsetForIndex = (index: number) =>
    fixedItemSize > 0
      ? Math.max(0, index) * fixedItemSize
      : (variableState?.index.prefixSize(index) ?? 0)

  const visibleItems: ComputedRef<FsusVirtualWindowItem<TUnit>[]> = computed(
    () => {
      indexVersion.value
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
        items.push({
          index,
          key: options.getKey(unit, index),
          offset,
          size,
          unit,
        })
        offset += size
      }
      return items
    },
  )

  const topSpacer = computed(() => offsetForIndex(range.value.start))
  const bottomSpacer = computed(() =>
    Math.max(0, totalSize.value - offsetForIndex(range.value.end)),
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
    viewport = options.getViewport()
    scrollOffset.value = getViewportScrollTop(viewport)
    viewportSize.value = getViewportHeight(viewport)
  }

  const scheduleViewportRead = () => {
    if (scrollFrame) return
    if (typeof requestAnimationFrame !== 'function') {
      readViewport()
      return
    }
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0
      readViewport()
    })
  }

  const flushMeasurements = () => {
    measurementFrame = 0
    if (!variableState?.pendingMeasurements.size) return

    const batchSize = Math.max(
      1,
      Math.floor(positive(unref(options.measureBatch), 32)),
    )
    const entries: Array<[string, number]> = []
    for (const entry of variableState.pendingMeasurements) {
      entries.push(entry)
      variableState.pendingMeasurements.delete(entry[0])
      if (entries.length >= batchSize) break
    }

    const anchorIndex = range.value.start
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
    emitDiagnostic({ batchSize: entries.length, type: 'measurement-batch' })
    emitDiagnostic({
      cacheSize: variableState.measuredSizes.size,
      type: 'measurement-cache',
    })

    if (Math.abs(scrollCorrection) > 0.5) {
      const nextOffset = getViewportScrollTop(viewport) + scrollCorrection
      setViewportScrollTop(viewport, nextOffset)
      scrollOffset.value = nextOffset
      emitDiagnostic({
        correction: scrollCorrection,
        reason: 'measurement',
        type: 'scroll-correction',
      })
      readViewport()
    }

    if (variableState.pendingMeasurements.size) {
      if (typeof requestAnimationFrame === 'function') {
        measurementFrame = requestAnimationFrame(flushMeasurements)
      } else {
        flushMeasurements()
      }
    }
  }

  const queueMeasurement = (key: string, size: number) => {
    if (!variableState) return
    variableState.pendingMeasurements.set(key, size)
    if (!measurementFrame) {
      if (typeof requestAnimationFrame === 'function') {
        measurementFrame = requestAnimationFrame(flushMeasurements)
      } else {
        flushMeasurements()
      }
    }
  }

  const setUnitRef = (key: string, element: Element | null) => {
    if (!variableState) return
    const previousElement = variableState.observedElements.get(key)
    if (previousElement === element) return
    if (previousElement) {
      resizeObserver?.unobserve(previousElement)
      variableState.elementKeys.delete(previousElement)
      variableState.observedElements.delete(key)
    }

    if (!(element instanceof HTMLElement)) return
    if (!variableState.keyToIndex.has(key)) return
    const previousKey = variableState.elementKeys.get(element)
    if (previousKey && previousKey !== key) {
      variableState.observedElements.delete(previousKey)
      variableState.pendingMeasurements.delete(previousKey)
    }
    variableState.observedElements.set(key, element)
    variableState.elementKeys.set(element, key)
    queueMeasurement(key, element.offsetHeight)

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver ??= new ResizeObserver((entries) => {
        for (const entry of entries) {
          const entryKey = variableState.elementKeys.get(entry.target)
          if (!entryKey) continue
          const blockSize =
            entry.borderBoxSize?.[0]?.blockSize ??
            entry.contentRect.height ??
            (entry.target instanceof HTMLElement
              ? entry.target.offsetHeight
              : 0)
          queueMeasurement(entryKey, blockSize)
        }
      })
      resizeObserver.observe(element)
    }
  }

  const syncUnits = (nextUnits: readonly TUnit[]) => {
    if (!variableState) return
    const previousStart = range.value.start
    const anchorKey = variableState.keys[previousStart]
    const anchorDelta = scrollOffset.value - offsetForIndex(previousStart)
    const nextKeys: string[] = []
    const seen = new Set<string>()
    for (let index = 0; index < nextUnits.length; index += 1) {
      const unit = nextUnits[index]
      if (unit === undefined) continue
      const key = options.getKey(unit, index)
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
          resizeObserver?.unobserve(element)
          variableState.elementKeys.delete(element)
        }
        variableState.observedElements.delete(key)
        variableState.pendingMeasurements.delete(key)
        variableState.measuredSizes.delete(key)
        variableState.keyToIndex.delete(key)
      }
      variableState.keys.length = nextKeys.length
      variableState.estimatedSizes.length = nextKeys.length
      variableState.index.truncate(nextKeys.length)
    } else {
      for (const [key, element] of variableState.observedElements) {
        if (seen.has(key)) continue
        resizeObserver?.unobserve(element)
        variableState.elementKeys.delete(element)
        variableState.observedElements.delete(key)
        variableState.pendingMeasurements.delete(key)
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
        estimates.push(estimate)
        values.push(variableState.measuredSizes.get(key) ?? estimate)
        keyToIndex.set(key, index)
      }
      variableState.keys = nextKeys
      variableState.keyToIndex = keyToIndex
      variableState.estimatedSizes = estimates
      variableState.index.rebuild(values)
      emitDiagnostic({ reason: 'insert-or-reorder', type: 'index-rebuild' })
    }

    indexVersion.value += 1
    if (anchorKey) {
      const nextAnchorIndex = variableState.keyToIndex.get(anchorKey)
      if (nextAnchorIndex !== undefined) {
        const nextOffset = offsetForIndex(nextAnchorIndex) + anchorDelta
        const correction = nextOffset - scrollOffset.value
        if (Math.abs(correction) > 0.5) {
          setViewportScrollTop(viewport, nextOffset)
          scrollOffset.value = nextOffset
          emitDiagnostic({
            correction,
            reason: 'units',
            type: 'scroll-correction',
          })
        }
      }
    }
    void nextTick(readViewport)
  }

  const connect = () => {
    readViewport()
    viewport?.addEventListener('scroll', scheduleViewportRead, {
      passive: true,
    })
    if (viewport && isWindowViewport(viewport)) {
      viewport.addEventListener('resize', scheduleViewportRead)
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', scheduleViewportRead)
    }
  }

  const disconnect = () => {
    viewport?.removeEventListener('scroll', scheduleViewportRead)
    if (viewport && isWindowViewport(viewport)) {
      viewport.removeEventListener('resize', scheduleViewportRead)
    } else if (typeof window !== 'undefined') {
      window.removeEventListener('resize', scheduleViewportRead)
    }
    viewport = null
  }

  onMounted(() => {
    void nextTick(connect)
  })

  watch(options.units, syncUnits, { flush: 'sync' })

  onBeforeUnmount(() => {
    disconnect()
    if (typeof cancelAnimationFrame === 'function') {
      if (scrollFrame) cancelAnimationFrame(scrollFrame)
      if (measurementFrame) cancelAnimationFrame(measurementFrame)
    }
    resizeObserver?.disconnect()
    resizeObserver = null
    variableState?.observedElements.clear()
    variableState?.pendingMeasurements.clear()
    variableState?.measuredSizes.clear()
  })

  return {
    bottomSpacer,
    connect,
    readViewport,
    range,
    scrollOffset,
    setUnitRef,
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
    emitFsusRenderPipelineDiagnostic(nextEvent)
  }

  const sourceRef = computed(() => unref(options.source))

  const hardwareRuntime = useFsusRenderPipelineHardwareProfile(
    computed(() => unref(options.config)),
  )
  const capabilityProfile = hardwareRuntime.capabilityProfile
  watch(
    capabilityProfile,
    (profile) => {
      strategyCache.invalidateProfile(profile.version)
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

    return getFsusRenderPipelineAdapter<TSource, TUnit>(adapterId) ?? null
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
        estimate: estimate.value,
      },
    )
  })

  const strategyCacheKey = computed(() =>
    createStrategyCacheKey({
      adapter: adapter.value,
      canUseWorker: canUseWorker.value,
      config: config.value,
      source: sourceRef.value,
    }),
  )

  const strategy = computed<FsusRenderPipelineStrategy>(() => {
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
    const activeStrategyCacheEntry = getCachedStrategy(
      activeStrategyCacheKey,
      capabilityProfile.value.version,
    )
    const startedAt = now()
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
    recordStage('queue-wait', Math.max(0, now() - queuedAt), activeStrategy)

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

    const prepareStartedAt = now()
    const nextDocument = await prepareDocument(
      activeAdapter,
      input,
      activeStrategy,
      controller.signal,
      currentTaskId,
    )
    recordStage('prepare', now() - prepareStartedAt, renderedStrategy.value)

    if (currentTaskId !== taskId || controller.signal.aborted) {
      loading.value = false
      return
    }

    if (isFsusOk(nextDocument)) {
      const commitStartedAt = now()
      documentRef.value = nextDocument.value
      await nextTick()
      if (currentTaskId !== taskId || controller.signal.aborted) return
      recordStage('vue-commit', now() - commitStartedAt, renderedStrategy.value)
      const layoutStartedAt = now()
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => resolve())
        } else resolve()
      })
      if (currentTaskId !== taskId || controller.signal.aborted) return
      recordStage(
        'style-layout',
        now() - layoutStartedAt,
        renderedStrategy.value,
      )
      const paintStartedAt = now()
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => resolve())
        } else resolve()
      })
      if (currentTaskId !== taskId || controller.signal.aborted) return
      recordStage('next-paint', now() - paintStartedAt, renderedStrategy.value)
      const durationMs = now() - startedAt
      recordStage('total', durationMs, renderedStrategy.value)
      setCachedStrategy(activeStrategyCacheKey, {
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
      const durationMs = now() - startedAt
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
