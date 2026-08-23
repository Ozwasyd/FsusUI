import {
  createMarkdownEditorProjection,
  createMarkdownTableEntries,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
} from '../../../wasm/markdown-runtime'
import type { MarkdownEditorTransaction } from './markdown-editor-transaction'
import { insertMarkdownTable } from './markdown-editor-table'

export type MarkdownTableAlignment = 'left' | 'center' | 'right'

export interface MarkdownTableCellIdentity {
  readonly tableId: string
  readonly row: number
  readonly column: number
  readonly status: 'current' | 'deleted' | 'invalid'
}

const alignmentToken = (value: MarkdownTableAlignment) => {
  if (value === 'left') return ':---'
  if (value === 'right') return '---:'
  return ':---:'
}

const splitRow = (line: string) =>
  line
    .replace(/^\s*\|/u, '')
    .replace(/\|\s*$/u, '')
    .split(/(?<!\\)\|/u)
    .map((cell) => cell.trim())

export const planMarkdownTableInsert = (
  source: string,
  offset: number,
  rows: number,
  columns: number,
): MarkdownEditorTransaction => {
  const table = insertMarkdownTable({ rows, columns })
  const prefix = offset > 0 && source[offset - 1] !== '\n' ? '\n' : ''
  return {
    changes: [{ from: offset, to: offset, insert: `${prefix}${table}\n` }],
    history: 'separate',
    origin: 'command',
  }
}

export const planMarkdownTableAlignColumn = (
  source: string,
  documentIdentity: MarkdownDocumentIdentity,
  tableId: string,
  column: number,
  alignment: MarkdownTableAlignment,
  expectedRevision: number,
): MarkdownEditorTransaction | { readonly rejected: 'malformed' | 'stale' | 'missing' } => {
  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
  )
  const table = createMarkdownTableEntries(projection).find((entry) => entry.id === tableId)
  if (!table) return { rejected: 'missing' }
  const slice = source.slice(table.range.start, table.range.end)
  const lines = slice.split(/\r\n|\r|\n/)
  const separator = lines.findIndex((line) =>
    splitRow(line).every((cell) => /^:?-+:?$/.test(cell.replace(/\s/g, ''))),
  )
  if (separator < 0) return { rejected: 'malformed' }
  const cells = splitRow(lines[separator]!)
  if (column < 0 || column >= cells.length) return { rejected: 'malformed' }
  cells[column] = alignmentToken(alignment)
  lines[separator] = `| ${cells.join(' | ')} |`
  return {
    changes: [
      {
        from: table.range.start,
        to: table.range.end,
        insert: lines.join('\n'),
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
): MarkdownTableCellIdentity => {
  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
  )
  const table = createMarkdownTableEntries(projection).find(
    (entry) => entry.id === previous.tableId,
  )
  if (!table) return { ...previous, status: 'deleted' }
  return { ...previous, tableId: table.id, status: 'current' }
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
