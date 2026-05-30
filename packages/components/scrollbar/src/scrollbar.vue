<template>
  <div ref="scrollbarRef" :class="scrollbarKls">
    <div
      ref="wrapRef"
      :class="wrapKls"
      :style="wrapStyle"
      @scroll="handleScroll"
      @wheel="handleWheel"
    >
      <component
        :is="tag"
        :id="id"
        ref="resizeRef"
        :class="resizeKls"
        :style="viewStyle"
        :role="role"
        :aria-label="ariaLabel"
        :aria-orientation="ariaOrientation"
      >
        <slot />
      </component>
    </div>
    <bar
      v-if="!native"
      ref="barRef"
      :height="sizeHeight"
      :width="sizeWidth"
      :always="always"
      :ratio-x="ratioX"
      :ratio-y="ratioY"
    />
  </div>
</template>
<script lang="ts" setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  provide,
  reactive,
  ref,
  watch,
} from 'vue'
import { useEventListener, useResizeObserver } from '@element-plus/hooks/use-runtime'
import { addUnit, debugWarn, isNumber, isObject } from '@element-plus/utils'
import {
  applyFsusInteractiveMotionVars,
  normalizeFsusWheelDelta,
  resolveFsusInteractiveMotion,
  useFsusMotionRuntime,
  useNamespace,
} from '@element-plus/hooks'
import { GAP } from './util'
import Bar from './bar.vue'
import { scrollbarContextKey } from './constants'
import { scrollbarEmits, scrollbarProps } from './scrollbar'
import type { BarInstance } from './bar'
import type { CSSProperties, StyleValue } from 'vue'

const COMPONENT_NAME = 'ElScrollbar'
const SCROLL_MOTION_IDLE_MS = 320
const WHEEL_SCROLL_EASE = 0.32
const WHEEL_SCROLL_EPSILON = 0.5

defineOptions({
  name: COMPONENT_NAME,
})

const props = defineProps(scrollbarProps)
const emit = defineEmits(scrollbarEmits)

const ns = useNamespace('scrollbar')
const motionRuntime = useFsusMotionRuntime()

let stopResizeObserver: (() => void) | undefined = undefined
let stopResizeListener: (() => void) | undefined = undefined

const scrollbarRef = ref<HTMLDivElement>()
const wrapRef = ref<HTMLDivElement>()
const resizeRef = ref<HTMLElement>()

const sizeWidth = ref('0')
const sizeHeight = ref('0')
const barRef = ref<BarInstance>()
const ratioY = ref(1)
const ratioX = ref(1)
const isScrolling = ref(false)
const isThumbDragging = ref(false)
const isScrollMotionX = ref(false)
const isScrollMotionY = ref(false)
const xAxisScrollDir = ref<'forward' | 'backward'>('forward')
const yAxisScrollDir = ref<'forward' | 'backward'>('forward')

const isHeavyDomMotionTarget = () =>
  scrollbarRef.value?.dataset.fsusMotionHeavyDom === 'true' ||
  scrollbarRef.value?.classList.contains('is-heavy-dom-motion') === true
let scrollMotionTimer: ReturnType<typeof setTimeout> | undefined
let scrollMotionFrame = 0
let lastScrollTop = 0
let lastScrollLeft = 0
let lastScrollAt = 0
let thumbDragFrame = 0
let pendingThumbScrollTop: number | undefined
let pendingThumbScrollLeft: number | undefined
let wheelScrollFrame = 0
let wheelTargetTop: number | undefined
let wheelTargetLeft: number | undefined
let wheelCurrentTop = 0
let wheelCurrentLeft = 0

const scrollbarKls = computed(() => [
  ns.b(),
  ns.is('scrolling', isScrolling.value),
  ns.is('thumb-dragging', isThumbDragging.value),
  ns.is('scrolling-x', isScrollMotionX.value),
  ns.is('scrolling-y', isScrollMotionY.value),
  isScrollMotionX.value ? ns.is(`scrolling-x-${xAxisScrollDir.value}`) : '',
  isScrollMotionY.value ? ns.is(`scrolling-y-${yAxisScrollDir.value}`) : '',
])

const scrollMotionClassNames = () => [
  ns.is('scrolling'),
  ns.is('scrolling-x'),
  ns.is('scrolling-y'),
  ns.is('scrolling-x-forward'),
  ns.is('scrolling-x-backward'),
  ns.is('scrolling-y-forward'),
  ns.is('scrolling-y-backward'),
]

const thumbDragClassName = () => ns.is('thumb-dragging')

const syncScrollMotionClasses = (active: boolean) => {
  const scrollbar = scrollbarRef.value
  if (!scrollbar) return

  scrollbar.classList.remove(...scrollMotionClassNames())
  if (!isThumbDragging.value) {
    scrollbar.classList.remove(thumbDragClassName())
  }
  if (!active) return

  scrollbar.classList.add(ns.is('scrolling'))
  if (isThumbDragging.value) {
    scrollbar.classList.add(thumbDragClassName())
  }
  if (isScrollMotionX.value) {
    scrollbar.classList.add(
      ns.is('scrolling-x'),
      ns.is(`scrolling-x-${xAxisScrollDir.value}`),
    )
  }
  if (isScrollMotionY.value) {
    scrollbar.classList.add(
      ns.is('scrolling-y'),
      ns.is(`scrolling-y-${yAxisScrollDir.value}`),
    )
  }
}

const clearScrollMotionSchedule = () => {
  if (scrollMotionTimer) {
    clearTimeout(scrollMotionTimer)
    scrollMotionTimer = undefined
  }
  if (scrollMotionFrame) {
    cancelAnimationFrame(scrollMotionFrame)
    scrollMotionFrame = 0
  }
}

const clearScrollMotionState = () => {
  isScrolling.value = false
  isScrollMotionX.value = false
  isScrollMotionY.value = false
  syncScrollMotionClasses(false)
}

const scheduleScrollMotionEnd = () => {
  clearScrollMotionSchedule()
  if (isThumbDragging.value) return

  const armTimer = () => {
    scrollMotionFrame = 0
    scrollMotionTimer = setTimeout(
      clearScrollMotionState,
      motionRuntime.value.scrollIdleMs || SCROLL_MOTION_IDLE_MS,
    )
  }

  if (typeof requestAnimationFrame !== 'function') {
    armTimer()
    return
  }

  scrollMotionFrame = requestAnimationFrame(() => {
    scrollMotionFrame = requestAnimationFrame(armTimer)
  })
}

const wrapStyle = computed<StyleValue>(() => {
  const style: CSSProperties = {}
  if (props.height) style.height = addUnit(props.height)
  if (props.maxHeight) style.maxHeight = addUnit(props.maxHeight)
  return [props.wrapStyle, style]
})

const wrapKls = computed(() => {
  return [
    props.wrapClass,
    ns.e('wrap'),
    { [ns.em('wrap', 'hidden-default')]: !props.native },
  ]
})

const resizeKls = computed(() => {
  return [ns.e('view'), props.viewClass]
})

const handleScroll = () => {
  if (wrapRef.value) {
    const { scrollTop, scrollLeft } = wrapRef.value
    const deltaX = scrollLeft - lastScrollLeft
    const deltaY = scrollTop - lastScrollTop
    const nextScrollMotionX = scrollLeft !== lastScrollLeft
    const nextScrollMotionY = scrollTop !== lastScrollTop
    const isSilentScroll = wrapRef.value.dataset.fsusSilentScroll === 'true'

    if (!isSilentScroll && nextScrollMotionX) {
      xAxisScrollDir.value =
        scrollLeft > lastScrollLeft ? 'forward' : 'backward'
    }
    if (!isSilentScroll && nextScrollMotionY) {
      yAxisScrollDir.value = scrollTop > lastScrollTop ? 'forward' : 'backward'
    }
    if (!isSilentScroll && (nextScrollMotionX || nextScrollMotionY)) {
      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      applyFsusInteractiveMotionVars(
        scrollbarRef.value,
        resolveFsusInteractiveMotion({
          deltaX,
          deltaY,
          elapsedMs: lastScrollAt ? now - lastScrollAt : 16,
          heavyDom: isHeavyDomMotionTarget(),
          runtime: motionRuntime.value,
        }),
      )
      lastScrollAt = now
    }
    if (!isSilentScroll) {
      triggerScrollMotion(nextScrollMotionX, nextScrollMotionY)
    }

    lastScrollTop = scrollTop
    lastScrollLeft = scrollLeft

    barRef.value?.handleScroll(wrapRef.value)

    emit('scroll', {
      scrollTop,
      scrollLeft,
    })
  }
}

const clampScrollOffset = (value: number, max: number) =>
  Math.min(max, Math.max(0, value))

const clearWheelScrollFrame = () => {
  if (!wheelScrollFrame) return
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(wheelScrollFrame)
  }
  wheelScrollFrame = 0
}

const clearWheelScrollState = () => {
  clearWheelScrollFrame()
  wheelTargetTop = undefined
  wheelTargetLeft = undefined
}

const resolveWheelStep = (current: number, target: number) => {
  const distance = target - current
  if (Math.abs(distance) <= WHEEL_SCROLL_EPSILON) return target
  return current + distance * WHEEL_SCROLL_EASE
}

const flushWheelScroll = () => {
  clearWheelScrollFrame()

  const wrap = wrapRef.value
  if (!wrap) {
    clearWheelScrollState()
    return
  }

  const maxTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight)
  const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth)
  let didScroll = false

  if (isNumber(wheelTargetTop)) {
    const targetTop = clampScrollOffset(wheelTargetTop, maxTop)
    wheelTargetTop = targetTop
    const baseTop =
      Math.abs(wrap.scrollTop - wheelCurrentTop) > 2
        ? wrap.scrollTop
        : wheelCurrentTop
    const nextTop = resolveWheelStep(baseTop, targetTop)
    wheelCurrentTop = nextTop
    wrap.scrollTop = nextTop
    didScroll = true
    if (nextTop === targetTop) {
      wheelTargetTop = undefined
    }
  }

  if (isNumber(wheelTargetLeft)) {
    const targetLeft = clampScrollOffset(wheelTargetLeft, maxLeft)
    wheelTargetLeft = targetLeft
    const baseLeft =
      Math.abs(wrap.scrollLeft - wheelCurrentLeft) > 2
        ? wrap.scrollLeft
        : wheelCurrentLeft
    const nextLeft = resolveWheelStep(baseLeft, targetLeft)
    wheelCurrentLeft = nextLeft
    wrap.scrollLeft = nextLeft
    didScroll = true
    if (nextLeft === targetLeft) {
      wheelTargetLeft = undefined
    }
  }

  if (didScroll) {
    handleScroll()
  }

  if (isNumber(wheelTargetTop) || isNumber(wheelTargetLeft)) {
    scheduleWheelScroll()
  }
}

const scheduleWheelScroll = () => {
  if (wheelScrollFrame) return
  if (typeof requestAnimationFrame !== 'function') {
    flushWheelScroll()
    return
  }
  wheelScrollFrame = requestAnimationFrame(flushWheelScroll)
}

const handleWheel = (event: WheelEvent) => {
  if (props.native || event.ctrlKey) return

  const wrap = wrapRef.value
  if (!wrap) return
  if (wrap.dataset.fsusCustomWheel === 'true') return

  if (
    event.deltaMode === 0 &&
    Math.abs(event.deltaX) < 72 &&
    Math.abs(event.deltaY) < 72
  ) {
    return
  }

  let deltaX = normalizeFsusWheelDelta(event.deltaX, {
    deltaMode: event.deltaMode,
    maxDiscreteDeltaPx: 56,
    viewportSizePx: wrap.clientWidth,
  })
  let deltaY = normalizeFsusWheelDelta(event.deltaY, {
    deltaMode: event.deltaMode,
    maxDiscreteDeltaPx: 56,
    viewportSizePx: wrap.clientHeight,
  })

  if (event.shiftKey && deltaY && !deltaX) {
    deltaX = deltaY
    deltaY = 0
  }
  if (!deltaX && !deltaY) return

  const maxTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight)
  const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth)
  if (!isNumber(wheelTargetTop)) {
    wheelTargetTop = wrap.scrollTop
    wheelCurrentTop = wrap.scrollTop
  }
  if (!isNumber(wheelTargetLeft)) {
    wheelTargetLeft = wrap.scrollLeft
    wheelCurrentLeft = wrap.scrollLeft
  }

  const nextTop = clampScrollOffset(wheelTargetTop + deltaY, maxTop)
  const nextLeft = clampScrollOffset(wheelTargetLeft + deltaX, maxLeft)
  const canScroll = nextTop !== wheelTargetTop || nextLeft !== wheelTargetLeft

  if (!canScroll) return

  event.preventDefault()
  wheelTargetTop = nextTop
  wheelTargetLeft = nextLeft
  scheduleWheelScroll()
}

const applyScrollMotionDelta = (deltaX: number, deltaY: number) => {
  const nextScrollMotionX = deltaX !== 0
  const nextScrollMotionY = deltaY !== 0

  if (nextScrollMotionX) {
    xAxisScrollDir.value = deltaX > 0 ? 'forward' : 'backward'
  }
  if (nextScrollMotionY) {
    yAxisScrollDir.value = deltaY > 0 ? 'forward' : 'backward'
  }
  if (nextScrollMotionX || nextScrollMotionY) {
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    applyFsusInteractiveMotionVars(
      scrollbarRef.value,
      resolveFsusInteractiveMotion({
        deltaX,
        deltaY,
        elapsedMs: lastScrollAt ? now - lastScrollAt : 16,
        heavyDom: isHeavyDomMotionTarget(),
        runtime: motionRuntime.value,
      }),
    )
    lastScrollAt = now
  }
  triggerScrollMotion(nextScrollMotionX, nextScrollMotionY)
}

const triggerScrollMotion = (x: boolean, y: boolean) => {
  if (!x && !y) return
  if (!motionRuntime.value.enabled) return

  isScrolling.value = true
  if (x) isScrollMotionX.value = true
  if (y) isScrollMotionY.value = true
  syncScrollMotionClasses(true)
  scheduleScrollMotionEnd()
}

const clearThumbDragFrame = () => {
  if (!thumbDragFrame) return
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(thumbDragFrame)
  }
  thumbDragFrame = 0
}

const clearPendingThumbScroll = () => {
  pendingThumbScrollTop = undefined
  pendingThumbScrollLeft = undefined
}

const getThumbDragMetrics = (axis: 'X' | 'Y') => {
  const wrap = wrapRef.value
  if (!wrap) return null

  const isVertical = axis === 'Y'
  const trackSize = Math.max(
    1,
    (isVertical ? wrap.offsetHeight : wrap.offsetWidth) - GAP,
  )
  const thumbSize = Number.parseFloat(
    isVertical ? sizeHeight.value : sizeWidth.value,
  )
  const resolvedThumbSize = Number.isFinite(thumbSize) ? thumbSize : trackSize
  const maxScroll = Math.max(
    0,
    isVertical
      ? wrap.scrollHeight - wrap.offsetHeight
      : wrap.scrollWidth - wrap.offsetWidth,
  )
  const trackTravel = Math.max(1, trackSize - resolvedThumbSize)

  return {
    maxScroll,
    clientSize: isVertical ? wrap.offsetHeight : wrap.offsetWidth,
    density: maxScroll / trackTravel,
  }
}

const clampThumbDragTarget = (axis: 'X' | 'Y', target: number) => {
  const metrics = getThumbDragMetrics(axis)
  if (!metrics) return target

  return Math.min(metrics.maxScroll, Math.max(0, target))
}

const resolveThumbDragScroll = (axis: 'X' | 'Y', target: number) => {
  return clampThumbDragTarget(axis, target)
}

const flushThumbDragScroll = () => {
  clearThumbDragFrame()
  const wrap = wrapRef.value
  if (!wrap) {
    clearPendingThumbScroll()
    return
  }

  const nextTop = pendingThumbScrollTop
  const nextLeft = pendingThumbScrollLeft

  const previousTop = wrap.scrollTop
  const previousLeft = wrap.scrollLeft

  if (isNumber(nextTop)) {
    const resolvedTop = resolveThumbDragScroll('Y', nextTop)
    wrap.scrollTop = resolvedTop
    pendingThumbScrollTop =
      Math.abs(resolvedTop - clampThumbDragTarget('Y', nextTop)) <= 1
        ? undefined
        : nextTop
  }
  if (isNumber(nextLeft)) {
    const resolvedLeft = resolveThumbDragScroll('X', nextLeft)
    wrap.scrollLeft = resolvedLeft
    pendingThumbScrollLeft =
      Math.abs(resolvedLeft - clampThumbDragTarget('X', nextLeft)) <= 1
        ? undefined
        : nextLeft
  }

  const deltaY = wrap.scrollTop - previousTop
  const deltaX = wrap.scrollLeft - previousLeft

  if (deltaX || deltaY) {
    applyScrollMotionDelta(deltaX, deltaY)
    lastScrollTop = wrap.scrollTop
    lastScrollLeft = wrap.scrollLeft
    barRef.value?.handleScroll(wrap)
  }
  if (
    isThumbDragging.value &&
    (isNumber(pendingThumbScrollTop) || isNumber(pendingThumbScrollLeft))
  ) {
    scheduleThumbDragScroll()
  }
}

const scheduleThumbDragScroll = () => {
  if (thumbDragFrame) return
  if (typeof requestAnimationFrame !== 'function') {
    flushThumbDragScroll()
    return
  }
  thumbDragFrame = requestAnimationFrame(flushThumbDragScroll)
}

const startThumbDrag = () => {
  isThumbDragging.value = true
  isScrolling.value = true
  clearScrollMotionSchedule()
  applyFsusInteractiveMotionVars(
    scrollbarRef.value,
    resolveFsusInteractiveMotion({
      deltaX: 0,
      deltaY: 120,
      elapsedMs: 16,
      heavyDom: isHeavyDomMotionTarget(),
      runtime: motionRuntime.value,
    }),
  )
  syncScrollMotionClasses(true)
}

const moveThumbDrag = (axis: 'X' | 'Y', scrollOffset: number) => {
  if (!isNumber(scrollOffset)) return
  if (axis === 'Y') {
    pendingThumbScrollTop = scrollOffset
  } else {
    pendingThumbScrollLeft = scrollOffset
  }
  scheduleThumbDragScroll()
}

const endThumbDrag = () => {
  flushThumbDragScroll()
  clearPendingThumbScroll()
  isThumbDragging.value = false
  scrollbarRef.value?.classList.remove(thumbDragClassName())
  scheduleScrollMotionEnd()
}

const scrollTo: {
  (xCord: number, yCord?: number): void
  (options: ScrollToOptions): void
} = (arg1: number | ScrollToOptions, arg2?: number) => {
  clearWheelScrollState()
  if (isObject(arg1)) {
    wrapRef.value!.scrollTo(arg1)
  } else if (isNumber(arg1) && isNumber(arg2)) {
    wrapRef.value!.scrollTo(arg1, arg2)
  }
}

const setScrollTop = (value: number) => {
  if (!isNumber(value)) {
    debugWarn(COMPONENT_NAME, 'value must be a number')
    return
  }
  clearWheelScrollState()
  wrapRef.value!.scrollTop = value
}

const setScrollLeft = (value: number) => {
  if (!isNumber(value)) {
    debugWarn(COMPONENT_NAME, 'value must be a number')
    return
  }
  clearWheelScrollState()
  wrapRef.value!.scrollLeft = value
}

const update = () => {
  if (!wrapRef.value) return
  const offsetHeight = wrapRef.value.offsetHeight - GAP
  const offsetWidth = wrapRef.value.offsetWidth - GAP

  const originalHeight = offsetHeight ** 2 / wrapRef.value.scrollHeight
  const originalWidth = offsetWidth ** 2 / wrapRef.value.scrollWidth
  const height = Math.max(originalHeight, props.minSize)
  const width = Math.max(originalWidth, props.minSize)

  ratioY.value =
    originalHeight /
    (offsetHeight - originalHeight) /
    (height / (offsetHeight - height))
  ratioX.value =
    originalWidth /
    (offsetWidth - originalWidth) /
    (width / (offsetWidth - width))

  sizeHeight.value = height + GAP < offsetHeight ? `${height}px` : ''
  sizeWidth.value = width + GAP < offsetWidth ? `${width}px` : ''
}

watch(
  () => props.noresize,
  (noresize) => {
    if (noresize) {
      stopResizeObserver?.()
      stopResizeListener?.()
    } else {
      ;({ stop: stopResizeObserver } = useResizeObserver(resizeRef, update))
      stopResizeListener = useEventListener('resize', update)
    }
  },
  { immediate: true },
)

watch(
  () => [props.maxHeight, props.height],
  () => {
    if (!props.native)
      nextTick(() => {
        update()
        if (wrapRef.value) {
          barRef.value?.handleScroll(wrapRef.value)
        }
      })
  },
)

provide(
  scrollbarContextKey,
  reactive({
    scrollbarElement: scrollbarRef,
    wrapElement: wrapRef,
    startThumbDrag,
    moveThumbDrag,
    endThumbDrag,
  }),
)

onMounted(() => {
  if (!props.native)
    nextTick(() => {
      update()
      if (wrapRef.value) {
        lastScrollTop = wrapRef.value.scrollTop
        lastScrollLeft = wrapRef.value.scrollLeft
      }
    })
})
onUpdated(() => update())

onBeforeUnmount(() => {
  clearThumbDragFrame()
  clearPendingThumbScroll()
  clearWheelScrollState()
  clearScrollMotionSchedule()
})

defineExpose({
  /** @description scrollbar wrap ref */
  wrapRef,
  /** @description update scrollbar state manually */
  update,
  /** @description scrolls to a particular set of coordinates */
  scrollTo,
  /** @description set distance to scroll top */
  setScrollTop,
  /** @description set distance to scroll left */
  setScrollLeft,
  /** @description handle scroll event */
  handleScroll,
})
</script>
