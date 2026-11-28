<script setup lang="ts">
import { ref } from 'vue'
import type { FsusTone } from '@fsusui/core'
import { FsusIcon, type FsusIconName } from '@fsusui/icons'

defineOptions({ name: 'FsusAlert' })

export interface FsusAlertProps {
  title?: string
  description?: string
  tone?: FsusTone
  closable?: boolean
  showIcon?: boolean
}

const {
  title = '',
  description = '',
  tone = 'info',
  closable = false,
  showIcon = true,
} = defineProps<FsusAlertProps>()

const emit = defineEmits<{ close: [] }>()
const visible = ref(true)

const toneIcon: Record<FsusTone, FsusIconName> = {
  neutral: 'info-filled',
  info: 'info-filled',
  success: 'circle-check-filled',
  warning: 'warning-filled',
  danger: 'circle-close-filled',
}

const handleClose = () => {
  visible.value = false
  emit('close')
}
</script>

<template>
  <div v-if="visible" class="fsus-alert" role="alert" :data-tone="tone">
    <FsusIcon v-if="showIcon" :name="toneIcon[tone]" class="fsus-alert__icon" />
    <div class="fsus-alert__body">
      <div v-if="$slots.title || title" class="fsus-alert__title">
        <slot name="title">{{ title }}</slot>
      </div>
      <div v-if="$slots.default || description" class="fsus-alert__description">
        <slot>{{ description }}</slot>
      </div>
    </div>
    <button
      v-if="closable"
      type="button"
      class="fsus-alert__close"
      aria-label="Close alert"
      @click="handleClose"
    >
      <FsusIcon name="close" :size="14" />
    </button>
  </div>
</template>
