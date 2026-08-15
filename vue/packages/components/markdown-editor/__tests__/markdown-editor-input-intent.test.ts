import { describe, expect, it } from 'vitest'

import {
  applyMarkdownEditorChanges,
  MarkdownEditorTransactionStore,
} from '../src/markdown-editor-transaction'
import {
  evaluateMarkdownBlockInputMutations,
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
