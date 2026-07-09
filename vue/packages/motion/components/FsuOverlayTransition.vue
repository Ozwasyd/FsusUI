<template>
  <Transition
    :appear="appear"
    :css="false"
    @before-enter="captureFocus"
    @enter="onEnter"
    @leave="onLeave"
    @after-leave="restoreFocus"
  >
    <slot />
  </Transition>
</template>

<script lang="ts" setup>
import { runMotion } from '../runtime'
import type { MotionPresetName } from '../types'

defineOptions({
  name: 'FsuOverlayTransition',
})

const props = withDefaults(
  defineProps<{
    name?: MotionPresetName
    duration?: string | number
    delay?: string | number
    easing?: string
    disabled?: boolean
    appear?: boolean
    restoreFocus?: boolean
  }>(),
  {
    name: 'overlay-settle',
    appear: false,
    restoreFocus: true,
  },
)

let previousFocus: HTMLElement | undefined

const captureFocus = () => {
  if (!props.restoreFocus || typeof document === 'undefined') return
  previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined
}

const restoreFocus = () => {
  if (!props.restoreFocus || !previousFocus?.isConnected) return
  previousFocus.focus()
  previousFocus = undefined
}

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
