import {
  getCurrentInstance,
  onBeforeUnmount,
  ref,
  shallowRef,
  toRefs,
  unref,
} from 'vue'
import { getColumnById, getColumnByKey, getRowIdentity, orderBy } from '../util'
import {
  createWasmSortController,
  shouldUseWasm,
} from '../composables/use-wasm-sort'
import useExpand from './expand'
import useCurrent from './current'
import useTree from './tree'

import type { Ref, ShallowRef } from 'vue'
import type { TableColumnCtx } from '../table-column/defaults'
import type { Table, TableProps, TableRefs } from '../table/defaults'
import type { StoreFilter } from '.'

export type TableLayoutReason =
  | 'columns'
  | 'container-resize'
  | 'data-deep'
  | 'data-identity'
  | 'data-manual'
  | 'data-manual-init'
  | 'data-version'
  | 'filter'
  | 'sort'
  | 'unknown'

export type TableLayoutDiagnostics = {
  flushCount: number
  lastFlushedAt: number
  lastReasons: TableLayoutReason[]
  pendingReasons: TableLayoutReason[]
}

type TableSortState<T> = {
  sortingColumn: TableColumnCtx<T> | null
  sortOrder: 'ascending' | 'descending' | null
  sortProp: string | null
}

/**
 * WASM-first sorting for eligible large primitive datasets.
 * Non-eligible paths such as custom sort callbacks stay on the JS primary path.
 */
const sortData = <T>(data: T[], states: TableSortState<T>): T[] => {
  const sortingColumn = states.sortingColumn
  if (!sortingColumn || typeof sortingColumn.sortable === 'string') {
    return data
  }

  return orderBy(
    data,
    states.sortProp ?? '',
    states.sortOrder ?? 1,
    sortingColumn.sortMethod,
    sortingColumn.sortBy as never,
  )
}

const doFlattenColumns = <T>(columns: TableColumnCtx<T>[]) => {
  const result: TableColumnCtx<T>[] = []
  columns.forEach((column) => {
    if (column.children && column.children.length > 0) {
      // eslint-disable-next-line prefer-spread
      result.push.apply(result, doFlattenColumns(column.children))
    } else {
      result.push(column)
    }
  })
  return result
}

function useWatcher<T>() {
  const instance = getCurrentInstance() as Table<T>
  const { size: tableSize } = toRefs(instance.proxy?.$props as any)
  const rowKey: Ref<TableProps<T>['rowKey'] | null> = ref(null)
  const data: ShallowRef<T[]> = shallowRef([])
  const _data: ShallowRef<T[]> = shallowRef([])
  const isComplex = ref(false)
  const _columns: Ref<TableColumnCtx<T>[]> = ref([])
  const originColumns: Ref<TableColumnCtx<T>[]> = ref([])
  const columns: Ref<TableColumnCtx<T>[]> = ref([])
  const fixedColumns: Ref<TableColumnCtx<T>[]> = ref([])
  const rightFixedColumns: Ref<TableColumnCtx<T>[]> = ref([])
  const leafColumns: Ref<TableColumnCtx<T>[]> = ref([])
  const fixedLeafColumns: Ref<TableColumnCtx<T>[]> = ref([])
  const rightFixedLeafColumns: Ref<TableColumnCtx<T>[]> = ref([])
  const updateOrderFns: (() => void)[] = []
  const leafColumnsLength = ref(0)
  const fixedLeafColumnsLength = ref(0)
  const rightFixedLeafColumnsLength = ref(0)
  const isAllSelected = ref(false)
  const selection: ShallowRef<T[]> = shallowRef([])
  const reserveSelection = ref(false)
  const selectOnIndeterminate = ref(false)
  const selectable: Ref<((row: T, index: number) => boolean) | null> = ref(null)
  const filters: Ref<StoreFilter> = ref({})
  const filteredData: ShallowRef<T[]> = shallowRef([])
  const filteredRowIndices: ShallowRef<Uint32Array | null> = shallowRef(null)
  const sortedRowIndices: ShallowRef<Uint32Array | null> = shallowRef(null)
  const wasmSortController = createWasmSortController(String(instance.uid))
  let sortGeneration = 0
  let disposed = false
  const sortingColumn: Ref<TableColumnCtx<T> | null> = ref(null)
  const sortProp: Ref<string | null> = ref(null)
  const sortOrder: Ref<'ascending' | 'descending' | null> = ref(null)
  const hoverRow: Ref<T | null> = ref(null)
  const selectedRows = new Map<unknown, T>()
  const pendingLayoutReasons = new Set<TableLayoutReason>()
  const layoutDiagnostics = shallowRef<TableLayoutDiagnostics>({
    flushCount: 0,
    lastFlushedAt: 0,
    lastReasons: [],
    pendingReasons: [],
  })
  let layoutFlushPending = false
  let pendingColumnUpdate = false
  let pendingImmediateLayout = false

  // 检查 rowKey 是否存在
  const assertRowKey = () => {
    if (!rowKey.value) throw new Error('[ElTable] prop row-key is required')
  }

  // 更新 fixed
  const updateChildFixed = (column: TableColumnCtx<T>) => {
    column.children?.forEach((childColumn) => {
      childColumn.fixed = column.fixed
      updateChildFixed(childColumn)
    })
  }

  // 更新列
  const updateColumns = () => {
    _columns.value.forEach((column) => {
      updateChildFixed(column)
    })
    fixedColumns.value = _columns.value.filter(
      (column) => column.fixed === true || column.fixed === 'left',
    )
    rightFixedColumns.value = _columns.value.filter(
      (column) => column.fixed === 'right',
    )
    if (
      fixedColumns.value.length > 0 &&
      _columns.value[0] &&
      _columns.value[0].type === 'selection' &&
      !_columns.value[0].fixed
    ) {
      _columns.value[0].fixed = true
      fixedColumns.value.unshift(_columns.value[0])
    }

    const notFixedColumns = _columns.value.filter((column) => !column.fixed)
    originColumns.value = [
      ...fixedColumns.value,
      ...notFixedColumns,
      ...rightFixedColumns.value,
    ]
    const leafColumns = doFlattenColumns(notFixedColumns)
    const fixedLeafColumns = doFlattenColumns(fixedColumns.value)
    const rightFixedLeafColumns = doFlattenColumns(rightFixedColumns.value)

    leafColumnsLength.value = leafColumns.length
    fixedLeafColumnsLength.value = fixedLeafColumns.length
    rightFixedLeafColumnsLength.value = rightFixedLeafColumns.length

    columns.value = [
      ...fixedLeafColumns,
      ...leafColumns,
      ...rightFixedLeafColumns,
    ]
    isComplex.value =
      fixedColumns.value.length > 0 || rightFixedColumns.value.length > 0
  }

  // 更新 DOM
  const recordLayoutReason = (reason: TableLayoutReason = 'unknown') => {
    pendingLayoutReasons.add(reason)
    layoutDiagnostics.value = {
      ...layoutDiagnostics.value,
      pendingReasons: [...pendingLayoutReasons],
    }
  }

  const flushLayout = () => {
    layoutFlushPending = false
    if (disposed || !instance.state) return
    const reasons = [...pendingLayoutReasons]
    pendingLayoutReasons.clear()
    if (pendingColumnUpdate) updateColumns()
    pendingColumnUpdate = false
    const immediate = pendingImmediateLayout
    pendingImmediateLayout = false
    layoutDiagnostics.value = {
      flushCount: layoutDiagnostics.value.flushCount + 1,
      lastFlushedAt:
        typeof performance === 'undefined' ? Date.now() : performance.now(),
      lastReasons: reasons,
      pendingReasons: [],
    }
    if (immediate) instance.state.doLayout()
    else instance.state.debouncedUpdateLayout()
  }

  const scheduleLayout = (
    needUpdateColumns = false,
    immediate = false,
    reason: TableLayoutReason = 'unknown',
  ) => {
    recordLayoutReason(reason)
    pendingColumnUpdate ||= needUpdateColumns
    pendingImmediateLayout ||= immediate
    if (layoutFlushPending) return
    layoutFlushPending = true
    queueMicrotask(flushLayout)
  }

  // 选择：内部使用稳定 key Map，只有事件/API 边界才 materialize 数组。
  const selectionKey = (row: T) =>
    rowKey.value ? getRowIdentity(row, rowKey.value) : row

  const syncSelectionSnapshot = () => {
    selection.value = [...selectedRows.values()]
    return selection.value
  }

  const rebuildSelectionIndex = () => {
    const rows = selection.value
    selectedRows.clear()
    rows.forEach((row) => selectedRows.set(selectionKey(row), row))
  }

  const setRowSelected = (row: T, selected?: boolean) => {
    const current = selectedRows.has(selectionKey(row))
    const next = selected === undefined ? !current : selected
    let changed = false
    const visit = (item: T) => {
      const key = selectionKey(item)
      const included = selectedRows.has(key)
      if (included !== next) {
        if (next) selectedRows.set(key, item)
        else selectedRows.delete(key)
        changed = true
      }
      const children = (item as T & { children?: T[] }).children
      children?.forEach(visit)
    }
    visit(row)
    return changed
  }

  const isSelected = (row: T) => selectedRows.has(selectionKey(row))

  const clearSelection = () => {
    isAllSelected.value = false
    if (selectedRows.size) {
      selectedRows.clear()
      syncSelectionSnapshot()
      instance.emit('selection-change', [])
    }
  }

  const cleanSelection = () => {
    const available = new Set<unknown>(data.value.map(selectionKey))
    let changed = false
    for (const key of selectedRows.keys()) {
      if (!available.has(key)) {
        selectedRows.delete(key)
        changed = true
      }
    }
    if (!changed) return
    const snapshot = syncSelectionSnapshot()
    instance.emit('selection-change', snapshot.slice())
  }

  const getSelectionRows = () => {
    return (selection.value || []).slice()
  }

  const toggleRowSelection = (
    row: T,
    selected = undefined,
    emitChange = true,
  ) => {
    const changed = setRowSelected(row, selected)
    if (changed) {
      const newSelection = syncSelectionSnapshot().slice()
      // 调用 API 修改选中值，不触发 select 事件
      if (emitChange) {
        instance.emit('select', newSelection, row)
      }
      instance.emit('selection-change', newSelection)
    }
  }

  const _toggleAllSelection = () => {
    // when only some rows are selected (but not all), select or deselect all of them
    // depending on the value of selectOnIndeterminate
    const value = selectOnIndeterminate.value
      ? !isAllSelected.value
      : !(isAllSelected.value || selectedRows.size)
    isAllSelected.value = value

    let selectionChanged = false
    let childrenCount = 0
    const selectionRowKey = rowKey.value
    const childrenCountCache = new Map<string, number>()
    data.value.forEach((row, index) => {
      const rowIndex = index + childrenCount
      if (selectable.value) {
        if (
          selectable.value.call(null, row, rowIndex) &&
          setRowSelected(row, value)
        ) {
          selectionChanged = true
        }
      } else {
        if (setRowSelected(row, value)) {
          selectionChanged = true
        }
      }
      if (selectionRowKey) {
        childrenCount += getChildrenCount(
          getRowIdentity(row, selectionRowKey),
          childrenCountCache,
        )
      }
    })

    if (selectionChanged) {
      syncSelectionSnapshot()
      instance.emit('selection-change', selection.value.slice())
    }
    instance.emit('select-all', selection.value.slice())
  }

  const updateSelectionByRowKey = () => {
    data.value.forEach((row) => {
      const rowId = selectionKey(row)
      if (selectedRows.has(rowId)) selectedRows.set(rowId, row)
    })
    syncSelectionSnapshot()
  }

  const updateAllSelected = () => {
    // data 为 null 时，解构时的默认值会被忽略
    if (data.value?.length === 0) {
      isAllSelected.value = false
      return
    }

    let isAllSelected_ = true
    let selectedCount = 0
    let childrenCount = 0
    const keyProp = rowKey.value
    const childrenCountCache = new Map<string, number>()
    for (let i = 0, j = (data.value || []).length; i < j; i++) {
      const rowIndex = i + childrenCount
      const item = data.value[i]
      const isRowSelectable =
        selectable.value && selectable.value.call(null, item, rowIndex)
      if (!isSelected(item)) {
        if (!selectable.value || isRowSelectable) {
          isAllSelected_ = false
          break
        }
      } else {
        selectedCount++
      }
      if (keyProp) {
        childrenCount += getChildrenCount(
          getRowIdentity(item, keyProp),
          childrenCountCache,
        )
      }
    }

    if (selectedCount === 0) isAllSelected_ = false
    isAllSelected.value = isAllSelected_
  }

  // gets the number of all child nodes by rowKey
  const getChildrenCount = (
    rowKey: string,
    cache = new Map<string, number>(),
  ) => {
    if (!instance || !instance.store) return 0
    if (!rowKey) return 0

    const cachedCount = cache.get(rowKey)
    if (cachedCount !== undefined) {
      return cachedCount
    }

    const { treeData } = instance.store.states
    let count = 0
    const children = treeData.value[rowKey]?.children
    if (children) {
      count += children.length
      children.forEach((childKey: string) => {
        count += getChildrenCount(childKey, cache)
      })
    }
    cache.set(rowKey, count)
    return count
  }

  // 过滤与排序
  const updateFilters = (
    columns: TableColumnCtx<T> | TableColumnCtx<T>[],
    values: string[],
  ) => {
    if (!Array.isArray(columns)) {
      columns = [columns]
    }
    const filters_: StoreFilter = {}
    columns.forEach((col) => {
      filters.value[col.id] = values
      filters_[col.columnKey || col.id] = values
    })
    return filters_
  }

  const updateSort = (
    column: TableColumnCtx<T> | null,
    prop: string | null,
    order: 'ascending' | 'descending' | null,
  ) => {
    if (sortingColumn.value && sortingColumn.value !== column) {
      sortingColumn.value.order = ''
    }
    sortingColumn.value = column
    sortProp.value = prop
    sortOrder.value = order
  }

  const execFilter = () => {
    const activeFilters = Object.keys(filters.value)
      .map((columnId) => {
        const values = filters.value[columnId]
        if (!values || values.length === 0) return null
        const column = getColumnById(
          {
            columns: columns.value,
          },
          columnId,
        )
        return typeof column?.filterMethod === 'function'
          ? { column, values }
          : null
      })
      .filter(
        (item): item is { column: TableColumnCtx<T>; values: string[] } =>
          item !== null,
      )

    if (activeFilters.length === 0) {
      filteredRowIndices.value = null
      filteredData.value = unref(_data)
      return
    }

    const source = unref(_data)
    const matches: number[] = []
    source.forEach((row, index) => {
      if (
        activeFilters.every(({ column, values }) =>
          values.some((value) =>
            column.filterMethod.call(null, value, row, column),
          ),
        )
      ) {
        matches.push(index)
      }
    })
    filteredRowIndices.value = Uint32Array.from(matches)
    filteredData.value = Array.from(
      filteredRowIndices.value,
      (index) => source[index],
    )
  }

  const execSort = (layoutReason: TableLayoutReason = 'sort') => {
    const source = filteredData.value
    const states = {
      sortingColumn: sortingColumn.value,
      sortProp: sortProp.value,
      sortOrder: sortOrder.value,
    }
    const generation = ++sortGeneration
    if (!shouldUseWasm(source, states.sortingColumn)) {
      wasmSortController.cancel()
      data.value = sortData(source, states)
      sortedRowIndices.value =
        states.sortingColumn === null ? filteredRowIndices.value : null
      scheduleLayout(false, false, layoutReason)
      return
    }

    const ascending = states.sortOrder !== 'descending'
    const filteredIndices = filteredRowIndices.value
    void wasmSortController
      .sort(
        source as unknown as Record<string, unknown>[],
        states.sortProp ?? '',
        ascending,
      )
      .then((view) => {
        if (disposed || generation !== sortGeneration) return
        if (view) {
          data.value = view.materialize() as unknown as T[]
          sortedRowIndices.value = filteredIndices
            ? Uint32Array.from(view.indices, (index) => filteredIndices[index]!)
            : view.indices
        } else {
          data.value = sortData(source, states)
          sortedRowIndices.value = null
        }
        scheduleLayout(false, false, layoutReason)
      })
      .catch(() => {
        if (disposed || generation !== sortGeneration) return
        data.value = sortData(source, states)
        sortedRowIndices.value = null
        scheduleLayout(false, false, layoutReason)
      })
  }

  onBeforeUnmount(() => {
    disposed = true
    sortGeneration += 1
    wasmSortController.dispose()
  })

  // 根据 filters 与 sort 去过滤 data
  const execQuery = (
    ignore: { filter?: boolean } | undefined = undefined,
    layoutReason: TableLayoutReason = ignore?.filter ? 'sort' : 'filter',
  ) => {
    if (!(ignore && ignore.filter)) {
      execFilter()
    }
    execSort(layoutReason)
  }

  const clearFilter = (columnKeys?: string | string[]) => {
    const { tableHeaderRef } = instance.refs as TableRefs
    if (!tableHeaderRef) return
    const panels = Object.assign({}, tableHeaderRef.filterPanels)

    const keys = Object.keys(panels)
    if (!keys.length) return

    if (typeof columnKeys === 'string') {
      columnKeys = [columnKeys]
    }

    if (Array.isArray(columnKeys)) {
      const columns_ = columnKeys.map((key) =>
        getColumnByKey(
          {
            columns: columns.value,
          },
          key,
        ),
      )
      keys.forEach((key) => {
        const column = columns_.find((col) => col.id === key)
        if (column) {
          column.filteredValue = []
        }
      })
      instance.store.commit('filterChange', {
        column: columns_,
        values: [],
        silent: true,
        multi: true,
      })
    } else {
      keys.forEach((key) => {
        const column = columns.value.find((col) => col.id === key)
        if (column) {
          column.filteredValue = []
        }
      })

      filters.value = {}
      instance.store.commit('filterChange', {
        column: {},
        values: [],
        silent: true,
      })
    }
  }

  const clearSort = () => {
    if (!sortingColumn.value) return

    updateSort(null, null, null)
    instance.store.commit('changeSortCondition', {
      silent: true,
    })
  }
  const {
    setExpandRowKeys,
    toggleRowExpansion,
    updateExpandRows,
    states: expandStates,
    isRowExpanded,
  } = useExpand({
    data,
    rowKey,
  })
  type TreeWatcher = {
    updateTreeExpandKeys: (value: string[]) => void
    toggleTreeExpansion: (row: T, expanded?: boolean) => void
    updateTreeData: (
      ifChangeExpandRowKeys?: boolean,
      ifExpandAll?: boolean,
    ) => void
    loadOrToggle: (row: T) => void
    states: {
      expandRowKeys: Ref<string[]>
      treeData: Ref<Record<string, { children?: string[] }>>
      hasTreeData: Ref<boolean>
      indent: Ref<number>
      lazy: Ref<boolean>
      lazyTreeNodeMap: Ref<Record<string, T[]>>
      lazyColumnIdentifier: Ref<string>
      childrenColumnName: Ref<string>
    }
  }
  const {
    updateTreeExpandKeys,
    toggleTreeExpansion,
    updateTreeData,
    loadOrToggle,
    states: treeStates,
  } = useTree({ data, rowKey }) as unknown as TreeWatcher
  const {
    updateCurrentRowData,
    updateCurrentRow,
    setCurrentRowKey,
    states: currentData,
  } = useCurrent({
    data,
    rowKey,
  })
  // 适配层，expand-row-keys 在 Expand 与 TreeTable 中都有使用
  const setExpandRowKeysAdapter = (val: string[]) => {
    // 这里会触发额外的计算，但为了兼容性，暂时这么做
    setExpandRowKeys(val)
    updateTreeExpandKeys(val)
  }

  // 展开行与 TreeTable 都要使用
  const toggleRowExpansionAdapter = (row: T, expanded?: boolean) => {
    const hasExpandColumn = columns.value.some(({ type }) => type === 'expand')
    if (hasExpandColumn) {
      toggleRowExpansion(row, expanded)
    } else {
      toggleTreeExpansion(row, expanded)
    }
  }

  return {
    assertRowKey,
    updateColumns,
    scheduleLayout,
    recordLayoutReason,
    getLayoutDiagnostics: () => ({
      ...layoutDiagnostics.value,
      lastReasons: [...layoutDiagnostics.value.lastReasons],
      pendingReasons: [...layoutDiagnostics.value.pendingReasons],
    }),
    isSelected,
    clearSelection,
    cleanSelection,
    getSelectionRows,
    toggleRowSelection,
    _toggleAllSelection,
    toggleAllSelection: null,
    updateSelectionByRowKey,
    rebuildSelectionIndex,
    updateAllSelected,
    updateFilters,
    updateCurrentRow,
    updateSort,
    execFilter,
    execSort,
    execQuery,
    clearFilter,
    clearSort,
    toggleRowExpansion,
    setExpandRowKeysAdapter,
    setCurrentRowKey,
    toggleRowExpansionAdapter,
    isRowExpanded,
    updateExpandRows,
    updateCurrentRowData,
    loadOrToggle,
    updateTreeData,
    states: {
      tableSize,
      rowKey,
      data,
      _data,
      isComplex,
      _columns,
      originColumns,
      columns,
      fixedColumns,
      rightFixedColumns,
      leafColumns,
      fixedLeafColumns,
      rightFixedLeafColumns,
      updateOrderFns,
      leafColumnsLength,
      fixedLeafColumnsLength,
      rightFixedLeafColumnsLength,
      isAllSelected,
      selection,
      reserveSelection,
      selectOnIndeterminate,
      selectable,
      filters,
      filteredData,
      filteredRowIndices,
      sortedRowIndices,
      layoutDiagnostics,
      sortingColumn,
      sortProp,
      sortOrder,
      hoverRow,
      ...expandStates,
      ...treeStates,
      ...currentData,
    },
  }
}

export default useWatcher
