<template>
  <Transition :appear="appear" :css="false" @enter="onEnter" @leave="onLeave">
    <slot />
  </Transition>
</template>

<script lang="ts" setup>
import { runMotion } from '../runtime'
import type { MotionPresetName } from '../types'

defineOptions({
  name: 'FsuTransition',
})

const props = withDefaults(
  defineProps<{
    name?: MotionPresetName
    duration?: string | number
    delay?: string | number
    easing?: string
    disabled?: boolean
    appear?: boolean
  }>(),
  {
    name: 'fade-in',
    appear: false,
  },
)

const onEnter = (el: Element, done: () => void) => {
  runMotion(el as HTMLElement, {
    name: props.name,
    duration: props.duration,
    delay: props.delay,
    easing: props.easing,
    disabled: props.disabled,
    phase: 'enter',
    onFinish: done,
  })
}

const onLeave = (el: Element, done: () => void) => {
  runMotion(el as HTMLElement, {
    name: props.name,
    duration: props.duration,
    delay: props.delay,
    easing: props.easing,
    disabled: props.disabled,
    phase: 'leave',
    onFinish: done,
  })
}
</script>
