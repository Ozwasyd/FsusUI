import {
  computed,
  defineComponent,
  h,
  onMounted,
  reactive,
  ref,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import {
  addUnit,
  getByPath,
  useFsusLocale,
  useResizeObserver,
} from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'

export interface FsusTableFilterOption {
  text: string
  value: unknown
}

export interface FsusTableColumnDef<Row = Record<string, any>> {
  key: string
  prop?: string
  label: string
  width?: number | string
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  resizable?: boolean
  fixed?: 'left' | 'right'
  filters?: FsusTableFilterOption[]
  filterMultiple?: boolean
  filterMethod?: (value: unknown, row: Row, column: FsusTableColumnDef<Row>) => boolean
  children?: FsusTableColumnDef<Row>[]
  formatter?: (row: Row, index: number) => string | VNode
  slotRender?: (scope: { row: Row; column: FsusTableColumnDef<Row>; value: unknown; index: number }) => VNode[] | undefined
}

export type FsusSortOrder = 'asc' | 'desc' | null

export type FsusTableSpanResult =
  | [number, number]
  | { rowspan: number; colspan: number }
  | void

export type FsusTableSpanMethod<Row = Record<string, any>> = (ctx: {
  row: Row
  column: FsusTableColumnDef<Row>
  rowIndex: number
  columnIndex: number
}) => FsusTableSpanResult

export type FsusTableSummaryMethod<Row = Record<string, any>> = (ctx: {
  columns: FsusTableColumnDef<Row>[]
  data: Row[]
}) => Array<string | number | VNode>

interface HeaderCell {
  col: FsusTableColumnDef
  colspan: number
  rowspan: number
  isLeaf: boolean
  leafIndex: number
}

interface FlatDataRow {
  row: Record<string, any>
  key: string | number
  depth: number
  hasChildren: boolean
  treeExpanded: boolean
}

export const FsusAutoResizer = defineComponent({
  name: 'FsusAutoResizer',
  setup(_, { slots }) {
    const elRef = ref<HTMLElement | null>(null)
    const width = ref(0)
    const height = ref(0)
    useResizeObserver(elRef, (entry) => {
      width.value = entry.contentRect.width
      height.value = entry.contentRect.height
    })
    return () =>
      h('div', { ref: elRef, class: 'fsus-auto-resizer', style: { width: '100%', height: '100%' } }, [
        slots.default?.({ width: width.value, height: height.value }),
      ])
  },
})

export const FsusTableColumn = defineComponent({
  name: 'FsusTableColumn',
  props: {
    prop: { type: String, default: '' },
    label: { type: String, default: '' },
    width: { type: [String, Number], default: undefined },
    minWidth: { type: Number, default: undefined },
    align: { type: String as PropType<'left' | 'center' | 'right'>, default: 'left' },
    sortable: { type: Boolean, default: false },
    resizable: { type: Boolean, default: undefined },
    fixed: { type: String as PropType<'left' | 'right'>, default: undefined },
    filters: { type: Array as PropType<FsusTableFilterOption[]>, default: undefined },
    filterMultiple: { type: Boolean, default: true },
    filterMethod: {
      type: Function as PropType<(value: unknown, row: any, col: FsusTableColumnDef) => boolean>,
      default: undefined,
    },
  },
  setup() {
    return () => null
  },
})

const parseColumnsFromVNodes = (vnodes: VNode[]): FsusTableColumnDef[] => {
  const out: FsusTableColumnDef[] = []
  for (let i = 0; i < vnodes.length; i++) {
    const v = vnodes[i]
    if (!v || (v.type as { name?: string })?.name !== 'FsusTableColumn') continue
    const childSlot = (v.children as { default?: (scope?: any) => VNode[] } | null)?.default
    let nestedCols: FsusTableColumnDef[] = []
    if (childSlot) {
      try {
        const probe = childSlot({ row: {}, column: {}, value: undefined, index: 0 })
        if (Array.isArray(probe) && probe.some((c) => (c?.type as { name?: string })?.name === 'FsusTableColumn')) {
          nestedCols = parseColumnsFromVNodes(probe)
        }
      } catch {
        // Scoped cell slot that accesses row properties directly
      }
    }
    const p = v.props ?? {}
    out.push({
      key: String(p.prop || p.label || `col-${i}`),
      prop: p.prop,
      label: String(p.label ?? ''),
      width: p.width,
      minWidth: p.minWidth ?? p['min-width'],
      align: p.align ?? 'left',
      sortable: Boolean(p.sortable || p.sortable === ''),
      resizable: p.resizable !== undefined ? Boolean(p.resizable || p.resizable === '') : undefined,
      fixed: p.fixed === '' ? 'left' : p.fixed,
      filters: p.filters,
      filterMultiple: p.filterMultiple ?? p['filter-multiple'] ?? true,
      filterMethod: p.filterMethod ?? p['filter-method'],
      children: nestedCols.length > 0 ? nestedCols : undefined,
      slotRender: nestedCols.length === 0 && childSlot ? (scope) => childSlot(scope) : undefined,
    })
  }
  return out
}

const getMaxDepth = (cols: FsusTableColumnDef[]): number => {
  let max = 1
  for (const col of cols) {
    if (col.children?.length) {
      max = Math.max(max, 1 + getMaxDepth(col.children))
    }
  }
  return max
}

const countLeaves = (col: FsusTableColumnDef): number => {
  if (!col.children?.length) return 1
  return col.children.reduce((acc, c) => acc + countLeaves(c), 0)
}

const flattenLeaves = (cols: FsusTableColumnDef[], out: FsusTableColumnDef[] = []): FsusTableColumnDef[] => {
  for (const col of cols) {
    if (col.children?.length) flattenLeaves(col.children, out)
    else out.push(col)
  }
  return out
}

const buildHeaderRows = (cols: FsusTableColumnDef[]): HeaderCell[][] => {
  const maxDepth = getMaxDepth(cols)
  const rows: HeaderCell[][] = Array.from({ length: maxDepth }, () => [])
  let leafCursor = 0
  const walk = (list: FsusTableColumnDef[], depth: number) => {
    for (const col of list) {
      const hasKids = Boolean(col.children?.length)
      const colspan = countLeaves(col)
      const rowspan = hasKids ? 1 : maxDepth - depth
      const cell: HeaderCell = {
        col,
        colspan,
        rowspan,
        isLeaf: !hasKids,
        leafIndex: hasKids ? -1 : leafCursor++,
      }
      rows[depth]!.push(cell)
      if (hasKids && col.children) {
        walk(col.children, depth + 1)
      }
    }
  }
  walk(cols, 0)
  return rows
}

const parsePx = (value: number | string | undefined, fallback = 140): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = Number.parseFloat(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

/**
 * Unified production FsusTable — merges Table + TableV2 with:
 * - Multi-level grouped headers (`column.children`)
 * - Sticky `fixed: 'left' | 'right'` columns with edge scroll shadows
 * - Column width drag-resizing (`resizable`)
 * - Expandable detail rows (`expandable` + `#expand` slot)
 * - Hierarchical tree table (`row.children`)
 * - Cell spanning (`spanMethod`)
 * - Column filter popovers (`filters` + `filterMethod`)
 * - Footer summary row (`showSummary` + `summaryMethod`)
 * - Sorting, row selection, sticky header, and automatic row virtualization
 */
export const FsusTable = defineComponent({
  name: 'FsusTable',
  props: {
    data: { type: Array as PropType<Record<string, any>[]>, default: () => [] },
    columns: { type: Array as PropType<FsusTableColumnDef[]>, default: () => [] },
    rowKey: { type: String, default: 'id' },
    selectable: { type: Boolean, default: false },
    selectedKeys: { type: Array as PropType<Array<string | number>>, default: () => [] },
    expandable: { type: Boolean, default: false },
    expandedRowKeys: { type: Array as PropType<Array<string | number>>, default: undefined },
    childrenKey: { type: String, default: 'children' },
    treeIndent: { type: Number, default: 20 },
    defaultExpandAll: { type: Boolean, default: false },
    resizable: { type: Boolean, default: false },
    showSummary: { type: Boolean, default: false },
    sumText: { type: String, default: undefined },
    summaryMethod: { type: Function as PropType<FsusTableSummaryMethod>, default: undefined },
    spanMethod: { type: Function as PropType<FsusTableSpanMethod>, default: undefined },
    stripe: { type: Boolean, default: false },
    border: { type: Boolean, default: false },
    compact: { type: Boolean, default: false },
    height: { type: [Number, String], default: undefined },
    rowHeight: { type: Number, default: 44 },
    virtualThreshold: { type: Number, default: 100 },
    loading: { type: Boolean, default: false },
    emptyText: { type: String, default: undefined },
  },
  emits: [
    'update:selectedKeys',
    'update:expandedRowKeys',
    'selectionChange',
    'expandChange',
    'sortChange',
    'filterChange',
    'columnResize',
    'rowClick',
  ],
  setup(props, { emit, slots }) {
    const { t } = useFsusLocale()
    const wrapperRef = ref<HTMLElement | null>(null)
    const sortKey = ref<string>('')
    const sortOrder = ref<FsusSortOrder>(null)
    const scrollTop = ref(0)
    const scrollLeft = ref(0)
    const canScrollRight = ref(false)

    // Resized column widths by column key
    const columnWidths = reactive<Record<string, number>>({})

    // Filter state: active filters per column key & open filter dropdown key
    const activeFilters = reactive<Record<string, unknown[]>>({})
    const draftFilters = reactive<Record<string, unknown[]>>({})
    const openFilterKey = ref<string | null>(null)

    // Expanded detail rows & tree rows
    const internalExpanded = ref<Set<string | number>>(new Set(props.expandedRowKeys ?? []))
    const treeExpandedKeys = ref<Set<string | number>>(new Set())

    const collectTreeParentKeys = (rows: Record<string, any>[], out = new Set<string | number>()) => {
      rows.forEach((row, idx) => {
        const kids = row[props.childrenKey]
        if (Array.isArray(kids) && kids.length > 0) {
          out.add(row[props.rowKey] ?? idx)
          collectTreeParentKeys(kids, out)
        }
      })
      return out
    }

    if (props.defaultExpandAll) {
      treeExpandedKeys.value = collectTreeParentKeys(props.data)
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

    const resolvedTreeColumns = computed<FsusTableColumnDef[]>(() => {
      if (props.columns.length > 0) return props.columns
      return parseColumnsFromVNodes(slots.default?.() ?? [])
    })

    const headerRows = computed(() => buildHeaderRows(resolvedTreeColumns.value))
    const leafColumns = computed(() => flattenLeaves(resolvedTreeColumns.value))

    const getColWidthPx = (col: FsusTableColumnDef): number | undefined => {
      if (columnWidths[col.key] !== undefined) return columnWidths[col.key]
      if (col.width !== undefined) return parsePx(col.width)
      return undefined
    }

    // Sticky offset calculation for fixed left/right columns
    const leadingUtilityWidth = computed(() => {
      let w = 0
      if (props.expandable) w += 42
      if (props.selectable) w += 42
      return w
    })

    const fixedOffsets = computed(() => {
      const leftMap = new Map<string, number>()
      const rightMap = new Map<string, number>()
      let lastLeftKey = ''
      let firstRightKey = ''

      let leftAcc = leadingUtilityWidth.value
      for (const col of leafColumns.value) {
        if (col.fixed === 'left') {
          leftMap.set(col.key, leftAcc)
          leftAcc += getColWidthPx(col) ?? 140
          lastLeftKey = col.key
        }
      }
      let rightAcc = 0
      for (let i = leafColumns.value.length - 1; i >= 0; i--) {
        const col = leafColumns.value[i]!
        if (col.fixed === 'right') {
          rightMap.set(col.key, rightAcc)
          rightAcc += getColWidthPx(col) ?? 140
          firstRightKey = col.key
        }
      }
      return { leftMap, rightMap, lastLeftKey, firstRightKey }
    })

    // Filter + Sort pipeline
    const filteredData = computed(() => {
      const filterEntries = Object.entries(activeFilters).filter(([, vals]) => vals.length > 0)
      if (filterEntries.length === 0) return props.data
      return props.data.filter((row) =>
        filterEntries.every(([colKey, values]) => {
          const col = leafColumns.value.find((c) => c.key === colKey)
          if (!col) return true
          return values.some((val) => {
            if (col.filterMethod) return col.filterMethod(val, row, col)
            const cellVal = col.prop ? getByPath(row, col.prop) : row[col.key]
            return cellVal === val
          })
        }),
      )
    })

    const sortedData = computed(() => {
      if (!sortKey.value || !sortOrder.value) return filteredData.value
      const dir = sortOrder.value === 'asc' ? 1 : -1
      const key = sortKey.value
      return [...filteredData.value].sort((a, b) => {
        const va = getByPath(a, key)
        const vb = getByPath(b, key)
        if (va === vb) return 0
        if (va === undefined || va === null) return 1
        if (vb === undefined || vb === null) return -1
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
        return String(va).localeCompare(String(vb)) * dir
      })
    })

    const hasTreeData = computed(() =>
      sortedData.value.some((r) => Array.isArray(r[props.childrenKey]) && r[props.childrenKey].length > 0),
    )

    const flatRows = computed<FlatDataRow[]>(() => {
      const out: FlatDataRow[] = []
      const walk = (list: Record<string, any>[], depth: number, prefix: string) => {
        list.forEach((row, idx) => {
          const key = row[props.rowKey] ?? `${prefix}${idx}`
          const kids = row[props.childrenKey]
          const hasChildren = Array.isArray(kids) && kids.length > 0
          const treeExpanded = treeExpandedKeys.value.has(key)
          out.push({ row, key, depth, hasChildren, treeExpanded })
          if (hasChildren && treeExpanded) {
            walk(kids, depth + 1, `${key}-`)
          }
        })
      }
      walk(sortedData.value, 0, '')
      return out
    })

    const isVirtualized = computed(
      () =>
        props.height !== undefined &&
        !props.expandable &&
        !props.spanMethod &&
        flatRows.value.length > props.virtualThreshold,
    )
    const viewportPx = computed(() => (typeof props.height === 'number' ? props.height : 400))
    const visibleSlice = computed(() => {
      if (!isVirtualized.value) {
        return { start: 0, end: flatRows.value.length, topPad: 0, bottomPad: 0 }
      }
      const start = Math.max(0, Math.floor(scrollTop.value / props.rowHeight) - 5)
      const count = Math.ceil(viewportPx.value / props.rowHeight) + 10
      const end = Math.min(flatRows.value.length, start + count)
      return {
        start,
        end,
        topPad: start * props.rowHeight,
        bottomPad: Math.max(0, (flatRows.value.length - end) * props.rowHeight),
      }
    })

    const selectedSet = computed(() => new Set(props.selectedKeys))
    const allSelected = computed(
      () => flatRows.value.length > 0 && flatRows.value.every((r) => selectedSet.value.has(r.key)),
    )

    const updateScrollEdges = (el: HTMLElement | null) => {
      if (!el) return
      scrollLeft.value = el.scrollLeft
      canScrollRight.value = el.scrollWidth - el.clientWidth - el.scrollLeft > 1
    }

    onMounted(() => updateScrollEdges(wrapperRef.value))

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

    const toggleAll = () => {
      const next = allSelected.value ? [] : flatRows.value.map((r) => r.key)
      emit('update:selectedKeys', next)
      emit('selectionChange', next)
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
      const th = (event.currentTarget as HTMLElement).closest('th')
      const startX = event.clientX
      const startW = columnWidths[col.key] ?? th?.getBoundingClientRect().width ?? parsePx(col.width, 140)
      const minW = col.minWidth ?? 60
      const onMove = (e: PointerEvent) => {
        const nextW = Math.max(minW, Math.round(startW + (e.clientX - startX)))
        columnWidths[col.key] = nextW
        emit('columnResize', nextW, startW, col)
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
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

    const summaryValues = computed<Array<string | number | VNode>>(() => {
      if (!props.showSummary) return []
      const cols = leafColumns.value
      const rows = flatRows.value.map((r) => r.row)
      if (props.summaryMethod) {
        return props.summaryMethod({ columns: cols, data: rows })
      }
      return cols.map((col, idx) => {
        if (idx === 0) return props.sumText ?? t('table.sumText')
        const nums = rows
          .map((row) => Number(col.prop ? getByPath(row, col.prop) : row[col.key]))
          .filter((n) => Number.isFinite(n))
        if (nums.length === 0) return ''
        const sum = nums.reduce((a, b) => a + b, 0)
        return Number.isInteger(sum) ? String(sum) : sum.toFixed(2)
      })
    })

    const stickyStyleForCol = (col: FsusTableColumnDef) => {
      const widthPx = getColWidthPx(col)
      const style: Record<string, string | undefined> = {
        width: widthPx !== undefined ? `${widthPx}px` : addUnit(col.width),
        minWidth: col.minWidth ? `${col.minWidth}px` : undefined,
        textAlign: col.align ?? 'left',
      }
      if (col.fixed === 'left') {
        style.position = 'sticky'
        style.left = `${fixedOffsets.value.leftMap.get(col.key) ?? 0}px`
      } else if (col.fixed === 'right') {
        style.position = 'sticky'
        style.right = `${fixedOffsets.value.rightMap.get(col.key) ?? 0}px`
      }
      return style
    }

    const fixedDataAttrs = (col: FsusTableColumnDef) => ({
      'data-fixed': col.fixed,
      'data-fixed-edge':
        col.fixed === 'left' && col.key === fixedOffsets.value.lastLeftKey
          ? 'left'
          : col.fixed === 'right' && col.key === fixedOffsets.value.firstRightKey
            ? 'right'
            : undefined,
    })

    const getSpan = (row: Record<string, any>, col: FsusTableColumnDef, rowIndex: number, columnIndex: number) => {
      if (!props.spanMethod) return { rowspan: 1, colspan: 1 }
      const res = props.spanMethod({ row, column: col, rowIndex, columnIndex })
      if (Array.isArray(res)) return { rowspan: res[0], colspan: res[1] }
      if (res && typeof res === 'object') return { rowspan: res.rowspan, colspan: res.colspan }
      return { rowspan: 1, colspan: 1 }
    }

    return () => {
      const cols = leafColumns.value
      const hRows = headerRows.value
      const slice = visibleSlice.value
      const rows = flatRows.value.slice(slice.start, slice.end)
      const totalColCount = cols.length + (props.selectable ? 1 : 0) + (props.expandable ? 1 : 0)

      return h(
        'div',
        {
          ref: wrapperRef,
          class: 'fsus-table',
          'data-stripe': props.stripe ? '' : undefined,
          'data-border': props.border ? '' : undefined,
          'data-compact': props.compact ? '' : undefined,
          'data-scroll-left': scrollLeft.value > 0 ? '' : undefined,
          'data-scroll-right': canScrollRight.value ? '' : undefined,
          style: props.height !== undefined ? { maxHeight: addUnit(props.height) } : undefined,
          onScroll: (e: Event) => {
            const el = e.target as HTMLElement
            scrollTop.value = el.scrollTop
            updateScrollEdges(el)
          },
        },
        [
          h('table', { class: 'fsus-table__table' }, [
            h(
              'thead',
              { class: 'fsus-table__head' },
              hRows.map((rowCells, depthIdx) =>
                h('tr', { key: `h-${depthIdx}` }, [
                  depthIdx === 0 && props.expandable
                    ? h('th', {
                        class: 'fsus-table__th fsus-table__expand-cell',
                        rowspan: hRows.length,
                        'aria-label': 'Expand',
                      })
                    : null,
                  depthIdx === 0 && props.selectable
                    ? h(
                        'th',
                        {
                          class: 'fsus-table__th fsus-table__check-cell',
                          rowspan: hRows.length,
                        },
                        [
                          h('input', {
                            type: 'checkbox',
                            checked: allSelected.value,
                            'aria-label': t('table.selectAll'),
                            onChange: toggleAll,
                          }),
                        ],
                      )
                    : null,
                  ...rowCells.map(({ col, colspan, rowspan, isLeaf }) => {
                    const activeSort = isLeaf && sortKey.value === (col.prop ?? col.key)
                    const hasFilter = isLeaf && Boolean(col.filters?.length)
                    const filterActive = (activeFilters[col.key]?.length ?? 0) > 0
                    const canResize = isLeaf && (col.resizable ?? props.resizable)
                    return h(
                      'th',
                      {
                        key: `${depthIdx}-${col.key}`,
                        class: 'fsus-table__th',
                        colspan: colspan > 1 ? colspan : undefined,
                        rowspan: rowspan > 1 ? rowspan : undefined,
                        style: isLeaf
                          ? stickyStyleForCol(col)
                          : { textAlign: col.align ?? 'center' },
                        ...(isLeaf ? fixedDataAttrs(col) : {}),
                        'data-sortable': isLeaf && col.sortable ? '' : undefined,
                        'data-filtered': filterActive ? '' : undefined,
                        'aria-sort': activeSort
                          ? sortOrder.value === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined,
                        onClick: () => isLeaf && toggleSort(col),
                      },
                      [
                        h('span', { class: 'fsus-table__th-inner' }, [
                          h('span', { class: 'fsus-table__th-label' }, col.label),
                          isLeaf && col.sortable
                            ? h(FsusIcon, {
                                name: activeSort && sortOrder.value === 'desc' ? 'sort-down' : 'sort-up',
                                size: 12,
                                class: 'fsus-table__sort-icon',
                              })
                            : null,
                          hasFilter
                            ? h(
                                'button',
                                {
                                  type: 'button',
                                  class: 'fsus-table__filter-trigger',
                                  'aria-label': `Filter ${col.label}`,
                                  'aria-expanded': openFilterKey.value === col.key ? 'true' : 'false',
                                  'data-active': filterActive ? '' : undefined,
                                  onClick: (e: MouseEvent) => toggleFilterPopover(col, e),
                                },
                                [h(FsusIcon, { name: 'filter', size: 12 })],
                              )
                            : null,
                        ]),
                        hasFilter && openFilterKey.value === col.key
                          ? h(
                              'div',
                              {
                                class: 'fsus-table__filter-panel',
                                role: 'dialog',
                                'aria-label': `${col.label} filters`,
                                onClick: (e: MouseEvent) => e.stopPropagation(),
                              },
                              [
                                h(
                                  'div',
                                  { class: 'fsus-table__filter-list' },
                                  col.filters!.map((opt) => {
                                    const checked = (draftFilters[col.key] ?? []).includes(opt.value)
                                    return h('label', { key: String(opt.value), class: 'fsus-table__filter-item' }, [
                                      h('input', {
                                        type: col.filterMultiple === false ? 'radio' : 'checkbox',
                                        checked,
                                        onChange: () => toggleDraftFilterValue(col, opt.value),
                                      }),
                                      h('span', opt.text),
                                    ])
                                  }),
                                ),
                                h('div', { class: 'fsus-table__filter-actions' }, [
                                  h(
                                    'button',
                                    {
                                      type: 'button',
                                      class: 'fsus-table__filter-btn',
                                      onClick: () => resetFilter(col),
                                    },
                                    t('table.filterReset'),
                                  ),
                                  h(
                                    'button',
                                    {
                                      type: 'button',
                                      class: 'fsus-table__filter-btn',
                                      'data-primary': '',
                                      onClick: () => applyFilter(col),
                                    },
                                    t('table.filterConfirm'),
                                  ),
                                ]),
                              ],
                            )
                          : null,
                        canResize
                          ? h('span', {
                              class: 'fsus-table__resize-handle',
                              role: 'separator',
                              'aria-orientation': 'vertical',
                              'aria-label': `Resize ${col.label}`,
                              onPointerdown: (e: PointerEvent) => startResize(col, e),
                              onClick: (e: MouseEvent) => e.stopPropagation(),
                            })
                          : null,
                      ],
                    )
                  }),
                ]),
              ),
            ),
            h('tbody', { class: 'fsus-table__body' }, [
              rows.length === 0
                ? h('tr', [
                    h(
                      'td',
                      { class: 'fsus-table__empty', colspan: Math.max(totalColCount, 1) },
                      slots.empty ? slots.empty() : (props.emptyText ?? t('table.empty')),
                    ),
                  ])
                : [
                    slice.topPad > 0
                      ? h('tr', { style: { height: `${slice.topPad}px` }, 'aria-hidden': 'true' })
                      : null,
                    ...rows.flatMap((flatItem, offset) => {
                      const realIdx = slice.start + offset
                      const { row, key: rKey, depth, hasChildren, treeExpanded } = flatItem
                      const selected = selectedSet.value.has(rKey)
                      const isExpanded = props.expandable && expandedSet.value.has(rKey)

                      const mainRow = h(
                        'tr',
                        {
                          key: String(rKey),
                          class: 'fsus-table__row',
                          'data-selected': selected ? '' : undefined,
                          'data-expanded': isExpanded ? '' : undefined,
                          onClick: () => emit('rowClick', row, realIdx),
                        },
                        [
                          props.expandable
                            ? h('td', { class: 'fsus-table__td fsus-table__expand-cell' }, [
                                h(
                                  'button',
                                  {
                                    type: 'button',
                                    class: 'fsus-table__expand-btn',
                                    'aria-expanded': isExpanded ? 'true' : 'false',
                                    'aria-label': isExpanded ? 'Collapse row' : 'Expand row',
                                    onClick: (e: MouseEvent) => {
                                      e.stopPropagation()
                                      toggleExpandRow(row, rKey)
                                    },
                                  },
                                  [h(FsusIcon, { name: isExpanded ? 'caret-bottom' : 'caret-right', size: 12 })],
                                ),
                              ])
                            : null,
                          props.selectable
                            ? h('td', { class: 'fsus-table__td fsus-table__check-cell' }, [
                                h('input', {
                                  type: 'checkbox',
                                  checked: selected,
                                  onClick: (e: MouseEvent) => e.stopPropagation(),
                                  onChange: () => toggleRow(rKey),
                                }),
                              ])
                            : null,
                          ...cols.map((col, colIdx) => {
                            const span = getSpan(row, col, realIdx, colIdx)
                            if (span.rowspan === 0 || span.colspan === 0) return null
                            const cellSlot = slots[`cell-${col.key}`]
                            const raw = col.prop ? getByPath(row, col.prop) : row[col.key]
                            const content = cellSlot
                              ? cellSlot({ row, column: col, value: raw, index: realIdx })
                              : col.slotRender
                                ? col.slotRender({ row, column: col, value: raw, index: realIdx })
                                : col.formatter
                                  ? [col.formatter(row, realIdx)]
                                  : raw !== undefined && raw !== null
                                    ? String(raw)
                                    : ''

                            const treePrefix =
                              colIdx === 0 && (hasTreeData.value || depth > 0)
                                ? [
                                    h('span', {
                                      class: 'fsus-table__tree-indent',
                                      style: { paddingLeft: `${depth * props.treeIndent}px` },
                                    }),
                                    hasChildren
                                      ? h(
                                          'button',
                                          {
                                            type: 'button',
                                            class: 'fsus-table__tree-toggle',
                                            'aria-expanded': treeExpanded ? 'true' : 'false',
                                            'aria-label': treeExpanded ? 'Collapse child rows' : 'Expand child rows',
                                            onClick: (e: MouseEvent) => {
                                              e.stopPropagation()
                                              toggleTreeRow(rKey)
                                            },
                                          },
                                          [h(FsusIcon, { name: treeExpanded ? 'caret-bottom' : 'caret-right', size: 12 })],
                                        )
                                      : h('span', { class: 'fsus-table__tree-spacer' }),
                                  ]
                                : []

                            return h(
                              'td',
                              {
                                key: col.key,
                                class: 'fsus-table__td',
                                rowspan: span.rowspan > 1 ? span.rowspan : undefined,
                                colspan: span.colspan > 1 ? span.colspan : undefined,
                                style: stickyStyleForCol(col),
                                ...fixedDataAttrs(col),
                              },
                              treePrefix.length > 0 ? [...treePrefix, content] : content,
                            )
                          }),
                        ],
                      )

                      if (!isExpanded) return [mainRow]

                      const expandRow = h(
                        'tr',
                        { key: `${String(rKey)}-expand`, class: 'fsus-table__expand-row' },
                        [
                          h(
                            'td',
                            { class: 'fsus-table__expand-content', colspan: totalColCount },
                            slots.expand?.({ row, index: realIdx }),
                          ),
                        ],
                      )
                      return [mainRow, expandRow]
                    }),
                    slice.bottomPad > 0
                      ? h('tr', { style: { height: `${slice.bottomPad}px` }, 'aria-hidden': 'true' })
                      : null,
                  ],
            ]),
            props.showSummary && rows.length > 0
              ? h('tfoot', { class: 'fsus-table__foot' }, [
                  h('tr', { class: 'fsus-table__summary-row' }, [
                    props.expandable ? h('td', { class: 'fsus-table__td fsus-table__summary-cell' }) : null,
                    props.selectable ? h('td', { class: 'fsus-table__td fsus-table__summary-cell' }) : null,
                    ...cols.map((col, idx) =>
                      h(
                        'td',
                        {
                          key: `sum-${col.key}`,
                          class: 'fsus-table__td fsus-table__summary-cell',
                          style: stickyStyleForCol(col),
                          ...fixedDataAttrs(col),
                        },
                        [summaryValues.value[idx] ?? ''],
                      ),
                    ),
                  ]),
                ])
              : null,
          ]),
        ],
      )
    }
  },
})
