import { mount } from '@vue/test-utils'
import { describe, expect, expectTypeOf, test } from 'vitest'
import { ElTag, tagProps } from '../index'
import type { TagProps } from '../index'

const label = '状态 APIv2-' + 'UnbrokenCategory'.repeat(16)

describe('ElTag public multiline mode', () => {
  test('typed opt-in defaults to false and preserves the direct default slot', () => {
    expectTypeOf<TagProps['multiline']>().toEqualTypeOf<boolean>()
    const wrapper = mount(ElTag, { slots: { default: label } })
    expect(wrapper.props('multiline')).toBe(false)
    expect(tagProps.multiline).toBe(Boolean)
    expect(wrapper.classes()).not.toContain('is-multiline')
    expect(wrapper.find('.el-tag__content').exists()).toBe(false)
    expect(wrapper.text()).toBe(label)
  })

  test.each([true, false])(
    'full slot and existing props with disableTransitions=%s',
    (disableTransitions) => {
      const wrapper = mount(ElTag, {
        props: {
          multiline: true,
          disableTransitions,
          type: 'danger',
          effect: 'plain',
          size: 'small',
          round: true,
          hit: true,
          color: 'rgb(1, 2, 3)',
          motion: false,
        },
        slots: { default: () => <span dir="rtl">{label}</span> },
        attrs: { 'aria-label': 'Category', 'data-consumer': 'tag' },
      })
      expect(wrapper.classes()).toEqual(
        expect.arrayContaining([
          'is-multiline',
          'el-tag--danger',
          'el-tag--plain',
          'el-tag--small',
          'is-round',
          'is-hit',
        ]),
      )
      expect(wrapper.get('.el-tag__content').text()).toBe(label)
      expect(wrapper.get('[dir="rtl"]').text()).toBe(label)
      expect(wrapper.attributes('aria-label')).toBe('Category')
      expect(wrapper.attributes('data-consumer')).toBe('tag')
      expect(wrapper.attributes('data-fsus-motion-disabled')).toBe('true')
      expect(wrapper.element.style.backgroundColor).toBe('rgb(1, 2, 3)')
    },
  )

  test.each([true, false])(
    'close is native, described and isolated with disableTransitions=%s',
    async (disableTransitions) => {
      const wrapper = mount(ElTag, {
        props: { multiline: true, closable: true, disableTransitions },
        slots: { default: label },
      })
      const button = wrapper.get('button')
      expect(button.attributes('type')).toBe('button')
      expect(button.attributes('aria-label')).toBeTruthy()
      expect(button.attributes('aria-describedby')).toBe(
        wrapper.get('.el-tag__content').attributes('id'),
      )
      expect(button.get('[aria-hidden="true"]').find('.el-icon').exists()).toBe(
        true,
      )
      await button.trigger('click')
      expect(wrapper.emitted('close')).toHaveLength(1)
      expect(wrapper.emitted('close')?.[0][0]).toBeInstanceOf(MouseEvent)
      expect(wrapper.emitted('click')).toBeUndefined()
      await wrapper.get('.el-tag__content').trigger('click')
      expect(wrapper.emitted('click')).toHaveLength(1)
    },
  )

  test('default closable DOM and propagation stay compatible', async () => {
    const wrapper = mount(ElTag, {
      props: { closable: true },
      slots: { default: label },
    })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('.el-tag__content').exists()).toBe(false)
    await wrapper.get('.el-tag__close').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  test('can toggle mode without losing slot or close handler', async () => {
    const wrapper = mount(ElTag, {
      props: { multiline: true, closable: true },
      slots: { default: label },
    })
    await wrapper.setProps({ multiline: false })
    expect(wrapper.classes()).not.toContain('is-multiline')
    expect(wrapper.find('.el-tag__content').exists()).toBe(false)
    expect(wrapper.text()).toBe(label)
    await wrapper.setProps({ multiline: true })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
