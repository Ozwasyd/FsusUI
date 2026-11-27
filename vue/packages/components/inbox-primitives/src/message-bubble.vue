<template>
  <article :class="bubbleKls" role="listitem">
    <header
      v-if="author || $slots.author || meta || $slots.meta"
      :class="ns.e('meta')"
    >
      <span v-if="author || $slots.author" :class="ns.e('author')">
        <slot name="author">{{ author }}</slot>
      </span>
      <span v-if="meta || $slots.meta" :class="ns.e('time')">
        <slot name="meta">{{ meta }}</slot>
      </span>
    </header>
    <div :class="ns.e('body')">
      <slot name="body">
        <slot />
      </slot>
    </div>
  </article>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { messageBubbleProps } from './shared'

defineOptions({
  name: 'ElMessageBubble',
})

const props = defineProps(messageBubbleProps)
const ns = useNamespace('message-bubble')

const bubbleKls = computed(() => [
  ns.b(),
  ns.m(props.variant),
  ns.m(props.density),
])
</script>
