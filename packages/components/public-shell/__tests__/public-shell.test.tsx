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

  test('renders mobile primary actions beside brand while preserving legacy mobile actions', () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        showSearch: false,
      },
      slots: {
        'mobile-primary-actions': '<button data-test="mobile-primary">Search</button>',
        'mobile-actions': '<button data-test="legacy-mobile">Legacy</button>',
      },
    })

    const primaryRow = wrapper.find('.el-public-shell__primary-row')
    const mobilePrimaryActions = primaryRow.find(
      '.el-public-shell__mobile-primary-actions',
    )
    const mobileToolbar = wrapper.find('.el-public-shell__mobile-toolbar')

    expect(mobilePrimaryActions.exists()).toBe(true)
    expect(mobilePrimaryActions.find('[data-test="mobile-primary"]').exists()).toBe(
      true,
    )
    expect(mobileToolbar.find('.el-public-shell__mobile-nav').exists()).toBe(true)
    expect(mobileToolbar.find('.el-public-shell__mobile-actions').exists()).toBe(
      true,
    )
    expect(mobileToolbar.find('[data-test="legacy-mobile"]').exists()).toBe(true)
    expect(mobileToolbar.find('[data-test="mobile-primary"]').exists()).toBe(
      false,
    )

    const primaryChildren = primaryRow.element.children
    expect(primaryChildren[0]?.classList.contains('el-public-shell__brand-nav')).toBe(
      true,
    )
    expect(primaryChildren[1]?.classList.contains('el-public-shell__actions')).toBe(
      true,
    )
    expect(
      primaryChildren[2]?.classList.contains(
        'el-public-shell__mobile-primary-actions',
      ),
    ).toBe(true)
  })
})
