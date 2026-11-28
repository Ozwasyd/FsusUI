<script setup lang="ts">
import { computed, inject, ref, type CSSProperties } from 'vue'
import { addUnit, clamp } from '@fsusui/core'
import { FSUS_FORM_ITEM_KEY } from '../form/context'

defineOptions({ name: 'FsusSlider' })

export interface FsusSliderMarkObject {
  label: string
  style?: CSSProperties
}

export type FsusSliderMark = string | FsusSliderMarkObject

export interface FsusSliderProps {
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  range?: boolean
  vertical?: boolean
  height?: string | number
  showStops?: boolean
  showTooltip?: boolean
  formatTooltip?: (value: number) => string
  marks?: Record<number, FsusSliderMark>
}

const props = withDefaults(defineProps<FsusSliderProps>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  range: false,
  vertical: false,
  height: '200px',
  showStops: false,
  showTooltip: true,
})

const model = defineModel<number | [number, number]>({ default: 0 })
const emit = defineEmits<{ change: [value: number | [number, number]] }>()

const formItem = inject(FSUS_FORM_ITEM_KEY, undefined)
const isDisabled = computed(() => props.disabled || Boolean(formItem?.value.disabled))
const trackRef = ref<HTMLElement | null>(null)
const activeThumb = ref<0 | 1 | null>(null)

const span = computed(() => Math.max(props.max - props.min, 1))
const snap = (v: number) =>
  clamp(Math.round((v - props.min) / props.step) * props.step + props.min, props.min, props.max)

const values = computed<[number, number]>(() => {
  if (props.range) {
    const arr = Array.isArray(model.value) ? model.value : [props.min, Number(model.value) || props.min]
    return [snap(Math.min(arr[0], arr[1])), snap(Math.max(arr[0], arr[1]))]
  }
  const single = Array.isArray(model.value) ? model.value[0] : model.value
  return [props.min, snap(single)]
})

const startPct = computed(() => ((values.value[0] - props.min) / span.value) * 100)
const endPct = computed(() => ((values.value[1] - props.min) / span.value) * 100)

const stops = computed<number[]>(() => {
  if (!props.showStops || props.step <= 0) return []
  const count = Math.floor(span.value / props.step)
  if (count <= 1 || count > 100) return []
  const out: number[] = []
  for (let i = 1; i < count; i++) {
    out.push(((i * props.step) / span.value) * 100)
  }
  return out
})

const normalizedMarks = computed(() => {
  if (!props.marks) return []
  return Object.entries(props.marks).map(([posStr, raw]) => {
    const pos = Number(posStr)
    const pct = clamp(((pos - props.min) / span.value) * 100, 0, 100)
    if (typeof raw === 'string') return { pos, pct, label: raw, style: undefined }
    return { pos, pct, label: raw.label, style: raw.style }
  })
})

const formatTip = (val: number) => (props.formatTooltip ? props.formatTooltip(val) : String(val))

const updateAtIndex = (idx: 0 | 1, nextVal: number) => {
  const snapped = snap(nextVal)
  if (props.range) {
    const next: [number, number] =
      idx === 0
        ? [Math.min(snapped, values.value[1]), values.value[1]]
        : [values.value[0], Math.max(snapped, values.value[0])]
    model.value = next
    emit('change', next)
  } else {
    model.value = snapped
    emit('change', snapped)
  }
  formItem?.value.notifyTrigger('change')
}

const valueFromPointer = (clientX: number, clientY: number) => {
  const rect = trackRef.value?.getBoundingClientRect()
  if (!rect) return props.min
  if (props.vertical) {
    if (rect.height <= 0) return props.min
    const ratio = clamp(1 - (clientY - rect.top) / rect.height, 0, 1)
    return snap(props.min + ratio * span.value)
  }
  if (rect.width <= 0) return props.min
  const ratio = clamp((clientX - rect.left) / rect.width, 0, 1)
  return snap(props.min + ratio * span.value)
}

const onTrackClick = (event: MouseEvent) => {
  if (isDisabled.value) return
  const clicked = valueFromPointer(event.clientX, event.clientY)
  if (!props.range) {
    updateAtIndex(1, clicked)
    return
  }
  const dist0 = Math.abs(clicked - values.value[0])
  const dist1 = Math.abs(clicked - values.value[1])
  updateAtIndex(dist0 <= dist1 ? 0 : 1, clicked)
}

const startDrag = (idx: 0 | 1, event: PointerEvent) => {
  if (isDisabled.value) return
  event.preventDefault()
  activeThumb.value = idx
  const onMove = (e: PointerEvent) => updateAtIndex(idx, valueFromPointer(e.clientX, e.clientY))
  const onUp = () => {
    activeThumb.value = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

const fillStyle = computed<CSSProperties>(() =>
  props.vertical
    ? {
        bottom: `${props.range ? startPct.value : 0}%`,
        height: `${props.range ? endPct.value - startPct.value : endPct.value}%`,
      }
    : {
        left: `${props.range ? startPct.value : 0}%`,
        width: `${props.range ? endPct.value - startPct.value : endPct.value}%`,
      },
)

const posStyle = (pct: number): CSSProperties =>
  props.vertical ? { bottom: `${pct}%` } : { left: `${pct}%` }
</script>

<template>
  <div
    class="fsus-slider"
    :data-vertical="vertical ? '' : undefined"
    :data-disabled="isDisabled ? '' : undefined"
    :style="vertical ? { height: addUnit(height) } : undefined"
  >
    <div ref="trackRef" class="fsus-slider__track" @click="onTrackClick">
      <div class="fsus-slider__fill" :style="fillStyle" />

      <span
        v-for="(pct, idx) in stops"
        :key="`stop-${idx}`"
        class="fsus-slider__stop"
        :style="posStyle(pct)"
      />

      <button
        v-if="range"
        type="button"
        role="slider"
        class="fsus-slider__thumb"
        :style="posStyle(startPct)"
        :disabled="isDisabled"
        :aria-orientation="vertical ? 'vertical' : 'horizontal'"
        :aria-valuemin="min"
        :aria-valuemax="max"
        :aria-valuenow="values[0]"
        @pointerdown="startDrag(0, $event)"
        @focus="activeThumb = 0"
        @blur="activeThumb = null"
        @mouseenter="activeThumb = 0"
        @mouseleave="activeThumb = null"
        @keydown.left.prevent="updateAtIndex(0, values[0] - step)"
        @keydown.down.prevent="updateAtIndex(0, values[0] - step)"
        @keydown.right.prevent="updateAtIndex(0, values[0] + step)"
        @keydown.up.prevent="updateAtIndex(0, values[0] + step)"
        @keydown.home.prevent="updateAtIndex(0, min)"
        @keydown.end.prevent="updateAtIndex(0, max)"
      >
        <span
          v-if="showTooltip"
          class="fsus-slider__tooltip"
          :data-visible="activeThumb === 0 ? '' : undefined"
        >
          {{ formatTip(values[0]) }}
        </span>
      </button>

      <button
        type="button"
        role="slider"
        class="fsus-slider__thumb"
        :style="posStyle(endPct)"
        :disabled="isDisabled"
        :aria-orientation="vertical ? 'vertical' : 'horizontal'"
        :aria-valuemin="min"
        :aria-valuemax="max"
        :aria-valuenow="values[1]"
        @pointerdown="startDrag(1, $event)"
        @focus="activeThumb = 1"
        @blur="activeThumb = null"
        @mouseenter="activeThumb = 1"
        @mouseleave="activeThumb = null"
        @keydown.left.prevent="updateAtIndex(1, values[1] - step)"
        @keydown.down.prevent="updateAtIndex(1, values[1] - step)"
        @keydown.right.prevent="updateAtIndex(1, values[1] + step)"
        @keydown.up.prevent="updateAtIndex(1, values[1] + step)"
        @keydown.home.prevent="updateAtIndex(1, min)"
        @keydown.end.prevent="updateAtIndex(1, max)"
      >
        <span
          v-if="showTooltip"
          class="fsus-slider__tooltip"
          :data-visible="activeThumb === 1 ? '' : undefined"
        >
          {{ formatTip(values[1]) }}
        </span>
      </button>
    </div>

    <div v-if="normalizedMarks.length > 0" class="fsus-slider__marks">
      <span
        v-for="m in normalizedMarks"
        :key="m.pos"
        class="fsus-slider__mark"
        :style="[posStyle(m.pct), m.style]"
      >
        {{ m.label }}
      </span>
    </div>
  </div>
</template>
