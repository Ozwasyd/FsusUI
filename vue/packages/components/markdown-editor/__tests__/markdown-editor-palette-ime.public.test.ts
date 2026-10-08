import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { ElMarkdownEditor } from '../../../element-plus'
import type { MarkdownEditorCommand } from '../../../element-plus'

const source = 'IME command boundary'

const open = async () => {
  const run = vi.fn<MarkdownEditorCommand['run']>((context) => ({
    transaction: {
      changes: [
        {
          from: context.selection.start,
          to: context.selection.end,
          insert: 'TOKEN',
        },
      ],
      history: 'separate',
      origin: 'command',
    },
  }))
  const command: MarkdownEditorCommand = {
    key: 'insert-token',
    label: 'Insert token',
    group: 'insert',
    presentation: ['palette'],
    run,
  }
  const wrapper = mount(ElMarkdownEditor, {
    attachTo: document.body,
    props: {
      modelValue: source,
      commands: [command],
      surfaces: { commandPalette: true },
    },
  })
  wrapper.vm.openCommandPalette()
  await nextTick()
  const input = document.body.querySelector<HTMLInputElement>(
    '.el-markdown-editor__palette-input',
  )!
  expect(document.activeElement).toBe(input)
  return { wrapper, input, run, command }
}

describe('public palette native IME Enter boundary', () => {
  it.each([
    { isComposing: true },
    { keyCode: 229 },
    { isComposing: true, keyCode: 229 },
  ])('leaves native composing Enter unclaimed for %j', async (options) => {
    const { wrapper, input, run } = await open()
    input.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true, data: '查' }),
    )
    const event = new KeyboardEvent('keydown', {
      ...options,
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(false)
    expect(run).not.toHaveBeenCalled()
    expect(
      document.body.querySelector('.el-markdown-editor__palette-dialog'),
    ).not.toBeNull()
    expect(wrapper.emitted('command')).toBeUndefined()
    expect(wrapper.emitted('transaction')).toBeUndefined()
    expect(wrapper.get('textarea').element.value).toBe(source)
  })

  it('uses existing editor composition state even when the key event has no native flag', async () => {
    const { wrapper, input, run } = await open()
    await wrapper.get('textarea').trigger('compositionstart')
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(false)
    expect(run).not.toHaveBeenCalled()
    expect(
      document.body.querySelector('.el-markdown-editor__palette-dialog'),
    ).not.toBeNull()
    await wrapper.get('textarea').trigger('compositionend', { data: '' })
  })

  it('executes one normal Enter after composition ends', async () => {
    const { wrapper, input, run } = await open()
    input.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true, data: '查' }),
    )
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        keyCode: 229,
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()
    expect(run).not.toHaveBeenCalled()
    input.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, data: '' }),
    )
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('command')).toHaveLength(1)
    expect(
      document.body.querySelector('.el-markdown-editor__palette-dialog'),
    ).toBeNull()
    expect(wrapper.get('textarea').element.value).toBe(`${source}TOKEN`)
  })

  it('keeps Escape cancellation and body focus without a command', async () => {
    const { wrapper, input, run } = await open()
    input.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true, data: '查' }),
    )
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    )
    input.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true, data: '' }),
    )
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()
    expect(run).not.toHaveBeenCalled()
    expect(
      document.body.querySelector('.el-markdown-editor__palette-dialog'),
    ).toBeNull()
    expect(document.activeElement).toBe(wrapper.get('textarea').element)
    expect(wrapper.get('textarea').element.value).toBe(source)
  })

  it('retains command eligibility for ordinary Enter after permission changes', async () => {
    const { wrapper, input, run } = await open()
    await wrapper.setProps({ readonly: true })
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()
    expect(run).not.toHaveBeenCalled()
    expect(
      document.body.querySelector('.el-markdown-editor__palette-dialog'),
    ).not.toBeNull()
    expect(wrapper.get('textarea').element.value).toBe(source)
  })

  it('retains arrow navigation past disabled commands before ordinary Enter', async () => {
    const { wrapper, input, run, command } = await open()
    const nextRun = vi.fn<MarkdownEditorCommand['run']>(() => ({}))
    await wrapper.setProps({
      commands: [
        { ...command, keywords: ['arrow-probe'], priority: 3 },
        {
          ...command,
          key: 'disabled-token',
          label: 'Token disabled',
          enabled: () => false,
          keywords: ['arrow-probe'],
          priority: 2,
        },
        {
          ...command,
          key: 'next-token',
          label: 'Token next',
          run: nextRun,
          keywords: ['arrow-probe'],
          priority: 1,
        },
      ],
    })
    input.value = 'arrow-probe'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    const activeLabel = () =>
      document.getElementById(input.getAttribute('aria-activedescendant')!)
        ?.textContent
    expect(activeLabel()).toContain('Insert token')
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    )
    await nextTick()
    expect(activeLabel()).toContain('Token next')
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    )
    await nextTick()
    expect(activeLabel()).toContain('Insert token')
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      }),
    )
    await flushPromises()
    expect(run).toHaveBeenCalledTimes(1)
    expect(nextRun).not.toHaveBeenCalled()
    expect(wrapper.get('textarea').element.value).toBe(`${source}TOKEN`)
  })
})
