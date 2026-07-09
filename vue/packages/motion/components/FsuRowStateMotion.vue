<template>
  <component
    :is="as"
    class="fsu-row-state-motion"
    :class="[phaseClass, motionClass]"
    :aria-live="resolvedAriaLive"
    :data-fsus-row-state="state"
    :data-fsus-row-key="rowKey"
  >
    <slot :state="state" :message="message">
      {{ message }}
    </slot>
  </component>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import {
  rowStateMotionClasses,
  type RowStateKey,
  type RowStatePhase,
} from '../composables/use-row-state-motion'

defineOptions({
  name: 'FsuRowStateMotion',
})

const props = withDefaults(
  defineProps<{
    state?: RowStatePhase
    rowKey?: RowStateKey
    message?: string
    as?: string
    ariaLive?: 'polite' | 'assertive'
  }>(),
  {
    state: 'idle',
    rowKey: '',
    message: '',
    as: 'div',
  },
)

const phaseClass = computed(() => `fsu-row-state-motion--${props.state}`)
const motionClass = computed(() =>
  props.state === 'idle' ? '' : rowStateMotionClasses[props.state],
)
const resolvedAriaLive = computed(() =>
  props.ariaLive ??
  (props.state === 'error' || props.state === 'locked'
    ? 'assertive'
    : 'polite'),
)
</script>
