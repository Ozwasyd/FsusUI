<template>
  <div
    :class="[
      ppNs.b(),
      drpNs.b(),
      {
        'has-sidebar': $slots.sidebar || hasShortcuts,
        'has-time': showTime,
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
        <div v-if="showTime" :class="drpNs.e('time-header')">
          <span :class="drpNs.e('editors-wrap')">
            <span :class="drpNs.e('time-picker-wrap')">
              <el-input
                size="small"
                :disabled="rangeState.selecting"
                :placeholder="t('el.datepicker.startDate')"
                :class="drpNs.e('editor')"
                :model-value="minVisibleDate"
                :validate-event="false"
                @input="(val) => handleDateInput(val, 'min')"
                @change="(val) => handleDateChange(val, 'min')"
              />
            </span>
            <span
              v-clickoutside="handleMinTimeClose"
              :class="drpNs.e('time-picker-wrap')"
            >
              <el-input
                size="small"
                :class="drpNs.e('editor')"
                :disabled="rangeState.selecting"
                :placeholder="t('el.datepicker.startTime')"
                :model-value="minVisibleTime"
                :validate-event="false"
                @focus="minTimePickerVisible = true"
                @input="(val) => handleTimeInput(val, 'min')"
                @change="(val) => handleTimeChange(val, 'min')"
              />
              <time-pick-panel
                :visible="minTimePickerVisible"
                :format="timeFormat"
                datetime-role="start"
                :parsed-value="leftDate"
                @pick="handleMinTimePick"
              />
            </span>
          </span>
          <span>
            <el-icon><arrow-right /></el-icon>
          </span>
          <span :class="drpNs.e('editors-wrap')" class="is-right">
            <span :class="drpNs.e('time-picker-wrap')">
              <el-input
                size="small"
                :class="drpNs.e('editor')"
                :disabled="rangeState.selecting"
                :placeholder="t('el.datepicker.endDate')"
                :model-value="maxVisibleDate"
                :readonly="!minDate"
                :validate-event="false"
                @input="(val) => handleDateInput(val, 'max')"
                @change="(val) => handleDateChange(val, 'max')"
              />
            </span>
            <span
              v-clickoutside="handleMaxTimeClose"
              :class="drpNs.e('time-picker-wrap')"
            >
              <el-input
                size="small"
                :class="drpNs.e('editor')"
                :disabled="rangeState.selecting"
                :placeholder="t('el.datepicker.endTime')"
                :model-value="maxVisibleTime"
                :readonly="!minDate"
                :validate-event="false"
                @focus="minDate && (maxTimePickerVisible = true)"
                @input="(val) => handleTimeInput(val, 'max')"
                @change="(val) => handleTimeChange(val, 'max')"
              />
              <time-pick-panel
                datetime-role="end"
                :visible="maxTimePickerVisible"
                :format="timeFormat"
                :parsed-value="rightDate"
                @pick="handleMaxTimePick"
              />
            </span>
          </span>
        </div>
        <div
          v-for="panel in calendarPanels"
          :key="panel.side"
          :class="[ppNs.e('content'), drpNs.e('content'), panel.className]"
        >
          <div :class="drpNs.e('header')">
            <button
              v-for="button in panel.buttons.value"
              :key="button.label"
              type="button"
              :disabled="
                button.unlinkSide === panel.side
                  ? !button.enabled.value
                  : undefined
              "
              :class="[
                ppNs.e('icon-btn'),
                {
                  'is-disabled':
                    button.unlinkSide === panel.side && !button.enabled.value,
                },
                button.className,
              ]"
              :aria-label="t(button.label)"
              @click="button[panel.side]"
            >
              <el-icon><component :is="button.icon" /></el-icon>
            </button>
            <div>{{ panel.label.value }}</div>
          </div>
          <div
            :key="panel.viewKey.value"
            :class="[drpNs.e('view'), dateRangeViewMotionClass]"
            v-bind="dateRangeViewAuditAttrs"
          >
            <date-table
              selection-mode="range"
              :date="panel.date.value"
              :min-date="minDate"
              :max-date="maxDate"
              :range-state="rangeState"
              :disabled-date="disabledDate"
              :cell-class-name="cellClassName"
              v-on="dateTableEvents"
            />
          </div>
        </div>
      </div>
    </div>
    <div v-if="showTime" :class="ppNs.e('footer')">
      <el-button
        v-if="clearable"
        text
        size="small"
        :class="ppNs.e('link-btn')"
        @click="handleClear"
      >
        {{ t('el.datepicker.clear') }}
      </el-button>
      <el-button
        plain
        size="small"
        :class="ppNs.e('link-btn')"
        :disabled="btnDisabled"
        @click="handleRangeConfirm(false)"
      >
        {{ t('el.datepicker.confirm') }}
      </el-button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, ref, toRef, unref } from 'vue'
import dayjs from 'dayjs'
import { ClickOutside as vClickoutside } from '@element-plus/directives'
import { isArray } from '@element-plus/utils'
import { useLocale } from '@element-plus/hooks'
import ElButton from '@element-plus/components/button'
import ElInput from '@element-plus/components/input'
import {
  TimePickPanel,
  extractDateFormat,
  extractTimeFormat,
} from '@element-plus/components/time-picker'
import ElIcon from '@element-plus/components/icon'
import {
  ArrowLeft,
  ArrowRight,
  DArrowLeft,
  DArrowRight,
} from '@element-plus/icons-vue'
import { panelDateRangeProps } from '../props/panel-date-range'
import { useRangePicker } from '../composables/use-range-picker'
import { getDefaultValue, isValidRange } from '../utils'
import DateTable from './basic-date-table.vue'

import type { ComputedRef, Ref } from 'vue'
import type { Dayjs } from 'dayjs'

type ChangeType = 'min' | 'max'
type DateRangeViewMotion = 'next' | 'prev'
type UserInput = {
  min: string | null
  max: string | null
}

const props = defineProps(panelDateRangeProps)
const emit = defineEmits([
  'pick',
  'set-picker-option',
  'calendar-change',
  'panel-change',
])

const unit = 'month'
// FIXME: fix the type for ep picker
const pickerBase = inject('EP_PICKER_BASE') as any
const { disabledDate, cellClassName, format, defaultTime, clearable } =
  pickerBase.props
const shortcuts = toRef(pickerBase.props, 'shortcuts')
const defaultValue = toRef(pickerBase.props, 'defaultValue')
const { lang } = useLocale()
const leftDate = ref<Dayjs>(dayjs().locale(lang.value))
const rightDate = ref<Dayjs>(dayjs().locale(lang.value).add(1, unit))
const dateRangeViewMotion = ref<DateRangeViewMotion>('next')

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
  t,
} = useRangePicker(props, {
  defaultValue,
  leftDate,
  rightDate,
  unit,
  onParsedValueChanged,
})

const dateUserInput = ref<UserInput>({
  min: null,
  max: null,
})

const timeUserInput = ref<UserInput>({
  min: null,
  max: null,
})

const createCalendarPanel = (side: 'left' | 'right', date: Ref<Dayjs>) => {
  const year = computed(() => date.value.year())
  const month = computed(() => date.value.month())
  return {
    side,
    className: `is-${side}`,
    date,
    year,
    month,
    buttons: computed(() =>
      props.unlinkPanels
        ? calendarButtons
        : calendarButtons.filter((button) => button.unlinkSide !== side),
    ),
    label: computed(
      () =>
        `${year.value} ${t('el.datepicker.year')} ${t(`el.datepicker.month${month.value + 1}`)}`,
    ),
    viewKey: computed(() => `${side}-${year.value}-${month.value}`),
  }
}
const leftPanel = createCalendarPanel('left', leftDate)
const rightPanel = createCalendarPanel('right', rightDate)
const { year: leftYear, month: leftMonth } = leftPanel
const { year: rightYear, month: rightMonth } = rightPanel
const calendarPanels = [leftPanel, rightPanel]

const hasShortcuts = computed(() => !!shortcuts.value.length)

const dateRangeViewMotionClass = computed(
  () => `${ppNs.namespace.value}-date-picker-view-${dateRangeViewMotion.value}`,
)

const dateRangeViewAuditAttrs = computed(() => ({
  'data-fsus-date-view-motion': dateRangeViewMotion.value,
}))

const timeFormat = computed(() => {
  return props.timeFormat || extractTimeFormat(format)
})

const dateFormat = computed(() => {
  return props.dateFormat || extractDateFormat(format)
})

const visibleValue = (
  input: Ref<UserInput>,
  type: ChangeType,
  inputFormat: ComputedRef<string>,
) =>
  computed(() => {
    const draft = input.value[type]
    if (draft !== null) return draft
    const date = type === 'min' ? minDate.value : maxDate.value || minDate.value
    return date?.format(inputFormat.value) ?? ''
  })

const minVisibleDate = visibleValue(dateUserInput, 'min', dateFormat)
const maxVisibleDate = visibleValue(dateUserInput, 'max', dateFormat)
const minVisibleTime = visibleValue(timeUserInput, 'min', timeFormat)
const maxVisibleTime = visibleValue(timeUserInput, 'max', timeFormat)

const isValidValue = (date: [Dayjs, Dayjs]) => {
  return (
    isValidRange(date) &&
    (disabledDate
      ? !disabledDate(date[0].toDate()) && !disabledDate(date[1].toDate())
      : true)
  )
}

const navigatePanel = (
  panel: 'left' | 'right',
  direction: DateRangeViewMotion,
  mode: 'month' | 'year',
) => {
  dateRangeViewMotion.value = direction
  const move = (date: Dayjs) =>
    direction === 'next' ? date.add(1, mode) : date.subtract(1, mode)

  if (panel === 'left') {
    leftDate.value = move(leftDate.value)
    if (direction === 'prev' && !props.unlinkPanels) {
      rightDate.value = leftDate.value.add(1, unit)
    }
  } else if (direction === 'next' && !props.unlinkPanels) {
    // The moved left date carries any month-end clamping to the right.
    leftDate.value = move(leftDate.value)
    rightDate.value = leftDate.value.add(1, unit)
  } else {
    rightDate.value = move(rightDate.value)
  }

  emit(
    'panel-change',
    [leftDate.value.toDate(), rightDate.value.toDate()],
    mode,
  )
}

const enableMonthArrow: ComputedRef<boolean> = computed(() => {
  const nextMonth = (leftMonth.value + 1) % 12
  const yearOffset = leftMonth.value + 1 >= 12 ? 1 : 0
  return (
    props.unlinkPanels &&
    new Date(leftYear.value + yearOffset, nextMonth) <
      new Date(rightYear.value, rightMonth.value)
  )
})

const enableYearArrow: ComputedRef<boolean> = computed(() => {
  return (
    props.unlinkPanels &&
    rightYear.value * 12 +
      rightMonth.value -
      (leftYear.value * 12 + leftMonth.value + 1) >=
      12
  )
})

const calendarButtons = (
  [
    { direction: 'prev', unit: 'year', icon: DArrowLeft },
    { direction: 'prev', unit: 'month', icon: ArrowLeft },
    { direction: 'next', unit: 'year', icon: DArrowRight },
    { direction: 'next', unit: 'month', icon: ArrowRight },
  ] as const
).map(({ direction, unit, icon }) => {
  const previous = direction === 'prev'
  const yearly = unit === 'year'
  return {
    icon,
    label: `el.datepicker.${direction}${yearly ? 'Year' : 'Month'}`,
    className: `${yearly ? 'd-' : ''}arrow-${previous ? 'left' : 'right'}`,
    unlinkSide: previous ? 'right' : 'left',
    enabled: yearly ? enableYearArrow : enableMonthArrow,
    left: () => navigatePanel('left', direction, unit),
    right: () => navigatePanel('right', direction, unit),
  }
})

const btnDisabled = computed(() => {
  return !(
    minDate.value &&
    maxDate.value &&
    !rangeState.value.selecting &&
    isValidRange([minDate.value, maxDate.value])
  )
})

const showTime = computed(
  () => props.type === 'datetime' || props.type === 'datetimerange',
)

const formatEmit = (emitDayjs: Dayjs | null, index?: number) => {
  if (!emitDayjs) return
  if (defaultTime) {
    const defaultTimeD = dayjs(
      defaultTime[index as number] || defaultTime,
    ).locale(lang.value)
    return defaultTimeD
      .year(emitDayjs.year())
      .month(emitDayjs.month())
      .date(emitDayjs.date())
  }
  return emitDayjs
}

const handleRangePick = (
  val: {
    minDate: Dayjs
    maxDate: Dayjs | null
  },
  close = true,
) => {
  const min_ = val.minDate
  const max_ = val.maxDate
  const minDate_ = formatEmit(min_, 0)
  const maxDate_ = formatEmit(max_, 1)

  if (maxDate.value === maxDate_ && minDate.value === minDate_) {
    return
  }
  emit('calendar-change', [min_.toDate(), max_ && max_.toDate()])
  maxDate.value = maxDate_
  minDate.value = minDate_

  if (!close || showTime.value) return
  handleRangeConfirm()
}

const dateTableEvents = {
  changerange: handleChangeRange,
  pick: handleRangePick,
  select: onSelect,
}

const minTimePickerVisible = ref(false)
const maxTimePickerVisible = ref(false)

const handleMinTimeClose = () => {
  minTimePickerVisible.value = false
}

const handleMaxTimeClose = () => {
  maxTimePickerVisible.value = false
}

const handleDateInput = (value: string | null, type: ChangeType) => {
  dateUserInput.value[type] = value
  const parsedValueD = dayjs(value, dateFormat.value).locale(lang.value)
  if (parsedValueD.isValid()) {
    if (disabledDate && disabledDate(parsedValueD.toDate())) {
      return
    }
    if (type === 'min') {
      leftDate.value = parsedValueD
      minDate.value = (minDate.value || leftDate.value)
        .year(parsedValueD.year())
        .month(parsedValueD.month())
        .date(parsedValueD.date())
      if (
        !props.unlinkPanels &&
        (!maxDate.value || maxDate.value.isBefore(minDate.value))
      ) {
        rightDate.value = parsedValueD.add(1, 'month')
        maxDate.value = minDate.value.add(1, 'month')
      }
    } else {
      rightDate.value = parsedValueD
      maxDate.value = (maxDate.value || rightDate.value)
        .year(parsedValueD.year())
        .month(parsedValueD.month())
        .date(parsedValueD.date())
      if (
        !props.unlinkPanels &&
        (!minDate.value || minDate.value.isAfter(maxDate.value))
      ) {
        leftDate.value = parsedValueD.subtract(1, 'month')
        minDate.value = maxDate.value.subtract(1, 'month')
      }
    }
  }
}

const handleDateChange = (_: unknown, type: ChangeType) => {
  dateUserInput.value[type] = null
}

const handleTimeInput = (value: string | null, type: ChangeType) => {
  timeUserInput.value[type] = value
  const parsedValueD = dayjs(value, timeFormat.value).locale(lang.value)

  if (parsedValueD.isValid()) {
    if (type === 'min') {
      minTimePickerVisible.value = true
      minDate.value = (minDate.value || leftDate.value)
        .hour(parsedValueD.hour())
        .minute(parsedValueD.minute())
        .second(parsedValueD.second())
      if (!maxDate.value || maxDate.value.isBefore(minDate.value)) {
        maxDate.value = minDate.value
      }
    } else {
      maxTimePickerVisible.value = true
      maxDate.value = (maxDate.value || rightDate.value)
        .hour(parsedValueD.hour())
        .minute(parsedValueD.minute())
        .second(parsedValueD.second())
      rightDate.value = maxDate.value
      if (maxDate.value && maxDate.value.isBefore(minDate.value)) {
        minDate.value = maxDate.value
      }
    }
  }
}

const handleTimeChange = (value: string | null, type: ChangeType) => {
  timeUserInput.value[type] = null
  if (type === 'min') {
    leftDate.value = minDate.value!
    minTimePickerVisible.value = false
  } else {
    rightDate.value = maxDate.value!
    maxTimePickerVisible.value = false
  }
}

const handleMinTimePick = (value: Dayjs, visible: boolean, first: boolean) => {
  if (timeUserInput.value.min) return
  if (value) {
    leftDate.value = value
    minDate.value = (minDate.value || leftDate.value)
      .hour(value.hour())
      .minute(value.minute())
      .second(value.second())
  }

  if (!first) {
    minTimePickerVisible.value = visible
  }

  if (!maxDate.value || maxDate.value.isBefore(minDate.value)) {
    maxDate.value = minDate.value
    rightDate.value = value
  }
}

const handleMaxTimePick = (
  value: Dayjs | null,
  visible: boolean,
  first: boolean,
) => {
  if (timeUserInput.value.max) return
  if (value) {
    rightDate.value = value
    maxDate.value = (maxDate.value || rightDate.value)
      .hour(value.hour())
      .minute(value.minute())
      .second(value.second())
  }

  if (!first) {
    maxTimePickerVisible.value = visible
  }

  if (maxDate.value && maxDate.value.isBefore(minDate.value)) {
    minDate.value = maxDate.value
  }
}

const handleClear = () => {
  leftDate.value = getDefaultValue(unref(defaultValue), {
    lang: unref(lang),
    unit: 'month',
    unlinkPanels: props.unlinkPanels,
  })[0]
  rightDate.value = leftDate.value.add(1, 'month')
  emit('pick', null)
}

const formatToString = (value: Dayjs | Dayjs[]) => {
  return isArray(value)
    ? value.map((_) => _.format(format))
    : value.format(format)
}

const parseUserInput = (value: Dayjs | Dayjs[]) => {
  return isArray(value)
    ? value.map((_) => dayjs(_, format).locale(lang.value))
    : dayjs(value, format).locale(lang.value)
}

function onParsedValueChanged(
  minDate: Dayjs | undefined,
  maxDate: Dayjs | undefined,
) {
  if (props.unlinkPanels && maxDate) {
    const minDateYear = minDate?.year() || 0
    const minDateMonth = minDate?.month() || 0
    const maxDateYear = maxDate.year()
    const maxDateMonth = maxDate.month()
    rightDate.value =
      minDateYear === maxDateYear && minDateMonth === maxDateMonth
        ? maxDate.add(1, unit)
        : maxDate
  } else {
    rightDate.value = leftDate.value.add(1, unit)
    if (maxDate) {
      rightDate.value = rightDate.value
        .hour(maxDate.hour())
        .minute(maxDate.minute())
        .second(maxDate.second())
    }
  }
}

emit('set-picker-option', ['isValidValue', isValidValue])
emit('set-picker-option', ['parseUserInput', parseUserInput])
emit('set-picker-option', ['formatToString', formatToString])
emit('set-picker-option', ['handleClear', handleClear])
</script>
