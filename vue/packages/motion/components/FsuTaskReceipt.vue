<template>
  <component
    :is="as"
    class="fsu-task-receipt"
    :class="[phaseClass, motionClass, { 'fsu-task-receipt--summary': summary }]"
    :aria-live="resolvedAriaLive"
    :data-fsus-task-receipt="phase"
    :data-fsus-task-summary="summary ? 'true' : undefined"
    role="status"
  >
    <slot :phase="phase" :message="message">
      {{ message }}
    </slot>
  </component>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import {
  taskFeedbackMotionClasses,
  type TaskFeedbackPhase,
} from '../composables/use-task-feedback'

defineOptions({
  name: 'FsuTaskReceipt',
})

const props = withDefaults(
  defineProps<{
    phase?: TaskFeedbackPhase
    message?: string
    as?: string
    summary?: boolean
    ariaLive?: 'polite' | 'assertive'
  }>(),
  {
    phase: 'idle',
    message: '',
    as: 'div',
    summary: false,
  },
)

const phaseClass = computed(() => `fsu-task-receipt--${props.phase}`)
const motionClass = computed(() =>
  props.phase === 'idle' ? '' : taskFeedbackMotionClasses[props.phase],
)
const resolvedAriaLive = computed(() =>
  props.ariaLive ?? (props.phase === 'error' ? 'assertive' : 'polite'),
)
</script>
