<template>
  <div :class="collectionKls">
    <div
      v-if="shouldRenderDesktop"
      v-show="shouldShowDesktop"
      :class="ns.e('desktop')"
    >
      <slot name="table" :items="items" :compact="false" />
    </div>

    <div
      v-if="shouldRenderCompact"
      v-show="shouldShowCompact"
      :class="ns.e('compact')"
      role="list"
      :aria-label="ariaLabel"
    >
      <template v-if="items.length > 0">
        <template v-for="(item, index) in items" :key="getItemKey(item, index)">
          <slot name="card" :item="item" :index="index" :compact="true">
            <slot name="item" :item="item" :index="index" :compact="true" />
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
const renderedDesktop = ref(false)
const renderedCompact = ref(false)

let media: MediaQueryList | undefined
let removeMediaListener: (() => void) | undefined

const isCompact = computed(() => props.compact ?? mediaCompact.value)
const collectionKls = computed(() => [
  ns.b(),
  ns.is('compact', isCompact.value),
])
const shouldShowDesktop = computed(() => {
  if (props.renderStrategy === 'desktop-only') return true
  if (props.renderStrategy === 'compact-only') return false
  return !isCompact.value
})
const shouldShowCompact = computed(() => {
  if (props.renderStrategy === 'compact-only') return true
  if (props.renderStrategy === 'desktop-only') return false
  return isCompact.value
})
const shouldRenderDesktop = computed(() => {
  switch (props.renderStrategy) {
    case 'show-both':
    case 'desktop-only':
      return true
    case 'compact-only':
      return false
    default:
      return !isCompact.value || renderedDesktop.value
  }
})
const shouldRenderCompact = computed(() => {
  switch (props.renderStrategy) {
    case 'show-both':
    case 'compact-only':
      return true
    case 'desktop-only':
      return false
    default:
      return isCompact.value || renderedCompact.value
  }
})

const rememberRenderedBranch = () => {
  if (isCompact.value) {
    renderedCompact.value = true
  } else {
    renderedDesktop.value = true
  }
}

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
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    mediaCompact.value = false
    return
  }

  media = window.matchMedia(props.compactQuery)
  syncMediaCompact()
  const handleChange = () => syncMediaCompact()

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handleChange)
    removeMediaListener = () =>
      media?.removeEventListener('change', handleChange)
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
watch([isCompact, () => props.renderStrategy], rememberRenderedBranch, {
  immediate: true,
})
</script>
