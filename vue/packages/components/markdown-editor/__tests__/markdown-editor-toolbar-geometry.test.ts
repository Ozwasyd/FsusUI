import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownEditor from '../src/markdown-editor.vue'

describe('MarkdownEditor toolbar overflow geometry (#825)', () => {
  it('keeps the overflow trigger outside primary-command scrolling with the same registry and focus return', async () => {
    const wrapper = mount(MarkdownEditor, {
      attachTo: document.body,
      props: {
        modelValue: 'draft',
        primaryCommandKeys: ['heading', 'link'],
        actionOverflowKeys: ['image'],
        showSaveAction: false,
        showSubmitAction: false,
      },
    })
    try {
      const commands = wrapper.find('.el-markdown-editor__commands')
      const more = wrapper.find('.el-markdown-editor__command-more')
      expect(commands.element.contains(more.element)).toBe(false)
      expect(commands.element.parentElement).toBe(more.element.parentElement)
      expect(commands.findAll('button').map((button) => button.text())).toEqual(
        ['标题', '链接'],
      )
      expect(more.text()).toContain('7')
      expect(more.attributes('aria-expanded')).toBe('false')
      await more.trigger('click')
      const tray = wrapper.find('.el-markdown-editor__command-tray')
      expect(tray.findAll('button')).toHaveLength(7)
      expect(more.attributes('aria-controls')).toBe(tray.attributes('id'))
      expect(more.attributes('aria-expanded')).toBe('true')
      await tray.trigger('keydown', { key: 'Escape' })
      expect(wrapper.find('.el-markdown-editor__command-tray').exists()).toBe(
        false,
      )
      expect(document.activeElement).toBe(more.element)
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      expect(wrapper.emitted('command')).toBeUndefined()
    } finally {
      wrapper.unmount()
    }
  })
})
