<template>
  <div :class="summaryKls" v-bind="summaryAttrs">
    <div :class="ns.e('main')">
      <component
        :is="titleTag"
        v-if="title || $slots.title"
        :class="ns.e('title')"
      >
        <slot name="title">{{ title }}</slot>
      </component>

      <span v-if="countText || $slots.count" :class="ns.e('count')">
        <slot name="count">{{ countText }}</slot>
      </span>
    </div>

    <div v-if="state || $slots.meta" :class="ns.e('meta')">
      <slot name="meta">{{ state }}</slot>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { collectionSummaryProps } from './collection-summary'

defineOptions({
  name: 'ElCollectionSummary',
})

const props = defineProps(collectionSummaryProps)
const ns = useNamespace('collection-summary')

const countText = computed(() => {
  const hasTotal = typeof props.total === 'number'
  const hasVisible = typeof props.visible === 'number'

  if (!hasTotal && !hasVisible) return ''
  if (hasTotal && hasVisible && props.visible !== props.total) {
    return `${props.visible} of ${props.total} items`
  }

  const count = hasVisible ? props.visible : props.total
  return `${count} ${count === 1 ? 'item' : 'items'}`
})

const summaryKls = computed(() => [ns.b(), ns.m(props.density)])
const summaryAttrs = computed(() => ({
  role: props.ariaLive === 'off' ? undefined : 'status',
  'aria-live': props.ariaLive === 'off' ? undefined : props.ariaLive,
}))
</script>
