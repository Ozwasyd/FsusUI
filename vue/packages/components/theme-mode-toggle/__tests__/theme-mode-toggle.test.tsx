import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import ThemeModeToggle from '../src/theme-mode-toggle.vue'
import { clearThemeMode } from '@element-plus/components/config-provider'

type MatchMediaController = ReturnType<typeof createMatchMediaController>

const createMatchMediaController = (initialMatches = false) => {
  let matches = initialMatches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const listenerMap = new Map<
    EventListenerOrEventListenerObject,
    (event: MediaQueryListEvent) => void
  >()

  const mediaQueryList = {
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    get matches() {
      return matches
    },
    addEventListener(
      _type: string,
      listener: EventListenerOrEventListenerObject | null,
    ) {
      if (!listener) return

      const normalizedListener = (event: MediaQueryListEvent) => {
        if (typeof listener === 'function') {
          listener.call(mediaQueryList, event)
          return
        }

        listener.handleEvent(event)
      }

      listenerMap.set(listener, normalizedListener)
      listeners.add(normalizedListener)
    },
    removeEventListener(
      _type: string,
      listener: EventListenerOrEventListenerObject | null,
    ) {
      if (!listener) return

      const normalizedListener = listenerMap.get(listener)
      if (!normalizedListener) return

      listeners.delete(normalizedListener)
      listenerMap.delete(listener)
    },
    addListener(
      callback: (this: MediaQueryList, ev: MediaQueryListEvent) => any,
    ) {
      this.addEventListener('change', callback as EventListener)
    },
    removeListener(
      callback: (this: MediaQueryList, ev: MediaQueryListEvent) => any,
    ) {
      this.removeEventListener('change', callback as EventListener)
    },
    dispatchEvent() {
      return true
    },
  } as unknown as MediaQueryList

  const createEvent = () => {
    const event = new Event('change') as MediaQueryListEvent
    Object.defineProperty(event, 'matches', {
      configurable: true,
      value: matches,
    })
    Object.defineProperty(event, 'media', {
      configurable: true,
      value: mediaQueryList.media,
    })
    return event
  }

  return {
    matchMedia: () => mediaQueryList,
    setMatches(nextMatches: boolean) {
      matches = nextMatches
      const event = createEvent()
      listeners.forEach((listener) => listener(event))
    },
  }
}

describe('ThemeModeToggle.vue', () => {
  let originalMatchMedia: typeof window.matchMedia | undefined
  let matchMediaController: MatchMediaController

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    matchMediaController = createMatchMediaController(false)
    window.matchMedia =
      matchMediaController.matchMedia as typeof window.matchMedia
    clearThemeMode()
  })

  afterEach(() => {
    clearThemeMode()
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia
      return
    }

    delete (window as Partial<Window>).matchMedia
  })

  test('renders compact visibility classes', () => {
    const wrapper = mount(() => (
      <ThemeModeToggle compact visibility="mobile" modelValue="system" />
    ))

    expect(wrapper.classes()).toContain('el-theme-mode-toggle--mobile')
    expect(wrapper.classes()).toContain('is-compact')
    expect(wrapper.attributes('data-theme-mode-visibility')).toBe('mobile')
    expect(
      wrapper.element.matches('.el-radio-group.el-theme-mode-toggle'),
    ).toBe(true)
  })

  test('emits and syncs selected theme mode', async () => {
    const wrapper = mount(ThemeModeToggle, {
      props: {
        modelValue: 'light',
      },
    })

    await wrapper.find('input[value="dark"]').setValue()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['dark'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['dark'])
    expect(document.documentElement.dataset.themeMode).toBe('light')

    await wrapper.setProps({ modelValue: 'dark' })
    expect(document.documentElement.dataset.themeMode).toBe('dark')
  })

  test('keeps segmented variant as the default and applies consumer labels', () => {
    const wrapper = mount(ThemeModeToggle, {
      props: {
        compact: true,
        modelValue: 'system',
        labels: {
          lightShort: '浅',
          darkShort: '深',
          systemShort: '系统',
        },
      },
    })

    expect(
      wrapper.element.matches('.el-radio-group.el-theme-mode-toggle'),
    ).toBe(true)
    expect(wrapper.find('.el-theme-mode-toggle__menu-button').exists()).toBe(
      false,
    )
    expect(wrapper.text()).toContain('系统')
    expect(wrapper.text()).not.toContain('Sys')
  })

  test('syncs segmented variant through manual and system-resolved theme states', async () => {
    const wrapper = mount(ThemeModeToggle, {
      props: {
        modelValue: 'light',
      },
    })

    expect(document.documentElement.dataset.themeMode).toBe('light')
    expect(document.documentElement.dataset.themeResolved).toBe('light')
    expect(
      wrapper.find<HTMLInputElement>('input[value="light"]').element.checked,
    ).toBe(true)

    await wrapper.setProps({ modelValue: 'dark' })
    await nextTick()

    expect(document.documentElement.dataset.themeMode).toBe('dark')
    expect(document.documentElement.dataset.themeResolved).toBe('dark')
    expect(
      wrapper.find<HTMLInputElement>('input[value="dark"]').element.checked,
    ).toBe(true)

    await wrapper.setProps({ modelValue: 'system' })
    await nextTick()

    expect(document.documentElement.dataset.themeMode).toBe('system')
    expect(document.documentElement.dataset.themeResolved).toBe('light')
    expect(
      wrapper.find<HTMLInputElement>('input[value="system"]').element.checked,
    ).toBe(true)

    matchMediaController.setMatches(true)
    await nextTick()

    expect(document.documentElement.dataset.themeMode).toBe('system')
    expect(document.documentElement.dataset.themeResolved).toBe('dark')
    expect(
      wrapper.find<HTMLInputElement>('input[value="system"]').element.checked,
    ).toBe(true)
  })

  test('renders menu-button variant with localized current mode and menu items', async () => {
    const wrapper = mount(ThemeModeToggle, {
      attachTo: document.body,
      props: {
        variant: 'menu-button',
        defaultValue: 'system',
        labels: {
          light: '浅色',
          dark: '深色',
          system: '跟随系统',
          lightShort: '浅',
          darkShort: '深',
          systemShort: '系统',
        },
      },
    })

    const trigger = wrapper.find<HTMLButtonElement>(
      '.el-theme-mode-toggle__menu-button',
    )

    expect(wrapper.find('.el-radio-group').exists()).toBe(false)
    expect(trigger.exists()).toBe(true)
    expect(trigger.text()).toBe('系统')
    expect(trigger.attributes('aria-haspopup')).toBe('menu')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await trigger.trigger('click')
    await nextTick()

    const menu = wrapper.find('.el-theme-mode-toggle__menu')
    const items = wrapper.findAll('.el-theme-mode-toggle__menu-item')

    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(menu.attributes('role')).toBe('menu')
    expect(items).toHaveLength(3)
    expect(items.map((item) => item.text())).toEqual([
      '浅色',
      '深色',
      '跟随系统',
    ])
    expect(items[2].attributes('aria-checked')).toBe('true')

    await items[0].trigger('click')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['light'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['light'])
    expect(document.documentElement.dataset.themeMode).toBe('light')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)

    wrapper.unmount()
  })

  test('supports menu-button keyboard close, selection, and outside click', async () => {
    const wrapper = mount(ThemeModeToggle, {
      attachTo: document.body,
      props: {
        variant: 'menu-button',
        modelValue: 'light',
      },
    })
    const trigger = wrapper.find<HTMLButtonElement>(
      '.el-theme-mode-toggle__menu-button',
    )

    await trigger.trigger('click')
    await nextTick()

    let items = wrapper.findAll<HTMLButtonElement>(
      '.el-theme-mode-toggle__menu-item',
    )
    expect(document.activeElement).toBe(items[0].element)

    await items[0].trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    items = wrapper.findAll<HTMLButtonElement>(
      '.el-theme-mode-toggle__menu-item',
    )
    expect(document.activeElement).toBe(items[1].element)

    await items[1].trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['dark'])
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    await nextTick()
    items = wrapper.findAll<HTMLButtonElement>(
      '.el-theme-mode-toggle__menu-item',
    )
    await items[0].trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    await nextTick()
    document.body.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true }),
    )
    await nextTick()
    expect(trigger.attributes('aria-expanded')).toBe('false')

    wrapper.unmount()
  })
})
