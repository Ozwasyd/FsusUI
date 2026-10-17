import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ElMarkdownEditor } from '../../../element-plus'

const source = 'Palette close and backward selection'
const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup()
})

const createEditor = () => {
  const host = document.createElement('div')
  const outside = document.createElement('input')
  outside.value = 'Newer focus owner'
  document.body.append(host, outside)
  const run = vi.fn(() => ({}))
  const wrapper = mount(ElMarkdownEditor, {
    attachTo: host,
    props: {
      modelValue: source,
      documentIdentity: { id: 'palette:close:文章', epoch: 17 },
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
    outside.remove()
  })
  const textarea = wrapper.get<HTMLTextAreaElement>('textarea').element
  const open = async () => {
    textarea.focus()
    textarea.setSelectionRange(3, 12, 'backward')
    textarea.dispatchEvent(new Event('select'))
    wrapper.vm.openCommandPalette()
    await nextTick()
    const input = Array.from(
      document.body.querySelectorAll<HTMLInputElement>(
        'input[role="combobox"]',
      ),
    ).at(-1)!
    expect(document.activeElement).toBe(input)
    const dialog = input.closest<HTMLElement>('[role="dialog"]')!
    return { input, dialog }
  }
  const focusOutside = () => {
    outside.focus()
    outside.setSelectionRange(1, 5, 'backward')
  }
  const expectOutside = () => {
    expect(document.activeElement).toBe(outside)
    expect([
      outside.selectionStart,
      outside.selectionEnd,
      outside.selectionDirection,
    ]).toEqual([1, 5, 'backward'])
  }
  const expectRestored = () => {
    expect(document.activeElement).toBe(textarea)
    expect([
      textarea.selectionStart,
      textarea.selectionEnd,
      textarea.selectionDirection,
    ]).toEqual([3, 12, 'backward'])
    expect(textarea.value).toBe(source)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('transaction')).toBeUndefined()
  }
  return {
    wrapper,
    textarea,
    outside,
    run,
    open,
    focusOutside,
    expectOutside,
    expectRestored,
  }
}

describe('public palette close focus lifetime', () => {
  it('does not move focus when already closed', async () => {
    const editor = createEditor()
    editor.focusOutside()
    expect(editor.wrapper.vm.closeCommandPalette()).toBeUndefined()
    await flushPromises()
    editor.expectOutside()
  })

  it('makes repeated close after a legitimate dismissal idempotent', async () => {
    const editor = createEditor()
    await editor.open()
    editor.wrapper.vm.closeCommandPalette()
    await flushPromises()
    editor.expectRestored()
    editor.focusOutside()
    editor.wrapper.vm.closeCommandPalette()
    editor.wrapper.vm.closeCommandPalette()
    await flushPromises()
    editor.expectOutside()
  })

  it('closes without stealing focus already transferred to another control', async () => {
    const editor = createEditor()
    const { dialog } = await editor.open()
    editor.focusOutside()
    editor.wrapper.vm.closeCommandPalette()
    await flushPromises()
    expect(dialog.isConnected).toBe(false)
    editor.expectOutside()
    expect(editor.run).not.toHaveBeenCalled()
  })

  it('yields to focus transferred after close but before queued restoration', async () => {
    const editor = createEditor()
    const { dialog } = await editor.open()
    editor.wrapper.vm.closeCommandPalette()
    editor.focusOutside()
    await flushPromises()
    expect(dialog.isConnected).toBe(false)
    editor.expectOutside()
  })

  it.each(['before-close', 'after-close'] as const)(
    'does not overwrite a newer source caret moved %s',
    async (timing) => {
      const editor = createEditor()
      await editor.open()
      if (timing === 'after-close') editor.wrapper.vm.closeCommandPalette()
      editor.textarea.focus()
      editor.textarea.setSelectionRange(20, 20, 'none')
      editor.textarea.dispatchEvent(new Event('select'))
      if (timing === 'before-close') editor.wrapper.vm.closeCommandPalette()
      await flushPromises()
      expect(document.activeElement).toBe(editor.textarea)
      expect([
        editor.textarea.selectionStart,
        editor.textarea.selectionEnd,
        editor.textarea.selectionDirection,
      ]).toEqual([20, 20, 'none'])
    },
  )

  it.each(['disabled', 'readonly'] as const)(
    'preserves the newer control when cancelling a %s editor',
    async (prop) => {
      const editor = createEditor()
      const { dialog } = await editor.open()
      editor.focusOutside()
      await editor.wrapper.setProps({ [prop]: true })
      editor.wrapper.vm.closeCommandPalette()
      await flushPromises()
      expect(dialog.isConnected).toBe(false)
      editor.expectOutside()
    },
  )

  it('restores backward selection for a focused public dismissal', async () => {
    const editor = createEditor()
    const { dialog } = await editor.open()
    expect(editor.wrapper.vm.closeCommandPalette()).toBeUndefined()
    await flushPromises()
    expect(dialog.isConnected).toBe(false)
    editor.expectRestored()
  })

  it('retains normal backdrop dismissal and source selection restoration', async () => {
    const editor = createEditor()
    const { dialog } = await editor.open()
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    })
    dialog.parentElement!.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(dialog.isConnected).toBe(false)
    editor.expectRestored()
  })

  it('restores source selection when Escape starts from a palette command button', async () => {
    const editor = createEditor()
    const { dialog } = await editor.open()
    const button = dialog.querySelector<HTMLButtonElement>(
      'button[role="option"]',
    )!
    button.focus()
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    button.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(dialog.isConnected).toBe(false)
    editor.expectRestored()
  })

  it('preserves command execution and the saved backward selection', async () => {
    const editor = createEditor()
    const { dialog } = await editor.open()
    const button = dialog.querySelector<HTMLButtonElement>(
      'button[role="option"]',
    )!
    button.focus()
    button.click()
    await flushPromises()
    expect(dialog.isConnected).toBe(false)
    expect(editor.run).toHaveBeenCalledOnce()
    editor.expectRestored()
  })

  it.each([
    { id: 'palette:other:文章', epoch: 17 },
    { id: 'palette:close:文章', epoch: 18 },
  ])(
    'cancels old restoration across same-source document rebind %j',
    async (identity) => {
      const editor = createEditor()
      await editor.open()
      editor.wrapper.vm.closeCommandPalette()
      await editor.wrapper.setProps({ documentIdentity: identity })
      await flushPromises()
      expect([
        editor.textarea.selectionStart,
        editor.textarea.selectionEnd,
        editor.textarea.selectionDirection,
      ]).toEqual([source.length, source.length, 'none'])
    },
  )

  it('keeps the native controlled-value reset selection without a palette close', async () => {
    const editor = createEditor()
    editor.textarea.focus()
    editor.textarea.setSelectionRange(3, 12, 'backward')
    editor.textarea.dispatchEvent(new Event('select'))
    await editor.wrapper.setProps({ modelValue: 'replacement' })
    await flushPromises()
    expect([
      editor.textarea.selectionStart,
      editor.textarea.selectionEnd,
      editor.textarea.selectionDirection,
    ]).toEqual([11, 11, 'none'])
  })

  it('cancels queued restoration after controlled source replacement', async () => {
    const editor = createEditor()
    await editor.open()
    editor.wrapper.vm.closeCommandPalette()
    await editor.wrapper.setProps({ modelValue: 'replacement' })
    await flushPromises()
    expect(document.activeElement).not.toBe(editor.textarea)
    expect(editor.textarea.value).toBe('replacement')
    expect([
      editor.textarea.selectionStart,
      editor.textarea.selectionEnd,
      editor.textarea.selectionDirection,
    ]).toEqual([11, 11, 'none'])
  })

  it('does not restore an old close into a newly opened palette', async () => {
    const editor = createEditor()
    await editor.open()
    editor.wrapper.vm.closeCommandPalette()
    editor.wrapper.vm.openCommandPalette()
    await flushPromises()
    const input = document.body.querySelector<HTMLInputElement>(
      'input[role="combobox"]',
    )!
    expect(document.activeElement).toBe(input)
    editor.wrapper.vm.closeCommandPalette()
    await flushPromises()
    editor.expectRestored()
  })

  it('leaves newer focus alone after the palette surface is hidden', async () => {
    const editor = createEditor()
    await editor.open()
    await editor.wrapper.setProps({ surfaces: { commandPalette: false } })
    editor.focusOutside()
    editor.wrapper.vm.closeCommandPalette()
    await flushPromises()
    editor.expectOutside()
  })

  it('does not focus a disposed editor after close', async () => {
    const editor = createEditor()
    await editor.open()
    editor.wrapper.vm.closeCommandPalette()
    editor.wrapper.unmount()
    editor.focusOutside()
    await flushPromises()
    editor.expectOutside()
  })

  it('does not take focus from a second public editor palette', async () => {
    const first = createEditor()
    const second = createEditor()
    const { dialog } = await first.open()
    const { input } = await second.open()
    first.wrapper.vm.closeCommandPalette()
    await flushPromises()
    expect(dialog.isConnected).toBe(false)
    expect(document.activeElement).toBe(input)
    second.wrapper.vm.closeCommandPalette()
    await flushPromises()
    second.expectRestored()
  })

  it('does not restore selection through a newer native composition', async () => {
    const editor = createEditor()
    await editor.open()
    editor.wrapper.vm.closeCommandPalette()
    editor.textarea.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true }),
    )
    await flushPromises()
    expect(document.activeElement).not.toBe(editor.textarea)
    editor.textarea.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true }),
    )
  })
})
