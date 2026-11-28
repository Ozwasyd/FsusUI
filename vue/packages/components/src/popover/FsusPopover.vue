<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  addUnit,
  useClickOutside,
  useDelayedToggle,
  useEscapeKeydown,
  useFloating,
  useFsusId,
  useFsusZIndex,
  type FsusPlacement,
} from '@fsusui/core'

defineOptions({ name: 'FsusPopover' })

export interface FsusPopoverProps {
  title?: string
  content?: string
  placement?: FsusPlacement
  trigger?: 'click' | 'hover' | 'focus' | 'manual'
  width?: number | string
  offset?: number
  disabled?: boolean
  teleported?: boolean
  matchWidth?: boolean
}

const {
  title,
  content,
  placement = 'bottom',
  trigger = 'click',
  width,
  offset = 8,
  disabled = false,
  teleported = true,
  matchWidth = false,
} = defineProps<FsusPopoverProps>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ open: []; close: [] }>()

const panelId = useFsusId('popover')
const referenceRef = ref<HTMLElement | null>(null)
const floatingRef = ref<HTMLElement | null>(null)
const { currentZIndex, nextZIndex } = useFsusZIndex()

const setOpen = (next: boolean) => {
  if (disabled && next) return
  if (open.value === next) return
  if (next) nextZIndex()
  open.value = next
  if (next) emit('open')
  else emit('close')
}

const { onOpen, onClose } = useDelayedToggle({
  open: () => setOpen(true),
  close: () => setOpen(false),
  showAfter: 80,
  hideAfter: 120,
})

const { floatingStyle, placement: actualPlacement } = useFloating(referenceRef, floatingRef, {
  placement: computed(() => placement),
  offsetPx: computed(() => offset),
  matchWidth: computed(() => matchWidth),
  open,
})

useClickOutside(
  computed(() => [referenceRef.value, floatingRef.value]),
  () => {
    if (trigger !== 'manual') setOpen(false)
  },
  open,
)

useEscapeKeydown(() => {
  if (trigger !== 'manual') setOpen(false)
}, open)

const panelStyle = computed(() => ({
  ...floatingStyle.value,
  zIndex: currentZIndex.value,
  ...(width !== undefined ? { width: addUnit(width) } : {}),
}))

defineExpose({ open, setOpen })
</script>

<template>
  <span
    ref="referenceRef"
    class="fsus-popover__trigger"
    :aria-expanded="open ? 'true' : 'false'"
    :aria-controls="open ? panelId : undefined"
    @click="trigger === 'click' && setOpen(!open)"
    @mouseenter="trigger === 'hover' && onOpen()"
    @mouseleave="trigger === 'hover' && onClose()"
    @focusin="trigger === 'focus' && setOpen(true)"
    @focusout="trigger === 'focus' && setOpen(false)"
  >
    <slot name="reference" />
  </span>
  <Teleport to="body" :disabled="!teleported">
    <div
      v-if="open && !disabled"
      :id="panelId"
      ref="floatingRef"
      class="fsus-popover"
      role="dialog"
      :data-placement="actualPlacement"
      :style="panelStyle"
      @mouseenter="trigger === 'hover' && onOpen()"
      @mouseleave="trigger === 'hover' && onClose()"
    >
      <div v-if="$slots.title || title" class="fsus-popover__title">
        <slot name="title">{{ title }}</slot>
      </div>
      <div class="fsus-popover__body">
        <slot>{{ content }}</slot>
      </div>
    </div>
  </Teleport>
</template>
