import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ElConfigProvider } from '@element-plus/components/config-provider'
import en from '@element-plus/locale/lang/en'
import fr from '@element-plus/locale/lang/fr'
import zhCn from '@element-plus/locale/lang/zh-cn'
import type { Language } from '@element-plus/locale'
import MarkdownEditor from '../src/markdown-editor.vue'

describe('ElMarkdownEditor ElConfigProvider / useLocale integration (#1132)', () => {
  it('resolves English defaults when wrapped in <ElConfigProvider :locale="en"> and switches reactively to zhCn and fr', async () => {
    const activeLocale = ref<Language>(en)
    const Host = defineComponent({
      setup() {
        return () => (
          <ElConfigProvider locale={activeLocale.value}>
            <MarkdownEditor
              modelValue={'| A | B |\n| --- | --- |\n| 1 | 2 |\n'}
              showSaveAction
              showSubmitAction
              showImageAction
              surfaces={{ commandPalette: true }}
              toolbarDensity="standard"
            />
          </ElConfigProvider>
        )
      },
    })

    const wrapper = mount(Host, { attachTo: document.body })
    try {
      await nextTick()

      expect(
        wrapper.findAll('[role="tab"]').map((item) => item.text()),
      ).toEqual(['Source', 'Live', 'Split', 'Preview'])
      expect(
        wrapper.findAll('.el-markdown-editor__command').map((b) => b.text()),
      ).toEqual(['Bold', 'Italic', 'Heading', 'Quote', 'Code', 'Link'])
      expect(wrapper.find('.el-markdown-editor__command-more').text()).toContain(
        'Format tools',
      )
      expect(
        wrapper
          .findAll('.el-markdown-editor__action')
          .map((item) => item.text()),
      ).toEqual(['Upload image', 'Save', 'Submit'])
      expect(wrapper.find('[aria-label="Markdown editor"]').exists()).toBe(true)

      // Open search bar and command palette to verify English chrome
      const textarea = wrapper.get('textarea')
      await textarea.trigger('keydown', { ctrlKey: true, key: 'f' })
      await nextTick()
      expect(wrapper.find('input[placeholder="Find"]').exists()).toBe(true)
      expect(wrapper.find('button[aria-label="Match case"]').exists()).toBe(true)

      ;(
        wrapper.findComponent(MarkdownEditor).vm as unknown as {
          openCommandPalette: () => void
        }
      ).openCommandPalette()
      await nextTick()
      expect(
        document.body.querySelector('input[placeholder="Search commands"]'),
      ).not.toBeNull()

      // Select table cell to verify table action label
      ;(textarea.element as HTMLTextAreaElement).setSelectionRange(2, 2)
      await textarea.trigger('select')
      await nextTick()
      expect(
        wrapper.find('button[aria-label="Table actions"]').exists(),
      ).toBe(true)

      // Switch reactively to zh-cn
      activeLocale.value = zhCn
      await nextTick()

      expect(
        wrapper.findAll('[role="tab"]').map((item) => item.text()),
      ).toEqual(['源码', '实时', '分屏', '预览'])
      expect(
        wrapper.findAll('.el-markdown-editor__command').map((b) => b.text()),
      ).toEqual(['加粗', '斜体', '标题', '引用', '代码', '链接'])
      expect(wrapper.find('.el-markdown-editor__command-more').text()).toContain(
        '格式工具',
      )
      expect(
        wrapper
          .findAll('.el-markdown-editor__action')
          .map((item) => item.text()),
      ).toEqual(['上传图片', '保存', '提交'])
      expect(wrapper.find('input[placeholder="查找"]').exists()).toBe(true)
      expect(wrapper.find('button[aria-label="区分大小写"]').exists()).toBe(true)
      expect(
        document.body.querySelector('input[placeholder="搜索命令"]'),
      ).not.toBeNull()
      expect(wrapper.find('button[aria-label="表格操作"]').exists()).toBe(true)

      // Switch to a locale without el.markdownEditor (fr): falls back per key to English, never Chinese
      activeLocale.value = fr
      await nextTick()

      expect(
        wrapper.findAll('[role="tab"]').map((item) => item.text()),
      ).toEqual(['Source', 'Live', 'Split', 'Preview'])
      expect(
        wrapper.findAll('.el-markdown-editor__command').map((b) => b.text()),
      ).toEqual(['Bold', 'Italic', 'Heading', 'Quote', 'Code', 'Link'])
      expect(
        wrapper.find('button[aria-label="Table actions"]').exists(),
      ).toBe(true)
    } finally {
      wrapper.unmount()
    }
  })

  it('preserves localeText prop overrides on top of active ElConfigProvider locale and keeps partial custom languages intact', async () => {
    const customLocale: Language = {
      name: 'custom-en',
      el: {
        ...en.el,
        markdownEditor: {
          modes: {
            source: 'Raw',
            live: '',
          },
          overflow: 'Tools',
        },
      },
    }

    const Host = defineComponent({
      setup() {
        return () => (
          <ElConfigProvider locale={customLocale}>
            <MarkdownEditor
              modelValue="hello"
              localeText={{
                modes: { preview: 'Read' },
                commands: { bold: 'Strong' },
              }}
              toolbarDensity="standard"
            />
          </ElConfigProvider>
        )
      },
    })

    const wrapper = mount(Host)
    await nextTick()

    expect(
      wrapper.findAll('[role="tab"]').map((item) => item.text()),
    ).toEqual(['Raw', '', 'Split', 'Read'])
    expect(
      wrapper.findAll('.el-markdown-editor__command').map((b) => b.text()),
    ).toEqual(['Strong', 'Italic', 'Heading', 'Quote', 'Code', 'Link'])
    expect(wrapper.find('.el-markdown-editor__command-more').text()).toContain(
      'Tools',
    )
  })

  it('merges localeText overrides on top of zhCn provider without losing other zhCn strings', async () => {
    const Host = defineComponent({
      setup() {
        return () => (
          <ElConfigProvider locale={zhCn}>
            <MarkdownEditor
              modelValue="hello"
              localeText={{
                commands: { bold: '粗体' },
              }}
            />
          </ElConfigProvider>
        )
      },
    })

    const wrapper = mount(Host)
    await nextTick()

    expect(
      wrapper.findAll('[role="tab"]').map((item) => item.text()),
    ).toEqual(['源码', '实时', '分屏', '预览'])
    expect(
      wrapper.findAll('.el-markdown-editor__command').map((b) => b.text()),
    ).toEqual(['粗体', '斜体', '标题', '引用', '代码', '链接'])
  })
})
