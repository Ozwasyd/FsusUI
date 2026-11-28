<script setup lang="ts">
import { computed, ref } from 'vue'
import { clamp } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

defineOptions({ name: 'FsusRate' })

export interface FsusRateProps {
  max?: number
  disabled?: boolean
  allowHalf?: boolean
  clearable?: boolean
  showScore?: boolean
}

const {
  max = 5,
  disabled = false,
  allowHalf = false,
  clearable = false,
  showScore = false,
} = defineProps<FsusRateProps>()

const model = defineModel<number>({ default: 0 })
const emit = defineEmits<{ change: [value: number] }>()

const hovered = ref<number | null>(null)
const displayValue = computed(() => hovered.value ?? model.value)

const select = (val: number) => {
  if (disabled) return
  const next = clearable && model.value === val ? 0 : clamp(val, 0, max)
  model.value = next
  emit('change', next)
}

const onKeydown = (event: KeyboardEvent) => {
  if (disabled) return
  const delta = allowHalf ? 0.5 : 1
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    event.preventDefault()
    select(model.value + delta)
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    event.preventDefault()
    select(model.value - delta)
  }
}
</script>

<template>
  <div
    class="fsus-rate"
    role="slider"
    :tabindex="disabled ? -1 : 0"
    :aria-valuenow="model"
    aria-valuemin="0"
    :aria-valuemax="max"
    :data-disabled="disabled ? '' : undefined"
    @keydown="onKeydown"
    @mouseleave="hovered = null"
  >
    <button
      v-for="idx in max"
      :key="idx"
      type="button"
      class="fsus-rate__star"
      :disabled="disabled"
      :aria-label="`Rate ${idx} of ${max}`"
      :data-filled="displayValue >= idx ? '' : undefined"
      :data-half="allowHalf && displayValue >= idx - 0.5 && displayValue < idx ? '' : undefined"
      @mouseenter="hovered = idx"
      @click="select(idx)"
    >
      <FsusIcon :name="displayValue >= idx ? 'star-filled' : 'star'" :size="18" />
    </button>
    <span v-if="showScore" class="fsus-rate__score">{{ model }}</span>
  </div>
</template>
