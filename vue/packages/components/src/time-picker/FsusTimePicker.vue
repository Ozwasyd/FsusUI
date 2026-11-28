<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatTime, parseTime, useFsusLocale, type FsusSize } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import FsusPopover from '../popover/FsusPopover.vue'

defineOptions({ name: 'FsusTimePicker' })

export interface FsusTimePickerProps {
  showSeconds?: boolean
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  size?: FsusSize
}

const {
  showSeconds = true,
  placeholder,
  clearable = true,
  disabled = false,
  size = 'md',
} = defineProps<FsusTimePickerProps>()

const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ change: [value: string] }>()

const { t } = useFsusLocale()
const open = ref(false)
const parsed = computed(() => parseTime(model.value) ?? { hours: 0, minutes: 0, seconds: 0 })

const hours = Array.from({ length: 24 }, (_, i) => i)
const sixty = Array.from({ length: 60 }, (_, i) => i)

const setPart = (part: 'hours' | 'minutes' | 'seconds', val: number) => {
  const next = { ...parsed.value, [part]: val }
  const formatted = showSeconds
    ? formatTime(next.hours, next.minutes, next.seconds)
    : formatTime(next.hours, next.minutes)
  model.value = formatted
  emit('change', formatted)
}
</script>

<template>
  <FsusPopover v-model:open="open" :disabled="disabled" :width="showSeconds ? 216 : 152">
    <template #reference>
      <div
        class="fsus-select fsus-time-picker"
        role="combobox"
        :tabindex="disabled ? -1 : 0"
        :data-size="size"
        :data-disabled="disabled ? '' : undefined"
      >
        <FsusIcon name="clock" :size="14" class="fsus-date-picker__prefix" />
        <div class="fsus-select__selection">
          <span v-if="model" class="fsus-select__value">{{ model }}</span>
          <span v-else class="fsus-select__placeholder">
            {{ placeholder ?? t('datePicker.selectTime') }}
          </span>
        </div>
        <button
          v-if="clearable && model && !disabled"
          type="button"
          class="fsus-select__clear"
          :aria-label="t('common.clear')"
          @click.stop="model = ''; emit('change', '')"
        >
          <FsusIcon name="circle-close" :size="14" />
        </button>
      </div>
    </template>

    <div class="fsus-time-panel">
      <div class="fsus-time-panel__col" aria-label="Hours">
        <button
          v-for="h in hours"
          :key="h"
          type="button"
          class="fsus-time-panel__item"
          :data-selected="parsed.hours === h ? '' : undefined"
          @click="setPart('hours', h)"
        >
          {{ String(h).padStart(2, '0') }}
        </button>
      </div>
      <div class="fsus-time-panel__col" aria-label="Minutes">
        <button
          v-for="m in sixty"
          :key="m"
          type="button"
          class="fsus-time-panel__item"
          :data-selected="parsed.minutes === m ? '' : undefined"
          @click="setPart('minutes', m)"
        >
          {{ String(m).padStart(2, '0') }}
        </button>
      </div>
      <div v-if="showSeconds" class="fsus-time-panel__col" aria-label="Seconds">
        <button
          v-for="s in sixty"
          :key="s"
          type="button"
          class="fsus-time-panel__item"
          :data-selected="parsed.seconds === s ? '' : undefined"
          @click="setPart('seconds', s)"
        >
          {{ String(s).padStart(2, '0') }}
        </button>
      </div>
    </div>
  </FsusPopover>
</template>
