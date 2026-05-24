import {
  computed,
  getCurrentInstance,
  isVNode,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  unref,
  useSlots,
  watch,
} from 'vue'
import { throttle } from 'lodash-unified'
import { useResizeObserver } from '@vueuse/core'
import { debugWarn, flattedChildren, isString } from '@element-plus/utils'
import {
  applyFsusInteractiveMotionVars,
  fsusDecayOverflow,
  resetFsusInteractiveMotionVars,
  resolveFsusInteractiveMotion,
  useFsusDrag,
  useFsusMotionRuntime,
  useFsusSpring,
  useOrderedChildren,
} from '@element-plus/hooks'
import { carouselContextKey } from './constants'

import type { SetupContext } from 'vue'
import type { CarouselItemContext } from './constants'
import type { CarouselEmits, CarouselProps } from './carousel'

const THROTTLE_TIME = 300

export const useCarousel = (
  props: CarouselProps,
  emit: SetupContext<CarouselEmits>['emit'],
  componentName: string,
) => {
  const {
    children: items,
    addChild: addItem,
    removeChild: removeItem,
  } = useOrderedChildren<CarouselItemContext>(
    getCurrentInstance()!,
    'ElCarouselItem',
  )

  const slots = useSlots()

  // refs
  const activeIndex = ref(-1)
  const timer = ref<ReturnType<typeof setInterval> | null>(null)
  const hover = ref(false)
  const root = ref<HTMLDivElement>()
  const containerHeight = ref<number>(0)
  const isItemsTwoLength = ref(true)
  const dragOffsetRaw = ref(0)
  const dragMotion = useFsusDrag()
  const motionRuntime = useFsusMotionRuntime()
  const dragSpring = useFsusSpring(dragOffsetRaw, {
    damping: 30,
    mass: 0.74,
    stiffness: 360,
  })
  const dragStartIndex = ref(-1)
  const isDragging = dragMotion.isDragging

  // computed
  const arrowDisplay = computed(
    () => props.arrow !== 'never' && !unref(isVertical),
  )

  const hasLabel = computed(() => {
    return items.value.some((item) => item.props.label.toString().length > 0)
  })

  const isCardType = computed(() => props.type === 'card')
  const isVertical = computed(() => props.direction === 'vertical')
  const dragOffset = computed(() =>
    motionRuntime.value.enabled ? dragSpring.value.value : dragOffsetRaw.value
  )

  const containerStyle = computed(() => {
    if (props.height !== 'auto') {
      return {
        height: props.height,
      }
    }
    return {
      height: `${containerHeight.value}px`,
      overflow: 'hidden',
    }
  })

  // methods
  const throttledArrowClick = throttle(
    (index: number) => {
      setActiveItem(index)
    },
    THROTTLE_TIME,
    { trailing: true },
  )

  const throttledIndicatorHover = throttle((index: number) => {
    handleIndicatorHover(index)
  }, THROTTLE_TIME)

  const isTwoLengthShow = (index: number) => {
    if (!isItemsTwoLength.value) return true
    return activeIndex.value <= 1 ? index <= 1 : index > 1
  }

  function pauseTimer() {
    if (timer.value) {
      clearInterval(timer.value)
      timer.value = null
    }
  }

  function startTimer() {
    if (
      props.interval <= 0 ||
      !props.autoplay ||
      timer.value ||
      (typeof document !== 'undefined' && document.hidden)
    )
      return
    timer.value = setInterval(() => playSlides(), props.interval)
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      pauseTimer()
    } else {
      startTimer()
    }
  }

  const playSlides = () => {
    if (activeIndex.value < items.value.length - 1) {
      activeIndex.value = activeIndex.value + 1
    } else if (props.loop) {
      activeIndex.value = 0
    }
  }

  function setActiveItem(index: number | string) {
    if (isString(index)) {
      const filteredItems = items.value.filter(
        (item) => item.props.name === index,
      )
      if (filteredItems.length > 0) {
        index = items.value.indexOf(filteredItems[0])
      }
    }
    index = Number(index)
    if (Number.isNaN(index) || index !== Math.floor(index)) {
      debugWarn(componentName, 'index must be integer.')
      return
    }
    const itemCount = items.value.length
    const oldIndex = activeIndex.value
    if (index < 0) {
      activeIndex.value = props.loop ? itemCount - 1 : 0
    } else if (index >= itemCount) {
      activeIndex.value = props.loop ? 0 : itemCount - 1
    } else {
      activeIndex.value = index
    }
    if (oldIndex === activeIndex.value) {
      resetItemPosition(oldIndex)
    }
    resetTimer()
  }

  function resetItemPosition(oldIndex?: number) {
    items.value.forEach((item, index) => {
      item.translateItem(index, activeIndex.value, oldIndex)
    })
  }

  function itemInStage(item: CarouselItemContext, index: number) {
    const _items = unref(items)
    const itemCount = _items.length
    if (itemCount === 0 || !item.states.inStage) return false
    const nextItemIndex = index + 1
    const prevItemIndex = index - 1
    const lastItemIndex = itemCount - 1
    const isLastItemActive = _items[lastItemIndex].states.active
    const isFirstItemActive = _items[0].states.active
    const isNextItemActive = _items[nextItemIndex]?.states?.active
    const isPrevItemActive = _items[prevItemIndex]?.states?.active

    if ((index === lastItemIndex && isFirstItemActive) || isNextItemActive) {
      return 'left'
    } else if ((index === 0 && isLastItemActive) || isPrevItemActive) {
      return 'right'
    }
    return false
  }

  function handleMouseEnter() {
    hover.value = true
    if (props.pauseOnHover) {
      pauseTimer()
    }
  }

  function handleMouseLeave() {
    hover.value = false
    if (!isDragging.value) startTimer()
  }

  function handleButtonEnter(arrow: 'left' | 'right') {
    if (unref(isVertical)) return
    items.value.forEach((item, index) => {
      if (arrow === itemInStage(item, index)) {
        item.states.hover = true
      }
    })
  }

  function handleButtonLeave() {
    if (unref(isVertical)) return
    items.value.forEach((item) => {
      item.states.hover = false
    })
  }

  function handleIndicatorClick(index: number) {
    activeIndex.value = index
  }

  function handleIndicatorHover(index: number) {
    if (props.trigger === 'hover' && index !== activeIndex.value) {
      activeIndex.value = index
    }
  }

  function prev() {
    setActiveItem(activeIndex.value - 1)
  }

  function next() {
    setActiveItem(activeIndex.value + 1)
  }

  function getDragSize() {
    const rootEl = root.value
    if (!rootEl) return 0

    return unref(isVertical) ? rootEl.offsetHeight : rootEl.offsetWidth
  }

  function canDragFromCurrentIndex(offset: number) {
    if (props.loop) return true
    if (offset > 0 && activeIndex.value <= 0) return false
    return !(offset < 0 && activeIndex.value >= items.value.length - 1)
  }

  function dampDragOffset(offset: number) {
    if (canDragFromCurrentIndex(offset)) return offset

    return Math.sign(offset) * fsusDecayOverflow(Math.abs(offset), 96)
  }

  function shouldIgnoreDragStart(event: PointerEvent) {
    if (event.button !== 0) return true
    const target = event.target as HTMLElement | null
    return Boolean(
      target?.closest(
        [
          '.el-carousel__arrow',
          '.el-carousel__indicator',
          '.el-carousel__button',
          'a',
          'button',
          'input',
          'select',
          'textarea',
          '[contenteditable="true"]',
          '[role="button"]',
        ].join(',')
      )
    )
  }

  function setPointerCaptureSafely(event: PointerEvent) {
    try {
      root.value?.setPointerCapture?.(event.pointerId)
    } catch {
      // Synthetic pointer events do not always register an active pointer.
    }
  }

  function releasePointerCaptureSafely(event: PointerEvent) {
    try {
      root.value?.releasePointerCapture?.(event.pointerId)
    } catch {
      // The pointer can already be released after cancellation or synthetic tests.
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (shouldIgnoreDragStart(event) || items.value.length <= 1) return

    event.preventDefault()
    pauseTimer()
    dragStartIndex.value = activeIndex.value
    dragOffsetRaw.value = 0
    dragSpring.stop()
    dragMotion.start({
      x: event.clientX,
      y: event.clientY,
    })
    applyFsusInteractiveMotionVars(
      root.value,
      resolveFsusInteractiveMotion({
        axis: unref(isVertical) ? 'y' : 'x',
        deltaX: unref(isVertical) ? 0 : 24,
        deltaY: unref(isVertical) ? 24 : 0,
        kind: 'carousel',
        runtime: motionRuntime.value,
      }),
    )
    setPointerCaptureSafely(event)
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isDragging.value) return

    event.preventDefault()
    const drag = dragMotion.move({
      x: event.clientX,
      y: event.clientY,
    })
    applyFsusInteractiveMotionVars(
      root.value,
      resolveFsusInteractiveMotion({
        axis: unref(isVertical) ? 'y' : 'x',
        deltaX: unref(isVertical) ? 0 : drag.deltaX,
        deltaY: unref(isVertical) ? drag.deltaY : 0,
        elapsedMs: 16,
        kind: 'carousel',
        runtime: motionRuntime.value,
      }),
    )
    const offset = unref(isVertical) ? drag.totalY : drag.totalX

    dragOffsetRaw.value = dampDragOffset(offset)
  }

  function settleDrag(event: PointerEvent) {
    if (!isDragging.value) return

    const size = getDragSize()
    const offset = dragOffsetRaw.value
    const velocity = dragMotion.end()
    const threshold = Math.max(48, size * 0.18)
    const velocityThreshold =
      motionRuntime.value.preset === 'expressive' ? 0.32 : 0.4
    const movedForward =
      offset < -threshold || (offset < 0 && velocity > velocityThreshold)
    const movedBackward =
      offset > threshold || (offset > 0 && velocity > velocityThreshold)

    releasePointerCaptureSafely(event)
    dragOffsetRaw.value = 0
    resetFsusInteractiveMotionVars(root.value)

    if (activeIndex.value === dragStartIndex.value) {
      if (movedForward) {
        next()
      } else if (movedBackward) {
        prev()
      } else {
        resetItemPosition(activeIndex.value)
      }
    }

    dragStartIndex.value = -1
    if (!hover.value) startTimer()
  }

  function resetTimer() {
    pauseTimer()
    if (!props.pauseOnHover) startTimer()
  }

  function setContainerHeight(height: number) {
    if (props.height !== 'auto') return
    containerHeight.value = height
  }

  function PlaceholderItem() {
    // fix: https://github.com/element-plus/element-plus/issues/12139
    const defaultSlots = slots.default?.()
    if (!defaultSlots) return null

    const flatSlots = flattedChildren(defaultSlots)

    const carouselItemsName = 'ElCarouselItem'

    const normalizeSlots = flatSlots.filter((slot) => {
      return isVNode(slot) && (slot.type as any).name === carouselItemsName
    })

    if (normalizeSlots?.length === 2 && props.loop && !isCardType.value) {
      isItemsTwoLength.value = true
      return normalizeSlots
    }
    isItemsTwoLength.value = false
    return null
  }

  // watch
  watch(
    () => activeIndex.value,
    (current, prev) => {
      resetItemPosition(prev)
      if (isItemsTwoLength.value) {
        current = current % 2
        prev = prev % 2
      }
      if (prev > -1) {
        emit('change', current, prev)
      }
    },
  )
  watch(
    () => props.autoplay,
    (autoplay) => {
      autoplay ? startTimer() : pauseTimer()
    },
  )
  watch(
    () => props.loop,
    () => {
      setActiveItem(activeIndex.value)
    },
  )

  watch(
    () => props.interval,
    () => {
      resetTimer()
    },
  )

  const resizeObserver = shallowRef<ReturnType<typeof useResizeObserver>>()
  // lifecycle
  onMounted(() => {
    watch(
      () => items.value,
      () => {
        if (items.value.length > 0) setActiveItem(props.initialIndex)
      },
      {
        immediate: true,
      },
    )

    resizeObserver.value = useResizeObserver(root.value, () => {
      resetItemPosition()
    })
    document.addEventListener('visibilitychange', handleVisibilityChange)
    startTimer()
  })

  onBeforeUnmount(() => {
    pauseTimer()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    if (root.value && resizeObserver.value) resizeObserver.value.stop()
  })

  // provide
  provide(carouselContextKey, {
    root,
    dragOffset,
    isDragging,
    isCardType,
    isVertical,
    items,
    loop: props.loop,
    addItem,
    removeItem,
    setActiveItem,
    setContainerHeight,
  })

  return {
    root,
    activeIndex,
    arrowDisplay,
    hasLabel,
    hover,
    isDragging,
    isCardType,
    items,
    isVertical,
    containerStyle,
    isItemsTwoLength,
    handleButtonEnter,
    handleButtonLeave,
    handleIndicatorClick,
    handleMouseEnter,
    handleMouseLeave,
    handlePointerCancel: settleDrag,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: settleDrag,
    setActiveItem,
    prev,
    next,
    PlaceholderItem,
    isTwoLengthShow,
    throttledArrowClick,
    throttledIndicatorHover,
  }
}
