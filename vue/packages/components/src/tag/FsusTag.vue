<script setup lang="ts">
import type { FsusSize, FsusTone } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

defineOptions({ name: 'FsusTag' })

export interface FsusTagProps {
  tone?: FsusTone
  size?: FsusSize
  variant?: 'subtle' | 'solid' | 'outline'
  closable?: boolean
  pill?: boolean
  disabled?: boolean
}

const {
  tone = 'neutral',
  size = 'md',
  variant = 'subtle',
  closable = false,
  pill = false,
  disabled = false,
} = defineProps<FsusTagProps>()

const emit = defineEmits<{ close: [event: MouseEvent]; click: [event: MouseEvent] }>()
</script>

<template>
  <span
    class="fsus-tag"
    :data-tone="tone"
    :data-size="size"
    :data-variant="variant"
    :data-pill="pill ? '' : undefined"
    :data-disabled="disabled ? '' : undefined"
    @click="!disabled && emit('click', $event)"
  >
    <span class="fsus-tag__content"><slot /></span>
    <button
      v-if="closable && !disabled"
      type="button"
      class="fsus-tag__close"
      aria-label="Remove"
      @click.stop="emit('close', $event)"
    >
      <FsusIcon name="close" :size="12" />
    </button>
  </span>
</template>
