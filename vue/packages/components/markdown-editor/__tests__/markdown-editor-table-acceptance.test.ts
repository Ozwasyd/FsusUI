import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorProjection,
  createMarkdownTableEntries,
  stabilizeMarkdownEditorProjection,
} from '../../../wasm/markdown-runtime'
import {
  formatMarkdownTable,
  formatMarkdownTableBlock,
  insertMarkdownTable,
  parseMarkdownTableBlock,
  serializeMarkdownTable,
} from '../src/markdown-editor-table'
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
  resolveMarkdownTableCell,
  resolveMarkdownTableCellAtOffset,
  type MarkdownTableCellIdentity,
} from '../src/markdown-editor-table-structure'
import {
  evaluateMarkdownTableInputMutations,
  evaluateMarkdownTablePasteFormatMutations,
  parseMarkdownTableData,
  parseMarkdownTableTsv,
  planMarkdownTableFormat,
  planMarkdownTablePaste,
  resolveMarkdownTableInputIntent,
} from '../src/markdown-editor-table-input'
import {
  MARKDOWN_TABLE_ACCEPTANCE_MODES,
  MARKDOWN_TABLE_ACCEPTANCE_SCALES,
  MARKDOWN_TABLE_ACCEPTANCE_VERSION,
  MARKDOWN_TABLE_TOUCH_TARGET_MIN,
  createMarkdownTableCommands,
  resolveMarkdownTableContextActions,
} from '../src/markdown-editor-table-acceptance'
import { defaultMarkdownEditorCommands } from '../src/markdown-editor'
import { MarkdownEditorTransactionStore } from '../src/markdown-editor-transaction'

const doc = { id: 'test-doc', epoch: 1 }

describe('Markdown Table Chain Acceptance (#370, #371, #372, #373)', () => {
  describe('#370: Structural transactions and cell projection', () => {
    it('generates 1x1, 2x2, and 20x50 tables accurately without regex split pipe', () => {
      const t1 = insertMarkdownTable({ rows: 1, columns: 1 })
      const p1 = parseMarkdownTableBlock(t1)
      expect(p1).not.toBeNull()
      expect(p1!.columnCount).toBe(1)
      expect(p1!.rows).toHaveLength(1)

      const t20 = insertMarkdownTable({ rows: 50, columns: 20 })
      const p20 = parseMarkdownTableBlock(t20)
      expect(p20).not.toBeNull()
      expect(p20!.columnCount).toBe(20)
      expect(p20!.rows).toHaveLength(50)

      const escaped = parseMarkdownTableBlock(
        '| a\\|b | `c | d` | normal |\n| --- | --- | --- |\n',
      )
      expect(escaped?.header).toEqual(['a\\|b', '`c | d`', 'normal'])
    })

    it('performs row insert above/below, delete, and move operations', () => {
      const base = insertMarkdownTable({ rows: 2, columns: 2 })
      const source = `header prose\n\n${base}\n\nfooter prose\n`
      const proj = stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        doc,
      )
      const table = createMarkdownTableEntries(proj)[0]!

      // Insert row below row 1
      const insBelow = planMarkdownTableInsertRow(source, doc, table.id, 1, 'below', 1)
      expect('changes' in insBelow).toBe(true)
      if ('changes' in insBelow) {
        const next = `${source.slice(0, insBelow.changes[0]!.from)}${insBelow.changes[0]!.insert}${source.slice(insBelow.changes[0]!.to)}`
        expect(next.startsWith('header prose\n\n')).toBe(true)
        expect(next.endsWith('\n\nfooter prose\n')).toBe(true)

        const nextProj = stabilizeMarkdownEditorProjection(
          createMarkdownEditorProjection(next),
          doc,
        )
        const nextTable = createMarkdownTableEntries(nextProj)[0]!
        const parsedNext = parseMarkdownTableBlock(
          next.slice(nextTable.range.start, nextTable.range.end),
        )
        expect(parsedNext!.rows).toHaveLength(3)
      }

      // Delete row
      const delRow = planMarkdownTableDeleteRow(source, doc, table.id, 1, 1)
      expect('changes' in delRow).toBe(true)
      if ('changes' in delRow) {
        const next = `${source.slice(0, delRow.changes[0]!.from)}${delRow.changes[0]!.insert}${source.slice(delRow.changes[0]!.to)}`
        const nextProj = stabilizeMarkdownEditorProjection(
          createMarkdownEditorProjection(next),
          doc,
        )
        const nextTable = createMarkdownTableEntries(nextProj)[0]!
        const parsedNext = parseMarkdownTableBlock(
          next.slice(nextTable.range.start, nextTable.range.end),
        )
        expect(parsedNext!.rows).toHaveLength(1)
      }

      // Move row down
      const moveRow = planMarkdownTableMoveRow(source, doc, table.id, 1, 'down', 1)
      expect('changes' in moveRow).toBe(true)
    })

    it('performs column insert left/right, delete, move, and alignment operations', () => {
      const base = insertMarkdownTable({ rows: 2, columns: 2 })
      const source = `start\n\n${base}\n\nend\n`
      const proj = stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        doc,
      )
      const table = createMarkdownTableEntries(proj)[0]!

      // Insert column
      const insCol = planMarkdownTableInsertColumn(source, doc, table.id, 0, 'left', 1)
      expect('changes' in insCol).toBe(true)
      if ('changes' in insCol) {
        const next = `${source.slice(0, insCol.changes[0]!.from)}${insCol.changes[0]!.insert}${source.slice(insCol.changes[0]!.to)}`
        const nextProj = stabilizeMarkdownEditorProjection(
          createMarkdownEditorProjection(next),
          doc,
        )
        const nextTable = createMarkdownTableEntries(nextProj)[0]!
        const parsed = parseMarkdownTableBlock(
          next.slice(nextTable.range.start, nextTable.range.end),
        )
        expect(parsed!.columnCount).toBe(3)
      }

      // Delete column
      const delCol = planMarkdownTableDeleteColumn(source, doc, table.id, 1, 1)
      expect('changes' in delCol).toBe(true)

      // Move column
      const moveCol = planMarkdownTableMoveColumn(source, doc, table.id, 0, 'right', 1)
      expect('changes' in moveCol).toBe(true)

      // Align column
      const alignCol = planMarkdownTableAlignColumn(source, doc, table.id, 0, 'right', 1)
      expect('changes' in alignCol).toBe(true)
      if ('changes' in alignCol) {
        expect(alignCol.changes[0]!.insert).toContain('---:')
      }
    })

    it('resolves stable cell identity through structural operations and marks deleted cells', () => {
      const base = insertMarkdownTable({ rows: 2, columns: 2 })
      const source = `${base}\n`
      const proj = stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        doc,
      )
      const table = createMarkdownTableEntries(proj)[0]!

      const cell: MarkdownTableCellIdentity = {
        tableId: table.id,
        row: 1,
        column: 1,
        status: 'current',
      }

      // Row inserted above shifts row down
      const afterRowInsert = resolveMarkdownTableCell(source, doc, cell, {
        type: 'insert-row',
        index: 1,
      })
      expect(afterRowInsert.row).toBe(2)
      expect(afterRowInsert.column).toBe(1)
      expect(afterRowInsert.status).toBe('current')

      // Row deleted on current cell marks cell deleted
      const afterRowDelete = resolveMarkdownTableCell(source, doc, cell, {
        type: 'delete-row',
        index: 1,
      })
      expect(afterRowDelete.status).toBe('deleted')

      // Column deleted on current cell marks cell deleted
      const afterColDelete = resolveMarkdownTableCell(source, doc, cell, {
        type: 'delete-column',
        index: 1,
      })
      expect(afterColDelete.status).toBe('deleted')
    })

    it('rejects stale revisions and malformed tables without modifying source', () => {
      const source = 'not a valid table\n'
      const staleRes = planMarkdownTableInsertRow(
        source,
        { id: 'doc', epoch: 0 },
        'syn:missing',
        0,
        'below',
        -1,
      )
      expect(staleRes).toEqual({ rejected: 'stale' })

      const report = evaluateMarkdownTableMutations('| h |\n| --- |\n| c |\n', doc)
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
  })

  describe('#371: Keyboard navigation and input intent machine', () => {
    it('advances cells with Tab, wraps at end of row, and appends row at last cell', () => {
      const base = insertMarkdownTable({ rows: 1, columns: 2 })
      const source = `${base}\n`
      const proj = stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        doc,
      )
      const table = createMarkdownTableEntries(proj)[0]!

      // Cell 0,0 -> Tab -> Cell 0,1
      const res1 = resolveMarkdownTableInputIntent({
        source,
        selection: { start: 0, end: 0, direction: 'none' },
        documentIdentity: doc,
        cell: { tableId: table.id, row: 0, column: 0, status: 'current' },
        key: 'Tab',
      })
      expect(res1.action).toBe('navigate')
      expect(res1.nextCell.column).toBe(1)
      expect(res1.screenReaderText).toContain('Column 2')

      // Cell 0,1 -> Tab -> wraps to Row 1, Column 0
      const res2 = resolveMarkdownTableInputIntent({
        source,
        selection: { start: 0, end: 0, direction: 'none' },
        documentIdentity: doc,
        cell: { tableId: table.id, row: 0, column: 1, status: 'current' },
        key: 'Tab',
      })
      expect(res2.action).toBe('navigate')
      expect(res2.nextCell.row).toBe(1)
      expect(res2.nextCell.column).toBe(0)

      // Cell 1,1 (last cell of table) -> Tab -> appends row (no Tab trap!)
      const res3 = resolveMarkdownTableInputIntent({
        source,
        selection: { start: 0, end: 0, direction: 'none' },
        documentIdentity: doc,
        cell: { tableId: table.id, row: 1, column: 1, status: 'current' },
        key: 'Tab',
      })
      expect(res3.action).toBe('append-row')
      expect(res3.transaction).not.toBeNull()
      expect(res3.nextCell.row).toBe(2)
      expect(res3.nextCell.column).toBe(0)
      const store = new MarkdownEditorTransactionStore(source, {
        start: source.indexOf('Column 2'),
        end: source.indexOf('Column 2'),
      })
      const appended = store.dispatch(res3.transaction!)
      expect(appended.accepted).toBe(true)
      expect(appended.history.undoDepth).toBe(1)
      expect(appended.value).not.toBe(source)
      expect(store.undo().value).toBe(source)
    })

    it('handles Shift+Tab backward navigation and exits backward at (0,0)', () => {
      const base = insertMarkdownTable({ rows: 1, columns: 2 })
      const source = `${base}\n`
      const proj = stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        doc,
      )
      const table = createMarkdownTableEntries(proj)[0]!

      const res0 = resolveMarkdownTableInputIntent({
        source,
        selection: { start: 0, end: 0, direction: 'none' },
        documentIdentity: doc,
        cell: { tableId: table.id, row: 0, column: 0, status: 'current' },
        key: 'Shift+Tab',
      })
      expect(res0.action).toBe('exit-backward')
      expect(res0.nextCell.status).toBe('invalid')
    })

    it('handles Enter moving down, Shift+Enter inserting <br>, and Esc exiting', () => {
      const base = insertMarkdownTable({ rows: 2, columns: 2 })
      const source = `${base}\n`
      const proj = stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        doc,
      )
      const table = createMarkdownTableEntries(proj)[0]!

      // Enter moves to next row
      const enterRes = resolveMarkdownTableInputIntent({
        source,
        selection: { start: 0, end: 0, direction: 'none' },
        documentIdentity: doc,
        cell: { tableId: table.id, row: 0, column: 1, status: 'current' },
        key: 'Enter',
      })
      expect(enterRes.action).toBe('navigate')
      expect(enterRes.nextCell.row).toBe(1)
      expect(enterRes.nextCell.column).toBe(1)

      // Shift+Enter inserts <br>
      const breakRes = resolveMarkdownTableInputIntent({
        source,
        selection: { start: 10, end: 10, direction: 'none' },
        documentIdentity: doc,
        cell: { tableId: table.id, row: 0, column: 0, status: 'current' },
        key: 'Shift+Enter',
      })
      expect(breakRes.action).toBe('insert-line-break')
      expect(breakRes.transaction?.changes[0]?.insert).toBe('<br>')
      const store = new MarkdownEditorTransactionStore(source, {
        start: 10,
        end: 10,
      })
      const insertedBreak = store.dispatch(breakRes.transaction!)
      expect(insertedBreak.accepted).toBe(true)
      expect(insertedBreak.history.undoDepth).toBe(1)
      expect(store.undo().value).toBe(source)

      // Esc exits table
      const escRes = resolveMarkdownTableInputIntent({
        source,
        selection: { start: 0, end: 0, direction: 'none' },
        documentIdentity: doc,
        cell: { tableId: table.id, row: 0, column: 0, status: 'current' },
        key: 'Escape',
      })
      expect(escRes.nextCell.status).toBe('invalid')
      expect(escRes.transaction?.selection).toEqual({
        start: table.range.end,
        end: table.range.end,
        direction: 'none',
      })
      expect(
        resolveMarkdownTableCellAtOffset(source, doc, table.range.end),
      ).toBeNull()
    })

    it('handles empty cells and explicit row/column/table selections atomically', () => {
      const source = '| h1 | h2 |\n| --- | --- |\n|  | value |\n'
      const table = createMarkdownTableEntries(
        stabilizeMarkdownEditorProjection(
          createMarkdownEditorProjection(source),
          doc,
        ),
      )[0]!
      const empty = resolveMarkdownTableCellAtOffset(
        source,
        doc,
        source.indexOf('|  |') + 2,
      )!
      const selection = {
        start: empty.anchor!.start,
        end: empty.anchor!.start,
        direction: 'none' as const,
      }

      const backspace = resolveMarkdownTableInputIntent({
        source,
        selection,
        documentIdentity: doc,
        cell: empty,
        cellText: '',
        key: 'Backspace',
      })
      expect(backspace.action).toBe('navigate')
      expect(backspace.nextCell.row).toBe(0)

      const deleteColumn = resolveMarkdownTableInputIntent({
        source,
        selection,
        documentIdentity: doc,
        cell: empty,
        key: 'Delete',
        structuredSelection: { kind: 'column', index: 0 },
        expectedRevision: 0,
      })
      expect(deleteColumn.action).toBe('delete-column')
      expect(deleteColumn.transaction?.changes).toHaveLength(1)
      expect(deleteColumn.screenReaderText).toBe('Deleted column 1')

      const deleteRow = resolveMarkdownTableInputIntent({
        source,
        selection,
        documentIdentity: doc,
        cell: empty,
        key: 'Delete',
        structuredSelection: { kind: 'row', index: 1 },
        expectedRevision: 0,
      })
      expect(deleteRow.action).toBe('delete-row')
      expect(deleteRow.nextCell.status).toBe('deleted')

      const deleteTable = resolveMarkdownTableInputIntent({
        source,
        selection: {
          start: table.range.start,
          end: table.range.end,
          direction: 'forward',
        },
        documentIdentity: doc,
        cell: empty,
        key: 'Delete',
        structuredSelection: { kind: 'table' },
        expectedRevision: 0,
      })
      expect(deleteTable.action).toBe('delete-table')
      expect(deleteTable.transaction?.selection).toEqual({
        start: table.range.start,
        end: table.range.start,
        direction: 'none',
      })
    })

    it('prevents cell switching during CJK IME composition and passes input mutations fixture', () => {
      const res = resolveMarkdownTableInputIntent({
        source: '| a |\n| --- |\n| b |\n',
        selection: { start: 0, end: 0, direction: 'none' },
        documentIdentity: doc,
        cell: { tableId: 'syn:1', row: 0, column: 0, status: 'current' },
        key: 'Tab',
        compositionActive: true,
      })
      expect(res.rejected).toBe('composition-active')
      expect(res.transaction).toBeNull()

      const report = evaluateMarkdownTableInputMutations()
      expect(
        Object.fromEntries(
          report.mutations.map(({ accepted, equivalent, kind }) => [
            kind,
            { accepted, equivalent },
          ]),
        ),
      ).toEqual({
        'auto-format': { accepted: false, equivalent: false },
        'composition-switch': { accepted: false, equivalent: false },
        'local-keydown': { accepted: false, equivalent: false },
        'naked-index': { accepted: false, equivalent: false },
        'tab-trap': { accepted: false, equivalent: false },
      })
    })
  })

  describe('#372: TSV/CSV paste and explicit table format transaction', () => {
    it('parses RFC 4180 TSV/CSV with quotes, escaped quotes, and newlines in cells', () => {
      const csv = 'col1,col2\n"quoted val","line1\nline2"\n"with ""quotes""",normal'
      const parsed = parseMarkdownTableData(csv, 'text/csv')
      expect('rows' in parsed).toBe(true)
      if ('rows' in parsed) {
        expect(parsed.rowCount).toBe(3)
        expect(parsed.columns).toBe(2)
        expect(parsed.rows[1]![1]).toBe('line1<br>line2')
        expect(parsed.rows[2]![0]).toBe('with "quotes"')
      }

      const spaces = parseMarkdownTableData('"  keep  ", value ', 'text/csv')
      expect('rows' in spaces && spaces.rows[0]).toEqual(['  keep  ', ' value '])
      expect(parseMarkdownTableData('"unterminated,value', 'text/csv')).toEqual({
        rejected: 'malformed',
      })
      expect(parseMarkdownTableData('plain,comma')).toEqual({
        rejected: 'not-table',
      })
      const controller = new AbortController()
      controller.abort()
      expect(
        parseMarkdownTableData('a,b', 'text/csv', {
          signal: controller.signal,
        }),
      ).toEqual({ rejected: 'aborted' })

      // Rejects exceeding budget
      const hugeData = Array.from({ length: 1001 }, () => 'a,b').join('\n')
      expect(parseMarkdownTableData(hugeData, 'text/csv')).toEqual({
        rejected: 'budget-exceeded',
      })
    })

    it('pastes data expanding columns and rows into a single history transaction', () => {
      const base = insertMarkdownTable({ rows: 1, columns: 2 })
      const source = `before\n\n${base}\n\nafter\n`
      const proj = stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection(source),
        doc,
      )
      const table = createMarkdownTableEntries(proj)[0]!
      const currentCell = resolveMarkdownTableCellAtOffset(
        source,
        doc,
        source.indexOf('Column 1'),
      )!

      const pasteRes = planMarkdownTablePaste(
        source,
        doc,
        table.id,
        currentCell,
        'c1\tc2\tc3\nv1|x\tv2\tv3\nv4\tv5\tv6',
        'text/tab-separated-values',
        1,
      )
      expect('changes' in pasteRes).toBe(true)
      if ('changes' in pasteRes) {
        expect(pasteRes.history).toBe('separate')
        expect(pasteRes.origin).toBe('paste')
        const next = `${source.slice(0, pasteRes.changes[0]!.from)}${pasteRes.changes[0]!.insert}${source.slice(pasteRes.changes[0]!.to)}`
        expect(next.startsWith('before\n\n')).toBe(true)
        expect(next.endsWith('\n\nafter\n')).toBe(true)
        expect(next).toContain('c3')
        expect(next).toContain('v1\\|x')
        expect(next).toContain('v6')
      }
    })

    it('explicitly formats tables with column padding while preserving escaped pipes and code spans', () => {
      const raw = '| short | very long column header |\n| --- | :---: |\n| a\\|b | `x | y` |\n'
      const formatted = formatMarkdownTableBlock(raw, true)
      expect(formatted).not.toBeNull()
      expect(formatted).toContain('a\\|b')
      expect(formatted).toContain('`x | y`')

      const plan = planMarkdownTableFormat(raw, doc, 'syn:doc:1:table:0', 1)
      expect('changes' in plan || 'rejected' in plan).toBe(true)

      const mutationsReport = evaluateMarkdownTablePasteFormatMutations()
      expect(
        Object.fromEntries(
          mutationsReport.mutations.map(
            ({ accepted, equivalent, kind }) => [
              kind,
              { accepted, equivalent },
            ],
          ),
        ),
      ).toEqual({
        'budget-bypass': { accepted: false, equivalent: false },
        'html-round-trip': { accepted: false, equivalent: false },
        'ordinary-auto-format': { accepted: false, equivalent: false },
        'per-cell-history': { accepted: false, equivalent: false },
        'stale-paste': { accepted: false, equivalent: false },
      })
    })
  })

  describe('#373: Compact contextual UI, wide table scrolling & all-input acceptance', () => {
    it('registers table commands into #270 command registry with contextual availability', () => {
      const commands = createMarkdownTableCommands()
      expect(commands.some((c) => c.key === 'table-insert')).toBe(true)
      expect(commands.some((c) => c.key === 'table-format')).toBe(true)
      expect(defaultMarkdownEditorCommands.some((c) => c.key === 'table-insert')).toBe(true)

      const actions = resolveMarkdownTableContextActions()
      expect(actions.length).toBeGreaterThanOrEqual(6)
      expect(actions.every((a) => a.minTouchTarget >= MARKDOWN_TABLE_TOUCH_TARGET_MIN)).toBe(
        true,
      )
    })

    it('publishes the matrix identifiers used by independent rendered acceptance', () => {
      expect(MARKDOWN_TABLE_ACCEPTANCE_VERSION).toBe(
        'markdown-table-acceptance@2026-08-27',
      )
      expect(MARKDOWN_TABLE_ACCEPTANCE_SCALES).toEqual([1, 2, 20])
      expect(MARKDOWN_TABLE_ACCEPTANCE_MODES).toContain('live')
      expect(MARKDOWN_TABLE_ACCEPTANCE_MODES).toContain('split')
    })
  })
})
