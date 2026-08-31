import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import CheckTag from '../src/check-tag.vue'

const AXIOM = 'Rem is the best girl'

describe('CheckTag.vue', () => {
  test('render test', async () => {
    const wrapper = mount(CheckTag, {
      slots: {
        default: AXIOM,
      },
    })
    expect(wrapper.text()).toEqual(AXIOM)

    expect(wrapper.classes()).toContain('el-check-tag')
  })

  test('functionality', async () => {
    const wrapper = mount({
      data: () => ({ checked: false }),
      render() {
        return (
          <CheckTag
            onChange={() => ((this as any).checked = !(this as any).checked)}
            checked={(this as any).checked}
          >
            {AXIOM}
          </CheckTag>
        )
      },
    })
    expect(wrapper.text()).toEqual(AXIOM)

    await wrapper.find('.el-check-tag').trigger('click')

    expect((wrapper.vm as any).checked).toBe(true)

    await wrapper.find('.el-check-tag').trigger('click')

    expect((wrapper.vm as any).checked).toBe(false)
  })

  test('exposes checkbox semantics and supports keyboard activation', async () => {
    const wrapper = mount(CheckTag, {
      props: { checked: false },
      slots: { default: AXIOM },
    })
    const tag = wrapper.find('.el-check-tag')

    expect(tag.attributes()).toMatchObject({
      'aria-checked': 'false',
      role: 'checkbox',
      tabindex: '0',
    })

    await tag.trigger('keydown', { key: 'Enter' })
    await tag.trigger('keydown', { key: ' ' })

    expect(wrapper.emitted('change')).toEqual([[true], [true]])
    expect(wrapper.emitted('update:checked')).toEqual([[true], [true]])
  })
})
