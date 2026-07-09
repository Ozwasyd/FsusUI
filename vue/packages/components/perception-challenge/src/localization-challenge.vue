<template>
  <section :class="rootKls" :aria-busy="loading || undefined">
    <div v-if="prompt || description" :class="ns.e('copy')">
      <p v-if="prompt" :class="ns.e('prompt')">{{ prompt }}</p>
      <p v-if="description" :class="ns.e('description')">
        {{ description }}
      </p>
    </div>

    <div
      ref="targetRef"
      :class="ns.e('target')"
      v-bind="targetAttrs"
      :aria-label="targetLabel"
      :aria-disabled="disabled || loading || expired || undefined"
      role="button"
      tabindex="0"
      @click="handleTargetClick"
      @keydown.enter.prevent="handleKeyboardSubmit"
      @keydown.space.prevent="handleKeyboardSubmit"
    >
      <img
        v-if="renderPayload?.kind === 'image-url'"
        :class="ns.e('image')"
        :src="renderPayload.src"
        :alt="renderPayload.alt || ''"
        draggable="false"
      />
      <canvas
        v-else-if="isCanvasPayload"
        ref="canvasRef"
        :class="ns.e('canvas')"
        :width="renderPayload?.width"
        :height="renderPayload?.height"
        aria-hidden="true"
      />
      <slot v-else name="render" :render-payload="renderPayload">
        <span :class="ns.e('placeholder')">Rendered challenge unavailable</span>
      </slot>

      <span
        v-if="currentPoint"
        :class="ns.e('point')"
        :style="pointStyle"
        v-bind="pointAttrs"
        aria-hidden="true"
      />
    </div>

    <p v-if="error" :class="ns.e('error')" role="alert">{{ error }}</p>
  </section>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import {
  localizationChallengeEmits,
  localizationChallengeProps,
} from './shared'

import type { PerceptionChallengePoint } from './shared'

defineOptions({
  name: 'ElLocalizationChallenge',
})

const props = defineProps(localizationChallengeProps)
const emit = defineEmits(localizationChallengeEmits)
const ns = useNamespace('localization-challenge')
const targetRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()
const internalPoint = ref<PerceptionChallengePoint | null>(null)

const rootKls = computed(() => [
  ns.b(),
  ns.is('loading', props.loading),
  ns.is('disabled', props.disabled),
  ns.is('expired', props.expired),
])
const targetAttrs = {
  'data-test': 'perception-localization-target',
}
const pointAttrs = {
  'data-test': 'perception-localization-point',
}

const isCanvasPayload = computed(
  () =>
    props.renderPayload?.kind === 'bitmap' ||
    props.renderPayload?.kind === 'rgba-raster',
)

const resolvedGridWidth = computed(
  () => props.gridWidth || props.renderPayload?.width || 1,
)
const resolvedGridHeight = computed(
  () => props.gridHeight || props.renderPayload?.height || 1,
)
const currentPoint = computed(() => props.selectedPoint ?? internalPoint.value)
const pointStyle = computed(() => {
  const point = currentPoint.value

  if (!point) return undefined

  return {
    left: `${(point.x / resolvedGridWidth.value) * 100}%`,
    top: `${(point.y / resolvedGridHeight.value) * 100}%`,
  }
})

const interactionDisabled = computed(
  () => props.disabled || props.loading || props.expired,
)

watch(
  () => props.renderPayload,
  async (payload) => {
    await nextTick()
    const canvas = canvasRef.value

    if (!canvas || !payload) return

    const context = canvas.getContext('2d')
    if (!context) return

    context.clearRect(0, 0, canvas.width, canvas.height)

    if (payload.kind === 'bitmap') {
      context.drawImage(payload.bitmap, 0, 0, payload.width, payload.height)
      return
    }

    if (payload.kind === 'rgba-raster' && typeof ImageData !== 'undefined') {
      context.putImageData(
        new ImageData(
          new Uint8ClampedArray(payload.pixels),
          payload.width,
          payload.height,
        ),
        0,
        0,
      )
    }
  },
  { immediate: true },
)

const handleTargetClick = (event: MouseEvent) => {
  if (interactionDisabled.value) return

  const point = pointFromMouseEvent(event)
  if (!point) return

  setPoint(point)
  if (props.submitOnClick) submitPoint(point)
}

const handleKeyboardSubmit = () => {
  if (interactionDisabled.value || !currentPoint.value) return

  submitPoint(currentPoint.value)
}

const setPoint = (point: PerceptionChallengePoint) => {
  internalPoint.value = point
  emit('update:selectedPoint', point)
  emit('select', point)
}

const submitPoint = (point: PerceptionChallengePoint) => {
  emit('submit', {
    kind: 'localization',
    x: point.x,
    y: point.y,
  })
}

const pointFromMouseEvent = (
  event: MouseEvent,
): PerceptionChallengePoint | null => {
  const target = event.currentTarget

  if (!(target instanceof HTMLElement)) return null

  const rect = target.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null

  const xRatio = clamp((event.clientX - rect.left) / rect.width)
  const yRatio = clamp((event.clientY - rect.top) / rect.height)

  return {
    x: Math.round(xRatio * resolvedGridWidth.value),
    y: Math.round(yRatio * resolvedGridHeight.value),
  }
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
</script>
