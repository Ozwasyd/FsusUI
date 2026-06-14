<template>
  <div :class="barKls">
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { conversationContextBarProps } from './shared'

defineOptions({
  name: 'ElConversationContextBar',
})

const props = defineProps(conversationContextBarProps)
const ns = useNamespace('conversation-context-bar')

const barKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
