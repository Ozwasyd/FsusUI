<template>
  <div :class="[ns.b('spinner'), { 'has-seconds': showSeconds }]">
    <template v-if="!arrowControl">
      <el-scrollbar
        v-for="item in spinnerItems"
        :key="item"
        :ref="(scrollbar: unknown) => setRef(scrollbar as any, item)"
        :class="[
          ns.be('spinner', 'wrapper'),
          ns.is('scrolling', scrollingTypes[item]),
        ]"
        wrap-style="max-height: inherit;"
        :view-class="ns.be('spinner', 'list')"
        noresize
        tag="ul"
        v-on="getScrollbarEvents(item)"
      >
        <li
          v-for="option in circularTimeList[item]"
          :key="`${option.cycle}-${option.value}`"
          :class="[
            ns.be('spinner', 'item'),
            ns.is(
              'active',
              option.value === timePartials[item] &&
                option.cycle === activeCycles[item],
            ),
            ns.is('disabled', option.disabled),
          ]"
          v-bind="{
            'data-time-value': option.value,
            'data-time-cycle': option.cycle,
          }"
          @click="handleClick(item, option)"
        >
          <template v-if="item === 'hours'">
            {{
              ('0' + (amPmMode ? option.value % 12 || 12 : option.value)).slice(
                -2,
              )
            }}{{ getAmPmFlag(option.value) }}
          </template>
          <template v-else>
            {{ ('0' + option.value).slice(-2) }}
          </template>
        </li>
      </el-scrollbar>
    </template>
    <template v-if="arrowControl">
      <div
        v-for="item in spinnerItems"
        :key="item"
        :class="[ns.be('spinner', 'wrapper'), ns.is('arrow')]"
        @mouseenter="emitSelectRange(item)"
      >
        <el-icon
          v-repeat-click="onDecrement"
          :class="['arrow-up', ns.be('spinner', 'arrow')]"
        >
          <arrow-up />
        </el-icon>
        <el-icon
          v-repeat-click="onIncrement"
          :class="['arrow-down', ns.be('spinner', 'arrow')]"
        >
          <arrow-down />
        </el-icon>
        <ul :class="ns.be('spinner', 'list')">
          <li
            v-for="(time, key) in arrowControlTimeList[item]"
            :key="key"
            :class="[
              ns.be('spinner', 'item'),
              ns.is('active', time === timePartials[item]),
              ns.is('disabled', timeList[item][time!]),
            ]"
          >
            <template v-if="typeof time === 'number'">
              <template v-if="item === 'hours'">
                {{ ('0' + (amPmMode ? time % 12 || 12 : time)).slice(-2)
                }}{{ getAmPmFlag(time) }}
              </template>
              <template v-else>
                {{ ('0' + time).slice(-2) }}
              </template>
            </template>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
<script lang="ts" setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  unref,
  watch,
} from 'vue'
import { vRepeatClick } from '@element-plus/directives'
import ElScrollbar from '@element-plus/components/scrollbar'
import ElIcon from '@element-plus/components/icon'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import {
  normalizeFsusWheelDelta,
  useFsusMotionRuntime,
  useNamespace,
} from '@element-plus/hooks'
import { getStyle } from '@element-plus/utils'
import { timeUnits } from '../constants'
import { buildTimeList } from '../utils'
import { basicTimeSpinnerProps } from '../props/basic-time-spinner'
import { getTimeLists } from '../composables/use-time-picker'

import type { Ref } from 'vue'
import type { ScrollbarInstance } from '@element-plus/components/scrollbar'
import type { TimeUnit } from '../constants'
import type { TimeList } from '../utils'

const props = defineProps(basicTimeSpinnerProps)
const emit = defineEmits(['change', 'select-range', 'set-option'])

const ns = useNamespace('time')
const motionRuntime = useFsusMotionRuntime()
const circularSpinnerCycles = 7
const circularSpinnerMiddleCycle = Math.floor(circularSpinnerCycles / 2)
const circularSpinnerRecenterEdgeCycles = 0

const { getHoursList, getMinutesList, getSecondsList } = getTimeLists(
  props.disabledHours,
  props.disabledMinutes,
  props.disabledSeconds,
)

// data
let isScrolling = false

const currentScrollbar = ref<TimeUnit>()
const listHoursRef = ref<ScrollbarInstance>()
const listMinutesRef = ref<ScrollbarInstance>()
const listSecondsRef = ref<ScrollbarInstance>()
const listRefsMap: Record<TimeUnit, Ref<ScrollbarInstance | undefined>> = {
  hours: listHoursRef,
  minutes: listMinutesRef,
  seconds: listSecondsRef,
}
const activeCycles = reactive<Record<TimeUnit, number>>({
  hours: circularSpinnerMiddleCycle,
  minutes: circularSpinnerMiddleCycle,
  seconds: circularSpinnerMiddleCycle,
})
const scrollingTypes = reactive<Record<TimeUnit, boolean>>({
  hours: false,
  minutes: false,
  seconds: false,
})
const resetScrollTimers: Partial<Record<TimeUnit, number>> = {}
const pendingSpinnerScrolls: Partial<
  Record<TimeUnit, { cycle: number; value: number }>
> = {}
const pendingScrollTypes: Partial<Record<TimeUnit, boolean>> = {}
const programmaticScrollTypes: Partial<Record<TimeUnit, boolean>> = {}
const itemHeightCache: Partial<Record<TimeUnit, number>> = {}
const smoothWheelStates: Partial<
  Record<TimeUnit, { current: number; target: number; frame: number }>
> = {}
const wheelHandlers: Partial<Record<TimeUnit, (event: WheelEvent) => void>> = {}
let spinnerScrollFrame = 0
let handleScrollFrame = 0
let hasPendingDisplayChange = false
let isFlushingDisplayChange = false

// computed
const spinnerItems = computed(() => {
  return props.showSeconds ? timeUnits : timeUnits.slice(0, 2)
})

const propTimePartials = computed<Record<TimeUnit, number>>(() => {
  const { spinnerDate } = props
  const hours = spinnerDate.hour()
  const minutes = spinnerDate.minute()
  const seconds = spinnerDate.second()
  return { hours, minutes, seconds }
})

const displayPartials = reactive<Record<TimeUnit, number>>({
  hours: 0,
  minutes: 0,
  seconds: 0,
})

watch(
  propTimePartials,
  (nextPartials) => {
    if (isScrolling) return
    displayPartials.hours = nextPartials.hours
    displayPartials.minutes = nextPartials.minutes
    displayPartials.seconds = nextPartials.seconds
  },
  { immediate: true },
)

const timePartials = computed<Record<TimeUnit, number>>(() => ({
  hours: displayPartials.hours,
  minutes: displayPartials.minutes,
  seconds: displayPartials.seconds,
}))

const timeList = computed(() => {
  const { hours, minutes } = unref(timePartials)
  return {
    hours: getHoursList(props.role),
    minutes: getMinutesList(hours, props.role),
    seconds: getSecondsList(hours, minutes, props.role),
  }
})

const circularTimeList = computed<
  Record<
    TimeUnit,
    Array<{
      value: number
      disabled: boolean
      cycle: number
    }>
  >
>(() => {
  const result: Record<
    TimeUnit,
    Array<{
      value: number
      disabled: boolean
      cycle: number
    }>
  > = {
    hours: [],
    minutes: [],
    seconds: [],
  }

  for (const type of spinnerItems.value) {
    const list = timeList.value[type]

    result[type] = Array.from(
      { length: list.length * circularSpinnerCycles },
      (_, index) => {
        const value = index % list.length

        return {
          value,
          disabled: list[value],
          cycle: Math.floor(index / list.length),
        }
      },
    )
  }

  return result
})

const arrowControlTimeList = computed<Record<TimeUnit, TimeList>>(() => {
  const { hours, minutes, seconds } = unref(timePartials)

  return {
    hours: buildTimeList(hours, 23),
    minutes: buildTimeList(minutes, 59),
    seconds: buildTimeList(seconds, 59),
  }
})

const resetScroll = (type: TimeUnit) => {
  isScrolling = false
  scrollingTypes[type] = false
  alignCurrentSpinner(type)
  flushDisplayChange()
}

const scheduleResetScroll = (type: TimeUnit) => {
  window.clearTimeout(resetScrollTimers[type])
  resetScrollTimers[type] = window.setTimeout(
    () => resetScroll(type),
    motionRuntime.value.scrollIdleMs || 200,
  )
}

const getAmPmFlag = (hour: number) => {
  const shouldShowAmPm = !!props.amPmMode
  if (!shouldShowAmPm) return ''
  const isCapital = props.amPmMode === 'A'
  // todo locale
  let content = hour < 12 ? ' am' : ' pm'
  if (isCapital) content = content.toUpperCase()
  return content
}

const emitSelectRange = (type: TimeUnit) => {
  let range

  switch (type) {
    case 'hours':
      range = [0, 2]
      break
    case 'minutes':
      range = [3, 5]
      break
    case 'seconds':
      range = [6, 8]
      break
  }
  const [left, right] = range

  emit('select-range', left, right)
  currentScrollbar.value = type
}

const adjustCurrentSpinner = (type: TimeUnit) => {
  adjustSpinner(type, unref(timePartials)[type])
}

const shouldRecenterSpinner = (cycle: number) =>
  cycle <= circularSpinnerRecenterEdgeCycles ||
  cycle >= circularSpinnerCycles - circularSpinnerRecenterEdgeCycles - 1

const resolveIdleAlignCycle = (type: TimeUnit) => {
  const cycle = activeCycles[type]
  return shouldRecenterSpinner(cycle) ? circularSpinnerMiddleCycle : cycle
}

const alignCurrentSpinner = (type: TimeUnit) => {
  adjustSpinner(type, unref(timePartials)[type], resolveIdleAlignCycle(type))
}

const getScrollbarEvents = (type: TimeUnit) => ({
  mouseenter: () => emitSelectRange(type),
})

const adjustSpinners = () => {
  adjustCurrentSpinner('hours')
  adjustCurrentSpinner('minutes')
  adjustCurrentSpinner('seconds')
}

const getScrollbarElement = (el: HTMLElement) =>
  el.querySelector(`.${ns.namespace.value}-scrollbar__wrap`) as HTMLElement

const getCycleSize = (type: TimeUnit) => unref(timeList)[type].length

const positiveModulo = (value: number, total: number) => {
  return ((value % total) + total) % total
}

const getCircularScrollTop = (type: TimeUnit, value: number, cycle: number) => {
  return (cycle * getCycleSize(type) + value) * typeItemHeight(type)
}

const setActiveCycle = (type: TimeUnit, cycle: number) => {
  activeCycles[type] = Math.max(0, Math.min(circularSpinnerCycles - 1, cycle))
}

const clearSpinnerScrollFrame = () => {
  if (!spinnerScrollFrame) return
  window.cancelAnimationFrame(spinnerScrollFrame)
  spinnerScrollFrame = 0
}

const clearHandleScrollFrame = () => {
  if (!handleScrollFrame) return
  window.cancelAnimationFrame(handleScrollFrame)
  handleScrollFrame = 0
}

const clearSmoothWheelFrame = (type: TimeUnit) => {
  const state = smoothWheelStates[type]
  if (!state?.frame) return
  window.cancelAnimationFrame(state.frame)
  state.frame = 0
}

const clearSmoothWheelState = (type: TimeUnit) => {
  clearSmoothWheelFrame(type)
  delete smoothWheelStates[type]
}

const markProgrammaticScroll = (type: TimeUnit) => {
  programmaticScrollTypes[type] = true
  const scrollbar = unref(listRefsMap[type])
  const wrap = scrollbar?.$el ? getScrollbarElement(scrollbar.$el) : undefined
  if (wrap) wrap.dataset.fsusSilentScroll = 'true'

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      programmaticScrollTypes[type] = false
      if (wrap?.dataset.fsusSilentScroll === 'true') {
        delete wrap.dataset.fsusSilentScroll
      }
    })
  })
}

const writeSpinnerScroll = (
  type: TimeUnit,
  value: number,
  cycle = circularSpinnerMiddleCycle,
) => {
  if (props.arrowControl) return
  const scrollbar = unref(listRefsMap[type])
  if (scrollbar && scrollbar.$el) {
    clearSmoothWheelState(type)
    markProgrammaticScroll(type)
    getScrollbarElement(scrollbar.$el).scrollTop = Math.max(
      0,
      getCircularScrollTop(type, value, cycle),
    )
  }
}

const flushPendingSpinnerScrolls = () => {
  clearSpinnerScrollFrame()
  for (const type of spinnerItems.value) {
    const pending = pendingSpinnerScrolls[type]
    if (!pending) continue

    delete pendingSpinnerScrolls[type]
    writeSpinnerScroll(type, pending.value, pending.cycle)
  }
}

const scheduleSpinnerScroll = (
  type: TimeUnit,
  value: number,
  cycle = circularSpinnerMiddleCycle,
) => {
  setActiveCycle(type, cycle)
  pendingSpinnerScrolls[type] = { cycle, value }

  if (spinnerScrollFrame) return
  if (typeof window.requestAnimationFrame !== 'function') {
    flushPendingSpinnerScrolls()
    return
  }
  spinnerScrollFrame = window.requestAnimationFrame(flushPendingSpinnerScrolls)
}

const adjustSpinner = (
  type: TimeUnit,
  value: number,
  cycle = circularSpinnerMiddleCycle,
) => {
  if (props.arrowControl) return
  scheduleSpinnerScroll(type, value, cycle)
}

const scheduleAdjustCurrentSpinner = (type: TimeUnit) => {
  adjustSpinner(type, unref(timePartials)[type])
}

const typeItemHeight = (type: TimeUnit): number => {
  const cached = itemHeightCache[type]
  if (cached) return cached

  const scrollbar = unref(listRefsMap[type])
  const listItem = scrollbar?.$el.querySelector('li')
  if (listItem) {
    const height = Number.parseFloat(getStyle(listItem, 'height')) || 0
    if (height) itemHeightCache[type] = height
    return height
  }
  return 0
}

const onIncrement = () => {
  scrollDown(1)
}

const onDecrement = () => {
  scrollDown(-1)
}

const scrollDown = (step: number) => {
  if (!currentScrollbar.value) {
    emitSelectRange('hours')
  }

  const label = currentScrollbar.value!
  const now = unref(timePartials)[label]
  const total = currentScrollbar.value === 'hours' ? 24 : 60
  const next = findNextUnDisabled(label, now, step, total)

  modifyDateField(label, next)
  adjustSpinner(label, next)
  nextTick(() => emitSelectRange(label))
}

const findNextUnDisabled = (
  type: TimeUnit,
  now: number,
  step: number,
  total: number,
) => {
  let next = (now + step + total) % total
  const list = unref(timeList)[type]
  while (list[next] && next !== now) {
    next = (next + step + total) % total
  }
  return next
}

const buildDisplayDate = () => {
  const { hours, minutes, seconds } = displayPartials
  return props.spinnerDate.hour(hours).minute(minutes).second(seconds)
}

const emitDisplayChange = () => {
  isFlushingDisplayChange = true
  emit('change', buildDisplayDate())
  nextTick(() => {
    isFlushingDisplayChange = false
  })
}

const flushDisplayChange = () => {
  if (!hasPendingDisplayChange) return
  hasPendingDisplayChange = false
  emitDisplayChange()
}

const modifyDateField = (
  type: TimeUnit,
  value: number,
  { immediate = true } = {},
) => {
  const list = unref(timeList)[type]
  const isDisabled = list[value]
  if (isDisabled) return

  displayPartials[type] = value

  if (immediate) {
    hasPendingDisplayChange = false
    emitDisplayChange()
  } else {
    hasPendingDisplayChange = true
  }
}

const handleClick = (
  type: TimeUnit,
  {
    value,
    disabled,
    cycle = circularSpinnerMiddleCycle,
  }: { value: number; disabled: boolean; cycle?: number },
) => {
  if (!disabled) {
    modifyDateField(type, value)
    emitSelectRange(type)
    adjustSpinner(type, value, cycle)
  }
}

const flushPendingScrollTypes = () => {
  clearHandleScrollFrame()
  for (const type of spinnerItems.value) {
    if (!pendingScrollTypes[type]) continue
    pendingScrollTypes[type] = false
    handleScrollFrame = 0
    commitScroll(type)
  }
}

const scheduleHandleScroll = (type: TimeUnit) => {
  if (programmaticScrollTypes[type]) return

  isScrolling = true
  scrollingTypes[type] = true
  pendingScrollTypes[type] = true
  scheduleResetScroll(type)

  if (handleScrollFrame) return
  if (typeof window.requestAnimationFrame !== 'function') {
    flushPendingScrollTypes()
    return
  }
  handleScrollFrame = window.requestAnimationFrame(flushPendingScrollTypes)
}

const commitScroll = (type: TimeUnit) => {
  const itemHeight = typeItemHeight(type)
  if (!itemHeight) return

  const scrollbarElement = getScrollbarElement(unref(listRefsMap[type])!.$el)
  const cycleSize = getCycleSize(type)
  const rawIndex = Math.round(scrollbarElement.scrollTop / itemHeight)
  const value = positiveModulo(rawIndex, cycleSize)
  const cycle = Math.floor(rawIndex / cycleSize)
  const previousValue = unref(timePartials)[type]
  setActiveCycle(type, cycle)
  if (value !== previousValue) {
    modifyDateField(type, value, { immediate: false })
  }
}

const getMaxSpinnerScrollTop = (type: TimeUnit) => {
  const scrollbar = unref(listRefsMap[type])
  if (!scrollbar?.$el) return 0

  const wrap = getScrollbarElement(scrollbar.$el)
  return Math.max(0, wrap.scrollHeight - wrap.clientHeight)
}

const clampSpinnerScrollTop = (type: TimeUnit, value: number) =>
  Math.min(getMaxSpinnerScrollTop(type), Math.max(0, value))

const normalizeWheelDelta = (
  type: TimeUnit,
  event: WheelEvent,
  wrap: HTMLElement,
) =>
  normalizeFsusWheelDelta(event.deltaY, {
    deltaMode: event.deltaMode,
    maxDiscreteDeltaPx: Math.max(24, Math.min(typeItemHeight(type), 40)),
    viewportSizePx: wrap.clientHeight,
  })

const flushSmoothWheel = (type: TimeUnit) => {
  const state = smoothWheelStates[type]
  const scrollbar = unref(listRefsMap[type])
  if (!state || !scrollbar?.$el) return

  state.frame = 0
  const wrap = getScrollbarElement(scrollbar.$el)
  const distance = state.target - state.current
  const next =
    Math.abs(distance) <= 0.75 ? state.target : state.current + distance * 0.34

  state.current = next
  wrap.scrollTop = next

  if (Math.abs(state.target - state.current) > 0.75) {
    state.frame = window.requestAnimationFrame(() => flushSmoothWheel(type))
  }
}

const scheduleSmoothWheel = (type: TimeUnit) => {
  const state = smoothWheelStates[type]
  if (!state || state.frame) return
  state.frame = window.requestAnimationFrame(() => flushSmoothWheel(type))
}

const handleWheel = (type: TimeUnit, event: WheelEvent) => {
  if (!motionRuntime.value.enabled || event.ctrlKey) return

  const scrollbar = unref(listRefsMap[type])
  if (!scrollbar?.$el) return

  const wrap = getScrollbarElement(scrollbar.$el)
  const delta = normalizeWheelDelta(type, event, wrap)
  if (!delta) return

  event.preventDefault()
  const state =
    smoothWheelStates[type] ||
    (smoothWheelStates[type] = {
      current: wrap.scrollTop,
      target: wrap.scrollTop,
      frame: 0,
    })

  if (!state.frame) {
    state.current = wrap.scrollTop
    state.target = wrap.scrollTop
  }
  state.target = clampSpinnerScrollTop(type, state.target + delta)
  scheduleSmoothWheel(type)
}

const bindScrollEvent = () => {
  const bindFunction = (type: TimeUnit) => {
    const scrollbar = unref(listRefsMap[type])
    if (scrollbar && scrollbar.$el) {
      const wrap = getScrollbarElement(scrollbar.$el)
      wrap.onscroll = () => scheduleHandleScroll(type)
      wrap.dataset.fsusCustomWheel = 'true'
      wheelHandlers[type] = (event) => handleWheel(type, event)
      wrap.addEventListener('wheel', wheelHandlers[type]!, { passive: false })
    }
  }
  bindFunction('hours')
  bindFunction('minutes')
  bindFunction('seconds')
}

const unbindScrollEvent = () => {
  for (const type of timeUnits) {
    const scrollbar = unref(listRefsMap[type])
    const handler = wheelHandlers[type]
    if (scrollbar?.$el) {
      const wrap = getScrollbarElement(scrollbar.$el)
      wrap.onscroll = null
      delete wrap.dataset.fsusCustomWheel
      if (handler) wrap.removeEventListener('wheel', handler)
    }
    clearSmoothWheelState(type)
    delete wheelHandlers[type]
  }
}

onMounted(() => {
  nextTick(() => {
    if (!props.arrowControl) {
      bindScrollEvent()
    }
    adjustSpinners()
    // set selection on the first hour part
    if (props.role === 'start') emitSelectRange('hours')
  })
})

onBeforeUnmount(() => {
  for (const timer of Object.values(resetScrollTimers)) {
    window.clearTimeout(timer)
  }
  unbindScrollEvent()
  clearSpinnerScrollFrame()
  clearHandleScrollFrame()
})

const setRef = (scrollbar: ScrollbarInstance, type: TimeUnit) => {
  listRefsMap[type].value = scrollbar
}

emit('set-option', [`${props.role}_scrollDown`, scrollDown])
emit('set-option', [`${props.role}_emitSelectRange`, emitSelectRange])

watch(
  () => props.spinnerDate,
  () => {
    if (isScrolling || isFlushingDisplayChange) return
    adjustSpinners()
  },
)
</script>
