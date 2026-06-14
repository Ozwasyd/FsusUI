<template>
  <div
    ref="root"
    class="fsu-toast-receipt"
    :class="`fsu-toast-receipt--${tone}`"
    v-bind="toastAttrs"
    :aria-live="ariaLive"
    :role="role"
  >
    <slot :tone="tone" :message="message">
      {{ message }}
    </slot>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { runMotion } from '../runtime'
import type { MotionPresetName } from '../types'

defineOptions({
  name: 'FsuToastReceipt',
})

const props = withDefaults(
  defineProps<{
    tone?: 'success' | 'info' | 'warning' | 'error'
    message?: string
    preset?: MotionPresetName
    immediate?: boolean
  }>(),
  {
    tone: 'success',
    message: '',
    preset: 'toast-receipt',
    immediate: true,
  },
)

const root = ref<HTMLElement>()
const ariaLive = computed(() =>
  props.tone === 'error' ? 'assertive' : 'polite',
)
const role = computed(() => (props.tone === 'error' ? 'alert' : 'status'))
const toastAttrs = computed(() => ({
  'data-fsus-toast-receipt': '',
  'data-fsus-toast-tone': props.tone,
  'data-fsus-motion-preset': props.preset,
}))

const play = async () => {
  await nextTick()
  if (!root.value) return
  runMotion(root.value, { name: props.preset })
}

onMounted(() => {
  if (props.immediate) void play()
})

watch(
  () => [props.tone, props.message, props.preset],
  () => {
    if (props.immediate) void play()
  },
)

defineExpose({ play })
</script>
