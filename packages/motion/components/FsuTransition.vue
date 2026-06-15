<template>
  <Transition :appear="appear" :css="false" @enter="onEnter" @leave="onLeave">
    <slot />
  </Transition>
</template>

<script lang="ts" setup>
import { resolveMotionPresetName } from '../presets'
import { runMotion } from '../runtime'
import type { MotionPresetInput } from '../types'

defineOptions({
  name: 'FsuTransition',
})

const props = withDefaults(
  defineProps<{
    name?: MotionPresetInput
    duration?: string | number
    delay?: string | number
    easing?: string
    disabled?: boolean
    appear?: boolean
  }>(),
  {
    name: 'surface-settle',
    appear: false,
  },
)

const onEnter = (el: Element, done: () => void) => {
  runMotion(el as HTMLElement, {
    name: resolveMotionPresetName(props.name),
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
    name: resolveMotionPresetName(props.name),
    duration: props.duration,
    delay: props.delay,
    easing: props.easing,
    disabled: props.disabled,
    phase: 'leave',
    onFinish: done,
  })
}
</script>
