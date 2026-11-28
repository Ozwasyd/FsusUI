<script setup lang="ts">
import { computed, watch } from 'vue'
import {
  provideFsusConfig,
  syncThemeMode,
  type FsusLocale,
  type FsusMotionConfig,
  type FsusSize,
  type ThemeMode,
} from '@fsusui/core'

defineOptions({ name: 'FsusConfigProvider' })

export interface FsusConfigProviderProps {
  locale?: FsusLocale
  size?: FsusSize
  zIndex?: number
  themeMode?: ThemeMode
  motion?: FsusMotionConfig
}

const { locale, size, zIndex, themeMode, motion } = defineProps<FsusConfigProviderProps>()

provideFsusConfig(
  computed(() => ({
    ...(locale !== undefined ? { locale } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(zIndex !== undefined ? { zIndex } : {}),
    ...(themeMode !== undefined ? { themeMode } : {}),
    ...(motion !== undefined ? { motion } : {}),
  })),
)

watch(
  () => themeMode,
  (mode) => {
    if (mode) syncThemeMode(mode)
  },
  { immediate: true },
)

watch(
  () => motion,
  (cfg) => {
    if (typeof document === 'undefined' || !cfg) return
    if (cfg.mode) document.documentElement.dataset.fsusMotion = cfg.mode
    if (cfg.preset) document.documentElement.dataset.fsusMotionPreset = cfg.preset
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <slot />
</template>
