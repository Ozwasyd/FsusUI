<template>
  <div :class="itemKls" role="listitem">
    <div :class="ns.e('main')">
      <span v-if="hasLabel" :class="ns.e('label')">
        <slot name="label">{{ label }}</slot>
      </span>
      <strong v-if="hasPrimary" :class="ns.e('primary')">
        <slot name="primary">{{ primary }}</slot>
      </strong>
    </div>
    <div v-if="hasSecondary" :class="ns.e('secondary')">
      <slot name="secondary">
        <span v-for="item in secondaryItems" :key="item">
          {{ item }}
        </span>
      </slot>
    </div>
    <span v-if="hasMeta" :class="ns.e('meta')">
      <slot name="meta">{{ meta }}</slot>
    </span>
  </div>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { metricItemProps } from './shared'

defineOptions({
  name: 'ElMetricItem',
})

const props = defineProps(metricItemProps)
const slots = useSlots()
const ns = useNamespace('metric-item')

const secondaryItems = computed(() => {
  const value = props.secondary
  if (Array.isArray(value)) return value.map((item) => String(item))
  if (value === '' || value === null || value === undefined) return []
  return [String(value)]
})
const hasLabel = computed(() => Boolean(props.label || slots.label))
const hasPrimary = computed(() => Boolean(props.primary || slots.primary))
const hasSecondary = computed(
  () => secondaryItems.value.length > 0 || Boolean(slots.secondary),
)
const hasMeta = computed(() => Boolean(props.meta || slots.meta))
const itemKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
