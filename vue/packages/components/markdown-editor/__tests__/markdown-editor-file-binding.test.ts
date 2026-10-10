import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
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

describe('MarkdownEditor attachment completion reentry', () => {
  it.each(['reentry-long-native-file-name.png', 'same.png'])(
    'refuses a saved completion range after its item abort listener inserts text for %s',
    async (name) => {
      const editor = mountEditor()
      const { batch, observation } = await capture(editor, [file(name)])
      const before = observation.transaction.value
      let afterAbort = ''
      batch.items[0]!.signal.addEventListener('abort', () => {
        expect(lend(editor, batch).accepted).toBe(false)
        expect(observation.plan.jobs[0]!.range).toBe(
          observation.placements[0]!.range,
        )
        expect(
          editor.vm.dispatchTransaction({
            changes: [{ from: 0, to: 0, insert: 'PREFIX ' }],
            history: 'separate',
            origin: 'programmatic',
          }).accepted,
        ).toBe(true)
        afterAbort = editor.emitted('update:modelValue')!.at(-1)![0] as string
      })
      const accepted = editor.vm.applyAttachmentResult(resolved(batch))
      const after = editor.emitted('update:modelValue')!.at(-1)![0] as string
      expect({ before, afterAbort, accepted, after }).toEqual({
        before: `a![正在上传 ${name}…]()b`,
        afterAbort: `PREFIX ${before}`,
        accepted: false,
        after: `PREFIX ${before}`,
      })
      expect(editor.emitted('transaction')).toHaveLength(2)
      expect(observation.plan.jobs[0]!.phase).toBe('stale')
      expect(batch.items[0]!.signal.aborted).toBe(true)
      expect(lend(editor, batch).accepted).toBe(false)
      expect(editor.vm.applyAttachmentResult(resolved(batch))).toBe(false)
      expect(
        editor.vm.applyAttachmentResult({
          status: 'progress',
          batchId: batch.batchId,
          itemId: batch.items[0]!.itemId,
          ratio: 0.5,
        }),
      ).toBe(false)
    },
  )

  it('revokes both deleted native Files before the first item abort listener can borrow its sibling', async () => {
    const editor = mountEditor()
    const { batch, observation } = await capture(editor, [
      file('a.png'),
      file('b.png'),
    ])
    const consumer = vi.fn<MarkdownAttachmentFileConsumer>()
    let siblingLoan: boolean | undefined
    let phases: string[] = []
    batch.items[0]!.signal.addEventListener('abort', () => {
      phases = observation.plan.jobs.map((job) => job.phase)
      siblingLoan = editor.vm.withAttachmentFile(
        batch,
        batch.items[1]!,
        consumer,
      )
    })
    const removed = editor.vm.dispatchTransaction({
      changes: [
        { from: 1, to: observation.transaction.value.length - 1, insert: '' },
      ],
      history: 'separate',
      origin: 'programmatic',
    })
    expect(removed.accepted).toBe(true)
    expect(removed.value).toBe('ab')
    expect({ siblingLoan, phases }).toEqual({
      siblingLoan: false,
      phases: ['deleted', 'deleted'],
    })
    expect(consumer).not.toHaveBeenCalled()
    expect(batch.items.every((item) => item.signal.aborted)).toBe(true)
    expect(batch.signal.aborted).toBe(true)
  })

  it('keeps a surviving rebased sibling File usable during the deleted item abort listener', async () => {
    const editor = mountEditor()
    const files = [file('a.png'), file('b.png')]
    const { batch, observation } = await capture(editor, files)
    const consumer = vi.fn<MarkdownAttachmentFileConsumer>()
    let siblingLoan: boolean | undefined
    batch.items[0]!.signal.addEventListener('abort', () => {
      expect(observation.plan.jobs.map((job) => job.phase)).toEqual([
        'deleted',
        'pending',
      ])
      siblingLoan = editor.vm.withAttachmentFile(
        batch,
        batch.items[1]!,
        consumer,
      )
    })
    const range = observation.placements[0]!.range
    const removed = editor.vm.dispatchTransaction({
      changes: [{ from: range.start, to: range.end, insert: '' }],
      history: 'separate',
      origin: 'programmatic',
    })
    expect(removed.accepted).toBe(true)
    expect(siblingLoan).toBe(true)
    expect(consumer).toHaveBeenCalledExactlyOnceWith(files[1], observation)
    expect(batch.items[0]!.signal.aborted).toBe(true)
    expect(batch.items[1]!.signal.aborted).toBe(false)
    expect(batch.signal.aborted).toBe(false)
    expect(editor.vm.applyAttachmentResult(resolved(batch, 1))).toBe(true)
    expect(batch.items[1]!.signal.aborted).toBe(true)
    expect(batch.signal.aborted).toBe(true)
  })

  it('commits a current positive completion with its actual result/map after a selection-only abort callback', async () => {
    const editor = mountEditor()
    const { batch, observation } = await capture(editor, [file()])
    const placeholderRange = observation.placements[0]!.range
    let listenerRevision: number | undefined
    batch.items[0]!.signal.addEventListener('abort', () => {
      expect(lend(editor, batch).accepted).toBe(false)
      expect(observation.plan.jobs[0]!.range).toBe(placeholderRange)
      const selected = editor.vm.dispatchTransaction({
        changes: [],
        selection: { start: 0, end: 0 },
        history: 'skip',
        origin: 'programmatic',
      })
      expect(selected.accepted).toBe(true)
      listenerRevision = selected.revision
    })
    expect(editor.vm.applyAttachmentResult(resolved(batch))).toBe(true)
    const completion = editor
      .emitted('transaction')!
      .at(-1)![0] as MarkdownEditorTransactionEvent
    expect(completion).toMatchObject({
      accepted: true,
      documentIdentity: batch.documentIdentity,
      beforeRevision: listenerRevision,
      revision: listenerRevision! + 1,
      value: 'a![ok](https://cdn.example/ok.png)b',
    })
    expect(completion.transaction.expectedRevision).toBe(listenerRevision)
    expect(completion.transaction.documentIdentity).toEqual(
      batch.documentIdentity,
    )
    expect(completion.transaction.changes[0]).toMatchObject({
      from: placeholderRange.start,
      to: placeholderRange.end,
    })
    expect(completion.positionMap).toBeDefined()
    expect(observation.plan.jobs[0]!.range!.end).toBe(
      1 + '![ok](https://cdn.example/ok.png)'.length,
    )
    expect(observation.placements[0]!.range).toBe(placeholderRange)
    expect(lend(editor, batch).accepted).toBe(false)
    expect(editor.vm.applyAttachmentResult(resolved(batch))).toBe(false)
  })

  it('refuses an equal-byte replacement map even when before and post revisions match', async () => {
    const editor = mountEditor()
    const { batch, observation } = await capture(editor, [file()])
    let replacement: MarkdownEditorTransactionEvent | undefined
    batch.items[0]!.signal.addEventListener('abort', () => {
      editor.vm.dispatchTransaction({
        changes: [
          {
            from: 0,
            to: observation.transaction.value.length,
            insert: observation.transaction.value,
          },
        ],
        history: 'separate',
        origin: 'programmatic',
      })
      replacement = editor
        .emitted('transaction')!
        .at(-1)![0] as MarkdownEditorTransactionEvent
    })
    expect(editor.vm.applyAttachmentResult(resolved(batch))).toBe(false)
    expect(replacement).toMatchObject({
      accepted: true,
      beforeRevision: observation.transaction.revision,
      revision: observation.transaction.revision,
      value: observation.transaction.value,
    })
    expect(
      replacement!.positionMap!.mapRange(observation.placements[0]!.range)
        .deleted,
    ).toBe(true)
    expect(observation.plan.jobs[0]!.phase).toBe('deleted')
    expect(editor.emitted('transaction')).toHaveLength(2)
    expect(editor.emitted('update:modelValue')!.at(-1)![0]).toBe(
      observation.transaction.value,
    )
    expect(lend(editor, batch).accepted).toBe(false)
  })

  it.each([
    { id: 'other', epoch: 2 },
    { id: 'doc', epoch: 3 },
  ])(
    'refuses an abort-listener document switch to $id/$epoch before the watcher resets the store',
    async (nextIdentity) => {
      const identity = reactive({ id: 'doc', epoch: 2 })
      const editor = mount(MarkdownEditor, {
        props: { modelValue: 'ab', documentIdentity: identity },
      })
      const { batch, observation } = await capture(editor, [file()])
      await editor.setProps({ modelValue: observation.transaction.value })
      batch.items[0]!.signal.addEventListener('abort', () => {
        identity.id = nextIdentity.id
        identity.epoch = nextIdentity.epoch
      })
      expect(editor.vm.applyAttachmentResult(resolved(batch))).toBe(false)
      expect(editor.emitted('transaction')).toHaveLength(1)
      await nextTick()
      expect(editor.get<HTMLTextAreaElement>('textarea').element.value).toBe(
        observation.transaction.value,
      )
      expect(lend(editor, batch).accepted).toBe(false)
      expect(editor.vm.applyAttachmentResult(resolved(batch))).toBe(false)
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
      const original = file('recovered.png')
      const recovered = await capture(editor, [original])
      expect(recovered.batch.documentIdentity).toEqual(nextIdentity)
      expect(
        lend(editor, recovered.batch).consumer,
      ).toHaveBeenCalledExactlyOnceWith(original, recovered.observation)
      expect(editor.vm.applyAttachmentResult(resolved(recovered.batch))).toBe(
        true,
      )
      expect(editor.emitted('update:modelValue')!.at(-1)![0]).toBe(
        'a![ok](https://cdn.example/ok.png)b',
      )
    },
  )

  it('recovers through a fresh native replacement after stale completion and keeps its sibling independent', async () => {
    const editor = mountEditor()
    const { batch, observation } = await capture(editor, [
      file('a.png'),
      file('b.png'),
    ])
    batch.items[0]!.signal.addEventListener('abort', () => {
      editor.vm.dispatchTransaction({
        changes: [{ from: 0, to: 0, insert: 'PREFIX ' }],
        history: 'separate',
        origin: 'programmatic',
      })
    })
    expect(editor.vm.applyAttachmentResult(resolved(batch))).toBe(false)
    expect(lend(editor, batch).accepted).toBe(false)
    expect(lend(editor, batch, 1).accepted).toBe(true)
    expect(batch.items[1]!.signal.aborted).toBe(false)
    expect(editor.vm.applyAttachmentResult(resolved(batch, 1))).toBe(true)
    expect(observation.plan.jobs[0]!.phase).toBe('stale')
    editor.vm.dispatchTransaction({
      changes: [],
      selection: { start: 9, end: 9 },
      history: 'skip',
      origin: 'programmatic',
    })
    await nextTick()
    await editor
      .findAll('button')
      .find((button) => button.text() === '替换')!
      .trigger('click')
    const original = file('recovered.png')
    const recovered = await capture(editor, [original])
    expect(
      lend(editor, recovered.batch).consumer,
    ).toHaveBeenCalledExactlyOnceWith(original, recovered.observation)
    expect(lend(editor, batch).accepted).toBe(false)
    expect(editor.vm.applyAttachmentResult(resolved(batch))).toBe(false)
    expect(editor.vm.applyAttachmentResult(resolved(recovered.batch))).toBe(
      true,
    )
    expect(editor.emitted('update:modelValue')!.at(-1)![0]).toBe(
      'PREFIX a![ok](https://cdn.example/ok.png)\n![ok](https://cdn.example/ok.png)b',
    )
  })

  it('refuses completion when its item abort listener releases the editor', async () => {
    const transactions = vi.fn()
    const updates = vi.fn()
    const editor = mount(MarkdownEditor, {
      props: {
        modelValue: 'ab',
        documentIdentity: { id: 'doc', epoch: 2 },
        onTransaction: transactions,
        'onUpdate:modelValue': updates,
      },
    })
    const { batch, observation } = await capture(editor, [
      file(),
      file('b.png'),
    ])
    batch.items[0]!.signal.addEventListener('abort', () => editor.unmount())
    expect(editor.vm.applyAttachmentResult(resolved(batch))).toBe(false)
    expect(transactions).toHaveBeenCalledTimes(1)
    expect(updates).toHaveBeenCalledExactlyOnceWith(
      observation.transaction.value,
    )
    expect(batch.items.every((item) => item.signal.aborted)).toBe(true)
    expect(lend(editor, batch, 1).accepted).toBe(false)
  })
})
