<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useDelayedToggle,
  useFloating,
  useFsusId,
  useFsusZIndex,
  type FsusPlacement,
} from '@fsusui/core'

defineOptions({ name: 'FsusTooltip' })

export interface FsusTooltipProps {
  content?: string
  placement?: FsusPlacement
  trigger?: 'hover' | 'focus' | 'click' | 'manual'
  disabled?: boolean
  showAfter?: number
  hideAfter?: number
  offset?: number
  teleported?: boolean
  tone?: 'dark' | 'light'
}

const {
  content = '',
  placement = 'top',
  trigger = 'hover',
  disabled = false,
  showAfter = 120,
  hideAfter = 80,
  offset = 8,
  teleported = true,
  tone = 'dark',
} = defineProps<FsusTooltipProps>()

const open = defineModel<boolean>('open', { default: false })
const tooltipId = useFsusId('tooltip')
const referenceRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)
const { currentZIndex, nextZIndex } = useFsusZIndex()

const setOpen = (next: boolean) => {
  if (disabled && next) return
  if (next) nextZIndex()
  open.value = next
}

const { onOpen, onClose } = useDelayedToggle({
  open: () => setOpen(true),
  close: () => setOpen(false),
  showAfter: computed(() => showAfter),
  hideAfter: computed(() => hideAfter),
})

const { floatingStyle, placement: actualPlacement } = useFloating(referenceRef, floatingRef, {
  placement: computed(() => placement),
  offsetPx: computed(() => offset),
  open,
})

const onMouseEnter = () => {
  if (trigger === 'hover') onOpen()
}
const onMouseLeave = () => {
  if (trigger === 'hover') onClose()
}
const onFocusIn = () => {
  if (trigger === 'hover' || trigger === 'focus') onOpen()
}
const onFocusOut = () => {
  if (trigger === 'hover' || trigger === 'focus') onClose()
}
const onClick = () => {
  if (trigger === 'click') setOpen(!open.value)
}
</script>

<template>
  <span
    ref="referenceRef"
    class="fsus-tooltip__trigger"
    :aria-describedby="open ? tooltipId : undefined"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @click="onClick"
  >
    <slot />
  </span>
  <Teleport to="body" :disabled="!teleported">
    <div
      v-if="open && !disabled && ($slots.content || content)"
      :id="tooltipId"
      ref="floatingRef"
      role="tooltip"
      class="fsus-tooltip"
      :data-tone="tone"
      :data-placement="actualPlacement"
      :style="{ ...floatingStyle, zIndex: currentZIndex }"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <slot name="content">{{ content }}</slot>
    </div>
  </Teleport>
</template>
