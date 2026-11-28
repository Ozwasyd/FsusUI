<script setup lang="ts">
import { computed } from 'vue'
import { addUnit, type FsusSize } from '@fsusui/core'

defineOptions({ name: 'FsusSpace' })

export interface FsusSpaceProps {
  direction?: 'horizontal' | 'vertical'
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
  gap?: FsusSize | number | string | [number | string, number | string]
  wrap?: boolean
  fill?: boolean
}

const {
  direction = 'horizontal',
  align,
  justify,
  gap = 'sm',
  wrap = false,
  fill = false,
} = defineProps<FsusSpaceProps>()

const gapTokenMap: Record<FsusSize, string> = {
  sm: 'var(--fsus-space-2)',
  md: 'var(--fsus-space-3)',
  lg: 'var(--fsus-space-4)',
}

const resolveGap = (val: FsusSize | number | string) =>
  val in gapTokenMap ? gapTokenMap[val as FsusSize] : (addUnit(val) ?? '8px')

const style = computed(() => {
  const gapStr = Array.isArray(gap)
    ? `${resolveGap(gap[1])} ${resolveGap(gap[0])}`
    : resolveGap(gap)
  return { gap: gapStr }
})
</script>

<template>
  <div
    class="fsus-space"
    :data-direction="direction"
    :data-align="align"
    :data-justify="justify"
    :data-wrap="wrap ? '' : undefined"
    :data-fill="fill ? '' : undefined"
    :style="style"
  >
    <slot />
  </div>
</template>
