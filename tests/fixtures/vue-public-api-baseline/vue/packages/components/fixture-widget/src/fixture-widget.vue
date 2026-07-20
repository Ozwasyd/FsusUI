<template>
  <section>
    <slot />
    <slot name="actions" />
    <slot name="item" :row="{ label }" />
  </section>
</template>

<script setup lang="ts">
import { fixtureWidgetEmits, fixtureWidgetProps } from './fixture-widget'

defineOptions({
  name: 'ElFixtureWidget',
})

defineProps(fixtureWidgetProps)
defineEmits(fixtureWidgetEmits)

function focus() {}
function reset() {}

defineExpose({
  focus,
  reset,
})
</script>
