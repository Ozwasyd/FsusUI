import { computed, inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { debounce } from 'lodash-unified'
import { EVENT_CODE, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import {
  applyFsusInteractiveMotionVars,
  fsusDecayOverflow,
  resetFsusInteractiveMotionVars,
  resolveFsusInteractiveMotion,
  useFsusDrag,
  useFsusMotionRuntime,
  useFsusSpring,
} from '@element-plus/hooks'
import { sliderContextKey } from '../constants'

import type { CSSProperties, ComputedRef, Ref, SetupContext } from 'vue'
import type { SliderProps } from '../slider'
import type {
  SliderButtonEmits,
  SliderButtonInitData,
  SliderButtonProps,
} from '../button'

const { left, down, right, up, home, end, pageUp, pageDown } = EVENT_CODE
const pointerMouseBlockMs = 450
const sliderElasticOverflowPercent = 7

const useTooltip = (
  displayValue: Ref<number>,
  formatTooltip: Ref<SliderProps['formatTooltip']>,
  showTooltip: Ref<SliderProps['showTooltip']>,
) => {
  // TODO any is temporary, replace with `TooltipInstance` later
  const tooltip = ref<any>()

  const tooltipVisible = ref(false)

  const enableFormat = computed(() => {
    return formatTooltip.value instanceof Function
  })

  const formatValue = computed(() => {
    return (
      (enableFormat.value && formatTooltip.value!(displayValue.value)) ||
      displayValue.value
    )
  })

  const displayTooltip = debounce(() => {
    showTooltip.value && (tooltipVisible.value = true)
  }, 50)

  const hideTooltip = debounce(() => {
    showTooltip.value && (tooltipVisible.value = false)
  }, 50)

  return {
    tooltip,
    tooltipVisible,
    formatValue,
    displayTooltip,
    hideTooltip,
  }
}

export const useSliderButton = (
  props: SliderButtonProps,
  initData: SliderButtonInitData,
  emit: SetupContext<SliderButtonEmits>['emit'],
) => {
  const {
    disabled,
    min,
    max,
    step,
    showTooltip,
    precision,
    sliderSize,
    formatTooltip,
    emitChange,
    resetSize,
    updateDragging,
  } = inject(sliderContextKey)!

  const liveValue = ref(props.modelValue)
  const { tooltip, tooltipVisible, formatValue, displayTooltip, hideTooltip } =
    useTooltip(liveValue, formatTooltip!, showTooltip)

  const button = ref<HTMLDivElement>()
  const visualPosition = ref(0)
  const visualOverflow = ref(0)
  const motionRuntime = useFsusMotionRuntime()
  const visualSpring = useFsusSpring(visualPosition, {
    damping: 34,
    mass: 0.72,
    stiffness: 380,
  })
  const dragMotion = useFsusDrag()
  let dragFrame: number | undefined
  let pendingDragPosition: number | undefined
  let activePointerId: number | undefined
  let lastPointerDownTime = 0
  let tooltipFrame: number | undefined
  let tooltipUpdatePending = false
  let tooltipUpdateToken = 0

  const clampPosition = (position: number) => {
    if (!Number.isFinite(position)) return 0
    if (position < 0) return 0
    if (position > 100) return 100
    return position
  }

  const valueToPercent = (value: number) =>
    clampPosition(((value - min.value) / (max.value - min.value)) * 100)

  const positionToValue = (position: number) => {
    const newPosition = clampPosition(position)
    const lengthPerStep = 100 / ((max.value - min.value) / step.value)
    const steps = Math.round(newPosition / lengthPerStep)
    const value =
      steps * lengthPerStep * (max.value - min.value) * 0.01 + min.value
    return Number.parseFloat(value.toFixed(precision.value))
  }

  const resolveVisualOverflow = (position: number) => {
    if (!motionRuntime.value.enabled) return 0
    if (position < 0) {
      return fsusDecayOverflow(-position, sliderElasticOverflowPercent)
    }
    if (position > 100) {
      return fsusDecayOverflow(position - 100, sliderElasticOverflowPercent)
    }
    return 0
  }

  visualPosition.value = valueToPercent(props.modelValue)

  const currentPosition = computed(() => {
    return `${valueToPercent(props.modelValue)}%`
  })

  const resolveSliderMotionMetrics = (visualOverflow = 0) => {
    if (!initData.dragging) {
      return resolveFsusInteractiveMotion({
        kind: 'slider',
        runtime: motionRuntime.value,
      })
    }

    const delta = Math.max(initData.velocity * 96, visualOverflow * 16, 16)

    return resolveFsusInteractiveMotion({
      axis: props.vertical ? 'y' : 'x',
      deltaX: props.vertical ? 0 : delta,
      deltaY: props.vertical ? delta : 0,
      elapsedMs: 16,
      kind: 'slider',
      runtime: motionRuntime.value,
    })
  }

  const getSliderRoot = () =>
    button.value?.closest<HTMLElement>('.el-slider') ?? undefined

  const syncSliderMotionVars = (visualOverflow = 0) => {
    const metrics = resolveSliderMotionMetrics(visualOverflow)
    applyFsusInteractiveMotionVars(getSliderRoot(), metrics)
    return metrics
  }

  const wrapperStyle: ComputedRef<CSSProperties> = computed(() => {
    const position = initData.dragging
      ? clampPosition(visualPosition.value)
      : motionRuntime.value.enabled
        ? clampPosition(visualSpring.value.value)
        : clampPosition(visualPosition.value)
    const offset = (position / 100) * sliderSize.value
    const motionMetrics = resolveSliderMotionMetrics(visualOverflow.value)
    const dynamicStyle = {
      '--fsus-interactive-motion-blur': `${motionMetrics.blurPx.toFixed(2)}px`,
      '--fsus-interactive-motion-glow': `${motionMetrics.glowSizePx.toFixed(
        2,
      )}px`,
      '--fsus-interactive-motion-scale': motionMetrics.scale.toFixed(3),
      '--fsus-interactive-motion-strength': motionMetrics.strength.toFixed(3),
      '--fsus-interactive-motion-trail-opacity':
        motionMetrics.trailOpacity.toFixed(3),
      '--el-slider-drag-overflow': `${visualOverflow.value.toFixed(2)}%`,
    } as CSSProperties

    return {
      ...dynamicStyle,
      ...(props.vertical
        ? { bottom: currentPosition.value }
        : { left: currentPosition.value }),
      ...(props.vertical
        ? {
            bottom: '0px',
            transform: `translate3d(0, ${-offset}px, 0) translateY(50%)`,
          }
        : {
            left: '0px',
            transform: `translate3d(${offset}px, 0, 0) translateX(-50%)`,
          }),
    }
  })

  const handleMouseEnter = () => {
    initData.hovering = true
    displayTooltip()
  }

  const handleMouseLeave = () => {
    initData.hovering = false
    if (!initData.dragging) {
      hideTooltip()
    }
  }

  const onButtonDown = (event: MouseEvent | TouchEvent | PointerEvent) => {
    if (
      event.type === 'mousedown' &&
      Date.now() - lastPointerDownTime < pointerMouseBlockMs
    ) {
      return
    }
    if (disabled.value) return
    event.preventDefault()
    onDragStart(event)
    if (event.type === 'pointerdown') {
      lastPointerDownTime = Date.now()
      activePointerId = (event as PointerEvent).pointerId
      try {
        button.value?.setPointerCapture?.(activePointerId)
      } catch {
        // Synthetic tests and a few embedded webviews can expose pointer events
        // without an active capture target; window listeners still carry drag.
      }
      window.addEventListener('pointermove', onDragging)
      window.addEventListener('pointerup', onDragEnd)
      window.addEventListener('pointercancel', onDragEnd)
    } else {
      window.addEventListener('mousemove', onDragging)
      window.addEventListener('touchmove', onDragging, { passive: false })
      window.addEventListener('mouseup', onDragEnd)
      window.addEventListener('touchend', onDragEnd)
    }
    window.addEventListener('contextmenu', onDragEnd)
    button.value!.focus()
  }

  const incrementPosition = (amount: number) => {
    if (disabled.value) return
    initData.newPosition =
      Number.parseFloat(currentPosition.value) +
      (amount / (max.value - min.value)) * 100
    setPosition(initData.newPosition)
    emitChange()
  }

  const onLeftKeyDown = () => {
    incrementPosition(-step.value)
  }

  const onRightKeyDown = () => {
    incrementPosition(step.value)
  }

  const onPageDownKeyDown = () => {
    incrementPosition(-step.value * 4)
  }

  const onPageUpKeyDown = () => {
    incrementPosition(step.value * 4)
  }

  const onHomeKeyDown = () => {
    if (disabled.value) return
    setPosition(0)
    emitChange()
  }

  const onEndKeyDown = () => {
    if (disabled.value) return
    setPosition(100)
    emitChange()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    let isPreventDefault = true
    if ([left, down].includes(event.key)) {
      onLeftKeyDown()
    } else if ([right, up].includes(event.key)) {
      onRightKeyDown()
    } else if (event.key === home) {
      onHomeKeyDown()
    } else if (event.key === end) {
      onEndKeyDown()
    } else if (event.key === pageDown) {
      onPageDownKeyDown()
    } else if (event.key === pageUp) {
      onPageUpKeyDown()
    } else {
      isPreventDefault = false
    }
    isPreventDefault && event.preventDefault()
  }

  const getClientXY = (event: MouseEvent | TouchEvent | PointerEvent) => {
    let clientX: number
    let clientY: number
    if (event.type.startsWith('touch')) {
      clientY = (event as TouchEvent).touches[0].clientY
      clientX = (event as TouchEvent).touches[0].clientX
    } else {
      clientY = (event as MouseEvent).clientY
      clientX = (event as MouseEvent).clientX
    }
    return {
      clientX,
      clientY,
    }
  }

  const applyVisualPosition = (position: number) => {
    const clampedPosition = clampPosition(position)
    visualPosition.value = clampedPosition
    visualOverflow.value = initData.dragging
      ? resolveVisualOverflow(position)
      : 0
    liveValue.value = positionToValue(clampedPosition)
    emit('dragPosition', clampedPosition)
  }

  const onDragStart = (event: MouseEvent | TouchEvent | PointerEvent) => {
    flushDragFrame()
    resetSize()
    initData.dragging = true
    updateDragging(true)
    initData.isClick = true
    const { clientX, clientY } = getClientXY(event)
    const now = performance.now()
    if (props.vertical) {
      initData.startY = clientY
    } else {
      initData.startX = clientX
    }
    dragMotion.start({ x: clientX, y: clientY }, now)
    initData.velocity = 0
    initData.startPosition = Number.parseFloat(currentPosition.value)
    initData.newPosition = initData.startPosition
    applyVisualPosition(initData.startPosition)
    visualSpring.jump(clampPosition(initData.startPosition))
    syncSliderMotionVars()
  }

  const cancelDragFrame = () => {
    if (dragFrame === undefined) return
    window.cancelAnimationFrame(dragFrame)
    dragFrame = undefined
  }

  const flushDragFrame = () => {
    cancelDragFrame()
    if (pendingDragPosition === undefined) return
    const position = pendingDragPosition
    pendingDragPosition = undefined
    applyVisualPosition(position)
    setPosition(position)
  }

  const scheduleDragPosition = (position: number) => {
    pendingDragPosition = position

    if (typeof window.requestAnimationFrame !== 'function') {
      flushDragFrame()
      return
    }

    if (dragFrame !== undefined) return

    dragFrame = window.requestAnimationFrame(() => {
      dragFrame = undefined
      if (pendingDragPosition === undefined) return
      const nextPosition = pendingDragPosition
      pendingDragPosition = undefined
      applyVisualPosition(nextPosition)
      scheduleTooltipUpdate()
      setPosition(nextPosition)
    })
  }

  const scheduleTooltipUpdate = () => {
    if (!tooltip.value?.updatePopper) return
    if (tooltipUpdatePending) return

    tooltipUpdatePending = true
    const token = ++tooltipUpdateToken
    const runUpdate = () => {
      if (token !== tooltipUpdateToken) return
      tooltipUpdatePending = false
      tooltip.value?.updatePopper?.()
    }

    if (initData.dragging) {
      nextTick(runUpdate)
      return
    }

    if (tooltipFrame !== undefined) return

    tooltipFrame = window.requestAnimationFrame(() => {
      tooltipFrame = undefined
      runUpdate()
    })
  }

  const cancelTooltipFrame = () => {
    if (tooltipFrame !== undefined) {
      window.cancelAnimationFrame(tooltipFrame)
    }
    tooltipFrame = undefined
    tooltipUpdatePending = false
    tooltipUpdateToken++
  }

  const onDragging = (event: MouseEvent | TouchEvent | PointerEvent) => {
    if (initData.dragging) {
      if (
        event.type === 'pointermove' &&
        activePointerId !== undefined &&
        (event as PointerEvent).pointerId !== activePointerId
      ) {
        return
      }
      if (event.cancelable) event.preventDefault()
      initData.isClick = false
      displayTooltip()
      let diff: number
      const { clientX, clientY } = getClientXY(event)
      const now = performance.now()
      const dragSample = dragMotion.move({ x: clientX, y: clientY }, now)
      initData.velocity = dragSample.velocity
      if (props.vertical) {
        initData.currentY = clientY
        diff = ((initData.startY - initData.currentY) / sliderSize.value) * 100
      } else {
        initData.currentX = clientX
        diff = ((initData.currentX - initData.startX) / sliderSize.value) * 100
      }
      initData.newPosition = initData.startPosition + diff
      scheduleDragPosition(initData.newPosition)
      syncSliderMotionVars(resolveVisualOverflow(initData.newPosition))
    }
  }

  const removeDragListeners = () => {
    window.removeEventListener('pointermove', onDragging)
    window.removeEventListener('pointerup', onDragEnd)
    window.removeEventListener('pointercancel', onDragEnd)
    window.removeEventListener('mousemove', onDragging)
    window.removeEventListener('touchmove', onDragging)
    window.removeEventListener('mouseup', onDragEnd)
    window.removeEventListener('touchend', onDragEnd)
    window.removeEventListener('contextmenu', onDragEnd)
  }

  const onDragEnd = (event?: MouseEvent | TouchEvent | PointerEvent) => {
    if (initData.dragging) {
      if (
        event?.type?.startsWith('pointer') &&
        activePointerId !== undefined &&
        (event as PointerEvent).pointerId !== activePointerId
      ) {
        return
      }
      flushDragFrame()
      if (activePointerId !== undefined) {
        try {
          button.value?.releasePointerCapture?.(activePointerId)
        } catch {
          // See setPointerCapture guard above.
        }
      }
      activePointerId = undefined
      dragMotion.end()
      const finalPosition = clampPosition(initData.newPosition)
      applyVisualPosition(finalPosition)
      visualSpring.jump(finalPosition)
      /*
       * 防止在 mouseup 后立即触发 click，导致滑块有几率产生一小段位移
       * 不使用 preventDefault 是因为 mouseup 和 click 没有注册在同一个 DOM 上
       */
      setTimeout(() => {
        initData.dragging = false
        updateDragging(false)
        initData.velocity = 0
        resetFsusInteractiveMotionVars(getSliderRoot())
        if (!initData.hovering) {
          hideTooltip()
        }
        if (!initData.isClick) {
          setPosition(initData.newPosition)
        }
        scheduleTooltipUpdate()
        emitChange()
      }, 0)
      removeDragListeners()
    }
  }

  onBeforeUnmount(() => {
    cancelDragFrame()
    cancelTooltipFrame()
    removeDragListeners()
  })

  const setPosition = async (newPosition: number) => {
    if (newPosition === null || Number.isNaN(+newPosition)) return
    const value = positionToValue(newPosition)

    if (value !== props.modelValue) {
      emit(UPDATE_MODEL_EVENT, value)
    }

    if (!initData.dragging && props.modelValue !== initData.oldValue) {
      initData.oldValue = props.modelValue
    }

    if (!initData.dragging) {
      applyVisualPosition(valueToPercent(value))
    }

    await nextTick()
    initData.dragging && displayTooltip()
    scheduleTooltipUpdate()
  }

  watch(
    () => props.modelValue,
    (value) => {
      if (!initData.dragging) {
        const nextPosition = valueToPercent(value)
        liveValue.value = value
        visualPosition.value = nextPosition
        visualSpring.set(nextPosition)
      }
    },
  )

  return {
    disabled,
    button,
    tooltip,
    tooltipVisible,
    showTooltip,
    wrapperStyle,
    formatValue,
    handleMouseEnter,
    handleMouseLeave,
    onButtonDown,
    onKeyDown,
    setPosition,
  }
}
