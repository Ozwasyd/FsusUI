import type {
  FsusRenderEstimate,
  FsusRenderHardwareProfile,
  FsusRenderPipelineAdaptiveMode,
  FsusRenderPipelineAdaptiveSignals,
  FsusRenderPipelineCompositorMode,
  FsusRenderPipelineConfig,
  FsusRenderPipelineHardwareMode,
  FsusRenderPipelineStage,
  FsusRenderPipelineStrategy,
  FsusRenderRefreshProfile,
  FsusRenderStageStats,
  FsusResolvedRenderPipelineConfig,
} from './types'

export const defaultRenderPipelineConfig: FsusResolvedRenderPipelineConfig = {
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

export const cpuThreadedRenderPipelineDefaults: FsusResolvedRenderPipelineConfig =
  {
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

export const positive = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export const roundBudgetNumber = (value: number) =>
  Math.round(value * 100) / 100

export const percentile = (sorted: readonly number[], ratio: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0

export const readRenderPipelineNow = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

export const normalizeHardwareMode = (
  mode: unknown,
): FsusRenderPipelineHardwareMode =>
  mode === 'gpu' || mode === 'cpu' ? mode : 'auto'

export const normalizeCompositorMode = (
  mode: unknown,
): FsusRenderPipelineCompositorMode =>
  mode === 'enabled' || mode === 'disabled' ? mode : 'auto'

export const normalizeAdaptiveMode = (
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
