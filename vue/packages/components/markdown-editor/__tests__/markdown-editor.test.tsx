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

  it('keeps secondary commands inside an expandable overflow menu', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        modelValue: 'initial',
      },
    })

    const more = wrapper.find('.el-markdown-editor__command-more')
    expect(more.exists()).toBe(true)
    expect(more.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.el-markdown-editor__command-tray').exists()).toBe(
      false,
    )

    await more.trigger('click')
    expect(more.attributes('aria-expanded')).toBe('true')
    expect(
      wrapper
        .find('.el-markdown-editor__command-tray')
        .findAll('.el-markdown-editor__command'),
    ).toHaveLength(1)

    await wrapper
      .find('.el-markdown-editor__command-tray .el-markdown-editor__command')
      .trigger('click')
    expect(wrapper.emitted('command')?.[0]?.[0]).toEqual(
      expect.objectContaining({ key: 'image' }),
    )
    expect(wrapper.find('.el-markdown-editor__command-tray').exists()).toBe(false)
  })

  it('lets consumers choose primary commands and compact mobile behavior', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        commandOverflowLabel: '更多格式',
        defaultMode: 'split',
        mobileLayout: 'compact',
        modelValue: 'initial',
        primaryCommandKeys: ['heading', 'link'],
      },
    })

    expect(wrapper.classes()).toContain('el-markdown-editor--mobile-compact')
    expect(wrapper.classes()).toContain('el-markdown-editor--write')
    expect(
      wrapper
        .findAll('.el-markdown-editor__commands > .el-markdown-editor__command')
        .map((item) => item.text()),
    ).toEqual(['H', 'Link'])

    const more = wrapper.find('.el-markdown-editor__command-more')
    expect(more.text()).toContain('更多格式')
    expect(more.text()).toContain('5')
    expect(more.attributes('aria-label')).toContain('更多格式')
    expect(
      wrapper.findAll('.el-markdown-editor__mode').map((item) => item.text()),
    ).toEqual(['编写', '预览'])

    await more.trigger('click')
    const tray = wrapper.find('.el-markdown-editor__command-tray')
    expect(more.attributes('aria-controls')).toBe(tray.attributes('id'))
    expect(tray.findAll('.el-markdown-editor__command')).toHaveLength(5)
  })

  it('can move selected actions into the command overflow tray', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        actionOverflowKeys: ['image'],
        modelValue: 'draft',
        showSaveAction: false,
        showSubmitAction: false,
      },
    })

    expect(wrapper.find('.el-markdown-editor__actions').exists()).toBe(false)

    const more = wrapper.find('.el-markdown-editor__command-more')
    expect(more.exists()).toBe(true)
    expect(more.text()).toContain('2')

    await more.trigger('click')
    const trayButtons = wrapper
      .find('.el-markdown-editor__command-tray')
      .findAll('.el-markdown-editor__command')
    expect(trayButtons.map((button) => button.text())).toContain('上传图片')

    const uploadButton = trayButtons.find(
      (button) => button.text() === '上传图片',
    )
    if (!uploadButton) throw new Error('missing upload action in command tray')

    await uploadButton.trigger('click')
    expect(wrapper.emitted('upload-image')).toHaveLength(1)
    expect(wrapper.find('.el-markdown-editor__command-tray').exists()).toBe(
      false,
    )
  })

  it('exposes prose writing and interaction profiles without changing legacy defaults', () => {
    const defaultWrapper = mount(MarkdownEditor, {
      props: {
        modelValue: '',
      },
    })

    expect(defaultWrapper.classes()).toContain(
      'el-markdown-editor--profile-markdown',
    )
    expect(defaultWrapper.classes()).toContain(
      'el-markdown-editor--interaction-auto',
    )

    const proseWrapper = mount(MarkdownEditor, {
      props: {
        editorProfile: 'prose',
        interactionProfile: 'touch',
        modelValue: '',
        placeholder: 'fallback placeholder',
        writingPlaceholder: '写下正文，慢慢展开。',
      },
    })

    expect(proseWrapper.classes()).toContain(
      'el-markdown-editor--profile-prose',
    )
    expect(proseWrapper.classes()).toContain(
      'el-markdown-editor--interaction-touch',
    )
    expect(proseWrapper.find('textarea').attributes('placeholder')).toBe(
      '写下正文，慢慢展开。',
    )
  })

  it('continues and exits markdown structures from the keyboard', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        editorProfile: 'prose',
        modelValue: '- 第一段',
      },
    })
    const textarea = wrapper.find('textarea')

    const listLineEnd = '- 第一段'.length
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(
      listLineEnd,
      listLineEnd,
    )
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['- 第一段\n- '])

    await wrapper.setProps({ modelValue: '- ' })
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(2, 2)
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([''])
  })

  it('indents and outdents selected lines from the keyboard', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        editorProfile: 'prose',
        interactionProfile: 'keyboard',
        modelValue: '第一行\n第二行',
      },
    })
    const textarea = wrapper.find('textarea')

    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(0, 7)
    await textarea.trigger('keydown', { key: 'Tab' })
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      '  第一行\n  第二行',
    ])

    await wrapper.setProps({ modelValue: '  第一行\n  第二行' })
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(0, 11)
    await textarea.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual(['第一行\n第二行'])
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
    expect(wrapper.find('[data-stub-markdown-renderer]').classes()).toContain(
      'el-markdown-editor__preview',
    )
    expect(
      wrapper.findAll('.el-markdown-editor__action').map((item) => item.text()),
    ).toEqual(['上传图片', '保存', '提交'])
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

  it('supports controlled mode, action visibility, disabled state, and cursor insertion', async () => {
    const wrapper = mount(MarkdownEditor, {
      props: {
        disabled: true,
        mode: 'preview',
        modelValue: 'initial',
        showActions: false,
        showModeSwitcher: false,
        textareaId: 'markdown-body',
        textareaName: 'body',
      },
      global: {
        stubs: {
          ElMarkdownRenderer: {
            template: '<div data-stub-markdown-renderer></div>',
            props: ['content'],
          },
        },
      },
    })

    expect(wrapper.find('.el-markdown-editor--preview').exists()).toBe(true)
    expect(wrapper.find('.el-markdown-editor__actions').exists()).toBe(false)
    expect(wrapper.find('.el-markdown-editor__modes').exists()).toBe(false)

    await wrapper.setProps({ mode: 'write' })
    const textarea = wrapper.find('textarea')
    expect(textarea.attributes('id')).toBe('markdown-body')
    expect(textarea.attributes('name')).toBe('body')
    expect(textarea.attributes('disabled')).toBeDefined()
    expect(wrapper.vm.insertMarkdownAtCursor(' ignored')).toBe(false)

    await wrapper.setProps({ disabled: false })
    ;(textarea.element as HTMLTextAreaElement).setSelectionRange(7, 7)
    expect(wrapper.vm.insertMarkdownAtCursor(' text')).toBe(true)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['initial text'])
  })
})
