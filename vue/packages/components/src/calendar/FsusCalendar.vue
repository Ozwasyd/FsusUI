<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  addMonths,
  formatDate,
  getMonthGrid,
  getWeekdayNames,
  isSameDay,
  toDate,
  useFsusLocale,
} from '@fsusui/core'
import FsusButton from '../button/FsusButton.vue'

defineOptions({ name: 'FsusCalendar' })

export interface FsusCalendarProps {
  weekStart?: 0 | 1
}

const { weekStart = 1 } = defineProps<FsusCalendarProps>()

const model = defineModel<Date>({ default: () => new Date() })
const emit = defineEmits<{ select: [date: Date] }>()

const { locale, t } = useFsusLocale()
const cursor = ref<Date>(toDate(model.value) ?? new Date())

const weekdays = computed(() => getWeekdayNames(locale.value.name, weekStart))
const cells = computed(() => getMonthGrid(cursor.value.getFullYear(), cursor.value.getMonth(), weekStart))

const pick = (date: Date) => {
  model.value = date
  cursor.value = date
  emit('select', date)
}

const goToday = () => pick(new Date())
</script>

<template>
  <section class="fsus-calendar">
    <header class="fsus-calendar__header">
      <h3 class="fsus-calendar__title">{{ formatDate(cursor, 'YYYY-MM') }}</h3>
      <div class="fsus-calendar__controls">
        <FsusButton size="sm" @click="cursor = addMonths(cursor, -1)">
          {{ t('datePicker.prevMonth') }}
        </FsusButton>
        <FsusButton size="sm" @click="goToday">{{ t('datePicker.today') }}</FsusButton>
        <FsusButton size="sm" @click="cursor = addMonths(cursor, 1)">
          {{ t('datePicker.nextMonth') }}
        </FsusButton>
      </div>
    </header>

    <div class="fsus-calendar__weekdays">
      <div v-for="wd in weekdays" :key="wd" class="fsus-calendar__weekday">{{ wd }}</div>
    </div>

    <div class="fsus-calendar__grid" role="grid">
      <div
        v-for="cell in cells"
        :key="cell.key"
        role="gridcell"
        tabindex="0"
        class="fsus-calendar__cell"
        :data-outside="!cell.isCurrentMonth ? '' : undefined"
        :data-today="cell.isToday ? '' : undefined"
        :data-selected="isSameDay(cell.date, model) ? '' : undefined"
        @click="pick(cell.date)"
        @keydown.enter.prevent="pick(cell.date)"
      >
        <slot name="date-cell" :data="cell">
          <span class="fsus-calendar__day">{{ cell.day }}</span>
        </slot>
      </div>
    </div>
  </section>
</template>
