<template>
  <div :class="panelKls">
    <div :class="ns.e('content')">
      <strong v-if="hasTitle" :class="ns.e('title')">
        <slot name="title">{{ title }}</slot>
      </strong>
      <p v-if="hasDescription" :class="ns.e('description')">
        <slot name="description">{{ description }}</slot>
      </p>
      <slot />
    </div>
    <div v-if="hasActions" :class="ns.e('actions')">
      <slot name="actions" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { destructiveActionPanelProps } from './shared'

defineOptions({
  name: 'ElDestructiveActionPanel',
})

const props = defineProps(destructiveActionPanelProps)
const slots = useSlots()
const ns = useNamespace('destructive-action-panel')

const hasTitle = computed(() => Boolean(props.title || slots.title))
const hasDescription = computed(() =>
  Boolean(props.description || slots.description),
)
const hasActions = computed(() => Boolean(slots.actions))
const panelKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
