import {
  createMarkdownEditorProjection,
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
  planMarkdownTableDelete,
  planMarkdownTableDeleteColumn,
  planMarkdownTableDeleteRow,
  planMarkdownTableInsertRow,
  resolveMarkdownTableEntry,
  resolveMarkdownTableIdentityStatus,
  resolveMarkdownTableCellAtOffset,
  resolveMarkdownTableCellCoordinates,
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
  | 'delete-row'
  | 'delete-column'
  | 'delete-table'
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
  readonly structuredSelection?: Readonly<{
    kind: 'row' | 'column' | 'table'
    index?: number
  }>
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
    structuredSelection,
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

  if (expectedRevision !== undefined && expectedRevision < 0) {
    return {
      action: 'noop',
      transaction: null,
      nextCell: cell,
      screenReaderText: '',
      rejected: 'stale',
    }
  }

  const tableIdentityStatus = resolveMarkdownTableIdentityStatus(
    source,
    documentIdentity,
    cell.tableId,
  )
  if (tableIdentityStatus !== 'current') {
    return {
      action: 'noop',
      transaction: null,
      nextCell: { ...cell, status: 'deleted' },
      screenReaderText: '',
      rejected: 'stale',
    }
  }

  const table = resolveMarkdownTableEntry(source, documentIdentity, cell.tableId)
  if (!table) {
    return {
      action: 'noop',
      transaction: null,
      nextCell: { ...cell, status: 'deleted' },
      screenReaderText: '',
      rejected: 'missing',
    }
  }

  const resolvedCell = resolveMarkdownTableCellCoordinates(
    source,
    documentIdentity,
    cell.tableId,
    cell.row,
    cell.column,
  )
  if (
    !cell.cellId ||
    !cell.anchor ||
    !resolvedCell?.anchor ||
    resolvedCell.anchor.start !== cell.anchor.start ||
    resolvedCell.anchor.end !== cell.anchor.end
  ) {
    return {
      action: 'noop',
      transaction: null,
      nextCell: { ...cell, status: 'invalid' },
      screenReaderText: '',
      rejected: 'stale',
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
  const collapsed = context.selection.start === context.selection.end
  const beforeSelection = {
    start: table.range.start,
    end: table.range.start,
    direction: 'none' as const,
  }
  const afterSelection = {
    start: table.range.end,
    end: table.range.end,
    direction: 'none' as const,
  }
  const exitPlan = (
    action: 'exit-backward' | 'exit-forward',
    message: string,
  ): MarkdownTableInputResult => {
    const selection = action === 'exit-backward' ? beforeSelection : afterSelection
    return {
      action,
      transaction: {
        changes: [],
        expectedRevision,
        history: 'skip',
        metadata: { markdownTable: 'source-exit' },
        origin: 'programmatic',
        selection,
      },
      nextCell: { ...cell, status: 'invalid' },
      screenReaderText: message,
    }
  }

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
      return exitPlan('exit-backward', 'Exited table backward')
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
      return exitPlan('exit-backward', 'Exited table upward')
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
      return exitPlan('exit-forward', 'Exited table downward')
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
      return exitPlan('exit-backward', 'Exited table backward')
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
      return exitPlan('exit-forward', 'Exited table forward')
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
      return exitPlan('exit-forward', 'Exited table')
    }

    case 'Delete': {
      if (
        structuredSelection?.kind === 'table' ||
        (context.selection.start === table.range.start &&
          context.selection.end === table.range.end)
      ) {
        const plan = planMarkdownTableDelete(
          source,
          documentIdentity,
          cell.tableId,
          expectedRevision,
        )
        return 'changes' in plan
          ? {
              action: 'delete-table',
              transaction: {
                ...plan,
                selection: beforeSelection,
              },
              nextCell: { ...cell, status: 'deleted' },
              screenReaderText: 'Deleted table',
            }
          : {
              action: 'noop',
              transaction: null,
              nextCell: cell,
              screenReaderText: '',
              rejected: plan.rejected,
            }
      }
      if (structuredSelection?.kind === 'row') {
        const selectedRow = structuredSelection.index ?? r
        const plan = planMarkdownTableDeleteRow(
          source,
          documentIdentity,
          cell.tableId,
          selectedRow,
          expectedRevision,
        )
        return 'changes' in plan
          ? {
              action: 'delete-row',
              transaction: plan,
              nextCell: { ...cell, status: 'deleted' },
              screenReaderText: `Deleted row ${selectedRow + 1}`,
            }
          : {
              action: 'noop',
              transaction: null,
              nextCell: cell,
              screenReaderText: '',
              rejected: plan.rejected,
            }
      }
      if (structuredSelection?.kind === 'column') {
        const selectedColumn = structuredSelection.index ?? c
        const plan = planMarkdownTableDeleteColumn(
          source,
          documentIdentity,
          cell.tableId,
          selectedColumn,
          expectedRevision,
        )
        return 'changes' in plan
          ? {
              action: 'delete-column',
              transaction: plan,
              nextCell: { ...cell, status: 'deleted' },
              screenReaderText: `Deleted column ${selectedColumn + 1}`,
            }
          : {
              action: 'noop',
              transaction: null,
              nextCell: cell,
              screenReaderText: '',
              rejected: plan.rejected,
            }
      }
      if (collapsed && cellText.length === 0) {
        if (c + 1 < totalColumns) {
          return {
            action: 'navigate',
            transaction: null,
            nextCell: { ...cell, column: c + 1 },
            screenReaderText: cellAria(r, c + 1),
          }
        }
        if (r + 1 < totalRows) {
          return {
            action: 'navigate',
            transaction: null,
            nextCell: { ...cell, row: r + 1, column: 0 },
            screenReaderText: cellAria(r + 1, 0),
          }
        }
        return exitPlan('exit-forward', 'Exited empty final table cell')
      }
      return {
        action: 'delete-content',
        transaction: null,
        nextCell: cell,
        screenReaderText: '',
      }
    }

    case 'Backspace': {
      if (
        structuredSelection ||
        (context.selection.start === table.range.start &&
          context.selection.end === table.range.end)
      ) {
        return resolveMarkdownTableInputIntent({ ...context, key: 'Delete' })
      }
      if (collapsed && cellText.length === 0) {
        if (c > 0) {
          return {
            action: 'navigate',
            transaction: null,
            nextCell: { ...cell, column: c - 1 },
            screenReaderText: cellAria(r, c - 1),
          }
        }
        if (r > 0) {
          return {
            action: 'navigate',
            transaction: null,
            nextCell: {
              ...cell,
              row: r - 1,
              column: totalColumns - 1,
            },
            screenReaderText: cellAria(r - 1, totalColumns - 1),
          }
        }
        return exitPlan('exit-backward', 'Exited empty first table cell')
      }
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

export const MARKDOWN_TABLE_PASTE_BUDGET = Object.freeze({
  cells: 20_000,
  columns: 100,
  rows: 1_000,
  sourceUnits: 1_000_000,
})

export type MarkdownTableDataRejection =
  | 'aborted'
  | 'budget-exceeded'
  | 'malformed'
  | 'not-table'

export interface MarkdownTableDataParseOptions {
  readonly signal?: AbortSignal
}

export interface MarkdownTableParsedData {
  readonly rows: readonly (readonly string[])[]
  readonly columns: number
  readonly rowCount: number
}

export const parseMarkdownTableData = (
  payload: string,
  mime?: string,
  options: MarkdownTableDataParseOptions = {},
): MarkdownTableParsedData | { readonly rejected: MarkdownTableDataRejection } => {
  if (options.signal?.aborted) return { rejected: 'aborted' }
  if (!payload || payload.trim().length === 0) {
    return { rejected: 'not-table' }
  }
  if (payload.length > MARKDOWN_TABLE_PASTE_BUDGET.sourceUnits) {
    return { rejected: 'budget-exceeded' }
  }

  // Detect delimiter: TSV or CSV
  const isTsvMime = mime === 'text/tab-separated-values'
  const isCsvMime = mime === 'text/csv'
  let delimiter: ',' | '\t'
  if (isTsvMime || (!isCsvMime && payload.includes('\t'))) {
    delimiter = '\t'
  } else if (isCsvMime) {
    delimiter = ','
  } else {
    // Plain text containing commas remains on the ordinary clipboard path.
    return { rejected: 'not-table' }
  }

  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false
  let quoteClosed = false
  let atFieldStart = true
  let parsedCellCount = 0
  const len = payload.length

  const finishCell = () => {
    currentRow.push(currentCell)
    parsedCellCount++
    currentCell = ''
    quoteClosed = false
    atFieldStart = true
    if (
      currentRow.length > MARKDOWN_TABLE_PASTE_BUDGET.columns ||
      parsedCellCount > MARKDOWN_TABLE_PASTE_BUDGET.cells
    ) {
      return false
    }
    return true
  }

  const finishRow = () => {
    if (!finishCell()) return false
    rows.push(currentRow)
    currentRow = []
    if (rows.length > MARKDOWN_TABLE_PASTE_BUDGET.rows) {
      return false
    }
    return true
  }

  for (let i = 0; i < len; i++) {
    if ((i & 1023) === 0 && options.signal?.aborted) {
      return { rejected: 'aborted' }
    }
    const ch = payload[i]!
    if (ch === '"') {
      if (inQuotes && payload[i + 1] === '"') {
        currentCell += '"'
        i++
        atFieldStart = false
        continue
      }
      if (inQuotes) {
        inQuotes = false
        quoteClosed = true
        continue
      }
      if (!atFieldStart || quoteClosed) return { rejected: 'malformed' }
      inQuotes = true
      atFieldStart = false
      continue
    }
    if (quoteClosed && ch !== delimiter && ch !== '\n' && ch !== '\r') {
      return { rejected: 'malformed' }
    }
    if (!inQuotes && ch === delimiter) {
      if (!finishCell()) return { rejected: 'budget-exceeded' }
      continue
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && i + 1 < len && payload[i + 1] === '\n') {
        i++
      }
      if (!finishRow()) return { rejected: 'budget-exceeded' }
      continue
    }
    if (inQuotes && (ch === '\n' || ch === '\r')) {
      // In markdown tables, newlines in cells must be <br>
      if (ch === '\r' && i + 1 < len && payload[i + 1] === '\n') {
        i++
      }
      currentCell += '<br>'
      atFieldStart = false
      continue
    }
    currentCell += ch
    atFieldStart = false
  }
  if (inQuotes) return { rejected: 'malformed' }
  const endedWithRecordSeparator = /(?:\r\n|\r|\n)$/u.test(payload)
  if (!endedWithRecordSeparator || currentRow.length > 0 || currentCell.length > 0) {
    if (!finishRow()) return { rejected: 'budget-exceeded' }
  }

  if (rows.length === 0) return { rejected: 'not-table' }

  let maxCols = 0
  for (const r of rows) {
    maxCols = Math.max(maxCols, r.length)
  }
  if (
    maxCols > MARKDOWN_TABLE_PASTE_BUDGET.columns ||
    rows.length * maxCols > MARKDOWN_TABLE_PASTE_BUDGET.cells
  ) {
    return { rejected: 'budget-exceeded' }
  }

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

export const parseMarkdownTableTsv = (payload: string) => {
  const parsed = parseMarkdownTableData(payload, 'text/tab-separated-values')
  return 'rows' in parsed ? parsed.rows.map((row) => [...row]) : []
}

const escapeMarkdownTableDataCell = (value: string) => {
  let escaped = ''
  let backslashes = 0
  for (const character of value) {
    if (character === '|') {
      if (backslashes % 2 === 0) escaped += '\\'
      escaped += character
      backslashes = 0
      continue
    }
    escaped += character
    backslashes = character === '\\' ? backslashes + 1 : 0
  }
  return escaped
}

const tableCellSelection = (
  serialized: string,
  tableStart: number,
  row: number,
  column: number,
) => {
  const table = createMarkdownEditorProjection(serialized).nodes.find(
    (node) =>
      node.kind === 'table' &&
      node.status === 'valid' &&
      node.table !== undefined,
  )?.table
  const editableRows = table?.rows.filter(
    (_, index) => index !== table.separatorRow,
  )
  const range = editableRows?.[row]?.rawCellRanges[column]
  return range
    ? Object.freeze({
        direction: 'none' as const,
        end: tableStart + range.end,
        start: tableStart + range.start,
      })
    : undefined
}

export const planMarkdownTablePaste = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  currentCell: MarkdownTableCellIdentity,
  payload: string,
  mime?: string,
  expectedRevision?: number,
  options: MarkdownTableDataParseOptions = {},
): MarkdownEditorTransaction | {
  readonly rejected:
    | MarkdownTableDataRejection
    | 'stale'
    | 'missing'
} => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  if (
    currentCell.status !== 'current' ||
    currentCell.tableId !== tableId
  ) {
    return { rejected: 'stale' }
  }

  const parsedData = parseMarkdownTableData(payload, mime, options)
  if ('rejected' in parsedData) {
    return { rejected: parsedData.rejected }
  }

  if (
    resolveMarkdownTableIdentityStatus(
      source,
      documentIdentity,
      tableId,
    ) !== 'current'
  ) {
    return { rejected: 'stale' }
  }
  const table = resolveMarkdownTableEntry(source, documentIdentity, tableId)
  if (!table) return { rejected: 'missing' }
  const resolvedCell = resolveMarkdownTableCellCoordinates(
    source,
    documentIdentity,
    tableId,
    currentCell.row,
    currentCell.column,
  )
  if (
    !currentCell.cellId ||
    !currentCell.anchor ||
    !resolvedCell?.anchor ||
    resolvedCell.anchor?.start !== currentCell.anchor.start ||
    resolvedCell.anchor.end !== currentCell.anchor.end
  ) {
    return { rejected: 'stale' }
  }

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
      const cellVal = escapeMarkdownTableDataCell(dataRow[c] ?? '')
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
    metadata: Object.freeze({
      markdownTable: Object.freeze({
        action: 'paste-matrix',
        cellId: currentCell.cellId,
        tableId,
      }),
    }),
    origin: 'paste',
    ...(tableCellSelection(
      serialized,
      table.range.start,
      currentCell.row,
      currentCell.column,
    )
      ? {
          selection: tableCellSelection(
            serialized,
            table.range.start,
            currentCell.row,
            currentCell.column,
          ),
        }
      : {}),
  }
}

export const planMarkdownTableFormat = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  expectedRevision?: number,
  currentCell?: MarkdownTableCellIdentity,
): MarkdownEditorTransaction | { readonly rejected: 'stale' | 'malformed' | 'missing' } => {
  if (expectedRevision !== undefined && expectedRevision < 0) {
    return { rejected: 'stale' }
  }
  if (
    resolveMarkdownTableIdentityStatus(
      source,
      documentIdentity,
      tableId,
    ) !== 'current'
  ) {
    return { rejected: 'stale' }
  }

  const table = resolveMarkdownTableEntry(source, documentIdentity, tableId)
  if (!table) return { rejected: 'missing' }
  if (currentCell) {
    const resolvedCell = resolveMarkdownTableCellCoordinates(
      source,
      documentIdentity,
      tableId,
      currentCell.row,
      currentCell.column,
    )
    if (
      currentCell.tableId !== tableId ||
      !currentCell.cellId ||
      !currentCell.anchor ||
      !resolvedCell?.anchor ||
      resolvedCell.anchor?.start !== currentCell.anchor.start ||
      resolvedCell.anchor.end !== currentCell.anchor.end
    ) {
      return { rejected: 'stale' }
    }
  }

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
    metadata: Object.freeze({
      markdownTable: Object.freeze({
        action: 'format',
        tableId,
        ...(currentCell?.cellId ? { cellId: currentCell.cellId } : {}),
      }),
    }),
    origin: 'command',
    ...(currentCell
      ? {
          selection: tableCellSelection(
            formatted,
            table.range.start,
            currentCell.row,
            currentCell.column,
          ),
        }
      : {}),
  }
}

// ---------------- Mutation Fixtures (#371 & #372) ----------------

export type MarkdownTableInputMutationKind =
  | 'local-keydown'
  | 'naked-index'
  | 'tab-trap'
  | 'composition-switch'
  | 'auto-format'

export const evaluateMarkdownTableInputMutations = () => {
  const source = '| h1 | h2 |\n| --- | --- |\n| a | b |\n'
  const documentIdentity = Object.freeze({ epoch: 1, id: 'table-input-mutations' })
  const firstCell = resolveMarkdownTableCellAtOffset(
    source,
    documentIdentity,
    source.indexOf('h1'),
  )!
  const lastCell = resolveMarkdownTableCellCoordinates(
    source,
    documentIdentity,
    firstCell.tableId,
    1,
    1,
  )!
  const selection = Object.freeze({
    direction: 'none' as const,
    end: source.indexOf('h1'),
    start: source.indexOf('h1'),
  })
  const authority = resolveMarkdownTableInputIntent({
    cell: firstCell,
    documentIdentity,
    key: 'Tab',
    selection,
    source,
  })
  const nakedIndex = resolveMarkdownTableInputIntent({
    cell: {
      column: firstCell.column,
      row: firstCell.row,
      status: 'current',
      tableId: firstCell.tableId,
    },
    documentIdentity,
    key: 'Tab',
    selection,
    source,
  })
  const finalTab = resolveMarkdownTableInputIntent({
    cell: lastCell,
    documentIdentity,
    key: 'Tab',
    selection,
    source,
  })
  const composing = resolveMarkdownTableInputIntent({
    cell: firstCell,
    compositionActive: true,
    documentIdentity,
    key: 'Tab',
    selection,
    source,
  })
  const ordinaryTyping = resolveMarkdownTableInputIntent({
    cell: firstCell,
    documentIdentity,
    key: 'a',
    selection,
    source,
  })

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'local-keydown' as const,
        equivalent: authority.action === 'noop',
        accepted: authority.action === 'noop' || authority.nextCell.column !== 1,
        detail: 'Tab must be resolved by the shared input intent planner',
      }),
      Object.freeze({
        kind: 'naked-index' as const,
        equivalent: nakedIndex.action === authority.action,
        accepted:
          nakedIndex.action !== 'noop' || nakedIndex.rejected !== 'stale',
        detail: 'row/column coordinates cannot authorize a stale table identity',
      }),
      Object.freeze({
        kind: 'tab-trap' as const,
        equivalent: finalTab.action === 'noop',
        accepted: finalTab.action !== 'append-row',
        detail: 'Tab at the final cell must append a row instead of trapping focus',
      }),
      Object.freeze({
        kind: 'composition-switch' as const,
        equivalent:
          composing.action === authority.action &&
          composing.nextCell.column === authority.nextCell.column,
        accepted:
          composing.action !== 'composition' ||
          composing.nextCell.cellId !== firstCell.cellId,
        detail: 'composition-active freezes table cell navigation',
      }),
      Object.freeze({
        kind: 'auto-format' as const,
        equivalent: ordinaryTyping.transaction !== null,
        accepted:
          ordinaryTyping.action !== 'noop' || ordinaryTyping.transaction !== null,
        detail: 'ordinary typing must not format or rewrite the table',
      }),
    ]),
  })
}

export type MarkdownTablePasteFormatMutationKind =
  | 'per-cell-history'
  | 'ordinary-auto-format'
  | 'html-round-trip'
  | 'stale-paste'
  | 'budget-bypass'

export const evaluateMarkdownTablePasteFormatMutations = () => {
  const source = '| h1 | h2 |\n| --- | --- |\n| a | b |\n'
  const documentIdentity = Object.freeze({ epoch: 1, id: 'table-paste-mutations' })
  const cell = resolveMarkdownTableCellAtOffset(
    source,
    documentIdentity,
    source.indexOf('h1'),
  )!
  const authority = planMarkdownTablePaste(
    source,
    documentIdentity,
    cell.tableId,
    cell,
    'c1\tc2\nv1\tv2',
    'text/tab-separated-values',
    1,
  )
  const ordinary = parseMarkdownTableData('ordinary,comma')
  const html = parseMarkdownTableData(
    '<table><tr><td>unsafe authority</td></tr></table>',
    'text/html',
  )
  const stale = planMarkdownTablePaste(
    source,
    { ...documentIdentity, epoch: 0 },
    cell.tableId,
    cell,
    'c1\tc2',
    'text/tab-separated-values',
    1,
  )
  const overBudget = parseMarkdownTableData(
    Array.from(
      { length: MARKDOWN_TABLE_PASTE_BUDGET.rows + 1 },
      () => 'a\tb',
    ).join('\n'),
    'text/tab-separated-values',
  )

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'per-cell-history' as const,
        equivalent: 'changes' in authority && authority.changes.length !== 1,
        accepted:
          !('changes' in authority) ||
          authority.changes.length !== 1 ||
          authority.history !== 'separate',
        detail: 'a matrix paste must be one transaction and one history entry',
      }),
      Object.freeze({
        kind: 'ordinary-auto-format' as const,
        equivalent: 'rows' in ordinary,
        accepted: 'rows' in ordinary,
        detail: 'ordinary plain text must stay on the ordinary paste path',
      }),
      Object.freeze({
        kind: 'html-round-trip' as const,
        equivalent: 'rows' in html,
        accepted: 'rows' in html,
        detail: 'HTML clipboard data is not table-data authority',
      }),
      Object.freeze({
        kind: 'stale-paste' as const,
        equivalent: 'changes' in stale,
        accepted: !('rejected' in stale && stale.rejected === 'stale'),
        detail: 'stale document identity must reject the paste',
      }),
      Object.freeze({
        kind: 'budget-bypass' as const,
        equivalent: 'rows' in overBudget,
        accepted: !(
          'rejected' in overBudget &&
          overBudget.rejected === 'budget-exceeded'
        ),
        detail: 'numeric row and cell budgets must reject oversized matrices',
      }),
    ]),
  })
}
