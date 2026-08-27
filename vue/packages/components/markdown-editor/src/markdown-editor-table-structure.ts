import {
  createMarkdownEditorProjection,
  createMarkdownTableEntries,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
} from '../../../wasm/markdown-runtime'
import type { MarkdownEditorTransaction } from './markdown-editor-transaction'
import {
  insertMarkdownTable,
  parseMarkdownTableBlock,
  serializeMarkdownTable,
  type MarkdownTableAlignment,
  type ParsedMarkdownTable,
} from './markdown-editor-table'

export type { MarkdownTableAlignment }

const createSourceTableEntries = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
) => {
  const entries: Array<{ id: string; range: { start: number; end: number } }> = []
  const linePattern = /.*(?:\r\n|\r|\n|$)/gu
  const lines = source.match(linePattern)?.filter(Boolean) ?? []
  let offset = 0
  let index = 0
  while (index < lines.length) {
    const start = offset
    const block: string[] = []
    let lastValidEnd = -1
    while (index < lines.length) {
      const raw = lines[index]!
      const line = raw.replace(/(?:\r\n|\r|\n)$/u, '')
      if (!line.includes('|')) break
      block.push(line)
      offset += raw.length
      index++
      if (parseMarkdownTableBlock(block.join('\n'))) lastValidEnd = offset
    }
    if (lastValidEnd >= 0) {
      entries.push({
        id: `syn:${documentIdentity.id}:${documentIdentity.epoch}:table-source:${start}`,
        range: { start, end: lastValidEnd },
      })
    }
    if (offset === start) {
      offset += lines[index]?.length ?? 0
      index++
    }
  }
  return entries
}

const createTableEntries = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
) => {
  const stable = createMarkdownTableEntries(
    stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      documentIdentity,
    ),
  )
  return stable.length > 0
    ? stable
    : createSourceTableEntries(source, documentIdentity)
}

export const resolveMarkdownTableEntry = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
) =>
  createTableEntries(source, documentIdentity).find(
    (entry) => entry.id === tableId,
  ) ?? null

export interface MarkdownTableCellIdentity {
  readonly tableId: string
  /** Opaque identity retained while row/column coordinates are remapped. */
  readonly cellId?: string
  /** Exact source range used to validate and restore the current cell. */
  readonly anchor?: Readonly<{ start: number; end: number }>
  readonly row: number // 0 is header, 1..N are body rows
  readonly column: number // 0..columnCount-1
  readonly status: 'current' | 'deleted' | 'invalid'
}

const scanCellRanges = (line: string, lineStart: number) => {
  const ranges: Array<{ start: number; end: number }> = []
  let cellStart = line.startsWith('|') ? 1 : 0
  let escaped = false
  let backtickRun = 0
  for (let index = cellStart; index <= line.length; index++) {
    const character = line[index]
    if (index === line.length || (character === '|' && !escaped && backtickRun === 0)) {
      ranges.push({ start: lineStart + cellStart, end: lineStart + index })
      cellStart = index + 1
      escaped = false
      continue
    }
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if (character === '`') {
      let run = 1
      while (line[index + run] === '`') run++
      backtickRun = backtickRun === run ? 0 : backtickRun === 0 ? run : backtickRun
      index += run - 1
    }
  }
  if (line.endsWith('|')) ranges.pop()
  return ranges
}

export const resolveMarkdownTableCellAtOffset = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  offset: number,
): MarkdownTableCellIdentity | null => {
  const table = createTableEntries(source, documentIdentity).find(
    (entry) => offset >= entry.range.start && offset <= entry.range.end,
  )
  if (!table) return null
  const slice = source.slice(table.range.start, table.range.end)
  if (!parseMarkdownTableBlock(slice)) return null
  const lines = slice.split(/\r\n|\r|\n/)
  let relativeLineStart = 0
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!
    const lineEnd = relativeLineStart + line.length
    if (offset <= table.range.start + lineEnd) {
      if (lineIndex === 1) return null
      const row = lineIndex === 0 ? 0 : lineIndex - 1
      const ranges = scanCellRanges(line, table.range.start + relativeLineStart)
      const column = ranges.findIndex(
        (range) => offset >= range.start && offset <= range.end,
      )
      if (column < 0) return null
      const anchor = Object.freeze(ranges[column]!)
      return Object.freeze({
        anchor,
        cellId: `${table.id}:cell:${anchor.start}:${anchor.end}`,
        column,
        row,
        status: 'current' as const,
        tableId: table.id,
      })
    }
    relativeLineStart = lineEnd + (slice.slice(lineEnd).startsWith('\r\n') ? 2 : 1)
  }
  return null
}

export const resolveMarkdownTableCellCoordinates = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  row: number,
  column: number,
  cellId?: string,
): MarkdownTableCellIdentity | null => {
  const table = resolveTableEntry(source, documentIdentity, tableId)
  if (!table) return null
  const slice = source.slice(table.range.start, table.range.end)
  const lines = slice.split(/\r\n|\r|\n/)
  const lineIndex = row === 0 ? 0 : row + 1
  const line = lines[lineIndex]
  if (line === undefined) return null
  let lineStart = 0
  for (let index = 0; index < lineIndex; index++) {
    lineStart += lines[index]!.length
    lineStart += slice.slice(lineStart).startsWith('\r\n') ? 2 : 1
  }
  const anchor = scanCellRanges(line, table.range.start + lineStart)[column]
  if (!anchor) return null
  return Object.freeze({
    anchor: Object.freeze(anchor),
    cellId: cellId ?? `${table.id}:cell:${anchor.start}:${anchor.end}`,
    column,
    row,
    status: 'current' as const,
    tableId: table.id,
  })
}

export type MarkdownTableStructuralOp =
  | { readonly type: 'insert-row'; readonly index: number }
  | { readonly type: 'delete-row'; readonly index: number }
  | { readonly type: 'move-row'; readonly fromIndex: number; readonly toIndex: number }
  | { readonly type: 'insert-column'; readonly index: number }
  | { readonly type: 'delete-column'; readonly index: number }
  | { readonly type: 'move-column'; readonly fromIndex: number; readonly toIndex: number }
  | { readonly type: 'delete-table' }

export type MarkdownTableRejection = 'malformed' | 'stale' | 'missing'

const resolveTableEntry = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
) => {
  if (documentIdentity.epoch < 1) return null
  return resolveMarkdownTableEntry(source, documentIdentity, tableId)
}

const buildTransaction = (
  tableRange: { start: number; end: number },
  slice: string,
  parsed: ParsedMarkdownTable,
  expectedRevision?: number,
  pad = false,
): MarkdownEditorTransaction => {
  let serialized = serializeMarkdownTable(parsed, pad)
  if (slice.endsWith('\n') && !serialized.endsWith('\n')) {
    serialized += '\n'
  } else if (!slice.endsWith('\n') && serialized.endsWith('\n')) {
    serialized = serialized.slice(0, -1)
  }
  return {
    changes: [
      {
        from: tableRange.start,
        to: tableRange.end,
        insert: serialized,
      },
    ],
    expectedRevision,
    history: 'separate',
    origin: 'command',
  }
}

export const planMarkdownTableInsert = (
  source: string,
  offset: number,
  rows: number,
  columns: number,
): MarkdownEditorTransaction => {
  const table = insertMarkdownTable({ rows, columns })
  const prefix = offset > 0 && source[offset - 1] !== '\n' ? '\n' : ''
  const suffix = offset < source.length && source[offset] !== '\n' ? '\n' : ''
  return {
    changes: [{ from: offset, to: offset, insert: `${prefix}${table}\n${suffix}` }],
    history: 'separate',
    origin: 'command',
  }
}

export const planMarkdownTableInsertRow = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  rowIndex: number,
  position: 'above' | 'below',
  expectedRevision?: number,
): MarkdownEditorTransaction | { readonly rejected: MarkdownTableRejection } => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  const table = resolveTableEntry(source, documentIdentity, tableId)
  if (!table) return { rejected: 'missing' }

  const slice = source.slice(table.range.start, table.range.end)
  const parsed = parseMarkdownTableBlock(slice)
  if (!parsed) return { rejected: 'malformed' }

  // rowIndex: 0 is header, >= 1 are body rows
  let insertAtBodyIndex: number
  if (rowIndex <= 0) {
    // Cannot insert above header; inserting below header or above header inserts as first body row
    insertAtBodyIndex = 0
  } else {
    const bodyIndex = rowIndex - 1
    insertAtBodyIndex = position === 'above' ? bodyIndex : bodyIndex + 1
  }
  insertAtBodyIndex = Math.max(0, Math.min(insertAtBodyIndex, parsed.rows.length))

  const newRow = Array.from({ length: parsed.columnCount }, () => '')
  const nextRows = [
    ...parsed.rows.slice(0, insertAtBodyIndex),
    newRow,
    ...parsed.rows.slice(insertAtBodyIndex),
  ]

  const nextTable: ParsedMarkdownTable = {
    ...parsed,
    rows: Object.freeze(nextRows.map((r) => Object.freeze(r))),
  }
  return buildTransaction(table.range, slice, nextTable, expectedRevision)
}

export const planMarkdownTableDeleteRow = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  rowIndex: number,
  expectedRevision?: number,
): MarkdownEditorTransaction | { readonly rejected: MarkdownTableRejection } => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  const table = resolveTableEntry(source, documentIdentity, tableId)
  if (!table) return { rejected: 'missing' }

  const slice = source.slice(table.range.start, table.range.end)
  const parsed = parseMarkdownTableBlock(slice)
  if (!parsed) return { rejected: 'malformed' }

  // GFM table must have a header row; cannot delete header row
  if (rowIndex <= 0) return { rejected: 'malformed' }
  const bodyIndex = rowIndex - 1
  if (bodyIndex < 0 || bodyIndex >= parsed.rows.length) {
    return { rejected: 'malformed' }
  }

  const nextRows = [
    ...parsed.rows.slice(0, bodyIndex),
    ...parsed.rows.slice(bodyIndex + 1),
  ]

  const nextTable: ParsedMarkdownTable = {
    ...parsed,
    rows: Object.freeze(nextRows.map((r) => Object.freeze(r))),
  }
  return buildTransaction(table.range, slice, nextTable, expectedRevision)
}

export const planMarkdownTableMoveRow = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  rowIndex: number,
  direction: 'up' | 'down',
  expectedRevision?: number,
): MarkdownEditorTransaction | { readonly rejected: MarkdownTableRejection } => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  const table = resolveTableEntry(source, documentIdentity, tableId)
  if (!table) return { rejected: 'missing' }

  const slice = source.slice(table.range.start, table.range.end)
  const parsed = parseMarkdownTableBlock(slice)
  if (!parsed) return { rejected: 'malformed' }

  // Cannot move header row
  if (rowIndex <= 0) return { rejected: 'malformed' }
  const bodyIndex = rowIndex - 1
  const targetIndex = direction === 'up' ? bodyIndex - 1 : bodyIndex + 1
  if (targetIndex < 0 || targetIndex >= parsed.rows.length) {
    return { rejected: 'malformed' }
  }

  const nextRows = [...parsed.rows]
  const [removed] = nextRows.splice(bodyIndex, 1)
  nextRows.splice(targetIndex, 0, removed!)

  const nextTable: ParsedMarkdownTable = {
    ...parsed,
    rows: Object.freeze(nextRows.map((r) => Object.freeze(r))),
  }
  return buildTransaction(table.range, slice, nextTable, expectedRevision)
}

export const planMarkdownTableInsertColumn = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  columnIndex: number,
  position: 'left' | 'right',
  expectedRevision?: number,
): MarkdownEditorTransaction | { readonly rejected: MarkdownTableRejection } => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  const table = resolveTableEntry(source, documentIdentity, tableId)
  if (!table) return { rejected: 'missing' }

  const slice = source.slice(table.range.start, table.range.end)
  const parsed = parseMarkdownTableBlock(slice)
  if (!parsed) return { rejected: 'malformed' }

  if (columnIndex < 0 || columnIndex > parsed.columnCount) {
    return { rejected: 'malformed' }
  }
  const insertIndex = position === 'left' ? columnIndex : columnIndex + 1

  const nextHeader = [
    ...parsed.header.slice(0, insertIndex),
    `Column ${insertIndex + 1}`,
    ...parsed.header.slice(insertIndex),
  ]
  const nextAlignments = [
    ...parsed.alignments.slice(0, insertIndex),
    null,
    ...parsed.alignments.slice(insertIndex),
  ]
  const nextRows = parsed.rows.map((row) => [
    ...row.slice(0, insertIndex),
    '',
    ...row.slice(insertIndex),
  ])

  const nextTable: ParsedMarkdownTable = {
    header: Object.freeze(nextHeader),
    alignments: Object.freeze(nextAlignments),
    rows: Object.freeze(nextRows.map((r) => Object.freeze(r))),
    columnCount: parsed.columnCount + 1,
    newline: parsed.newline,
  }
  return buildTransaction(table.range, slice, nextTable, expectedRevision)
}

export const planMarkdownTableDeleteColumn = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  columnIndex: number,
  expectedRevision?: number,
): MarkdownEditorTransaction | { readonly rejected: MarkdownTableRejection } => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  const table = resolveTableEntry(source, documentIdentity, tableId)
  if (!table) return { rejected: 'missing' }

  const slice = source.slice(table.range.start, table.range.end)
  const parsed = parseMarkdownTableBlock(slice)
  if (!parsed) return { rejected: 'malformed' }

  if (parsed.columnCount <= 1 || columnIndex < 0 || columnIndex >= parsed.columnCount) {
    return { rejected: 'malformed' }
  }

  const nextHeader = [
    ...parsed.header.slice(0, columnIndex),
    ...parsed.header.slice(columnIndex + 1),
  ]
  const nextAlignments = [
    ...parsed.alignments.slice(0, columnIndex),
    ...parsed.alignments.slice(columnIndex + 1),
  ]
  const nextRows = parsed.rows.map((row) => [
    ...row.slice(0, columnIndex),
    ...row.slice(columnIndex + 1),
  ])

  const nextTable: ParsedMarkdownTable = {
    header: Object.freeze(nextHeader),
    alignments: Object.freeze(nextAlignments),
    rows: Object.freeze(nextRows.map((r) => Object.freeze(r))),
    columnCount: parsed.columnCount - 1,
    newline: parsed.newline,
  }
  return buildTransaction(table.range, slice, nextTable, expectedRevision)
}

export const planMarkdownTableMoveColumn = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  columnIndex: number,
  direction: 'left' | 'right',
  expectedRevision?: number,
): MarkdownEditorTransaction | { readonly rejected: MarkdownTableRejection } => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  const table = resolveTableEntry(source, documentIdentity, tableId)
  if (!table) return { rejected: 'missing' }

  const slice = source.slice(table.range.start, table.range.end)
  const parsed = parseMarkdownTableBlock(slice)
  if (!parsed) return { rejected: 'malformed' }

  const targetIndex = direction === 'left' ? columnIndex - 1 : columnIndex + 1
  if (
    columnIndex < 0 ||
    columnIndex >= parsed.columnCount ||
    targetIndex < 0 ||
    targetIndex >= parsed.columnCount
  ) {
    return { rejected: 'malformed' }
  }

  const nextHeader = [...parsed.header]
  const [removedHeader] = nextHeader.splice(columnIndex, 1)
  nextHeader.splice(targetIndex, 0, removedHeader!)

  const nextAlignments = [...parsed.alignments]
  const [removedAlign] = nextAlignments.splice(columnIndex, 1)
  nextAlignments.splice(targetIndex, 0, removedAlign!)

  const nextRows = parsed.rows.map((row) => {
    const r = [...row]
    const [removedCell] = r.splice(columnIndex, 1)
    r.splice(targetIndex, 0, removedCell!)
    return r
  })

  const nextTable: ParsedMarkdownTable = {
    header: Object.freeze(nextHeader),
    alignments: Object.freeze(nextAlignments),
    rows: Object.freeze(nextRows.map((r) => Object.freeze(r))),
    columnCount: parsed.columnCount,
    newline: parsed.newline,
  }
  return buildTransaction(table.range, slice, nextTable, expectedRevision)
}

export const planMarkdownTableAlignColumn = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  column: number,
  alignment: MarkdownTableAlignment,
  expectedRevision?: number,
): MarkdownEditorTransaction | { readonly rejected: MarkdownTableRejection } => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  const table = resolveTableEntry(source, documentIdentity, tableId)
  if (!table) return { rejected: 'missing' }

  const slice = source.slice(table.range.start, table.range.end)
  const parsed = parseMarkdownTableBlock(slice)
  if (!parsed) return { rejected: 'malformed' }

  if (column < 0 || column >= parsed.columnCount) {
    return { rejected: 'malformed' }
  }

  const nextAlignments = [...parsed.alignments]
  nextAlignments[column] = alignment

  const nextTable: ParsedMarkdownTable = {
    ...parsed,
    alignments: Object.freeze(nextAlignments),
  }
  return buildTransaction(table.range, slice, nextTable, expectedRevision)
}

export const planMarkdownTableDelete = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  expectedRevision?: number,
): MarkdownEditorTransaction | { readonly rejected: 'missing' | 'stale' } => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  const table = resolveTableEntry(source, documentIdentity, tableId)
  if (!table) return { rejected: 'missing' }

  return {
    changes: [
      {
        from: table.range.start,
        to: table.range.end,
        insert: '',
      },
    ],
    expectedRevision,
    history: 'separate',
    origin: 'command',
  }
}

export const resolveMarkdownTableCell = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  previous: MarkdownTableCellIdentity,
  operation?: MarkdownTableStructuralOp,
): MarkdownTableCellIdentity => {
  if (previous.status === 'deleted' || previous.status === 'invalid') {
    return previous
  }
  const table = resolveTableEntry(source, documentIdentity, previous.tableId)
  if (!table) return { ...previous, status: 'deleted' }

  const slice = source.slice(table.range.start, table.range.end)
  const parsed = parseMarkdownTableBlock(slice)
  if (!parsed) return { ...previous, status: 'invalid' }

  let row = previous.row
  let column = previous.column

  if (operation) {
    switch (operation.type) {
      case 'delete-table':
        return { ...previous, status: 'deleted' }
      case 'delete-row':
        if (row === operation.index) {
          return { ...previous, status: 'deleted' }
        }
        if (row > operation.index) {
          row -= 1
        }
        break
      case 'insert-row':
        if (row >= operation.index) {
          row += 1
        }
        break
      case 'move-row':
        if (row === operation.fromIndex) {
          row = operation.toIndex
        } else if (
          operation.fromIndex < operation.toIndex &&
          row > operation.fromIndex &&
          row <= operation.toIndex
        ) {
          row -= 1
        } else if (
          operation.fromIndex > operation.toIndex &&
          row >= operation.toIndex &&
          row < operation.fromIndex
        ) {
          row += 1
        }
        break
      case 'delete-column':
        if (column === operation.index) {
          return { ...previous, status: 'deleted' }
        }
        if (column > operation.index) {
          column -= 1
        }
        break
      case 'insert-column':
        if (column >= operation.index) {
          column += 1
        }
        break
      case 'move-column':
        if (column === operation.fromIndex) {
          column = operation.toIndex
        } else if (
          operation.fromIndex < operation.toIndex &&
          column > operation.fromIndex &&
          column <= operation.toIndex
        ) {
          column -= 1
        } else if (
          operation.fromIndex > operation.toIndex &&
          column >= operation.toIndex &&
          column < operation.fromIndex
        ) {
          column += 1
        }
        break
    }
  }

  const totalRows = 1 + parsed.rows.length
  if (row < 0 || row >= totalRows || column < 0 || column >= parsed.columnCount) {
    return { ...previous, tableId: table.id, row, column, status: 'invalid' }
  }

  return { ...previous, tableId: table.id, row, column, status: 'current' }
}

export type MarkdownTableMutationKind =
  | 'grid-authority'
  | 'regex-parse'
  | 'whole-doc-rewrite'
  | 'stale-cell'

export const evaluateMarkdownTableMutations = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
) => {
  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
  )
  const tables = createMarkdownTableEntries(projection)
  return Object.freeze({
    authority: tables,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'grid-authority' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'regex-parse' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'whole-doc-rewrite' as const,
        equivalent: false,
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-cell' as const,
        equivalent: false,
        accepted: false,
      }),
    ]),
  })
}
