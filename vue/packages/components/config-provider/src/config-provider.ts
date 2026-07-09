import {
  computed,
  defineComponent,
  inject,
  onBeforeUnmount,
  renderSlot,
  watch,
} from 'vue'
import { provideGlobalConfig } from './hooks/use-global-config'
import { configProviderContextKey } from './constants'
import { configProviderProps } from './config-provider-props'
import { clearMotionConfig, syncMotionConfig } from './motion'
import { clearThemeMode, syncThemeMode } from './theme-mode'

import type { MessageConfigContract } from './config-contract'

export const messageConfig: MessageConfigContract = {}

const ConfigProvider = defineComponent({
  name: 'ElConfigProvider',
  props: configProviderProps,

  setup(props, { slots }) {
    const parentConfig = inject(configProviderContextKey, undefined)
    const inheritedThemeModeAtSetup = parentConfig?.value?.themeMode
    const inheritedMotionAtSetup = parentConfig?.value?.motion

    watch(
      () => props.message,
      (val) => {
        Object.assign(messageConfig, val ?? {})
      },
      { immediate: true, deep: true },
    )

    watch(
      computed(
        () =>
          props.themeMode ??
          parentConfig?.value?.themeMode ??
          inheritedThemeModeAtSetup
      ),
      (mode) => {
        if (!mode) return
        syncThemeMode(mode)
      },
      { immediate: true },
    )

    watch(
      computed(
        () =>
          props.motion ?? parentConfig?.value?.motion ?? inheritedMotionAtSetup
      ),
      (motion) => {
        syncMotionConfig(motion)
      },
      { immediate: true, deep: true },
    )

    onBeforeUnmount(() => {
      if (props.themeMode !== undefined) {
        const fallbackThemeMode =
          parentConfig?.value?.themeMode ?? inheritedThemeModeAtSetup
        if (fallbackThemeMode) {
          syncThemeMode(fallbackThemeMode)
        } else {
          clearThemeMode()
        }
      }

      if (props.motion !== undefined) {
        const fallbackMotion = parentConfig?.value?.motion ?? inheritedMotionAtSetup
        if (fallbackMotion) {
          syncMotionConfig(fallbackMotion)
        } else {
          clearMotionConfig()
        }
      }
    })

    const config = provideGlobalConfig(props)
    return () => renderSlot(slots, 'default', { config: config?.value })
  },
})
export type ConfigProviderInstance = InstanceType<typeof ConfigProvider>

export default ConfigProvider
