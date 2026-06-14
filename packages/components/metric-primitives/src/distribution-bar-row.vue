<template>
  <div :class="rowKls" role="listitem">
    <span v-if="hasRank" :class="ns.e('rank')">
      <slot name="rank">{{ rank }}</slot>
    </span>
    <span v-if="hasLabel" :class="ns.e('label')">
      <slot name="label">{{ label }}</slot>
    </span>
    <span v-if="hasValue" :class="ns.e('value')">
      <slot name="value">{{ value }}</slot>
    </span>
    <div :class="ns.e('bar')" aria-hidden="true">
      <span :class="ns.e('bar-fill')" :style="barStyle" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { distributionBarRowProps } from './shared'

defineOptions({
  name: 'ElDistributionBarRow',
})

const props = defineProps(distributionBarRowProps)
const slots = useSlots()
const ns = useNamespace('distribution-bar-row')

const clampedRatio = computed(() => Math.min(1, Math.max(0, props.ratio)))
const barStyle = computed(() => ({
  width: `${Math.round(clampedRatio.value * 100)}%`,
}))
const hasRank = computed(() => Boolean(props.rank || slots.rank))
const hasLabel = computed(() => Boolean(props.label || slots.label))
const hasValue = computed(() => Boolean(props.value || slots.value))
const rowKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
