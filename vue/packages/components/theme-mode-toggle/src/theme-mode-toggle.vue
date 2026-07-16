<template>
  <el-radio-group
    v-if="variant === 'segmented'"
    :class="toggleKls"
    :model-value="selectedMode"
    :size="size"
    :label="label"
    v-bind="{ 'data-theme-mode-visibility': visibility }"
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

  <div
    v-else
    ref="rootRef"
    :class="toggleKls"
    v-bind="{ 'data-theme-mode-visibility': visibility }"
  >
    <button
      ref="menuButtonRef"
      type="button"
      :class="ns.e('menu-button')"
      :aria-label="menuButtonAriaLabel"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      :aria-controls="menuId"
      @click="toggleMenu"
      @keydown="handleTriggerKeydown"
    >
      {{ currentOption.shortLabel }}
    </button>

    <div
      v-if="cspSafe || menuOpen"
      :id="menuId"
      ref="menuRef"
      :class="[
        ns.e('menu'),
        ns.is('csp-hidden', cspSafe && !menuOpen),
      ]"
      role="menu"
      :aria-label="label"
    >
      <button
        v-for="(option, index) in options"
        :key="option.mode"
        type="button"
        :class="[ns.e('menu-item'), ns.is('active', option.mode === selectedMode)]"
        role="menuitemradio"
        :aria-checked="option.mode === selectedMode"
        :tabindex="menuOpen && activeMenuIndex === index ? 0 : -1"
        v-bind="{ 'data-theme-mode': option.mode }"
        @click="handleMenuItemClick(option.mode)"
        @keydown="handleMenuItemKeydown($event, index, option.mode)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  normalizeThemeMode,
  syncThemeMode,
} from '@element-plus/components/config-provider'
import { ElRadioButton, ElRadioGroup } from '@element-plus/components/radio'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { useId, useNamespace } from '@element-plus/hooks'
import { themeModeToggleEmits, themeModeToggleProps } from './theme-mode-toggle'

import type { ThemeMode } from '@element-plus/components/config-provider'

defineOptions({
  name: 'ElThemeModeToggle',
})

const props = defineProps(themeModeToggleProps)
const emit = defineEmits(themeModeToggleEmits)

const ns = useNamespace('theme-mode-toggle')
const rootRef = ref<HTMLElement>()
const menuRef = ref<HTMLElement>()
const menuButtonRef = ref<HTMLButtonElement>()
const menuId = useId().value
const menuOpen = ref(false)
const activeMenuIndex = ref(0)
const getInitialMode = () => {
  if (typeof document === 'undefined') {
    return normalizeThemeMode(props.defaultValue)
  }

  return normalizeThemeMode(
    document.documentElement.dataset.themeMode,
    normalizeThemeMode(props.defaultValue),
  )
}
const localMode = ref<ThemeMode>(getInitialMode())

const selectedMode = computed(() =>
  normalizeThemeMode(props.modelValue ?? localMode.value),
)
const toggleKls = computed(() => [
  ns.b(),
  ns.m(props.visibility),
  ns.m(props.variant),
  ns.is('compact', props.compact),
])
const baseOptions = [
  { mode: 'light', label: 'Light', shortLabel: 'L' },
  { mode: 'dark', label: 'Dark', shortLabel: 'D' },
  { mode: 'system', label: 'System', shortLabel: 'Sys' },
] satisfies Array<{
  mode: ThemeMode
  label: string
  shortLabel: string
}>
const options = computed(() =>
  baseOptions.map((option) => ({
    ...option,
    label: props.labels[option.mode] ?? option.label,
    shortLabel:
      props.labels[`${option.mode}Short` as keyof typeof props.labels] ??
      option.shortLabel,
  })),
)
const selectedIndex = computed(() => {
  const index = options.value.findIndex((option) => option.mode === selectedMode.value)
  return index >= 0 ? index : 0
})
const currentOption = computed(
  () => options.value[selectedIndex.value] ?? options.value[0],
)
const menuButtonAriaLabel = computed(
  () => `${props.label}: ${currentOption.value.label}`,
)

watch(
  selectedMode,
  (mode) => {
    syncThemeMode(mode)
  },
  { immediate: true },
)

const commitMode = (mode: ThemeMode) => {
  localMode.value = mode
  emit(UPDATE_MODEL_EVENT, mode)
  emit(CHANGE_EVENT, mode)
}

const handleModeChange = (value: string | number | boolean) => {
  commitMode(normalizeThemeMode(String(value), selectedMode.value))
}

const focusMenuButton = async () => {
  await nextTick()
  menuButtonRef.value?.focus()
}

const focusMenuItem = async (index: number) => {
  activeMenuIndex.value = index
  await nextTick()
  const menuItems = menuRef.value?.querySelectorAll<HTMLButtonElement>(
    `.${ns.e('menu-item')}`,
  )
  menuItems?.[index]?.focus()
}

const openMenu = (index = selectedIndex.value) => {
  menuOpen.value = true
  void focusMenuItem(index)
}

const closeMenu = (restoreFocus = false) => {
  menuOpen.value = false
  if (restoreFocus) {
    void focusMenuButton()
  }
}

const toggleMenu = () => {
  if (menuOpen.value) {
    closeMenu(true)
    return
  }

  openMenu()
}

const handleTriggerKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    openMenu(selectedIndex.value)
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    openMenu((selectedIndex.value + options.value.length - 1) % options.value.length)
  }
}

const moveMenuFocus = (index: number) => {
  const nextIndex = (index + options.value.length) % options.value.length
  void focusMenuItem(nextIndex)
}

const handleMenuItemClick = (mode: ThemeMode) => {
  commitMode(mode)
  closeMenu(true)
}

const handleMenuItemKeydown = (
  event: KeyboardEvent,
  index: number,
  mode: ThemeMode,
) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveMenuFocus(index + 1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveMenuFocus(index - 1)
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    moveMenuFocus(0)
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    moveMenuFocus(options.value.length - 1)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu(true)
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleMenuItemClick(mode)
  }
}

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (!menuOpen.value) return

  const target = event.target
  if (target instanceof Node && rootRef.value?.contains(target)) return

  closeMenu()
}

watch(selectedIndex, (index) => {
  if (menuOpen.value) {
    activeMenuIndex.value = index
  }
})

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
})
</script>
