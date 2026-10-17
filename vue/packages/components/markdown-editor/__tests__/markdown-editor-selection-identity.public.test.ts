import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { ElMarkdownEditor, markdownEditorEmits } from '../../../element-plus'
import type {
  MarkdownEditorCommand,
  MarkdownEditorCommandResult,
  MarkdownEditorDocumentIdentity,
  MarkdownEditorSelectionEvent,
} from '../../../element-plus'

const source = '# Same\n\nbody\n\n# Same\n\ntail\n'
const identity: MarkdownEditorDocumentIdentity = {
  id: 'workspace:文章:😀:tab',
  epoch: 17,
}

const events = (wrapper: ReturnType<typeof mount>) =>
  (wrapper.emitted('selection-change') ?? []).map(
    ([event]) => event as MarkdownEditorSelectionEvent,
  )

const select = async (
  wrapper: ReturnType<typeof mount>,
  start: number,
  end = start,
  direction: 'backward' | 'forward' | 'none' = 'none',
) => {
  const textarea = wrapper.get('textarea')
  ;(textarea.element as HTMLTextAreaElement).setSelectionRange(
    start,
    end,
    direction,
  )
  await textarea.trigger('select')
}

describe('public editor selection event document identity', () => {
  it('exports identity while preserving legacy event-object and validator compatibility', () => {
    expectTypeOf<MarkdownEditorSelectionEvent>().toHaveProperty(
      'documentIdentity',
    )
    const legacy: MarkdownEditorSelectionEvent = {
      revision: 0,
      selection: { start: 0, end: 0, direction: 'none' },
    }
    expect(markdownEditorEmits['selection-change'](legacy)).toBe(true)
  })
  it('captures collapsed native selectionchange and deduplicates a subsequent select', async () => {
    const wrapper = mount(ElMarkdownEditor, {
      props: { modelValue: source, documentIdentity: identity },
    })
    const textarea = wrapper.get('textarea')
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(0, 0)
    await textarea.trigger('selectionchange')
    expect(events(wrapper)).toEqual([
      {
        documentIdentity: identity,
        revision: 0,
        selection: { start: 0, end: 0, direction: 'none' },
      },
    ])
    await textarea.trigger('select')
    expect(events(wrapper)).toHaveLength(1)
  })

  it('binds accepted transaction selection to its immutable dispatch result', async () => {
    const wrapper = mount(ElMarkdownEditor, {
      props: { modelValue: source, documentIdentity: identity },
    })
    const result = wrapper.vm.dispatchTransaction({
      changes: [{ from: 0, to: 0, insert: 'prefix\n\n' }],
      documentIdentity: identity,
      expectedRevision: 0,
      history: 'separate',
      origin: 'programmatic',
      selection: { start: 0, end: 6, direction: 'backward' },
    })
    expect(result.accepted).toBe(true)
    expect(events(wrapper)).toEqual([
      {
        documentIdentity: result.documentIdentity,
        revision: result.revision,
        selection: result.selection,
      },
    ])
    expect(Object.isFrozen(events(wrapper)[0])).toBe(true)
    expect(Object.isFrozen(events(wrapper)[0]!.documentIdentity)).toBe(true)
    await nextTick()
  })

  it('binds native selection and pointer capture without changing source or revision', async () => {
    const wrapper = mount(ElMarkdownEditor, {
      props: { modelValue: source, documentIdentity: identity },
    })
    await select(wrapper, 2, 6, 'backward')
    expect(events(wrapper).at(-1)).toEqual({
      documentIdentity: identity,
      revision: 0,
      selection: { start: 2, end: 6, direction: 'backward' },
    })
    ;(wrapper.get('textarea').element as HTMLTextAreaElement).setSelectionRange(
      0,
      0,
    )
    await wrapper.get('textarea').trigger('click')
    expect(events(wrapper).at(-1)).toMatchObject({
      documentIdentity: identity,
      revision: 0,
      selection: { start: 0, end: 0 },
    })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('transaction')).toBeUndefined()
    const count = events(wrapper).length
    await wrapper.get('textarea').trigger('select')
    expect(events(wrapper)).toHaveLength(count)
  })

  it('keeps a delayed A observation bound to A across a same-source B replacement', async () => {
    const wrapper = mount(ElMarkdownEditor, {
      props: { modelValue: source, documentIdentity: identity },
    })
    await select(wrapper, 0)
    const delayed = events(wrapper).at(-1)!
    const nextIdentity = { id: `${identity.id}:other`, epoch: identity.epoch }
    await wrapper.setProps({ documentIdentity: nextIdentity })
    await flushPromises()
    await select(wrapper, 2)
    expect(delayed.documentIdentity).toEqual(identity)
    expect(events(wrapper).at(-1)).toMatchObject({
      documentIdentity: nextIdentity,
      revision: 0,
    })
    expect(delayed.documentIdentity).not.toEqual(
      events(wrapper).at(-1)!.documentIdentity,
    )
    expect(Object.isFrozen(delayed.documentIdentity)).toBe(true)
  })

  it('retains old epochs and rejects old-epoch transactions without a selection emission', async () => {
    const wrapper = mount(ElMarkdownEditor, {
      props: { modelValue: source, documentIdentity: identity },
    })
    await select(wrapper, 0)
    const delayed = events(wrapper).at(-1)!
    const nextIdentity = { ...identity, epoch: identity.epoch + 1 }
    await wrapper.setProps({ documentIdentity: nextIdentity })
    await flushPromises()
    const count = events(wrapper).length
    expect(
      wrapper.vm.dispatchTransaction({
        changes: [],
        documentIdentity: identity,
        expectedRevision: 0,
        history: 'skip',
        origin: 'programmatic',
        selection: { start: 3, end: 3 },
      }),
    ).toMatchObject({ accepted: false, reason: 'document-mismatch' })
    expect(events(wrapper)).toHaveLength(count)
    await select(wrapper, 2)
    expect(delayed.documentIdentity).toEqual(identity)
    expect(events(wrapper).at(-1)).toMatchObject({
      documentIdentity: nextIdentity,
      revision: 0,
    })
  })

  it('captures the current replacement revision while retaining prior event snapshots', async () => {
    const wrapper = mount(ElMarkdownEditor, {
      props: { modelValue: source, documentIdentity: identity },
    })
    await select(wrapper, 0)
    const delayed = events(wrapper).at(-1)!
    await wrapper.setProps({ modelValue: '# Replacement\n\nbody\n' })
    await flushPromises()
    const replacement = wrapper.emitted('transaction')!.at(-1)![0] as {
      revision: number
    }
    await select(wrapper, 2)
    expect(events(wrapper).at(-1)).toMatchObject({
      documentIdentity: identity,
      revision: replacement.revision,
    })
    expect(delayed).toMatchObject({
      documentIdentity: identity,
      revision: 0,
      selection: { start: 0, end: 0 },
    })
  })

  it('uses the existing default identity when no consumer identity is supplied', async () => {
    const wrapper = mount(ElMarkdownEditor, { props: { modelValue: source } })
    const result = wrapper.vm.dispatchTransaction({
      changes: [],
      history: 'skip',
      origin: 'programmatic',
      selection: { start: 0, end: 0 },
    })
    expect(events(wrapper).at(-1)).toMatchObject({
      documentIdentity: result.documentIdentity,
      revision: 0,
    })
    expect(result.documentIdentity.epoch).toBe(0)
    expect(result.documentIdentity.id).toBeTruthy()
    await nextTick()
  })

  it.each(['replacement', 'disposal'] as const)(
    'cancels delayed command selection after %s',
    async (action) => {
      let resolve!: (value: MarkdownEditorCommandResult) => void
      let signal!: AbortSignal
      const command: MarkdownEditorCommand = {
        key: 'delayed-selection',
        label: 'Delayed selection',
        group: 'test',
        run: (context) => {
          signal = context.signal
          return new Promise((done) => {
            resolve = done
          })
        },
      }
      const wrapper = mount(ElMarkdownEditor, {
        props: {
          modelValue: source,
          documentIdentity: identity,
          commands: [command],
          primaryCommandKeys: [command.key],
        },
      })
      await wrapper.get('.el-markdown-editor__command').trigger('click')
      expect(signal.aborted).toBe(false)
      if (action === 'replacement') {
        await wrapper.setProps({
          documentIdentity: { id: 'document:B', epoch: 18 },
        })
      } else {
        wrapper.unmount()
      }
      expect(signal.aborted).toBe(true)
      const count = events(wrapper).length
      resolve({
        transaction: {
          changes: [],
          documentIdentity: identity,
          expectedRevision: 0,
          history: 'skip',
          origin: 'command',
          selection: { start: 1, end: 1 },
        },
      })
      await flushPromises()
      expect(events(wrapper)).toHaveLength(count)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    },
  )
})
