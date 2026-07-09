<template>
  <section :class="composerKls" :aria-disabled="disabled ? 'true' : undefined">
    <header v-if="hasTitle" :class="ns.e('header')">
      <strong :class="ns.e('title')">
        <slot name="title">{{ title }}</slot>
      </strong>
    </header>
    <div :class="ns.e('input')">
      <slot name="input">
        <slot />
      </slot>
    </div>
    <div v-if="hasActions" :class="ns.e('actions')">
      <slot name="actions" />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { replyComposerShellProps } from './shared'

defineOptions({
  name: 'ElReplyComposerShell',
})

const props = defineProps(replyComposerShellProps)
const slots = useSlots()
const ns = useNamespace('reply-composer-shell')

const hasTitle = computed(() => Boolean(props.title || slots.title))
const hasActions = computed(() => Boolean(slots.actions))
const composerKls = computed(() => [
  ns.b(),
  ns.m(props.density),
  ns.is('disabled', props.disabled),
])
</script>
