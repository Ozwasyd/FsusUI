import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ConfigProvider from '../src/config-provider'
import {
  applyThemeModeForTesting,
  clearThemeMode,
  installThemeModeTestHelper,
  readThemeMode,
  subscribeThemeMode,
  syncThemeMode,
  useThemeMode,
  writeThemeMode,
} from '../src/theme-mode'

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

describe('theme-mode', () => {
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
    window.__fsusUiThemeMode = undefined
    window.localStorage.clear()
    clearThemeMode()
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia
      return
    }

    delete (window as Partial<Window>).matchMedia
  })

  it('forces light mode when explicitly configured', () => {
    matchMediaController.setMatches(true)

    syncThemeMode('light')

    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.dataset.themeMode).toBe('light')
    expect(document.documentElement.dataset.themeResolved).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('tracks system preference changes without forcing classes', () => {
    expect(syncThemeMode('system')).toBe('light')

    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.dataset.themeMode).toBe('system')
    expect(document.documentElement.dataset.themeResolved).toBe('light')

    matchMediaController.setMatches(true)

    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.dataset.themeResolved).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('exposes storage-backed public theme runtime helpers', () => {
    const changes: string[] = []
    const unsubscribe = subscribeThemeMode((detail) => {
      changes.push(`${detail.mode}:${detail.resolved}`)
    })

    expect(readThemeMode({ storageKey: 'fsus-test-theme' })).toBe('system')
    expect(
      writeThemeMode('dark', {
        storageKey: 'fsus-test-theme',
      }),
    ).toBe('dark')
    expect(window.localStorage.getItem('fsus-test-theme')).toBe('dark')
    expect(readThemeMode({ storageKey: 'fsus-test-theme' })).toBe('dark')

    const runtime = useThemeMode({
      storageKey: 'fsus-test-theme',
    })
    expect(runtime.mode).toBe('dark')
    expect(runtime.setMode('light')).toBe('light')
    expect(runtime.resolved).toBe('light')
    expect(window.localStorage.getItem('fsus-test-theme')).toBe('light')

    unsubscribe()
    expect(changes).toContain('dark:dark')
    expect(changes).toContain('light:light')
  })

  it('restores the parent theme mode when a nested provider unmounts', async () => {
    const showNestedProvider = ref(true)
    const wrapper = mount(() => (
      <ConfigProvider themeMode="dark">
        {showNestedProvider.value ? (
          <ConfigProvider themeMode="light">
            <div>nested</div>
          </ConfigProvider>
        ) : (
          <div>root</div>
        )}
      </ConfigProvider>
    ))

    expect(document.documentElement.dataset.themeMode).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)

    showNestedProvider.value = false
    await nextTick()

    expect(document.documentElement.dataset.themeMode).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('light')).toBe(false)

    wrapper.unmount()
    expect(document.documentElement.dataset.themeMode).toBeUndefined()
  })

  it('applies explicit modes through the test helper with optional persistence', () => {
    const applied = applyThemeModeForTesting('dark', {
      persist: true,
      storageKey: 'fsus-test-theme',
    })

    expect(applied).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.dataset.themeMode).toBe('dark')
    expect(document.documentElement.dataset.themeResolved).toBe('dark')
    expect(window.localStorage.getItem('fsus-test-theme')).toBe('dark')
  })

  it('installs a browser-callable theme helper for screenshot tooling', () => {
    const helper = installThemeModeTestHelper({
      persist: true,
      storageKey: 'fsus-test-theme',
    })

    expect(helper).toBe(window.__fsusUiThemeMode)
    expect(window.__fsusUiThemeMode?.set('light')).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(window.localStorage.getItem('fsus-test-theme')).toBe('light')

    window.__fsusUiThemeMode?.clear()

    expect(document.documentElement.dataset.themeMode).toBeUndefined()
    expect(window.localStorage.getItem('fsus-test-theme')).toBeNull()
  })
})
