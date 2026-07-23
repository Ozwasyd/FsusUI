<template>
  <button type="button" @click="emit('submit')">
    {{ label }}
  </button>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { fixtureOptionsWidgetProps } from './fixture-options-widget'

export default defineComponent({
  name: 'ElFixtureOptionsWidget',
  props: fixtureOptionsWidgetProps,
  emits: ['submit'],
  setup(props, { emit }) {
    return {
      emit,
      label: props.label,
    }
  },
})
</script>
