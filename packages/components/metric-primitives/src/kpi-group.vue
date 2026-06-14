<template>
  <div :class="groupKls">
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { kpiGroupProps } from './shared'

defineOptions({
  name: 'ElKpiGroup',
})

const props = defineProps(kpiGroupProps)
const ns = useNamespace('kpi-group')

const groupKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
