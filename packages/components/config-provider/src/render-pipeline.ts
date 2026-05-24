export const renderPipelineModes = ['auto', 'enabled', 'disabled'] as const
export type RenderPipelineMode = (typeof renderPipelineModes)[number]

export const renderPipelineWorkerModes = [
  'auto',
  'enabled',
  'disabled',
] as const
export type RenderPipelineWorkerMode =
  (typeof renderPipelineWorkerModes)[number]

export const renderPipelineHardwareModes = ['auto', 'gpu', 'cpu'] as const
export type RenderPipelineHardwareMode =
  (typeof renderPipelineHardwareModes)[number]

export const renderPipelineCompositorModes = [
  'auto',
  'enabled',
  'disabled',
] as const
export type RenderPipelineCompositorMode =
  (typeof renderPipelineCompositorModes)[number]

export type RenderPipelineThresholds = {
  htmlBytes?: number
  estimatedNodes?: number
  itemCount?: number
}

export type RenderPipelineBudget = {
  frameMs?: number
  overscanPx?: number
  measureBatch?: number
}

export type RenderPipelineAccelerationConfig = {
  mode?: RenderPipelineHardwareMode
  compositor?: RenderPipelineCompositorMode
  contentVisibility?: RenderPipelineCompositorMode
  layerBudget?: number
}

export type RenderPipelineConfigContract = {
  mode?: RenderPipelineMode
  worker?: RenderPipelineWorkerMode
  thresholds?: RenderPipelineThresholds
  budget?: RenderPipelineBudget
  acceleration?: RenderPipelineAccelerationConfig
}

export type ResolvedRenderPipelineConfig = {
  mode: RenderPipelineMode
  worker: RenderPipelineWorkerMode
  thresholds: Required<RenderPipelineThresholds>
  budget: Required<RenderPipelineBudget>
  acceleration: Required<RenderPipelineAccelerationConfig>
}

export const defaultRenderPipelineConfig: ResolvedRenderPipelineConfig = {
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

const normalizeMode = (mode?: string): RenderPipelineMode =>
  renderPipelineModes.includes(mode as RenderPipelineMode)
    ? (mode as RenderPipelineMode)
    : defaultRenderPipelineConfig.mode

const normalizeWorkerMode = (mode?: string): RenderPipelineWorkerMode =>
  renderPipelineWorkerModes.includes(mode as RenderPipelineWorkerMode)
    ? (mode as RenderPipelineWorkerMode)
    : defaultRenderPipelineConfig.worker

const normalizeHardwareMode = (mode?: string): RenderPipelineHardwareMode =>
  renderPipelineHardwareModes.includes(mode as RenderPipelineHardwareMode)
    ? (mode as RenderPipelineHardwareMode)
    : defaultRenderPipelineConfig.acceleration.mode

const normalizeCompositorMode = (
  mode?: string,
): RenderPipelineCompositorMode =>
  renderPipelineCompositorModes.includes(mode as RenderPipelineCompositorMode)
    ? (mode as RenderPipelineCompositorMode)
    : defaultRenderPipelineConfig.acceleration.compositor

const normalizePositiveNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback

export const normalizeRenderPipelineConfig = (
  config?: RenderPipelineConfigContract | null,
): ResolvedRenderPipelineConfig => ({
  mode: normalizeMode(config?.mode),
  worker: normalizeWorkerMode(config?.worker),
  thresholds: {
    htmlBytes: normalizePositiveNumber(
      config?.thresholds?.htmlBytes,
      defaultRenderPipelineConfig.thresholds.htmlBytes,
    ),
    estimatedNodes: normalizePositiveNumber(
      config?.thresholds?.estimatedNodes,
      defaultRenderPipelineConfig.thresholds.estimatedNodes,
    ),
    itemCount: normalizePositiveNumber(
      config?.thresholds?.itemCount,
      defaultRenderPipelineConfig.thresholds.itemCount,
    ),
  },
  budget: {
    frameMs: normalizePositiveNumber(
      config?.budget?.frameMs,
      defaultRenderPipelineConfig.budget.frameMs,
    ),
    overscanPx: normalizePositiveNumber(
      config?.budget?.overscanPx,
      defaultRenderPipelineConfig.budget.overscanPx,
    ),
    measureBatch: Math.max(
      1,
      Math.floor(
        normalizePositiveNumber(
          config?.budget?.measureBatch,
          defaultRenderPipelineConfig.budget.measureBatch,
        ),
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
        normalizePositiveNumber(
          config?.acceleration?.layerBudget,
          defaultRenderPipelineConfig.acceleration.layerBudget,
        ),
      ),
    ),
  },
})

export const isRenderPipelineConfigValid = (
  config: RenderPipelineConfigContract,
) =>
  (!config.mode || renderPipelineModes.includes(config.mode)) &&
  (!config.worker || renderPipelineWorkerModes.includes(config.worker)) &&
  (!config.acceleration?.mode ||
    renderPipelineHardwareModes.includes(config.acceleration.mode)) &&
  (!config.acceleration?.compositor ||
    renderPipelineCompositorModes.includes(config.acceleration.compositor)) &&
  (!config.acceleration?.contentVisibility ||
    renderPipelineCompositorModes.includes(
      config.acceleration.contentVisibility,
    ))
