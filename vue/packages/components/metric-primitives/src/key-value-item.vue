<template>
  <div :class="itemKls">
    <dt :class="ns.e('label')">{{ label }}</dt>
    <dd :class="ns.e('value')">
      <span v-if="hasBadge" :class="ns.e('badge')">
        <slot name="badge" />
      </span>
      <slot>{{ displayValue }}</slot>
    </dd>
  </div>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { keyValueItemProps } from './shared'

defineOptions({
  name: 'ElKeyValueItem',
})

const props = defineProps(keyValueItemProps)
const slots = useSlots()
const ns = useNamespace('key-value-item')

const displayValue = computed(() =>
  props.value === null || props.value === undefined || props.value === ''
    ? props.fallback
    : String(props.value),
)
const hasBadge = computed(() => Boolean(slots.badge))
const itemKls = computed(() => [
  ns.b(),
  ns.m(props.tone),
  ns.is('monospace', props.monospace),
])
</script>
