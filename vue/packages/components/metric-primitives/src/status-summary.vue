<template>
  <article :class="summaryKls">
    <div :class="ns.e('main')">
      <span v-if="hasLabel" :class="ns.e('label')">
        <slot name="label">{{ label }}</slot>
      </span>
      <span v-if="hasStatus" :class="ns.e('status')">
        <slot name="status">{{ status }}</slot>
      </span>
      <span v-if="hasUpdatedAt" :class="ns.e('updated')">
        <slot name="updated">{{ updatedAt }}</slot>
      </span>
    </div>
    <div v-if="hasDetail" :class="ns.e('detail')">
      <slot name="detail" />
    </div>
    <div v-if="hasActions" :class="ns.e('actions')">
      <slot name="actions" />
    </div>
  </article>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { statusSummaryProps } from './shared'

defineOptions({
  name: 'ElStatusSummary',
})

const props = defineProps(statusSummaryProps)
const slots = useSlots()
const ns = useNamespace('status-summary')

const hasLabel = computed(() => Boolean(props.label || slots.label))
const hasStatus = computed(() => Boolean(props.status || slots.status))
const hasUpdatedAt = computed(() => Boolean(props.updatedAt || slots.updated))
const hasDetail = computed(() => Boolean(slots.detail))
const hasActions = computed(() => Boolean(slots.actions))
const summaryKls = computed(() => [
  ns.b(),
  ns.m(props.density),
  ns.m(props.tone),
])
</script>
