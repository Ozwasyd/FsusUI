<template>
  <component
    :is="as"
    ref="root"
    :data-fsus-motion-recipe="resolved.recipe"
    :data-fsus-motion-preset="resolved.name"
    :aria-live="ariaLive"
    :role="role"
  >
    <slot />
  </component>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { normalizeMotionRecipeOptions } from '../recipes'
import { runMotion } from '../runtime'
import type { MotionRecipeName } from '../types'

defineOptions({
  name: 'FsuMotionRecipe',
})

const props = withDefaults(
  defineProps<{
    name?: MotionRecipeName
    as?: string
    duration?: string | number
    delay?: string | number
    index?: number
    disabled?: boolean
    once?: boolean
    immediate?: boolean
    ariaLive?: 'polite' | 'assertive'
    role?: string
  }>(),
  {
    name: 'content-enter',
    as: 'div',
    immediate: true,
    ariaLive: undefined,
    role: undefined,
  },
)

const root = ref<HTMLElement>()

const resolved = computed(() =>
  normalizeMotionRecipeOptions({
    recipe: props.name,
    duration: props.duration,
    delay: props.delay,
    index: props.index,
    disabled: props.disabled,
    once: props.once,
  }),
)

const play = async () => {
  await nextTick()
  if (!root.value) return
  runMotion(root.value, resolved.value)
}

onMounted(() => {
  if (props.immediate) void play()
})

watch(
  () => [
    props.name,
    props.duration,
    props.delay,
    props.index,
    props.disabled,
    props.once,
  ],
  () => {
    if (props.immediate) void play()
  },
)

defineExpose({ play })
</script>
