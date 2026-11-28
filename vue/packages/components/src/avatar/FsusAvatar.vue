<script setup lang="ts">
import { computed, ref } from 'vue'
import { addUnit, type FsusSize } from '@fsusui/core'

defineOptions({ name: 'FsusAvatar' })

export interface FsusAvatarProps {
  src?: string
  alt?: string
  size?: FsusSize | number
  shape?: 'circle' | 'square'
  fit?: 'cover' | 'contain' | 'fill'
}

const props = defineProps<FsusAvatarProps>()
const src = computed(() => props.src)
const alt = computed(() => props.alt ?? '')
const shape = computed(() => props.shape ?? 'circle')
const fit = computed(() => props.fit ?? 'cover')

const failed = ref(false)
const sizePx = computed(() => {
  const s = props.size ?? 'md'
  return typeof s === 'number' ? addUnit(s) : s === 'sm' ? '32px' : s === 'lg' ? '48px' : '40px'
})
</script>

<template>
  <span
    class="fsus-avatar"
    :data-shape="shape"
    :style="{ width: sizePx, height: sizePx }"
  >
    <img
      v-if="src && !failed"
      class="fsus-avatar__img"
      :src="src"
      :alt="alt"
      :style="{ objectFit: fit }"
      @error="failed = true"
    />
    <span v-else class="fsus-avatar__fallback">
      <slot>{{ alt.slice(0, 2).toUpperCase() }}</slot>
    </span>
  </span>
</template>
