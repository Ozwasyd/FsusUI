import { h, type VNode } from 'vue'
import { addUnit, getByPath } from '@fsusui/core'
import { FsusIcon } from '@fsusui/icons'
import { resolveCellSpan, resolveColumnWidthPx } from './column-model'
import type {
  FsusSortOrder,
  FsusTableColumnDef,
  FsusTableSpanMethod,
  TableFixedOffsets,
  TableFlatRow,
  TableHeaderCell,
  TableVisibleSlice,
} from './types'

export const getStickyStyleForColumn = (
  col: FsusTableColumnDef,
  columnWidths: Record<string, number>,
  fixedOffsets: TableFixedOffsets,
): Record<string, string | undefined> => {
  const widthPx = resolveColumnWidthPx(col, columnWidths)
  const style: Record<string, string | undefined> = {
    width: widthPx !== undefined ? `${widthPx}px` : addUnit(col.width),
    minWidth: col.minWidth ? `${col.minWidth}px` : undefined,
    textAlign: col.align ?? 'left',
  }
  if (col.fixed === 'left') {
    style.position = 'sticky'
    style.left = `${fixedOffsets.leftMap.get(col.key) ?? 0}px`
  } else if (col.fixed === 'right') {
    style.position = 'sticky'
    style.right = `${fixedOffsets.rightMap.get(col.key) ?? 0}px`
  }
  return style
}

export const getFixedDataAttrs = (col: FsusTableColumnDef, fixedOffsets: TableFixedOffsets) => ({
  'data-fixed': col.fixed,
  'data-fixed-edge':
    col.fixed === 'left' && col.key === fixedOffsets.lastLeftKey
      ? 'left'
      : col.fixed === 'right' && col.key === fixedOffsets.firstRightKey
        ? 'right'
        : undefined,
})

export interface RenderTableHeaderContext {
  headerRows: TableHeaderCell[][]
  expandable: boolean
  selectable: boolean
  resizable: boolean
  allSelected: boolean
  sortKey: string
  sortOrder: FsusSortOrder
  activeFilters: Record<string, unknown[]>
  draftFilters: Record<string, unknown[]>
  openFilterKey: string | null
  columnWidths: Record<string, number>
  fixedOffsets: TableFixedOffsets
  t: (path: string) => string
  onToggleAll: () => void
  onToggleSort: (col: FsusTableColumnDef) => void
  onToggleFilterPopover: (col: FsusTableColumnDef, event: MouseEvent) => void
  onToggleDraftFilterValue: (col: FsusTableColumnDef, val: unknown) => void
  onResetFilter: (col: FsusTableColumnDef) => void
  onApplyFilter: (col: FsusTableColumnDef) => void
  onStartResize: (col: FsusTableColumnDef, event: PointerEvent) => void
}

export const renderTableHeader = (ctx: RenderTableHeaderContext): VNode =>
  h(
    'thead',
    { class: 'fsus-table__head' },
    ctx.headerRows.map((rowCells, depthIdx) =>
      h('tr', { key: `h-${depthIdx}` }, [
        depthIdx === 0 && ctx.expandable
          ? h('th', {
              class: 'fsus-table__th fsus-table__expand-cell',
              rowspan: ctx.headerRows.length,
              'aria-label': 'Expand',
            })
          : null,
        depthIdx === 0 && ctx.selectable
          ? h(
              'th',
              {
                class: 'fsus-table__th fsus-table__check-cell',
                rowspan: ctx.headerRows.length,
              },
              [
                h('input', {
                  type: 'checkbox',
                  checked: ctx.allSelected,
                  'aria-label': ctx.t('table.selectAll'),
                  onChange: ctx.onToggleAll,
                }),
              ],
            )
          : null,
        ...rowCells.map(({ col, colspan, rowspan, isLeaf }) => {
          const activeSort = isLeaf && ctx.sortKey === (col.prop ?? col.key)
          const hasFilter = isLeaf && Boolean(col.filters?.length)
          const filterActive = (ctx.activeFilters[col.key]?.length ?? 0) > 0
          const canResize = isLeaf && (col.resizable ?? ctx.resizable)
          return h(
            'th',
            {
              key: `${depthIdx}-${col.key}`,
              class: 'fsus-table__th',
              colspan: colspan > 1 ? colspan : undefined,
              rowspan: rowspan > 1 ? rowspan : undefined,
              style: isLeaf
                ? getStickyStyleForColumn(col, ctx.columnWidths, ctx.fixedOffsets)
                : { textAlign: col.align ?? 'center' },
              ...(isLeaf ? getFixedDataAttrs(col, ctx.fixedOffsets) : {}),
              'data-sortable': isLeaf && col.sortable ? '' : undefined,
              'data-filtered': filterActive ? '' : undefined,
              'aria-sort': activeSort
                ? ctx.sortOrder === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined,
              onClick: () => isLeaf && ctx.onToggleSort(col),
            },
            [
              h('span', { class: 'fsus-table__th-inner' }, [
                h('span', { class: 'fsus-table__th-label' }, col.label),
                isLeaf && col.sortable
                  ? h(FsusIcon, {
                      name: activeSort && ctx.sortOrder === 'desc' ? 'sort-down' : 'sort-up',
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
                        'aria-expanded': ctx.openFilterKey === col.key ? 'true' : 'false',
                        'data-active': filterActive ? '' : undefined,
                        onClick: (e: MouseEvent) => ctx.onToggleFilterPopover(col, e),
                      },
                      [h(FsusIcon, { name: 'filter', size: 12 })],
                    )
                  : null,
              ]),
              hasFilter && ctx.openFilterKey === col.key
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
                          const checked = (ctx.draftFilters[col.key] ?? []).includes(opt.value)
                          return h('label', { key: String(opt.value), class: 'fsus-table__filter-item' }, [
                            h('input', {
                              type: col.filterMultiple === false ? 'radio' : 'checkbox',
                              checked,
                              onChange: () => ctx.onToggleDraftFilterValue(col, opt.value),
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
                            onClick: () => ctx.onResetFilter(col),
                          },
                          ctx.t('table.filterReset'),
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            class: 'fsus-table__filter-btn',
                            'data-primary': '',
                            onClick: () => ctx.onApplyFilter(col),
                          },
                          ctx.t('table.filterConfirm'),
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
                    onPointerdown: (e: PointerEvent) => ctx.onStartResize(col, e),
                    onClick: (e: MouseEvent) => e.stopPropagation(),
                  })
                : null,
            ],
          )
        }),
      ]),
    ),
  )

export interface RenderTableBodyContext {
  columns: FsusTableColumnDef[]
  rows: TableFlatRow[]
  slice: TableVisibleSlice
  totalColCount: number
  expandable: boolean
  selectable: boolean
  hasTreeData: boolean
  treeIndent: number
  selectedSet: Set<string | number>
  expandedSet: Set<string | number>
  columnWidths: Record<string, number>
  fixedOffsets: TableFixedOffsets
  spanMethod?: FsusTableSpanMethod
  emptyContent: VNode[] | string
  renderCellSlot: (
    colKey: string,
    scope: { row: Record<string, any>; column: FsusTableColumnDef; value: unknown; index: number },
  ) => VNode[] | undefined
  renderExpandSlot: (scope: { row: Record<string, any>; index: number }) => VNode[] | undefined
  onRowClick: (row: Record<string, any>, realIdx: number) => void
  onToggleExpandRow: (row: Record<string, any>, key: string | number) => void
  onToggleRow: (key: string | number) => void
  onToggleTreeRow: (key: string | number) => void
}

export const renderTableBody = (ctx: RenderTableBodyContext): VNode =>
  h('tbody', { class: 'fsus-table__body' }, [
    ctx.rows.length === 0
      ? h('tr', [
          h(
            'td',
            { class: 'fsus-table__empty', colspan: Math.max(ctx.totalColCount, 1) },
            ctx.emptyContent,
          ),
        ])
      : [
          ctx.slice.topPad > 0
            ? h('tr', { style: { height: `${ctx.slice.topPad}px` }, 'aria-hidden': 'true' })
            : null,
          ...ctx.rows.flatMap((flatItem, offset) => {
            const realIdx = ctx.slice.start + offset
            const { row, key: rKey, depth, hasChildren, treeExpanded } = flatItem
            const selected = ctx.selectedSet.has(rKey)
            const isExpanded = ctx.expandable && ctx.expandedSet.has(rKey)

            const mainRow = h(
              'tr',
              {
                key: String(rKey),
                class: 'fsus-table__row',
                'data-selected': selected ? '' : undefined,
                'data-expanded': isExpanded ? '' : undefined,
                onClick: () => ctx.onRowClick(row, realIdx),
              },
              [
                ctx.expandable
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
                            ctx.onToggleExpandRow(row, rKey)
                          },
                        },
                        [h(FsusIcon, { name: isExpanded ? 'caret-bottom' : 'caret-right', size: 12 })],
                      ),
                    ])
                  : null,
                ctx.selectable
                  ? h('td', { class: 'fsus-table__td fsus-table__check-cell' }, [
                      h('input', {
                        type: 'checkbox',
                        checked: selected,
                        onClick: (e: MouseEvent) => e.stopPropagation(),
                        onChange: () => ctx.onToggleRow(rKey),
                      }),
                    ])
                  : null,
                ...ctx.columns.map((col, colIdx) => {
                  const span = resolveCellSpan(ctx.spanMethod, row, col, realIdx, colIdx)
                  if (span.rowspan === 0 || span.colspan === 0) return null
                  const raw = col.prop ? getByPath(row, col.prop) : row[col.key]
                  const customCell = ctx.renderCellSlot(col.key, {
                    row,
                    column: col,
                    value: raw,
                    index: realIdx,
                  })
                  const content =
                    customCell !== undefined
                      ? customCell
                      : col.slotRender
                        ? col.slotRender({ row, column: col, value: raw, index: realIdx })
                        : col.formatter
                          ? [col.formatter(row, realIdx)]
                          : raw !== undefined && raw !== null
                            ? String(raw)
                            : ''

                  const treePrefix =
                    colIdx === 0 && (ctx.hasTreeData || depth > 0)
                      ? [
                          h('span', {
                            class: 'fsus-table__tree-indent',
                            style: { paddingLeft: `${depth * ctx.treeIndent}px` },
                          }),
                          hasChildren
                            ? h(
                                'button',
                                {
                                  type: 'button',
                                  class: 'fsus-table__tree-toggle',
                                  'aria-expanded': treeExpanded ? 'true' : 'false',
                                  'aria-label': treeExpanded
                                    ? 'Collapse child rows'
                                    : 'Expand child rows',
                                  onClick: (e: MouseEvent) => {
                                    e.stopPropagation()
                                    ctx.onToggleTreeRow(rKey)
                                  },
                                },
                                [
                                  h(FsusIcon, {
                                    name: treeExpanded ? 'caret-bottom' : 'caret-right',
                                    size: 12,
                                  }),
                                ],
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
                      style: getStickyStyleForColumn(col, ctx.columnWidths, ctx.fixedOffsets),
                      ...getFixedDataAttrs(col, ctx.fixedOffsets),
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
                  { class: 'fsus-table__expand-content', colspan: ctx.totalColCount },
                  ctx.renderExpandSlot({ row, index: realIdx }),
                ),
              ],
            )
            return [mainRow, expandRow]
          }),
          ctx.slice.bottomPad > 0
            ? h('tr', { style: { height: `${ctx.slice.bottomPad}px` }, 'aria-hidden': 'true' })
            : null,
        ],
  ])

export interface RenderTableFooterContext {
  columns: FsusTableColumnDef[]
  expandable: boolean
  selectable: boolean
  summaryValues: Array<string | number | VNode>
  columnWidths: Record<string, number>
  fixedOffsets: TableFixedOffsets
}

export const renderTableFooter = (ctx: RenderTableFooterContext): VNode =>
  h('tfoot', { class: 'fsus-table__foot' }, [
    h('tr', { class: 'fsus-table__summary-row' }, [
      ctx.expandable ? h('td', { class: 'fsus-table__td fsus-table__summary-cell' }) : null,
      ctx.selectable ? h('td', { class: 'fsus-table__td fsus-table__summary-cell' }) : null,
      ...ctx.columns.map((col, idx) =>
        h(
          'td',
          {
            key: `sum-${col.key}`,
            class: 'fsus-table__td fsus-table__summary-cell',
            style: getStickyStyleForColumn(col, ctx.columnWidths, ctx.fixedOffsets),
            ...getFixedDataAttrs(col, ctx.fixedOffsets),
          },
          [ctx.summaryValues[idx] ?? ''],
        ),
      ),
    ]),
  ])
