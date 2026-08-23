import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorProjection,
  createMarkdownTableEntries,
  stabilizeMarkdownEditorProjection,
} from '../../../wasm/markdown-runtime'
import {
  evaluateMarkdownTableMutations,
  planMarkdownTableAlignColumn,
  planMarkdownTableInsert,
  resolveMarkdownTableCell,
} from '../src/markdown-editor-table-structure'

const document = { id: 'doc', epoch: 1 }

describe('markdown table structural transactions', () => {
  it('inserts a table and aligns a column without rewriting surrounding source', () => {
    const source = 'before\n\nafter\n'
    const insert = planMarkdownTableInsert(source, 'before\n\n'.length, 1, 2)
    const next = `${source.slice(0, insert.changes[0]!.from)}${insert.changes[0]!.insert}${source.slice(insert.changes[0]!.to)}`
    expect(next.startsWith('before\n')).toBe(true)
    expect(next.endsWith('after\n')).toBe(true)
    const table = createMarkdownTableEntries(
      stabilizeMarkdownEditorProjection(createMarkdownEditorProjection(next), document),
    )[0]
    expect(table?.id.startsWith('syn:')).toBe(true)
    const aligned = planMarkdownTableAlignColumn(next, document, table!.id, 1, 'center', 1)
    expect('changes' in aligned).toBe(true)
    if (!('changes' in aligned)) return
    const formatted = `${next.slice(0, aligned.changes[0]!.from)}${aligned.changes[0]!.insert}${next.slice(aligned.changes[0]!.to)}`
    expect(formatted).toContain('| --- | :---: |')
    expect(formatted.startsWith('before\n')).toBe(true)
    const cell = resolveMarkdownTableCell(formatted, document, {
      tableId: table!.id,
      row: 0,
      column: 1,
      status: 'current',
    })
    expect(cell.status).toBe('current')
    expect(cell.tableId).toBe(table!.id)
  })

  it('rejects stale and malformed table operations', () => {
    const source = 'not a table\n'
    expect(
      planMarkdownTableAlignColumn(source, document, 'syn:missing', 0, 'left', 1),
    ).toEqual({ rejected: 'missing' })
    const report = evaluateMarkdownTableMutations('| h |\n| --- |\n| c |\n', document)
    expect(report.authority).toHaveLength(1)
    expect(report.mutations.every((mutation) => mutation.accepted === false)).toBe(true)
  })
})
