import { computed, onBeforeUnmount, onMounted, ref, shallowRef, unref } from 'vue'
import type { MaybeRef } from 'vue'
import {
  createFsusRafRefreshSampler,
  estimateFsusRenderRefreshProfile,
  normalizeHardwareMode,
  positive,
  readRenderPipelineNow,
  resolveFsusRenderPipelineConfig,
} from './config'
import type {
  FsusRenderCapabilityProfile,
  FsusRenderComputeProfile,
  FsusRenderHardwareProfile,
  FsusRenderMemoryProfile,
  FsusRenderMotionMode,
  FsusRenderPipelineConfig,
  FsusRenderPipelineDomAttrs,
  FsusRenderPipelineUnitAttrsOptions,
  FsusRenderRefreshProfile,
  FsusResolvedRenderPipelineConfig,
} from './types'

export const canCreateWorker = () =>
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

export const isRenderPipelineLowPower = () => renderPipelineLowPower

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
