<template>
  <section :class="[ns.b(), ns.m(density)]" role="status" aria-live="polite">
    <strong v-if="title || $slots.title" :class="ns.e('title')">
      <slot name="title">{{ title }}</slot>
    </strong>
    <p v-if="description || $slots.description" :class="ns.e('description')">
      <slot name="description">{{ description }}</slot>
    </p>
    <div v-if="$slots.actions" :class="ns.e('actions')">
      <slot name="actions" />
    </div>
  </section>
</template>

<script lang="ts" setup>
import { useNamespace } from '@element-plus/hooks'
import { emptySelectionStateProps } from './shared'

defineOptions({
  name: 'ElEmptySelectionState',
})

defineProps(emptySelectionStateProps)
const ns = useNamespace('empty-selection-state')
</script>
