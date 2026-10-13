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
    // Bind once: replacing an external prop is not a controlled producer write.
    const producer = props.configProducer
    const localConfig = computed(() =>
      producer ? producer.config.value : props
    )

    watch(
      () => localConfig.value.message,
      (val) => {
        Object.assign(messageConfig, val ?? {})
      },
      { immediate: true, deep: true },
    )

    watch(
      computed(
        () =>
          localConfig.value.themeMode ??
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
          localConfig.value.motion ??
          parentConfig?.value?.motion ??
          inheritedMotionAtSetup
      ),
      (motion) => {
        syncMotionConfig(motion)
      },
      { immediate: true, deep: true },
    )

    onBeforeUnmount(() => {
      if (localConfig.value.themeMode !== undefined) {
        const fallbackThemeMode =
          parentConfig?.value?.themeMode ?? inheritedThemeModeAtSetup
        if (fallbackThemeMode) {
          syncThemeMode(fallbackThemeMode)
        } else {
          clearThemeMode()
        }
      }

      if (localConfig.value.motion !== undefined) {
        const fallbackMotion = parentConfig?.value?.motion ?? inheritedMotionAtSetup
        if (fallbackMotion) {
          syncMotionConfig(fallbackMotion)
        } else {
          clearMotionConfig()
        }
      }
    })

    const config = provideGlobalConfig(producer ?? props)
    return () => renderSlot(slots, 'default', { config: config?.value })
  },
})
export type ConfigProviderInstance = InstanceType<typeof ConfigProvider>

export default ConfigProvider
