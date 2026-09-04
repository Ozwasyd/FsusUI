import {
  createMarkdownEditorProjection,
  createMarkdownTableEntries,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableSyntaxNode,
  type MarkdownEditorTableSyntaxRow,
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

const createStableTableProjection = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
) =>
  stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
  )

const createTableAuthorities = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
) =>
  createStableTableProjection(source, documentIdentity).nodes.filter(
    (node) =>
      node.kind === 'table' &&
      node.status === 'valid' &&
      node.table !== undefined,
  )

const resolveTableAuthority = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
) =>
  createTableAuthorities(source, documentIdentity).find(
    (node) => node.id === tableId,
  ) ?? null

export const resolveMarkdownTableEntry = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
) =>
  (() => {
    const node = resolveTableAuthority(source, documentIdentity, tableId)
    return node
      ? Object.freeze({
          id: node.id,
          kind: 'table' as const,
          range: Object.freeze({ ...node.rawRange }),
        })
      : null
  })()

export const resolveMarkdownTableIdentityStatus = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
) => createStableTableProjection(source, documentIdentity).resolve(tableId).status

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

const editableTableRows = (node: MarkdownStableSyntaxNode) =>
  node.table?.rows.filter(
    (_, index) => index !== node.table!.separatorRow,
  ) ?? []

const semanticHash = (value: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

const createCellId = (
  source: string,
  table: MarkdownStableSyntaxNode,
  row: MarkdownEditorTableSyntaxRow,
  column: number,
) => {
  const rowText = row.rawCellRanges
    .map((range) => source.slice(range.start, range.end))
    .join('\u001f')
  const matchingRows = editableTableRows(table).filter(
    (candidate) =>
      candidate.rawRange.end <= row.rawRange.start &&
      candidate.rawCellRanges
        .map((range) => source.slice(range.start, range.end))
        .join('\u001f') === rowText,
  ).length
  const cellText = source.slice(
    row.rawCellRanges[column]!.start,
    row.rawCellRanges[column]!.end,
  )
  const matchingCells = row.rawCellRanges
    .slice(0, column)
    .filter((range) => source.slice(range.start, range.end) === cellText).length
  return `${table.id}:cell:${semanticHash(
    [rowText, matchingRows, cellText, matchingCells].join('\u001e'),
  )}`
}

const cellIdentity = (
  source: string,
  table: MarkdownStableSyntaxNode,
  row: number,
  column: number,
  retainedCellId?: string,
): MarkdownTableCellIdentity | null => {
  const semanticRow = editableTableRows(table)[row]
  const anchor = semanticRow?.rawCellRanges[column]
  if (!semanticRow || !anchor) return null
  return Object.freeze({
    anchor: Object.freeze({ ...anchor }),
    cellId: retainedCellId ?? createCellId(source, table, semanticRow, column),
    column,
    row,
    status: 'current' as const,
    tableId: table.id,
  })
}

export const resolveMarkdownTableCellAtOffset = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  offset: number,
): MarkdownTableCellIdentity | null => {
  const table = createTableAuthorities(source, documentIdentity).find(
    (node) => offset > node.rawRange.start && offset < node.rawRange.end,
  )
  if (!table) return null
  const rows = editableTableRows(table)
  const row = rows.findIndex(
    (candidate) =>
      offset >= candidate.rawRange.start && offset <= candidate.rawRange.end,
  )
  if (row < 0) return null
  const ranges = rows[row]!.rawCellRanges
  const exactColumn = ranges.findIndex(
    (range) => offset >= range.start && offset <= range.end,
  )
  const column =
    exactColumn >= 0
      ? exactColumn
      : ranges
          .map((range, index) => ({
            distance: Math.min(
              Math.abs(offset - range.start),
              Math.abs(offset - range.end),
            ),
            index,
          }))
          .sort((left, right) => left.distance - right.distance)[0]?.index ?? -1
  return column < 0 ? null : cellIdentity(source, table, row, column)
}

export const resolveMarkdownTableCellCoordinates = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  row: number,
  column: number,
  cellId?: string,
): MarkdownTableCellIdentity | null => {
  const table = resolveTableAuthority(source, documentIdentity, tableId)
  if (!table) return null
  return cellIdentity(source, table, row, column, cellId)
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
  return resolveMarkdownTableEntry(source, documentIdentity, tableId)
}

const buildTransaction = (
  tableRange: { start: number; end: number },
  slice: string,
  parsed: ParsedMarkdownTable,
  expectedRevision?: number,
  pad = false,
  targetCell?: Readonly<{ row: number; column: number }>,
): MarkdownEditorTransaction => {
  let serialized = serializeMarkdownTable(parsed, pad)
  if (slice.endsWith('\n') && !serialized.endsWith('\n')) {
    serialized += '\n'
  } else if (!slice.endsWith('\n') && serialized.endsWith('\n')) {
    serialized = serialized.slice(0, -1)
  }
  const projectedTable = createMarkdownEditorProjection(serialized).nodes.find(
    (node) =>
      node.kind === 'table' &&
      node.status === 'valid' &&
      node.table !== undefined,
  )
  const targetRow =
    targetCell && projectedTable?.table
      ? projectedTable.table.rows.filter(
          (_, index) => index !== projectedTable.table!.separatorRow,
        )[targetCell.row]
      : undefined
  const targetRange = targetCell
    ? targetRow?.rawCellRanges[targetCell.column]
    : undefined
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
    metadata: Object.freeze({
      markdownTable: Object.freeze({
        range: Object.freeze({ ...tableRange }),
        ...(targetCell ? { targetCell: Object.freeze({ ...targetCell }) } : {}),
      }),
    }),
    origin: 'command',
    ...(targetRange
      ? {
          selection: Object.freeze({
            direction: 'none' as const,
            end: tableRange.start + targetRange.end,
            start: tableRange.start + targetRange.start,
          }),
        }
      : {}),
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
  currentColumn = 0,
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
  return buildTransaction(table.range, slice, nextTable, expectedRevision, false, {
    row:
      rowIndex <= 0
        ? 0
        : position === 'above'
          ? rowIndex + 1
          : rowIndex,
    column: currentColumn,
  })
}

export const planMarkdownTableDeleteRow = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  rowIndex: number,
  expectedRevision?: number,
  currentColumn = 0,
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
  return buildTransaction(table.range, slice, nextTable, expectedRevision, false, {
    row: Math.min(rowIndex, nextRows.length),
    column: currentColumn,
  })
}

export const planMarkdownTableMoveRow = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  rowIndex: number,
  direction: 'up' | 'down',
  expectedRevision?: number,
  currentColumn = 0,
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
  return buildTransaction(table.range, slice, nextTable, expectedRevision, false, {
    row: targetIndex + 1,
    column: currentColumn,
  })
}

export const planMarkdownTableInsertColumn = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  columnIndex: number,
  position: 'left' | 'right',
  expectedRevision?: number,
  currentRow = 0,
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
  return buildTransaction(table.range, slice, nextTable, expectedRevision, false, {
    row: currentRow,
    column: position === 'left' ? columnIndex + 1 : columnIndex,
  })
}

export const planMarkdownTableDeleteColumn = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  columnIndex: number,
  expectedRevision?: number,
  currentRow = 0,
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
  return buildTransaction(table.range, slice, nextTable, expectedRevision, false, {
    row: currentRow,
    column: Math.min(columnIndex, nextTable.columnCount - 1),
  })
}

export const planMarkdownTableMoveColumn = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  columnIndex: number,
  direction: 'left' | 'right',
  expectedRevision?: number,
  currentRow = 0,
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
  return buildTransaction(table.range, slice, nextTable, expectedRevision, false, {
    row: currentRow,
    column: targetIndex,
  })
}

export const planMarkdownTableAlignColumn = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  column: number,
  alignment: MarkdownTableAlignment,
  expectedRevision?: number,
  currentRow = 0,
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
  return buildTransaction(table.range, slice, nextTable, expectedRevision, false, {
    row: currentRow,
    column,
  })
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
  const table = resolveTableAuthority(
    source,
    documentIdentity,
    previous.tableId,
  )
  if (!table) return { ...previous, status: 'deleted' }

  const slice = source.slice(table.rawRange.start, table.rawRange.end)
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

  return (
    cellIdentity(source, table, row, column, previous.cellId) ?? {
      ...previous,
      tableId: table.id,
      row,
      column,
      status: 'invalid',
    }
  )
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
  const fixture =
    'outside before  \n\n| h1 | h2 |\n| --- | ---: |\n| a\\|b | `c | d` |\n\noutside after  \n'
  const fixtureProjection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(fixture),
    documentIdentity,
  )
  const fixtureTable = createMarkdownTableEntries(fixtureProjection)[0]!
  const authorityPlan = planMarkdownTableAlignColumn(
    fixture,
    documentIdentity,
    fixtureTable.id,
    0,
    'left',
    0,
  )

  const malformed = '| h |\n| not-a-separator |\n'
  const authorityRejectsMalformed =
    parseMarkdownTableBlock(malformed) === null
  const gridMutantAcceptsMalformed = malformed
    .split('\n')
    .filter((line) => line.includes('|'))
    .map((line) => line.split('|').slice(1, -1))
    .length >= 2

  const authorityParsed = parseMarkdownTableBlock(
    fixture.slice(fixtureTable.range.start, fixtureTable.range.end),
  )!
  const regexMutantColumnCount = fixture
    .slice(fixtureTable.range.start, fixtureTable.range.end)
    .split('\n')[2]!
    .split('|')
    .slice(1, -1).length
  const regexEquivalent =
    regexMutantColumnCount === authorityParsed.columnCount

  const authorityRange =
    'changes' in authorityPlan ? authorityPlan.changes[0] : undefined
  const wholeDocumentMutant = authorityRange
    ? Object.freeze({
        from: 0,
        insert: authorityRange.insert,
        to: fixture.length,
      })
    : undefined
  const wholeDocumentEquivalent =
    authorityRange?.from === wholeDocumentMutant?.from &&
    authorityRange?.to === wholeDocumentMutant?.to &&
    authorityRange?.insert === wholeDocumentMutant?.insert

  const staleAuthority = planMarkdownTableAlignColumn(
    fixture,
    documentIdentity,
    fixtureTable.id,
    0,
    'left',
    -1,
  )
  const staleGuardMutant = planMarkdownTableAlignColumn(
    fixture,
    documentIdentity,
    fixtureTable.id,
    0,
    'left',
  )
  const staleEquivalent =
    ('changes' in staleAuthority) === ('changes' in staleGuardMutant)

  return Object.freeze({
    authority: tables,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'grid-authority' as const,
        equivalent:
          !authorityRejectsMalformed === gridMutantAcceptsMalformed,
        accepted:
          !authorityRejectsMalformed === gridMutantAcceptsMalformed,
        detail:
          'a persistent row grid wrongly accepts a parser-rejected separator',
      }),
      Object.freeze({
        kind: 'regex-parse' as const,
        equivalent: regexEquivalent,
        accepted: regexEquivalent,
        detail:
          'split-pipe changes the parser-owned column count for escaped pipes and code spans',
      }),
      Object.freeze({
        kind: 'whole-doc-rewrite' as const,
        equivalent: wholeDocumentEquivalent,
        accepted: wholeDocumentEquivalent,
        detail:
          'whole-document replacement changes the authoritative target range',
      }),
      Object.freeze({
        kind: 'stale-cell' as const,
        equivalent: staleEquivalent,
        accepted: staleEquivalent,
        detail:
          'dropping the expected-revision guard commits an otherwise stale operation',
      }),
    ]),
  })
}
