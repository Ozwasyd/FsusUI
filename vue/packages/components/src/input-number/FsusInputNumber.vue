<script setup lang="ts">
import { computed, inject } from 'vue'
import { clamp, useFsusSize, type FsusSize } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import { FSUS_FORM_ITEM_KEY } from '../form/context'

defineOptions({ name: 'FsusInputNumber' })

export interface FsusInputNumberProps {
  min?: number
  max?: number
  step?: number
  precision?: number
  size?: FsusSize
  disabled?: boolean
  readonly?: boolean
  controls?: boolean
  placeholder?: string
}

const {
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  precision,
  size,
  disabled = false,
  readonly = false,
  controls = true,
  placeholder,
} = defineProps<FsusInputNumberProps>()

const model = defineModel<number | undefined>({ default: 0 })
const emit = defineEmits<{ change: [value: number | undefined] }>()

const formItem = inject(FSUS_FORM_ITEM_KEY, undefined)
const resolvedSize = useFsusSize(
  computed(() => size),
  computed(() => formItem?.value.size),
)
const isDisabled = computed(() => disabled || Boolean(formItem?.value.disabled))

const normalize = (val: number): number => {
  const clamped = clamp(val, min, max)
  return precision !== undefined ? Number(clamped.toFixed(precision)) : clamped
}

const displayValue = computed(() => {
  if (model.value === undefined || Number.isNaN(model.value)) return ''
  return precision !== undefined ? model.value.toFixed(precision) : String(model.value)
})

const canDecrease = computed(() => !isDisabled.value && !readonly && (model.value ?? 0) > min)
const canIncrease = computed(() => !isDisabled.value && !readonly && (model.value ?? 0) < max)

const commit = (next: number | undefined) => {
  const finalVal = next === undefined ? undefined : normalize(next)
  model.value = finalVal
  emit('change', finalVal)
  formItem?.value.notifyTrigger('change')
}

const stepBy = (delta: number) => {
  if (isDisabled.value || readonly) return
  commit((model.value ?? 0) + delta)
}

const onInput = (event: Event) => {
  const raw = (event.target as HTMLInputElement).value.trim()
  if (raw === '') {
    commit(undefined)
    return
  }
  const num = Number(raw)
  if (!Number.isNaN(num)) commit(num)
}
</script>

<template>
  <div
    class="fsus-input-number"
    :data-size="resolvedSize"
    :data-disabled="isDisabled ? '' : undefined"
  >
    <button
      v-if="controls"
      type="button"
      class="fsus-input-number__btn"
      aria-label="Decrease"
      :disabled="!canDecrease"
      @click="stepBy(-step)"
    >
      <FsusIcon name="minus" :size="14" />
    </button>
    <input
      :id="formItem?.id"
      type="text"
      inputmode="decimal"
      role="spinbutton"
      class="fsus-input-number__native"
      :value="displayValue"
      :placeholder="placeholder"
      :disabled="isDisabled"
      :readonly="readonly"
      :aria-valuenow="model"
      :aria-valuemin="Number.isFinite(min) ? min : undefined"
      :aria-valuemax="Number.isFinite(max) ? max : undefined"
      @change="onInput"
      @keydown.up.prevent="stepBy(step)"
      @keydown.down.prevent="stepBy(-step)"
    />
    <button
      v-if="controls"
      type="button"
      class="fsus-input-number__btn"
      aria-label="Increase"
      :disabled="!canIncrease"
      @click="stepBy(step)"
    >
      <FsusIcon name="plus" :size="14" />
    </button>
  </div>
</template>
