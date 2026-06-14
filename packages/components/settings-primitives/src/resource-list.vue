<template>
  <div :class="listKls" :role="role">
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { resourceListProps } from './shared'

defineOptions({
  name: 'ElResourceList',
})

const props = defineProps(resourceListProps)
const ns = useNamespace('resource-list')

const listKls = computed(() => [
  ns.b(),
  ns.m(props.density),
  ns.is('divided', props.divided),
])
</script>
