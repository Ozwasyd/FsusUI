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

export const scanMarkdownTableCells = (line: string): string[] => {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return []

  let start = 0
  let end = trimmed.length
  if (trimmed.startsWith('|')) {
    start = 1
  }
  if (trimmed.endsWith('|') && end > start && (end < 2 || trimmed[end - 2] !== '\\')) {
    end -= 1
  }
  const content = trimmed.slice(start, end)
  const cells: string[] = []
  let current = ''
  let escaped = false
  let inBackticks = 0

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]!
    if (escaped) {
      current += ch
      escaped = false
      continue
    }
    if (ch === '\\') {
      current += ch
      escaped = true
      continue
    }
    if (ch === '`') {
      let run = 1
      while (i + 1 < content.length && content[i + 1] === '`') {
        run++
        i++
      }
      current += '`'.repeat(run)
      if (inBackticks === 0) {
        inBackticks = run
      } else if (inBackticks === run) {
        inBackticks = 0
      }
      continue
    }
    if (ch === '|' && inBackticks === 0) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

export const isMarkdownTableAlignmentCell = (cell: string): boolean => {
  const trimmed = cell.replace(/\s/g, '')
  if (trimmed.length === 0) return false
  let i = 0
  if (trimmed[i] === ':') i++
  let hyphens = 0
  while (i < trimmed.length && trimmed[i] === '-') {
    hyphens++
    i++
  }
  if (hyphens === 0) return false
  if (i < trimmed.length && trimmed[i] === ':') i++
  return i === trimmed.length
}

export const getMarkdownTableAlignment = (
  cell: string,
): MarkdownTableAlignment | null => {
  const trimmed = cell.replace(/\s/g, '')
  if (!isMarkdownTableAlignmentCell(trimmed)) return null
  const left = trimmed.startsWith(':')
  const right = trimmed.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return null
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
  const rawLines = tableText.split(/\r\n|\r|\n/)
  const lines = rawLines.filter(
    (l, idx) => idx < rawLines.length - 1 || l.trim().length > 0,
  )
  if (lines.length < 2) return null

  const headerCells = scanMarkdownTableCells(lines[0]!)
  if (headerCells.length === 0) return null

  const separatorCells = scanMarkdownTableCells(lines[1]!)
  if (separatorCells.length === 0) return null
  if (separatorCells.length !== headerCells.length) return null
  if (!separatorCells.every((cell) => isMarkdownTableAlignmentCell(cell))) {
    return null
  }

  const columnCount = headerCells.length
  const alignments = separatorCells.map((cell) => getMarkdownTableAlignment(cell))

  const rows: string[][] = []
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]!
    if (line.trim().length === 0) continue
    const cells = scanMarkdownTableCells(line)
    if (cells.length === 0) return null
    const normalizedRow: string[] = []
    for (let c = 0; c < columnCount; c++) {
      normalizedRow.push(cells[c] ?? '')
    }
    rows.push(normalizedRow)
  }

  return {
    header: Object.freeze(headerCells),
    alignments: Object.freeze(alignments),
    rows: Object.freeze(rows.map((r) => Object.freeze(r))),
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
  const lines = source.split(/\r\n|\r|\n/)
  const formattedLines: string[] = []
  let tableBuffer: string[] = []

  const flushTable = () => {
    if (tableBuffer.length === 0) return
    const block = tableBuffer.join('\n')
    const formatted = formatMarkdownTableBlock(block, false)
    if (formatted !== null) {
      formattedLines.push(...formatted.trimEnd().split('\n'))
    } else {
      formattedLines.push(...tableBuffer)
    }
    tableBuffer = []
  }

  for (const line of lines) {
    if (line.trim().startsWith('|') || line.includes('|')) {
      const cells = scanMarkdownTableCells(line)
      if (cells.length > 0) {
        tableBuffer.push(line)
        continue
      }
    }
    flushTable()
    formattedLines.push(line)
  }
  flushTable()

  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const result = formattedLines.join(newline)
  return source.endsWith(newline) && !result.endsWith(newline)
    ? `${result}${newline}`
    : result
}
