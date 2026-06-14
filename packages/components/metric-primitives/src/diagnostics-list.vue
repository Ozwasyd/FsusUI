<template>
  <div :class="listKls" :role="role">
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { diagnosticsListProps } from './shared'

defineOptions({
  name: 'ElDiagnosticsList',
})

const props = defineProps(diagnosticsListProps)
const ns = useNamespace('diagnostics-list')

const listKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
