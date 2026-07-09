<template>
  <div :class="listKls" :role="role">
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { metricListProps } from './shared'

defineOptions({
  name: 'ElMetricList',
})

const props = defineProps(metricListProps)
const ns = useNamespace('metric-list')

const listKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
