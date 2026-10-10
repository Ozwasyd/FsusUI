import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import MarkdownEditor from '../src/markdown-editor.vue'
import type {
  MarkdownAttachmentBatchIntent,
  MarkdownAttachmentCaptureObservation,
  MarkdownAttachmentFileConsumer,
  MarkdownAttachmentSourceKind,
  MarkdownEditorInstance,
  MarkdownEditorMode,
  MarkdownEditorTransactionEvent,
} from '../src/markdown-editor'
import { captureMarkdownAttachmentInput } from '../src/markdown-editor'

type Editor = ReturnType<typeof mount<typeof MarkdownEditor>>
const file = (name = 'same.png') =>
  new File(['same'], name, { type: 'image/png', lastModified: 1 })
const mountEditor = (mode: MarkdownEditorMode = 'source') =>
  mount(MarkdownEditor, {
    props: {
      modelValue: 'ab',
      defaultMode: mode,
      documentIdentity: { id: 'doc', epoch: 2 },
    },
  })
const capture = async (
  editor: Editor,
  files: File[],
  source: MarkdownAttachmentSourceKind = 'pick',
) => {
  const textarea = editor.get<HTMLTextAreaElement>('textarea').element
  textarea.setSelectionRange(1, 1)
  if (source === 'pick') {
    const picker = editor.get<HTMLInputElement>('input[type="file"]')
    Object.defineProperty(picker.element, 'files', {
      configurable: true,
      value: files,
    })
    await picker.trigger('change')
  } else {
    const event = new Event(source, { bubbles: true, cancelable: true })
    const data = { files, types: ['Files'], getData: () => '' }
    Object.defineProperty(
      event,
      source === 'paste' ? 'clipboardData' : 'dataTransfer',
      { value: data },
    )
    if (source === 'drop') {
      Object.defineProperty(document, 'caretPositionFromPoint', {
        configurable: true,
        value: () => ({ offset: 1, offsetNode: textarea }),
      })
      Object.defineProperties(event, {
        clientX: { value: 10 },
        clientY: { value: 10 },
      })
    }
    textarea.dispatchEvent(event)
    await nextTick()
  }
  const emission = editor.emitted('upload-image')?.at(-1)
  return {
    batch: emission?.[0] as MarkdownAttachmentBatchIntent,
    observation: emission?.[1] as MarkdownAttachmentCaptureObservation,
  }
}
const action = async (editor: Editor, index: number, label: string) => {
  const button = editor
    .findAll('.el-markdown-editor__attachment')
    [index]!.findAll('button')
    .find((entry) => entry.text() === label)
  expect(button, label).toBeDefined()
  await button!.trigger('click')
}
const lend = (
  editor: Editor,
  batch: MarkdownAttachmentBatchIntent,
  index = 0,
) => {
  const consumer = vi.fn<MarkdownAttachmentFileConsumer>()
  const accepted = editor.vm.withAttachmentFile(
    batch,
    batch.items[index]!,
    consumer,
  )
  return { accepted, consumer }
}
const resolved = (batch: MarkdownAttachmentBatchIntent, index = 0) => ({
  status: 'resolved' as const,
  batchId: batch.batchId,
  itemId: batch.items[index]!.itemId,
  documentIdentity: batch.documentIdentity,
  revision: batch.revision,
  payload: {
    markdownKind: 'image' as const,
    href: 'https://cdn.example/ok.png',
    mimeType: 'image/png',
    alt: 'ok',
  },
})

afterEach(() => {
  Reflect.deleteProperty(document, 'caretPositionFromPoint')
})

describe('MarkdownEditor native File bridge', () => {
  it('exports the File loan and transaction observation through the public editor boundary', () => {
    expectTypeOf<
      MarkdownEditorInstance['withAttachmentFile']
    >().parameters.toEqualTypeOf<
      [
        MarkdownAttachmentBatchIntent,
        MarkdownAttachmentBatchIntent['items'][number],
        MarkdownAttachmentFileConsumer,
      ]
    >()
    expectTypeOf<
      MarkdownAttachmentCaptureObservation['transaction']
    >().toEqualTypeOf<MarkdownEditorTransactionEvent>()
    expectTypeOf<
      MarkdownEditorInstance['dispatchTransaction']
    >().parameters.toEqualTypeOf<
      [Parameters<MarkdownEditorInstance['dispatchTransaction']>[0]]
    >()
  })

  it.each(['source', 'live', 'split'] as const)(
    'binds %s ordered pick/paste/drop Files to one accepted placeholder transaction',
    async (mode) => {
      for (const source of ['pick', 'paste', 'drop'] as const) {
        const editor = mountEditor(mode)
        const files = [file(), file(), file('third.png')]
        expect(files[0]).not.toBe(files[1])
        const { batch, observation } = await capture(editor, files, source)
        expect(batch.sourceKind).toBe(source)
        expect('files' in batch).toBe(false)
        expect(observation.batch).toBe(batch)
        const transactions = editor.emitted('transaction')!
        expect(transactions).toHaveLength(1)
        expect(observation.transaction).toBe(transactions[0]![0])
        expect(observation.transaction).toMatchObject({
          accepted: true,
          beforeRevision: batch.revision,
          revision: batch.revision + 1,
          documentIdentity: batch.documentIdentity,
        })
        expect(observation.transaction.transaction.expectedRevision).toBe(
          batch.revision,
        )
        expect(observation.transaction.transaction.changes).toHaveLength(1)
        expect(observation.plan.transaction.changes).toEqual(
          observation.transaction.transaction.changes,
        )
        expect(observation.transaction.positionMap).toBeDefined()
        expect(observation.transaction.transaction.changes[0]).toMatchObject({
          from: 1,
          to: 1,
        })
        for (const [index, original] of files.entries()) {
          const loan = lend(editor, batch, index)
          expect(loan.accepted).toBe(true)
          expect(loan.consumer).toHaveBeenCalledExactlyOnceWith(
            original,
            observation,
          )
          expect(batch.items[index]!.order).toBe(index)
          expect(observation.placements[index]!.item).toBe(batch.items[index])
          expect(observation.placements[index]!.range).toBe(
            observation.plan.jobs[index]!.range,
          )
          expect(observation.plan.jobs[index]).toMatchObject({
            batchId: batch.batchId,
            itemId: batch.items[index]!.itemId,
            revision: batch.revision,
            documentIdentity: batch.documentIdentity,
          })
          const range = observation.placements[index]!.range
          expect(
            observation.transaction.value.slice(range.start, range.end),
          ).toBe(`![正在上传 ${original.name}…]()`)
          expect(Object.isFrozen(range)).toBe(true)
          expect(batch.items[index]!.signal.aborted).toBe(false)
        }
        expect(new Set(batch.items.map((item) => item.signal)).size).toBe(3)
        expect(editor.emitted('transaction')).toHaveLength(1)
        editor.unmount()
        expect(batch.signal.aborted).toBe(true)
        expect(batch.items.every((item) => item.signal.aborted)).toBe(true)
        expect(lend(editor, batch).accepted).toBe(false)
      }
    },
  )

  it('rejects copies, reconstructed IDs, metadata-only captures and foreign editor batches', async () => {
    const editor = mountEditor()
    const { batch } = await capture(editor, [file()])
    const consumer = vi.fn<MarkdownAttachmentFileConsumer>()
    expect(
      editor.vm.withAttachmentFile({ ...batch }, batch.items[0]!, consumer),
    ).toBe(false)
    expect(
      editor.vm.withAttachmentFile(batch, { ...batch.items[0]! }, consumer),
    ).toBe(false)
    expect(
      editor.vm.withAttachmentFile(
        { ...batch, items: batch.items.map((item) => ({ ...item })) },
        batch.items[0]!,
        consumer,
      ),
    ).toBe(false)
    const metadata = captureMarkdownAttachmentInput({
      sourceKind: batch.sourceKind,
      documentIdentity: batch.documentIdentity,
      revision: batch.revision,
      anchor: batch.anchor,
      files: [file()],
    })
    if (!metadata.ok) throw new Error('metadata capture rejected')
    expect(
      editor.vm.withAttachmentFile(
        metadata.batch,
        metadata.batch.items[0]!,
        consumer,
      ),
    ).toBe(false)
    const other = mountEditor()
    const foreign = await capture(other, [file()])
    expect(
      editor.vm.withAttachmentFile(
        foreign.batch,
        foreign.batch.items[0]!,
        consumer,
      ),
    ).toBe(false)
    expect(consumer).not.toHaveBeenCalled()
  })

  it.each([
    'readonly',
    'disabled',
    'loading',
    'preview',
    'composition',
    'empty',
  ] as const)(
    'rejects %s native capture without a grant or placeholder dispatch',
    async (blocked) => {
      const editor = mountEditor()
      if (blocked === 'preview') await editor.setProps({ mode: 'preview' })
      else if (blocked === 'composition')
        await editor.get('textarea').trigger('compositionstart')
      else if (blocked !== 'empty') await editor.setProps({ [blocked]: true })
      await capture(editor, blocked === 'empty' ? [] : [file()])
      expect(editor.emitted('upload-image')).toBeUndefined()
      expect(editor.emitted('transaction')).toBeUndefined()
    },
  )

  it('releases a cancelled File independently and never remints it on retry', async () => {
    const editor = mountEditor()
    const { batch } = await capture(editor, [file('a.png'), file('b.png')])
    await action(editor, 0, '取消')
    expect(batch.items[0]!.signal.aborted).toBe(true)
    expect(batch.items[1]!.signal.aborted).toBe(false)
    expect(batch.signal.aborted).toBe(false)
    expect(lend(editor, batch).accepted).toBe(false)
    expect(lend(editor, batch, 1).accepted).toBe(true)
    await action(editor, 0, '重试')
    const retry = editor.emitted('upload-image')!.at(-1)!
    expect(retry[0]).not.toBe(batch)
    expect(retry[1]).toBeUndefined()
    expect(lend(editor, batch).accepted).toBe(false)
    expect(
      lend(editor, retry[0] as MarkdownAttachmentBatchIntent).accepted,
    ).toBe(false)
    expect(editor.emitted('transaction')).toHaveLength(1)
    await action(editor, 0, '取消')
    await action(editor, 0, '移除')
    expect(lend(editor, batch).accepted).toBe(false)
    expect(lend(editor, batch, 1).accepted).toBe(true)
  })

  it.each(['rejected', 'cancelled', 'stale', 'document-abort'] as const)(
    'revokes a %s provider item and rejects its stale grant',
    async (status) => {
      const editor = mountEditor()
      const { batch } = await capture(editor, [file(), file('other.png')])
      editor.vm.applyAttachmentResult({
        status,
        batchId: batch.batchId,
        itemId: batch.items[0]!.itemId,
      })
      expect(batch.items[0]!.signal.aborted).toBe(true)
      expect(lend(editor, batch).accepted).toBe(false)
      expect(lend(editor, batch, 1).accepted).toBe(true)
    },
  )

  it('keeps rebased pending loans current and completes using the existing result command', async () => {
    const editor = mountEditor()
    const { batch } = await capture(editor, [file()])
    expect(
      editor.vm.dispatchTransaction({
        changes: [{ from: 0, to: 0, insert: 'prefix' }],
        history: 'separate',
        origin: 'programmatic',
      }).accepted,
    ).toBe(true)
    expect(lend(editor, batch).accepted).toBe(true)
    const originalRange = editor.emitted(
      'upload-image',
    )![0]![1] as MarkdownAttachmentCaptureObservation
    expect(originalRange.placements[0]!.range.start).toBe(1)
    expect(originalRange.plan.jobs[0]!.range!.start).toBe(7)
    expect(
      editor.vm.applyAttachmentResult({
        status: 'progress',
        batchId: batch.batchId,
        itemId: batch.items[0]!.itemId,
        ratio: 0.5,
      }),
    ).toBe(true)
    expect(lend(editor, batch).accepted).toBe(true)
    expect(editor.vm.applyAttachmentResult(resolved(batch))).toBe(true)
    expect(editor.emitted('update:modelValue')!.at(-1)![0]).toBe(
      'prefixa![ok](https://cdn.example/ok.png)b',
    )
    expect(editor.emitted('transaction')).toHaveLength(3)
    expect(batch.items[0]!.signal.aborted).toBe(true)
    expect(batch.signal.aborted).toBe(true)
    expect(lend(editor, batch).accepted).toBe(false)
  })

  it('revokes removed placeholders before transaction observers and does not resurrect Files on undo', async () => {
    const editor = mountEditor()
    const { batch } = await capture(editor, [file()])
    const consumer = vi.fn<MarkdownAttachmentFileConsumer>()
    await editor.setProps({
      onTransaction: () => {
        expect(
          editor.vm.withAttachmentFile(batch, batch.items[0]!, consumer),
        ).toBe(false)
      },
    })
    editor.vm.undo()
    expect(batch.signal.aborted).toBe(true)
    expect(consumer).not.toHaveBeenCalled()
    editor.vm.redo()
    expect(lend(editor, batch).accepted).toBe(false)
  })

  it.each([
    { id: 'other', epoch: 2 },
    { id: 'doc', epoch: 3 },
  ])(
    'revokes the old capture on document switch to $id/$epoch with identical bytes',
    async (documentIdentity) => {
      const editor = mountEditor()
      const { batch } = await capture(editor, [file()])
      const content = editor.emitted('update:modelValue')!.at(-1)![0] as string
      await editor.setProps({ documentIdentity, modelValue: content })
      expect(batch.documentIdentity).toEqual({ id: 'doc', epoch: 2 })
      expect(batch.signal.aborted).toBe(true)
      expect(lend(editor, batch).accepted).toBe(false)
      expect(editor.vm.applyAttachmentResult(resolved(batch))).toBe(false)
    },
  )

  it('rejects the File grant when a transaction observer changes the captured revision', async () => {
    const editor = mountEditor()
    let changed = false
    await editor.setProps({
      onTransaction: () => {
        if (changed) return
        changed = true
        editor.vm.dispatchTransaction({
          changes: [{ from: 0, to: 0, insert: 'new' }],
          history: 'separate',
          origin: 'programmatic',
        })
      },
    })
    await capture(editor, [file()])
    expect(editor.emitted('upload-image')).toBeUndefined()
    expect(editor.emitted('transaction')).toHaveLength(2)
  })
  it.each(['old.png', 'new.png'])(
    'replaces an original pending image with %s through the native picker and revokes its File',
    async (name) => {
      const editor = mountEditor()
      const original = await capture(editor, [file('old.png')])
      editor.vm.dispatchTransaction({
        changes: [],
        selection: { start: 2, end: 2 },
        history: 'skip',
        origin: 'programmatic',
      })
      await nextTick()
      const replace = editor
        .findAll('button')
        .find((button) => button.text() === '替换')
      expect(replace).toBeDefined()
      await replace!.trigger('click')
      const replacement = file(name)
      const current = await capture(editor, [replacement])
      expect(original.batch.items[0]!.signal.aborted).toBe(true)
      expect(lend(editor, original.batch).accepted).toBe(false)
      expect(
        lend(editor, current.batch).consumer,
      ).toHaveBeenCalledExactlyOnceWith(replacement, current.observation)
      expect(
        current.observation.transaction.transaction.changes[0],
      ).toMatchObject({
        from: 1,
        to: original.observation.transaction.value.length - 1,
      })
      expect(current.observation.transaction.beforeRevision).toBe(
        original.observation.transaction.revision,
      )
      expect(current.observation.transaction.revision).toBe(
        original.observation.transaction.revision + Number(name !== 'old.png'),
      )
    },
  )

  it('revokes every unmounted grant before invoking abort listeners', async () => {
    const editor = mountEditor()
    const { batch } = await capture(editor, [file(), file('other.png')])
    const consumer = vi.fn<MarkdownAttachmentFileConsumer>()
    batch.items[0]!.signal.addEventListener('abort', () => {
      expect(
        editor.vm.withAttachmentFile(batch, batch.items[1]!, consumer),
      ).toBe(false)
    })
    editor.unmount()
    expect(consumer).not.toHaveBeenCalled()
  })
  it('keeps successive equal-metadata native replacements distinct and completes only the current File', async () => {
    const editor = mountEditor()
    let current = await capture(editor, [file()])
    for (let index = 0; index < 3; index += 1) {
      const previous = current
      editor.vm.dispatchTransaction({
        changes: [],
        selection: { start: 2, end: 2 },
        history: 'skip',
        origin: 'programmatic',
      })
      await nextTick()
      await editor
        .findAll('button')
        .find((button) => button.text() === '替换')!
        .trigger('click')
      const original = file()
      current = await capture(editor, [original])
      expect(current.batch.batchId).not.toBe(previous.batch.batchId)
      expect(current.batch.items[0]!.itemId).not.toBe(
        previous.batch.items[0]!.itemId,
      )
      expect(lend(editor, previous.batch).accepted).toBe(false)
      expect(
        lend(editor, current.batch).consumer,
      ).toHaveBeenCalledExactlyOnceWith(original, current.observation)
      expect(current.observation.transaction.beforeRevision).toBe(1)
      expect(current.observation.transaction.revision).toBe(1)
    }
    expect(editor.vm.applyAttachmentResult(resolved(current.batch))).toBe(true)
    expect(editor.emitted('update:modelValue')!.at(-1)![0]).toBe(
      'a![ok](https://cdn.example/ok.png)b',
    )
  })
})
