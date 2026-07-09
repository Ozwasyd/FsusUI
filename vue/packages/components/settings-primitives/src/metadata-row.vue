<template>
  <dl :class="rowKls">
    <slot />
  </dl>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { metadataRowProps } from './shared'

defineOptions({
  name: 'ElMetadataRow',
})

const props = defineProps(metadataRowProps)
const ns = useNamespace('metadata-row')

const rowKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
