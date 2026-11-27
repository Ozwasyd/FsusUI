import { unref } from 'vue'
import {
  resolveFsusRenderPipelineCache,
  resolveFsusRenderPipelineUnitAttrs,
  useFsusRenderPipelineRuntime,
} from '@element-plus/hooks'
import { resolveVirtualLayerBudget } from './use-cache'

import type { FsusRenderPipelineRuntimeOptions } from '@element-plus/hooks'

export const useVirtualRenderPipeline = <Source>(
  options: FsusRenderPipelineRuntimeOptions<Source, unknown>,
) => {
  const runtime = useFsusRenderPipelineRuntime(options)
  const resolveCache = (estimatedItemSize: number, explicitCache?: number) =>
    resolveFsusRenderPipelineCache({
      budgeted: unref(options.config) !== undefined,
      config: runtime.config.value,
      estimatedItemSize,
      explicitCache,
      strategy: runtime.strategy.value,
    })

  const resolveHardwareAttrs = (renderedCount: number, unitArea: number) => {
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio
    const layerBudget = resolveVirtualLayerBudget({
      configuredBudget: runtime.config.value.acceleration.layerBudget,
      devicePixelRatio: dpr,
      unitArea,
    })
    return {
      ...resolveFsusRenderPipelineUnitAttrs({
        baseAttrs: runtime.hardwareAttrs.value,
        disableContentVisibilityOnOverflow: true,
        layerBudget,
        renderedCount,
      }),
      'data-fsus-render-layer-pixels': String(
        Math.round(unitArea * renderedCount * Math.max(1, dpr) ** 2),
      ),
    }
  }

  return { runtime, resolveCache, resolveHardwareAttrs }
}
