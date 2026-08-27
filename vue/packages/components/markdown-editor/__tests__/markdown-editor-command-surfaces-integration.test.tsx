import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import MarkdownEditor from '../src/markdown-editor.vue'

import type { MarkdownEditorCommand } from '../src/markdown-editor'

const insertCommand: MarkdownEditorCommand = {
  group: 'insert',
  key: 'insert-token',
  keywords: ['token-alias'],
  label: 'Insert token',
  presentation: ['palette', 'selection', 'slash'],
  run: (context) => ({
    transaction: {
      changes: [
        {
          from: context.selection.start,
          insert: 'TOKEN',
          to: context.selection.end,
        },
      ],
      history: 'separate',
      origin: 'command',
    },
  }),
}

describe('Markdown editor command surface integration', () => {
  it('commits a slash command and removes its trigger in one revision', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        commands: [insertCommand],
        modelValue: '/insert',
        surfaces: { slashMenu: true },
      },
    })

    await wrapper.find('.el-markdown-editor__slash-menu button').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')?.map(([value]) => value)).toEqual([
      'TOKEN',
    ])
    expect(wrapper.emitted('command')).toHaveLength(1)
  })

  it('dismisses slash and selection surfaces on Escape without changing source', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        commands: [insertCommand],
        modelValue: '/insert',
        surfaces: { selectionToolbar: true, slashMenu: true },
      },
    })

    const slash = wrapper.find('.el-markdown-editor__slash-menu')
    expect(slash.exists()).toBe(true)
    await slash.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.el-markdown-editor__slash-menu').exists()).toBe(false)

    const textarea = wrapper.find('textarea')
    const element = textarea.element as HTMLTextAreaElement
    element.setSelectionRange(0, 2)
    await textarea.trigger('select')
    await nextTick()
    const selection = wrapper.find('.el-markdown-editor__selection-toolbar')
    expect(selection.exists()).toBe(true)
    await selection.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.el-markdown-editor__selection-toolbar').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('uses locale copy and keyword search for the command palette', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        commands: [insertCommand],
        localeText: {
          commandPalette: {
            searchPlaceholder: '查找命令',
            title: '命令面板',
          },
        },
        modelValue: '',
        surfaces: { commandPalette: true },
      },
    })

    ;(wrapper.vm as unknown as { openCommandPalette: () => void }).openCommandPalette()
    await nextTick()
    const dialog = document.body.querySelector(
      '.el-markdown-editor__palette-dialog',
    ) as HTMLElement
    expect(dialog.getAttribute('aria-label')).toBe('命令面板')
    const input = document.body.querySelector(
      '.el-markdown-editor__palette-input',
    ) as HTMLInputElement
    expect(input.placeholder).toBe('查找命令')
    input.value = 'token-alias'
    input.dispatchEvent(new Event('input'))
    await nextTick()
    expect(
      document.body.querySelectorAll('.el-markdown-editor__palette-item'),
    ).toHaveLength(1)
  })
})
