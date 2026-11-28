import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import MarkdownEditor from '../src/markdown-editor.vue'

// DOM events cover the legacy guard; trusted Chromium coverage has its own spec.
describe('MarkdownEditor command-palette Enter', () => {
  const createFixture = async () => {
    const run = vi.fn(() => ({ focus: 'none' as const }))
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: {
        modelValue: 'Original source',
        commands: [
          {
            key: 'confirm-witness',
            label: 'Confirm command',
            group: 'custom',
            presentation: ['palette'],
            run,
          },
        ],
        surfaces: { commandPalette: true },
      },
    })
    wrapper.vm.openCommandPalette()
    await nextTick()
    const input = document.querySelector<HTMLInputElement>(
      'input[role="combobox"]',
    )
    expect(input).not.toBeNull()
    return { wrapper, run, input: input! }
  }

  it.each([
    { name: 'composing', isComposing: true, keyCode: 13 },
    { name: 'legacy IME sentinel', isComposing: false, keyCode: 229 },
  ])(
    'leaves $name Enter to the input method, then confirms once',
    async (state) => {
      const { wrapper, run, input } = await createFixture()
      try {
        const composing = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
          isComposing: state.isComposing,
          keyCode: state.keyCode,
        })
        input.dispatchEvent(composing)
        await flushPromises()
        expect(run).not.toHaveBeenCalled()
        expect(composing.defaultPrevented).toBe(false)
        expect(document.querySelector('[role="dialog"]')).not.toBeNull()
        expect(wrapper.emitted('update:modelValue')).toBeUndefined()

        const confirm = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
          isComposing: false,
          keyCode: 13,
        })
        input.dispatchEvent(confirm)
        await flushPromises()
        expect(run).toHaveBeenCalledTimes(1)
        expect(confirm.defaultPrevented).toBe(true)
        expect(document.querySelector('[role="dialog"]')).toBeNull()
        expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      } finally {
        wrapper.unmount()
      }
    },
  )

  it('retains ordinary Enter default prevention and one command execution', async () => {
    const { wrapper, run, input } = await createFixture()
    try {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
      input.dispatchEvent(event)
      await flushPromises()
      expect(run).toHaveBeenCalledTimes(1)
      expect(event.defaultPrevented).toBe(true)
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    } finally {
      wrapper.unmount()
    }
  })
})
