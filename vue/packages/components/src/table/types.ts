import type { VNode } from 'vue'

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
  slotRender?: (scope: {
    row: Row
    column: FsusTableColumnDef<Row>
    value: unknown
    index: number
  }) => VNode[] | undefined
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

export interface TableHeaderCell {
  col: FsusTableColumnDef
  colspan: number
  rowspan: number
  isLeaf: boolean
  leafIndex: number
}

export interface TableFlatRow {
  row: Record<string, any>
  key: string | number
  depth: number
  hasChildren: boolean
  treeExpanded: boolean
}

export interface TableVisibleSlice {
  start: number
  end: number
  topPad: number
  bottomPad: number
}

export interface TableFixedOffsets {
  leftMap: Map<string, number>
  rightMap: Map<string, number>
  lastLeftKey: string
  firstRightKey: string
}

export interface TableSpan {
  rowspan: number
  colspan: number
}
