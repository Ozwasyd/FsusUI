<template>
  <Transition
    :appear="effectiveAppear"
    :css="false"
    :mode="mode"
    @enter="onEnter"
    @leave="onLeave"
  >
    <slot />
  </Transition>
</template>

<script lang="ts" setup>
import { computed, type TransitionProps } from 'vue'
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
    mode?: TransitionProps['mode']
    suppressAppearDuringHydration?: boolean
  }>(),
  {
    name: 'surface-settle',
    appear: false,
    suppressAppearDuringHydration: false,
  },
)

const effectiveAppear = computed(
  () => props.appear && !props.suppressAppearDuringHydration,
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
