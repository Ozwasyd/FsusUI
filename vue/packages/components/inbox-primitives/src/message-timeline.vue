<template>
  <div :class="timelineKls" :role="role">
    <slot />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { messageTimelineProps } from './shared'

defineOptions({
  name: 'ElMessageTimeline',
})

const props = defineProps(messageTimelineProps)
const ns = useNamespace('message-timeline')

const timelineKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
