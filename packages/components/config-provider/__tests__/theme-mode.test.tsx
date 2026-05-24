import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ConfigProvider from '../src/config-provider'
import { clearThemeMode, syncThemeMode } from '../src/theme-mode'

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
    addEventListener(_type: string, listener: EventListenerOrEventListenerObject | null) {
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
      listener: EventListenerOrEventListenerObject | null
    ) {
      if (!listener) return

      const normalizedListener = listenerMap.get(listener)
      if (!normalizedListener) return

      listeners.delete(normalizedListener)
      listenerMap.delete(listener)
    },
    addListener(callback: (this: MediaQueryList, ev: MediaQueryListEvent) => any) {
      this.addEventListener('change', callback as EventListener)
    },
    removeListener(
      callback: (this: MediaQueryList, ev: MediaQueryListEvent) => any
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
    window.matchMedia = matchMediaController.matchMedia as typeof window.matchMedia
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
    syncThemeMode('system')

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
})
