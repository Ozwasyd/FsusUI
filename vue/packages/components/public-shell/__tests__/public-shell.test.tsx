import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, test, vi } from 'vitest'
import PublicShell from '../src/public-shell.vue'

const navItems = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'archive', label: 'Archive', href: '/archive' },
]

describe('PublicShell.vue', () => {
  test('renders SSR-stable desktop navigation and mobile bottom tabs', () => {
    const wrapper = mount(() => (
      <PublicShell brand="Fsus" navItems={navItems} activeNav="archive" />
    ))

    expect(wrapper.findComponent({ name: 'ElSiteHeader' }).exists()).toBe(true)
    expect(
      wrapper.find('.el-site-header.el-public-shell__header').exists(),
    ).toBe(true)
    expect(wrapper.find('.el-public-shell__desktop-nav').exists()).toBe(true)
    expect(wrapper.find('.el-public-shell__mobile-nav').exists()).toBe(false)
    expect(wrapper.find('[data-fsus-bottom-tab-bar]').exists()).toBe(true)
    expect(
      wrapper
        .find('.el-public-shell__nav-link.is-active[data-public-nav="archive"]')
        .exists(),
    ).toBe(true)
    expect(
      wrapper
        .find('[data-fsus-bottom-tab-item="archive"].is-active')
        .attributes('aria-current'),
    ).toBe('page')
    expect(
      wrapper.find('.el-public-shell__active-nav-indicator').exists(),
    ).toBe(false)
  })

  test('renders opt-in semantic active nav indicator for desktop while bottom tabs track active key', async () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        activeNav: 'home',
        activeNavMotion: 'indicator',
      },
    })

    const indicators = wrapper.findAll('.el-public-shell__active-nav-indicator')
    expect(indicators).toHaveLength(1)
    expect(
      wrapper
        .find('.el-public-shell__desktop-nav.is-indicator-motion')
        .exists(),
    ).toBe(true)
    expect(
      indicators.map((indicator) => indicator.attributes('aria-hidden')),
    ).toEqual(['true'])
    expect(
      indicators.map((indicator) => indicator.attributes('data-active-nav')),
    ).toEqual(['home'])
    expect(
      wrapper
        .find('[data-fsus-bottom-tab-item="home"].is-active')
        .attributes('aria-current'),
    ).toBe('page')

    await wrapper.setProps({ activeNav: 'archive' })

    expect(
      wrapper
        .findAll('.el-public-shell__active-nav-indicator')
        .map((indicator) => indicator.attributes('data-active-nav')),
    ).toEqual(['archive'])
    expect(
      wrapper
        .find('[data-fsus-bottom-tab-item="archive"].is-active')
        .attributes('aria-current'),
    ).toBe('page')
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

  test('renders mobile primary actions beside brand while bottom tabs own mobile navigation', () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        showSearch: false,
      },
      slots: {
        'mobile-primary-actions':
          '<button data-test="mobile-primary">Search</button>',
        'mobile-actions': '<button data-test="legacy-mobile">Legacy</button>',
      },
    })

    const primaryRow = wrapper.find('.el-public-shell__primary-row')
    const mobilePrimaryActions = primaryRow.find(
      '.el-public-shell__mobile-primary-actions',
    )
    const mobileToolbar = wrapper.find('.el-public-shell__mobile-toolbar')

    expect(mobilePrimaryActions.exists()).toBe(true)
    expect(
      mobilePrimaryActions.find('[data-test="mobile-primary"]').exists(),
    ).toBe(true)
    expect(mobileToolbar.find('.el-public-shell__mobile-nav').exists()).toBe(
      false,
    )
    expect(wrapper.find('[data-fsus-bottom-tab-bar]').exists()).toBe(true)
    expect(wrapper.findAll('[data-fsus-bottom-tab-item]')).toHaveLength(2)
    expect(
      mobileToolbar.find('.el-public-shell__mobile-actions').exists(),
    ).toBe(true)
    expect(mobileToolbar.find('[data-test="legacy-mobile"]').exists()).toBe(
      true,
    )
    expect(mobileToolbar.find('[data-test="mobile-primary"]').exists()).toBe(
      false,
    )

    const primaryChildren = primaryRow.element.children
    expect(
      primaryChildren[0]?.classList.contains('el-public-shell__brand-nav'),
    ).toBe(true)
    expect(
      primaryChildren[1]?.classList.contains('el-public-shell__actions'),
    ).toBe(true)
    expect(
      primaryChildren[2]?.classList.contains(
        'el-public-shell__mobile-primary-actions',
      ),
    ).toBe(true)
  })

  test('renders default auth link in desktop and mobile primary actions', () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        authLabel: 'Sign in',
        authHref: '/login',
        mobileSearchMode: 'trigger',
      },
      slots: {
        'mobile-primary-actions':
          '<button data-test="theme-toggle">Theme</button>',
      },
    })

    const desktopAuth = wrapper.find(
      '.el-public-shell__actions .el-public-shell__auth-link',
    )
    const mobilePrimaryActions = wrapper.find(
      '.el-public-shell__mobile-primary-actions',
    )
    const mobileAuth = mobilePrimaryActions.find('.el-public-shell__auth-link')

    expect(wrapper.findAll('.el-public-shell__auth-link')).toHaveLength(2)
    expect(desktopAuth.attributes('href')).toBe('/login')
    expect(desktopAuth.text()).toBe('Sign in')
    expect(mobileAuth.attributes('href')).toBe('/login')
    expect(mobileAuth.text()).toBe('Sign in')
    expect(mobileAuth.classes()).toContain('el-public-shell__auth-link--mobile')
    expect(mobileAuth.attributes('data-public-nav')).toBe('auth')
    expect(
      mobilePrimaryActions
        .find('.el-public-shell__mobile-search-trigger')
        .exists(),
    ).toBe(true)
    expect(
      mobilePrimaryActions.find('[data-test="theme-toggle"]').exists(),
    ).toBe(true)
  })

  test('omits desktop and mobile auth links when auth props are incomplete', () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        authLabel: 'Sign in',
        authHref: '',
      },
    })

    expect(wrapper.find('.el-public-shell__auth-link').exists()).toBe(false)
  })

  test('supports trigger-based mobile search without replacing desktop search', async () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        mobileSearchMode: 'trigger',
        searchAriaLabel: 'Search site',
        searchPlaceholder: 'Search articles',
        spaSearch: true,
      },
    })

    const desktopSearch = wrapper.find('.el-public-shell__search--desktop')
    const legacyMobileSearch = wrapper.find('.el-public-shell__search--mobile')
    const trigger = wrapper.find('.el-public-shell__mobile-search-trigger')
    const searchRow = wrapper.find('.el-public-shell__mobile-search-row')

    expect(desktopSearch.exists()).toBe(true)
    expect(legacyMobileSearch.exists()).toBe(false)
    expect(trigger.exists()).toBe(true)
    expect(trigger.text()).toBe('Search site')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.attributes('aria-controls')).toBe(searchRow.attributes('id'))
    expect(searchRow.exists()).toBe(true)
    expect(searchRow.classes()).not.toContain('is-expanded')

    await trigger.trigger('click')
    await nextTick()

    expect(trigger.text()).toBe('Cancel')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(searchRow.classes()).toContain('is-expanded')
    expect(searchRow.find('input').attributes('placeholder')).toBe(
      'Search articles',
    )

    const emptySubmit = new Event('submit', { cancelable: true })
    searchRow.find('form').element.dispatchEvent(emptySubmit)
    await nextTick()

    expect(emptySubmit.defaultPrevented).toBe(true)
    expect(wrapper.emitted('search')).toBeUndefined()

    await searchRow.find('input').setValue('docs')
    const submit = new Event('submit', { cancelable: true })
    searchRow.find('form').element.dispatchEvent(submit)
    await nextTick()

    expect(submit.defaultPrevented).toBe(true)
    expect(wrapper.emitted('search')?.[0]).toEqual(['docs'])
  })

  test('closes trigger mobile search with escape and cancel while preserving focus', async () => {
    const wrapper = mount(PublicShell, {
      attachTo: document.body,
      props: {
        brand: 'Fsus',
        navItems,
        mobileSearchMode: 'trigger',
        searchQuery: 'initial',
      },
    })

    const trigger = wrapper.find<HTMLButtonElement>(
      '.el-public-shell__mobile-search-trigger',
    )
    const searchRow = wrapper.find('.el-public-shell__mobile-search-row')

    expect(searchRow.classes()).toContain('is-expanded')

    await searchRow.find('input').trigger('keydown', { key: 'Escape' })
    await nextTick()

    expect(searchRow.classes()).not.toContain('is-expanded')

    await trigger.trigger('click')
    await nextTick()
    expect(searchRow.classes()).toContain('is-expanded')

    await trigger.trigger('click')
    await nextTick()

    expect(searchRow.classes()).not.toContain('is-expanded')
    expect(document.activeElement).toBe(trigger.element)
  })

  test('keeps inline and none mobile search modes available', () => {
    const inlineWrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
      },
    })
    const noneWrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        mobileSearchMode: 'none',
      },
    })

    expect(
      inlineWrapper.find('.el-public-shell__search--mobile').exists(),
    ).toBe(true)
    expect(
      inlineWrapper.find('.el-public-shell__mobile-search-trigger').exists(),
    ).toBe(false)
    expect(noneWrapper.find('.el-public-shell__search--mobile').exists()).toBe(
      false,
    )
    expect(
      noneWrapper.find('.el-public-shell__mobile-search-trigger').exists(),
    ).toBe(false)
  })

  test('supports dense desktop utility group with long search copy and optional auth link', () => {
    const navItems = [
      { key: 'home', label: 'Home', href: '/' },
      { key: 'archive', label: 'Archive', href: '/archive' },
      { key: 'tags', label: 'Tags', href: '/tags' },
      { key: 'projects', label: 'Projects', href: '/projects' },
      { key: 'about', label: 'About', href: '/about' },
    ]
    const wrapper = mount(PublicShell, {
      props: {
        brand: "Fsu's Blog",
        navItems,
        searchPlaceholder: '搜索文章、标签或关键词',
        searchAriaLabel: '搜索',
      },
      slots: {
        'desktop-actions': '<button data-test="theme">Theme</button>',
      },
    })

    const actions = wrapper.find('.el-public-shell__actions')
    const search = actions.find('.el-public-shell__search--desktop')
    const input = search.find('input')

    expect(wrapper.findAll('.el-public-shell__desktop-nav a')).toHaveLength(5)
    expect(search.exists()).toBe(true)
    expect(input.attributes('placeholder')).toBe('搜索文章、标签或关键词')
    expect(input.attributes('aria-label')).toBe('搜索')
    expect(actions.find('[data-test="theme"]').exists()).toBe(true)
    expect(actions.find('.el-public-shell__auth-link').exists()).toBe(false)
  })
})
