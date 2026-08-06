import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { describe, expect, test, vi } from 'vitest'
import PublicShell from '../src/public-shell.vue'

const navItems = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'archive', label: 'Archive', href: '/archive' },
]

describe('PublicShell.vue', () => {
  test('keeps the native menu panel available before hydration for no-JavaScript details', async () => {
    const html = await renderToString(
      h(PublicShell, {
        brand: 'Fsus',
        navItems,
        mobileNavMode: 'menu',
      }),
    )

    expect(html).toContain('<details')
    expect(html).toContain('el-public-shell__mobile-nav-menu-panel')
    expect(html).not.toMatch(
      /mobile-nav-menu-panel[^>]*style="[^"]*display:\s*none/u,
    )
    expect(html).not.toMatch(/mobile-nav-menu-panel[^>]*aria-hidden/u)
  })

  test('renders SSR-stable desktop navigation and the default native mobile menu', () => {
    const wrapper = mount(() => (
      <PublicShell brand="Fsus" navItems={navItems} activeNav="archive" />
    ))

    expect(wrapper.findComponent({ name: 'ElSiteHeader' }).exists()).toBe(true)
    expect(
      wrapper.find('.el-site-header.el-public-shell__header').exists(),
    ).toBe(true)
    expect(wrapper.find('.el-public-shell__desktop-nav').exists()).toBe(true)
    expect(wrapper.find('.el-public-shell__mobile-nav').exists()).toBe(false)
    expect(wrapper.find('[data-fsus-bottom-tab-bar]').exists()).toBe(false)
    expect(wrapper.find('[data-public-shell-header]').exists()).toBe(true)
    expect(wrapper.find('.el-public-shell__mobile-nav-menu').exists()).toBe(
      true,
    )
    expect(
      wrapper
        .find('[data-mobile-nav-menu-trigger]')
        .attributes('aria-expanded'),
    ).toBe('false')
    expect(
      wrapper.find('[data-mobile-nav-menu-trigger]').attributes('role'),
    ).toBe('button')
    expect(
      wrapper
        .find('.el-public-shell__nav-link.is-active[data-public-nav="archive"]')
        .exists(),
    ).toBe(true)
    expect(
      wrapper
        .find(
          '.el-public-shell__mobile-nav-link.is-active[data-public-nav="archive"]',
        )
        .attributes('aria-current'),
    ).toBe('page')
    expect(
      wrapper.find('.el-public-shell__active-nav-indicator').exists(),
    ).toBe(false)
    expect(
      wrapper.find('.el-public-shell__main').attributes('data-content-flow'),
    ).toBe('viewport-stable')
  })

  test('exposes content-driven main flow without consumer selectors', async () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        contentFlow: 'content-driven',
      },
    })

    expect(
      wrapper.find('.el-public-shell__main').attributes('data-content-flow'),
    ).toBe('content-driven')

    await wrapper.setProps({ contentFlow: 'viewport-stable' })

    expect(
      wrapper.find('.el-public-shell__main').attributes('data-content-flow'),
    ).toBe('viewport-stable')
  })

  test('renders opt-in semantic active nav indicator for desktop while bottom tabs track active key', async () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        activeNav: 'home',
        activeNavMotion: 'indicator',
        mobileNavMode: 'bottom',
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

  test('removes inline layout styles and motion writes in CSP-safe mode', async () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        activeNav: 'archive',
        activeNavMotion: 'indicator',
        cspSafe: true,
        mobileSearchMode: 'trigger',
      },
    })

    await nextTick()
    expect(wrapper.attributes('style')).toBeUndefined()
    expect(wrapper.find('.el-site-header').attributes('style')).toBeUndefined()
    expect(
      wrapper.find('.el-public-shell__active-nav-indicator').exists(),
    ).toBe(false)
    expect(
      wrapper.findAll('[style]').map((node) => ({
        class: node.attributes('class'),
        style: node.attributes('style'),
      })),
    ).toEqual([])
    expect(
      wrapper.find('.el-public-shell__mobile-search-row').classes(),
    ).toContain('is-csp-hidden')

    const details = wrapper.find<HTMLDetailsElement>(
      '.el-public-shell__mobile-nav-menu',
    )
    const trigger = wrapper.find<HTMLElement>('[data-mobile-nav-menu-trigger]')
    await vi.waitFor(() => {
      expect(
        wrapper.find('.el-public-shell__mobile-nav-menu-panel').exists(),
      ).toBe(false)
    })

    await trigger.trigger('click', { button: 0 })
    const openPanel = wrapper.find<HTMLElement>(
      '.el-public-shell__mobile-nav-menu-panel',
    )
    expect(details.element.open).toBe(true)
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(openPanel.classes()).toContain(
      'el-public-shell-mobile-nav-menu-enter-active',
    )
    expect(openPanel.attributes('style')).toBeUndefined()

    await vi.waitFor(() => {
      expect(openPanel.classes()).not.toContain(
        'el-public-shell-mobile-nav-menu-enter-active',
      )
    })
    await trigger.trigger('click', { button: 0 })
    expect(details.element.open).toBe(true)
    expect(details.classes()).toContain('is-closing')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(openPanel.attributes('aria-hidden')).toBe('true')
    expect(openPanel.attributes()).toHaveProperty('inert')
    expect(openPanel.classes()).toContain(
      'el-public-shell-mobile-nav-menu-leave-active',
    )
    expect(openPanel.attributes('style')).toBeUndefined()

    await vi.waitFor(() => expect(details.element.open).toBe(false))
    expect(
      wrapper.find('.el-public-shell__mobile-nav-menu-panel').exists(),
    ).toBe(false)
    expect(wrapper.findAll('[style]')).toHaveLength(0)

    const html = await renderToString(
      h(PublicShell, {
        brand: 'Fsus',
        navItems,
        activeNav: 'archive',
        cspSafe: true,
        mobileSearchMode: 'trigger',
      }),
    )
    expect(html).not.toMatch(/\sstyle=/u)
    expect(html).toContain('el-public-shell__mobile-nav-menu-panel')
    wrapper.unmount()
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
        mobileNavMode: 'bottom',
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

  test('renders every explicit mobile navigation strategy with stable semantic snapshots', () => {
    const snapshot = (['menu', 'inline', 'bottom', 'none'] as const).map(
      (mode) => {
        const wrapper = mount(PublicShell, {
          props: {
            brand: 'Fsus',
            navItems,
            activeNav: 'archive',
            mobileNavMode: mode,
            mobileNavLabel: 'Primary sections',
          },
        })
        const active = wrapper.find(
          '.el-public-shell__mobile-nav-link[aria-current="page"][data-public-nav="archive"], [aria-current="page"][data-fsus-bottom-tab-item="archive"]',
        )
        const result = {
          mode,
          dataMode: wrapper.attributes('data-mobile-nav-mode'),
          menu: wrapper.find('.el-public-shell__mobile-nav-menu').exists(),
          inline: wrapper.find('.el-public-shell__mobile-nav--inline').exists(),
          bottom: wrapper.find('[data-fsus-bottom-tab-bar]').exists(),
          bottomSafeAreaClass: wrapper
            .classes()
            .includes('is-mobile-nav-bottom'),
          desktopItems: wrapper.findAll('.el-public-shell__desktop-nav a')
            .length,
          activeCurrent: active.exists()
            ? active.attributes('aria-current')
            : null,
        }
        wrapper.unmount()
        return result
      },
    )

    expect(snapshot).toMatchInlineSnapshot(`
      [
        {
          "activeCurrent": "page",
          "bottom": false,
          "bottomSafeAreaClass": false,
          "dataMode": "menu",
          "desktopItems": 2,
          "inline": false,
          "menu": true,
          "mode": "menu",
        },
        {
          "activeCurrent": "page",
          "bottom": false,
          "bottomSafeAreaClass": false,
          "dataMode": "inline",
          "desktopItems": 2,
          "inline": true,
          "menu": false,
          "mode": "inline",
        },
        {
          "activeCurrent": "page",
          "bottom": true,
          "bottomSafeAreaClass": true,
          "dataMode": "bottom",
          "desktopItems": 2,
          "inline": false,
          "menu": false,
          "mode": "bottom",
        },
        {
          "activeCurrent": null,
          "bottom": false,
          "bottomSafeAreaClass": false,
          "dataMode": "none",
          "desktopItems": 2,
          "inline": false,
          "menu": false,
          "mode": "none",
        },
      ]
    `)
  })

  test('closes the native mobile menu with escape and restores summary focus', async () => {
    const wrapper = mount(PublicShell, {
      attachTo: document.body,
      props: {
        brand: 'Fsus',
        navItems,
        activeNav: 'home',
        mobileNavMode: 'menu',
      },
      slots: {
        'mobile-menu-actions':
          '<div data-test="menu-actions">Theme and account</div>',
      },
    })
    const details = wrapper.find<HTMLDetailsElement>(
      '.el-public-shell__mobile-nav-menu',
    )
    const trigger = wrapper.find<HTMLElement>('[data-mobile-nav-menu-trigger]')
    const panel = wrapper.find<HTMLElement>(
      '.el-public-shell__mobile-nav-menu-panel',
    )

    await nextTick()
    expect(panel.attributes('style')).toContain('display: none')

    await trigger.trigger('click', { button: 0 })
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(panel.attributes('style') ?? '').not.toContain('display: none')
    expect(details.find('[data-test="menu-actions"]').exists()).toBe(true)
    expect(
      details
        .find('.el-public-shell__mobile-nav-menu-actions')
        .find('[data-test="menu-actions"]')
        .exists(),
    ).toBe(true)

    await details.trigger('keydown', { key: 'Escape' })

    expect(details.element.open).toBe(true)
    expect(details.classes()).toContain('is-closing')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(panel.attributes('aria-hidden')).toBe('true')
    expect(panel.attributes()).toHaveProperty('inert')

    await vi.waitFor(() => expect(details.element.open).toBe(false))

    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(panel.attributes('style')).toContain('display: none')
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  test('keeps details open through leave and safely reverses a rapid close', async () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        mobileNavMode: 'menu',
      },
    })
    const details = wrapper.find<HTMLDetailsElement>(
      '.el-public-shell__mobile-nav-menu',
    )
    const trigger = wrapper.find<HTMLElement>('[data-mobile-nav-menu-trigger]')
    const panel = wrapper.find<HTMLElement>(
      '.el-public-shell__mobile-nav-menu-panel',
    )

    await nextTick()
    await trigger.trigger('click', { button: 0 })
    await trigger.trigger('click', { button: 0 })

    expect(details.element.open).toBe(true)
    expect(details.classes()).toContain('is-closing')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click', { button: 0 })
    await nextTick()

    expect(details.element.open).toBe(true)
    expect(details.classes()).not.toContain('is-closing')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(panel.attributes('aria-hidden')).toBeUndefined()
    expect(panel.attributes('style') ?? '').not.toContain('display: none')
  })

  test('runs and completes the mobile menu enter lifecycle', async () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        mobileNavMode: 'menu',
      },
    })
    const trigger = wrapper.find<HTMLElement>('[data-mobile-nav-menu-trigger]')
    const panel = wrapper.find<HTMLElement>(
      '.el-public-shell__mobile-nav-menu-panel',
    )

    await nextTick()
    await trigger.trigger('click', { button: 0 })

    expect(panel.classes()).toContain(
      'el-public-shell-mobile-nav-menu-enter-active',
    )
    expect(panel.classes()).toContain(
      'el-public-shell-mobile-nav-menu-enter-from',
    )
    await vi.waitFor(() => {
      expect(panel.classes()).not.toContain(
        'el-public-shell-mobile-nav-menu-enter-active',
      )
    })
    expect(trigger.attributes('aria-expanded')).toBe('true')
  })

  test('closes the mobile menu through the shared navigation-link path', async () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        mobileNavMode: 'menu',
      },
    })
    const details = wrapper.find<HTMLDetailsElement>(
      '.el-public-shell__mobile-nav-menu',
    )
    const trigger = wrapper.find<HTMLElement>('[data-mobile-nav-menu-trigger]')

    await nextTick()
    await trigger.trigger('click', { button: 0 })
    const link = wrapper.find<HTMLElement>('.el-public-shell__mobile-nav-link')
    link.element.addEventListener('click', (event) => event.preventDefault(), {
      once: true,
    })
    await link.trigger('click')

    expect(details.element.open).toBe(true)
    expect(details.classes()).toContain('is-closing')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    await vi.waitFor(() => expect(details.element.open).toBe(false))
  })

  test('resets controlled menu state when switching to another mobile navigation mode', async () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        mobileNavMode: 'menu',
      },
    })
    const trigger = wrapper.find<HTMLElement>('[data-mobile-nav-menu-trigger]')

    await nextTick()
    await trigger.trigger('click', { button: 0 })
    expect(trigger.attributes('aria-expanded')).toBe('true')

    await wrapper.setProps({ mobileNavMode: 'inline' })
    expect(wrapper.find('.el-public-shell__mobile-nav-menu').exists()).toBe(
      false,
    )
    expect(wrapper.find('.el-public-shell__mobile-nav--inline').exists()).toBe(
      true,
    )

    await wrapper.setProps({ mobileNavMode: 'menu' })
    const reopenedTrigger = wrapper.find<HTMLElement>(
      '[data-mobile-nav-menu-trigger]',
    )
    await nextTick()
    expect(reopenedTrigger.attributes('aria-expanded')).toBe('false')
    expect(
      wrapper
        .find('.el-public-shell__mobile-nav-menu-panel')
        .attributes('style'),
    ).toContain('display: none')
  })

  test('keeps default mobile auth and utilities one menu step from the two primary actions', () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        authLabel: 'Sign in',
        authHref: '/login',
        mobileSearchMode: 'trigger',
        searchAction: '/search',
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
    const mobileMenu = mobilePrimaryActions.find(
      '.el-public-shell__mobile-nav-menu',
    )
    const mobileMenuActions = mobileMenu.find(
      '.el-public-shell__mobile-nav-menu-actions',
    )
    const mobileAuth = mobileMenuActions.find('.el-public-shell__auth-link')

    expect(wrapper.findAll('.el-public-shell__auth-link')).toHaveLength(2)
    expect(desktopAuth.attributes('href')).toBe('/login')
    expect(desktopAuth.text()).toBe('Sign in')
    expect(mobileAuth.attributes('href')).toBe('/login')
    expect(mobileAuth.text()).toBe('Sign in')
    expect(mobileAuth.classes()).toContain('el-public-shell__auth-link--mobile')
    expect(mobileAuth.attributes('data-public-nav')).toBe('auth')
    expect(
      Array.from(mobilePrimaryActions.element.children).map(
        (element) => (element as HTMLElement).className,
      ),
    ).toEqual([
      'el-public-shell__mobile-search-trigger',
      'el-public-shell__mobile-nav-menu',
    ])
    expect(
      mobilePrimaryActions
        .find('.el-public-shell__mobile-search-trigger')
        .exists(),
    ).toBe(true)
    expect(mobileMenuActions.find('[data-test="theme-toggle"]').exists()).toBe(
      true,
    )
    expect(
      mobilePrimaryActions.element.querySelector(
        ':scope > .el-public-shell__auth-link',
      ),
    ).toBeNull()
  })

  test('keeps explicit inline mode actions equal-height in DOM order without turning auth into a menu action', () => {
    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        authLabel: 'Sign in',
        authHref: '/login',
        mobileNavMode: 'inline',
        mobileSearchMode: 'trigger',
        mobileSearchTriggerLabel: 'Search',
      },
      slots: {
        'mobile-primary-actions':
          '<button data-test="theme-toggle">Theme</button>',
      },
    })

    const mobilePrimaryActions = wrapper.find(
      '.el-public-shell__mobile-primary-actions',
    )
    expect(
      mobilePrimaryActions.find('.el-public-shell__mobile-nav-menu').exists(),
    ).toBe(false)
    expect(
      mobilePrimaryActions.findAll('a, button').map((node) => node.text()),
    ).toEqual(['Search', 'Theme', 'Sign in'])
    expect(
      mobilePrimaryActions
        .find('.el-public-shell__auth-link--mobile')
        .attributes('href'),
    ).toBe('/login')
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

  test('keeps inline desktop search compatible and exposes an explicit none mode', () => {
    const inlineWrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        searchPlaceholder: 'Search articles',
      },
    })
    const noneWrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        desktopSearchMode: 'none',
      },
    })

    expect(inlineWrapper.attributes('data-desktop-search-mode')).toBe('inline')
    expect(
      inlineWrapper.find('.el-public-shell__search--desktop').exists(),
    ).toBe(true)
    expect(
      inlineWrapper.find('.el-public-shell__desktop-search-trigger').exists(),
    ).toBe(false)
    expect(noneWrapper.attributes('data-desktop-search-mode')).toBe('none')
    expect(noneWrapper.find('.el-public-shell__search--desktop').exists()).toBe(
      false,
    )
    expect(
      noneWrapper.find('.el-public-shell__desktop-search-trigger').exists(),
    ).toBe(false)
  })

  test('renders a native desktop trigger and preserves modified navigation', async () => {
    const wrapper = mount(PublicShell, {
      attachTo: document.body,
      props: {
        brand: 'Fsus',
        navItems,
        desktopSearchMode: 'trigger',
        desktopSearchTriggerLabel: 'Search archive',
        searchAction: '/search',
        searchAriaLabel: 'Search site',
        searchPlaceholder: 'Search articles',
        spaSearch: true,
      },
    })
    const trigger = wrapper.find<HTMLAnchorElement>(
      '.el-public-shell__desktop-search-trigger',
    )
    const panel = wrapper.find<HTMLElement>(
      '.el-public-shell__desktop-search-panel',
    )

    expect(trigger.element.tagName).toBe('A')
    expect(trigger.attributes('href')).toBe('/search')
    expect(trigger.text()).toBe('Search archive')
    expect(trigger.attributes('aria-label')).toBe('Search archive')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.attributes('aria-controls')).toBe(panel.attributes('id'))
    expect(panel.attributes('aria-hidden')).toBe('true')
    expect(panel.attributes()).toHaveProperty('inert')

    trigger.element.addEventListener(
      'click',
      (event) => event.preventDefault(),
      {
        once: true,
      },
    )
    await trigger.trigger('click', { ctrlKey: true })
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click', { button: 0 })
    await nextTick()

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(panel.classes()).toContain('is-expanded')
    expect(panel.attributes('aria-hidden')).toBe('false')
    expect(panel.attributes()).not.toHaveProperty('inert')
    expect(panel.find('input').attributes('placeholder')).toBe(
      'Search articles',
    )
    expect(document.activeElement).toBe(panel.find('input').element)

    await panel.find('input').setValue('layout')
    expect(wrapper.emitted('update:searchQuery')?.at(-1)).toEqual(['layout'])
    const submit = new Event('submit', { cancelable: true })
    panel.find('form').element.dispatchEvent(submit)
    await nextTick()
    expect(submit.defaultPrevented).toBe(true)
    expect(wrapper.emitted('search')?.at(-1)).toEqual(['layout'])

    await panel.find('input').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)
    wrapper.unmount()
  })

  test('syncs controlled desktop queries and closes on outside pointer without stealing focus', async () => {
    const outside = document.createElement('button')
    outside.type = 'button'
    outside.textContent = 'Outside action'
    document.body.append(outside)
    const wrapper = mount(PublicShell, {
      attachTo: document.body,
      props: {
        brand: 'Fsus',
        navItems,
        desktopSearchMode: 'trigger',
        searchQuery: '',
      },
    })
    const trigger = wrapper.find<HTMLAnchorElement>(
      '.el-public-shell__desktop-search-trigger',
    )

    await wrapper.setProps({ searchQuery: 'controlled' })
    await nextTick()
    const panel = wrapper.find('.el-public-shell__desktop-search-panel')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect((panel.find('input').element as HTMLInputElement).value).toBe(
      'controlled',
    )

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    outside.focus()
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(outside)

    await wrapper.setProps({ desktopSearchMode: 'inline' })
    expect(
      wrapper.find('.el-public-shell__desktop-search-trigger').exists(),
    ).toBe(false)
    expect(wrapper.find('.el-public-shell__search--desktop').exists()).toBe(
      true,
    )
    wrapper.unmount()
    outside.remove()
  })

  test('keeps desktop trigger CSP-safe and server-rendered as a native fallback link', async () => {
    const html = await renderToString(
      h(PublicShell, {
        brand: 'Fsus',
        navItems,
        cspSafe: true,
        desktopSearchMode: 'trigger',
        desktopSearchTriggerLabel: 'Search archive',
        searchAction: '/search',
      }),
    )

    expect(html).toContain('el-public-shell__desktop-search-trigger')
    expect(html).toContain('href="/search"')
    expect(html).not.toMatch(/\sstyle=/u)

    const wrapper = mount(PublicShell, {
      props: {
        brand: 'Fsus',
        navItems,
        cspSafe: true,
        desktopSearchMode: 'trigger',
      },
    })
    const trigger = wrapper.find('.el-public-shell__desktop-search-trigger')
    const panel = wrapper.find('.el-public-shell__desktop-search-panel')

    expect(panel.classes()).toContain('is-csp-hidden')
    expect(panel.attributes()).toHaveProperty('inert')
    expect(wrapper.findAll('[style]')).toHaveLength(0)

    await trigger.trigger('click', { button: 0 })
    await nextTick()
    expect(panel.classes()).not.toContain('is-csp-hidden')
    expect(panel.classes()).toContain('is-expanded')
    expect(panel.attributes()).not.toHaveProperty('inert')
    expect(wrapper.findAll('[style]')).toHaveLength(0)
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
    const mobileToolbar = wrapper.find('.el-public-shell__mobile-toolbar')

    expect(desktopSearch.exists()).toBe(true)
    expect(legacyMobileSearch.exists()).toBe(false)
    expect(trigger.exists()).toBe(true)
    expect(trigger.element.tagName).toBe('A')
    expect(trigger.attributes('href')).toBe('/search')
    expect(trigger.text()).toBe('Search site')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.attributes('aria-controls')).toBe(searchRow.attributes('id'))
    expect(searchRow.exists()).toBe(true)
    expect(searchRow.classes()).not.toContain('is-expanded')
    expect(mobileToolbar.classes()).toContain('is-collapsed')

    trigger.element.addEventListener(
      'click',
      (event) => event.preventDefault(),
      {
        once: true,
      },
    )
    await trigger.trigger('click', { ctrlKey: true })
    await nextTick()
    expect(searchRow.classes()).not.toContain('is-expanded')

    await trigger.trigger('click')
    await nextTick()

    expect(trigger.text()).toBe('Cancel')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(searchRow.classes()).toContain('is-expanded')
    expect(mobileToolbar.classes()).not.toContain('is-collapsed')
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

    const trigger = wrapper.find<HTMLAnchorElement>(
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

  test.each([
    { cspSafe: false, label: 'non-CSP v-show' },
    { cspSafe: true, label: 'CSP-safe v-if' },
  ] as const)(
    'completes mobile menu leave under 1ms reduced-motion styles ($label)',
    async ({ cspSafe }) => {
      const style = document.createElement('style')
      style.textContent = `
        .el-public-shell-mobile-nav-menu-enter-active,
        .el-public-shell-mobile-nav-menu-leave-active {
          transition: opacity 200ms ease, transform 200ms ease;
          transition-duration: 1ms !important;
          transition-delay: 0ms !important;
        }
        .el-public-shell-mobile-nav-menu-enter-from,
        .el-public-shell-mobile-nav-menu-leave-to {
          opacity: 0;
          transform: none;
        }
      `
      document.head.appendChild(style)

      try {
        const wrapper = mount(PublicShell, {
          attachTo: document.body,
          props: {
            brand: 'Fsus',
            navItems,
            mobileNavMode: 'menu',
            cspSafe,
            mobileSearchMode: 'trigger',
          },
        })

        const details = wrapper.find<HTMLDetailsElement>(
          '.el-public-shell__mobile-nav-menu',
        )
        const trigger = wrapper.find<HTMLElement>(
          '[data-mobile-nav-menu-trigger]',
        )

        await nextTick()
        await trigger.trigger('click', { button: 0 })
        await vi.waitFor(() => {
          expect(trigger.attributes('aria-expanded')).toBe('true')
        })

        const openPanel = wrapper.find<HTMLElement>(
          '.el-public-shell__mobile-nav-menu-panel',
        )
        expect(openPanel.exists()).toBe(true)

        const sheet = style.sheet
        expect(sheet).not.toBeNull()
        const activeRule = Array.from(sheet!.cssRules).find(
          (rule): rule is CSSStyleRule =>
            rule instanceof CSSStyleRule &&
            rule.selectorText.includes(
              'el-public-shell-mobile-nav-menu-leave-active',
            ) &&
            rule.style.transitionDuration.includes('1ms'),
        )
        expect(activeRule).toBeTruthy()
        expect(activeRule!.style.transitionDuration).toContain('1ms')
        expect(activeRule!.style.transitionDelay).toContain('0ms')

        await trigger.trigger('click', { button: 0 })
        expect(details.element.open).toBe(true)
        expect(details.classes()).toContain('is-closing')
        expect(trigger.attributes('aria-expanded')).toBe('false')
        expect(openPanel.attributes('aria-hidden')).toBe('true')
        expect(openPanel.attributes()).toHaveProperty('inert')
        expect(openPanel.classes()).toContain(
          'el-public-shell-mobile-nav-menu-leave-active',
        )

        await vi.waitFor(() => expect(details.element.open).toBe(false))
        if (cspSafe) {
          expect(
            wrapper.find('.el-public-shell__mobile-nav-menu-panel').exists(),
          ).toBe(false)
        } else {
          expect(details.element.open).toBe(false)
        }
        expect(details.classes()).not.toContain('is-closing')
        expect(trigger.attributes('aria-expanded')).toBe('false')

        wrapper.unmount()
      } finally {
        style.remove()
      }
    },
  )
})
