<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  normalizeThemeMode,
  syncThemeMode,
  themeModes,
  type FsusSize,
  type ThemeMode,
} from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

defineOptions({ name: 'FsusThemeModeToggle' })

export interface FsusThemeModeToggleProps {
  size?: FsusSize
  disabled?: boolean
  syncDocument?: boolean
  labels?: Partial<Record<ThemeMode, string>>
  visibility?: 'desktop' | 'mobile' | 'all'
  variant?: 'button' | 'segmented' | 'menu-button'
  compact?: boolean
  label?: string
}

const {
  size = 'md',
  disabled = false,
  syncDocument = true,
  labels,
  visibility,
  variant,
  compact = false,
  label,
} = defineProps<FsusThemeModeToggleProps>()

const model = defineModel<ThemeMode>({ default: 'system' })

const emit = defineEmits<{ change: [mode: ThemeMode] }>()

const iconMap: Record<ThemeMode, 'sunny' | 'moon' | 'monitor'> = {
  light: 'sunny',
  dark: 'moon',
  system: 'monitor',
}

const labelFor = (mode: ThemeMode) =>
  labels?.[mode] ?? (mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System')

const currentLabel = computed(() => labelFor(model.value))

const isSegmented = computed(
  () => variant === 'segmented' || (variant === undefined && visibility === 'desktop'),
)

onMounted(() => {
  if (!syncDocument || typeof document === 'undefined') return
  const docMode = document.documentElement.dataset.themeMode
  if (docMode) {
    model.value = normalizeThemeMode(docMode, model.value)
  }
})

const selectMode = (next: ThemeMode) => {
  if (disabled) return
  model.value = next
  if (syncDocument) syncThemeMode(next)
  emit('change', next)
}

const cycle = () => {
  if (disabled) return
  const idx = themeModes.indexOf(model.value)
  const next = themeModes[(idx + 1) % themeModes.length]!
  selectMode(next)
}
</script>

<template>
  <div
    v-if="isSegmented"
    class="fsus-theme-mode-toggle"
    role="group"
    :aria-label="label ?? 'Theme mode'"
    :data-size="size"
    :data-mode="model"
    :data-compact="compact ? '' : undefined"
    :data-theme-mode-visibility="visibility ?? 'desktop'"
  >
    <button
      v-for="mode in themeModes"
      :key="mode"
      type="button"
      class="fsus-theme-mode-toggle__btn"
      :data-theme-mode="mode"
      :aria-pressed="model === mode ? 'true' : 'false'"
      :aria-label="labelFor(mode)"
      :disabled="disabled"
      @click="selectMode(mode)"
    >
      <FsusIcon :name="iconMap[mode]" :size="14" />
      <span v-if="!compact">{{ labelFor(mode) }}</span>
    </button>
  </div>
  <button
    v-else
    type="button"
    class="fsus-theme-toggle"
    :data-size="size"
    :data-mode="model"
    :data-theme-mode-visibility="visibility"
    :disabled="disabled"
    :aria-label="`${label ?? 'Theme mode'}: ${currentLabel}`"
    @click="cycle"
  >
    <FsusIcon :name="iconMap[model]" />
    <slot :mode="model" :label="currentLabel">
      <span class="fsus-theme-toggle__label">{{ currentLabel }}</span>
    </slot>
  </button>
</template>
