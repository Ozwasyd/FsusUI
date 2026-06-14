<template>
  <div :class="listKls" :role="role">
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { distributionListProps } from './shared'

defineOptions({
  name: 'ElDistributionList',
})

const props = defineProps(distributionListProps)
const ns = useNamespace('distribution-list')

const listKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
