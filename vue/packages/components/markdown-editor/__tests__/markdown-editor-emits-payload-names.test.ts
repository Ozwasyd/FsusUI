import { describe, expect, expectTypeOf, it } from 'vitest'
import type { EmitFn } from 'vue'
import {
  markdownEditorEmits,
  type MarkdownEditorEmits,
  type MarkdownEditorSelectionEvent,
  type MarkdownEditorTransactionEvent,
} from '../src/markdown-editor'

const transactionEvent: MarkdownEditorTransactionEvent = {
  accepted: true,
  beforeRevision: 0,
  documentIdentity: { id: 'emits:文章', epoch: 7 },
  history: {
    canRedo: false,
    canUndo: false,
    redoDepth: 0,
    retainedUnits: 0,
    undoDepth: 0,
  },
  revision: 1,
  selection: { start: 0, end: 3, direction: 'backward' },
  transaction: { changes: [], history: 'skip', origin: 'command' },
  value: 'text',
}
const selectionEvent: MarkdownEditorSelectionEvent = {
  revision: 1,
  selection: { start: 0, end: 3, direction: 'backward' },
}

describe('MarkdownEditor emits payload names preserve the public contract', () => {
  it('retains the complete event inventory and payload arity', () => {
    expect(Object.keys(markdownEditorEmits)).toEqual([
      'update:modelValue',
      'change',
      'command',
      'mode-change',
      'save',
      'submit',
      'upload-image',
      'render-complete',
      'render-error',
      'features-activated',
      'embed-open-source',
      'embed-retry',
      'transaction',
      'selection-change',
      'history-change',
    ])
    expect(markdownEditorEmits.transaction.length).toBe(1)
    expect(markdownEditorEmits['selection-change'].length).toBe(1)
  })

  it('preserves ordinary typed emit payloads, order and rejection controls', () => {
    expectTypeOf(markdownEditorEmits.transaction).parameters.toEqualTypeOf<
      [MarkdownEditorTransactionEvent]
    >()
    expectTypeOf(
      markdownEditorEmits.transaction,
    ).returns.toEqualTypeOf<boolean>()
    expectTypeOf(
      markdownEditorEmits['selection-change'],
    ).parameters.toEqualTypeOf<[MarkdownEditorSelectionEvent]>()
    expectTypeOf(
      markdownEditorEmits['selection-change'],
    ).returns.toEqualTypeOf<boolean>()
    const emit: EmitFn<MarkdownEditorEmits> = () => {}
    emit('transaction', transactionEvent)
    emit('selection-change', selectionEvent)
    emit('transaction', { ...transactionEvent, accepted: false })
    // @ts-expect-error A selection observation is not a transaction result.
    emit('transaction', selectionEvent)
    // @ts-expect-error Revision retains its number type.
    emit('selection-change', { ...selectionEvent, revision: '1' })
    // @ts-expect-error Event name must precede its payload.
    emit(transactionEvent, 'transaction')
    // @ts-expect-error The existing event inventory is closed.
    emit('selection-changed', selectionEvent)
    // @ts-expect-error Transaction retains exactly one required payload.
    emit('transaction')
    // @ts-expect-error Selection retains exactly one required payload.
    emit('selection-change', selectionEvent, selectionEvent)
  })

  it.each([true, false])(
    'accepts an existing transaction payload with accepted=%s',
    (accepted) => {
      expect(
        markdownEditorEmits.transaction({ ...transactionEvent, accepted }),
      ).toBe(true)
    },
  )

  it.each([
    null,
    undefined,
    {},
    { ...transactionEvent, accepted: 'true' },
    { ...transactionEvent, revision: '1' },
    { ...transactionEvent, value: 1 },
  ])('rejects an invalid transaction payload %j', (payload) => {
    expect(
      Reflect.apply(markdownEditorEmits.transaction, undefined, [payload]),
    ).toBe(false)
  })

  it('accepts the existing zero caret and backward selection payloads', () => {
    expect(markdownEditorEmits['selection-change'](selectionEvent)).toBe(true)
    expect(
      markdownEditorEmits['selection-change']({
        revision: 0,
        selection: { start: 0, end: 0, direction: 'none' },
      }),
    ).toBe(true)
  })

  it.each([
    null,
    undefined,
    {},
    { ...selectionEvent, revision: '1' },
    { revision: 1, selection: null },
    { revision: 1, selection: { start: '0', end: 3 } },
    { revision: 1, selection: { start: 0, end: '3' } },
  ])('rejects an invalid selection payload %j', (payload) => {
    expect(
      Reflect.apply(markdownEditorEmits['selection-change'], undefined, [
        payload,
      ]),
    ).toBe(false)
  })

  it('retains validator property-access order and short-circuiting', () => {
    const accesses: string[] = []
    const payload = new Proxy(transactionEvent, {
      get(target, key, receiver) {
        accesses.push(String(key))
        return Reflect.get(target, key, receiver)
      },
    })
    expect(markdownEditorEmits.transaction(payload)).toBe(true)
    expect(accesses).toEqual(['accepted', 'revision', 'value'])
    accesses.length = 0
    const rejected = new Proxy(
      { ...transactionEvent, accepted: 'invalid' },
      {
        get(target, key, receiver) {
          accesses.push(String(key))
          return Reflect.get(target, key, receiver)
        },
      },
    )
    expect(
      Reflect.apply(markdownEditorEmits.transaction, undefined, [rejected]),
    ).toBe(false)
    expect(accesses).toEqual(['accepted'])
  })

  it('retains selection validator property-access order', () => {
    const accesses: string[] = []
    const selection = new Proxy(selectionEvent.selection, {
      get(target, key, receiver) {
        accesses.push(`selection.${String(key)}`)
        return Reflect.get(target, key, receiver)
      },
    })
    const payload = new Proxy(
      { ...selectionEvent, selection },
      {
        get(target, key, receiver) {
          accesses.push(String(key))
          return Reflect.get(target, key, receiver)
        },
      },
    )
    expect(markdownEditorEmits['selection-change'](payload)).toBe(true)
    expect(accesses).toEqual([
      'revision',
      'selection',
      'selection.start',
      'selection',
      'selection.end',
    ])
  })
})
