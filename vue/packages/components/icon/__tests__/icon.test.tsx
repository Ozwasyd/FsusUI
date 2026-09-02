import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import Icon from '../src/icon.vue'

describe('Icon.vue', () => {
  test('render', () => {
    const wrapper = mount(() => <Icon color="#000000" size={18} />)
    expect(wrapper.element.getAttribute('style')).toContain(`--color: #000000`)
    expect(wrapper.element.getAttribute('style')).toContain(`font-size: 18px`)
  })

  test('omits the style attribute entirely when size and color are absent', async () => {
    // SSR serializes a present style binding as `style=""` even for an empty
    // object, which violates `style-src-attr 'none'` CSP policies.
    const html = await renderToString(createSSRApp({ render: () => h(Icon, null, () => 'icon') }))
    expect(html).not.toContain('style=')

    const wrapper = mount(() => (
      <Icon>
        icon
      </Icon>
    ))
    expect(wrapper.element.hasAttribute('style')).toBe(false)
  })

  test('scopes line icon geometry only through the explicit variant', () => {
    const inherited = mount(() => (
      <Icon>
        <svg />
      </Icon>
    ))
    const linear = mount(() => (
      <Icon variant="linear">
        <svg />
      </Icon>
    ))

    expect(inherited.classes()).not.toContain('is-linear')
    expect(linear.classes()).toContain('is-linear')
  })
})
