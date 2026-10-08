import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ElMarkdownEditor } from '../../../element-plus'
import type { MarkdownEditorCommand } from '../../../element-plus'

const source = 'Palette scope and backward selection'
const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
})

const key = (options: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'p',
    ctrlKey: true,
    ...options,
  })

const open = async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const run = vi.fn<MarkdownEditorCommand['run']>(() => ({}))
  const wrapper = mount(ElMarkdownEditor, {
    attachTo: host,
    props: {
      modelValue: source,
      documentIdentity: { id: 'palette:host:文章', epoch: 17 },
      surfaces: { commandPalette: true },
      commands: [
        {
          key: 'probe',
          label: 'Probe command',
          group: 'insert',
          presentation: ['palette'],
          run,
        },
      ],
    },
  })
  cleanups.push(() => {
    wrapper.unmount()
    host.remove()
  })
  const textarea = wrapper.get<HTMLTextAreaElement>('textarea')
  textarea.element.setSelectionRange(3, 12, 'backward')
  await textarea.trigger('select')
  wrapper.vm.openCommandPalette()
  await nextTick()
  const input = Array.from(
    document.body.querySelectorAll<HTMLInputElement>('input[role="combobox"]'),
  ).at(-1)!
  const dialog = input.closest<HTMLElement>('[role="dialog"]')!
  expect(host.contains(input)).toBe(false)
  expect(document.activeElement).toBe(input)
  input.value = 'Probe'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  input.setSelectionRange(1, 4, 'backward')
  const outside = vi.fn()
  document.body.addEventListener('keydown', outside)
  cleanups.push(() => document.body.removeEventListener('keydown', outside))
  return { wrapper, host, textarea, input, dialog, run, outside }
}

describe('public palette key scope after teleport', () => {
  it.each([
    { ctrlKey: true, metaKey: false },
    { ctrlKey: false, metaKey: true },
    { ctrlKey: true, metaKey: false, repeat: true },
    { ctrlKey: false, metaKey: true, repeat: true },
  ])(
    'consumes only active palette Mod+P without reopening for %j',
    async (options) => {
      const { wrapper, input, dialog, run, outside } = await open()
      const active = input.getAttribute('aria-activedescendant')
      const selectionEvents = wrapper.emitted('selection-change')?.length
      const event = key(options)
      input.dispatchEvent(event)
      await nextTick()
      expect(event.defaultPrevented).toBe(true)
      expect(outside).not.toHaveBeenCalled()
      expect(dialog.isConnected).toBe(true)
      expect(document.activeElement).toBe(input)
      expect(input.value).toBe('Probe')
      expect(input.getAttribute('aria-activedescendant')).toBe(active)
      expect([
        input.selectionStart,
        input.selectionEnd,
        input.selectionDirection,
      ]).toEqual([1, 4, 'backward'])
      expect(run).not.toHaveBeenCalled()
      expect(wrapper.emitted('command')).toBeUndefined()
      expect(wrapper.emitted('transaction')).toBeUndefined()
      expect(wrapper.emitted('selection-change')?.length).toBe(selectionEvents)
    },
  )

  it('keeps the boundary on palette command buttons and restores backward selection on Escape', async () => {
    const { wrapper, textarea, input, dialog, run } = await open()
    const button = dialog.querySelector<HTMLButtonElement>(
      'button[role="option"]',
    )!
    button.focus()
    const event = key({ ctrlKey: false, metaKey: true })
    button.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(button)
    input.dispatchEvent(key({ key: 'Escape', ctrlKey: false }))
    await flushPromises()
    expect(dialog.isConnected).toBe(false)
    expect(document.activeElement).toBe(textarea.element)
    expect([
      textarea.element.selectionStart,
      textarea.element.selectionEnd,
      textarea.element.selectionDirection,
    ]).toEqual([3, 12, 'backward'])
    expect(textarea.element.value).toBe(source)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    { altKey: true },
    { shiftKey: true },
    { metaKey: true },
    { ctrlKey: false },
    { key: 'q' },
    { isComposing: true },
    { keyCode: 229 },
  ])(
    'leaves unrelated or native composition keys unclaimed for %j',
    async (options) => {
      const { input, outside, run } = await open()
      const event = key(options)
      input.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
      expect(outside).toHaveBeenCalledOnce()
      expect(input.value).toBe('Probe')
      expect(run).not.toHaveBeenCalled()
    },
  )

  it('does not re-handle an already prevented event', async () => {
    const { input, outside } = await open()
    const event = key()
    event.preventDefault()
    input.dispatchEvent(event)
    expect(outside).toHaveBeenCalledOnce()
  })

  it.each(['disabled', 'readonly'] as const)(
    'does not claim Mod+P after %s changes',
    async (prop) => {
      const { wrapper, input, outside, run } = await open()
      await wrapper.setProps({ [prop]: true })
      const event = key()
      input.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
      expect(outside).toHaveBeenCalledOnce()
      expect(run).not.toHaveBeenCalled()
    },
  )

  it('respects the existing editor composition machine without a native key flag', async () => {
    const { textarea, input, outside } = await open()
    await textarea.trigger('compositionstart')
    const event = key()
    input.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(outside).toHaveBeenCalledOnce()
    await textarea.trigger('compositionend', { data: '' })
  })

  it('does not capture events outside the palette or another editor', async () => {
    const first = await open()
    const second = await open()
    const event = key()
    first.textarea.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(first.input.value).toBe('Probe')
    expect(second.input.value).toBe('Probe')
    expect(first.run).not.toHaveBeenCalled()
    expect(second.run).not.toHaveBeenCalled()
  })

  it('retires the old dialog on close and same-source document rebind', async () => {
    const { wrapper, input, dialog } = await open()
    await wrapper.setProps({
      documentIdentity: { id: 'palette:other', epoch: 18 },
    })
    expect(dialog.isConnected).toBe(false)
    const closed = key()
    input.dispatchEvent(closed)
    expect(closed.defaultPrevented).toBe(false)
    wrapper.vm.openCommandPalette()
    await nextTick()
    const obsolete = key()
    input.dispatchEvent(obsolete)
    expect(obsolete.defaultPrevented).toBe(false)
    const current = document.body.querySelector<HTMLInputElement>(
      'input[role="combobox"]',
    )!
    const active = key()
    current.dispatchEvent(active)
    expect(active.defaultPrevented).toBe(true)
  })

  it.each(['surface-disabled', 'disposed'] as const)(
    'does not claim an obsolete element after %s',
    async (state) => {
      const { wrapper, input, dialog } = await open()
      if (state === 'disposed') wrapper.unmount()
      else await wrapper.setProps({ surfaces: { commandPalette: false } })
      expect(dialog.isConnected).toBe(false)
      const event = key()
      input.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    },
  )
})
