<template>
  <div :class="listKls" :role="role" :aria-label="ariaLabel">
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { conversationListProps } from './shared'

defineOptions({
  name: 'ElConversationList',
})

const props = defineProps(conversationListProps)
const ns = useNamespace('conversation-list')

const listKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
