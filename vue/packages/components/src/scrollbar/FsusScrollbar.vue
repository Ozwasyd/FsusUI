<script setup lang="ts">
import { computed, ref } from 'vue'
import { addUnit } from '@fsusui/core'

defineOptions({ name: 'FsusScrollbar' })

export interface FsusScrollbarProps {
  height?: string | number
  maxHeight?: string | number
  always?: boolean
  tag?: string
  viewClass?: string
}

const { height, maxHeight, always = false, tag = 'div', viewClass } = defineProps<FsusScrollbarProps>()

const emit = defineEmits<{ scroll: [payload: { scrollTop: number; scrollLeft: number }] }>()

const wrapRef = ref<HTMLElement | null>(null)

const style = computed(() => ({
  height: addUnit(height),
  maxHeight: addUnit(maxHeight),
}))

const onScroll = () => {
  if (!wrapRef.value) return
  emit('scroll', {
    scrollTop: wrapRef.value.scrollTop,
    scrollLeft: wrapRef.value.scrollLeft,
  })
}

const scrollTo = (options: ScrollToOptions | number, y?: number) => {
  if (!wrapRef.value) return
  if (typeof options === 'number') wrapRef.value.scrollTo(options, y ?? 0)
  else wrapRef.value.scrollTo(options)
}

const setScrollTop = (value: number) => {
  if (wrapRef.value) wrapRef.value.scrollTop = value
}

const setScrollLeft = (value: number) => {
  if (wrapRef.value) wrapRef.value.scrollLeft = value
}

const update = () => {
  // Native CSS scrollbars recalculate automatically; kept for imperative ref callers.
}

defineExpose({ wrapRef, scrollTo, setScrollTop, setScrollLeft, update })
</script>

<template>
  <div class="fsus-scrollbar" :data-always="always ? '' : undefined">
    <div ref="wrapRef" class="fsus-scrollbar__wrap" :style="style" @scroll.passive="onScroll">
      <component :is="tag" :class="['fsus-scrollbar__view', viewClass]">
        <slot />
      </component>
    </div>
  </div>
</template>
