import type { VNode } from 'vue'
import { getByPath } from '@fsusui/core'
import type {
  FsusSortOrder,
  FsusTableColumnDef,
  FsusTableSummaryMethod,
  TableFlatRow,
  TableVisibleSlice,
} from './types'

export const collectTreeParentKeys = (
  rows: Record<string, any>[],
  rowKey: string,
  childrenKey: string,
  out = new Set<string | number>(),
): Set<string | number> => {
  rows.forEach((row, idx) => {
    const kids = row[childrenKey]
    if (Array.isArray(kids) && kids.length > 0) {
      out.add(row[rowKey] ?? idx)
      collectTreeParentKeys(kids, rowKey, childrenKey, out)
    }
  })
  return out
}

export const filterTableRows = (
  data: Record<string, any>[],
  leafColumns: FsusTableColumnDef[],
  activeFilters: Record<string, unknown[]>,
): Record<string, any>[] => {
  const filterEntries = Object.entries(activeFilters).filter(([, vals]) => vals.length > 0)
  if (filterEntries.length === 0) return data
  return data.filter((row) =>
    filterEntries.every(([colKey, values]) => {
      const col = leafColumns.find((c) => c.key === colKey)
      if (!col) return true
      return values.some((val) => {
        if (col.filterMethod) return col.filterMethod(val, row, col)
        const cellVal = col.prop ? getByPath(row, col.prop) : row[col.key]
        return cellVal === val
      })
    }),
  )
}

export const sortTableRows = (
  data: Record<string, any>[],
  sortKey: string,
  sortOrder: FsusSortOrder,
): Record<string, any>[] => {
  if (!sortKey || !sortOrder) return data
  const dir = sortOrder === 'asc' ? 1 : -1
  return [...data].sort((a, b) => {
    const va = getByPath(a, sortKey)
    const vb = getByPath(b, sortKey)
    if (va === vb) return 0
    if (va === undefined || va === null) return 1
    if (vb === undefined || vb === null) return -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb)) * dir
  })
}

export const hasTreeChildren = (rows: Record<string, any>[], childrenKey: string): boolean =>
  rows.some((row) => Array.isArray(row[childrenKey]) && row[childrenKey].length > 0)

export const flattenTreeRows = (
  rows: Record<string, any>[],
  rowKey: string,
  childrenKey: string,
  treeExpandedKeys: Set<string | number>,
): TableFlatRow[] => {
  const out: TableFlatRow[] = []
  const walk = (list: Record<string, any>[], depth: number, prefix: string) => {
    list.forEach((row, idx) => {
      const key = row[rowKey] ?? `${prefix}${idx}`
      const kids = row[childrenKey]
      const hasChildren = Array.isArray(kids) && kids.length > 0
      const treeExpanded = treeExpandedKeys.has(key)
      out.push({ row, key, depth, hasChildren, treeExpanded })
      if (hasChildren && treeExpanded) {
        walk(kids, depth + 1, `${key}-`)
      }
    })
  }
  walk(rows, 0, '')
  return out
}

export const isTableVirtualized = (options: {
  height: number | string | undefined
  expandable: boolean
  hasSpanMethod: boolean
  rowCount: number
  virtualThreshold: number
}): boolean =>
  options.height !== undefined &&
  !options.expandable &&
  !options.hasSpanMethod &&
  options.rowCount > options.virtualThreshold

export const computeVisibleSlice = (options: {
  virtualized: boolean
  rowCount: number
  scrollTop: number
  rowHeight: number
  viewportPx: number
}): TableVisibleSlice => {
  if (!options.virtualized) {
    return { start: 0, end: options.rowCount, topPad: 0, bottomPad: 0 }
  }
  const start = Math.max(0, Math.floor(options.scrollTop / options.rowHeight) - 5)
  const count = Math.ceil(options.viewportPx / options.rowHeight) + 10
  const end = Math.min(options.rowCount, start + count)
  return {
    start,
    end,
    topPad: start * options.rowHeight,
    bottomPad: Math.max(0, (options.rowCount - end) * options.rowHeight),
  }
}

export const computeSummaryValues = (options: {
  showSummary: boolean
  leafColumns: FsusTableColumnDef[]
  rows: Record<string, any>[]
  summaryMethod?: FsusTableSummaryMethod
  sumText?: string
  defaultSumText: string
}): Array<string | number | VNode> => {
  if (!options.showSummary) return []
  if (options.summaryMethod) {
    return options.summaryMethod({ columns: options.leafColumns, data: options.rows })
  }
  return options.leafColumns.map((col, idx) => {
    if (idx === 0) return options.sumText ?? options.defaultSumText
    const nums = options.rows
      .map((row) => Number(col.prop ? getByPath(row, col.prop) : row[col.key]))
      .filter((n) => Number.isFinite(n))
    if (nums.length === 0) return ''
    const sum = nums.reduce((a, b) => a + b, 0)
    return Number.isInteger(sum) ? String(sum) : sum.toFixed(2)
  })
}
