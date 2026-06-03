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
        .exists(),
    ).toBe(true)
  })

  test('exposes layout invariants through public css variables', () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        maxWidth: '72rem',
        mobileNavGap: '1rem',
        mobileSearchWidth: '8rem',
        navGap: '2.5rem',
      },
    })

    const style = wrapper.attributes('style')
    expect(style).toContain('--el-public-shell-max-width: 72rem')
    expect(style).toContain('--el-public-shell-nav-gap: 2.5rem')
    expect(style).toContain('--el-public-shell-mobile-nav-gap: 1rem')
    expect(style).toContain('--el-public-shell-mobile-search-width: 8rem')
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
