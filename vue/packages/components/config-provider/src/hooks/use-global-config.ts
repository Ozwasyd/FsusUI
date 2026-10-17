import { computed, getCurrentInstance, inject, ref, unref } from 'vue'
import {
  defaultInitialZIndex,
  defaultNamespace,
  useLocale,
  useNamespace,
  useZIndex,
} from '@element-plus/hooks'
import { configProviderContextKey } from '../constants'
import { createGlobalConfigRuntime } from './global-config-runtime'

import type { App, MaybeRef, Ref } from 'vue'
import type {
  ConfigProviderContext,
  GlobalConfigFeed,
  GlobalConfigSnapshotProducer,
} from '../constants'

// Reads keep the ordinary fallback path independent of publication machinery.
const globalConfig = ref<ConfigProviderContext>()
let runtime: ReturnType<typeof createGlobalConfigRuntime> | undefined
const getRuntime = () =>
  (runtime ??= createGlobalConfigRuntime(globalConfig, useGlobalConfig))

export function useGlobalConfig<
  K extends keyof ConfigProviderContext,
  D extends ConfigProviderContext[K]
>(
  key: K,
  defaultValue?: D
): Ref<Exclude<ConfigProviderContext[K], undefined> | D>
export function useGlobalConfig(): Ref<ConfigProviderContext | undefined>
export function useGlobalConfig(
  key?: keyof ConfigProviderContext,
  defaultValue = undefined
) {
  const config = getCurrentInstance()
    ? inject(configProviderContextKey, undefined) ?? globalConfig
    : globalConfig
  if (key) {
    const selected = computed(() => config.value?.[key] ?? defaultValue)
    runtime?.registerSelection(selected, config, key, defaultValue)
    return selected
  } else {
    return config
  }
}

// for components like `ElMessage` `ElNotification` `ElMessageBox`.
export function useGlobalComponentSettings(
  block: string,
  sizeFallback?: MaybeRef<ConfigProviderContext['size']>
) {
  const config = useGlobalConfig()

  const ns = useNamespace(
    block,
    computed(() => config.value?.namespace || defaultNamespace)
  )

  const locale = useLocale(computed(() => config.value?.locale))
  const zIndex = useZIndex(
    computed(() => config.value?.zIndex || defaultInitialZIndex)
  )
  const size = computed(() => unref(sizeFallback) || config.value?.size || '')
  provideGlobalConfig(computed(() => unref(config) || {}))

  return {
    ns,
    locale,
    zIndex,
    size,
  }
}

export const getGlobalConfigFeed = <T>(
  config: Readonly<Ref<T>>
): GlobalConfigFeed<T> | undefined => runtime?.getGlobalConfigFeed(config)

export const createGlobalConfigSnapshot = (
  initial: ConfigProviderContext
): GlobalConfigSnapshotProducer => getRuntime().createGlobalConfigSnapshot(initial)

export const releaseGlobalConfig = (
  context: Ref<ConfigProviderContext | undefined>
) => runtime?.releaseGlobalConfig(context) ?? false

export const provideGlobalConfig = (
  config: MaybeRef<ConfigProviderContext> | GlobalConfigSnapshotProducer,
  app?: App,
  global = false
) => getRuntime().provideGlobalConfig(config, app, global)
