<template>
  <div :class="collectionKls">
    <div v-show="!isCompact" :class="ns.e('desktop')">
      <slot name="table" :items="items" :compact="false" />
    </div>

    <div
      v-show="isCompact"
      :class="ns.e('compact')"
      role="list"
      :aria-label="ariaLabel"
    >
      <template v-if="items.length > 0">
        <template
          v-for="(item, index) in items"
          :key="getItemKey(item, index)"
        >
          <slot
            name="card"
            :item="item"
            :index="index"
            :compact="true"
          >
            <slot
              name="item"
              :item="item"
              :index="index"
              :compact="true"
            />
          </slot>
        </template>
      </template>
      <slot v-else name="empty" :compact="true" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { responsiveCollectionProps } from './responsive-collection'

defineOptions({
  name: 'ElResponsiveCollection',
})

const props = defineProps(responsiveCollectionProps)
const ns = useNamespace('responsive-collection')
const mediaCompact = ref(false)

let media: MediaQueryList | undefined
let removeMediaListener: (() => void) | undefined

const isCompact = computed(() => props.compact ?? mediaCompact.value)
const collectionKls = computed(() => [
  ns.b(),
  ns.is('compact', isCompact.value),
])

const syncMediaCompact = () => {
  mediaCompact.value = media?.matches ?? false
}

const stopMediaQuery = () => {
  removeMediaListener?.()
  removeMediaListener = undefined
  media = undefined
}

const startMediaQuery = () => {
  stopMediaQuery()
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    mediaCompact.value = false
    return
  }

  media = window.matchMedia(props.compactQuery)
  syncMediaCompact()
  const handleChange = () => syncMediaCompact()

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handleChange)
    removeMediaListener = () => media?.removeEventListener('change', handleChange)
    return
  }

  media.addListener(handleChange)
  removeMediaListener = () => media?.removeListener(handleChange)
}

const getItemKey = (item: unknown, index: number) => {
  if (typeof props.rowKey === 'function') {
    return props.rowKey(item, index)
  }

  if (
    props.rowKey !== undefined &&
    item !== null &&
    typeof item === 'object' &&
    props.rowKey in item
  ) {
    return (item as Record<string | number, unknown>)[props.rowKey] as
      | string
      | number
  }

  return index
}

onMounted(startMediaQuery)
onBeforeUnmount(stopMediaQuery)

watch(() => props.compactQuery, startMediaQuery)
</script>
