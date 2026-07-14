// @ts-nocheck
import { getCurrentInstance, inject, onBeforeUnmount, ref } from 'vue'
import {
  addClass,
  hasClass,
  isClient,
  isElement,
  removeClass,
} from '@element-plus/utils'
import { TABLE_INJECTION_KEY } from '../tokens'
import type { TableHeaderProps } from '.'
import type { TableColumnCtx } from '../table-column/defaults'

function useEvent<T>(props: TableHeaderProps<T>, emit) {
  const instance = getCurrentInstance()
  const parent = inject(TABLE_INJECTION_KEY)
  let layoutFrame = 0
  const scheduleLayoutAfterResize = () => {
    if (typeof requestAnimationFrame !== 'function') {
      props.store.scheduleLayout(false, true, 'columns')
      return
    }

    if (layoutFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(layoutFrame)
    }
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0
      props.store.scheduleLayout(false, true, 'columns')
    })
  }

  onBeforeUnmount(() => {
    if (layoutFrame && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(layoutFrame)
    }
    layoutFrame = 0
  })

  const handleFilterClick = (event: Event) => {
    event.stopPropagation()
    return
  }

  const handleHeaderClick = (event: Event, column: TableColumnCtx<T>) => {
    if (!column.filters && column.sortable) {
      handleSortClick(event, column, false)
    } else if (column.filterable && !column.sortable) {
      handleFilterClick(event)
    }
    parent?.emit('header-click', column, event)
  }

  const handleHeaderContextMenu = (event: Event, column: TableColumnCtx<T>) => {
    parent?.emit('header-contextmenu', column, event)
  }
  const draggingColumn = ref(null)
  const dragging = ref(false)
  const dragState = ref({})
  const handleMouseDown = (event: MouseEvent, column: TableColumnCtx<T>) => {
    if (!isClient) return
    if (column.children && column.children.length > 0) return
    /* istanbul ignore if */
    if (draggingColumn.value && props.border) {
      dragging.value = true

      const table = parent
      emit('set-drag-visible', true)
      const tableEl = table?.vnode.el
      const tableLeft = tableEl.getBoundingClientRect().left
      const columnEl = instance.vnode.el.querySelector(`th.${column.id}`)
      const columnRect = columnEl.getBoundingClientRect()
      const minLeft = columnRect.left - tableLeft + 30

      addClass(columnEl, 'noclick')

      dragState.value = {
        startMouseLeft: event.clientX,
        startLeft: columnRect.right - tableLeft,
        startColumnLeft: columnRect.left - tableLeft,
        tableLeft,
      }
      const resizeProxy = table?.refs.resizeProxy as HTMLElement
      resizeProxy.style.left = `${(dragState.value as any).startLeft}px`

      document.onselectstart = function () {
        return false
      }
      document.ondragstart = function () {
        return false
      }

      const handleMouseMove = (event: MouseEvent) => {
        const deltaLeft =
          event.clientX - (dragState.value as any).startMouseLeft
        const proxyLeft = (dragState.value as any).startLeft + deltaLeft

        scheduleResizeProxyMove(Math.max(minLeft, proxyLeft))
      }

      let resizeProxyFrame = 0
      let resizeProxyLeft = (dragState.value as any).startLeft
      const flushResizeProxyMove = () => {
        resizeProxyFrame = 0
        const translateX = resizeProxyLeft - (dragState.value as any).startLeft
        resizeProxy.style.transform = `translate3d(${translateX}px, 0, 0)`
      }
      const scheduleResizeProxyMove = (proxyLeft: number) => {
        resizeProxyLeft = proxyLeft
        if (resizeProxyFrame) return

        if (typeof requestAnimationFrame !== 'function') {
          flushResizeProxyMove()
          return
        }

        resizeProxyFrame = requestAnimationFrame(flushResizeProxyMove)
      }
      const clearResizeProxyMove = () => {
        if (resizeProxyFrame && typeof cancelAnimationFrame === 'function') {
          cancelAnimationFrame(resizeProxyFrame)
        }
        resizeProxyFrame = 0
      }
      const finishResizeProxyMove = () => {
        if (resizeProxyFrame) {
          clearResizeProxyMove()
          flushResizeProxyMove()
        }
        resizeProxy.style.left = `${resizeProxyLeft}px`
        resizeProxy.style.transform = ''
      }

      const handleMouseUp = () => {
        if (dragging.value) {
          const { startColumnLeft, startLeft } = dragState.value as any
          finishResizeProxyMove()
          const finalLeft = resizeProxyLeft
          const columnWidth = finalLeft - startColumnLeft
          column.width = column.realWidth = columnWidth
          table?.emit(
            'header-dragend',
            column.width,
            startLeft - startColumnLeft,
            column,
            event,
          )
          scheduleLayoutAfterResize()
          document.body.style.cursor = ''
          dragging.value = false
          draggingColumn.value = null
          dragState.value = {}
          emit('set-drag-visible', false)
        }

        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        clearResizeProxyMove()
        document.onselectstart = null
        document.ondragstart = null

        setTimeout(() => {
          removeClass(columnEl, 'noclick')
        }, 0)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
  }

  const handleMouseMove = (event: MouseEvent, column: TableColumnCtx<T>) => {
    if (column.children && column.children.length > 0) return
    const el = event.target as HTMLElement
    if (!isElement(el)) {
      return
    }
    const target = el?.closest('th')

    if (!column || !column.resizable) return

    if (!dragging.value && props.border) {
      const rect = target.getBoundingClientRect()

      const bodyStyle = document.body.style
      if (rect.width > 12 && rect.right - event.pageX < 8) {
        bodyStyle.cursor = 'col-resize'
        if (hasClass(target, 'is-sortable')) {
          target.style.cursor = 'col-resize'
        }
        draggingColumn.value = column
      } else if (!dragging.value) {
        bodyStyle.cursor = ''
        if (hasClass(target, 'is-sortable')) {
          target.style.cursor = 'pointer'
        }
        draggingColumn.value = null
      }
    }
  }

  const handleMouseOut = () => {
    if (!isClient) return
    document.body.style.cursor = ''
  }
  const toggleOrder = ({ order, sortOrders }) => {
    if (order === '') return sortOrders[0]
    const index = sortOrders.indexOf(order || null)
    return sortOrders[index > sortOrders.length - 2 ? 0 : index + 1]
  }
  const handleSortClick = (
    event: Event,
    column: TableColumnCtx<T>,
    givenOrder: string | boolean,
  ) => {
    event.stopPropagation()
    const order =
      column.order === givenOrder ? null : givenOrder || toggleOrder(column)

    const target = (event.target as HTMLElement)?.closest('th')

    if (target) {
      if (hasClass(target, 'noclick')) {
        removeClass(target, 'noclick')
        return
      }
    }

    if (!column.sortable) return

    const states = props.store.states
    let sortProp = states.sortProp.value
    let sortOrder
    const sortingColumn = states.sortingColumn.value

    if (
      sortingColumn !== column ||
      (sortingColumn === column && sortingColumn.order === null)
    ) {
      if (sortingColumn) {
        sortingColumn.order = null
      }
      states.sortingColumn.value = column
      sortProp = column.property
    }
    if (!order) {
      sortOrder = column.order = null
    } else {
      sortOrder = column.order = order
    }

    states.sortProp.value = sortProp
    states.sortOrder.value = sortOrder

    parent?.store.commit('changeSortCondition')
  }

  return {
    handleHeaderClick,
    handleHeaderContextMenu,
    handleMouseDown,
    handleMouseMove,
    handleMouseOut,
    handleSortClick,
    handleFilterClick,
  }
}

export default useEvent
