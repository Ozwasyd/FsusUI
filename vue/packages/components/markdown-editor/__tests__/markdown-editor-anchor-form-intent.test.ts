import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import { ElMarkdownEditor, resolveMarkdownEditorLocaleText, type MarkdownEditorTransactionEvent } from '../../../element-plus'
import { createMarkdownEditorProjection, stabilizeMarkdownEditorProjection } from '../../../wasm/markdown-runtime'

const source = 'First.\n\nOther ^existing\n\nLast ^another'
const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

const fixture = () => {
  const identity = { id: 'document:anchor-form', epoch: 1 }
  const wrapper = mount(ElMarkdownEditor, {
    attachTo: document.body,
    props: { modelValue: source, documentIdentity: identity, surfaces: { commandPalette: true } },
  })
  wrappers.push(wrapper)
  const projection = stabilizeMarkdownEditorProjection(createMarkdownEditorProjection(source), identity)
  const paragraph = projection.nodes.find((node) => node.kind === 'paragraph')!
  const anchors = projection.nodes.filter((node) => node.kind === 'anchor')
  const select = async (start: number, end = start) => {
    expect(wrapper.vm.dispatchTransaction({
      changes: [], history: 'skip', origin: 'programmatic', expectedRevision: 0,
      documentIdentity: identity, selection: { start, end, direction: 'none' },
    })).toMatchObject({ accepted: true, revision: 0, value: source })
    await flushPromises()
  }
  const open = async (intent: 'insert' | 'edit') => {
    wrapper.vm.openCommandPalette()
    await flushPromises()
    const locale = resolveMarkdownEditorLocaleText().contextual
    const label = intent === 'insert' ? locale.insertAnchor : locale.editAnchor
    const option = [...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')]
      .find((button) => button.textContent?.includes(label))!
    expect(option).toBeDefined()
    expect(option.disabled).toBe(false)
    option.click()
    await flushPromises()
    return wrapper.get('form[role="dialog"]')
  }
  const unchanged = () => {
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted<[MarkdownEditorTransactionEvent]>('transaction')?.every(([event]) =>
      event.transaction.changes.length === 0 && event.revision === 0 && event.value === source,
    )).toBe(true)
  }
  return { wrapper, paragraph, anchors, select, open, unchanged }
}

describe('canonical anchor form intent and target lifetime', () => {
  it('refuses creation retargeted to an existing anchor by selection-only dispatch', async () => {
    const { wrapper, paragraph, anchors, select, open, unchanged } = fixture()
    await select(paragraph.rawRange.end)
    const form = await open('insert')
    await form.get('input').setValue('new-section')
    await select(anchors[0]!.rawRange.start, anchors[0]!.rawRange.end)
    expect(form.attributes('aria-label')).toBe(resolveMarkdownEditorLocaleText().contextual.insertAnchor)
    expect(form.attributes('data-markdown-anchor-id')).toBe('')
    expect(form.findAll('button')).toHaveLength(2)
    await form.trigger('submit')
    await flushPromises()
    expect(form.get('[role="alert"]').text()).toBe(resolveMarkdownEditorLocaleText().results.stale)
    unchanged()
    expect(wrapper.vm.undo()).toMatchObject({ accepted: false, value: source })
  })

  it('refuses moving a creation target to another unanchored position', async () => {
    const { paragraph, select, open, unchanged } = fixture()
    await select(paragraph.rawRange.end)
    const form = await open('insert')
    await form.get('input').setValue('new-section')
    await select(paragraph.rawContentRanges[0]!.start)
    await form.trigger('submit')
    await flushPromises()
    expect(form.get('[role="alert"]').text()).toBe(resolveMarkdownEditorLocaleText().results.stale)
    unchanged()
  })

  it.each(['another-anchor', 'plain-paragraph'])('refuses rename/removal retargeted to %s', async (target) => {
    const { paragraph, anchors, select, open, unchanged } = fixture()
    await select(anchors[0]!.rawRange.start, anchors[0]!.rawRange.end)
    const form = await open('edit')
    await form.get('input').setValue('renamed')
    await select(target === 'another-anchor' ? anchors[1]!.rawRange.start : paragraph.rawRange.end)
    expect(form.attributes('aria-label')).toBe(resolveMarkdownEditorLocaleText().contextual.editAnchor)
    expect(form.attributes('data-markdown-anchor-id')).toBe(anchors[0]!.id)
    await form.trigger('submit')
    await flushPromises()
    expect(form.get('[role="alert"]').text()).toBe(resolveMarkdownEditorLocaleText().results.stale)
    const remove = form.findAll('button').find((button) => button.text() === resolveMarkdownEditorLocaleText().contextual.removeAnchor)!
    await remove.trigger('click')
    await flushPromises()
    unchanged()
  })

  it.each(['another', 'bad_name', 'Intro'])('keeps canonical rename refusal for %j', async (id) => {
    const { anchors, select, open, unchanged } = fixture()
    await select(anchors[0]!.rawRange.start, anchors[0]!.rawRange.end)
    const form = await open('edit')
    await form.get('input').setValue(id)
    await form.trigger('submit')
    await flushPromises()
    expect(form.get('[role="alert"]').text()).toBe(resolveMarkdownEditorLocaleText().contextual.invalidAnchor)
    unchanged()
  })

  it('cancels creation and opens a fresh rename target without carrying its draft', async () => {
    const { wrapper, paragraph, anchors, select, open, unchanged } = fixture()
    await select(paragraph.rawRange.end)
    const cancelled = await open('insert')
    await cancelled.get('input').setValue('old-draft')
    await cancelled.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.find('form[role="dialog"]').exists()).toBe(false)
    unchanged()
    await select(anchors[0]!.rawRange.start, anchors[0]!.rawRange.end)
    const form = await open('edit')
    expect((form.get('input').element as HTMLInputElement).value).toBe('existing')
    await form.get('input').setValue('renamed')
    await form.trigger('submit')
    await flushPromises()
    const expected = 'First.\n\nOther ^renamed\n\nLast ^another'
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([expected])
    expect(wrapper.vm.undo()).toMatchObject({ accepted: true, value: source })
    expect(wrapper.vm.redo()).toMatchObject({ accepted: true, value: expected })
  })

  it('cancels rename and opens a fresh creation target without removing the old anchor', async () => {
    const { wrapper, paragraph, anchors, select, open, unchanged } = fixture()
    await select(anchors[0]!.rawRange.start, anchors[0]!.rawRange.end)
    const cancelled = await open('edit')
    const cancel = cancelled.findAll('button').find((button) => button.text() === resolveMarkdownEditorLocaleText().contextual.cancel)!
    await cancel.trigger('click')
    await flushPromises()
    unchanged()
    await select(paragraph.rawRange.end)
    const form = await open('insert')
    expect((form.get('input').element as HTMLInputElement).value).toBe('')
    expect(form.findAll('button')).toHaveLength(2)
    await form.get('input').setValue('new-section')
    await form.trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['First. ^new-section\n\nOther ^existing\n\nLast ^another'])
  })

  it('requires a fresh open after a stale selection and cancellation', async () => {
    const { wrapper, paragraph, anchors, select, open, unchanged } = fixture()
    await select(paragraph.rawRange.end)
    const stale = await open('insert')
    await stale.get('input').setValue('old-draft')
    await select(anchors[0]!.rawRange.start, anchors[0]!.rawRange.end)
    await stale.trigger('submit')
    await flushPromises()
    unchanged()
    await stale.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    await select(paragraph.rawRange.end)
    const fresh = await open('insert')
    expect(fresh.find('[role="alert"]').exists()).toBe(false)
    expect((fresh.get('input').element as HTMLInputElement).value).toBe('')
    await fresh.get('input').setValue('new-section')
    await fresh.trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['First. ^new-section\n\nOther ^existing\n\nLast ^another'])
  })
})
