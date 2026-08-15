import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_NATIVE_SYNTHETIC_BROWSERS,
  createMarkdownEditorNativeEventMachine,
  driveMarkdownNativeHarnessTrace,
  evaluateMarkdownNativeEventMutations,
  markdownNativeSyntheticCompositionScript,
} from '../src/markdown-editor-native-event'
import {
  deriveMarkdownEditorChange,
  MarkdownEditorTransactionStore,
} from '../src/markdown-editor-transaction'

const commitThroughStore = (
  events: readonly Parameters<
    ReturnType<typeof createMarkdownEditorNativeEventMachine>['apply']
  >[0][],
  initial = '',
) => {
  const store = new MarkdownEditorTransactionStore(initial, {
    start: initial.length,
    end: initial.length,
  })
  const machine = createMarkdownEditorNativeEventMachine({
    documentIdentity: { epoch: 0, id: 'doc' },
  })
  let commits = 0
  for (const event of events) {
    const plan = machine.apply({
      documentIdentity: { epoch: 0, id: 'doc' },
      previousValue: store.value,
      revision: store.revision,
      ...event,
    })
    if (plan.action !== 'commit' && plan.action !== 'dispatch') continue
    const next = event.value ?? store.value
    const change = deriveMarkdownEditorChange(store.value, next)
    store.dispatch({
      changes: change ? [change] : [],
      history: plan.history,
      metadata: Object.freeze({
        composition: plan.composition,
        identity: plan.identity,
      }),
      origin: plan.origin,
      selection: {
        start: next.length,
        end: next.length,
      },
    })
    commits += 1
  }
  return { commits, machine, store }
}

describe('markdown native event machine', () => {
  it('commits one history step for Chromium, Firefox, and WebKit scripts', () => {
    for (const browser of MARKDOWN_NATIVE_SYNTHETIC_BROWSERS) {
      const script = markdownNativeSyntheticCompositionScript('你好', browser)
      const driven = driveMarkdownNativeHarnessTrace(script, {
        documentIdentity: { epoch: 0, id: 'doc' },
      })
      expect(driven.commits).toBe(1)
      expect(driven.trace.some((entry) => entry.kind === 'compositionstart')).toBe(
        true,
      )
      const applied = commitThroughStore([...script])
      expect(applied.commits).toBe(1)
      expect(applied.store.value).toBe('你好')
      expect(applied.store.history.undoDepth).toBe(1)
      applied.store.undo()
      expect(applied.store.value).toBe('')
    }
  })

  it('treats empty compositionend plus insertText as a single Korean-style commit', () => {
    const applied = commitThroughStore([
      { kind: 'compositionstart' },
      { data: '', kind: 'compositionend', value: '' },
      {
        data: '한',
        inputType: 'insertText',
        kind: 'beforeinput',
      },
      {
        data: '한',
        inputType: 'insertText',
        kind: 'input',
        value: '한',
      },
    ])
    expect(applied.commits).toBe(1)
    expect(applied.store.value).toBe('한')
    expect(applied.machine.phase).toBe('idle')
  })

  it('does not dispatch pair or list transforms while composing', () => {
    const machine = createMarkdownEditorNativeEventMachine()
    machine.apply({ kind: 'compositionstart' })
    expect(machine.composing).toBe(true)
    expect(machine.freezeSmartInput).toBe(true)
    const mid = machine.apply({
      data: '(',
      inputType: 'insertCompositionText',
      isComposing: true,
      kind: 'input',
      value: '(',
    })
    expect(mid.action).toBe('ignore')
    expect(mid.freezeSmartInput).toBe(true)
  })

  it('aborts composition on document switch and rejects the stale commit', () => {
    const machine = createMarkdownEditorNativeEventMachine({
      documentIdentity: { epoch: 0, id: 'doc' },
    })
    machine.apply({
      documentIdentity: { epoch: 0, id: 'doc' },
      kind: 'compositionstart',
    })
    const abort = machine.apply({
      documentIdentity: { epoch: 1, id: 'doc' },
      kind: 'document-switch',
      revision: 4,
    })
    expect(abort.action).toBe('abort')
    const stale = machine.apply({
      data: '幽灵',
      documentIdentity: { epoch: 0, id: 'doc' },
      kind: 'compositionend',
      previousValue: '',
      value: '幽灵',
    })
    expect(stale.action).not.toBe('commit')
    expect(stale.rejected).toBe('stale-document')
  })

  it('owns paste/drop so the follow-up beforeinput/input is a no-op', () => {
    const machine = createMarkdownEditorNativeEventMachine()
    const paste = machine.apply({
      clipboardIdentity: 'clip:1',
      kind: 'paste',
      origin: 'paste',
    })
    expect(paste.action).toBe('ignore')
    expect(
      machine.apply({
        clipboardIdentity: 'clip:1',
        inputType: 'insertFromPaste',
        kind: 'beforeinput',
      }).action,
    ).toBe('dedup')
    expect(
      machine.apply({
        inputType: 'insertFromPaste',
        kind: 'input',
        origin: 'paste',
        value: 'plain',
      }).action,
    ).toBe('dedup')

    machine.apply({ clipboardIdentity: 'clip:drop', kind: 'drop', origin: 'drop' })
    expect(
      machine.apply({
        inputType: 'insertFromDrop',
        kind: 'input',
        value: 'file',
      }).action,
    ).toBe('dedup')
  })

  it('routes historyUndo to the store and never as a native value dispatch', () => {
    const store = new MarkdownEditorTransactionStore('ab', { start: 2, end: 2 })
    store.dispatch({
      changes: [{ from: 2, insert: 'c', to: 2 }],
      history: 'separate',
      origin: 'input',
      selection: { start: 3, end: 3 },
    })
    const machine = createMarkdownEditorNativeEventMachine()
    const plan = machine.apply({ inputType: 'historyUndo', kind: 'beforeinput' })
    expect(plan.action).toBe('undo')
    expect(plan.preventDefault).toBe(true)
    store.undo()
    expect(store.value).toBe('ab')
  })

  it('drains cancelled composition and then accepts ordinary insertText', () => {
    const machine = createMarkdownEditorNativeEventMachine()
    machine.apply({ kind: 'compositionstart' })
    machine.apply({ kind: 'external-reset', value: 'server-after' })
    expect(machine.phase).toBe('aborted')
    expect(
      machine.apply({
        inputType: 'insertCompositionText',
        isComposing: true,
        kind: 'input',
        value: '未確定',
      }).action,
    ).toBe('prevent')
    const ordinary = machine.apply({
      data: '!',
      inputType: 'insertText',
      kind: 'input',
      previousValue: 'server-after',
      value: 'server-after!',
    })
    expect(ordinary.action).toBe('dispatch')
    expect(machine.phase).toBe('idle')
  })

  it('kills timeout dedup, composition transform, native undo, and stale commit', () => {
    const report = evaluateMarkdownNativeEventMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(byKind['timeout-dedup']?.accepted).toBe(false)
    expect(byKind['composition-transform']?.accepted).toBe(false)
    expect(byKind['native-undo']?.accepted).toBe(false)
    expect(byKind['stale-commit']?.accepted).toBe(false)
  })
})
