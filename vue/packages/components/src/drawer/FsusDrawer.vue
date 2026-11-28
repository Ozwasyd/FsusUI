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

defineOptions({ name: 'FsusDrawer' })

export interface FsusDrawerProps {
  title?: string
  placement?: 'right' | 'left' | 'top' | 'bottom'
  size?: string | number
  modal?: boolean
  closeOnClickBackdrop?: boolean
  closeOnEscape?: boolean
  showClose?: boolean
  lockScroll?: boolean
  teleported?: boolean
  beforeClose?: (done: () => void) => void
}

const {
  title = '',
  placement = 'right',
  size = '380px',
  modal = true,
  closeOnClickBackdrop = true,
  closeOnEscape = true,
  showClose = true,
  lockScroll = true,
  teleported = true,
  beforeClose,
} = defineProps<FsusDrawerProps>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ open: []; close: [] }>()

const titleId = useFsusId('drawer-title')
const panelRef = ref<HTMLElement | null>(null)
const { t } = useFsusLocale()
const { currentZIndex, nextZIndex } = useFsusZIndex()

watch(open, (val) => {
  if (val) {
    nextZIndex()
    emit('open')
  } else {
    emit('close')
  }
})

const requestClose = () => {
  if (!open.value) return
  if (beforeClose) beforeClose(() => (open.value = false))
  else open.value = false
}

useScrollLock(computed(() => open.value && lockScroll && modal))
useFocusTrap(panelRef, computed(() => open.value && modal))
useEscapeKeydown(() => closeOnEscape && requestClose(), open)

const isHorizontal = computed(() => placement === 'left' || placement === 'right')
const drawerStyle = computed(() =>
  isHorizontal.value ? { width: addUnit(size) } : { height: addUnit(size) },
)
</script>

<template>
  <Teleport to="body" :disabled="!teleported">
    <div v-if="open" class="fsus-overlay" :style="{ zIndex: currentZIndex }">
      <div
        v-if="modal"
        class="fsus-overlay__scrim"
        aria-hidden="true"
        @click="closeOnClickBackdrop && requestClose()"
      />
      <aside
        ref="panelRef"
        class="fsus-drawer"
        role="dialog"
        :aria-modal="modal ? 'true' : undefined"
        :aria-labelledby="title || $slots.header ? titleId : undefined"
        tabindex="-1"
        :data-placement="placement"
        :style="drawerStyle"
      >
        <header v-if="$slots.header || title || showClose" class="fsus-drawer__header">
          <h2 :id="titleId" class="fsus-drawer__title">
            <slot name="header">{{ title }}</slot>
          </h2>
          <button
            v-if="showClose"
            type="button"
            class="fsus-drawer__close"
            :aria-label="t('dialog.closeLabel')"
            @click="requestClose"
          >
            <FsusIcon name="close" :size="16" />
          </button>
        </header>
        <div class="fsus-drawer__body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="fsus-drawer__footer">
          <slot name="footer" />
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
