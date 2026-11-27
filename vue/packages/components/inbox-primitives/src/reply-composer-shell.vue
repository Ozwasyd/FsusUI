<template>
  <section :class="composerKls" :aria-disabled="disabled ? 'true' : undefined">
    <header v-if="title || $slots.title" :class="ns.e('header')">
      <strong :class="ns.e('title')">
        <slot name="title">{{ title }}</slot>
      </strong>
    </header>
    <div :class="ns.e('input')">
      <slot name="input">
        <slot />
      </slot>
    </div>
    <div v-if="$slots.actions" :class="ns.e('actions')">
      <slot name="actions" />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { replyComposerShellProps } from './shared'

defineOptions({
  name: 'ElReplyComposerShell',
})

const props = defineProps(replyComposerShellProps)
const ns = useNamespace('reply-composer-shell')

const composerKls = computed(() => [
  ns.b(),
  ns.m(props.density),
  ns.is('disabled', props.disabled),
])
</script>
