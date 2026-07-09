<template>
  <section :class="stateKls" role="status" aria-live="polite">
    <strong v-if="hasTitle" :class="ns.e('title')">
      <slot name="title">{{ title }}</slot>
    </strong>
    <p v-if="hasDescription" :class="ns.e('description')">
      <slot name="description">{{ description }}</slot>
    </p>
    <div v-if="hasActions" :class="ns.e('actions')">
      <slot name="actions" />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { inboxEmptyStateProps } from './shared'

defineOptions({
  name: 'ElInboxEmptyState',
})

const props = defineProps(inboxEmptyStateProps)
const slots = useSlots()
const ns = useNamespace('inbox-empty-state')

const hasTitle = computed(() => Boolean(props.title || slots.title))
const hasDescription = computed(() =>
  Boolean(props.description || slots.description),
)
const hasActions = computed(() => Boolean(slots.actions))
const stateKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
