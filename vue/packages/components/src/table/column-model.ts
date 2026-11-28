import type { VNode } from 'vue'
import type {
  FsusTableColumnDef,
  FsusTableSpanMethod,
  TableFixedOffsets,
  TableHeaderCell,
  TableSpan,
} from './types'

export const parseColumnsFromVNodes = (vnodes: VNode[]): FsusTableColumnDef[] => {
  const out: FsusTableColumnDef[] = []
  for (let i = 0; i < vnodes.length; i++) {
    const v = vnodes[i]
    if (!v || (v.type as { name?: string })?.name !== 'FsusTableColumn') continue
    const childSlot = (v.children as { default?: (scope?: any) => VNode[] } | null)?.default
    let nestedCols: FsusTableColumnDef[] = []
    if (childSlot) {
      try {
        const probe = childSlot({ row: {}, column: {}, value: undefined, index: 0 })
        if (
          Array.isArray(probe) &&
          probe.some((c) => (c?.type as { name?: string })?.name === 'FsusTableColumn')
        ) {
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

export const getMaxDepth = (cols: FsusTableColumnDef[]): number => {
  let max = 1
  for (const col of cols) {
    if (col.children?.length) {
      max = Math.max(max, 1 + getMaxDepth(col.children))
    }
  }
  return max
}

export const countLeaves = (col: FsusTableColumnDef): number => {
  if (!col.children?.length) return 1
  return col.children.reduce((acc, c) => acc + countLeaves(c), 0)
}

export const flattenLeaves = (
  cols: FsusTableColumnDef[],
  out: FsusTableColumnDef[] = [],
): FsusTableColumnDef[] => {
  for (const col of cols) {
    if (col.children?.length) flattenLeaves(col.children, out)
    else out.push(col)
  }
  return out
}

export const buildHeaderRows = (cols: FsusTableColumnDef[]): TableHeaderCell[][] => {
  const maxDepth = getMaxDepth(cols)
  const rows: TableHeaderCell[][] = Array.from({ length: maxDepth }, () => [])
  let leafCursor = 0
  const walk = (list: FsusTableColumnDef[], depth: number) => {
    for (const col of list) {
      const hasKids = Boolean(col.children?.length)
      const colspan = countLeaves(col)
      const rowspan = hasKids ? 1 : maxDepth - depth
      const cell: TableHeaderCell = {
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

export const parseColumnPx = (value: number | string | undefined, fallback = 140): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = Number.parseFloat(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

export const resolveColumnWidthPx = (
  col: FsusTableColumnDef,
  columnWidths: Record<string, number>,
): number | undefined => {
  if (columnWidths[col.key] !== undefined) return columnWidths[col.key]
  if (col.width !== undefined) return parseColumnPx(col.width)
  return undefined
}

export const computeLeadingUtilityWidth = (expandable: boolean, selectable: boolean): number => {
  let width = 0
  if (expandable) width += 42
  if (selectable) width += 42
  return width
}

export const computeFixedOffsets = (
  leafColumns: FsusTableColumnDef[],
  columnWidths: Record<string, number>,
  leadingUtilityWidth: number,
): TableFixedOffsets => {
  const leftMap = new Map<string, number>()
  const rightMap = new Map<string, number>()
  let lastLeftKey = ''
  let firstRightKey = ''

  let leftAcc = leadingUtilityWidth
  for (const col of leafColumns) {
    if (col.fixed === 'left') {
      leftMap.set(col.key, leftAcc)
      leftAcc += resolveColumnWidthPx(col, columnWidths) ?? 140
      lastLeftKey = col.key
    }
  }
  let rightAcc = 0
  for (let i = leafColumns.length - 1; i >= 0; i--) {
    const col = leafColumns[i]!
    if (col.fixed === 'right') {
      rightMap.set(col.key, rightAcc)
      rightAcc += resolveColumnWidthPx(col, columnWidths) ?? 140
      firstRightKey = col.key
    }
  }
  return { leftMap, rightMap, lastLeftKey, firstRightKey }
}

export const resolveCellSpan = (
  spanMethod: FsusTableSpanMethod | undefined,
  row: Record<string, any>,
  col: FsusTableColumnDef,
  rowIndex: number,
  columnIndex: number,
): TableSpan => {
  if (!spanMethod) return { rowspan: 1, colspan: 1 }
  const res = spanMethod({ row, column: col, rowIndex, columnIndex })
  if (Array.isArray(res)) return { rowspan: res[0], colspan: res[1] }
  if (res && typeof res === 'object') return { rowspan: res.rowspan, colspan: res.colspan }
  return { rowspan: 1, colspan: 1 }
}
