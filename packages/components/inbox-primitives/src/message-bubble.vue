<template>
  <article :class="bubbleKls" role="listitem">
    <header v-if="hasMetaHeader" :class="ns.e('meta')">
      <span v-if="hasAuthor" :class="ns.e('author')">
        <slot name="author">{{ author }}</slot>
      </span>
      <span v-if="hasMeta" :class="ns.e('time')">
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
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { messageBubbleProps } from './shared'

defineOptions({
  name: 'ElMessageBubble',
})

const props = defineProps(messageBubbleProps)
const slots = useSlots()
const ns = useNamespace('message-bubble')

const hasAuthor = computed(() => Boolean(props.author || slots.author))
const hasMeta = computed(() => Boolean(props.meta || slots.meta))
const hasMetaHeader = computed(() => hasAuthor.value || hasMeta.value)
const bubbleKls = computed(() => [
  ns.b(),
  ns.m(props.variant),
  ns.m(props.density),
])
</script>
