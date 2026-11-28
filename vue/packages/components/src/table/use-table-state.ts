import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue'
import { parseColumnPx } from './column-model'
import { collectTreeParentKeys } from './row-model'
import type { FsusSortOrder, FsusTableColumnDef, TableFlatRow } from './types'

export interface TableStateProps {
  data: Record<string, any>[]
  rowKey: string
  childrenKey: string
  defaultExpandAll: boolean
  selectedKeys: Array<string | number>
  expandedRowKeys?: Array<string | number>
}

export type TableStateEmit = (event: any, ...args: any[]) => void

export const useTableState = (
  props: TableStateProps,
  emit: TableStateEmit,
  wrapperRef: Ref<HTMLElement | null>,
) => {
  const sortKey = ref<string>('')
  const sortOrder = ref<FsusSortOrder>(null)
  const scrollTop = ref(0)
  const scrollLeft = ref(0)
  const canScrollRight = ref(false)

  const columnWidths = reactive<Record<string, number>>({})
  const activeFilters = reactive<Record<string, unknown[]>>({})
  const draftFilters = reactive<Record<string, unknown[]>>({})
  const openFilterKey = ref<string | null>(null)

  const internalExpanded = ref<Set<string | number>>(new Set(props.expandedRowKeys ?? []))
  const treeExpandedKeys = ref<Set<string | number>>(new Set())

  if (props.defaultExpandAll) {
    treeExpandedKeys.value = collectTreeParentKeys(props.data, props.rowKey, props.childrenKey)
  }

  watch(
    () => props.expandedRowKeys,
    (keys) => {
      if (keys) internalExpanded.value = new Set(keys)
    },
  )

  const expandedSet = computed(() =>
    props.expandedRowKeys ? new Set(props.expandedRowKeys) : internalExpanded.value,
  )

  const selectedSet = computed(() => new Set(props.selectedKeys))

  const updateScrollEdges = (el: HTMLElement | null) => {
    if (!el) return
    scrollLeft.value = el.scrollLeft
    canScrollRight.value = el.scrollWidth - el.clientWidth - el.scrollLeft > 1
  }

  onMounted(() => updateScrollEdges(wrapperRef.value))

  let stopActiveResize: (() => void) | null = null
  onBeforeUnmount(() => {
    stopActiveResize?.()
    stopActiveResize = null
  })

  const handleScroll = (event: Event) => {
    const el = event.target as HTMLElement
    scrollTop.value = el.scrollTop
    updateScrollEdges(el)
  }

  const toggleSort = (col: FsusTableColumnDef) => {
    if (!col.sortable) return
    const key = col.prop ?? col.key
    if (sortKey.value !== key) {
      sortKey.value = key
      sortOrder.value = 'asc'
    } else if (sortOrder.value === 'asc') {
      sortOrder.value = 'desc'
    } else {
      sortKey.value = ''
      sortOrder.value = null
    }
    emit('sortChange', { prop: sortKey.value, order: sortOrder.value })
  }

  const toggleRow = (key: string | number) => {
    const next = selectedSet.value.has(key)
      ? props.selectedKeys.filter((k) => k !== key)
      : [...props.selectedKeys, key]
    emit('update:selectedKeys', next)
    emit('selectionChange', next)
  }

  const createSelectionHelpers = (flatRows: ComputedRef<TableFlatRow[]>) => {
    const allSelected = computed(
      () => flatRows.value.length > 0 && flatRows.value.every((r) => selectedSet.value.has(r.key)),
    )
    const toggleAll = () => {
      const next = allSelected.value ? [] : flatRows.value.map((r) => r.key)
      emit('update:selectedKeys', next)
      emit('selectionChange', next)
    }
    return { allSelected, toggleAll }
  }

  const toggleExpandRow = (row: Record<string, any>, key: string | number) => {
    const next = new Set(expandedSet.value)
    const expanding = !next.has(key)
    if (expanding) next.add(key)
    else next.delete(key)
    internalExpanded.value = next
    const list = Array.from(next)
    emit('update:expandedRowKeys', list)
    emit('expandChange', row, expanding, list)
  }

  const toggleTreeRow = (key: string | number) => {
    const next = new Set(treeExpandedKeys.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    treeExpandedKeys.value = next
  }

  const startResize = (col: FsusTableColumnDef, event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    stopActiveResize?.()
    const th = (event.currentTarget as HTMLElement).closest('th')
    const startX = event.clientX
    const startW =
      columnWidths[col.key] ?? th?.getBoundingClientRect().width ?? parseColumnPx(col.width, 140)
    const minW = col.minWidth ?? 60
    const onMove = (e: PointerEvent) => {
      const nextW = Math.max(minW, Math.round(startW + (e.clientX - startX)))
      columnWidths[col.key] = nextW
      emit('columnResize', nextW, startW, col)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (stopActiveResize === onUp) stopActiveResize = null
    }
    stopActiveResize = onUp
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const toggleFilterPopover = (col: FsusTableColumnDef, event: MouseEvent) => {
    event.stopPropagation()
    if (openFilterKey.value === col.key) {
      openFilterKey.value = null
    } else {
      draftFilters[col.key] = [...(activeFilters[col.key] ?? [])]
      openFilterKey.value = col.key
    }
  }

  const toggleDraftFilterValue = (col: FsusTableColumnDef, val: unknown) => {
    const list = draftFilters[col.key] ?? []
    if (col.filterMultiple === false) {
      draftFilters[col.key] = list.includes(val) ? [] : [val]
    } else {
      draftFilters[col.key] = list.includes(val) ? list.filter((v) => v !== val) : [...list, val]
    }
  }

  const applyFilter = (col: FsusTableColumnDef) => {
    activeFilters[col.key] = [...(draftFilters[col.key] ?? [])]
    openFilterKey.value = null
    emit('filterChange', { ...activeFilters })
  }

  const resetFilter = (col: FsusTableColumnDef) => {
    draftFilters[col.key] = []
    activeFilters[col.key] = []
    openFilterKey.value = null
    emit('filterChange', { ...activeFilters })
  }

  return {
    sortKey,
    sortOrder,
    scrollTop,
    scrollLeft,
    canScrollRight,
    columnWidths,
    activeFilters,
    draftFilters,
    openFilterKey,
    expandedSet,
    treeExpandedKeys,
    selectedSet,
    handleScroll,
    toggleSort,
    toggleRow,
    createSelectionHelpers,
    toggleExpandRow,
    toggleTreeRow,
    startResize,
    toggleFilterPopover,
    toggleDraftFilterValue,
    applyFilter,
    resetFilter,
  }
}
