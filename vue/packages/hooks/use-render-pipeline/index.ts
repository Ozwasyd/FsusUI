import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  triggerRef,
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
  toFsusError,
  type FsusRenderPipelineComponentPolicy,
  type FsusErrorDetail,
  type FsusResult,
} from '@element-plus/utils'

import type { ComputedRef, MaybeRef, Ref } from 'vue'

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

export type FsusWorkerExecutorEventType =
  | 'worker-created'
  | 'worker-reused'
  | 'worker-disposed'
  | 'worker-idle-terminate'
  | 'worker-error'
  | 'request-start'
  | 'request-resolve'
  | 'request-reject'
  | 'request-abort'
  | 'request-timeout'

export type FsusWorkerExecutorEvent = {
  durationMs?: number
  error?: FsusErrorDetail
  id?: number
  name: string
  pendingCount: number
  type: FsusWorkerExecutorEventType
}

export type FsusWorkerExecutorOptions = {
  idleTerminateMs?: number
  name?: string
  onEvent?: (event: FsusWorkerExecutorEvent) => void
  requestTimeoutMs?: number
  serializeError?: (error: unknown) => unknown
}

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
  durationMs?: number
  error?: FsusErrorDetail
  fallbackReason?: string
  phase?: string
  pendingCount?: number
  queueDepth?: number
  strategy: FsusRenderPipelineStrategy
  timestamp?: number
  type:
    | 'render-start'
    | 'render-complete'
    | 'render-error'
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
}

export type FsusRenderSchedulerTaskOptions = {
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

export type FsusVirtualWindowItem<TUnit> = {
  index: number
  key: string
  offset: number
  size: number
  unit: TUnit
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
    frameMs: 8,
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
    frameMs: 4,
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

export const resolveFsusAdaptiveRenderPipelineConfig = (
  config: FsusResolvedRenderPipelineConfig,
  hardwareProfile: FsusRenderHardwareProfile,
  signals: FsusRenderPipelineAdaptiveSignals = {},
): FsusResolvedRenderPipelineConfig => {
  if (config.adaptive === 'disabled') return config

  const hasRuntimeSignals =
    signals.queueDepth !== undefined ||
    signals.rafDriftMs !== undefined ||
    signals.renderDurationMs !== undefined
  if (!hasRuntimeSignals) return config

  const frameMs = Math.max(1, config.budget.frameMs)
  const renderDurationMs = signals.renderDurationMs ?? 0
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

  if (isReducedMotionPreferred()) {
    return 'cpu-threaded'
  }

  return 'gpu-compositor'
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
  hardwareProfile: FsusRenderHardwareProfile,
) => {
  const mode = config.acceleration.compositor
  if (mode === 'enabled') return true
  if (mode === 'disabled') return false
  return hardwareProfile === 'gpu-compositor' && supportsCompositorTransforms()
}

export const resolveFsusRenderPipelineContentVisibilityEnabled = (
  config: FsusResolvedRenderPipelineConfig,
  hardwareProfile: FsusRenderHardwareProfile,
) => {
  const mode = config.acceleration.contentVisibility
  if (mode === 'enabled') return supportsContentVisibility()
  if (mode === 'disabled') return false
  return hardwareProfile === 'gpu-compositor' && supportsContentVisibility()
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
  const baseConfig = computed(() =>
    resolveFsusRenderPipelineConfig(unref(config)),
  )
  const profile = computed(() =>
    resolveFsusRenderPipelineHardwareProfile(baseConfig.value),
  )
  const resolvedConfig = computed(() =>
    resolveFsusRenderPipelineConfig(unref(config), profile.value),
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
    compositor,
    config: resolvedConfig,
    contentVisibility,
    profile,
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

type FsusRenderPipelineStrategyCacheEntry = {
  durationMs?: number
  strategy: FsusRenderPipelineStrategy
  updatedAt: number
}

const STRATEGY_CACHE_LIMIT = 128
const strategyCache = new Map<string, FsusRenderPipelineStrategyCacheEntry>()

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

const getCachedStrategy = (cacheKey: string) =>
  cacheKey ? strategyCache.get(cacheKey) : undefined

const setCachedStrategy = (
  cacheKey: string,
  entry: Omit<FsusRenderPipelineStrategyCacheEntry, 'updatedAt'>,
) => {
  if (!cacheKey) return
  strategyCache.delete(cacheKey)
  strategyCache.set(cacheKey, {
    ...entry,
    updatedAt: readRenderPipelineNow(),
  })
  if (strategyCache.size > STRATEGY_CACHE_LIMIT) {
    const firstKey = strategyCache.keys().next().value
    if (firstKey) strategyCache.delete(firstKey)
  }
}

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
    priority: FsusRenderSchedulerPriority
    task: () => void
  }

  const queues: Record<FsusRenderSchedulerPriority, Set<SchedulerEntry>> = {
    background: new Set(),
    'user-blocking': new Set(),
    visible: new Set(),
  }
  let cancelFlush: (() => void) | null = null
  let scheduledFlushPriority: FsusRenderSchedulerPriority | null = null

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

    let entry = getNextEntry()
    while (entry) {
      removeEntry(entry)
      entry.task()

      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (hasPending() && now - startedAt >= frameMs) {
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
            options?: { priority?: string },
          ) => Promise<unknown>
        }
      }
    ).scheduler

    if (typeof scheduler?.postTask === 'function') {
      let cancelled = false
      cancelFlush = () => {
        cancelled = true
        scheduledFlushPriority = null
      }
      void scheduler
        .postTask(
          () => {
            if (!cancelled) flush()
          },
          { priority: postTaskPriorityMap[flushPriority] },
        )
        .catch(() => {
          if (!cancelled) flush()
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
    task: () => void,
    options: FsusRenderSchedulerTaskOptions = {},
  ) => {
    const priority = options.priority ?? 'visible'
    if (options.signal?.aborted) return () => undefined

    const entry: SchedulerEntry = {
      cleanup: null,
      priority,
      task,
    }

    const cancel = () => removeEntry(entry)
    if (options.signal) {
      options.signal.addEventListener('abort', cancel, { once: true })
      entry.cleanup = () => options.signal?.removeEventListener('abort', cancel)
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

const DEFAULT_WORKER_IDLE_TERMINATE_MS = 30_000
const DEFAULT_WORKER_REQUEST_TIMEOUT_MS = 60_000

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const positiveNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback

const createAbortErrorDetail = (message: string) =>
  createFsusError('aborted', message)

const normalizeWorkerError = (
  error: unknown,
  serializeError?: (error: unknown) => unknown,
) => {
  const serialized = serializeError ? serializeError(error) : error
  if (
    serialized &&
    typeof serialized === 'object' &&
    'code' in serialized &&
    'message' in serialized
  ) {
    return toFsusError(serialized, 'fsus_worker_error', 'infra')
  }
  if (serialized instanceof Error) {
    return toFsusError(serialized, 'fsus_worker_error', 'infra')
  }

  if (serialized && typeof serialized === 'object') {
    const payload = serialized as { message?: unknown; name?: unknown }
    return createFsusError('infra', 'fsus_worker_error', {
      cause: payload,
      details:
        typeof payload.message === 'string' ? payload.message : undefined,
    })
  }

  return createFsusError(
    'infra',
    typeof serialized === 'string' ? serialized : 'fsus_worker_error',
    { cause: serialized },
  )
}

export const createFsusWorkerExecutor = <TRequest, TResponse>(
  createWorker: () => Worker,
  options: FsusWorkerExecutorOptions = {},
) => {
  let worker: Worker | null = null
  let taskId = 0
  let retainCount = 0
  let idleTerminateTimer: ReturnType<typeof setTimeout> | null = null
  const pending = new Map<
    number,
    {
      abortCleanup: (() => void) | null
      release: () => void
      resolve: (value: FsusResult<TResponse>) => void
      startedAt: number
      timeoutId: ReturnType<typeof setTimeout> | null
    }
  >()

  const name = options.name ?? 'fsus-worker'
  const idleTerminateMs = positiveNumber(
    options.idleTerminateMs,
    DEFAULT_WORKER_IDLE_TERMINATE_MS,
  )
  const requestTimeoutMs = positiveNumber(
    options.requestTimeoutMs,
    DEFAULT_WORKER_REQUEST_TIMEOUT_MS,
  )

  const emit = (
    type: FsusWorkerExecutorEventType,
    event: Partial<
      Omit<FsusWorkerExecutorEvent, 'name' | 'pendingCount' | 'type'>
    > = {},
  ) => {
    options.onEvent?.({
      name,
      pendingCount: pending.size,
      type,
      ...event,
    })
  }

  const clearIdleTerminateTimer = () => {
    if (!idleTerminateTimer) return
    clearTimeout(idleTerminateTimer)
    idleTerminateTimer = null
  }

  const scheduleIdleTerminate = () => {
    if (retainCount > 0 || pending.size > 0) return
    clearIdleTerminateTimer()
    idleTerminateTimer = setTimeout(() => {
      if (retainCount === 0 && pending.size === 0 && worker) {
        emit('worker-idle-terminate')
        worker.terminate()
        worker = null
      }
      idleTerminateTimer = null
    }, idleTerminateMs)
  }

  const releaseRetain = () => {
    retainCount = Math.max(0, retainCount - 1)
    scheduleIdleTerminate()
  }

  const settlePendingRequest = (
    id: number,
    action: (task: {
      resolve: (value: FsusResult<TResponse>) => void
      startedAt: number
    }) => void,
    type: FsusWorkerExecutorEventType,
    error?: FsusErrorDetail,
  ) => {
    const task = pending.get(id)
    if (!task) return

    pending.delete(id)
    if (task.timeoutId) {
      clearTimeout(task.timeoutId)
      task.timeoutId = null
    }
    task.abortCleanup?.()
    task.abortCleanup = null

    try {
      action(task)
      emit(type, {
        durationMs: now() - task.startedAt,
        error,
        id,
      })
    } finally {
      task.release()
    }
  }

  const destroyWorker = (
    reason: unknown = createFsusError('infra', 'fsus_worker_disposed'),
    type: FsusWorkerExecutorEventType = 'worker-disposed',
  ) => {
    const error = toFsusError(reason, 'fsus_worker_disposed', 'infra')
    clearIdleTerminateTimer()
    worker?.terminate()
    worker = null
    emit(type, { error })

    for (const id of Array.from(pending.keys())) {
      settlePendingRequest(
        id,
        (task) => task.resolve(fsusErr(error)),
        'request-reject',
        error,
      )
    }
  }

  const ensureWorker = () => {
    if (!worker) {
      clearIdleTerminateTimer()
      worker = createWorker()
      emit('worker-created')
      worker.onmessage = (event: MessageEvent) => {
        const payload = event.data as {
          error?: unknown
          id: number
          result?: TResponse
        }
        if (payload.error) {
          const error = normalizeWorkerError(
            payload.error,
            options.serializeError,
          )
          settlePendingRequest(
            payload.id,
            (task) => task.resolve(fsusErr(error)),
            'request-reject',
            error,
          )
        } else {
          settlePendingRequest(
            payload.id,
            (task) => task.resolve(fsusOk(payload.result as TResponse)),
            'request-resolve',
          )
        }
      }
      worker.onerror = (event) => {
        event.preventDefault?.()
        const error = normalizeWorkerError(
          (event as ErrorEvent).error ??
            (event as ErrorEvent).message ??
            'fsus_worker_error',
          options.serializeError,
        )
        destroyWorker(error, 'worker-error')
      }
    } else {
      clearIdleTerminateTimer()
      emit('worker-reused')
    }
    return worker
  }

  const retain = () => {
    retainCount += 1
    clearIdleTerminateTimer()

    try {
      ensureWorker()
    } catch (error) {
      releaseRetain()
      throw error
    }

    let released = false
    return () => {
      if (released) return
      released = true
      releaseRetain()
    }
  }

  const dispose = () => {
    destroyWorker(
      createFsusError('infra', 'fsus_worker_disposed'),
      'worker-disposed',
    )
  }

  const run = (request: TRequest, signal?: AbortSignal) => {
    if (signal?.aborted) {
      return Promise.resolve(
        fsusErr<TResponse>(
          createAbortErrorDetail('fsus_worker_request_aborted'),
        ),
      )
    }

    const id = ++taskId
    let release: (() => void) | null = null
    let activeWorker: Worker

    try {
      release = retain()
      activeWorker = worker ?? ensureWorker()
    } catch (error) {
      return Promise.resolve(
        fsusErr<TResponse>(
          toFsusError(error, 'fsus_worker_create_failed', 'infra'),
        ),
      )
    }

    return new Promise<FsusResult<TResponse>>((resolve) => {
      const abort = () => {
        const error = createAbortErrorDetail('fsus_worker_request_aborted')
        settlePendingRequest(
          id,
          (task) => task.resolve(fsusErr(error)),
          'request-abort',
          error,
        )
      }

      const timeoutId = setTimeout(() => {
        const error = createFsusError('timeout', 'fsus_worker_request_timeout')
        settlePendingRequest(
          id,
          (task) => task.resolve(fsusErr(error)),
          'request-timeout',
          error,
        )
        destroyWorker(error, 'worker-error')
      }, requestTimeoutMs)

      let abortCleanup: (() => void) | null = null
      if (signal) {
        signal.addEventListener('abort', abort, { once: true })
        abortCleanup = () => signal.removeEventListener('abort', abort)
      }

      pending.set(id, {
        abortCleanup,
        release: release ?? (() => {}),
        resolve,
        startedAt: now(),
        timeoutId,
      })
      emit('request-start', { id })

      try {
        activeWorker.postMessage({ id, request })
      } catch (error) {
        const detail = toFsusError(
          error,
          'fsus_worker_post_message_failed',
          'infra',
        )
        settlePendingRequest(
          id,
          (task) => task.resolve(fsusErr(detail)),
          'request-reject',
          detail,
        )
      }
    })
  }

  return {
    dispose,
    getPendingCount: () => pending.size,
    retain,
    run,
  }
}

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
    entry = {
      executor: createFsusWorkerExecutor<unknown, unknown>(createWorker, {
        ...options,
        name: options.name ?? poolKey,
        onEvent: (event) => {
          options.onEvent?.(event)
          for (const activeListener of Array.from(listeners)) {
            activeListener(event)
          }
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
    },
    executor: entry.executor as ReturnType<
      typeof createFsusWorkerExecutor<TRequest, TResponse>
    >,
  }
}

const isWindowViewport = (viewport: FsusViewport): viewport is Window =>
  typeof Window !== 'undefined' && viewport instanceof Window

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

const findFirstVirtualItemAtOffset = <TUnit>(
  items: readonly FsusVirtualWindowItem<TUnit>[],
  offset: number,
) => {
  let low = 0
  let high = items.length - 1
  let result = items.length

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const item = items[mid]
    if (item.offset + item.size >= offset) {
      result = mid
      high = mid - 1
    } else {
      low = mid + 1
    }
  }

  return Math.min(result, items.length)
}

const findFirstVirtualItemAfterOffset = <TUnit>(
  items: readonly FsusVirtualWindowItem<TUnit>[],
  offset: number,
  start = 0,
) => {
  let low = start
  let high = items.length - 1
  let result = items.length

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const item = items[mid]
    if (item.offset > offset) {
      result = mid
      high = mid - 1
    } else {
      low = mid + 1
    }
  }

  return Math.min(result, items.length)
}

export const useFsusVirtualWindow = <TUnit>(options: {
  estimateSize: (unit: TUnit, index: number) => number
  getKey: (unit: TUnit, index: number) => string
  getViewport: () => FsusViewport | null
  measureBatch?: MaybeRef<number | undefined>
  minVisibleItems?: MaybeRef<number | undefined>
  overscanPx?: MaybeRef<number | undefined>
  units: Ref<readonly TUnit[]>
}) => {
  const scrollOffset = ref(0)
  const viewportSize = ref(0)
  const sizes = shallowRef(new Map<string, number>())
  const observers = new Map<string, ResizeObserver>()
  const measuredElements = new Map<string, HTMLElement>()
  const pendingMeasurements = new Map<string, number>()
  let measurementFrame = 0
  let scrollFrame = 0
  let viewport: FsusViewport | null = null

  const itemMeta = computed(() => {
    let offset = 0
    return options.units.value.map((unit, index) => {
      const key = options.getKey(unit, index)
      const size = sizes.value.get(key) ?? options.estimateSize(unit, index)
      const item = { index, key, offset, size, unit }
      offset += size
      return item
    })
  })

  const itemIndexByKey = computed(() => {
    const indexByKey = new Map<string, FsusVirtualWindowItem<TUnit>>()
    for (const item of itemMeta.value) {
      indexByKey.set(item.key, item)
    }
    return indexByKey
  })

  const totalSize = computed(() => {
    const items = itemMeta.value
    const last = items[items.length - 1]
    return last ? last.offset + last.size : 0
  })

  const range = computed(() => {
    const overscan =
      unref(options.overscanPx) ?? defaultRenderPipelineConfig.budget.overscanPx
    const startOffset = Math.max(0, scrollOffset.value - overscan)
    const endOffset = scrollOffset.value + viewportSize.value + overscan
    const items = itemMeta.value

    const start = findFirstVirtualItemAtOffset(items, startOffset)
    const end = findFirstVirtualItemAfterOffset(items, endOffset, start)
    const minVisibleItems = Math.max(
      1,
      Math.floor(positive(unref(options.minVisibleItems), 1)),
    )

    return {
      end: Math.min(items.length, Math.max(end, start + minVisibleItems)),
      start,
    }
  })

  const visibleItems: ComputedRef<FsusVirtualWindowItem<TUnit>[]> = computed(
    () => itemMeta.value.slice(range.value.start, range.value.end),
  )

  const topSpacer = computed(() => visibleItems.value[0]?.offset ?? 0)
  const bottomSpacer = computed(() =>
    Math.max(
      0,
      totalSize.value -
        topSpacer.value -
        visibleItems.value.reduce((sum, item) => sum + item.size, 0),
    ),
  )

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
    if (!pendingMeasurements.size) return

    const batchSize = Math.max(1, unref(options.measureBatch) ?? 32)
    const entries = Array.from(pendingMeasurements.entries()).slice(
      0,
      batchSize,
    )
    for (const [key] of entries) {
      pendingMeasurements.delete(key)
    }

    const nextSizes = new Map(sizes.value)
    let scrollCorrection = 0

    for (const [key, nextSize] of entries) {
      const previous = nextSizes.get(key)
      if (
        !Number.isFinite(nextSize) ||
        nextSize <= 0 ||
        previous === nextSize
      ) {
        continue
      }

      const item = itemIndexByKey.value.get(key)
      nextSizes.set(key, nextSize)
      if (item && item.index < range.value.start) {
        scrollCorrection += nextSize - item.size
      }
    }

    sizes.value = nextSizes
    triggerRef(sizes)

    if (Math.abs(scrollCorrection) > 0.5) {
      setViewportScrollTop(
        viewport,
        getViewportScrollTop(viewport) + scrollCorrection,
      )
      readViewport()
    }

    if (pendingMeasurements.size) {
      if (typeof requestAnimationFrame === 'function') {
        measurementFrame = requestAnimationFrame(flushMeasurements)
      } else {
        flushMeasurements()
      }
    }
  }

  const queueMeasurement = (key: string, size: number) => {
    pendingMeasurements.set(key, size)
    if (!measurementFrame) {
      if (typeof requestAnimationFrame === 'function') {
        measurementFrame = requestAnimationFrame(flushMeasurements)
      } else {
        flushMeasurements()
      }
    }
  }

  const setUnitRef = (key: string, element: Element | null) => {
    observers.get(key)?.disconnect()
    observers.delete(key)
    measuredElements.delete(key)

    if (!(element instanceof HTMLElement)) return
    measuredElements.set(key, element)
    queueMeasurement(key, element.offsetHeight)

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const blockSize =
          entries[0]?.borderBoxSize?.[0]?.blockSize ??
          entries[0]?.contentRect.height ??
          element.offsetHeight
        queueMeasurement(key, blockSize)
      })
      observer.observe(element)
      observers.set(key, observer)
    }
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

  watch(options.units, (nextUnits) => {
    const nextKeys = new Set(
      nextUnits.map((unit, index) => options.getKey(unit, index)),
    )
    const nextSizes = new Map(sizes.value)
    for (const key of Array.from(nextSizes.keys())) {
      if (!nextKeys.has(key)) nextSizes.delete(key)
    }
    sizes.value = nextSizes
    triggerRef(sizes)
    void nextTick(readViewport)
  })

  onBeforeUnmount(() => {
    disconnect()
    if (typeof cancelAnimationFrame === 'function') {
      if (scrollFrame) cancelAnimationFrame(scrollFrame)
      if (measurementFrame) cancelAnimationFrame(measurementFrame)
    }
    for (const observer of observers.values()) {
      observer.disconnect()
    }
    observers.clear()
    measuredElements.clear()
    pendingMeasurements.clear()
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
    const cached = getCachedStrategy(strategyCacheKey.value)
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
        durationMs: event.durationMs,
        error: event.error,
        pendingCount: event.pendingCount,
        queueDepth: event.pendingCount,
        strategy: renderedStrategy.value,
        type: event.type,
      })
      adaptiveSignals.value = {
        ...adaptiveSignals.value,
        queueDepth: event.pendingCount,
      }
    }
    const executorOptions: FsusWorkerExecutorOptions = {
      idleTerminateMs: workerOptions.idleTerminateMs,
      name: workerOptions.name ?? activeAdapter.id,
      requestTimeoutMs: workerOptions.requestTimeoutMs,
      serializeError: workerOptions.serializeError,
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

  const prepareDocument = async (
    activeAdapter: FsusRenderPipelineAdapter<TSource, TUnit>,
    input: TSource,
    activeStrategy: FsusRenderPipelineStrategy,
    signal: AbortSignal,
  ): Promise<FsusResult<FsusRenderPipelineDocument<TUnit>>> => {
    if (activeStrategy === 'chunked-worker') {
      const executor = getWorkerExecutor(activeAdapter)

      if (executor) {
        const workerDocument = await executor.run(input, signal)
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
    const activeStrategyCacheEntry = getCachedStrategy(activeStrategyCacheKey)
    const startedAt = now()

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

    const nextDocument = await prepareDocument(
      activeAdapter,
      input,
      activeStrategy,
      controller.signal,
    )

    if (currentTaskId !== taskId || controller.signal.aborted) {
      loading.value = false
      return
    }

    if (isFsusOk(nextDocument)) {
      const durationMs = now() - startedAt
      documentRef.value = nextDocument.value
      setCachedStrategy(activeStrategyCacheKey, {
        durationMs,
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
