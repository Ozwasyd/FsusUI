<template>
  <div :class="ns.b()">
    <div :class="ns.e('header')">
      <slot name="header" :date="i18nDate">
        <div :class="ns.e('title')">{{ i18nDate }}</div>
        <div v-if="validatedRange.length === 0" :class="ns.e('button-group')">
          <el-button-group>
            <el-button size="small" @click="handleSelectDate('prev-month')">
              {{ t('el.datepicker.prevMonth') }}
            </el-button>
            <el-button size="small" @click="handleSelectDate('today')">
              {{ t('el.datepicker.today') }}
            </el-button>
            <el-button size="small" @click="handleSelectDate('next-month')">
              {{ t('el.datepicker.nextMonth') }}
            </el-button>
          </el-button-group>
        </div>
      </slot>
    </div>
    <div
      :key="calendarBodyKey"
      :class="[
        ns.e('body'),
        ns.is(`motion-${calendarMotionDirection}`),
      ]"
      v-bind="{ 'data-motion-direction': calendarMotionDirection }"
    >
      <date-table
        v-if="validatedRange.length === 0"
        :date="date"
        :selected-day="realSelectedDay"
        @pick="handlePickDay"
      >
        <template
          v-if="$slots['date-cell'] || $slots.dateCell"
          #date-cell="data"
        >
          <slot v-if="$slots['date-cell']" name="date-cell" v-bind="data" />
          <slot v-else name="dateCell" v-bind="data" />
        </template>
      </date-table>
      <template v-else>
        <date-table
          v-for="(range_, index) in validatedRange"
          :key="index"
          :date="range_[0]"
          :selected-day="realSelectedDay"
          :range="range_"
          :hide-header="index !== 0"
          @pick="handlePickDay"
        >
          <template
            v-if="$slots['date-cell'] || $slots.dateCell"
            #date-cell="data"
          >
            <slot v-if="$slots['date-cell']" name="date-cell" v-bind="data" />
            <slot v-else name="dateCell" v-bind="data" />
          </template>
        </date-table>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { ElButton, ElButtonGroup } from '@element-plus/components/button'
import { useLocale, useNamespace } from '@element-plus/hooks'

import DateTable from './date-table.vue'
import { useCalendar } from './use-calendar'
import { calendarEmits, calendarProps } from './calendar'

import type { Dayjs } from 'dayjs'
import type { CalendarDateType } from './calendar'

const ns = useNamespace('calendar')

const COMPONENT_NAME = 'ElCalendar'
defineOptions({
  name: COMPONENT_NAME,
})

const props = defineProps(calendarProps)
const emit = defineEmits(calendarEmits)

const {
  calculateValidatedDateRange,
  date,
  pickDay: pickCalendarDay,
  realSelectedDay,
  selectDate: selectCalendarDate,
  validatedRange,
} = useCalendar(props, emit, COMPONENT_NAME)

const { lang, t } = useLocale()
const calendarMotionDirection = ref<'backward' | 'forward' | 'neutral'>(
  'neutral'
)

const i18nDate = computed(() => {
  try {
    return new Intl.DateTimeFormat(lang.value, {
      month: 'long',
      year: 'numeric',
    }).format(date.value.toDate())
  } catch {
    const pickedMonth = `el.datepicker.month${date.value.format('M')}`
    return `${date.value.year()} ${t('el.datepicker.year')} ${t(pickedMonth)}`.trim()
  }
})

const calendarBodyKey = computed(() => {
  if (validatedRange.value.length === 0) {
    return date.value.format('YYYY-MM')
  }

  return validatedRange.value
    .map(
      ([start, end]) =>
        `${start.format('YYYY-MM-DD')}:${end.format('YYYY-MM-DD')}`
    )
    .join('|')
})

const setCalendarMotionDirection = (nextDate: Dayjs) => {
  if (nextDate.isBefore(date.value, 'month')) {
    calendarMotionDirection.value = 'backward'
  } else if (nextDate.isAfter(date.value, 'month')) {
    calendarMotionDirection.value = 'forward'
  } else {
    calendarMotionDirection.value = 'neutral'
  }
}

const handlePickDay = (day: Dayjs) => {
  setCalendarMotionDirection(day)
  pickCalendarDay(day)
}

const handleSelectDate = (type: CalendarDateType) => {
  const nextDateMap: Record<CalendarDateType, Dayjs> = {
    'prev-month': date.value.subtract(1, 'month').date(1),
    'next-month': date.value.add(1, 'month').date(1),
    'prev-year': date.value.subtract(1, 'year').date(1),
    'next-year': date.value.add(1, 'year').date(1),
    today: dayjs().locale(date.value.locale()),
  }

  setCalendarMotionDirection(nextDateMap[type])
  selectCalendarDate(type)
}

defineExpose({
  /** @description currently selected date */
  selectedDay: realSelectedDay,
  /** @description select a specific date */
  pickDay: handlePickDay,
  /** @description select date */
  selectDate: handleSelectDate,
  /** @description Calculate the validate date range according to the start and end dates */
  calculateValidatedDateRange,
})
</script>
