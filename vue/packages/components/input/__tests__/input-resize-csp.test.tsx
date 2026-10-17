import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, test } from 'vitest'
import { ElConfigProvider } from '@element-plus/components/config-provider'
import { ElInput } from '..'
import type { InputProps } from '../src/input'

const resizeValues = ['none', 'both', 'horizontal', 'vertical'] as const
const variants = ['default', 'editor-title'] as const

describe('public Input CSP-safe textarea resize', () => {
  test.each(variants)(
    '%s maps every resize value without inline styles',
    async (textareaVariant) => {
      const wrapper = mount(ElInput, {
        props: {
          type: 'textarea',
          textareaVariant,
          cspSafe: true,
          resize: 'none',
          inputStyle: { resize: 'vertical', width: '12rem' },
          modelValue: 'Comment content',
          showWordLimit: true,
        },
        attrs: { rows: 3, maxlength: 100, style: 'width: 20rem' },
      })
      const textarea = wrapper.get('textarea')

      for (const resize of resizeValues) {
        await wrapper.setProps({ resize })
        expect(
          wrapper.classes().filter((value) => value.includes('--resize-')),
        ).toEqual([`el-textarea--resize-${resize}`])
        expect(wrapper.find('[style]').exists()).toBe(false)
        expect(textarea.element.value).toBe('Comment content')
      }

      await wrapper.setProps({ resize: undefined })
      expect(
        wrapper.classes().some((value) => value.includes('--resize-')),
      ).toBe(false)
      expect(wrapper.find('[style]').exists()).toBe(false)
      wrapper.unmount()
    },
  )

  test.each(variants)(
    '%s preserves resize in disabled and readonly SSR',
    async (textareaVariant) => {
      for (const resize of resizeValues) {
        for (const state of [{}, { disabled: true }, { readonly: true }]) {
          const html = await renderToString(
            h(ElInput, {
              type: 'textarea',
              textareaVariant,
              resize,
              cspSafe: true,
              inputStyle: { height: '20rem' },
              modelValue: 'SSR comment',
              ...state,
            }),
          )
          expect(html).toContain(`el-textarea--resize-${resize}`)
          expect(html).not.toMatch(/\sstyle=/u)
          if ('disabled' in state)
            expect(html).toMatch(/<textarea[^>]* disabled/u)
          if ('readonly' in state)
            expect(html).toMatch(/<textarea[^>]* readonly/u)
        }
      }
    },
  )

  test('updates resize when expanding rows and retains native input events', async () => {
    const wrapper = mount(ElInput, {
      props: {
        type: 'textarea',
        cspSafe: true,
        resize: 'none',
        modelValue: 'draft',
      },
      attrs: { rows: 3, 'aria-label': 'Comment' },
    })
    await wrapper.setProps({
      rows: 12,
      resize: 'horizontal',
    } as Partial<InputProps>)
    const textarea = wrapper.get('textarea')
    expect(textarea.element.rows).toBe(12)
    expect(textarea.attributes('aria-label')).toBe('Comment')
    expect(wrapper.classes()).toContain('el-textarea--resize-horizontal')
    await textarea.setValue('expanded draft')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
      'expanded draft',
    ])
    await wrapper.setProps({ disabled: true, readonly: true })
    expect(textarea.element.disabled).toBe(true)
    expect(textarea.element.readOnly).toBe(true)
    expect(wrapper.classes()).toContain('el-textarea--resize-horizontal')
    expect(wrapper.find('[style]').exists()).toBe(false)
    wrapper.unmount()
  })

  test.each(variants)(
    '%s preserves ordinary inline resize and runtime CSP switching',
    async (textareaVariant) => {
      const wrapper = mount(ElInput, {
        props: { type: 'textarea', textareaVariant },
      })
      const textarea = wrapper.get('textarea')
      for (const resize of resizeValues) {
        await wrapper.setProps({ resize })
        expect(textarea.element.style.resize).toBe(resize)
        expect(
          wrapper.classes().some((value) => value.includes('--resize-')),
        ).toBe(false)
      }
      await wrapper.setProps({ cspSafe: true })
      expect(wrapper.classes()).toContain('el-textarea--resize-vertical')
      expect(wrapper.find('[style]').exists()).toBe(false)
      await wrapper.setProps({ resize: 'none', cspSafe: false })
      expect(textarea.element.style.resize).toBe('none')
      expect(wrapper.classes()).not.toContain('el-textarea--resize-vertical')
      wrapper.unmount()
    },
  )

  test('uses the configured namespace and applies no textarea modifier to text inputs', async () => {
    const wrapper = mount(ElConfigProvider, {
      props: { namespace: 'custom' },
      slots: {
        default: () =>
          h(ElInput, { type: 'textarea', cspSafe: true, resize: 'both' }),
      },
    })
    expect(wrapper.findComponent(ElInput).classes()).toContain(
      'custom-textarea--resize-both',
    )
    wrapper.unmount()
    const text = mount(ElInput, {
      props: { type: 'text', cspSafe: true, resize: 'none' },
    })
    await nextTick()
    expect(text.classes().some((value) => value.includes('--resize-'))).toBe(
      false,
    )
    expect(text.find('[style]').exists()).toBe(false)
    text.unmount()
  })
})
