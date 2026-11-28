<script setup lang="ts">
import { computed } from 'vue'
import { syncThemeMode, themeModes, type FsusSize, type ThemeMode } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

defineOptions({ name: 'FsusThemeModeToggle' })

export interface FsusThemeModeToggleProps {
  size?: FsusSize
  disabled?: boolean
  syncDocument?: boolean
  labels?: Partial<Record<ThemeMode, string>>
}

const {
  size = 'md',
  disabled = false,
  syncDocument = true,
  labels,
} = defineProps<FsusThemeModeToggleProps>()

const model = defineModel<ThemeMode>({ default: 'system' })

const emit = defineEmits<{ change: [mode: ThemeMode] }>()

const iconMap: Record<ThemeMode, 'sunny' | 'moon' | 'monitor'> = {
  light: 'sunny',
  dark: 'moon',
  system: 'monitor',
}

const currentLabel = computed(() => {
  const mode = model.value
  return labels?.[mode] ?? (mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System')
})

const cycle = () => {
  if (disabled) return
  const idx = themeModes.indexOf(model.value)
  const next = themeModes[(idx + 1) % themeModes.length]!
  model.value = next
  if (syncDocument) syncThemeMode(next)
  emit('change', next)
}
</script>

<template>
  <button
    type="button"
    class="fsus-theme-toggle"
    :data-size="size"
    :data-mode="model"
    :disabled="disabled"
    :aria-label="`Theme mode: ${currentLabel}`"
    @click="cycle"
  >
    <FsusIcon :name="iconMap[model]" />
    <slot :mode="model" :label="currentLabel">
      <span class="fsus-theme-toggle__label">{{ currentLabel }}</span>
    </slot>
  </button>
</template>
