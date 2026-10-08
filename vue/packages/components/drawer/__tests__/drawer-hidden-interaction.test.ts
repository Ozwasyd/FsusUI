import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { rAF } from '@element-plus/test-utils/tick'
import Drawer from '../src/drawer.vue'

describe('Drawer retained content interaction', () => {
  test('hides retained content from interaction and accessibility when closing', async () => {
    const wrapper = mount(Drawer, {
      props: { modelValue: false, direction: 'ltr', size: 'min(86vw, 22rem)' },
      slots: { default: '<a href="#profile">Account profile</a>' },
    })
    const panel = wrapper.get('[role="dialog"]')
    expect(panel.attributes('inert')).toBeDefined()
    expect(panel.attributes('aria-hidden')).toBe('true')

    await wrapper.setProps({ modelValue: true })
    await nextTick()
    await rAF()
    expect(panel.attributes('inert')).toBeUndefined()
    expect(panel.attributes('aria-hidden')).toBeUndefined()
    const link = wrapper.get('a').element

    await wrapper.setProps({ modelValue: false })
    expect(panel.attributes('inert')).toBeDefined()
    expect(panel.attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('a').element).toBe(link)

    await wrapper.setProps({ modelValue: true })
    await nextTick()
    await rAF()
    expect(panel.attributes('inert')).toBeUndefined()
    expect(panel.attributes('aria-hidden')).toBeUndefined()
    expect(wrapper.get('a').element).toBe(link)
    wrapper.unmount()
  })

  test('before-close cancellation keeps the drawer interactive', async () => {
    const wrapper = mount(Drawer, {
      props: { modelValue: true, beforeClose: (done) => done(true) },
    })
    await nextTick()
    await rAF()
    await wrapper.get('button').trigger('click')
    expect(wrapper.get('[role="dialog"]').attributes('inert')).toBeUndefined()
    expect(
      wrapper.get('[role="dialog"]').attributes('aria-hidden'),
    ).toBeUndefined()
    wrapper.unmount()
  })
})
