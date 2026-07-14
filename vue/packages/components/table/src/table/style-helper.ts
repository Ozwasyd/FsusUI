// @ts-nocheck
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  unref,
  watch,
  watchEffect,
} from 'vue'
import {
  useEventListener,
  useResizeObserver,
} from '@element-plus/hooks/use-runtime'
import { useFormSize } from '@element-plus/components/form'
import { debugWarn } from '@element-plus/utils'

import type { Table, TableProps } from './defaults'
import type { Store } from '../store'
import type TableLayout from '../table-layout'
import type { TableColumnCtx } from '../table-column/defaults'

function useStyle<T>(
  props: TableProps<T>,
  layout: TableLayout<T>,
  store: Store<T>,
  table: Table<T>,
) {
  const isHidden = ref(false)
  const renderExpanded = ref(null)
  const resizeProxyVisible = ref(false)
  const setDragVisible = (visible: boolean) => {
    resizeProxyVisible.value = visible
  }
  const resizeState = ref<{
    width: null | number
    height: null | number
    headerHeight: null | number
  }>({
    width: null,
    height: null,
    headerHeight: null,
  })
  const isGroup = ref(false)
  const scrollbarViewStyle = {
    display: 'inline-block',
    verticalAlign: 'middle',
  }
  const tableWidth = ref()
  const tableScrollHeight = ref(0)
  const bodyScrollHeight = ref(0)
  const headerScrollHeight = ref(0)
  const footerScrollHeight = ref(0)
  const appendScrollHeight = ref(0)
  let layoutFrame = 0
  let syncPositionFrame = 0
  let wheelScrollFrame = 0
  let pendingWheelScrollLeft = 0
  let pendingWheelScrollTop = 0

  const cancelFrame = (frame: number) => {
    if (frame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(frame)
    }
  }

  const scheduleFrame = (
    currentFrame: number,
    callback: () => void,
    setFrame: (frame: number) => void,
  ) => {
    cancelFrame(currentFrame)

    if (typeof requestAnimationFrame !== 'function') {
      callback()
      setFrame(0)
      return
    }

    const nextFrame = requestAnimationFrame(() => {
      setFrame(0)
      callback()
    })
    setFrame(nextFrame)
  }

  const scheduleLayoutFrame = () => {
    scheduleFrame(layoutFrame, doLayout, (frame) => {
      layoutFrame = frame
    })
  }

  const scheduleSyncPositionFrame = () => {
    scheduleFrame(syncPositionFrame, syncPosition, (frame) => {
      syncPositionFrame = frame
    })
  }

  onBeforeUnmount(() => {
    cancelFrame(layoutFrame)
    cancelFrame(syncPositionFrame)
    cancelFrame(wheelScrollFrame)
    layoutFrame = 0
    syncPositionFrame = 0
    wheelScrollFrame = 0
    pendingWheelScrollLeft = 0
    pendingWheelScrollTop = 0
  })

  watchEffect(() => {
    layout.setHeight(props.height)
  })
  watchEffect(() => {
    layout.setMaxHeight(props.maxHeight)
  })
  watch(
    () => [props.currentRowKey, store.states.rowKey],
    ([currentRowKey, rowKey]) => {
      if (!unref(rowKey) || !unref(currentRowKey)) return
      store.setCurrentRowKey(`${currentRowKey}`)
    },
    {
      immediate: true,
    },
  )
  let stopDataWatch: (() => void) | null = null
  let warnedLargeDeepData = false
  const largeDataDiagnosticSize = () => {
    const cores =
      typeof navigator === 'undefined' ? 2 : navigator.hardwareConcurrency || 2
    const memory =
      typeof navigator === 'undefined'
        ? 4
        : ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ??
          4)
    return Math.max(1_000, Math.round(cores * memory * 500))
  }
  const commitData = (reason: string) => {
    table.store.commit('setData', props.data, {
      reason,
      strategy: props.dataChangeStrategy,
    })
    if (
      !warnedLargeDeepData &&
      props.dataChangeStrategy === 'deep' &&
      (props.data?.length ?? 0) >= largeDataDiagnosticSize() &&
      process.env.NODE_ENV !== 'production'
    ) {
      warnedLargeDeepData = true
      debugWarn(
        'ElTable',
        `deep data tracking is active for ${props.data.length} rows on this device. Prefer data-change-strategy="identity" or an explicit data-version.`,
      )
    }
  }
  const installDataWatch = () => {
    stopDataWatch?.()
    const strategy = props.dataChangeStrategy
    if (strategy === 'manual') {
      commitData('data-manual-init')
      stopDataWatch = null
      return
    }
    const source =
      strategy === 'version' ? () => props.dataVersion : () => props.data
    stopDataWatch = watch(source, () => commitData(`data-${strategy}`), {
      deep: strategy === 'deep',
      immediate: true,
    })
  }
  watch(() => props.dataChangeStrategy, installDataWatch, { immediate: true })
  const refreshData = () => commitData('data-manual')

  onBeforeUnmount(() => {
    stopDataWatch?.()
    stopDataWatch = null
  })
  watchEffect(() => {
    if (props.expandRowKeys) {
      store.setExpandRowKeysAdapter(props.expandRowKeys)
    }
  })

  const handleMouseLeave = () => {
    table.store.commit('setHoverRow', null)
    if (table.hoverState) table.hoverState = null
  }

  const flushWheelScroll = () => {
    wheelScrollFrame = 0
    const bodyWrapper = table.refs.bodyWrapper
    if (!bodyWrapper) {
      pendingWheelScrollLeft = 0
      pendingWheelScrollTop = 0
      return
    }

    const deltaLeft = pendingWheelScrollLeft
    const deltaTop = pendingWheelScrollTop
    pendingWheelScrollLeft = 0
    pendingWheelScrollTop = 0

    if (deltaLeft) {
      bodyWrapper.scrollLeft += deltaLeft
    }
    if (deltaTop) {
      bodyWrapper.scrollTop += deltaTop
    }
    if (deltaLeft || deltaTop) {
      scheduleSyncPositionFrame()
    }
  }

  const scheduleWheelScroll = (deltaLeft = 0, deltaTop = 0) => {
    pendingWheelScrollLeft += deltaLeft
    pendingWheelScrollTop += deltaTop
    if (wheelScrollFrame) return

    if (typeof requestAnimationFrame !== 'function') {
      flushWheelScroll()
      return
    }

    wheelScrollFrame = requestAnimationFrame(flushWheelScroll)
  }

  const handleHeaderFooterMousewheel = (event, data) => {
    const { pixelX, pixelY } = data
    if (Math.abs(pixelX) >= Math.abs(pixelY)) {
      scheduleWheelScroll(data.pixelX / 5, 0)
    }
  }

  const shouldUpdateHeight = computed(() => {
    return (
      props.height ||
      props.maxHeight ||
      store.states.fixedColumns.value.length > 0 ||
      store.states.rightFixedColumns.value.length > 0
    )
  })

  const tableBodyStyles = computed(() => {
    return {
      width: layout.bodyWidth.value ? `${layout.bodyWidth.value}px` : '',
    }
  })

  const doLayout = () => {
    if (shouldUpdateHeight.value) {
      layout.updateElsHeight()
    }
    layout.updateColumnsWidth()
    scheduleSyncPositionFrame()
  }
  onMounted(async () => {
    await nextTick()
    store.updateColumns()
    bindEvents()
    store.recordLayoutReason('container-resize')
    scheduleLayoutFrame()

    const el: HTMLElement = table.vnode.el as HTMLElement
    const tableHeader: HTMLElement = table.refs.headerWrapper
    if (props.flexible && el && el.parentElement) {
      // Automatic minimum size of flex-items
      // Ensure that the main axis does not follow the width of the items
      el.parentElement.style.minWidth = '0'
    }

    resizeState.value = {
      width: (tableWidth.value = el.offsetWidth),
      height: el.offsetHeight,
      headerHeight:
        props.showHeader && tableHeader ? tableHeader.offsetHeight : null,
    }

    // init filters
    store.states.columns.value.forEach((column: TableColumnCtx<T>) => {
      if (column.filteredValue && column.filteredValue.length) {
        table.store.commit('filterChange', {
          column,
          values: column.filteredValue,
          silent: true,
        })
      }
    })
    table.$ready = true
  })
  const setScrollClassByEl = (el: HTMLElement, className: string) => {
    if (!el) return
    const classList = Array.from(el.classList).filter(
      (item) => !item.startsWith('is-scrolling-'),
    )
    classList.push(layout.scrollX.value ? className : 'is-scrolling-none')
    el.className = classList.join(' ')
  }
  const setScrollClass = (className: string) => {
    const { tableWrapper } = table.refs
    setScrollClassByEl(tableWrapper, className)
  }
  const hasScrollClass = (className: string) => {
    const { tableWrapper } = table.refs
    return !!(tableWrapper && tableWrapper.classList.contains(className))
  }
  const syncPosition = function () {
    if (!table.refs.scrollBarRef) return
    if (!layout.scrollX.value) {
      const scrollingNoneClass = 'is-scrolling-none'
      if (!hasScrollClass(scrollingNoneClass)) {
        setScrollClass(scrollingNoneClass)
      }
      return
    }
    const scrollContainer = table.refs.scrollBarRef.wrapRef
    if (!scrollContainer) return
    const { scrollLeft, offsetWidth, scrollWidth } = scrollContainer
    const { headerWrapper, footerWrapper } = table.refs
    if (headerWrapper) headerWrapper.scrollLeft = scrollLeft
    if (footerWrapper) footerWrapper.scrollLeft = scrollLeft
    const maxScrollLeftPosition = scrollWidth - offsetWidth - 1
    if (scrollLeft >= maxScrollLeftPosition) {
      setScrollClass('is-scrolling-right')
    } else if (scrollLeft === 0) {
      setScrollClass('is-scrolling-left')
    } else {
      setScrollClass('is-scrolling-middle')
    }
  }

  const bindEvents = () => {
    if (!table.refs.scrollBarRef) return
    if (table.refs.scrollBarRef.wrapRef) {
      useEventListener(
        table.refs.scrollBarRef.wrapRef,
        'scroll',
        scheduleSyncPositionFrame,
        {
          passive: true,
        },
      )
    }
    if (props.fit) {
      useResizeObserver(table.vnode.el as HTMLElement, resizeListener)
    } else {
      useEventListener(window, 'resize', resizeListener)
    }

    useResizeObserver(table.refs.bodyWrapper, () => {
      resizeListener()
      table.refs?.scrollBarRef?.update()
    })
  }
  const resizeListener = () => {
    const el = table.vnode.el
    if (!table.$ready || !el) return

    let shouldUpdateLayout = false
    const {
      width: oldWidth,
      height: oldHeight,
      headerHeight: oldHeaderHeight,
    } = resizeState.value

    const width = (tableWidth.value = el.offsetWidth)
    if (oldWidth !== width) {
      shouldUpdateLayout = true
    }

    const height = el.offsetHeight
    if ((props.height || shouldUpdateHeight.value) && oldHeight !== height) {
      shouldUpdateLayout = true
    }

    const tableHeader: HTMLElement =
      props.tableLayout === 'fixed'
        ? table.refs.headerWrapper
        : table.refs.tableHeaderRef?.$el
    if (props.showHeader && tableHeader?.offsetHeight !== oldHeaderHeight) {
      shouldUpdateLayout = true
    }

    tableScrollHeight.value = table.refs.tableWrapper?.scrollHeight || 0
    headerScrollHeight.value = tableHeader?.scrollHeight || 0
    footerScrollHeight.value = table.refs.footerWrapper?.offsetHeight || 0
    appendScrollHeight.value = table.refs.appendWrapper?.offsetHeight || 0
    bodyScrollHeight.value =
      tableScrollHeight.value -
      headerScrollHeight.value -
      footerScrollHeight.value -
      appendScrollHeight.value

    if (shouldUpdateLayout) {
      resizeState.value = {
        width,
        height,
        headerHeight: (props.showHeader && tableHeader?.offsetHeight) || 0,
      }
      store.scheduleLayout(false, true, 'container-resize')
    }
  }
  const tableSize = useFormSize()
  const bodyWidth = computed(() => {
    const { bodyWidth: bodyWidth_, scrollY, gutterWidth } = layout
    return bodyWidth_.value
      ? `${(bodyWidth_.value as number) - (scrollY.value ? gutterWidth : 0)}px`
      : ''
  })

  const tableLayout = computed(() => {
    if (props.maxHeight) return 'fixed'
    return props.tableLayout
  })

  const emptyBlockStyle = computed(() => {
    if (props.data && props.data.length) return null
    let height = '100%'
    if (props.height && bodyScrollHeight.value) {
      height = `${bodyScrollHeight.value}px`
    }
    const width = tableWidth.value
    return {
      width: width ? `${width}px` : '',
      height,
    }
  })

  const tableInnerStyle = computed(() => {
    if (props.height) {
      return {
        height: !Number.isNaN(Number(props.height))
          ? `${props.height}px`
          : props.height,
      }
    }
    if (props.maxHeight) {
      return {
        maxHeight: !Number.isNaN(Number(props.maxHeight))
          ? `${props.maxHeight}px`
          : props.maxHeight,
      }
    }
    return {}
  })

  const scrollbarStyle = computed(() => {
    if (props.height) {
      return {
        height: '100%',
      }
    }
    if (props.maxHeight) {
      if (!Number.isNaN(Number(props.maxHeight))) {
        return {
          maxHeight: `${
            props.maxHeight -
            headerScrollHeight.value -
            footerScrollHeight.value
          }px`,
        }
      } else {
        return {
          maxHeight: `calc(${props.maxHeight} - ${
            headerScrollHeight.value + footerScrollHeight.value
          }px)`,
        }
      }
    }

    return {}
  })

  /**
   * fix layout
   */
  const handleFixedMousewheel = (event, data) => {
    const bodyWrapper = table.refs.bodyWrapper
    if (Math.abs(data.spinY) > 0) {
      const currentScrollTop = bodyWrapper.scrollTop
      if (data.pixelY < 0 && currentScrollTop !== 0) {
        event.preventDefault()
      }
      if (
        data.pixelY > 0 &&
        bodyWrapper.scrollHeight - bodyWrapper.clientHeight > currentScrollTop
      ) {
        event.preventDefault()
      }
      scheduleWheelScroll(0, Math.ceil(data.pixelY / 5))
    } else {
      scheduleWheelScroll(Math.ceil(data.pixelX / 5), 0)
    }
  }

  return {
    isHidden,
    renderExpanded,
    setDragVisible,
    isGroup,
    handleMouseLeave,
    handleHeaderFooterMousewheel,
    tableSize,
    emptyBlockStyle,
    handleFixedMousewheel,
    resizeProxyVisible,
    bodyWidth,
    resizeState,
    doLayout,
    tableBodyStyles,
    tableLayout,
    scrollbarViewStyle,
    tableInnerStyle,
    scrollbarStyle,
    refreshData,
  }
}

export default useStyle
