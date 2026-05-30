<template>
  <div
    :class="toggleKls"
    v-bind="{ 'data-theme-mode-visibility': visibility }"
  >
    <el-radio-group
      :model-value="selectedMode"
      :size="size"
      :label="label"
      @update:model-value="handleModeChange"
    >
      <el-radio-button
        v-for="option in options"
        :key="option.mode"
        :label="option.mode"
        v-bind="{ 'data-theme-mode': option.mode }"
      >
        {{ compact ? option.shortLabel : option.label }}
      </el-radio-button>
    </el-radio-group>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import {
  normalizeThemeMode,
  syncThemeMode,
} from '@element-plus/components/config-provider'
import { ElRadioButton, ElRadioGroup } from '@element-plus/components/radio'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { useNamespace } from '@element-plus/hooks'
import { themeModeToggleEmits, themeModeToggleProps } from './theme-mode-toggle'

import type { ThemeMode } from '@element-plus/components/config-provider'

defineOptions({
  name: 'ElThemeModeToggle',
})

const props = defineProps(themeModeToggleProps)
const emit = defineEmits(themeModeToggleEmits)

const ns = useNamespace('theme-mode-toggle')
const getInitialMode = () => {
  if (typeof document === 'undefined') {
    return normalizeThemeMode(props.defaultValue)
  }

  return normalizeThemeMode(
    document.documentElement.dataset.themeMode,
    normalizeThemeMode(props.defaultValue)
  )
}
const localMode = ref<ThemeMode>(getInitialMode())

const selectedMode = computed(() =>
  normalizeThemeMode(props.modelValue ?? localMode.value)
)
const toggleKls = computed(() => [
  ns.b(),
  ns.m(props.visibility),
  ns.is('compact', props.compact),
])
const options = [
  { mode: 'light', label: 'Light', shortLabel: 'L' },
  { mode: 'dark', label: 'Dark', shortLabel: 'D' },
  { mode: 'system', label: 'System', shortLabel: 'Sys' },
] satisfies Array<{
  mode: ThemeMode
  label: string
  shortLabel: string
}>

watch(
  selectedMode,
  (mode) => {
    syncThemeMode(mode)
  },
  { immediate: true }
)

const handleModeChange = (value: string | number | boolean) => {
  const mode = normalizeThemeMode(String(value), selectedMode.value)
  localMode.value = mode
  emit(UPDATE_MODEL_EVENT, mode)
  emit(CHANGE_EVENT, mode)
}
</script>
