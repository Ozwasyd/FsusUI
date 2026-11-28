<script setup lang="ts">
import { computed } from 'vue'
import { formatTime, parseTime, type FsusSize } from '@fsusui/core'
import { FsusSelect, type FsusSelectOption } from '../select'

defineOptions({ name: 'FsusTimeSelect' })

export interface FsusTimeSelectProps {
  start?: string
  end?: string
  step?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  size?: FsusSize
}

const {
  start = '09:00',
  end = '18:00',
  step = '00:30',
  placeholder,
  clearable = true,
  disabled = false,
  size = 'md',
} = defineProps<FsusTimeSelectProps>()

const model = defineModel<string | null>({ default: null })

const toMinutes = (s: string) => {
  const p = parseTime(s)
  return p ? p.hours * 60 + p.minutes : 0
}

const options = computed<FsusSelectOption[]>(() => {
  const startMin = toMinutes(start)
  const endMin = toMinutes(end)
  const stepMin = Math.max(toMinutes(step), 1)
  const list: FsusSelectOption[] = []
  for (let cur = startMin; cur <= endMin; cur += stepMin) {
    const label = formatTime(Math.floor(cur / 60), cur % 60)
    list.push({ value: label, label })
  }
  return list
})
</script>

<template>
  <FsusSelect
    v-model="model"
    :options="options"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    :size="size"
  />
</template>
