<template>
  <ol
    ref="stepsRoot"
    :class="containerKls"
    v-bind="{ 'data-direction': resolvedDirection }"
  >
    <slot />
  </ol>
</template>

<script lang="ts" setup>
import { computed, getCurrentInstance, provide, ref, watch } from 'vue'
import { CHANGE_EVENT } from '@element-plus/constants'
import {
  useNamespace,
  useOrderedChildren,
  useResizeObserver,
} from '@element-plus/hooks'
import { stepsEmits, stepsProps } from './steps'

import type { StepItemState } from './item.vue'

defineOptions({
  name: 'ElSteps',
})

const props = defineProps(stepsProps)
const emit = defineEmits(stepsEmits)

const ns = useNamespace('steps')
const stepsRoot = ref<HTMLElement>()
const containerWidth = ref<number>()
const {
  children: steps,
  addChild: addStep,
  removeChild: removeStep,
} = useOrderedChildren<StepItemState>(getCurrentInstance()!, 'ElStep')

const hasDescriptions = computed(() =>
  steps.value.some((step) => step.hasDescription),
)
const isNarrow = computed(
  () =>
    containerWidth.value !== undefined &&
    containerWidth.value > 0 &&
    containerWidth.value < 640,
)
const isCompact = computed(
  () =>
    props.direction === 'auto' &&
    isNarrow.value &&
    !hasDescriptions.value &&
    steps.value.length <= 4,
)
const resolvedDirection = computed<'horizontal' | 'vertical'>(() => {
  if (props.direction !== 'auto') return props.direction
  if (!isNarrow.value) return 'horizontal'
  return isCompact.value ? 'horizontal' : 'vertical'
})
const containerKls = computed(() => [
  ns.b(),
  ns.m(props.simple ? 'simple' : resolvedDirection.value),
  ns.is('compact', isCompact.value),
])

useResizeObserver(stepsRoot, ([entry]) => {
  containerWidth.value = entry?.contentRect.width
})

watch(steps, () => {
  steps.value.forEach((instance: StepItemState, index: number) => {
    instance.setIndex(index)
  })
})

provide('ElSteps', {
  props,
  steps,
  addStep,
  removeStep,
  direction: resolvedDirection,
  compact: isCompact,
})

watch(
  () => props.active,
  (newVal: number, oldVal: number) => {
    emit(CHANGE_EVENT, newVal, oldVal)
  },
)
</script>
