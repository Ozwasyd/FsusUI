import { computed, inject, provide, ref, unref, useId as vueUseId } from 'vue'
import { zhCN, formatLocaleText, type FsusLocale } from '../locale'
import { getByPath } from '../utils'
import type { ComputedRef, InjectionKey, MaybeRef } from 'vue'
import type { FsusSize } from '../constants'
import type { ThemeMode } from '../theme/theme-mode'

export interface FsusMotionConfig {
  mode?: 'enabled' | 'reduced' | 'disabled'
  preset?: 'standard' | 'smooth' | 'expressive'
  budget?: {
    maxStaggerItems?: number
    maxAnimatedNodesPerViewport?: number
  }
}

export interface FsusConfigContext {
  locale?: FsusLocale
  size?: FsusSize
  zIndex?: number
  themeMode?: ThemeMode
  motion?: FsusMotionConfig
}

export const FSUS_CONFIG_KEY: InjectionKey<ComputedRef<FsusConfigContext>> =
  Symbol('fsus-config')

const globalConfig = ref<FsusConfigContext>({})

export const setFsusGlobalConfig = (config: FsusConfigContext): void => {
  globalConfig.value = { ...globalConfig.value, ...config }
}

export const getFsusGlobalConfig = (): FsusConfigContext => globalConfig.value

export const provideFsusConfig = (
  config: MaybeRef<FsusConfigContext>,
): ComputedRef<FsusConfigContext> => {
  const parent = inject(FSUS_CONFIG_KEY, undefined)
  const merged = computed<FsusConfigContext>(() => ({
    ...globalConfig.value,
    ...parent?.value,
    ...unref(config),
  }))
  provide(FSUS_CONFIG_KEY, merged)
  return merged
}

export const useFsusConfig = (): ComputedRef<FsusConfigContext> =>
  inject(FSUS_CONFIG_KEY, computed(() => globalConfig.value))

export const useFsusSize = (
  explicit?: MaybeRef<FsusSize | undefined>,
  fallback?: MaybeRef<FsusSize | undefined>,
): ComputedRef<FsusSize> => {
  const config = useFsusConfig()
  return computed<FsusSize>(
    () => unref(explicit) ?? unref(fallback) ?? config.value.size ?? 'md',
  )
}

export const useFsusLocale = (
  override?: MaybeRef<FsusLocale | undefined>,
) => {
  const config = useFsusConfig()
  const locale = computed<FsusLocale>(() => unref(override) ?? config.value.locale ?? zhCN)
  const t = (path: string, params?: Record<string, string | number>): string => {
    const raw = getByPath<string>(locale.value, path) ?? path
    return formatLocaleText(String(raw), params)
  }
  return { locale, t }
}

let zIndexCounter = 0

export const useFsusZIndex = (initialOverride?: MaybeRef<number | undefined>) => {
  const config = useFsusConfig()
  const initialZIndex = computed(() => unref(initialOverride) ?? config.value.zIndex ?? 2000)
  const currentZIndex = ref(initialZIndex.value + zIndexCounter)
  const nextZIndex = (): number => {
    zIndexCounter += 1
    currentZIndex.value = initialZIndex.value + zIndexCounter
    return currentZIndex.value
  }
  return {
    initialZIndex,
    currentZIndex,
    nextZIndex,
  }
}

export const resetFsusZIndex = (): void => {
  zIndexCounter = 0
}

export const useFsusId = (prefix = 'fsus'): string => {
  const nativeId = vueUseId()
  return `${prefix}-${nativeId}`
}
