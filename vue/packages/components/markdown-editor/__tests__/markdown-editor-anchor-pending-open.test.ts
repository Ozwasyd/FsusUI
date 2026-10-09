import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ElMarkdownEditor,
  defaultMarkdownEditorCommands,
  resolveMarkdownEditorLocaleText,
  type MarkdownEditorCommandResult,
  type MarkdownEditorTransactionEvent,
} from '../../../element-plus'
import { createMarkdownEditorProjection, stabilizeMarkdownEditorProjection } from '../../../wasm/markdown-runtime'

const wrappers: ReturnType<typeof mount>[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
const fixture = (options?: { edit?: boolean; concurrent?: boolean; source?: string }) => {
  const source = options?.source ?? 'First.\n\nOther ^existing'
  const identity = { id: 'document:pending-anchor', epoch: 1 }
  const key = options?.edit ? 'anchor-properties' : 'anchor-insert'
  const attempts: { resolve: (result: MarkdownEditorCommandResult) => void; reject: (error: Error) => void }[] = []
  const commands = defaultMarkdownEditorCommands.map((command) => command.key === key ? {
    ...command,
    concurrent: options?.concurrent,
    shortcut: options?.concurrent ? 'mod+q' : undefined,
    run: () => new Promise<MarkdownEditorCommandResult>((resolve, reject) => attempts.push({ resolve, reject })),
  } : command)
  const wrapper = mount(ElMarkdownEditor, { attachTo: document.body, props: {
    modelValue: source, documentIdentity: identity, commands, surfaces: { commandPalette: true },
  } })
  wrappers.push(wrapper)
  const projection = stabilizeMarkdownEditorProjection(createMarkdownEditorProjection(source), identity)
  const paragraphs = projection.nodes.filter((node) => node.kind === 'paragraph')
  const anchor = projection.nodes.find((node) => node.kind === 'anchor')!
  const select = async (start: number, end = start) => {
    expect(wrapper.vm.dispatchTransaction({ changes: [], history: 'skip', origin: 'programmatic',
      selection: { start, end, direction: 'none' } })).toMatchObject({ accepted: true, revision: 0, value: source })
    await flushPromises()
  }
  const invoke = async (edit = !!options?.edit) => {
    if (options?.concurrent) {
      await wrapper.get('textarea').trigger('keydown', { key: 'q', ctrlKey: true })
      await flushPromises()
      return
    }
    wrapper.vm.openCommandPalette()
    await flushPromises()
    const locale = resolveMarkdownEditorLocaleText().contextual
    const label = edit ? locale.editAnchor : locale.insertAnchor
    const option = [...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((item) => item.textContent?.includes(label))!
    expect(option).toBeDefined()
    option.click()
    await flushPromises()
  }
  const resolve = async (index = attempts.length - 1) => {
    attempts[index]!.resolve({ surface: 'anchor-properties', focus: 'surface' })
    await flushPromises()
  }
  const unchanged = () => {
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted<[MarkdownEditorTransactionEvent]>('transaction')?.every(([event]) =>
      event.transaction.changes.length === 0 && event.revision === 0 && event.value === source,
    )).toBe(true)
  }
  return { wrapper, source, paragraphs, anchor, select, invoke, resolve, attempts, unchanged }
}

describe('canonical anchor target before asynchronous form open', () => {
  it('refuses the exact deferred insert-to-rename counterexample without a revision change', async () => {
    const f = fixture()
    await f.select(f.paragraphs[0]!.rawRange.end)
    await f.invoke()
    expect(f.attempts).toHaveLength(1)
    await f.select(f.anchor.rawRange.start, f.anchor.rawRange.end)
    await f.resolve()
    // Exercise the destructive result too if an implementation opens the wrong form.
    const form = f.wrapper.find('form[role="dialog"]')
    if (form.exists()) {
      await form.get('input').setValue('new-section')
      await form.trigger('submit')
      await flushPromises()
    }
    f.unchanged()
    expect(f.wrapper.find('form[role="dialog"]').exists()).toBe(false)
  })

  it('refuses a changed insertion coordinate within the original paragraph', async () => {
    const f = fixture()
    await f.select(f.paragraphs[0]!.rawRange.end)
    await f.invoke()
    await f.select(1)
    await f.resolve()
    expect(f.wrapper.find('form[role="dialog"]').exists()).toBe(false)
    f.unchanged()
  })

  it('refuses a deferred edit becoming creation', async () => {
    const f = fixture({ edit: true })
    await f.select(f.anchor.rawRange.start, f.anchor.rawRange.end)
    await f.invoke()
    await f.select(f.paragraphs[0]!.rawRange.end)
    await f.resolve()
    expect(f.wrapper.find('form[role="dialog"]').exists()).toBe(false)
    f.unchanged()
  })

  it('refuses a changed revision even when the original target remains current', async () => {
    const f = fixture()
    await f.select(f.paragraphs[0]!.rawRange.end)
    await f.invoke()
    expect(f.wrapper.vm.dispatchTransaction({ changes: [{ from: f.source.length, to: f.source.length, insert: '!' }],
      selection: { start: f.paragraphs[0]!.rawRange.end, end: f.paragraphs[0]!.rawRange.end }, origin: 'programmatic', history: 'separate',
    })).toMatchObject({ accepted: true, revision: 1 })
    await flushPromises()
    await f.resolve()
    expect(f.wrapper.find('form[role="dialog"]').exists()).toBe(false)
    expect(f.wrapper.emitted('update:modelValue')).toEqual([[`${f.source}!`]])
  })

  it('does not open a late readonly result and permits a fresh invocation afterward', async () => {
    const f = fixture()
    await f.select(f.paragraphs[0]!.rawRange.end)
    await f.invoke()
    await f.wrapper.setProps({ readonly: true })
    await f.resolve()
    expect(f.wrapper.find('form[role="dialog"]').exists()).toBe(false)
    await f.wrapper.setProps({ readonly: false })
    await f.invoke()
    await f.resolve()
    expect(f.wrapper.get('form[role="dialog"]').attributes('aria-label')).toBe(resolveMarkdownEditorLocaleText().contextual.insertAnchor)
    f.unchanged()
  })

  it('drops pending results after a same-source document switch', async () => {
    const f = fixture()
    await f.select(f.paragraphs[0]!.rawRange.end)
    await f.invoke()
    await f.wrapper.setProps({ documentIdentity: { id: 'document:replacement', epoch: 1 } })
    await f.resolve()
    expect(f.wrapper.find('form[role="dialog"]').exists()).toBe(false)
    f.unchanged()
  })

  it('cancellation of the current form prevents a pending request from reopening it', async () => {
    const f = fixture()
    await f.select(f.anchor.rawRange.start, f.anchor.rawRange.end)
    await f.invoke(true)
    const form = f.wrapper.get('form[role="dialog"]')
    await f.select(f.paragraphs[0]!.rawRange.end)
    await f.invoke()
    await form.trigger('keydown', { key: 'Escape' })
    await flushPromises()
    await f.resolve()
    expect(f.wrapper.find('form[role="dialog"]').exists()).toBe(false)
    await f.invoke()
    await f.resolve()
    expect((f.wrapper.get('form[role="dialog"]').get('input').element as HTMLInputElement).value).toBe('')
    f.unchanged()
  })

  it('suppresses repeated pending invocation and allows cancel/reopen after resolution', async () => {
    const f = fixture()
    await f.select(f.paragraphs[0]!.rawRange.end)
    await f.invoke()
    await f.invoke()
    expect(f.attempts).toHaveLength(1)
    await f.resolve()
    await f.wrapper.get('form[role="dialog"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    await f.invoke()
    expect(f.attempts).toHaveLength(2)
    await f.resolve()
    const form = f.wrapper.get('form[role="dialog"]')
    await form.get('input').setValue('new-section')
    await form.trigger('submit')
    await flushPromises()
    expect(f.wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['First. ^new-section\n\nOther ^existing'])
  })

  it('ignores an older concurrent rejection without stealing focus from the latest form', async () => {
    const f = fixture({ concurrent: true, source: 'First.\n\nSecond.\n\nOther ^existing' })
    await f.select(f.paragraphs[0]!.rawRange.end)
    await f.invoke()
    await f.select(f.paragraphs[1]!.rawRange.end)
    await f.invoke()
    expect(f.attempts).toHaveLength(2)
    await f.resolve(1)
    const form = f.wrapper.get('form[role="dialog"]')
    await form.get('input').setValue('new-section')
    f.attempts[0]!.reject(new Error('obsolete request'))
    await flushPromises()
    expect(document.activeElement).toBe(form.get('input').element)
    await form.trigger('submit')
    await flushPromises()
    expect(f.wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['First.\n\nSecond. ^new-section\n\nOther ^existing'])
  })
})
