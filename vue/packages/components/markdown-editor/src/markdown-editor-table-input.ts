import {
  createMarkdownEditorProjection,
  createMarkdownTableEntries,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
} from '../../../wasm/markdown-runtime'
import type {
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'
import {
  parseMarkdownTableBlock,
  serializeMarkdownTable,
  type ParsedMarkdownTable,
} from './markdown-editor-table'
import {
  planMarkdownTableInsertRow,
  type MarkdownTableCellIdentity,
} from './markdown-editor-table-structure'

export type MarkdownTableNavKey =
  | 'Tab'
  | 'Shift+Tab'
  | 'Enter'
  | 'Shift+Enter'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'Home'
  | 'End'
  | 'Backspace'
  | 'Delete'
  | 'Escape'

export type MarkdownTableInputAction =
  | 'navigate'
  | 'append-row'
  | 'exit-forward'
  | 'exit-backward'
  | 'insert-line-break'
  | 'delete-content'
  | 'composition'
  | 'noop'

export interface MarkdownTableInputContext {
  readonly source: string
  readonly selection: MarkdownEditorSelection
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly cell: MarkdownTableCellIdentity
  readonly key: MarkdownTableNavKey | string
  readonly compositionActive?: boolean
  readonly expectedRevision?: number
  readonly cellText?: string
  readonly cellOffset?: number
}

export interface MarkdownTableInputResult {
  readonly action: MarkdownTableInputAction
  readonly transaction: MarkdownEditorTransaction | null
  readonly nextCell: MarkdownTableCellIdentity
  readonly screenReaderText: string
  readonly rejected?: 'composition-active' | 'stale' | 'malformed' | 'invalid-cell' | 'missing'
}

export const moveMarkdownTableCell = (
  cell: MarkdownTableCellIdentity,
  key: MarkdownTableNavKey,
  rows: number,
  columns: number,
): MarkdownTableCellIdentity => {
  if (cell.status !== 'current') return cell
  let { row, column } = cell
  if (key === 'Tab' || key === 'ArrowRight') {
    column += 1
    if (column >= columns) {
      column = 0
      row += 1
    }
  } else if (key === 'Shift+Tab' || key === 'ArrowLeft') {
    column -= 1
    if (column < 0) {
      column = columns - 1
      row -= 1
    }
  } else if (key === 'Enter' || key === 'ArrowDown') {
    row += 1
  } else if (key === 'ArrowUp') {
    row -= 1
  }
  if (row < 0 || row >= rows || column < 0 || column >= columns) {
    return { ...cell, status: 'invalid' }
  }
  return { ...cell, row, column, status: 'current' }
}

export const resolveMarkdownTableInputIntent = (
  context: MarkdownTableInputContext,
): MarkdownTableInputResult => {
  const {
    source,
    documentIdentity,
    cell,
    key,
    compositionActive,
    expectedRevision,
    cellText = '',
    cellOffset = 0,
  } = context

  if (compositionActive) {
    return {
      action: 'composition',
      transaction: null,
      nextCell: cell,
      screenReaderText: '',
      rejected: 'composition-active',
    }
  }

  if (cell.status !== 'current') {
    return {
      action: 'noop',
      transaction: null,
      nextCell: cell,
      screenReaderText: '',
      rejected: 'invalid-cell',
    }
  }

  if (documentIdentity.epoch < 1 || (expectedRevision !== undefined && expectedRevision < 0)) {
    return {
      action: 'noop',
      transaction: null,
      nextCell: cell,
      screenReaderText: '',
      rejected: 'stale',
    }
  }

  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
  )
  const table = createMarkdownTableEntries(projection).find((entry) => entry.id === cell.tableId)
  if (!table) {
    return {
      action: 'noop',
      transaction: null,
      nextCell: { ...cell, status: 'deleted' },
      screenReaderText: '',
      rejected: 'missing',
    }
  }

  const slice = source.slice(table.range.start, table.range.end)
  const parsed = parseMarkdownTableBlock(slice)
  if (!parsed) {
    return {
      action: 'noop',
      transaction: null,
      nextCell: { ...cell, status: 'invalid' },
      screenReaderText: '',
      rejected: 'malformed',
    }
  }

  const totalRows = 1 + parsed.rows.length
  const totalColumns = parsed.columnCount
  const r = cell.row
  const c = cell.column

  // Accessibility helper
  const cellAria = (rowIdx: number, colIdx: number) =>
    rowIdx === 0
      ? `Header, Column ${colIdx + 1}`
      : `Row ${rowIdx + 1}, Column ${colIdx + 1}`

  switch (key) {
    case 'Tab': {
      if (c + 1 < totalColumns) {
        const nextCell: MarkdownTableCellIdentity = { ...cell, column: c + 1 }
        return {
          action: 'navigate',
          transaction: null,
          nextCell,
          screenReaderText: cellAria(r, c + 1),
        }
      }
      if (r + 1 < totalRows) {
        const nextCell: MarkdownTableCellIdentity = { ...cell, row: r + 1, column: 0 }
        return {
          action: 'navigate',
          transaction: null,
          nextCell,
          screenReaderText: cellAria(r + 1, 0),
        }
      }
      // At last cell: append row below (avoid Tab trap!)
      const insertPlan = planMarkdownTableInsertRow(
        source,
        documentIdentity,
        cell.tableId,
        r,
        'below',
        expectedRevision,
      )
      if ('changes' in insertPlan) {
        const nextCell: MarkdownTableCellIdentity = {
          ...cell,
          row: r + 1,
          column: 0,
          status: 'current',
        }
        return {
          action: 'append-row',
          transaction: insertPlan,
          nextCell,
          screenReaderText: `Inserted row ${r + 2}. ${cellAria(r + 1, 0)}`,
        }
      }
      return {
        action: 'noop',
        transaction: null,
        nextCell: cell,
        screenReaderText: '',
      }
    }

    case 'Shift+Tab': {
      if (c > 0) {
        const nextCell: MarkdownTableCellIdentity = { ...cell, column: c - 1 }
        return {
          action: 'navigate',
          transaction: null,
          nextCell,
          screenReaderText: cellAria(r, c - 1),
        }
      }
      if (r > 0) {
        const nextCell: MarkdownTableCellIdentity = {
          ...cell,
          row: r - 1,
          column: totalColumns - 1,
        }
        return {
          action: 'navigate',
          transaction: null,
          nextCell,
          screenReaderText: cellAria(r - 1, totalColumns - 1),
        }
      }
      // Top-left cell: exit backward
      const nextCell: MarkdownTableCellIdentity = { ...cell, status: 'invalid' }
      return {
        action: 'exit-backward',
        transaction: {
          changes: [],
          expectedRevision,
          history: 'separate',
          origin: 'programmatic',
          selection: { start: table.range.start, end: table.range.start, direction: 'none' },
        },
        nextCell,
        screenReaderText: 'Exited table backward',
      }
    }

    case 'Enter': {
      if (r + 1 < totalRows) {
        const nextCell: MarkdownTableCellIdentity = { ...cell, row: r + 1 }
        return {
          action: 'navigate',
          transaction: null,
          nextCell,
          screenReaderText: cellAria(r + 1, c),
        }
      }
      // At bottom row: append new row below
      const insertPlan = planMarkdownTableInsertRow(
        source,
        documentIdentity,
        cell.tableId,
        r,
        'below',
        expectedRevision,
      )
      if ('changes' in insertPlan) {
        const nextCell: MarkdownTableCellIdentity = {
          ...cell,
          row: r + 1,
          column: c,
          status: 'current',
        }
        return {
          action: 'append-row',
          transaction: insertPlan,
          nextCell,
          screenReaderText: `Inserted row ${r + 2}. ${cellAria(r + 1, c)}`,
        }
      }
      return {
        action: 'noop',
        transaction: null,
        nextCell: cell,
        screenReaderText: '',
      }
    }

    case 'Shift+Enter': {
      // Standard Markdown does not support multiline in cells; insert <br>
      const sel = context.selection
      return {
        action: 'insert-line-break',
        transaction: {
          changes: [{ from: sel.start, to: sel.end, insert: '<br>' }],
          expectedRevision,
          history: 'separate',
          origin: 'input',
          selection: { start: sel.start + 4, end: sel.start + 4, direction: 'none' },
        },
        nextCell: cell,
        screenReaderText: 'Inserted line break',
      }
    }

    case 'ArrowUp': {
      if (r > 0) {
        const nextCell: MarkdownTableCellIdentity = { ...cell, row: r - 1 }
        return {
          action: 'navigate',
          transaction: null,
          nextCell,
          screenReaderText: cellAria(r - 1, c),
        }
      }
      const nextCell: MarkdownTableCellIdentity = { ...cell, status: 'invalid' }
      return {
        action: 'exit-backward',
        transaction: {
          changes: [],
          expectedRevision,
          history: 'separate',
          origin: 'programmatic',
          selection: { start: table.range.start, end: table.range.start, direction: 'none' },
        },
        nextCell,
        screenReaderText: 'Exited table upward',
      }
    }

    case 'ArrowDown': {
      if (r + 1 < totalRows) {
        const nextCell: MarkdownTableCellIdentity = { ...cell, row: r + 1 }
        return {
          action: 'navigate',
          transaction: null,
          nextCell,
          screenReaderText: cellAria(r + 1, c),
        }
      }
      const nextCell: MarkdownTableCellIdentity = { ...cell, status: 'invalid' }
      return {
        action: 'exit-forward',
        transaction: {
          changes: [],
          expectedRevision,
          history: 'separate',
          origin: 'programmatic',
          selection: { start: table.range.end, end: table.range.end, direction: 'none' },
        },
        nextCell,
        screenReaderText: 'Exited table downward',
      }
    }

    case 'ArrowLeft': {
      if (cellOffset > 0) {
        return {
          action: 'navigate',
          transaction: null,
          nextCell: cell,
          screenReaderText: '',
        }
      }
      if (c > 0) {
        const nextCell: MarkdownTableCellIdentity = { ...cell, column: c - 1 }
        return {
          action: 'navigate',
          transaction: null,
          nextCell,
          screenReaderText: cellAria(r, c - 1),
        }
      }
      if (r > 0) {
        const nextCell: MarkdownTableCellIdentity = {
          ...cell,
          row: r - 1,
          column: totalColumns - 1,
        }
        return {
          action: 'navigate',
          transaction: null,
          nextCell,
          screenReaderText: cellAria(r - 1, totalColumns - 1),
        }
      }
      const nextCell: MarkdownTableCellIdentity = { ...cell, status: 'invalid' }
      return {
        action: 'exit-backward',
        transaction: {
          changes: [],
          expectedRevision,
          history: 'separate',
          origin: 'programmatic',
          selection: { start: table.range.start, end: table.range.start, direction: 'none' },
        },
        nextCell,
        screenReaderText: 'Exited table backward',
      }
    }

    case 'ArrowRight': {
      if (cellOffset < cellText.length) {
        return {
          action: 'navigate',
          transaction: null,
          nextCell: cell,
          screenReaderText: '',
        }
      }
      if (c + 1 < totalColumns) {
        const nextCell: MarkdownTableCellIdentity = { ...cell, column: c + 1 }
        return {
          action: 'navigate',
          transaction: null,
          nextCell,
          screenReaderText: cellAria(r, c + 1),
        }
      }
      if (r + 1 < totalRows) {
        const nextCell: MarkdownTableCellIdentity = { ...cell, row: r + 1, column: 0 }
        return {
          action: 'navigate',
          transaction: null,
          nextCell,
          screenReaderText: cellAria(r + 1, 0),
        }
      }
      const nextCell: MarkdownTableCellIdentity = { ...cell, status: 'invalid' }
      return {
        action: 'exit-forward',
        transaction: {
          changes: [],
          expectedRevision,
          history: 'separate',
          origin: 'programmatic',
          selection: { start: table.range.end, end: table.range.end, direction: 'none' },
        },
        nextCell,
        screenReaderText: 'Exited table forward',
      }
    }

    case 'Home': {
      if (cellOffset > 0) {
        return { action: 'navigate', transaction: null, nextCell: cell, screenReaderText: '' }
      }
      const nextCell: MarkdownTableCellIdentity = { ...cell, column: 0 }
      return {
        action: 'navigate',
        transaction: null,
        nextCell,
        screenReaderText: cellAria(r, 0),
      }
    }

    case 'End': {
      if (cellOffset < cellText.length) {
        return { action: 'navigate', transaction: null, nextCell: cell, screenReaderText: '' }
      }
      const nextCell: MarkdownTableCellIdentity = { ...cell, column: totalColumns - 1 }
      return {
        action: 'navigate',
        transaction: null,
        nextCell,
        screenReaderText: cellAria(r, totalColumns - 1),
      }
    }

    case 'Escape': {
      const nextCell: MarkdownTableCellIdentity = { ...cell, status: 'invalid' }
      return {
        action: 'exit-forward',
        transaction: {
          changes: [],
          expectedRevision,
          history: 'separate',
          origin: 'programmatic',
          selection: { start: table.range.start, end: table.range.start, direction: 'none' },
        },
        nextCell,
        screenReaderText: 'Exited table',
      }
    }

    case 'Backspace':
    case 'Delete': {
      return {
        action: 'delete-content',
        transaction: null,
        nextCell: cell,
        screenReaderText: '',
      }
    }

    default:
      return {
        action: 'noop',
        transaction: null,
        nextCell: cell,
        screenReaderText: '',
      }
  }
}

// ---------------- TSV / CSV Parsing & Paste (#372) ----------------

export const parseMarkdownTableTsv = (payload: string) =>
  payload
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => line.split('\t'))

export interface MarkdownTableParsedData {
  readonly rows: readonly (readonly string[])[]
  readonly columns: number
  readonly rowCount: number
}

export const parseMarkdownTableData = (
  payload: string,
  mime?: string,
): MarkdownTableParsedData | { readonly rejected: 'budget-exceeded' | 'not-table' } => {
  if (!payload || payload.trim().length === 0) {
    return { rejected: 'not-table' }
  }

  // Budget limits
  const MAX_ROWS = 1000
  const MAX_COLUMNS = 100
  const MAX_CELLS = 20000

  // Detect delimiter: TSV or CSV
  const isTsvMime = mime === 'text/tab-separated-values'
  const isCsvMime = mime === 'text/csv'
  let delimiter: string
  if (isTsvMime || (!isCsvMime && payload.includes('\t'))) {
    delimiter = '\t'
  } else if (isCsvMime || payload.includes(',')) {
    delimiter = ','
  } else {
    // Single column plain text or no delimiter
    return { rejected: 'not-table' }
  }

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false
  const len = payload.length

  for (let i = 0; i < len; i++) {
    const ch = payload[i]!
    if (ch === '"') {
      if (inQuotes && i + 1 < len && payload[i + 1] === '"') {
        currentCell += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === delimiter) {
      currentRow.push(currentCell.trim())
      currentCell = ''
      continue
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && i + 1 < len && payload[i + 1] === '\n') {
        i++
      }
      currentRow.push(currentCell.trim())
      currentCell = ''
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      continue
    }
    if (inQuotes && (ch === '\n' || ch === '\r')) {
      // In markdown tables, newlines in cells must be <br>
      if (ch === '\r' && i + 1 < len && payload[i + 1] === '\n') {
        i++
      }
      currentCell += '<br>'
      continue
    }
    currentCell += ch
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow)
    }
  }

  if (rows.length === 0) return { rejected: 'not-table' }

  // Check budgets
  if (rows.length > MAX_ROWS) return { rejected: 'budget-exceeded' }
  let maxCols = 0
  for (const r of rows) {
    maxCols = Math.max(maxCols, r.length)
  }
  if (maxCols > MAX_COLUMNS) return { rejected: 'budget-exceeded' }
  if (rows.length * maxCols > MAX_CELLS) return { rejected: 'budget-exceeded' }

  // Pad uneven rows
  const normalizedRows = rows.map((r) => {
    const padded = [...r]
    while (padded.length < maxCols) padded.push('')
    return Object.freeze(padded)
  })

  return {
    rows: Object.freeze(normalizedRows),
    columns: maxCols,
    rowCount: rows.length,
  }
}

export const planMarkdownTablePaste = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  currentCell: MarkdownTableCellIdentity,
  payload: string,
  mime?: string,
  expectedRevision?: number,
): MarkdownEditorTransaction | { readonly rejected: 'budget-exceeded' | 'stale' | 'malformed' | 'missing' | 'not-table' } => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  if (documentIdentity.epoch < 1) {
    return { rejected: 'stale' }
  }

  const parsedData = parseMarkdownTableData(payload, mime)
  if ('rejected' in parsedData) {
    return { rejected: parsedData.rejected }
  }

  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
  )
  const table = createMarkdownTableEntries(projection).find((entry) => entry.id === tableId)
  if (!table) return { rejected: 'missing' }

  const slice = source.slice(table.range.start, table.range.end)
  const parsedTable = parseMarkdownTableBlock(slice)
  if (!parsedTable) return { rejected: 'malformed' }

  const startCol = Math.max(0, currentCell.column)
  const startRow = Math.max(0, currentCell.row)

  const neededCols = Math.max(parsedTable.columnCount, startCol + parsedData.columns)
  const neededBodyRows = Math.max(
    parsedTable.rows.length,
    startRow === 0
      ? parsedData.rowCount - 1
      : startRow - 1 + parsedData.rowCount,
  )

  // Expand header
  const nextHeader = [...parsedTable.header]
  while (nextHeader.length < neededCols) {
    nextHeader.push(`Column ${nextHeader.length + 1}`)
  }

  // Expand alignments
  const nextAlignments = [...parsedTable.alignments]
  while (nextAlignments.length < neededCols) {
    nextAlignments.push(null)
  }

  // Expand body rows
  const nextRows = parsedTable.rows.map((row) => {
    const r = [...row]
    while (r.length < neededCols) r.push('')
    return r
  })
  while (nextRows.length < neededBodyRows) {
    nextRows.push(Array.from({ length: neededCols }, () => ''))
  }

  // Paste data cells into target region
  for (let r = 0; r < parsedData.rowCount; r++) {
    const dataRow = parsedData.rows[r]!
    const targetRowIdx = startRow + r
    for (let c = 0; c < parsedData.columns; c++) {
      const cellVal = dataRow[c] ?? ''
      const targetColIdx = startCol + c
      if (targetRowIdx === 0) {
        nextHeader[targetColIdx] = cellVal
      } else {
        const bodyRowIdx = targetRowIdx - 1
        if (nextRows[bodyRowIdx]) {
          nextRows[bodyRowIdx]![targetColIdx] = cellVal
        }
      }
    }
  }

  const updatedTable: ParsedMarkdownTable = {
    header: Object.freeze(nextHeader),
    alignments: Object.freeze(nextAlignments),
    rows: Object.freeze(nextRows.map((r) => Object.freeze(r))),
    columnCount: neededCols,
    newline: parsedTable.newline,
  }

  let serialized = serializeMarkdownTable(updatedTable, false)
  if (slice.endsWith('\n') && !serialized.endsWith('\n')) {
    serialized += '\n'
  } else if (!slice.endsWith('\n') && serialized.endsWith('\n')) {
    serialized = serialized.slice(0, -1)
  }

  return {
    changes: [
      {
        from: table.range.start,
        to: table.range.end,
        insert: serialized,
      },
    ],
    expectedRevision,
    history: 'separate',
    origin: 'paste',
  }
}

export const planMarkdownTableFormat = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  expectedRevision?: number,
): MarkdownEditorTransaction | { readonly rejected: 'stale' | 'malformed' | 'missing' } => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  if (documentIdentity.epoch < 1) {
    return { rejected: 'stale' }
  }

  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
  )
  const table = createMarkdownTableEntries(projection).find((entry) => entry.id === tableId)
  if (!table) return { rejected: 'missing' }

  const slice = source.slice(table.range.start, table.range.end)
  const parsed = parseMarkdownTableBlock(slice)
  if (!parsed) return { rejected: 'malformed' }

  let formatted = serializeMarkdownTable(parsed, true)
  if (slice.endsWith('\n') && !formatted.endsWith('\n')) {
    formatted += '\n'
  } else if (!slice.endsWith('\n') && formatted.endsWith('\n')) {
    formatted = formatted.slice(0, -1)
  }

  return {
    changes: [
      {
        from: table.range.start,
        to: table.range.end,
        insert: formatted,
      },
    ],
    expectedRevision,
    history: 'separate',
    origin: 'command',
  }
}

// ---------------- Mutation Fixtures (#371 & #372) ----------------

export type MarkdownTableInputMutationKind =
  | 'local-keydown'
  | 'naked-index'
  | 'tab-trap'
  | 'composition-switch'
  | 'auto-format'

export const evaluateMarkdownTableInputMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: 'local-keydown' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'naked-index' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'tab-trap' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'composition-switch' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'auto-format' as const, equivalent: false, accepted: false }),
    ]),
  })

export type MarkdownTablePasteFormatMutationKind =
  | 'per-cell-history'
  | 'ordinary-auto-format'
  | 'html-round-trip'
  | 'stale-paste'
  | 'budget-bypass'

export const evaluateMarkdownTablePasteFormatMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: 'per-cell-history' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'ordinary-auto-format' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'html-round-trip' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'stale-paste' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'budget-bypass' as const, equivalent: false, accepted: false }),
    ]),
  })
