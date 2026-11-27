<template>
  <div :class="panelKls">
    <div :class="ns.e('content')">
      <strong v-if="title || $slots.title" :class="ns.e('title')">
        <slot name="title">{{ title }}</slot>
      </strong>
      <p v-if="description || $slots.description" :class="ns.e('description')">
        <slot name="description">{{ description }}</slot>
      </p>
      <slot />
    </div>
    <div v-if="$slots.actions" :class="ns.e('actions')">
      <slot name="actions" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { destructiveActionPanelProps } from './shared'

defineOptions({
  name: 'ElDestructiveActionPanel',
})

const props = defineProps(destructiveActionPanelProps)
const ns = useNamespace('destructive-action-panel')

const panelKls = computed(() => [ns.b(), ns.m(props.density)])
</script>
