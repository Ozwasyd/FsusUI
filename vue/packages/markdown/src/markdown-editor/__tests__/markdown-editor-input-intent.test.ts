import { describe, expect, it } from 'vitest'

import {
  applyMarkdownEditorChanges,
  MarkdownEditorTransactionStore,
} from '../src/markdown-editor-transaction'
import {
  MARKDOWN_BLOCK_INPUT_CONTEXTS,
  MARKDOWN_BLOCK_INPUT_KEYS,
  evaluateMarkdownBlockInputMutations,
  markdownBlockInputActionFor,
  resolveMarkdownBlockInputIntent,
} from '../src/markdown-editor-input-intent'

const apply = (
  source: string,
  start: number,
  key: Parameters<typeof resolveMarkdownBlockInputIntent>[0]['key'],
  end = start,
) => {
  const plan = resolveMarkdownBlockInputIntent({
    source,
    selection: { start, end, direction: 'none' },
    key,
    documentIdentity: { id: 'doc', epoch: 1 },
  })
  const next = plan.transaction
    ? applyMarkdownEditorChanges(source, plan.transaction.changes)?.value
    : source
  return { plan, next }
}

describe('markdown block input intents', () => {
  it('continues and exits lists from projection context, not the current line regex', () => {
    const source = '- 第一段'
    const continued = apply(source, source.length, 'enter')
    expect(continued.plan.intent.context).toBe('list')
    expect(continued.plan.intent.action).toBe('continue-list')
    expect(continued.next).toBe('- 第一段\n- ')

    const exited = apply('- ', 2, 'enter')
    expect(exited.plan.intent.action).toBe('exit-list')
    expect(exited.next).toBe('')
  })

  it('documents one result per registered context for enter and tab', () => {
    const cases = [
      { source: 'Hello.\n', key: 'enter' as const, context: 'paragraph', action: 'insert-break' },
      { source: '# Title\n', key: 'enter' as const, context: 'heading', action: 'insert-break' },
      { source: '- item\n', key: 'enter' as const, context: 'list', action: 'continue-list' },
      { source: '- [ ] task\n', key: 'enter' as const, context: 'task', action: 'continue-list' },
      { source: '> quoted\n', key: 'enter' as const, context: 'quote', action: 'continue-quote' },
      { source: '```\ncode\n```\n', key: 'enter' as const, context: 'code', action: 'insert-break' },
      { source: '| h |\n| --- |\n| c |\n', key: 'enter' as const, context: 'table', action: 'table-hook' },
      { source: 'Hello.\n', key: 'tab' as const, context: 'paragraph', action: 'passthrough-tab' },
      { source: '- item\n', key: 'tab' as const, context: 'list', action: 'indent-list' },
    ]
    for (const fixture of cases) {
      const caret =
        fixture.context === 'code' ? fixture.source.indexOf('code') + 4 : fixture.source.trimEnd().length
      const plan = resolveMarkdownBlockInputIntent({
        source: fixture.source,
        selection: { start: caret, end: caret },
        key: fixture.key,
      })
      expect(plan.intent.context).toBe(fixture.context)
      expect(plan.intent.action).toBe(fixture.action)
    }
  })

  it('keeps the same raw result for source/live/split and supports undo', () => {
    const source = '- item'
    const modes = ['source', 'live', 'split'] as const
    const results = modes.map((mode) => {
      const plan = resolveMarkdownBlockInputIntent({
        source,
        selection: { start: source.length, end: source.length },
        key: 'enter',
      })
      return { mode, next: applyMarkdownEditorChanges(source, plan.transaction!.changes)!.value }
    })
    expect(new Set(results.map((entry) => entry.next)).size).toBe(1)

    const store = new MarkdownEditorTransactionStore(source, {
      start: source.length,
      end: source.length,
    })
    const plan = resolveMarkdownBlockInputIntent({
      source,
      selection: store.selection,
      key: 'enter',
    })
    const dispatched = store.dispatch(plan.transaction!)
    expect(dispatched.accepted).toBe(true)
    expect(store.value).toBe('- item\n- ')
    store.undo()
    expect(store.value).toBe(source)
    expect(store.selection.start).toBe(source.length)
  })

  it('does not rewrite BOM/CRLF or split CJK/emoji graphemes', () => {
    const raw = '\uFEFFhello\r\nworld'
    const plan = resolveMarkdownBlockInputIntent({
      source: raw,
      selection: { start: raw.indexOf('w'), end: raw.indexOf('w') },
      key: 'enter',
    })
    const next = applyMarkdownEditorChanges(raw, plan.transaction!.changes)!.value
    expect(next.startsWith('\uFEFF')).toBe(true)
    expect(next.includes('\r\n')).toBe(true)
    expect(next).toBe('\uFEFFhello\r\n\nworld')

    const emoji = '👩‍💻'
    const deleted = apply(emoji, emoji.length, 'backspace')
    expect(deleted.next).toBe('')
  })

  it('rejects structural intents while composing and leaves table cells to the hook', () => {
    const composing = resolveMarkdownBlockInputIntent({
      source: '- item',
      selection: { start: 6, end: 6 },
      key: 'enter',
      composing: true,
    })
    expect(composing.rejected).toBe('composition-active')
    expect(composing.transaction).toBeNull()

    const table = resolveMarkdownBlockInputIntent({
      source: '| h |\n| --- |\n| c |\n',
      selection: { start: 2, end: 2 },
      key: 'tab',
    })
    expect(table.intent.action).toBe('table-hook')
    expect(table.transaction).toBeNull()
  })

  it('matches the documented action for every context, key, and block position', () => {
    const samples: Record<
      string,
      { source: string; offsets: Partial<Record<string, number>> }
    > = {
      paragraph: { source: 'Hello world.\n', offsets: { 'document-start': 0, start: 0, middle: 6, end: 12, 'document-end': 13 } },
      heading: { source: '# Title\n', offsets: { 'document-start': 0, start: 2, middle: 4, end: 7, 'document-end': 8 } },
      list: { source: '- item\n', offsets: { 'document-start': 0, start: 2, middle: 4, end: 6, empty: undefined, 'document-end': 7 } },
      task: { source: '- [ ] task\n', offsets: { start: 6, middle: 8, end: 10 } },
      quote: { source: '> quoted\n', offsets: { start: 2, middle: 4, end: 8 } },
      code: { source: '```\ncode\n```\n', offsets: { middle: 7, end: 8 } },
      table: { source: '| h |\n| --- |\n| c |\n', offsets: { middle: 2, end: 4 } },
      atomic: { source: '![alt](img.png)\n', offsets: { start: 0, middle: 6, end: 15 } },
      ordinary: { source: '\n\n', offsets: { middle: 1, 'document-start': 0, 'document-end': 2 } },
    }
    const emptyList = resolveMarkdownBlockInputIntent({
      source: '- ',
      selection: { start: 2, end: 2 },
      key: 'enter',
    })
    expect(emptyList.intent.position).toBe('empty')
    expect(emptyList.intent.action).toBe(
      markdownBlockInputActionFor('list', 'enter', 'empty'),
    )

    for (const context of MARKDOWN_BLOCK_INPUT_CONTEXTS) {
      const sample = samples[context]
      expect(sample).toBeDefined()
      for (const key of MARKDOWN_BLOCK_INPUT_KEYS) {
        for (const [position, offset] of Object.entries(sample.offsets)) {
          if (offset === undefined) continue
          const plan = resolveMarkdownBlockInputIntent({
            source: sample.source,
            selection: { start: offset, end: offset },
            key,
          })
          expect(plan.intent.context).toBe(context)
          expect(plan.intent.action).toBe(
            markdownBlockInputActionFor(plan.intent.context, key, plan.intent.position),
          )
          expect(MARKDOWN_BLOCK_INPUT_KEYS.includes(key)).toBe(true)
          expect(position.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('strips list markers, merges blocks, indents lists, and invokes the table hook', () => {
    const stripped = apply('- item', 2, 'backspace')
    expect(stripped.plan.intent.action).toBe('strip-marker')
    expect(stripped.next).toBe('item')

    const merged = apply('# Title\n\npara', 9, 'backspace')
    expect(merged.plan.intent.action).toBe('merge-previous')
    expect(merged.next).toBe('# Title\npara')

    const indented = apply('- item', 2, 'tab')
    expect(indented.plan.intent.action).toBe('indent-list')
    expect(indented.next).toBe('  - item')

    const outdented = apply('  - item', 4, 'shift-tab')
    expect(outdented.plan.intent.action).toBe('outdent-list')
    expect(outdented.next).toBe('- item')

    const hooked = resolveMarkdownBlockInputIntent({
      source: '| h |\n| --- |\n| c |\n',
      selection: { start: 2, end: 2 },
      key: 'tab',
      tableHook: () => ({
        changes: [{ from: 2, to: 2, insert: '\t' }],
        history: 'separate',
        origin: 'input',
        selection: { start: 3, end: 3, direction: 'none' },
      }),
    })
    expect(hooked.intent.action).toBe('table-hook')
    expect(hooked.transaction?.changes[0]?.insert).toBe('\t')
    expect(
      resolveMarkdownBlockInputIntent({
        source: '| h |\n| --- |\n| c |\n',
        selection: { start: 2, end: 2 },
        key: 'enter',
      }).transaction,
    ).toBeNull()
  })

  it('rejects regex context, consumer keydown, DOM mutation, and full-document normalize', () => {
    const report = evaluateMarkdownBlockInputMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority.intent.context).toBe('code')
    expect(byKind['regex-context']?.equivalent).toBe(false)
    expect(byKind['regex-context']?.accepted).toBe(false)
    expect(byKind['consumer-keydown']?.accepted).toBe(false)
    expect(byKind['dom-mutation']?.accepted).toBe(false)
    expect(byKind['full-normalize']?.accepted).toBe(false)
  })
})
