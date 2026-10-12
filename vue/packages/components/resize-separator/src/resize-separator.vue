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
import {
  getResizeKeyboardProposal,
  getResizePointerProposal,
  hasResolvableResizeStep,
} from './resize-separator-math'

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
    props.step > 0 &&
    hasResolvableResizeStep(props),
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
type PointerInteraction = {
  source: 'pointer'
  target: HTMLElement
  pointerId: number
  coordinate: number
  initialValue: number
  lastValue: number
  coordinateRange: Readonly<{ start: number; end: number }>
}
type KeyboardInteraction = {
  source: 'keyboard'
  pointerId: null
  lastValue: number
}
type Interaction = PointerInteraction | KeyboardInteraction
let active: Interaction | undefined
let pendingAdmission: { invalidated: boolean } | undefined
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
  if (pendingAdmission) pendingAdmission.invalidated = true
  if (!active) return
  const interaction = active
  active = undefined
  release(interaction)
  emit('cancel', { ...payload(interaction), reason })
}
const coordinate = (event: PointerEvent) =>
  props.orientation === 'vertical' ? event.clientX : event.clientY

const onPointerDown = (event: PointerEvent) => {
  if (unmounting || active || pendingAdmission) return
  // Reserve admission before consumer getters can reenter either input path.
  const admission = { invalidated: false }
  pendingAdmission = admission
  try {
    if (
      !enabled.value ||
      event.button !== 0 ||
      !event.isPrimary ||
      !Number.isFinite(coordinate(event))
    )
      return
    const target = handle.value
    if (!target) return
    const range = props.coordinateRange
    const value = controlledValue.value
    const interaction: PointerInteraction = {
      source: 'pointer',
      target,
      pointerId: event.pointerId,
      coordinate: coordinate(event),
      initialValue: value,
      lastValue: value,
      coordinateRange: { start: range.start, end: range.end },
    }
    if (
      !enabled.value ||
      admission.invalidated ||
      pendingAdmission !== admission ||
      unmounting ||
      active ||
      handle.value !== target
    )
      return
    // Finish external reads before capture; register its cleanup immediately.
    try {
      target.setPointerCapture(interaction.pointerId)
    } catch {
      return
    }
    active = interaction
    if (admission.invalidated || pendingAdmission !== admission || unmounting) {
      active = undefined
      release(interaction)
      return
    }
    pendingAdmission = undefined
    event.preventDefault()
    emit('start', payload(interaction))
    if (active === interaction) target.focus({ preventScroll: true })
  } finally {
    if (pendingAdmission === admission) pendingAdmission = undefined
  }
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
      : getResizePointerProposal(
          props,
          interaction.initialValue,
          interaction.coordinate,
          axis,
          interaction.coordinateRange,
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
    pendingAdmission ||
    active ||
    !enabled.value ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return
  const keys =
    props.orientation === 'vertical'
      ? ['ArrowLeft', 'ArrowRight']
      : ['ArrowUp', 'ArrowDown']
  const direction =
    props.coordinateRange.end > props.coordinateRange.start ? 1 : -1
  let next: number
  if (event.key === 'Home') next = props.min
  else if (event.key === 'End') next = props.max
  else if (event.key === keys[0])
    next = getResizeKeyboardProposal(
      props,
      controlledValue.value,
      direction === 1 ? -1 : 1,
    )
  else if (event.key === keys[1])
    next = getResizeKeyboardProposal(props, controlledValue.value, direction)
  else return
  event.preventDefault()
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
