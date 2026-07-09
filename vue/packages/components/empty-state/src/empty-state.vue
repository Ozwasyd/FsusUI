<template>
  <div :class="emptyStateKls" :role="role" :aria-live="ariaLiveAttr">
    <div
      v-if="shouldRenderIllustration"
      :class="ns.e('illustration')"
      aria-hidden="true"
    >
      <slot name="illustration">
        <span :class="ns.e('illustration-mark')" />
      </slot>
    </div>

    <component :is="titleTag" v-if="hasTitle" :class="ns.e('title')">
      <slot name="title">{{ title }}</slot>
    </component>

    <p v-if="hasDescription" :class="ns.e('description')">
      <slot name="description">{{ description }}</slot>
    </p>

    <div v-if="hasActions" :class="actionsKls">
      <slot name="actions">
        <slot />
      </slot>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { emptyStateProps } from './empty-state'

defineOptions({
  name: 'ElEmptyState',
})

const props = defineProps(emptyStateProps)
const slots = useSlots()
const ns = useNamespace('empty-state')

const shouldRenderIllustration = computed(() =>
  props.illustration === 'auto' ? props.size === 'page' : props.illustration,
)

const effectiveActionVariant = computed(
  () => props.actionVariant ?? (props.size === 'inline' ? 'link' : 'secondary'),
)

const emptyStateKls = computed(() => [
  ns.b(),
  ns.m(props.size),
  ns.is('with-illustration', shouldRenderIllustration.value),
])

const actionsKls = computed(() => [
  ns.e('actions'),
  ns.em('actions', effectiveActionVariant.value),
])

const hasTitle = computed(() => Boolean(props.title || slots.title))
const hasDescription = computed(() =>
  Boolean(props.description || slots.description),
)
const hasActions = computed(() => Boolean(slots.actions || slots.default))
const ariaLiveAttr = computed(() =>
  props.ariaLive === 'off' ? undefined : props.ariaLive,
)
</script>
