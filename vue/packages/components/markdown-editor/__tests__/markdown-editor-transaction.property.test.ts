import { describe, expect, it } from 'vitest'
import {
  applyMarkdownEditorChanges,
  MarkdownEditorTransactionStore,
  normalizeMarkdownEditorSelection,
  validateMarkdownEditorChanges,
} from '../src/markdown-editor-transaction'

import type {
  MarkdownEditorChange,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from '../src/markdown-editor-transaction'

const selection = (
  start: number,
  end = start,
  direction: MarkdownEditorSelection['direction'] = 'none',
): MarkdownEditorSelection => ({ direction, end, start })

const transaction = (
  changes: readonly MarkdownEditorChange[],
  nextSelection: MarkdownEditorSelection,
  overrides: Partial<MarkdownEditorTransaction> = {},
): MarkdownEditorTransaction => ({
  changes,
  history: 'separate',
  origin: 'programmatic',
  selection: nextSelection,
  ...overrides,
})

const codePointBoundaries = (value: string) => {
  const boundaries = [0]
  let offset = 0
  for (const point of value) {
    offset += point.length
    boundaries.push(offset)
  }
  return boundaries
}

const seededRandom = (seed: number) => {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

describe('MarkdownEditor transaction properties', () => {
  // Unit and property coverage protects the transaction core; native browser
  // and operating-system IME evidence remains a separately-owned acceptance.
  it('round-trips arbitrary sorted non-overlapping UTF-16 changes through inverse changes', () => {
    const random = seededRandom(268)
    const alphabet = ['a', '中', '한', '😀', 'e\u0301', 'אב', '\n']

    for (let iteration = 0; iteration < 300; iteration += 1) {
      const length = Math.floor(random() * 30)
      const value = Array.from(
        { length },
        () => alphabet[Math.floor(random() * alphabet.length)],
      ).join('')
      const boundaries = codePointBoundaries(value)
      const changes: MarkdownEditorChange[] = []
      let minimumBoundary = 0
      const changeCount = Math.floor(random() * 6)

      for (let index = 0; index < changeCount; index += 1) {
        const remaining = boundaries.filter(
          (boundary) => boundary >= minimumBoundary,
        )
        if (!remaining.length) break
        const from =
          remaining[Math.floor(random() * Math.max(1, remaining.length - 1))]
        const validEnds = boundaries.filter((boundary) => boundary >= from)
        const to = validEnds[Math.floor(random() * validEnds.length)]
        const insert = Array.from(
          { length: Math.floor(random() * 4) },
          () => alphabet[Math.floor(random() * alphabet.length)],
        ).join('')
        changes.push({ from, insert, to })
        minimumBoundary = to
      }

      changes.sort(
        (left, right) => left.from - right.from || left.to - right.to,
      )
      const nonOverlapping = changes.filter(
        (change, index) => index === 0 || change.from >= changes[index - 1].to,
      )
      const applied = applyMarkdownEditorChanges(value, nonOverlapping)
      expect(applied, `iteration ${iteration}`).toBeDefined()
      const reverted = applyMarkdownEditorChanges(
        applied?.value ?? '',
        applied?.inverse ?? [],
      )
      expect(reverted?.value, `iteration ${iteration}`).toBe(value)
    }
  })

  it('rejects overlap, out-of-range, non-integer, and surrogate-split boundaries', () => {
    const value = 'A😀B'
    const invalid: readonly (readonly MarkdownEditorChange[])[] = [
      [
        { from: 0, insert: 'x', to: 2 },
        { from: 1, insert: 'y', to: 3 },
      ],
      [{ from: -1, insert: '', to: 0 }],
      [{ from: 0, insert: '', to: 99 }],
      [{ from: 1.5, insert: '', to: 2 }],
      [{ from: 2, insert: '', to: 3 }],
    ]

    for (const changes of invalid) {
      expect(validateMarkdownEditorChanges(value, changes)).toBe(false)
      expect(applyMarkdownEditorChanges(value, changes)).toBeUndefined()
    }
  })

  it('preserves backward direction while snapping combining and ZWJ selections to graphemes', () => {
    const value = `A${'e\u0301'}👩‍👩‍👧‍👦אב`
    const combining = normalizeMarkdownEditorSelection(
      value,
      selection(2, 2, 'backward'),
    )
    expect(combining).toEqual(selection(1, 1, 'backward'))

    const familyStart = `Ae\u0301`.length
    const insideFamily = normalizeMarkdownEditorSelection(
      value,
      selection(familyStart + 3, familyStart + 6, 'backward'),
    )
    expect(insideFamily).toEqual({
      direction: 'backward',
      start: familyStart,
      end: familyStart + '👩‍👩‍👧‍👦'.length,
    })
  })

  it('rejects stale revisions without changing the document or history', () => {
    const store = new MarkdownEditorTransactionStore('draft', selection(5))
    const accepted = store.dispatch(
      transaction([{ from: 5, insert: ' one', to: 5 }], selection(9)),
    )
    expect(accepted.accepted).toBe(true)

    const stale = store.dispatch(
      transaction([{ from: 9, insert: ' stale', to: 9 }], selection(15), {
        expectedRevision: 0,
      }),
    )
    expect(stale).toMatchObject({
      accepted: false,
      reason: 'stale-revision',
      revision: 1,
      value: 'draft one',
    })
    expect(stale.history.undoDepth).toBe(1)
  })

  it('merges only adjacent same-direction input inside 1000ms and respects explicit boundaries', () => {
    const store = new MarkdownEditorTransactionStore('', selection(0))
    const insertInput = (
      from: number,
      insert: string,
      now: number,
      direction: 'backward' | 'forward' = 'forward',
    ) =>
      store.dispatch(
        transaction(
          [{ from, insert, to: from }],
          selection(from + insert.length),
          { history: 'merge', origin: 'input' },
        ),
        { mergeDirection: direction, now },
      )

    insertInput(0, '你', 0)
    insertInput(1, '好', 999)
    expect(store.history.undoDepth).toBe(1)
    expect(store.undo().value).toBe('')
    expect(store.redo().value).toBe('你好')

    store.breakMergeGroup()
    insertInput(2, '!', 1000)
    expect(store.history.undoDepth).toBe(2)
    insertInput(3, '?', 2001)
    expect(store.history.undoDepth).toBe(3)
  })

  it('stores bounded change/inverse history and evicts oldest entries deterministically', () => {
    const store = new MarkdownEditorTransactionStore('', selection(0))
    for (let index = 0; index < 105; index += 1) {
      store.dispatch(
        transaction(
          [{ from: index, insert: 'x', to: index }],
          selection(index + 1),
        ),
      )
    }
    expect(store.history).toMatchObject({
      canUndo: true,
      redoDepth: 0,
      undoDepth: 100,
    })

    for (let index = 0; index < 100; index += 1) {
      expect(store.undo().accepted).toBe(true)
    }
    expect(store.value).toBe('xxxxx')
    expect(store.undo()).toMatchObject({
      accepted: false,
      reason: 'no-history',
    })

    const oversized = new MarkdownEditorTransactionStore('', selection(0))
    oversized.dispatch(
      transaction(
        [{ from: 0, insert: 'x'.repeat(1_000_001), to: 0 }],
        selection(1_000_001),
      ),
    )
    expect(oversized.history).toMatchObject({
      retainedUnits: 0,
      undoDepth: 0,
    })
  })

  it('clears redo and old undo entries on new mutations and external reset', () => {
    const store = new MarkdownEditorTransactionStore('A', selection(1))
    store.dispatch(transaction([{ from: 1, insert: 'B', to: 1 }], selection(2)))
    store.undo()
    expect(store.history.canRedo).toBe(true)

    store.dispatch(transaction([{ from: 1, insert: 'C', to: 1 }], selection(2)))
    expect(store.history.canRedo).toBe(false)

    const reset = store.dispatch(
      transaction([{ from: 0, insert: '外部', to: 2 }], selection(2), {
        history: 'skip',
        origin: 'external',
      }),
    )
    expect(reset).toMatchObject({ accepted: true, value: '外部' })
    expect(reset.history).toMatchObject({
      canRedo: false,
      canUndo: false,
      redoDepth: 0,
      undoDepth: 0,
    })
  })
})
