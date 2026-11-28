<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  addUnit,
  useEscapeKeydown,
  useFocusTrap,
  useFsusId,
  useFsusLocale,
  useFsusZIndex,
  useScrollLock,
} from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

defineOptions({ name: 'FsusDialog' })

export interface FsusDialogProps {
  title?: string
  width?: string | number
  fullscreen?: boolean
  modal?: boolean
  closeOnClickBackdrop?: boolean
  closeOnEscape?: boolean
  showClose?: boolean
  lockScroll?: boolean
  teleported?: boolean
  destroyOnClose?: boolean
  beforeClose?: (done: () => void) => void
}

const {
  title = '',
  width = '520px',
  fullscreen = false,
  modal = true,
  closeOnClickBackdrop = true,
  closeOnEscape = true,
  showClose = true,
  lockScroll = true,
  teleported = true,
  destroyOnClose = false,
  beforeClose,
} = defineProps<FsusDialogProps>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ open: []; close: [] }>()

const titleId = useFsusId('dialog-title')
const panelRef = ref<HTMLElement | null>(null)
const rendered = ref(open.value)
const { t } = useFsusLocale()
const { currentZIndex, nextZIndex } = useFsusZIndex()

watch(
  open,
  (val) => {
    if (val) {
      rendered.value = true
      nextZIndex()
      emit('open')
    } else {
      emit('close')
      if (destroyOnClose) rendered.value = false
    }
  },
  { immediate: true },
)

const requestClose = () => {
  if (!open.value) return
  if (beforeClose) {
    beforeClose(() => {
      open.value = false
    })
  } else {
    open.value = false
  }
}

useScrollLock(computed(() => open.value && lockScroll && modal))
useFocusTrap(panelRef, computed(() => open.value && modal))
useEscapeKeydown(
  () => {
    if (closeOnEscape) requestClose()
  },
  open,
)

const panelStyle = computed(() =>
  fullscreen ? undefined : { width: addUnit(width) },
)
</script>

<template>
  <Teleport to="body" :disabled="!teleported">
    <div
      v-if="open || (rendered && !destroyOnClose)"
      v-show="open"
      class="fsus-overlay"
      :data-modal="modal ? '' : undefined"
      :style="{ zIndex: currentZIndex }"
    >
      <div
        v-if="modal"
        class="fsus-overlay__scrim"
        aria-hidden="true"
        @click="closeOnClickBackdrop && requestClose()"
      />
      <div
        class="fsus-dialog__host"
        @click.self="closeOnClickBackdrop && requestClose()"
      >
        <div
          ref="panelRef"
          class="fsus-dialog"
          role="dialog"
          :aria-modal="modal ? 'true' : undefined"
          :aria-labelledby="title || $slots.header ? titleId : undefined"
          tabindex="-1"
          :data-fullscreen="fullscreen ? '' : undefined"
          :style="panelStyle"
        >
          <header v-if="$slots.header || title || showClose" class="fsus-dialog__header">
            <h2 :id="titleId" class="fsus-dialog__title">
              <slot name="header">{{ title }}</slot>
            </h2>
            <button
              v-if="showClose"
              type="button"
              class="fsus-dialog__close"
              :aria-label="t('dialog.closeLabel')"
              @click="requestClose"
            >
              <FsusIcon name="close" :size="16" />
            </button>
          </header>
          <div class="fsus-dialog__body">
            <slot />
          </div>
          <footer v-if="$slots.footer" class="fsus-dialog__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </div>
  </Teleport>
</template>
