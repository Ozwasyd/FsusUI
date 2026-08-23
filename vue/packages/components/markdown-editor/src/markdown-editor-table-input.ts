import type { MarkdownTableCellIdentity } from './markdown-editor-table-structure'

export type MarkdownTableNavKey = 'Tab' | 'Shift+Tab' | 'Enter' | 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

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

export const parseMarkdownTableTsv = (payload: string) =>
  payload
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => line.split('\t'))

export type MarkdownTableInputMutationKind = 'local-keydown' | 'auto-format'

export const evaluateMarkdownTableInputMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: 'local-keydown' as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: 'auto-format' as const, equivalent: false, accepted: false }),
    ]),
  })
