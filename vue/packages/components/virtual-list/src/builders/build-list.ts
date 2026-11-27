import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  onMounted,
  onUpdated,
  ref,
  resolveDynamicComponent,
  unref,
} from 'vue'
import { hasOwn, isClient, isNumber, isString } from '@element-plus/utils'
import { useFsusMotionRuntime, useNamespace } from '@element-plus/hooks'
import { useGlobalConfig } from '@element-plus/components/config-provider'
import { useCache } from '../hooks/use-cache'
import { useVirtualRenderPipeline } from '../hooks/use-render-pipeline'
import { useVirtualScroll } from '../hooks/use-scroll'
import useWheel from '../hooks/use-wheel'
import Scrollbar from '../components/scrollbar'
import {
  estimateVirtualItemSize,
  getLogicalRTLScrollLeft,
  getScrollDir,
  getVirtualRange,
  isHorizontal,
  setLogicalRTLScrollLeft,
} from '../utils'
import { virtualizedListProps } from '../props'
import {
  AUTO_ALIGNMENT,
  HORIZONTAL,
  ITEM_RENDER_EVT,
  RTL,
  SCROLL_EVT,
} from '../defaults'

import type { CSSProperties, Slot, VNode, VNodeChild } from 'vue'
import type { Alignment, ListConstructorProps } from '../types'
import type { VirtualizedListProps } from '../props'

const createList = ({
  name,
  getOffset,
  getItemSize,
  getItemOffset,
  getEstimatedTotalSize,
  getStartIndexForOffset,
  getStopIndexForStartIndex,
  initCache,
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
      const {
        runtime: renderPipelineRuntime,
        resolveCache,
        resolveHardwareAttrs,
      } = useVirtualRenderPipeline({
        componentName: name ?? 'ElVirtualList',
        config: renderPipelineConfig,
        estimate: computed(() => ({
          items: props.total ?? 0,
          nodes: props.total ?? 0,
        })),
        source: computed(() => props.total ?? 0),
      })
      const estimatedItemPixelSize = computed(() =>
        estimateVirtualItemSize(props.estimatedItemSize, props.itemSize),
      )
      const renderPipelineStrategy = renderPipelineRuntime.strategy
      const effectiveCache = computed(() =>
        resolveCache(estimatedItemPixelSize.value, props.cache),
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

        return getVirtualRange(
          startIndex,
          stopIndex,
          total!,
          effectiveCache.value,
          isScrolling,
          scrollDir,
        )
      })

      const renderPipelineHardwareAttrs = computed(() => {
        const [start, end] = itemsToRender.value
        const renderedCount = end >= start ? end - start + 1 : 0
        const crossSize = Number(
          unref(_isHorizontal) ? props.height : props.width,
        )
        const unitArea =
          estimatedItemPixelSize.value *
          (Number.isFinite(crossSize) && crossSize > 0
            ? crossSize
            : estimatedItemPixelSize.value)
        return resolveHardwareAttrs(renderedCount, unitArea)
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
        const delta = scrollOffset - _states.scrollOffset

        _states.isScrolling = true
        _states.scrollDir = getScrollDir(_states.scrollOffset, scrollOffset)
        _states.scrollOffset = scrollOffset
        _states.updateRequested = false

        scheduleResetIsScrolling()
        triggerScrollMotion(
          _isHorizontal.value ? delta : 0,
          _isHorizontal.value ? 0 : delta,
        )
      }

      const scrollHorizontally = (element: HTMLElement) => {
        const { clientWidth, scrollLeft, scrollWidth } = element
        const _states = unref(states)

        if (_states.scrollOffset === scrollLeft) {
          return
        }

        const logicalOffset =
          props.direction === RTL
            ? getLogicalRTLScrollLeft(scrollLeft, scrollWidth, clientWidth)
            : scrollLeft
        const scrollOffset = Math.max(
          0,
          Math.min(logicalOffset, scrollWidth - clientWidth),
        )
        const delta = scrollOffset - _states.scrollOffset

        _states.isScrolling = true
        _states.scrollDir = getScrollDir(_states.scrollOffset, scrollOffset)
        _states.scrollOffset = scrollOffset
        _states.updateRequested = false

        scheduleResetIsScrolling()
        triggerScrollMotion(
          _isHorizontal.value ? delta : 0,
          _isHorizontal.value ? 0 : delta,
        )
      }

      const flushScroll = (element: HTMLElement) => {
        unref(_isHorizontal)
          ? scrollHorizontally(element)
          : scrollVertically(element)
        emitEvents()
      }

      const onScrollbarScroll = (distanceToGo: number, totalSteps: number) => {
        if (!Number.isFinite(totalSteps) || totalSteps <= 0) return
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

      const scrollTo = (offset: number) => {
        offset = Math.max(offset, 0)
        const previousOffset = unref(states).scrollOffset

        if (offset === previousOffset) {
          return
        }

        states.value.isScrolling = true
        states.value.scrollOffset = offset
        states.value.scrollDir = getScrollDir(previousOffset, offset)
        states.value.updateRequested = true

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
          itemSize,
          layout,
          direction,
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

      let lastScrollMotionClass = ''

      const syncScrollMotionClasses = (active: boolean) => {
        const wrapper = wrapperRef.value
        if (!wrapper) return
        const nextClass = active ? states.value.scrollDir : ''
        if (nextClass === lastScrollMotionClass) return
        lastScrollMotionClass = nextClass

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

      const {
        onScroll,
        onScrollEnd,
        onScrollbarStartMove,
        onScrollbarStopMove,
        scheduleResetIsScrolling,
        triggerScrollMotion,
      } = useVirtualScroll({
        states,
        wrapperRef,
        motionRuntime,
        flushScroll,
        setScrollMotion: (active) => {
          states.value.isScrollMotion = active
        },
        syncScrollMotionClasses,
      })

      const resetScrollTop = () => {
        const window = windowRef.value
        if (window) {
          window.scrollTop = 0
        }
      }

      const resetAfterIndex = (index: number, forceUpdate = true) => {
        dynamicSizeCache.value?.clearCacheAfterIndex?.(index, forceUpdate)
        getItemStyleCache.value.clear()
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

      onUpdated(() => {
        const { direction, layout } = props
        const { scrollOffset, updateRequested } = unref(states)
        const windowElement = unref(windowRef)

        if (updateRequested && windowElement) {
          if (layout === HORIZONTAL) {
            if (direction === RTL) {
              setLogicalRTLScrollLeft(windowElement, scrollOffset)
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
        onScrollEnd,
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
        onScrollEnd,
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
        ratio: (clientSize * 100) / Math.max(1, this.estimatedTotalSize),
        scrollFrom:
          states.scrollOffset /
          Math.max(1, this.estimatedTotalSize - clientSize),
        total,
      })

      const listContainer = h(
        Container as VNode,
        {
          class: [ns.e('window'), className],
          ...renderPipelineHardwareAttrs,
          style: windowStyle,
          onScroll,
          onScrollend: onScrollEnd,
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
            ns.is('fast-scrolling', states.isScrolling),
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
