// @ts-nocheck
import {
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  onBeforeUnmount,
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
import {
  applyFsusInteractiveMotionVars,
  resolveFsusInteractiveMotion,
  resolveFsusRenderPipelineCache,
  useFsusRenderPipelineRuntime,
  useFsusMotionRuntime,
  useNamespace,
} from '@element-plus/hooks'
import { useGlobalConfig } from '@element-plus/components/config-provider'
import Scrollbar from '../components/scrollbar'
import { useGridWheel } from '../hooks/use-grid-wheel'
import { useCache } from '../hooks/use-cache'
import { virtualizedGridProps } from '../props'
import { getRTLOffsetType, getScrollDir, isRTL } from '../utils'
import {
  AUTO_ALIGNMENT,
  BACKWARD,
  DEFAULT_DYNAMIC_LIST_ITEM_SIZE,
  FORWARD,
  ITEM_RENDER_EVT,
  RTL,
  RTL_OFFSET_NAG,
  RTL_OFFSET_POS_ASC,
  RTL_OFFSET_POS_DESC,
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

const SCROLL_MOTION_IDLE_MS = 320

const createGrid = ({
  name,
  clearCache,
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
      let resetFrame = 0

      // computed
      const parsedHeight = computed(() =>
        Number.parseInt(`${props.height}`, 10),
      )
      const parsedWidth = computed(() => Number.parseInt(`${props.width}`, 10))

      const renderPipelineRuntime = useFsusRenderPipelineRuntime({
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
      const resolvedRenderPipelineConfig = renderPipelineRuntime.config
      const renderPipelineHardwareAttrs = renderPipelineRuntime.hardwareAttrs

      const estimatedColumnPixelSize = computed(() =>
        Math.max(
          1,
          props.estimatedColumnWidth ??
            (isNumber(props.columnWidth)
              ? props.columnWidth
              : DEFAULT_DYNAMIC_LIST_ITEM_SIZE),
        ),
      )

      const estimatedRowPixelSize = computed(() =>
        Math.max(
          1,
          props.estimatedRowHeight ??
            (isNumber(props.rowHeight)
              ? props.rowHeight
              : DEFAULT_DYNAMIC_LIST_ITEM_SIZE),
        ),
      )

      const renderPipelineStrategy = renderPipelineRuntime.strategy

      const effectiveColumnCache = computed(() =>
        resolveFsusRenderPipelineCache({
          budgeted: renderPipelineConfig.value !== undefined,
          config: resolvedRenderPipelineConfig.value,
          estimatedItemSize: estimatedColumnPixelSize.value,
          explicitCache: props.columnCache,
          strategy: renderPipelineStrategy.value,
        }),
      )

      const effectiveRowCache = computed(() =>
        resolveFsusRenderPipelineCache({
          budgeted: renderPipelineConfig.value !== undefined,
          config: resolvedRenderPipelineConfig.value,
          estimatedItemSize: estimatedRowPixelSize.value,
          explicitCache: props.rowCache,
          strategy: renderPipelineStrategy.value,
        }),
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

        const columnCache = effectiveColumnCache.value
        const cacheBackward =
          !isScrolling || xAxisScrollDir === BACKWARD
            ? Math.max(1, columnCache)
            : 1
        const cacheForward =
          !isScrolling || xAxisScrollDir === FORWARD
            ? Math.max(1, columnCache)
            : 1

        return [
          Math.max(0, startIndex - cacheBackward),
          Math.max(0, Math.min(totalColumn! - 1, stopIndex + cacheForward)),
          startIndex,
          stopIndex,
        ]
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

        const rowCache = effectiveRowCache.value
        const cacheBackward =
          !isScrolling || yAxisScrollDir === BACKWARD
            ? Math.max(1, rowCache)
            : 1
        const cacheForward =
          !isScrolling || yAxisScrollDir === FORWARD ? Math.max(1, rowCache) : 1

        return [
          Math.max(0, startIndex - cacheBackward),
          Math.max(0, Math.min(totalRow! - 1, stopIndex + cacheForward)),
          startIndex,
          stopIndex,
        ]
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

      const onScroll = (e: Event) => {
        const {
          clientHeight,
          clientWidth,
          scrollHeight,
          scrollLeft,
          scrollTop,
          scrollWidth,
        } = e.currentTarget as HTMLElement

        const _states = unref(states)

        if (
          _states.scrollTop === scrollTop &&
          _states.scrollLeft === scrollLeft
        ) {
          return
        }

        let _scrollLeft = scrollLeft

        if (isRTL(props.direction)) {
          switch (getRTLOffsetType()) {
            case RTL_OFFSET_NAG:
              _scrollLeft = -scrollLeft
              break
            case RTL_OFFSET_POS_DESC:
              _scrollLeft = scrollWidth - clientWidth - scrollLeft
              break
          }
        }

        const nextScrollTop = Math.max(
          0,
          Math.min(scrollTop, scrollHeight - clientHeight),
        )
        const isScrollingX = _states.scrollLeft !== _scrollLeft
        const isScrollingY = _states.scrollTop !== nextScrollTop
        const deltaX = _scrollLeft - _states.scrollLeft
        const deltaY = nextScrollTop - _states.scrollTop

        states.value = {
          ..._states,
          isScrolling: true,
          scrollLeft: _scrollLeft,
          scrollTop: nextScrollTop,
          updateRequested: true,
          xAxisScrollDir: getScrollDir(_states.scrollLeft, _scrollLeft),
          yAxisScrollDir: getScrollDir(_states.scrollTop, nextScrollTop),
        }

        scheduleResetIsScrolling()
        triggerScrollMotion(isScrollingX, isScrollingY, deltaX, deltaY)

        onUpdated()
        emitEvents()
      }

      const onVerticalScroll = (distance: number, totalSteps: number) => {
        const height = unref(parsedHeight)
        const offset =
          ((estimatedTotalHeight.value - height) / totalSteps) * distance
        scrollTo({
          scrollTop: Math.min(estimatedTotalHeight.value - height, offset),
        })
      }

      const onHorizontalScroll = (distance: number, totalSteps: number) => {
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

        states.value = {
          ..._states,
          isScrolling: true,
          xAxisScrollDir: getScrollDir(_states.scrollLeft, scrollLeft),
          yAxisScrollDir: getScrollDir(_states.scrollTop, scrollTop),
          scrollLeft,
          scrollTop,
          updateRequested: true,
        }

        scheduleResetIsScrolling()
        triggerScrollMotion(isScrollingX, isScrollingY, deltaX, deltaY)

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
            estimatedWidth > props.width! ? scrollBarWidth : 0,
          ),
          scrollTop: getRowOffset(
            props,
            rowIndex,
            alignment,
            _states.scrollTop,
            _cache,
            estimatedHeight > props.height! ? scrollBarWidth : 0,
          ),
        })
      }

      const getItemStyle = (
        rowIndex: number,
        columnIndex: number,
      ): CSSProperties => {
        const { columnWidth, direction, rowHeight } = props
        const itemStyleCache = getItemStyleCache.value(
          clearCache && columnWidth,
          clearCache && rowHeight,
          clearCache && direction,
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

      // TODO: debounce setting is scrolling.
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
        states.value.isScrollMotionX = false
        states.value.isScrollMotionY = false
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

      const triggerScrollMotion = (
        x: boolean,
        y: boolean,
        deltaX = 0,
        deltaY = 0,
      ) => {
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
        if (x) states.value.isScrollMotionX = true
        if (y) states.value.isScrollMotionY = true
        syncScrollMotionClasses(true)
        scheduleScrollMotionEnd()
      }

      const resetIsScrolling = () => {
        resetFrame = 0
        states.value.isScrolling = false
        getItemStyleCache.value(-1, null, null)
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

      onBeforeUnmount(() => {
        if (resetFrame) {
          cancelAnimationFrame(resetFrame)
          resetFrame = 0
        }
        clearScrollMotionSchedule()
      })

      const onUpdated = () => {
        const { direction } = props
        const { scrollLeft, scrollTop, updateRequested } = unref(states)

        const windowElement = unref(windowRef)
        if (updateRequested && windowElement) {
          if (direction === RTL) {
            switch (getRTLOffsetType()) {
              case RTL_OFFSET_NAG: {
                windowElement.scrollLeft = -scrollLeft
                break
              }
              case RTL_OFFSET_POS_ASC: {
                windowElement.scrollLeft = scrollLeft
                break
              }
              default: {
                const { clientWidth, scrollWidth } = windowElement
                windowElement.scrollLeft =
                  scrollWidth - clientWidth - scrollLeft
                break
              }
            }
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

type Dir = typeof FORWARD | typeof BACKWARD

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
