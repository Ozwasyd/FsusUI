import { computed, defineComponent, h, ref, type PropType } from 'vue'
import { addUnit, useFsusLocale, useResizeObserver } from '@fsusui/core'
import {
  buildHeaderRows,
  computeFixedOffsets,
  computeLeadingUtilityWidth,
  flattenLeaves,
  parseColumnsFromVNodes,
} from './column-model'
import {
  computeSummaryValues,
  computeVisibleSlice,
  filterTableRows,
  flattenTreeRows,
  hasTreeChildren,
  isTableVirtualized,
  sortTableRows,
} from './row-model'
import { renderTableBody, renderTableFooter, renderTableHeader } from './render'
import { useTableState } from './use-table-state'
import type {
  FsusSortOrder,
  FsusTableColumnDef,
  FsusTableFilterOption,
  FsusTableSpanMethod,
  FsusTableSpanResult,
  FsusTableSummaryMethod,
} from './types'

export type {
  FsusSortOrder,
  FsusTableColumnDef,
  FsusTableFilterOption,
  FsusTableSpanMethod,
  FsusTableSpanResult,
  FsusTableSummaryMethod,
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
    const state = useTableState(props, emit, wrapperRef)

    const resolvedTreeColumns = computed<FsusTableColumnDef[]>(() => {
      if (props.columns.length > 0) return props.columns
      return parseColumnsFromVNodes(slots.default?.() ?? [])
    })
    const headerRows = computed(() => buildHeaderRows(resolvedTreeColumns.value))
    const leafColumns = computed(() => flattenLeaves(resolvedTreeColumns.value))

    const leadingUtilityWidth = computed(() =>
      computeLeadingUtilityWidth(props.expandable, props.selectable),
    )
    const fixedOffsets = computed(() =>
      computeFixedOffsets(leafColumns.value, state.columnWidths, leadingUtilityWidth.value),
    )

    const filteredData = computed(() =>
      filterTableRows(props.data, leafColumns.value, state.activeFilters),
    )
    const sortedData = computed(() =>
      sortTableRows(filteredData.value, state.sortKey.value, state.sortOrder.value),
    )
    const hasTreeData = computed(() => hasTreeChildren(sortedData.value, props.childrenKey))
    const flatRows = computed(() =>
      flattenTreeRows(sortedData.value, props.rowKey, props.childrenKey, state.treeExpandedKeys.value),
    )

    const isVirtualized = computed(() =>
      isTableVirtualized({
        height: props.height,
        expandable: props.expandable,
        hasSpanMethod: Boolean(props.spanMethod),
        rowCount: flatRows.value.length,
        virtualThreshold: props.virtualThreshold,
      }),
    )
    const viewportPx = computed(() => (typeof props.height === 'number' ? props.height : 400))
    const visibleSlice = computed(() =>
      computeVisibleSlice({
        virtualized: isVirtualized.value,
        rowCount: flatRows.value.length,
        scrollTop: state.scrollTop.value,
        rowHeight: props.rowHeight,
        viewportPx: viewportPx.value,
      }),
    )

    const { allSelected, toggleAll } = state.createSelectionHelpers(flatRows)

    const summaryValues = computed(() =>
      computeSummaryValues({
        showSummary: props.showSummary,
        leafColumns: leafColumns.value,
        rows: flatRows.value.map((r) => r.row),
        summaryMethod: props.summaryMethod,
        sumText: props.sumText,
        defaultSumText: t('table.sumText'),
      }),
    )

    return () => {
      const cols = leafColumns.value
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
          'data-scroll-left': state.scrollLeft.value > 0 ? '' : undefined,
          'data-scroll-right': state.canScrollRight.value ? '' : undefined,
          style: props.height !== undefined ? { maxHeight: addUnit(props.height) } : undefined,
          onScroll: state.handleScroll,
        },
        [
          h('table', { class: 'fsus-table__table' }, [
            renderTableHeader({
              headerRows: headerRows.value,
              expandable: props.expandable,
              selectable: props.selectable,
              resizable: props.resizable,
              allSelected: allSelected.value,
              sortKey: state.sortKey.value,
              sortOrder: state.sortOrder.value,
              activeFilters: state.activeFilters,
              draftFilters: state.draftFilters,
              openFilterKey: state.openFilterKey.value,
              columnWidths: state.columnWidths,
              fixedOffsets: fixedOffsets.value,
              t,
              onToggleAll: toggleAll,
              onToggleSort: state.toggleSort,
              onToggleFilterPopover: state.toggleFilterPopover,
              onToggleDraftFilterValue: state.toggleDraftFilterValue,
              onResetFilter: state.resetFilter,
              onApplyFilter: state.applyFilter,
              onStartResize: state.startResize,
            }),
            renderTableBody({
              columns: cols,
              rows,
              slice,
              totalColCount,
              expandable: props.expandable,
              selectable: props.selectable,
              hasTreeData: hasTreeData.value,
              treeIndent: props.treeIndent,
              selectedSet: state.selectedSet.value,
              expandedSet: state.expandedSet.value,
              columnWidths: state.columnWidths,
              fixedOffsets: fixedOffsets.value,
              spanMethod: props.spanMethod,
              emptyContent: slots.empty ? slots.empty() : (props.emptyText ?? t('table.empty')),
              renderCellSlot: (colKey, scope) => slots[`cell-${colKey}`]?.(scope),
              renderExpandSlot: (scope) => slots.expand?.(scope),
              onRowClick: (row, realIdx) => emit('rowClick', row, realIdx),
              onToggleExpandRow: state.toggleExpandRow,
              onToggleRow: state.toggleRow,
              onToggleTreeRow: state.toggleTreeRow,
            }),
            props.showSummary && rows.length > 0
              ? renderTableFooter({
                  columns: cols,
                  expandable: props.expandable,
                  selectable: props.selectable,
                  summaryValues: summaryValues.value,
                  columnWidths: state.columnWidths,
                  fixedOffsets: fixedOffsets.value,
                })
              : null,
          ]),
        ],
      )
    }
  },
})
