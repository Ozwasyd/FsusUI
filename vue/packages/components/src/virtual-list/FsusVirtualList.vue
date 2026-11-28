<script setup lang="ts" generic="T = unknown">
import { computed, ref } from 'vue'
import { addUnit } from '@fsusui/core'

defineOptions({ name: 'FsusVirtualList' })

const {
  items,
  itemHeight = 40,
  height = 320,
  overscan = 5,
  keyField,
} = defineProps<{
  items: readonly T[]
  itemHeight?: number
  height?: number | string
  overscan?: number
  keyField?: string
}>()

const containerRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

const viewportHeight = computed(() => (typeof height === 'number' ? height : 320))
const totalHeight = computed(() => items.length * itemHeight)

const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / itemHeight) - overscan),
)
const endIndex = computed(() =>
  Math.min(
    items.length,
    Math.ceil((scrollTop.value + viewportHeight.value) / itemHeight) + overscan,
  ),
)

const visibleItems = computed(() =>
  items.slice(startIndex.value, endIndex.value).map((item, offset) => ({
    item,
    index: startIndex.value + offset,
    key:
      keyField && item && typeof item === 'object' && keyField in (item as Record<string, unknown>)
        ? String((item as Record<string, unknown>)[keyField])
        : startIndex.value + offset,
  })),
)

const onScroll = (event: Event) => {
  scrollTop.value = (event.target as HTMLElement).scrollTop
}

const scrollToIndex = (index: number) => {
  if (!containerRef.value) return
  containerRef.value.scrollTop = Math.max(0, index * itemHeight)
}

defineExpose({ containerRef, scrollToIndex })
</script>

<template>
  <div
    ref="containerRef"
    class="fsus-virtual-list"
    :style="{ height: addUnit(height) }"
    @scroll.passive="onScroll"
  >
    <div class="fsus-virtual-list__spacer" :style="{ height: `${totalHeight}px` }">
      <div
        v-for="entry in visibleItems"
        :key="entry.key"
        class="fsus-virtual-list__item"
        :style="{ transform: `translateY(${entry.index * itemHeight}px)`, height: `${itemHeight}px` }"
      >
        <slot :item="entry.item" :index="entry.index" />
      </div>
    </div>
  </div>
</template>
