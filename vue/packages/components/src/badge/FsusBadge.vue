<script setup lang="ts">
import { computed } from 'vue'
import type { FsusTone } from '@fsusui/core'

defineOptions({ name: 'FsusBadge' })

export interface FsusBadgeProps {
  value?: string | number
  max?: number
  dot?: boolean
  hidden?: boolean
  tone?: FsusTone
  showZero?: boolean
}

const {
  value = '',
  max = 99,
  dot = false,
  hidden = false,
  tone = 'danger',
  showZero = true,
} = defineProps<FsusBadgeProps>()

const content = computed(() => {
  if (dot) return ''
  if (typeof value === 'number') {
    if (value === 0 && !showZero) return ''
    return value > max ? `${max}+` : String(value)
  }
  return value
})

const isVisible = computed(() => !hidden && (dot || content.value !== ''))
</script>

<template>
  <span class="fsus-badge">
    <slot />
    <sup
      v-if="isVisible"
      class="fsus-badge__content"
      :data-tone="tone"
      :data-dot="dot ? '' : undefined"
      :data-standalone="!$slots.default ? '' : undefined"
    >
      {{ content }}
    </sup>
  </span>
</template>
