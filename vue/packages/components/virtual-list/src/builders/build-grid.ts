import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  onMounted,
  ref,
  resolveDynamicComponent,
  unref,
} from 'vue'
import {
  getScrollBarWidth,
  hasOwn,
  isClient,
  isNumber,
  isString,
} from '@element-plus/utils'
import { useFsusMotionRuntime, useNamespace } from '@element-plus/hooks'
import { useGlobalConfig } from '@element-plus/components/config-provider'
import Scrollbar from '../components/scrollbar'
import { useGridWheel } from '../hooks/use-grid-wheel'
import { useCache } from '../hooks/use-cache'
import { useVirtualRenderPipeline } from '../hooks/use-render-pipeline'
import { useVirtualScroll } from '../hooks/use-scroll'
import { virtualizedGridProps } from '../props'
import {
  estimateVirtualItemSize,
  getLogicalRTLScrollLeft,
  getScrollDir,
  getVirtualRange,
  isRTL,
  setLogicalRTLScrollLeft,
} from '../utils'
import {
  AUTO_ALIGNMENT,
  DEFAULT_DYNAMIC_LIST_ITEM_SIZE,
  FORWARD,
  ITEM_RENDER_EVT,
  RTL,
  SCROLL_EVT,
} from '../defaults'
import type {
  CSSProperties,
  Ref,
  StyleValue,
  UnwrapRef,
  VNode,
  VNodeChild,
} from 'vue'
import type {
  Alignment,
  GridConstructorProps,
  GridScrollOptions,
  ScrollbarExpose,
} from '../types'
import type { VirtualizedGridProps } from '../props'

const createGrid = ({
  name,
  getColumnPosition,
  getColumnStartIndexForOffset,
  getColumnStopIndexForStartIndex,
  getEstimatedTotalHeight,
  getEstimatedTotalWidth,
  getColumnOffset,
  getRowOffset,
  getRowPosition,
  getRowStartIndexForOffset,
  getRowStopIndexForStartIndex,

  initCache,
  injectToInstance,
  validateProps,
}: GridConstructorProps<VirtualizedGridProps>) => {
  return defineComponent({
    name: name ?? 'ElVirtualList',
    props: virtualizedGridProps,
    emits: [ITEM_RENDER_EVT, SCROLL_EVT],
    setup(props, { emit, expose, slots }) {
      const ns = useNamespace('vl')
      const motionRuntime = useFsusMotionRuntime()
      const renderPipelineConfig = useGlobalConfig('renderPipeline')

      validateProps(props)
      const instance = getCurrentInstance()!
      const cache = ref(initCache(props, instance))
      injectToInstance?.(instance, cache)
      // refs
      // here windowRef and innerRef can be type of HTMLElement
      // or user defined component type, depends on the type passed
      // by user
      const windowRef = ref<HTMLElement>()
      const wrapperRef = ref<HTMLElement>()
      const hScrollbar = ref<ScrollbarExpose>()
      const vScrollbar = ref<ScrollbarExpose>()
      // innerRef is the actual container element which contains all the elements
      const innerRef = ref(null)
      const states = ref({
        isScrolling: false,
        isScrollbarDragging: false,
        isScrollMotionX: false,
        isScrollMotionY: false,
        scrollLeft: isNumber(props.initScrollLeft) ? props.initScrollLeft : 0,
        scrollTop: isNumber(props.initScrollTop) ? props.initScrollTop : 0,
        updateRequested: false,
        xAxisScrollDir: FORWARD,
        yAxisScrollDir: FORWARD,
      })

      const getItemStyleCache = useCache()

      // computed
      const parsedHeight = computed(() =>
        Number.parseInt(`${props.height}`, 10),
      )
      const parsedWidth = computed(() => Number.parseInt(`${props.width}`, 10))

      const {
        runtime: renderPipelineRuntime,
        resolveCache,
        resolveHardwareAttrs,
      } = useVirtualRenderPipeline({
        componentName: name ?? 'ElVirtualGrid',
        config: renderPipelineConfig,
        estimate: computed(() => ({
          items: (props.totalColumn ?? 0) * (props.totalRow ?? 0),
          nodes: (props.totalColumn ?? 0) * (props.totalRow ?? 0),
        })),
        source: computed(() => ({
          totalColumn: props.totalColumn ?? 0,
          totalRow: props.totalRow ?? 0,
        })),
      })
      const renderPipelineStrategy = renderPipelineRuntime.strategy
      const effectiveColumnCache = computed(() =>
        resolveCache(
          estimateVirtualItemSize(
            props.estimatedColumnWidth,
            props.columnWidth,
          ),
          props.columnCache,
        ),
      )
      const effectiveRowCache = computed(() =>
        resolveCache(
          estimateVirtualItemSize(props.estimatedRowHeight, props.rowHeight),
          props.rowCache,
        ),
      )

      const columnsToRender = computed(() => {
        const { totalColumn, totalRow } = props
        const { isScrolling, xAxisScrollDir, scrollLeft } = unref(states)

        if (totalColumn === 0 || totalRow === 0) {
          return [0, 0, 0, 0]
        }

        const startIndex = getColumnStartIndexForOffset(
          props,
          scrollLeft,
          unref(cache),
        )
        const stopIndex = getColumnStopIndexForStartIndex(
          props,
          startIndex,
          scrollLeft,
          unref(cache),
        )

        return getVirtualRange(
          startIndex,
          stopIndex,
          totalColumn!,
          effectiveColumnCache.value,
          isScrolling,
          xAxisScrollDir,
        )
      })

      const rowsToRender = computed(() => {
        const { totalColumn, totalRow } = props
        const { isScrolling, yAxisScrollDir, scrollTop } = unref(states)

        if (totalColumn === 0 || totalRow === 0) {
          return [0, 0, 0, 0]
        }

        const startIndex = getRowStartIndexForOffset(
          props,
          scrollTop,
          unref(cache),
        )
        const stopIndex = getRowStopIndexForStartIndex(
          props,
          startIndex,
          scrollTop,
          unref(cache),
        )

        return getVirtualRange(
          startIndex,
          stopIndex,
          totalRow!,
          effectiveRowCache.value,
          isScrolling,
          yAxisScrollDir,
        )
      })

      const renderPipelineHardwareAttrs = computed(() => {
        const [columnStart, columnEnd] = columnsToRender.value
        const [rowStart, rowEnd] = rowsToRender.value
        const renderedColumnCount =
          columnEnd >= columnStart ? columnEnd - columnStart + 1 : 0
        const renderedRowCount = rowEnd >= rowStart ? rowEnd - rowStart + 1 : 0
        const columnWidth = isNumber(props.columnWidth)
          ? props.columnWidth
          : DEFAULT_DYNAMIC_LIST_ITEM_SIZE
        const rowHeight = isNumber(props.rowHeight)
          ? props.rowHeight
          : DEFAULT_DYNAMIC_LIST_ITEM_SIZE
        const unitArea = columnWidth * rowHeight
        const renderedCount = renderedColumnCount * renderedRowCount
        return resolveHardwareAttrs(renderedCount, unitArea)
      })

      const estimatedTotalHeight = computed(() =>
        getEstimatedTotalHeight(props, unref(cache)),
      )
      const estimatedTotalWidth = computed(() =>
        getEstimatedTotalWidth(props, unref(cache)),
      )

      const windowStyle = computed<StyleValue>(() => [
        {
          position: 'relative',
          overflow: 'hidden',
          WebkitOverflowScrolling: 'touch',
          willChange:
            renderPipelineRuntime.compositor.value &&
            (states.value.isScrollMotionX || states.value.isScrollMotionY)
              ? 'transform'
              : undefined,
        },
        {
          direction: props.direction,
          height: isNumber(props.height) ? `${props.height}px` : props.height,
          width: isNumber(props.width) ? `${props.width}px` : props.width,
        },
        props.style ?? {},
      ])

      const innerStyle = computed(() => {
        const width = `${unref(estimatedTotalWidth)}px`
        const height = `${unref(estimatedTotalHeight)}px`

        return {
          height,
          pointerEvents: unref(states).isScrolling ? 'none' : undefined,
          width,
        }
      })

      // methods
      const emitEvents = () => {
        const { totalColumn, totalRow } = props

        if (totalColumn! > 0 && totalRow! > 0) {
          const [
            columnCacheStart,
            columnCacheEnd,
            columnVisibleStart,
            columnVisibleEnd,
          ] = unref(columnsToRender)
          const [rowCacheStart, rowCacheEnd, rowVisibleStart, rowVisibleEnd] =
            unref(rowsToRender)
          // emit the render item event with
          // [xAxisInvisibleStart, xAxisInvisibleEnd, xAxisVisibleStart, xAxisVisibleEnd]
          // [yAxisInvisibleStart, yAxisInvisibleEnd, yAxisVisibleStart, yAxisVisibleEnd]
          emit(ITEM_RENDER_EVT, {
            columnCacheStart,
            columnCacheEnd,
            rowCacheStart,
            rowCacheEnd,
            columnVisibleStart,
            columnVisibleEnd,
            rowVisibleStart,
            rowVisibleEnd,
          })
        }

        const {
          scrollLeft,
          scrollTop,
          updateRequested,
          xAxisScrollDir,
          yAxisScrollDir,
        } = unref(states)
        emit(SCROLL_EVT, {
          xAxisScrollDir,
          scrollLeft,
          yAxisScrollDir,
          scrollTop,
          updateRequested,
        })
      }

      const flushScroll = (element: HTMLElement) => {
        const {
          clientHeight,
          clientWidth,
          scrollHeight,
          scrollLeft,
          scrollTop,
          scrollWidth,
        } = element

        const _states = unref(states)

        if (
          _states.scrollTop === scrollTop &&
          _states.scrollLeft === scrollLeft
        ) {
          return
        }

        const nextScrollLeft = isRTL(props.direction)
          ? getLogicalRTLScrollLeft(scrollLeft, scrollWidth, clientWidth)
          : scrollLeft
        const nextScrollTop = Math.max(
          0,
          Math.min(scrollTop, scrollHeight - clientHeight),
        )
        const isScrollingX = _states.scrollLeft !== nextScrollLeft
        const isScrollingY = _states.scrollTop !== nextScrollTop
        const deltaX = nextScrollLeft - _states.scrollLeft
        const deltaY = nextScrollTop - _states.scrollTop

        _states.isScrolling = true
        _states.xAxisScrollDir = getScrollDir(
          _states.scrollLeft,
          nextScrollLeft,
        )
        _states.yAxisScrollDir = getScrollDir(_states.scrollTop, nextScrollTop)
        _states.scrollLeft = nextScrollLeft
        _states.scrollTop = nextScrollTop
        _states.updateRequested = true

        scheduleResetIsScrolling()
        triggerScrollMotion(deltaX, deltaY, isScrollingX, isScrollingY)

        onUpdated()
        emitEvents()
      }

      const onVerticalScroll = (distance: number, totalSteps: number) => {
        if (!Number.isFinite(totalSteps) || totalSteps <= 0) return
        const height = unref(parsedHeight)
        const offset =
          ((estimatedTotalHeight.value - height) / totalSteps) * distance
        scrollTo({
          scrollTop: Math.min(estimatedTotalHeight.value - height, offset),
        })
      }

      const onHorizontalScroll = (distance: number, totalSteps: number) => {
        if (!Number.isFinite(totalSteps) || totalSteps <= 0) return
        const width = unref(parsedWidth)
        const offset =
          ((estimatedTotalWidth.value - width) / totalSteps) * distance
        scrollTo({
          scrollLeft: Math.min(estimatedTotalWidth.value - width, offset),
        })
      }

      const { onWheel } = useGridWheel(
        {
          atXStartEdge: computed(() => states.value.scrollLeft <= 0),
          atXEndEdge: computed(
            () =>
              states.value.scrollLeft >=
              estimatedTotalWidth.value - unref(parsedWidth),
          ),
          atYStartEdge: computed(() => states.value.scrollTop <= 0),
          atYEndEdge: computed(
            () =>
              states.value.scrollTop >=
              estimatedTotalHeight.value - unref(parsedHeight),
          ),
        },
        (x: number, y: number) => {
          hScrollbar.value?.onMouseUp?.()
          vScrollbar.value?.onMouseUp?.()
          const width = unref(parsedWidth)
          const height = unref(parsedHeight)
          scrollTo({
            scrollLeft: Math.min(
              states.value.scrollLeft + x,
              estimatedTotalWidth.value - width,
            ),
            scrollTop: Math.min(
              states.value.scrollTop + y,
              estimatedTotalHeight.value - height,
            ),
          })
        },
      )

      const scrollTo = ({
        scrollLeft = states.value.scrollLeft,
        scrollTop = states.value.scrollTop,
      }: GridScrollOptions) => {
        scrollLeft = Math.max(scrollLeft, 0)
        scrollTop = Math.max(scrollTop, 0)
        const _states = unref(states)
        if (
          scrollTop === _states.scrollTop &&
          scrollLeft === _states.scrollLeft
        ) {
          return
        }

        const isScrollingX = _states.scrollLeft !== scrollLeft
        const isScrollingY = _states.scrollTop !== scrollTop
        const deltaX = scrollLeft - _states.scrollLeft
        const deltaY = scrollTop - _states.scrollTop

        _states.isScrolling = true
        _states.xAxisScrollDir = getScrollDir(_states.scrollLeft, scrollLeft)
        _states.yAxisScrollDir = getScrollDir(_states.scrollTop, scrollTop)
        _states.scrollLeft = scrollLeft
        _states.scrollTop = scrollTop
        _states.updateRequested = true

        scheduleResetIsScrolling()
        triggerScrollMotion(deltaX, deltaY, isScrollingX, isScrollingY)

        onUpdated()
        emitEvents()
      }

      const scrollToItem = (
        rowIndex = 0,
        columnIdx = 0,
        alignment: Alignment = AUTO_ALIGNMENT,
      ) => {
        const _states = unref(states)
        columnIdx = Math.max(0, Math.min(columnIdx, props.totalColumn! - 1))
        rowIndex = Math.max(0, Math.min(rowIndex, props.totalRow! - 1))
        const scrollBarWidth = getScrollBarWidth(ns.namespace.value)

        const _cache = unref(cache)
        const estimatedHeight = getEstimatedTotalHeight(props, _cache)
        const estimatedWidth = getEstimatedTotalWidth(props, _cache)

        scrollTo({
          scrollLeft: getColumnOffset(
            props,
            columnIdx,
            alignment,
            _states.scrollLeft,
            _cache,
            estimatedWidth > (Number(props.width) || 0) ? scrollBarWidth : 0,
          ),
          scrollTop: getRowOffset(
            props,
            rowIndex,
            alignment,
            _states.scrollTop,
            _cache,
            estimatedHeight > (Number(props.height) || 0) ? scrollBarWidth : 0,
          ),
        })
      }

      const getItemStyle = (
        rowIndex: number,
        columnIndex: number,
      ): CSSProperties => {
        const { columnWidth, direction, rowHeight } = props
        const itemStyleCache = getItemStyleCache.value(
          columnWidth,
          rowHeight,
          direction,
        )
        // since there was no need to introduce an nested array into cache object
        // we use row,column to construct the key for indexing the map.
        const key = `${rowIndex},${columnIndex}`

        if (hasOwn(itemStyleCache, key)) {
          return itemStyleCache[key]
        } else {
          const [, left] = getColumnPosition(props, columnIndex, unref(cache))
          const _cache = unref(cache)

          const rtl = isRTL(direction)
          const [height, top] = getRowPosition(props, rowIndex, _cache)
          const [width] = getColumnPosition(props, columnIndex, _cache)

          itemStyleCache[key] = {
            position: 'absolute',
            left: rtl ? undefined : `${left}px`,
            right: rtl ? `${left}px` : undefined,
            top: `${top}px`,
            height: `${height}px`,
            width: `${width}px`,
          }

          return itemStyleCache[key]
        }
      }

      let lastScrollMotionClass = ''

      const syncScrollMotionClasses = (active: boolean) => {
        const wrapper = wrapperRef.value
        if (!wrapper) return
        const nextClass = active
          ? `${states.value.isScrollMotionX}:${states.value.xAxisScrollDir}:${states.value.isScrollMotionY}:${states.value.yAxisScrollDir}`
          : ''
        if (nextClass === lastScrollMotionClass) return
        lastScrollMotionClass = nextClass

        wrapper.classList.remove(
          ns.is('scrolling'),
          ns.is('scrolling-x'),
          ns.is('scrolling-y'),
          ns.is('scrolling-x-forward'),
          ns.is('scrolling-x-backward'),
          ns.is('scrolling-y-forward'),
          ns.is('scrolling-y-backward'),
        )
        if (!active) return

        wrapper.classList.add(ns.is('scrolling'))
        if (states.value.isScrollMotionX) {
          wrapper.classList.add(
            ns.is('scrolling-x'),
            ns.is(`scrolling-x-${states.value.xAxisScrollDir}`),
          )
        }
        if (states.value.isScrollMotionY) {
          wrapper.classList.add(
            ns.is('scrolling-y'),
            ns.is(`scrolling-y-${states.value.yAxisScrollDir}`),
          )
        }
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
        setScrollMotion: (active, x, y) => {
          if (!active || x) states.value.isScrollMotionX = active
          if (!active || y) states.value.isScrollMotionY = active
        },
        syncScrollMotionClasses,
      })

      // life cycles
      onMounted(() => {
        // for SSR
        if (!isClient) return
        const { initScrollLeft, initScrollTop } = props
        const windowElement = unref(windowRef)
        if (windowElement) {
          if (isNumber(initScrollLeft)) {
            windowElement.scrollLeft = initScrollLeft
          }
          if (isNumber(initScrollTop)) {
            windowElement.scrollTop = initScrollTop
          }
        }
        emitEvents()
      })

      const onUpdated = () => {
        const { direction } = props
        const { scrollLeft, scrollTop, updateRequested } = unref(states)

        const windowElement = unref(windowRef)
        if (updateRequested && windowElement) {
          if (direction === RTL) {
            setLogicalRTLScrollLeft(windowElement, scrollLeft)
          } else {
            windowElement.scrollLeft = Math.max(0, scrollLeft)
          }

          windowElement.scrollTop = Math.max(0, scrollTop)
        }
      }

      const { resetAfterColumnIndex, resetAfterRowIndex, resetAfter } =
        instance.proxy as any

      expose({
        windowRef,
        wrapperRef,
        innerRef,
        getItemStyleCache,
        scrollTo,
        scrollToItem,
        states,
        resetAfterColumnIndex,
        resetAfterRowIndex,
        resetAfter,
      })

      // rendering part

      const renderScrollbars = () => {
        const {
          scrollbarAlwaysOn,
          scrollbarStartGap,
          scrollbarEndGap,
          totalColumn,
          totalRow,
        } = props

        const width = unref(parsedWidth)
        const height = unref(parsedHeight)
        const estimatedWidth = unref(estimatedTotalWidth)
        const estimatedHeight = unref(estimatedTotalHeight)
        const { isScrollMotionX, isScrollMotionY, scrollLeft, scrollTop } =
          unref(states)
        const horizontalScrollbar = h(Scrollbar, {
          ref: hScrollbar,
          alwaysOn: scrollbarAlwaysOn,
          startGap: scrollbarStartGap,
          endGap: scrollbarEndGap,
          class: `${ns.e('horizontal')} ${
            isScrollMotionX ? ns.is('scrolling') : ''
          }`,
          clientSize: width,
          layout: 'horizontal',
          onStartMove: onScrollbarStartMove,
          onStopMove: onScrollbarStopMove,
          onScroll: onHorizontalScroll,
          ratio: (width * 100) / estimatedWidth,
          scrollFrom: scrollLeft / (estimatedWidth - width),
          total: totalRow,
          visible: true,
        })

        const verticalScrollbar = h(Scrollbar, {
          ref: vScrollbar,
          alwaysOn: scrollbarAlwaysOn,
          startGap: scrollbarStartGap,
          endGap: scrollbarEndGap,
          class: `${ns.e('vertical')} ${
            isScrollMotionY ? ns.is('scrolling') : ''
          }`,
          clientSize: height,
          layout: 'vertical',
          onStartMove: onScrollbarStartMove,
          onStopMove: onScrollbarStopMove,
          onScroll: onVerticalScroll,
          ratio: (height * 100) / estimatedHeight,
          scrollFrom: scrollTop / (estimatedHeight - height),

          total: totalColumn,
          visible: true,
        })

        return {
          horizontalScrollbar,
          verticalScrollbar,
        }
      }

      const renderItems = () => {
        const [columnStart, columnEnd] = unref(columnsToRender)
        const [rowStart, rowEnd] = unref(rowsToRender)
        const { data, totalColumn, totalRow, useIsScrolling, itemKey } = props
        const children: VNodeChild[] = []
        if (totalRow > 0 && totalColumn > 0) {
          for (let row = rowStart; row <= rowEnd; row++) {
            for (let column = columnStart; column <= columnEnd; column++) {
              children.push(
                slots.default?.({
                  columnIndex: column,
                  data,
                  key: itemKey({ columnIndex: column, data, rowIndex: row }),
                  isScrolling: useIsScrolling
                    ? unref(states).isScrolling
                    : undefined,
                  style: getItemStyle(row, column),
                  rowIndex: row,
                }),
              )
            }
          }
        }
        return children
      }

      const renderInner = () => {
        const Inner = resolveDynamicComponent(props.innerElement) as VNode
        const children = renderItems()
        return [
          h(
            Inner,
            {
              class: ns.e('inner'),
              style: unref(innerStyle),
              ref: innerRef,
            },
            !isString(Inner)
              ? {
                  default: () => children,
                }
              : children,
          ),
        ]
      }

      const renderWindow = () => {
        const Container = resolveDynamicComponent(
          props.containerElement,
        ) as VNode
        const { horizontalScrollbar, verticalScrollbar } = renderScrollbars()
        const Inner = renderInner()
        const {
          isScrollMotionX,
          isScrollMotionY,
          xAxisScrollDir,
          yAxisScrollDir,
        } = unref(states)

        return h(
          'div',
          {
            key: 0,
            class: [
              ns.e('wrapper'),
              ns.is('scrolling', isScrollMotionX || isScrollMotionY),
              ns.is('fast-scrolling', states.value.isScrolling),
              ns.is('scrolling-x', isScrollMotionX),
              ns.is('scrolling-y', isScrollMotionY),
              isScrollMotionX ? ns.is(`scrolling-x-${xAxisScrollDir}`) : '',
              isScrollMotionY ? ns.is(`scrolling-y-${yAxisScrollDir}`) : '',
            ],
            'data-fsus-render-column-cache': effectiveColumnCache.value,
            ...renderPipelineHardwareAttrs.value,
            'data-fsus-render-items':
              (props.totalColumn ?? 0) * (props.totalRow ?? 0),
            'data-fsus-render-pipeline': 'virtual-grid',
            'data-fsus-render-row-cache': effectiveRowCache.value,
            'data-fsus-render-strategy': renderPipelineStrategy.value,
            role: props.role,
            ref: wrapperRef,
          },
          [
            h(
              Container,
              {
                class: [ns.e('window'), props.className],
                ...renderPipelineHardwareAttrs.value,
                style: unref(windowStyle),
                onScroll,
                onScrollend: onScrollEnd,
                onWheel,
                ref: windowRef,
              },
              !isString(Container) ? { default: () => Inner } : Inner,
            ),
            horizontalScrollbar,
            verticalScrollbar,
          ],
        )
      }

      return renderWindow
    },
  })
}

export default createGrid

type Dir = ReturnType<typeof getScrollDir>

export type GridInstance = InstanceType<ReturnType<typeof createGrid>> &
  UnwrapRef<{
    windowRef: Ref<HTMLElement>
    wrapperRef: Ref<HTMLElement>
    innerRef: Ref<HTMLElement>
    getItemStyleCache: ReturnType<typeof useCache>
    scrollTo: (scrollOptions: GridScrollOptions) => void
    scrollToItem: (
      rowIndex: number,
      columnIndex: number,
      alignment: Alignment,
    ) => void
    states: Ref<{
      isScrolling: boolean
      isScrollbarDragging: boolean
      isScrollMotionX: boolean
      isScrollMotionY: boolean
      scrollLeft: number
      scrollTop: number
      updateRequested: boolean
      xAxisScrollDir: Dir
      yAxisScrollDir: Dir
    }>
  }>
