import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, test, vi } from 'vitest'
import PublicShell from '../src/public-shell.vue'

const navItems = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'archive', label: 'Archive', href: '/archive' },
]

describe('PublicShell.vue', () => {
  test('renders SSR-stable desktop and mobile navigation', () => {
    const wrapper = mount(() => (
      <PublicShell brand="Fsus" navItems={navItems} activeNav="archive" />
    ))

    expect(wrapper.find('.el-public-shell__desktop-nav').exists()).toBe(true)
    expect(wrapper.find('.el-public-shell__mobile-nav').exists()).toBe(true)
    expect(
      wrapper
        .find('.el-public-shell__nav-link.is-active[data-public-nav="archive"]')
        .exists()
    ).toBe(true)
  })

  test('emits spa search without native navigation', async () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        spaSearch: true,
        searchQuery: 'layout',
      },
    })
    const event = new Event('submit', { cancelable: true })
    const preventDefault = vi.spyOn(event, 'preventDefault')

    wrapper.find('form').element.dispatchEvent(event)
    await nextTick()

    expect(preventDefault).toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('search')?.[0]).toEqual(['layout'])
  })
})
