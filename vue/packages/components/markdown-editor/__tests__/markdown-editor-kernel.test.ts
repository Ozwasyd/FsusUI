import { describe, expect, it, vi } from 'vitest'
import {
  MarkdownEditorKernel,
  rebaseMarkdownEditorCommandTransaction,
} from '../src/kernel/editor-kernel'

describe('MarkdownEditorKernel (headless)', () => {
  it('dispatches transactions, tracks position maps, and supports undo/redo without Vue or DOM', () => {
    const identity = { epoch: 0, id: 'doc-headless' }
    const kernel = new MarkdownEditorKernel({
      documentIdentity: identity,
      initialValue: 'hello world',
    })
    const events: string[] = []
    kernel.onTransaction((outcome) => {
      events.push(
        `${outcome.result.accepted}:${outcome.result.revision}:${outcome.result.value}`,
      )
    })

    const insertTx = kernel.createInsertTransaction('!', {
      direction: 'none',
      end: 11,
      start: 11,
    })
    const inserted = kernel.dispatchOperation(
      { kind: 'transaction', transaction: insertTx },
      { blocked: false, composing: false },
    )
    expect(inserted.result.accepted).toBe(true)
    expect(kernel.value).toBe('hello world!')
    expect(inserted.valueChanged).toBe(true)
    expect(inserted.historyChanged).toBe(true)

    const map = kernel.positionMapFromRevision(0, kernel.revision)
    expect(map).toBeDefined()
    const rebased = rebaseMarkdownEditorCommandTransaction(
      {
        changes: [{ from: 0, insert: 'Hi', to: 5 }],
        history: 'separate',
        origin: 'command',
      },
      map,
    )
    expect(rebased?.changes[0]).toEqual({ from: 0, insert: 'Hi', to: 5 })

    const undone = kernel.dispatchOperation(
      { kind: 'undo' },
      { blocked: false, composing: false },
    )
    expect(undone.result.accepted).toBe(true)
    expect(kernel.value).toBe('hello world')

    const redone = kernel.dispatchOperation(
      { kind: 'redo' },
      { blocked: false, composing: false },
    )
    expect(redone.result.accepted).toBe(true)
    expect(kernel.value).toBe('hello world!')
    expect(events.length).toBe(3)
  })

  it('rejects edits when blocked or composing unless internalPropReset is set', () => {
    const identity = { epoch: 0, id: 'doc-guards' }
    const kernel = new MarkdownEditorKernel({
      documentIdentity: identity,
      initialValue: 'abc',
    })

    const blocked = kernel.dispatchOperation(
      {
        kind: 'transaction',
        transaction: {
          changes: [{ from: 3, insert: 'd', to: 3 }],
          history: 'separate',
          origin: 'input',
        },
      },
      { blocked: true, composing: false },
    )
    expect(blocked.result.accepted).toBe(false)
    expect(blocked.result.reason).toBe('disabled')

    const composing = kernel.dispatchOperation(
      {
        kind: 'transaction',
        transaction: {
          changes: [{ from: 3, insert: 'd', to: 3 }],
          history: 'separate',
          origin: 'input',
        },
      },
      { blocked: false, composing: true },
    )
    expect(composing.result.accepted).toBe(false)
    expect(composing.result.reason).toBe('composition-active')

    const propReset = kernel.dispatchOperation(
      {
        allowBlocked: true,
        emitValue: false,
        internalPropReset: true,
        kind: 'transaction',
        transaction: {
          changes: [{ from: 0, insert: 'reset', to: 3 }],
          externalUpdate: 'reset',
          history: 'skip',
          origin: 'external',
        },
      },
      { blocked: true, composing: true },
    )
    expect(propReset.result.accepted).toBe(true)
    expect(propReset.emitValue).toBe(false)
    expect(kernel.value).toBe('reset')
  })

  it('aborts active command sessions and resets position maps on switchDocument', () => {
    const identity = { epoch: 0, id: 'doc-1' }
    const kernel = new MarkdownEditorKernel({
      documentIdentity: identity,
      initialValue: 'first',
    })
    const stateSpy = vi.fn()
    kernel.onCommandStateChange(stateSpy)

    const session = kernel.beginCommandSession(
      { group: 'inline', key: 'bold', label: 'Bold', run: () => undefined },
      {
        dispatch: {
          dispatch: (tx) =>
            kernel.dispatchOperation(
              { kind: 'transaction', transaction: tx },
              { blocked: false, composing: false },
            ).result,
        },
        documentIdentity: identity,
        mode: 'source',
        readonly: false,
        revision: kernel.revision,
        selection: kernel.selection,
        signal: kernel.commandContextSignal,
        value: kernel.value,
      },
      { end: 5, start: 0 },
    )
    expect(session).not.toBeNull()
    expect(kernel.commandRuntimeStates.get('bold')?.state).toBe('pending')

    const switched = kernel.switchDocument({ epoch: 1, id: 'doc-2' }, 'second')
    expect(session?.abort.signal.aborted).toBe(true)
    expect(kernel.commandSessions.size).toBe(0)
    expect(kernel.commandRuntimeStates.get('bold')?.state).toBe('aborted')
    expect(switched.value).toBe('second')
    expect(stateSpy).toHaveBeenCalled()
  })
})
