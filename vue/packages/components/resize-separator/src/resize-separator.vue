<template>
  <div
    ref="handle"
    v-bind="$attrs"
    :class="[ns.b(), ns.m(orientation), ns.is('disabled', !enabled)]"
    role="separator"
    :tabindex="enabled ? 0 : -1"
    :aria-label="label"
    :aria-controls="regionIds"
    :aria-orientation="orientation"
    :aria-valuemin="validDomain ? min : undefined"
    :aria-valuemax="validDomain ? max : undefined"
    :aria-valuenow="validDomain ? controlledValue : undefined"
    :aria-valuetext="valueText"
    :aria-disabled="!enabled || undefined"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @lostpointercapture="onLostPointerCapture"
    @keydown="onKeydown"
  />
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useNamespace } from '@element-plus/hooks'
import { resizeSeparatorEmits, resizeSeparatorProps } from './resize-separator'

import type {
  ResizeSeparatorCancelReason,
  ResizeSeparatorPayload,
} from './resize-separator'

defineOptions({ name: 'ElResizeSeparator', inheritAttrs: false })

const props = defineProps(resizeSeparatorProps)
const emit = defineEmits(resizeSeparatorEmits)
const ns = useNamespace('resize-separator')
const handle = ref<HTMLElement>()
const validDomain = computed(
  () =>
    Number.isFinite(props.value) &&
    Number.isFinite(props.min) &&
    Number.isFinite(props.max) &&
    Number.isFinite(props.max - props.min) &&
    props.max > props.min &&
    Number.isFinite(props.step) &&
    props.step > 0,
)
const validCoordinates = computed(() => {
  const range = props.coordinateRange
  return (
    Number.isFinite(range?.start) &&
    Number.isFinite(range?.end) &&
    Number.isFinite(range.end - range.start) &&
    range.start !== range.end &&
    Number.isFinite((props.max - props.min) / (range.end - range.start)) &&
    (props.max - props.min) / (range.end - range.start) !== 0
  )
})
const enabled = computed(
  () =>
    !props.disabled &&
    validDomain.value &&
    validCoordinates.value &&
    !!props.label?.trim() &&
    !!props.primaryRegionId?.trim(),
)
const regionIds = computed(() =>
  [props.primaryRegionId, props.secondaryRegionId].filter(Boolean).join(' '),
)
const bound = (value: number) => Math.min(props.max, Math.max(props.min, value))
const controlledValue = computed(() => bound(props.value))
const quantize = (value: number) => {
  const bounded = bound(value)
  if (bounded === props.min || bounded === props.max) return bounded
  const stepCount = (bounded - props.min) / props.step
  // An extremely small step must not turn a finite input into Infinity.
  if (!Number.isFinite(stepCount)) return bounded
  const halfStep = Math.floor(stepCount) + 0.5
  const roundoff = Number.EPSILON * Math.max(1, Math.abs(stepCount))
  // Correct quotient-scale roundoff only at the half-step decision boundary.
  // If numeric precision spans half a step, retain ordinary rounding.
  const steps =
    roundoff < 0.5 && stepCount < halfStep && halfStep - stepCount <= roundoff
      ? Math.ceil(stepCount)
      : Math.round(stepCount)
  return bound(Number((props.min + steps * props.step).toPrecision(15)))
}

type PointerInteraction = {
  source: 'pointer'
  target: HTMLElement
  pointerId: number
  coordinate: number
  initialValue: number
  lastValue: number
  scale: number
}
type KeyboardInteraction = {
  source: 'keyboard'
  pointerId: null
  lastValue: number
}
type Interaction = PointerInteraction | KeyboardInteraction
let active: Interaction | undefined
let unmounting = false
const payload = (interaction: Interaction): ResizeSeparatorPayload => ({
  value: interaction.lastValue,
  source: interaction.source,
  pointerId: interaction.pointerId,
})
const release = (interaction: Interaction) => {
  if (interaction.source !== 'pointer') return
  try {
    if (interaction.target.hasPointerCapture(interaction.pointerId)) {
      interaction.target.releasePointerCapture(interaction.pointerId)
    }
  } catch {
    // Capture may already have been released by the user agent.
  }
}
const cancel = (reason: ResizeSeparatorCancelReason) => {
  if (!active) return
  const interaction = active
  active = undefined
  release(interaction)
  emit('cancel', { ...payload(interaction), reason })
}
const coordinate = (event: PointerEvent) =>
  props.orientation === 'vertical' ? event.clientX : event.clientY

const onPointerDown = (event: PointerEvent) => {
  if (
    unmounting ||
    !enabled.value ||
    active ||
    event.button !== 0 ||
    !event.isPrimary ||
    !Number.isFinite(coordinate(event))
  )
    return
  const target = handle.value
  if (!target) return
  try {
    target.setPointerCapture(event.pointerId)
  } catch {
    return
  }
  const interaction: PointerInteraction = {
    source: 'pointer',
    target,
    pointerId: event.pointerId,
    coordinate: coordinate(event),
    initialValue: controlledValue.value,
    lastValue: controlledValue.value,
    scale:
      (props.max - props.min) /
      (props.coordinateRange.end - props.coordinateRange.start),
  }
  active = interaction
  event.preventDefault()
  emit('start', payload(interaction))
  if (active === interaction) target.focus({ preventScroll: true })
}
const onPointerMove = (event: PointerEvent) => {
  const interaction = active
  if (
    interaction?.source !== 'pointer' ||
    event.pointerId !== interaction.pointerId
  )
    return
  const axis = coordinate(event)
  if (!Number.isFinite(axis)) return
  const value =
    axis === interaction.coordinate
      ? interaction.initialValue
      : quantize(
          interaction.initialValue +
            (axis - interaction.coordinate) * interaction.scale,
        )
  event.preventDefault()
  if (value === interaction.lastValue) return
  interaction.lastValue = value
  emit('proposal', payload(interaction))
}
const onPointerUp = (event: PointerEvent) => {
  const interaction = active
  if (
    interaction?.source !== 'pointer' ||
    event.pointerId !== interaction.pointerId
  )
    return
  onPointerMove(event)
  if (active !== interaction) return
  active = undefined
  release(interaction)
  emit('end', payload(interaction))
}
const onPointerCancel = (event: PointerEvent) => {
  if (event.pointerId === active?.pointerId) cancel('pointercancel')
}
const onLostPointerCapture = (event: PointerEvent) => {
  if (event.pointerId === active?.pointerId) cancel('lostpointercapture')
}
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && active) {
    event.preventDefault()
    event.stopPropagation()
    cancel('escape')
    return
  }
  if (
    unmounting ||
    !enabled.value ||
    active ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return
  const keys =
    props.orientation === 'vertical'
      ? ['ArrowLeft', 'ArrowRight']
      : ['ArrowUp', 'ArrowDown']
  const direction = Math.sign(
    props.coordinateRange.end - props.coordinateRange.start,
  )
  let next: number
  if (event.key === 'Home') next = props.min
  else if (event.key === 'End') next = props.max
  else if (event.key === keys[0])
    next = controlledValue.value - direction * props.step
  else if (event.key === keys[1])
    next = controlledValue.value + direction * props.step
  else return
  event.preventDefault()
  next = quantize(next)
  if (next === controlledValue.value) return
  const interaction: KeyboardInteraction = {
    lastValue: controlledValue.value,
    source: 'keyboard',
    pointerId: null,
  }
  active = interaction
  emit('start', payload(interaction))
  if (active !== interaction) return
  interaction.lastValue = next
  emit('proposal', payload(interaction))
  if (active !== interaction) return
  active = undefined
  emit('end', payload(interaction))
}

watch(
  [
    () => props.disabled,
    () => props.min,
    () => props.max,
    () => props.step,
    () => props.orientation,
    () => props.coordinateRange?.start,
    () => props.coordinateRange?.end,
    () => props.label,
    () => props.primaryRegionId,
    () => props.secondaryRegionId,
    () => Number.isFinite(props.value),
  ],
  () => cancel(props.disabled ? 'disabled' : 'configuration-change'),
  { flush: 'sync' },
)
onBeforeUnmount(() => {
  unmounting = true
  cancel('unmount')
})

defineExpose({ cancel: () => cancel('consumer') })
</script>
