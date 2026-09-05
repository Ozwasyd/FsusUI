import { createMarkdownEditorProjection } from '../../../wasm/markdown-runtime'

export interface MarkdownEditorTableInsert {
  readonly rows: number
  readonly columns: number
}

export type MarkdownTableAlignment = 'left' | 'center' | 'right'

export interface ParsedMarkdownTable {
  readonly header: readonly string[]
  readonly alignments: readonly (MarkdownTableAlignment | null)[]
  readonly rows: readonly (readonly string[])[]
  readonly columnCount: number
  readonly newline: string
}

const emptyRow = (columns: number, fill: (index: number) => string) =>
  `| ${Array.from({ length: columns }, (_, index) => fill(index)).join(' | ')} |`

export const insertMarkdownTable = ({
  rows,
  columns,
}: MarkdownEditorTableInsert): string => {
  const safeColumns = Math.max(1, columns)
  const safeRows = Math.max(0, rows)
  const header = emptyRow(safeColumns, (index) => `Column ${index + 1}`)
  const divider = `| ${Array.from({ length: safeColumns }, () => '---').join(' | ')} |`
  const body = Array.from({ length: safeRows }, () =>
    emptyRow(safeColumns, () => ''),
  )
  return [header, divider, ...body].join('\n')
}

export const formatMarkdownTableAlignmentCell = (
  alignment?: MarkdownTableAlignment | null,
  minWidth = 3,
): string => {
  if (minWidth <= 3) {
    if (alignment === 'center') return ':---:'
    if (alignment === 'right') return '---:'
    if (alignment === 'left') return ':---'
    return '---'
  }
  const dashes = Math.max(
    1,
    minWidth - (alignment === 'center' ? 2 : alignment ? 1 : 0),
  )
  if (alignment === 'center') return `:${'-'.repeat(dashes)}:`
  if (alignment === 'right') return `${'-'.repeat(Math.max(1, dashes))}:`
  if (alignment === 'left') return `:${'-'.repeat(Math.max(1, dashes))}`
  return '-'.repeat(Math.max(3, minWidth))
}

export const parseMarkdownTableBlock = (
  tableText: string,
): ParsedMarkdownTable | null => {
  const newline = tableText.includes('\r\n') ? '\r\n' : '\n'
  const projection = createMarkdownEditorProjection(tableText)
  const tables = projection.nodes.filter(
    (node) => node.kind === 'table' && node.status === 'valid' && node.table,
  )
  if (tables.length !== 1) return null
  const node = tables[0]!
  const trailing = tableText.slice(node.rawRange.end)
  const trailingIsOnlyLineEndings = [...trailing].every(
    (character) => character === '\r' || character === '\n',
  )
  if (node.rawRange.start !== 0 || !trailingIsOnlyLineEndings) {
    return null
  }
  const semantic = node.table!
  if (semantic.separatorRow !== 1 || semantic.rows.length < 2) return null
  const headerRow = semantic.rows[0]!
  const separatorRow = semantic.rows[semantic.separatorRow]!
  const columnCount = headerRow.rawCellRanges.length
  if (
    columnCount === 0 ||
    separatorRow.rawCellRanges.length !== columnCount ||
    semantic.alignments.length !== columnCount
  ) {
    return null
  }
  const readCells = (ranges: readonly { start: number; end: number }[]) =>
    ranges.map((range) => tableText.slice(range.start, range.end))
  const headerCells = readCells(headerRow.rawCellRanges)
  const alignments = semantic.alignments.map((alignment) =>
    alignment === 'none' ? null : alignment,
  )
  const rows = semantic.rows
    .filter((_, index) => index !== semantic.separatorRow && index !== 0)
    .map((row) => {
      const cells = readCells(row.rawCellRanges)
      if (cells.length > columnCount) return null
      return Array.from({ length: columnCount }, (_, index) => cells[index] ?? '')
    })
  if (rows.some((row) => row === null)) return null

  return {
    header: Object.freeze(headerCells),
    alignments: Object.freeze(alignments),
    rows: Object.freeze(
      rows.map((row) => Object.freeze(row as readonly string[])),
    ),
    columnCount,
    newline,
  }
}

export const serializeMarkdownTable = (
  table: {
    readonly header: readonly string[]
    readonly alignments?: readonly (MarkdownTableAlignment | null)[]
    readonly rows: readonly (readonly string[])[]
    readonly newline?: string
  },
  pad = false,
): string => {
  const nl = table.newline ?? '\n'
  const colCount = Math.max(
    table.header.length,
    table.alignments?.length ?? 0,
    ...table.rows.map((r) => r.length),
  )
  if (colCount === 0) return ''

  if (!pad) {
    const headerRow = `| ${table.header.map((c) => c ?? '').join(' | ')} |`
    const sepRow = `| ${Array.from({ length: colCount }, (_, i) =>
      formatMarkdownTableAlignmentCell(table.alignments?.[i]),
    ).join(' | ')} |`
    const bodyRows = table.rows.map((row) => {
      const paddedRow = Array.from(
        { length: colCount },
        (_, i) => row[i] ?? '',
      )
      return `| ${paddedRow.join(' | ')} |`
    })
    return [headerRow, sepRow, ...bodyRows].join(nl)
  }

  const colWidths = Array.from({ length: colCount }, () => 3)
  for (let c = 0; c < colCount; c++) {
    colWidths[c] = Math.max(colWidths[c]!, (table.header[c] ?? '').length)
    for (const row of table.rows) {
      colWidths[c] = Math.max(colWidths[c]!, (row[c] ?? '').length)
    }
  }

  const padCell = (
    cellContent: string,
    col: number,
    align: MarkdownTableAlignment | null | undefined,
  ) => {
    const width = colWidths[col]!
    const diff = width - cellContent.length
    if (diff <= 0) return cellContent
    if (align === 'right') {
      return ' '.repeat(diff) + cellContent
    }
    if (align === 'center') {
      const left = Math.floor(diff / 2)
      const right = diff - left
      return ' '.repeat(left) + cellContent + ' '.repeat(right)
    }
    return cellContent + ' '.repeat(diff)
  }

  const headerRow = `| ${table.header
    .map((c, i) => padCell(c ?? '', i, table.alignments?.[i]))
    .join(' | ')} |`

  const sepRow = `| ${Array.from({ length: colCount }, (_, i) =>
    formatMarkdownTableAlignmentCell(table.alignments?.[i], colWidths[i]),
  ).join(' | ')} |`

  const bodyRows = table.rows.map((row) => {
    const cells = Array.from({ length: colCount }, (_, i) =>
      padCell(row[i] ?? '', i, table.alignments?.[i]),
    )
    return `| ${cells.join(' | ')} |`
  })

  return [headerRow, sepRow, ...bodyRows].join(nl)
}

export const formatMarkdownTableBlock = (
  tableBlock: string,
  pad = false,
): string | null => {
  const parsed = parseMarkdownTableBlock(tableBlock)
  if (!parsed) return null
  const formatted = serializeMarkdownTable(parsed, pad)
  return tableBlock.endsWith('\n') ? `${formatted}\n` : formatted
}

export const formatMarkdownTable = (source: string): string => {
  const tables = createMarkdownEditorProjection(source).nodes
    .filter(
      (node) =>
        node.kind === 'table' && node.status === 'valid' && node.table !== undefined,
    )
    .sort((left, right) => right.rawRange.start - left.rawRange.start)
  let formattedSource = source
  for (const table of tables) {
    const block = source.slice(table.rawRange.start, table.rawRange.end)
    const formatted = formatMarkdownTableBlock(block, false)
    if (formatted !== null) {
      formattedSource =
        formattedSource.slice(0, table.rawRange.start) +
        formatted +
        formattedSource.slice(table.rawRange.end)
    }
  }
  return formattedSource
}
