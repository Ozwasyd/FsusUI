<template>
  <div :class="actionsKls" role="group" :aria-label="ariaLabel">
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { inlineActionsProps } from './shared'

defineOptions({
  name: 'ElInlineActions',
})

const props = defineProps(inlineActionsProps)
const ns = useNamespace('inline-actions')

const actionsKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
