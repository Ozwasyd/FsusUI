import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorProjection,
  createMarkdownTableEntries,
  stabilizeMarkdownEditorProjection,
} from '../../../wasm/markdown-runtime'
import {
  createMarkdownEditorPositionMap,
  MarkdownEditorTransactionStore,
} from '../src/markdown-editor-transaction'
import {
  evaluateMarkdownTableMutations,
  planMarkdownTableAlignColumn,
  planMarkdownTableDelete,
  planMarkdownTableDeleteColumn,
  planMarkdownTableDeleteRow,
  planMarkdownTableInsert,
  planMarkdownTableInsertColumn,
  planMarkdownTableInsertRow,
  planMarkdownTableMoveColumn,
  planMarkdownTableMoveRow,
  resolveMarkdownTableCellAtOffset,
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
    expect(
      Object.fromEntries(
        report.mutations.map(({ accepted, equivalent, kind }) => [
          kind,
          { accepted, equivalent },
        ]),
      ),
    ).toEqual({
      'grid-authority': { accepted: false, equivalent: false },
      'regex-parse': { accepted: false, equivalent: false },
      'stale-cell': { accepted: false, equivalent: false },
      'whole-doc-rewrite': { accepted: false, equivalent: false },
    })
  })

  it('returns no table cell for a large pipe-free document', () => {
    const source = Array.from(
      { length: 300 },
      (_, index) => `## Section ${index}\n\nParagraph ${index} with 中文 content.\n`,
    ).join('\n')

    expect(
      resolveMarkdownTableCellAtOffset(source, document, source.length),
    ).toBeNull()
  })

  it('dispatches one undoable target-table change with an explicit mapped selection', () => {
    const source =
      'before  \n\n| h1 | h2 |\n| --- | ---: |\n| a\\|b | `[x](u) | code` |\n\nafter  \n'
    const table = createMarkdownTableEntries(
      stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        document,
      ),
    )[0]!
    const current = resolveMarkdownTableCellAtOffset(
      source,
      document,
      source.indexOf('a\\|b'),
    )!
    const plan = planMarkdownTableInsertColumn(
      source,
      document,
      table.id,
      0,
      'right',
      0,
      current.row,
    )
    expect('changes' in plan).toBe(true)
    if (!('changes' in plan)) return

    expect(plan.changes).toHaveLength(1)
    expect(plan.changes[0]!.from).toBe(table.range.start)
    expect(plan.changes[0]!.to).toBe(table.range.end)
    expect(source.slice(0, plan.changes[0]!.from)).toBe('before  \n\n')
    expect(source.slice(plan.changes[0]!.to)).toBe('\nafter  \n')
    expect(plan.selection?.start).toBeGreaterThan(plan.changes[0]!.from)
    expect(plan.selection?.end).toBeGreaterThanOrEqual(plan.selection!.start)

    const outside = createMarkdownEditorPositionMap(plan.changes).rebase({
      start: source.indexOf('after'),
      end: source.indexOf('after') + 5,
    })
    expect(outside).toBeDefined()

    const store = new MarkdownEditorTransactionStore(source, {
      start: current.anchor!.start,
      end: current.anchor!.end,
    })
    const result = store.dispatch(plan)
    expect(result.accepted).toBe(true)
    expect(result.history.undoDepth).toBe(1)
    expect(result.value.startsWith('before  \n\n')).toBe(true)
    expect(result.value.endsWith('\nafter  \n')).toBe(true)
    expect(store.undo().value).toBe(source)
  })

  it('keeps every structural operation scoped, mapped, and undoable', () => {
    const source =
      'before  \n\n| h1 | h2 | h3 |\n| --- | --- | --- |\n| a1 | a2 | a3 |\n| b1 | b2 | b3 |\n| c1 | c2 | c3 |\n\nafter  \n'
    const table = createMarkdownTableEntries(
      stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        document,
      ),
    )[0]!
    const operations = [
      () => planMarkdownTableInsertRow(source, document, table.id, 1, 'below', 0),
      () => planMarkdownTableDeleteRow(source, document, table.id, 1, 0),
      () => planMarkdownTableMoveRow(source, document, table.id, 1, 'down', 0),
      () => planMarkdownTableInsertColumn(source, document, table.id, 0, 'right', 0),
      () => planMarkdownTableDeleteColumn(source, document, table.id, 1, 0),
      () => planMarkdownTableMoveColumn(source, document, table.id, 0, 'right', 0),
      () => planMarkdownTableAlignColumn(source, document, table.id, 1, 'right', 0),
      () => planMarkdownTableDelete(source, document, table.id, 0),
    ]

    for (const createPlan of operations) {
      const plan = createPlan()
      expect('changes' in plan).toBe(true)
      if (!('changes' in plan)) continue
      expect(plan.changes).toHaveLength(1)
      expect(plan.changes[0]).toMatchObject({
        from: table.range.start,
        to: table.range.end,
      })

      const afterRange = {
        start: source.indexOf('after'),
        end: source.indexOf('after') + 'after'.length,
      }
      const mappedAfter = createMarkdownEditorPositionMap(plan.changes, {
        source,
      }).rebase(afterRange)
      expect(mappedAfter.status).not.toBe('deleted')
      if (mappedAfter.status === 'deleted') continue

      const store = new MarkdownEditorTransactionStore(source)
      const result = store.dispatch(plan)
      expect(result.accepted).toBe(true)
      expect(result.history.undoDepth).toBe(1)
      expect(result.value.slice(mappedAfter.start, mappedAfter.end)).toBe('after')
      expect(store.undo().value).toBe(source)
    }
  })

  it('keeps the current cell selected across insert and move operations', () => {
    const source =
      '| h1 | h2 | h3 |\n| --- | --- | --- |\n| a1 | a2 | a3 |\n| b1 | b2 | b3 |\n'
    const table = createMarkdownTableEntries(
      stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        document,
      ),
    )[0]!
    const plans = [
      planMarkdownTableInsertRow(source, document, table.id, 1, 'above', 0, 1),
      planMarkdownTableInsertRow(source, document, table.id, 1, 'below', 0, 1),
      planMarkdownTableMoveRow(source, document, table.id, 1, 'down', 0, 1),
      planMarkdownTableInsertColumn(source, document, table.id, 1, 'left', 0, 1),
      planMarkdownTableInsertColumn(source, document, table.id, 1, 'right', 0, 1),
      planMarkdownTableMoveColumn(source, document, table.id, 1, 'right', 0, 1),
    ]

    for (const plan of plans) {
      expect('changes' in plan).toBe(true)
      if (!('changes' in plan)) continue
      const result = new MarkdownEditorTransactionStore(source).dispatch(plan)
      expect(result.accepted).toBe(true)
      expect(result.value.slice(result.selection.start, result.selection.end)).toBe(
        'a2',
      )
    }
  })

  it('retains opaque cell identity while remapping parser-owned anchors', () => {
    const source = '| h1 | h2 |\n| --- | --- |\n| a | b |\n'
    const current = resolveMarkdownTableCellAtOffset(
      source,
      document,
      source.indexOf('b'),
    )!
    expect(current.cellId).not.toMatch(/cell:\\d+:\\d+$/u)
    const table = createMarkdownTableEntries(
      stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        document,
      ),
    )[0]!
    const plan = planMarkdownTableInsertColumn(
      source,
      document,
      table.id,
      0,
      'left',
      0,
      current.row,
    )
    expect('changes' in plan).toBe(true)
    if (!('changes' in plan)) return
    const change = plan.changes[0]!
    const next =
      source.slice(0, change.from) + change.insert + source.slice(change.to)
    const remapped = resolveMarkdownTableCell(next, document, current, {
      type: 'insert-column',
      index: 0,
    })
    expect(remapped.status).toBe('current')
    expect(remapped.cellId).toBe(current.cellId)
    expect(remapped.column).toBe(2)
    expect(next.slice(remapped.anchor!.start, remapped.anchor!.end)).toBe('b')
  })

  it('rejects a table plan prepared before the current document revision', () => {
    const source = '| h1 | h2 |\n| --- | --- |\n| a | b |\n'
    const table = createMarkdownTableEntries(
      stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        document,
      ),
    )[0]!
    const stalePlan = planMarkdownTableAlignColumn(
      source,
      document,
      table.id,
      0,
      'left',
      0,
    )
    expect('changes' in stalePlan).toBe(true)
    if (!('changes' in stalePlan)) return

    const store = new MarkdownEditorTransactionStore(source)
    expect(
      store.dispatch({
        changes: [{ from: source.length, insert: '\n', to: source.length }],
        history: 'separate',
        origin: 'input',
      }).accepted,
    ).toBe(true)
    const staleResult = store.dispatch(stalePlan)
    expect(staleResult.accepted).toBe(false)
    expect(staleResult.reason).toBe('stale-revision')
    expect(staleResult.value).toBe(`${source}\n`)
  })
})
