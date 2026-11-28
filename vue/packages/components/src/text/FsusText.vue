<script setup lang="ts">
import { computed } from 'vue'
import type { FsusSize, FsusTone } from '@fsusui/core'

defineOptions({ name: 'FsusText' })

export interface FsusTextProps {
  tag?: string
  tone?: FsusTone | 'muted' | 'quiet'
  size?: FsusSize
  truncated?: boolean
  lineClamp?: number
  weight?: 400 | 500 | 700
}

const {
  tag = 'span',
  tone = 'neutral',
  size = 'md',
  truncated = false,
  lineClamp,
  weight,
} = defineProps<FsusTextProps>()

const style = computed(() => {
  const s: Record<string, string | number> = {}
  if (lineClamp && lineClamp > 0) {
    s.WebkitLineClamp = lineClamp
  }
  if (weight) {
    s.fontWeight = weight
  }
  return Object.keys(s).length ? s : undefined
})
</script>

<template>
  <component
    :is="tag"
    class="fsus-text"
    :data-tone="tone"
    :data-size="size"
    :data-truncated="truncated ? '' : undefined"
    :data-clamp="lineClamp ? '' : undefined"
    :style="style"
  >
    <slot />
  </component>
</template>
