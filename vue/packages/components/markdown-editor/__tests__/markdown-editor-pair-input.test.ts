import { describe, expect, it } from 'vitest'

import {
  applyMarkdownEditorChanges,
  MarkdownEditorTransactionStore,
} from '../src/markdown-editor-transaction'
import {
  MARKDOWN_PAIR_DEFAULTS,
  evaluateMarkdownPairInputMutations,
  resolveMarkdownPairInput,
} from '../src/markdown-editor-pair-input'

const apply = (
  source: string,
  start: number,
  inserted?: string,
  end = start,
  extras: Parameters<typeof resolveMarkdownPairInput>[0] = {} as never,
) => {
  const plan = resolveMarkdownPairInput({
    source,
    selection: { start, end, direction: 'none' },
    inserted,
    documentIdentity: { id: 'doc', epoch: 1 },
    ...extras,
  })
  const next = plan.transaction
    ? applyMarkdownEditorChanges(source, plan.transaction.changes)?.value
    : source
  const caret = plan.transaction?.selection?.start
  return { plan, next, caret }
}

describe('markdown smart pairing', () => {
  it('inserts, wraps, skips, and deletes the closed default pair set', () => {
    expect(MARKDOWN_PAIR_DEFAULTS.map((pair) => pair.join(''))).toEqual([
      '()',
      '[]',
      '{}',
      '""',
      "''",
      '``',
      '**',
      '__',
    ])
    for (const [open, close] of MARKDOWN_PAIR_DEFAULTS) {
      const inserted = apply('ab ', 3, open)
      expect(inserted.plan.action).toBe('insert-pair')
      expect(inserted.next).toBe(`ab ${open}${close}`)
      expect(inserted.caret).toBe(4)

      const wrapped = apply('item', 0, open, 4)
      expect(wrapped.plan.action).toBe('wrap')
      expect(wrapped.next).toBe(`${open}item${close}`)

      const skipped = apply(`ab ${open}${close}`, 4, close)
      expect(skipped.plan.action).toBe('skip-close')
      expect(skipped.next).toBe(`ab ${open}${close}`)
      expect(skipped.caret).toBe(5)

      const deleted = resolveMarkdownPairInput({
        source: `ab ${open}${close}`,
        selection: { start: 4, end: 4 },
        key: 'backspace',
      })
      expect(deleted.action).toBe('delete-pair')
      expect(
        applyMarkdownEditorChanges(`ab ${open}${close}`, deleted.transaction!.changes)?.value,
      ).toBe('ab ')
    }
  })

  it('does not pair apostrophes inside words, auto-strong, or code/escaped/composition', () => {
    expect(apply("dont", 3, "'").plan.action).toBe('passthrough')
    expect(apply('item', 4, '*').next).toBe('item**')
    expect(apply('item', 4, '*').next).not.toBe('item****')
    expect(apply('\\', 1, '(').plan.rejected).toBe('disabled-context')
    expect(
      apply('```\ncode\n```\n', 7, '(', 7, {}).plan.rejected,
    ).toBe('disabled-context')
    expect(
      apply('item', 4, '(', 4, { composing: true }).plan.rejected,
    ).toBe('composition-active')
  })

  it('creates a closing fence from the third backtick on a blank line and pairs URL after ]', () => {
    const fence = apply('``', 2, '`')
    expect(fence.plan.action).toBe('insert-fence')
    expect(fence.next).toBe('```\n\n```')
    expect(fence.caret).toBe(4)

    const url = apply('[]', 2, '(')
    expect(url.next).toBe('[]()')
    expect(url.caret).toBe(3)
  })

  it('uses the same history semantics for source/live/split and supports undo', () => {
    const results = (['source', 'live', 'split'] as const).map((mode) => {
      const plan = resolveMarkdownPairInput({
        source: 'ab',
        selection: { start: 2, end: 2 },
        inserted: '(',
        mode,
      })
      return applyMarkdownEditorChanges('ab', plan.transaction!.changes)!.value
    })
    expect(new Set(results).size).toBe(1)
    expect(results[0]).toBe('ab()')

    const store = new MarkdownEditorTransactionStore('ab', { start: 2, end: 2 })
    store.dispatch(
      resolveMarkdownPairInput({
        source: store.value,
        selection: store.selection,
        inserted: '(',
      }).transaction!,
    )
    expect(store.value).toBe('ab()')
    store.undo()
    expect(store.value).toBe('ab')
  })

  it('rejects pair drift, composition pairing, auto-strong, and consumer keydown', () => {
    const report = evaluateMarkdownPairInputMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority.transaction?.changes[0]?.insert).toBe('**')
    expect(byKind['auto-strong']?.accepted).toBe(false)
    expect(byKind['pair-drift']?.accepted).toBe(false)
    expect(byKind['composition-pair']?.accepted).toBe(false)
    expect(byKind['consumer-keydown']?.accepted).toBe(false)
  })
})
