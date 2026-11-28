<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  addDays,
  addMonths,
  addYears,
  formatDate,
  getDecadeRange,
  getISOWeekNumber,
  getMonthGrid,
  getMonthNames,
  getWeekdayNames,
  isBetweenDays,
  isSameDay,
  isSameMonth,
  isSameYear,
  parseDateByFormat,
  setTime,
  startOfWeek,
  toDate,
  useFsusLocale,
  type FsusSize,
} from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import FsusPopover from '../popover/FsusPopover.vue'
import FsusButton from '../button/FsusButton.vue'

defineOptions({ name: 'FsusDatePicker' })

export type FsusDatePickerMode =
  | 'date'
  | 'daterange'
  | 'datetime'
  | 'datetimerange'
  | 'month'
  | 'monthrange'
  | 'year'
  | 'week'

export type FsusDatePickerValue = string | Date | [string | Date, string | Date] | null

export interface FsusDateShortcut {
  text: string
  value: Date | [Date, Date] | (() => Date | [Date, Date])
}

export interface FsusDatePickerProps {
  mode?: FsusDatePickerMode
  format?: string
  placeholder?: string
  clearable?: boolean
  disabled?: boolean
  editable?: boolean
  size?: FsusSize
  weekStart?: 0 | 1
  rangeSeparator?: string
  shortcuts?: FsusDateShortcut[]
  disabledDate?: (date: Date) => boolean
}

const props = withDefaults(defineProps<FsusDatePickerProps>(), {
  mode: 'date',
  clearable: true,
  disabled: false,
  editable: true,
  size: 'md',
  weekStart: 1,
  rangeSeparator: ' — ',
  shortcuts: () => [],
})

const model = defineModel<FsusDatePickerValue>({ default: null })
const emit = defineEmits<{ change: [value: FsusDatePickerValue] }>()

const { locale, t } = useFsusLocale()
const open = ref(false)

const isRangeMode = computed(
  () =>
    props.mode === 'daterange' ||
    props.mode === 'datetimerange' ||
    props.mode === 'monthrange',
)

const isDateTimeMode = computed(
  () => props.mode === 'datetime' || props.mode === 'datetimerange',
)

const defaultFormatForMode = (m: FsusDatePickerMode): string => {
  if (m === 'datetime' || m === 'datetimerange') return 'YYYY-MM-DD HH:mm:ss'
  if (m === 'month' || m === 'monthrange') return 'YYYY-MM'
  if (m === 'year') return 'YYYY'
  if (m === 'week') return 'YYYY-[W]WW'
  return 'YYYY-MM-DD'
}

const effectiveFormat = computed(() => props.format ?? defaultFormatForMode(props.mode))

const defaultPlaceholder = computed(() => {
  if (props.placeholder) return props.placeholder
  if (props.mode === 'month' || props.mode === 'monthrange') return t('datePicker.selectMonth')
  if (props.mode === 'year') return t('datePicker.selectYear')
  if (props.mode === 'week') return t('datePicker.selectWeek')
  return t('datePicker.selectDate')
})

const initialViewForMode = (m: FsusDatePickerMode): 'day' | 'month' | 'year' => {
  if (m === 'year') return 'year'
  if (m === 'month' || m === 'monthrange') return 'month'
  return 'day'
}

const activeView = ref<'day' | 'month' | 'year'>(initialViewForMode(props.mode))
const cursor = ref<Date>(
  toDate(Array.isArray(model.value) ? model.value[0] : model.value) ?? new Date(),
)
const focusedDate = ref<Date>(new Date(cursor.value.getTime()))
const rangeStart = ref<Date | null>(null)
const draftStart = ref<Date | null>(null)
const draftEnd = ref<Date | null>(null)

// Time spinner state for datetime / datetimerange
const timeTarget = ref<'start' | 'end'>('start')
const startTime = ref({ h: 0, m: 0, s: 0 })
const endTime = ref({ h: 23, m: 59, s: 59 })

const syncDraftsFromModel = () => {
  activeView.value = initialViewForMode(props.mode)
  if (isRangeMode.value) {
    const s = Array.isArray(model.value) ? toDate(model.value[0]) : null
    const e = Array.isArray(model.value) ? toDate(model.value[1]) : null
    draftStart.value = s
    draftEnd.value = e
    rangeStart.value = null
    if (s) {
      cursor.value = new Date(s.getTime())
      focusedDate.value = new Date(s.getTime())
      startTime.value = { h: s.getHours(), m: s.getMinutes(), s: s.getSeconds() }
    }
    if (e) {
      endTime.value = { h: e.getHours(), m: e.getMinutes(), s: e.getSeconds() }
    }
  } else {
    const d = Array.isArray(model.value) ? null : toDate(model.value)
    draftStart.value = d
    draftEnd.value = d
    if (d) {
      cursor.value = new Date(d.getTime())
      focusedDate.value = new Date(d.getTime())
      startTime.value = { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds() }
    }
  }
}

watch(open, (isOpen) => {
  if (isOpen) syncDraftsFromModel()
})

watch(
  () => props.mode,
  () => {
    activeView.value = initialViewForMode(props.mode)
  },
)

const weekdays = computed(() => getWeekdayNames(locale.value.name, props.weekStart))
const monthNames = computed(() => getMonthNames(locale.value.name))
const cells = computed(() =>
  getMonthGrid(cursor.value.getFullYear(), cursor.value.getMonth(), props.weekStart),
)
const weekRows = computed(() => {
  const rows: Array<{ weekNumber: number; days: typeof cells.value }> = []
  for (let i = 0; i < cells.value.length; i += 7) {
    const slice = cells.value.slice(i, i + 7)
    rows.push({
      weekNumber: getISOWeekNumber(slice[3]?.date ?? slice[0]!.date),
      days: slice,
    })
  }
  return rows
})
const decadeYears = computed(() => getDecadeRange(cursor.value.getFullYear()))

const selectedRange = computed<[Date | null, Date | null]>(() => {
  if (isRangeMode.value) {
    if (rangeStart.value) return [rangeStart.value, null]
    if (open.value && (draftStart.value || draftEnd.value)) {
      return [draftStart.value, draftEnd.value]
    }
    if (Array.isArray(model.value)) return [toDate(model.value[0]), toDate(model.value[1])]
    return [null, null]
  }
  const single =
    open.value && draftStart.value
      ? draftStart.value
      : Array.isArray(model.value)
        ? null
        : toDate(model.value)
  return [single, single]
})

const displayValue = computed(() => {
  if (isRangeMode.value && Array.isArray(model.value)) {
    const s = formatDate(model.value[0], effectiveFormat.value)
    const e = formatDate(model.value[1], effectiveFormat.value)
    return s && e ? `${s}${props.rangeSeparator}${e}` : ''
  }
  if (!Array.isArray(model.value)) return formatDate(model.value, effectiveFormat.value)
  return ''
})

// Editable input draft
const inputDraft = ref(displayValue.value)
const isEditing = ref(false)
watch(displayValue, (val) => {
  if (!isEditing.value) inputDraft.value = val
})

const commitValue = (next: FsusDatePickerValue, closeAfter = true) => {
  model.value = next
  emit('change', next)
  if (closeAfter) open.value = false
}

const commitManualInput = () => {
  isEditing.value = false
  const text = inputDraft.value.trim()
  if (!text) {
    if (props.clearable) commitValue(null, false)
    else inputDraft.value = displayValue.value
    return
  }
  if (isRangeMode.value) {
    const parts = text.split(/\s*(?:—|~|to|\s-\s)\s*/i).filter(Boolean)
    if (parts.length === 2) {
      const a = parseDateByFormat(parts[0]!, effectiveFormat.value)
      const b = parseDateByFormat(parts[1]!, effectiveFormat.value)
      if (a && b && !props.disabledDate?.(a) && !props.disabledDate?.(b)) {
        const [lo, hi] = a.getTime() <= b.getTime() ? [a, b] : [b, a]
        commitValue(
          [formatDate(lo, effectiveFormat.value), formatDate(hi, effectiveFormat.value)],
          false,
        )
        cursor.value = new Date(lo.getTime())
        return
      }
    }
    inputDraft.value = displayValue.value
    return
  }
  const parsed = parseDateByFormat(text, effectiveFormat.value)
  if (parsed && !props.disabledDate?.(parsed)) {
    const finalDate = props.mode === 'week' ? startOfWeek(parsed, props.weekStart) : parsed
    commitValue(formatDate(finalDate, effectiveFormat.value), false)
    cursor.value = new Date(finalDate.getTime())
  } else {
    inputDraft.value = displayValue.value
  }
}

const applyTimeToDate = (date: Date, time: { h: number; m: number; s: number }) =>
  setTime(date, time.h, time.m, time.s)

const selectDayCell = (date: Date) => {
  if (props.disabledDate?.(date)) return
  focusedDate.value = new Date(date.getTime())

  if (props.mode === 'week') {
    const wkStart = startOfWeek(date, props.weekStart)
    commitValue(formatDate(wkStart, effectiveFormat.value))
    return
  }

  if (props.mode === 'date') {
    commitValue(formatDate(date, effectiveFormat.value))
    return
  }

  if (props.mode === 'datetime') {
    draftStart.value = applyTimeToDate(date, startTime.value)
    return
  }

  // daterange / datetimerange
  if (!rangeStart.value) {
    rangeStart.value = applyTimeToDate(date, startTime.value)
    draftStart.value = rangeStart.value
    draftEnd.value = null
  } else {
    const [a, b] =
      date.getTime() < rangeStart.value.getTime()
        ? [date, rangeStart.value]
        : [rangeStart.value, date]
    const withTimeA = applyTimeToDate(a, startTime.value)
    const withTimeB = applyTimeToDate(b, endTime.value)
    rangeStart.value = null
    draftStart.value = withTimeA
    draftEnd.value = withTimeB
    if (props.mode === 'daterange') {
      commitValue([
        formatDate(withTimeA, effectiveFormat.value),
        formatDate(withTimeB, effectiveFormat.value),
      ])
    }
  }
}

const selectMonthCell = (monthIndex: number) => {
  const picked = new Date(cursor.value.getFullYear(), monthIndex, 1)
  if (props.disabledDate?.(picked)) return
  if (props.mode === 'month') {
    commitValue(formatDate(picked, effectiveFormat.value))
    return
  }
  if (props.mode === 'monthrange') {
    if (!rangeStart.value) {
      rangeStart.value = picked
      draftStart.value = picked
      draftEnd.value = null
    } else {
      const [a, b] =
        picked.getTime() < rangeStart.value.getTime()
          ? [picked, rangeStart.value]
          : [rangeStart.value, picked]
      rangeStart.value = null
      draftStart.value = a
      draftEnd.value = b
      commitValue([
        formatDate(a, effectiveFormat.value),
        formatDate(b, effectiveFormat.value),
      ])
    }
    return
  }
  // Drill down into day view when picking month from day mode
  cursor.value = new Date(cursor.value.getFullYear(), monthIndex, 1)
  activeView.value = 'day'
}

const selectYearCell = (year: number) => {
  const picked = new Date(year, 0, 1)
  if (props.disabledDate?.(picked)) return
  if (props.mode === 'year') {
    commitValue(formatDate(picked, effectiveFormat.value))
    return
  }
  cursor.value = new Date(year, cursor.value.getMonth(), 1)
  activeView.value = props.mode === 'month' || props.mode === 'monthrange' ? 'month' : 'day'
}

const confirmDateTime = () => {
  if (props.mode === 'datetime') {
    const base = draftStart.value ?? new Date()
    const finalDate = applyTimeToDate(base, startTime.value)
    commitValue(formatDate(finalDate, effectiveFormat.value))
    return
  }
  if (props.mode === 'datetimerange') {
    const a = draftStart.value ?? new Date()
    const b = draftEnd.value ?? a
    const withA = applyTimeToDate(a, startTime.value)
    const withB = applyTimeToDate(b, endTime.value)
    const [lo, hi] = withA.getTime() <= withB.getTime() ? [withA, withB] : [withB, withA]
    commitValue([
      formatDate(lo, effectiveFormat.value),
      formatDate(hi, effectiveFormat.value),
    ])
  }
}

const pickNow = () => {
  const now = new Date()
  if (props.disabledDate?.(now)) return
  startTime.value = { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() }
  if (props.mode === 'datetime') {
    draftStart.value = now
    commitValue(formatDate(now, effectiveFormat.value))
  } else if (props.mode === 'datetimerange') {
    draftStart.value = now
    draftEnd.value = now
    endTime.value = { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() }
    commitValue([formatDate(now, effectiveFormat.value), formatDate(now, effectiveFormat.value)])
  } else {
    commitValue(formatDate(now, effectiveFormat.value))
  }
}

const applyShortcut = (shortcut: FsusDateShortcut) => {
  const val = typeof shortcut.value === 'function' ? shortcut.value() : shortcut.value
  if (Array.isArray(val)) {
    const [a, b] = val
    commitValue([
      formatDate(a, effectiveFormat.value),
      formatDate(b, effectiveFormat.value),
    ])
  } else {
    const finalVal = props.mode === 'week' ? startOfWeek(val, props.weekStart) : val
    commitValue(formatDate(finalVal, effectiveFormat.value))
  }
}

const clear = (event: MouseEvent) => {
  event.stopPropagation()
  rangeStart.value = null
  draftStart.value = null
  draftEnd.value = null
  inputDraft.value = ''
  commitValue(null, false)
}

const navigatePrev = () => {
  if (activeView.value === 'year') cursor.value = addYears(cursor.value, -10)
  else if (activeView.value === 'month') cursor.value = addYears(cursor.value, -1)
  else cursor.value = addMonths(cursor.value, -1)
}

const navigateNext = () => {
  if (activeView.value === 'year') cursor.value = addYears(cursor.value, 10)
  else if (activeView.value === 'month') cursor.value = addYears(cursor.value, 1)
  else cursor.value = addMonths(cursor.value, 1)
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    open.value = false
    return
  }
  if (!open.value) {
    if (e.key === 'ArrowDown' || (e.key === 'Enter' && !isEditing.value)) {
      open.value = true
      e.preventDefault()
    }
    return
  }
  if (activeView.value === 'day' && !isEditing.value) {
    const deltaMap: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    const delta = deltaMap[e.key]
    if (delta !== undefined) {
      e.preventDefault()
      focusedDate.value = addDays(focusedDate.value, delta)
      cursor.value = new Date(focusedDate.value.getFullYear(), focusedDate.value.getMonth(), 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectDayCell(focusedDate.value)
    }
  }
}

const activeTimeObj = computed(() =>
  props.mode === 'datetimerange' && timeTarget.value === 'end' ? endTime.value : startTime.value,
)

const setTimePart = (part: 'h' | 'm' | 's', value: number) => {
  const target =
    props.mode === 'datetimerange' && timeTarget.value === 'end' ? endTime.value : startTime.value
  target[part] = value
  if (props.mode === 'datetime' && draftStart.value) {
    draftStart.value = applyTimeToDate(draftStart.value, startTime.value)
  } else if (props.mode === 'datetimerange') {
    if (timeTarget.value === 'start' && draftStart.value) {
      draftStart.value = applyTimeToDate(draftStart.value, startTime.value)
    } else if (timeTarget.value === 'end' && draftEnd.value) {
      draftEnd.value = applyTimeToDate(draftEnd.value, endTime.value)
    }
  }
}

const hoursList = Array.from({ length: 24 }, (_, i) => i)
const sixtyList = Array.from({ length: 60 }, (_, i) => i)
const pad2 = (n: number) => String(n).padStart(2, '0')

const isMonthInRange = (monthIndex: number): boolean => {
  if (props.mode !== 'monthrange') return false
  const [s, e] = selectedRange.value
  if (!s || !e) return false
  const target = new Date(cursor.value.getFullYear(), monthIndex, 1).getTime()
  const lo = new Date(s.getFullYear(), s.getMonth(), 1).getTime()
  const hi = new Date(e.getFullYear(), e.getMonth(), 1).getTime()
  return target >= Math.min(lo, hi) && target <= Math.max(lo, hi)
}

const isWeekSelected = (date: Date): boolean => {
  if (props.mode !== 'week' || !selectedRange.value[0]) return false
  return isSameDay(
    startOfWeek(date, props.weekStart),
    startOfWeek(selectedRange.value[0], props.weekStart),
  )
}

const panelWidth = computed(() => {
  let w = 296
  if (props.shortcuts.length > 0) w += 116
  if (isDateTimeMode.value) w += 156
  return w
})
</script>

<template>
  <FsusPopover v-model:open="open" :disabled="disabled" :width="panelWidth">
    <template #reference>
      <div
        class="fsus-select fsus-date-picker"
        role="combobox"
        :tabindex="disabled || editable ? -1 : 0"
        :aria-expanded="open ? 'true' : 'false'"
        :data-size="size"
        :data-disabled="disabled ? '' : undefined"
        @keydown="onKeydown"
      >
        <FsusIcon name="calendar" :size="14" class="fsus-date-picker__prefix" />
        <div class="fsus-select__selection">
          <input
            v-if="editable"
            v-model="inputDraft"
            type="text"
            class="fsus-date-picker__input"
            :disabled="disabled"
            :placeholder="defaultPlaceholder"
            @focus="isEditing = true"
            @blur="commitManualInput"
            @keydown.enter.stop="commitManualInput"
          />
          <template v-else>
            <span v-if="displayValue" class="fsus-select__value">{{ displayValue }}</span>
            <span v-else class="fsus-select__placeholder">{{ defaultPlaceholder }}</span>
          </template>
        </div>
        <button
          v-if="clearable && displayValue && !disabled"
          type="button"
          class="fsus-select__clear"
          :aria-label="t('common.clear')"
          @click="clear"
        >
          <FsusIcon name="circle-close" :size="14" />
        </button>
      </div>
    </template>

    <div
      class="fsus-date-panel"
      :data-has-shortcuts="shortcuts.length > 0 ? '' : undefined"
      :data-has-time="isDateTimeMode ? '' : undefined"
      @keydown="onKeydown"
    >
      <aside v-if="shortcuts.length > 0" class="fsus-date-panel__shortcuts">
        <button
          v-for="item in shortcuts"
          :key="item.text"
          type="button"
          class="fsus-date-panel__shortcut"
          @click="applyShortcut(item)"
        >
          {{ item.text }}
        </button>
      </aside>

      <div class="fsus-date-panel__body">
        <header class="fsus-date-panel__header">
          <div class="fsus-date-panel__nav">
            <button
              type="button"
              class="fsus-date-panel__btn"
              :aria-label="t('datePicker.prevYear')"
              @click="cursor = addYears(cursor, activeView === 'year' ? -10 : -1)"
            >
              <FsusIcon name="d-arrow-left" :size="12" />
            </button>
            <button
              v-if="activeView === 'day'"
              type="button"
              class="fsus-date-panel__btn"
              :aria-label="t('datePicker.prevMonth')"
              @click="navigatePrev"
            >
              <FsusIcon name="arrow-left" :size="12" />
            </button>
          </div>

          <div class="fsus-date-panel__title-group">
            <button
              v-if="activeView !== 'year'"
              type="button"
              class="fsus-date-panel__title-btn"
              @click="activeView = 'year'"
            >
              {{ cursor.getFullYear() }}
            </button>
            <span v-else class="fsus-date-panel__title">
              {{ decadeYears[0] }} – {{ decadeYears[decadeYears.length - 1] }}
            </span>
            <button
              v-if="activeView === 'day'"
              type="button"
              class="fsus-date-panel__title-btn"
              @click="activeView = 'month'"
            >
              {{ monthNames[cursor.getMonth()] }}
            </button>
          </div>

          <div class="fsus-date-panel__nav">
            <button
              v-if="activeView === 'day'"
              type="button"
              class="fsus-date-panel__btn"
              :aria-label="t('datePicker.nextMonth')"
              @click="navigateNext"
            >
              <FsusIcon name="arrow-right" :size="12" />
            </button>
            <button
              type="button"
              class="fsus-date-panel__btn"
              :aria-label="t('datePicker.nextYear')"
              @click="cursor = addYears(cursor, activeView === 'year' ? 10 : 1)"
            >
              <FsusIcon name="d-arrow-right" :size="12" />
            </button>
          </div>
        </header>

        <!-- Year Grid -->
        <div v-if="activeView === 'year'" class="fsus-date-panel__grid-4" role="grid">
          <button
            v-for="yr in decadeYears"
            :key="yr"
            type="button"
            class="fsus-date-panel__cell fsus-date-panel__cell--wide"
            :disabled="disabledDate?.(new Date(yr, 0, 1))"
            :data-selected="isSameYear(new Date(yr, 0, 1), selectedRange[0]) ? '' : undefined"
            @click="selectYearCell(yr)"
          >
            {{ yr }}
          </button>
        </div>

        <!-- Month Grid -->
        <div v-else-if="activeView === 'month'" class="fsus-date-panel__grid-4" role="grid">
          <button
            v-for="(mLabel, mIdx) in monthNames"
            :key="mIdx"
            type="button"
            class="fsus-date-panel__cell fsus-date-panel__cell--wide"
            :disabled="disabledDate?.(new Date(cursor.getFullYear(), mIdx, 1))"
            :data-selected="
              isSameMonth(new Date(cursor.getFullYear(), mIdx, 1), selectedRange[0]) ||
              isSameMonth(new Date(cursor.getFullYear(), mIdx, 1), selectedRange[1])
                ? ''
                : undefined
            "
            :data-in-range="isMonthInRange(mIdx) ? '' : undefined"
            @click="selectMonthCell(mIdx)"
          >
            {{ mLabel }}
          </button>
        </div>

        <!-- Week Mode Grid -->
        <template v-else-if="mode === 'week'">
          <div class="fsus-date-panel__weekdays fsus-date-panel__weekdays--week">
            <span class="fsus-date-panel__weekday">{{ t('datePicker.week') }}</span>
            <span v-for="wd in weekdays" :key="wd" class="fsus-date-panel__weekday">{{ wd }}</span>
          </div>
          <div class="fsus-date-panel__week-rows" role="grid">
            <div
              v-for="wRow in weekRows"
              :key="wRow.days[0]!.key"
              class="fsus-date-panel__week-row"
              :data-selected="isWeekSelected(wRow.days[0]!.date) ? '' : undefined"
            >
              <span class="fsus-date-panel__week-num">{{ wRow.weekNumber }}</span>
              <button
                v-for="cell in wRow.days"
                :key="cell.key"
                type="button"
                class="fsus-date-panel__cell"
                :disabled="disabledDate?.(cell.date)"
                :data-outside="!cell.isCurrentMonth ? '' : undefined"
                :data-today="cell.isToday ? '' : undefined"
                @click="selectDayCell(cell.date)"
              >
                {{ cell.day }}
              </button>
            </div>
          </div>
        </template>

        <!-- Day Grid -->
        <template v-else>
          <div class="fsus-date-panel__weekdays">
            <span v-for="wd in weekdays" :key="wd" class="fsus-date-panel__weekday">{{ wd }}</span>
          </div>
          <div class="fsus-date-panel__grid" role="grid">
            <button
              v-for="cell in cells"
              :key="cell.key"
              type="button"
              class="fsus-date-panel__cell"
              :disabled="disabledDate?.(cell.date)"
              :data-outside="!cell.isCurrentMonth ? '' : undefined"
              :data-today="cell.isToday ? '' : undefined"
              :data-focused="isSameDay(cell.date, focusedDate) ? '' : undefined"
              :data-selected="
                isSameDay(cell.date, selectedRange[0]) || isSameDay(cell.date, selectedRange[1])
                  ? ''
                  : undefined
              "
              :data-in-range="
                (mode === 'daterange' || mode === 'datetimerange') &&
                isBetweenDays(cell.date, selectedRange[0], selectedRange[1])
                  ? ''
                  : undefined
              "
              @click="selectDayCell(cell.date)"
            >
              {{ cell.day }}
            </button>
          </div>
        </template>

        <!-- Footer for datetime / datetimerange -->
        <footer v-if="isDateTimeMode" class="fsus-date-panel__footer">
          <FsusButton size="sm" variant="ghost" @click="pickNow">
            {{ t('datePicker.now') }}
          </FsusButton>
          <FsusButton size="sm" variant="primary" @click="confirmDateTime">
            {{ t('common.confirm') }}
          </FsusButton>
        </footer>
      </div>

      <!-- Time Spinner Panel for datetime / datetimerange -->
      <div v-if="isDateTimeMode" class="fsus-date-panel__time">
        <div v-if="mode === 'datetimerange'" class="fsus-date-panel__time-tabs">
          <button
            type="button"
            class="fsus-date-panel__time-tab"
            :data-active="timeTarget === 'start' ? '' : undefined"
            @click="timeTarget = 'start'"
          >
            {{ t('datePicker.startDate') }}
          </button>
          <button
            type="button"
            class="fsus-date-panel__time-tab"
            :data-active="timeTarget === 'end' ? '' : undefined"
            @click="timeTarget = 'end'"
          >
            {{ t('datePicker.endDate') }}
          </button>
        </div>
        <div class="fsus-date-panel__time-cols">
          <div class="fsus-date-panel__time-col" aria-label="Hours">
            <button
              v-for="hr in hoursList"
              :key="`h-${hr}`"
              type="button"
              class="fsus-date-panel__time-cell"
              :data-selected="activeTimeObj.h === hr ? '' : undefined"
              @click="setTimePart('h', hr)"
            >
              {{ pad2(hr) }}
            </button>
          </div>
          <div class="fsus-date-panel__time-col" aria-label="Minutes">
            <button
              v-for="mn in sixtyList"
              :key="`m-${mn}`"
              type="button"
              class="fsus-date-panel__time-cell"
              :data-selected="activeTimeObj.m === mn ? '' : undefined"
              @click="setTimePart('m', mn)"
            >
              {{ pad2(mn) }}
            </button>
          </div>
          <div class="fsus-date-panel__time-col" aria-label="Seconds">
            <button
              v-for="sc in sixtyList"
              :key="`s-${sc}`"
              type="button"
              class="fsus-date-panel__time-cell"
              :data-selected="activeTimeObj.s === sc ? '' : undefined"
              @click="setTimePart('s', sc)"
            >
              {{ pad2(sc) }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </FsusPopover>
</template>
