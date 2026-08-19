export interface MarkdownEditorTableInsert {
  readonly rows: number
  readonly columns: number
}

const emptyRow = (columns: number, fill: string) =>
  `| ${Array.from({ length: columns }, () => fill).join(' | ')} |`

export const insertMarkdownTable = ({
  rows,
  columns,
}: MarkdownEditorTableInsert): string => {
  const header = emptyRow(columns, 'Column')
  const divider = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`
  const body = Array.from({ length: Math.max(0, rows) }, () => emptyRow(columns, ''))
  return [header, divider, ...body].join('\n')
}

const splitTableCells = (line: string): string[] => {
  const stripped = line.replace(/^\s*\|/u, '').replace(/\|\s*$/u, '')
  const cells: string[] = []
  let current = ''
  let escaped = false
  let inCode = false
  for (const character of stripped) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }
    if (character === '\\') {
      current += character
      escaped = true
      continue
    }
    if (character === '`') {
      inCode = !inCode
      current += character
      continue
    }
    if (character === '|' && !inCode) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += character
  }
  cells.push(current.trim())
  return cells
}

export const formatMarkdownTable = (source: string): string => {
  const lines = source.split(/\r\n|\r|\n/)
  const tableLines = lines.filter((line) => line.includes('|'))
  if (tableLines.length === 0) return source
  const rows = tableLines.map((line) => splitTableCells(line))
  const widths = rows[0].map((_, index) =>
    Math.max(...rows.map((row) => (row[index] ?? '').length), 3),
  )
  const formatRow = (row: string[]) =>
    `| ${widths
      .map((width, index) => (row[index] ?? '').padEnd(width, ' '))
      .join(' | ')} |`
  return [
    formatRow(rows[0]),
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...rows.slice(2).map(formatRow),
  ].join('\n')
}
