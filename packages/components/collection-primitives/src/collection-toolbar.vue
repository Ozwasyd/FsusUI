<template>
  <div :class="toolbarKls" v-bind="toolbarAttrs">
    <div v-if="hasPrimary" :class="ns.e('primary')">
      <slot name="primary">
        <slot />
      </slot>
    </div>

    <div v-if="$slots.filters" :class="ns.e('filters')">
      <slot name="filters" />
    </div>

    <div v-if="$slots.actions" :class="ns.e('actions')">
      <slot name="actions" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, useSlots } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { collectionToolbarProps } from './collection-toolbar'

defineOptions({
  name: 'ElCollectionToolbar',
})

const props = defineProps(collectionToolbarProps)
const slots = useSlots()
const ns = useNamespace('collection-toolbar')

const hasPrimary = computed(() => Boolean(slots.primary || slots.default))
const toolbarKls = computed(() => [ns.b(), ns.m(props.density)])
const toolbarAttrs = computed(() => ({
  role: props.role,
  'aria-label': props.ariaLabel || undefined,
  'aria-labelledby': props.ariaLabelledby || undefined,
}))
</script>
