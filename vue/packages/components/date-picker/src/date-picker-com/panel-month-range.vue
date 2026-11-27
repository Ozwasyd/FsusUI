<template>
  <div
    :class="[
      ppNs.b(),
      drpNs.b(),
      {
        'has-sidebar': Boolean($slots.sidebar) || hasShortcuts,
      },
    ]"
  >
    <div :class="ppNs.e('body-wrapper')">
      <slot name="sidebar" :class="ppNs.e('sidebar')" />
      <div v-if="hasShortcuts" :class="ppNs.e('sidebar')">
        <button
          v-for="(shortcut, key) in shortcuts"
          :key="key"
          type="button"
          :class="ppNs.e('shortcut')"
          @click="handleShortcutClick(shortcut)"
        >
          {{ shortcut.text }}
        </button>
      </div>
      <div :class="ppNs.e('body')">
        <div
          v-for="panel in calendarPanels"
          :key="panel.side"
          :class="[ppNs.e('content'), drpNs.e('content'), `is-${panel.side}`]"
        >
          <div :class="drpNs.e('header')">
            <button
              v-if="panel.side === 'left' || unlinkPanels"
              type="button"
              :disabled="panel.side === 'right' ? !enableYearArrow : undefined"
              :class="[
                ppNs.e('icon-btn'),
                { 'is-disabled': panel.side === 'right' && !enableYearArrow },
                'd-arrow-left',
              ]"
              @click="panel.prev"
            >
              <el-icon><d-arrow-left /></el-icon>
            </button>
            <button
              v-if="panel.side === 'right' || unlinkPanels"
              type="button"
              :disabled="panel.side === 'left' ? !enableYearArrow : undefined"
              :class="[
                ppNs.e('icon-btn'),
                {
                  [ppNs.is('disabled')]:
                    panel.side === 'left' && !enableYearArrow,
                },
                'd-arrow-right',
              ]"
              @click="panel.next"
            >
              <el-icon><d-arrow-right /></el-icon>
            </button>
            <div>{{ panel.label.value }}</div>
          </div>
          <month-table
            selection-mode="range"
            :date="panel.date.value"
            :min-date="minDate"
            :max-date="maxDate"
            :range-state="rangeState"
            :disabled-date="disabledDate"
            @changerange="handleChangeRange"
            @pick="handleRangePick"
            @select="onSelect"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, ref, toRef } from 'vue'
import dayjs from 'dayjs'
import ElIcon from '@element-plus/components/icon'
import { useLocale } from '@element-plus/hooks'
import { DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import {
  panelMonthRangeEmits,
  panelMonthRangeProps,
} from '../props/panel-month-range'
import { useMonthRangeHeader } from '../composables/use-month-range-header'
import { useRangePicker } from '../composables/use-range-picker'
import MonthTable from './basic-month-table.vue'

import type { Dayjs } from 'dayjs'

defineOptions({
  name: 'DatePickerMonthRange',
})

const props = defineProps(panelMonthRangeProps)
const emit = defineEmits(panelMonthRangeEmits)
const unit = 'year'

const { lang } = useLocale()
const pickerBase = inject('EP_PICKER_BASE') as any
const { shortcuts, disabledDate, format } = pickerBase.props
const defaultValue = toRef(pickerBase.props, 'defaultValue')
const leftDate = ref(dayjs().locale(lang.value))
const rightDate = ref(dayjs().locale(lang.value).add(1, unit))

const {
  minDate,
  maxDate,
  rangeState,
  ppNs,
  drpNs,

  handleChangeRange,
  handleRangeConfirm,
  handleShortcutClick,
  onSelect,
} = useRangePicker(props, {
  defaultValue,
  leftDate,
  rightDate,
  unit,
  onParsedValueChanged,
})

const hasShortcuts = computed(() => !!shortcuts.length)

const {
  leftPrevYear,
  rightNextYear,
  leftNextYear,
  rightPrevYear,
  leftLabel,
  rightLabel,
  leftYear,
  rightYear,
} = useMonthRangeHeader({
  unlinkPanels: toRef(props, 'unlinkPanels'),
  leftDate,
  rightDate,
})

const enableYearArrow = computed(() => {
  return props.unlinkPanels && rightYear.value > leftYear.value + 1
})

const calendarPanels = [
  {
    side: 'left',
    date: leftDate,
    label: leftLabel,
    prev: leftPrevYear,
    next: leftNextYear,
  },
  {
    side: 'right',
    date: rightDate,
    label: rightLabel,
    prev: rightPrevYear,
    next: rightNextYear,
  },
] as const

type RangePickValue = {
  minDate: Dayjs
  maxDate: Dayjs
}

const handleRangePick = (val: RangePickValue, close = true) => {
  // const defaultTime = props.defaultTime || []
  // const minDate_ = modifyWithTimeString(val.minDate, defaultTime[0])
  // const maxDate_ = modifyWithTimeString(val.maxDate, defaultTime[1])
  // todo
  const minDate_ = val.minDate
  const maxDate_ = val.maxDate
  if (maxDate.value === maxDate_ && minDate.value === minDate_) {
    return
  }
  emit('calendar-change', [minDate_.toDate(), maxDate_ && maxDate_.toDate()])
  maxDate.value = maxDate_
  minDate.value = minDate_

  if (!close) return
  handleRangeConfirm()
}

const formatToString = (days: Dayjs[]) => {
  return days.map((day) => day.format(format))
}

function onParsedValueChanged(
  minDate: Dayjs | undefined,
  maxDate: Dayjs | undefined,
) {
  if (props.unlinkPanels && maxDate) {
    const minDateYear = minDate?.year() || 0
    const maxDateYear = maxDate.year()
    rightDate.value =
      minDateYear === maxDateYear ? maxDate.add(1, unit) : maxDate
  } else {
    rightDate.value = leftDate.value.add(1, unit)
  }
}

emit('set-picker-option', ['formatToString', formatToString])
</script>
