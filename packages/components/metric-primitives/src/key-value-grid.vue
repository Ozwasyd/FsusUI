<template>
  <dl :class="gridKls">
    <slot />
  </dl>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { keyValueGridProps } from './shared'

defineOptions({
  name: 'ElKeyValueGrid',
})

const props = defineProps(keyValueGridProps)
const ns = useNamespace('key-value-grid')

const gridKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
