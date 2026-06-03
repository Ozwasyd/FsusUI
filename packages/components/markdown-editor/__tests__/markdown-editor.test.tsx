import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownEditor from '../src/markdown-editor.vue'
import {
  applyMarkdownEditorCommand,
  defaultMarkdownEditorCommands,
} from '../src/markdown-editor'

describe('MarkdownEditor', () => {
  it('applies built-in selection commands through public primitives', () => {
    const bold = defaultMarkdownEditorCommands.find(
      (item) => item.key === 'bold',
    )
    if (!bold) throw new Error('missing bold command')

    expect(
      applyMarkdownEditorCommand('write markdown', { start: 6, end: 14 }, bold),
    ).toEqual({
      nextSelection: { start: 8, end: 16 },
      value: 'write **markdown**',
    })
  })

  it('emits value, mode, and command events', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'initial',
      },
    })
    const textarea = wrapper.find('textarea')

    await textarea.setValue('updated')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['updated'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['updated'])

    await wrapper.find('[role="tab"][aria-selected="false"]').trigger('click')
    expect(wrapper.emitted('mode-change')).toBeTruthy()

    await wrapper.find('.el-markdown-editor__command').trigger('click')
    expect(wrapper.emitted('command')?.[0]?.[0]).toEqual(
      expect.objectContaining({ key: 'bold' }),
    )
  })

  it('exposes save, submit, upload, and preview shell events', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        defaultMode: 'preview',
        modelValue: '# Preview',
      },
      global: {
        stubs: {
          ElMarkdownRenderer: {
            emits: ['features-activated', 'render-complete', 'render-error'],
            template:
              '<div data-stub-markdown-renderer @click="$emit(\'render-complete\', { html: content })"></div>',
            props: ['content'],
          },
        },
      },
    })

    await wrapper.find('[data-stub-markdown-renderer]').trigger('click')
    await wrapper.findAll('.el-markdown-editor__action')[0].trigger('click')
    await wrapper.findAll('.el-markdown-editor__action')[1].trigger('click')
    await wrapper.findAll('.el-markdown-editor__action')[2].trigger('click')

    expect(wrapper.emitted('render-complete')?.[0]?.[0]).toEqual({
      html: '# Preview',
    })
    expect(wrapper.emitted('upload-image')).toHaveLength(1)
    expect(wrapper.emitted('save')?.[0]).toEqual(['# Preview'])
    expect(wrapper.emitted('submit')?.[0]).toEqual(['# Preview'])
  })
})
