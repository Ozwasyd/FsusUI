// @ts-nocheck
import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  onMounted,
  onBeforeUnmount,
  onUpdated,
  ref,
  resolveDynamicComponent,
  unref,
} from 'vue'
import { hasOwn, isClient, isNumber, isString } from '@element-plus/utils'
import {
  applyFsusInteractiveMotionVars,
  resolveFsusInteractiveMotion,
  resolveFsusRenderPipelineCache,
  resolveFsusRenderPipelineUnitAttrs,
  useFsusRenderPipelineRuntime,
  useFsusMotionRuntime,
  useNamespace,
} from '@element-plus/hooks'
import { useGlobalConfig } from '@element-plus/components/config-provider'
import { useCache } from '../hooks/use-cache'
import useWheel from '../hooks/use-wheel'
import Scrollbar from '../components/scrollbar'
import { getRTLOffsetType, getScrollDir, isHorizontal } from '../utils'
import { virtualizedListProps } from '../props'
import {
  AUTO_ALIGNMENT,
  BACKWARD,
  DEFAULT_DYNAMIC_LIST_ITEM_SIZE,
  FORWARD,
  HORIZONTAL,
  ITEM_RENDER_EVT,
  RTL,
  RTL_OFFSET_NAG,
  RTL_OFFSET_POS_ASC,
  RTL_OFFSET_POS_DESC,
  SCROLL_EVT,
} from '../defaults'

import type { CSSProperties, Slot, VNode, VNodeChild } from 'vue'
import type { Alignment, ListConstructorProps } from '../types'
import type { VirtualizedListProps } from '../props'

const SCROLL_MOTION_IDLE_MS = 320

const createList = ({
  name,
  getOffset,
  getItemSize,
  getItemOffset,
  getEstimatedTotalSize,
  getStartIndexForOffset,
  getStopIndexForStartIndex,
  initCache,
  clearCache,
  validateProps,
}: ListConstructorProps<VirtualizedListProps>) => {
  return defineComponent({
    name: name ?? 'ElVirtualList',
    props: virtualizedListProps,
    emits: [ITEM_RENDER_EVT, SCROLL_EVT],
    setup(props, { emit, expose }) {
      validateProps(props)
      const instance = getCurrentInstance()!

      const ns = useNamespace('vl')
      const motionRuntime = useFsusMotionRuntime()
      const renderPipelineConfig = useGlobalConfig('renderPipeline')

      const dynamicSizeCache = ref(initCache(props, instance))

      const getItemStyleCache = useCache()
      let resetFrame = 0
      let scrollFrame = 0
      let pendingScrollElement: HTMLElement | null = null
      // refs
      // here windowRef and innerRef can be type of HTMLElement
      // or user defined component type, depends on the type passed
      // by user
      const windowRef = ref<HTMLElement>()
      const innerRef = ref<HTMLElement>()
      const wrapperRef = ref<HTMLElement>()
      const scrollbarRef = ref()
      const states = ref({
        isScrolling: false,
        isScrollMotion: false,
        scrollDir: 'forward',
        scrollOffset: isNumber(props.initScrollOffset)
          ? props.initScrollOffset
          : 0,
        updateRequested: false,
        isScrollbarDragging: false,
        scrollbarAlwaysOn: props.scrollbarAlwaysOn,
      })

      // computed
      const renderPipelineRuntime = useFsusRenderPipelineRuntime({
        componentName: name ?? 'ElVirtualList',
        config: renderPipelineConfig,
        estimate: computed(() => ({
          items: props.total ?? 0,
          nodes: props.total ?? 0,
        })),
        source: computed(() => props.total ?? 0),
      })
      const resolvedRenderPipelineConfig = renderPipelineRuntime.config
      const baseRenderPipelineHardwareAttrs =
        renderPipelineRuntime.hardwareAttrs

      const estimatedItemPixelSize = computed(() =>
        Math.max(
          1,
          props.estimatedItemSize ??
            (isNumber(props.itemSize)
              ? props.itemSize
              : DEFAULT_DYNAMIC_LIST_ITEM_SIZE),
        ),
      )

      const renderPipelineStrategy = renderPipelineRuntime.strategy

      const effectiveCache = computed(() =>
        resolveFsusRenderPipelineCache({
          budgeted: renderPipelineConfig.value !== undefined,
          config: resolvedRenderPipelineConfig.value,
          estimatedItemSize: estimatedItemPixelSize.value,
          explicitCache: props.cache,
          strategy: renderPipelineStrategy.value,
        }),
      )

      const itemsToRender = computed(() => {
        const { total } = props
        const { isScrolling, scrollDir, scrollOffset } = unref(states)

        if (total === 0) {
          return [0, 0, 0, 0]
        }

        const startIndex = getStartIndexForOffset(
          props,
          scrollOffset,
          unref(dynamicSizeCache),
        )
        const stopIndex = getStopIndexForStartIndex(
          props,
          startIndex,
          scrollOffset,
          unref(dynamicSizeCache),
        )

        const cache = effectiveCache.value
        const cacheBackward =
          !isScrolling || scrollDir === BACKWARD ? Math.max(1, cache) : 1
        const cacheForward =
          !isScrolling || scrollDir === FORWARD ? Math.max(1, cache) : 1

        return [
          Math.max(0, startIndex - cacheBackward),
          Math.max(0, Math.min(total! - 1, stopIndex + cacheForward)),
          startIndex,
          stopIndex,
        ]
      })

      const renderPipelineHardwareAttrs = computed(() => {
        const [start, end] = itemsToRender.value
        const renderedCount = end >= start ? end - start + 1 : 0
        return resolveFsusRenderPipelineUnitAttrs({
          baseAttrs: baseRenderPipelineHardwareAttrs.value,
          disableContentVisibilityOnOverflow: true,
          layerBudget:
            resolvedRenderPipelineConfig.value.acceleration.layerBudget,
          renderedCount,
        })
      })

      const estimatedTotalSize = computed(() =>
        getEstimatedTotalSize(props, unref(dynamicSizeCache)),
      )

      const _isHorizontal = computed(() => isHorizontal(props.layout))

      const windowStyle = computed(() => [
        {
          position: 'relative',
          [`overflow-${_isHorizontal.value ? 'x' : 'y'}`]: 'scroll',
          WebkitOverflowScrolling: 'touch',
          willChange:
            renderPipelineRuntime.compositor.value &&
            states.value.isScrollMotion
              ? 'transform'
              : undefined,
        },
        {
          direction: props.direction,
          height: isNumber(props.height) ? `${props.height}px` : props.height,
          width: isNumber(props.width) ? `${props.width}px` : props.width,
        },
        props.style,
      ])

      const innerStyle = computed(() => {
        const size = unref(estimatedTotalSize)
        const horizontal = unref(_isHorizontal)
        return {
          height: horizontal ? '100%' : `${size}px`,
          pointerEvents: unref(states).isScrolling ? 'none' : undefined,
          width: horizontal ? `${size}px` : '100%',
        }
      })

      const clientSize = computed(() =>
        _isHorizontal.value ? props.width : props.height,
      )

      // methods
      const { onWheel } = useWheel(
        {
          atStartEdge: computed(() => states.value.scrollOffset <= 0),
          atEndEdge: computed(
            () => states.value.scrollOffset >= estimatedTotalSize.value,
          ),
          layout: computed(() => props.layout),
        },
        (offset) => {
          ;(
            scrollbarRef.value as any as {
              onMouseUp: () => void
            }
          ).onMouseUp?.()
          scrollTo(
            Math.min(
              states.value.scrollOffset + offset,
              estimatedTotalSize.value - (clientSize.value as number),
            ),
          )
        },
      )

      const emitEvents = () => {
        const { total } = props

        if (total! > 0) {
          const [cacheStart, cacheEnd, visibleStart, visibleEnd] =
            unref(itemsToRender)
          emit(ITEM_RENDER_EVT, cacheStart, cacheEnd, visibleStart, visibleEnd)
        }

        const { scrollDir, scrollOffset, updateRequested } = unref(states)
        emit(SCROLL_EVT, scrollDir, scrollOffset, updateRequested)
      }

      const scrollVertically = (element: HTMLElement) => {
        const { clientHeight, scrollHeight, scrollTop } = element
        const _states = unref(states)
        if (_states.scrollOffset === scrollTop) {
          return
        }

        const scrollOffset = Math.max(
          0,
          Math.min(scrollTop, scrollHeight - clientHeight),
        )

        states.value = {
          ..._states,
          isScrolling: true,
          scrollDir: getScrollDir(_states.scrollOffset, scrollOffset),
          scrollOffset,
          updateRequested: false,
        }

        scheduleResetIsScrolling()
        triggerScrollMotion(
          _isHorizontal.value ? scrollOffset - _states.scrollOffset : 0,
          _isHorizontal.value ? 0 : scrollOffset - _states.scrollOffset,
        )
      }

      const scrollHorizontally = (element: HTMLElement) => {
        const { clientWidth, scrollLeft, scrollWidth } = element
        const _states = unref(states)

        if (_states.scrollOffset === scrollLeft) {
          return
        }

        const { direction } = props

        let scrollOffset = scrollLeft

        if (direction === RTL) {
          // TRICKY According to the spec, scrollLeft should be negative for RTL aligned elements.
          // This is not the case for all browsers though (e.g. Chrome reports values as positive, measured relative to the left).
          // It's also easier for this component if we convert offsets to the same format as they would be in for ltr.
          // So the simplest solution is to determine which browser behavior we're dealing with, and convert based on it.
          switch (getRTLOffsetType()) {
            case RTL_OFFSET_NAG: {
              scrollOffset = -scrollLeft
              break
            }
            case RTL_OFFSET_POS_DESC: {
              scrollOffset = scrollWidth - clientWidth - scrollLeft
              break
            }
          }
        }

        scrollOffset = Math.max(
          0,
          Math.min(scrollOffset, scrollWidth - clientWidth),
        )

        states.value = {
          ..._states,
          isScrolling: true,
          scrollDir: getScrollDir(_states.scrollOffset, scrollOffset),
          scrollOffset,
          updateRequested: false,
        }

        scheduleResetIsScrolling()
        triggerScrollMotion(
          _isHorizontal.value ? scrollOffset - _states.scrollOffset : 0,
          _isHorizontal.value ? 0 : scrollOffset - _states.scrollOffset,
        )
      }

      const flushScroll = () => {
        scrollFrame = 0
        const element = pendingScrollElement
        pendingScrollElement = null
        if (!element) return

        unref(_isHorizontal)
          ? scrollHorizontally(element)
          : scrollVertically(element)
        emitEvents()
      }

      const onScroll = (e: Event) => {
        pendingScrollElement = e.currentTarget as HTMLElement
        if (scrollFrame) return
        if (typeof requestAnimationFrame !== 'function') {
          flushScroll()
          return
        }
        scrollFrame = requestAnimationFrame(flushScroll)
      }

      const onScrollbarScroll = (distanceToGo: number, totalSteps: number) => {
        const offset =
          ((estimatedTotalSize.value - (clientSize.value as number)) /
            totalSteps) *
          distanceToGo
        scrollTo(
          Math.min(
            estimatedTotalSize.value - (clientSize.value as number),
            offset,
          ),
        )
      }

      const onScrollbarStartMove = () => {
        states.value = {
          ...unref(states),
          isScrollbarDragging: true,
          isScrolling: true,
        }
        if (resetFrame) {
          cancelAnimationFrame(resetFrame)
          resetFrame = 0
        }
      }

      const onScrollbarStopMove = () => {
        states.value = {
          ...unref(states),
          isScrollbarDragging: false,
        }
        scheduleResetIsScrolling()
        scheduleScrollMotionEnd()
      }

      const scrollTo = (offset: number) => {
        offset = Math.max(offset, 0)
        const previousOffset = unref(states).scrollOffset

        if (offset === previousOffset) {
          return
        }

        states.value = {
          ...unref(states),
          isScrolling: true,
          scrollOffset: offset,
          scrollDir: getScrollDir(previousOffset, offset),
          updateRequested: true,
        }

        scheduleResetIsScrolling()
        triggerScrollMotion(
          _isHorizontal.value ? offset - previousOffset : 0,
          _isHorizontal.value ? 0 : offset - previousOffset,
        )
      }

      const scrollToItem = (
        idx: number,
        alignment: Alignment = AUTO_ALIGNMENT,
      ) => {
        const { scrollOffset } = unref(states)

        idx = Math.max(0, Math.min(idx, props.total! - 1))
        scrollTo(
          getOffset(
            props,
            idx,
            alignment,
            scrollOffset,
            unref(dynamicSizeCache),
          ),
        )
      }

      const getItemStyle = (idx: number) => {
        const { direction, itemSize, layout } = props

        const itemStyleCache = getItemStyleCache.value(
          clearCache && itemSize,
          clearCache && layout,
          clearCache && direction,
        )

        let style: CSSProperties
        if (hasOwn(itemStyleCache, String(idx))) {
          style = itemStyleCache[idx]
        } else {
          const offset = getItemOffset(props, idx, unref(dynamicSizeCache))
          const size = getItemSize(props, idx, unref(dynamicSizeCache))
          const horizontal = unref(_isHorizontal)

          const isRtl = direction === RTL
          const offsetHorizontal = horizontal ? offset : 0
          itemStyleCache[idx] = style = {
            position: 'absolute',
            left: isRtl ? undefined : `${offsetHorizontal}px`,
            right: isRtl ? `${offsetHorizontal}px` : undefined,
            top: !horizontal ? `${offset}px` : 0,
            height: !horizontal ? `${size}px` : '100%',
            width: horizontal ? `${size}px` : '100%',
          }
        }

        return style
      }

      // TODO:
      // perf optimization here, reset isScrolling with debounce.
      let scrollMotionTimer: ReturnType<typeof setTimeout> | undefined
      let scrollMotionFrame = 0
      let lastScrollMotionAt = 0

      const scheduleResetIsScrolling = () => {
        if (resetFrame) return
        resetFrame = requestAnimationFrame(resetIsScrolling)
      }

      const syncScrollMotionClasses = (active: boolean) => {
        const wrapper = wrapperRef.value
        if (!wrapper) return

        wrapper.classList.remove(
          ns.is('scrolling'),
          ns.is('scrolling-forward'),
          ns.is('scrolling-backward'),
        )
        if (!active) return

        wrapper.classList.add(
          ns.is('scrolling'),
          ns.is(`scrolling-${states.value.scrollDir}`),
        )
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
        states.value.isScrollMotion = false
        syncScrollMotionClasses(false)
      }

      const scheduleScrollMotionEnd = () => {
        clearScrollMotionSchedule()
        if (states.value.isScrollbarDragging) return
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

      const triggerScrollMotion = (deltaX = 0, deltaY = 0) => {
        if (!motionRuntime.value.enabled) return
        const now =
          typeof performance !== 'undefined' ? performance.now() : Date.now()
        applyFsusInteractiveMotionVars(
          wrapperRef.value,
          resolveFsusInteractiveMotion({
            deltaX,
            deltaY,
            elapsedMs: lastScrollMotionAt ? now - lastScrollMotionAt : 16,
            runtime: motionRuntime.value,
          }),
        )
        lastScrollMotionAt = now
        states.value.isScrollMotion = true
        syncScrollMotionClasses(true)
        scheduleScrollMotionEnd()
      }

      const resetIsScrolling = () => {
        resetFrame = 0
        states.value.isScrolling = false
        getItemStyleCache.value(-1, null, null)
      }

      const resetScrollTop = () => {
        const window = windowRef.value
        if (window) {
          window.scrollTop = 0
        }
      }

      const resetAfterIndex = (index: number, forceUpdate = true) => {
        dynamicSizeCache.value?.clearCacheAfterIndex?.(index, forceUpdate)
      }

      // life cycles
      onMounted(() => {
        if (!isClient) return
        const { initScrollOffset } = props
        const windowElement = unref(windowRef)
        if (isNumber(initScrollOffset) && windowElement) {
          if (unref(_isHorizontal)) {
            windowElement.scrollLeft = initScrollOffset
          } else {
            windowElement.scrollTop = initScrollOffset
          }
        }

        emitEvents()
      })

      onBeforeUnmount(() => {
        if (scrollFrame) {
          cancelAnimationFrame(scrollFrame)
          scrollFrame = 0
        }
        pendingScrollElement = null
        if (resetFrame) {
          cancelAnimationFrame(resetFrame)
          resetFrame = 0
        }
        clearScrollMotionSchedule()
      })

      onUpdated(() => {
        const { direction, layout } = props
        const { scrollOffset, updateRequested } = unref(states)
        const windowElement = unref(windowRef)

        if (updateRequested && windowElement) {
          if (layout === HORIZONTAL) {
            if (direction === RTL) {
              // TRICKY According to the spec, scrollLeft should be negative for RTL aligned elements.
              // This is not the case for all browsers though (e.g. Chrome reports values as positive, measured relative to the left).
              // So we need to determine which browser behavior we're dealing with, and mimic it.
              switch (getRTLOffsetType()) {
                case RTL_OFFSET_NAG: {
                  windowElement.scrollLeft = -scrollOffset
                  break
                }
                case RTL_OFFSET_POS_ASC: {
                  windowElement.scrollLeft = scrollOffset
                  break
                }
                default: {
                  const { clientWidth, scrollWidth } = windowElement
                  windowElement.scrollLeft =
                    scrollWidth - clientWidth - scrollOffset
                  break
                }
              }
            } else {
              windowElement.scrollLeft = scrollOffset
            }
          } else {
            windowElement.scrollTop = scrollOffset
          }
        }
      })

      const api = {
        ns,
        clientSize,
        estimatedTotalSize,
        windowStyle,
        wrapperRef,
        windowRef,
        innerRef,
        innerStyle,
        itemsToRender,
        scrollbarRef,
        states,
        effectiveCache,
        renderPipelineHardwareAttrs,
        renderPipelineStrategy,
        getItemStyle,
        onScroll,
        onScrollbarScroll,
        onScrollbarStartMove,
        onScrollbarStopMove,
        onWheel,
        scrollTo,
        scrollToItem,
        resetScrollTop,
        resetAfterIndex,
      }

      expose({
        windowRef,
        wrapperRef,
        innerRef,
        getItemStyleCache,
        scrollTo,
        scrollToItem,
        resetScrollTop,
        resetAfterIndex,
        states,
      })

      return api
    },

    render(ctx: any) {
      const {
        $slots,
        className,
        clientSize,
        containerElement,
        data,
        getItemStyle,
        innerElement,
        itemsToRender,
        innerStyle,
        layout,
        total,
        onScroll,
        onScrollbarScroll,
        onScrollbarStartMove,
        onScrollbarStopMove,
        onWheel,
        states,
        effectiveCache,
        renderPipelineStrategy,
        renderPipelineHardwareAttrs,
        useIsScrolling,
        windowStyle,
        ns,
      } = ctx

      const [start, end] = itemsToRender

      const Container = resolveDynamicComponent(containerElement)
      const Inner = resolveDynamicComponent(innerElement)

      const children = [] as VNodeChild[]

      if (total > 0) {
        for (let i = start; i <= end; i++) {
          children.push(
            ($slots.default as Slot)?.({
              data,
              key: i,
              index: i,
              isScrolling: useIsScrolling ? states.isScrolling : undefined,
              style: getItemStyle(i),
            }),
          )
        }
      }

      const InnerNode = [
        h(
          Inner as VNode,
          {
            class: ns.e('inner'),
            style: innerStyle,
            ref: 'innerRef',
          },
          !isString(Inner)
            ? {
                default: () => children,
              }
            : children,
        ),
      ]

      const scrollbar = h(Scrollbar, {
        ref: 'scrollbarRef',
        clientSize,
        class: states.isScrollMotion ? ns.is('scrolling') : '',
        layout,
        onStartMove: onScrollbarStartMove,
        onStopMove: onScrollbarStopMove,
        onScroll: onScrollbarScroll,
        ratio: (clientSize * 100) / this.estimatedTotalSize,
        scrollFrom:
          states.scrollOffset / (this.estimatedTotalSize - clientSize),
        total,
      })

      const listContainer = h(
        Container as VNode,
        {
          class: [ns.e('window'), className],
          ...renderPipelineHardwareAttrs,
          style: windowStyle,
          onScroll,
          onWheel,
          ref: 'windowRef',
          key: 0,
        },
        !isString(Container) ? { default: () => [InnerNode] } : [InnerNode],
      )

      return h(
        'div',
        {
          key: 0,
          class: [
            ns.e('wrapper'),
            states.scrollbarAlwaysOn ? 'always-on' : '',
            ns.is('scrolling', states.isScrollMotion),
            ns.is('vertical', layout !== HORIZONTAL),
            ns.is('horizontal', layout === HORIZONTAL),
            states.isScrollMotion ? ns.is(`scrolling-${states.scrollDir}`) : '',
          ],
          'data-fsus-render-cache': effectiveCache,
          ...renderPipelineHardwareAttrs,
          'data-fsus-render-items': total,
          'data-fsus-render-pipeline': 'virtual-list',
          'data-fsus-render-strategy': renderPipelineStrategy,
          ref: 'wrapperRef',
        },
        [listContainer, scrollbar],
      )
    },
  })
}

export default createList
