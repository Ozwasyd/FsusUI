<template>
  <FsuTransition
    :name="name"
    :duration="duration"
    :delay="delay"
    :easing="easing"
    :disabled="disabled"
    :appear="appear"
  >
    <slot />
  </FsuTransition>
</template>

<script lang="ts" setup>
import FsuTransition from './FsuTransition.vue'
import type { MotionPresetName } from '../types'

defineOptions({
  name: 'FsuSheetTransition',
})

withDefaults(
  defineProps<{
    name?: MotionPresetName
    duration?: string | number
    delay?: string | number
    easing?: string
    disabled?: boolean
    appear?: boolean
  }>(),
  {
    name: 'sheet-settle',
    appear: false,
  },
)
</script>
