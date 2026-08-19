export interface MarkdownEditorTableInsert {
  readonly rows: number
  readonly columns: number
}

const emptyRow = (columns: number, fill: (index: number) => string) =>
  `| ${Array.from({ length: columns }, (_, index) => fill(index)).join(' | ')} |`

export const insertMarkdownTable = ({
  rows,
  columns,
}: MarkdownEditorTableInsert): string => {
  const header = emptyRow(columns, (index) => `Column ${index + 1}`)
  const divider = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`
  const body = Array.from({ length: Math.max(0, rows) }, () =>
    emptyRow(columns, () => ''),
  )
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

const isAlignmentCell = (cell: string) => /^:?-+:?$/u.test(cell.replace(/\s/g, ''))

const formatAlignmentCell = (cell: string): string => {
  const trimmed = cell.replace(/\s/g, '')
  if (!isAlignmentCell(trimmed)) return '---'
  const left = trimmed.startsWith(':')
  const right = trimmed.endsWith(':')
  if (left && right) return ':---:'
  if (right) return '---:'
  if (left) return ':---'
  return '---'
}

export const formatMarkdownTable = (source: string): string => {
  const lines = source.split(/\r\n|\r|\n/)
  const formatted = lines.map((line) => {
    if (!line.includes('|')) return line
    const cells = splitTableCells(line)
    if (cells.length === 0) return line
    if (cells.every((cell) => isAlignmentCell(cell))) {
      return `| ${cells.map((cell) => formatAlignmentCell(cell)).join(' | ')} |`
    }
    return `| ${cells.join(' | ')} |`
  })
  return formatted.join('\n')
}
