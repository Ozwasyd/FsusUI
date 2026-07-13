import { nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ConfigProvider from '../src/config-provider'
import {
  clearMotionConfig,
  defaultMotionConfig,
  normalizeMotionConfig,
  syncMotionConfig,
} from '../src/motion'

type MatchMediaController = ReturnType<typeof createMatchMediaController>

const createMatchMediaController = (initialMatches = false) => {
  let matches = initialMatches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const listenerMap = new Map<
    EventListenerOrEventListenerObject,
    (event: MediaQueryListEvent) => void
  >()

  const mediaQueryList = {
    media: '(prefers-reduced-motion: reduce)',
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

describe('motion-config', () => {
  let originalMatchMedia: typeof window.matchMedia | undefined
  let matchMediaController: MatchMediaController

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
    matchMediaController = createMatchMediaController(false)
    window.matchMedia =
      matchMediaController.matchMedia as typeof window.matchMedia
    clearMotionConfig()
  })

  afterEach(() => {
    clearMotionConfig()
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia
      return
    }

    delete (window as Partial<Window>).matchMedia
  })

  it('defaults to the quiet standard runtime budget', () => {
    syncMotionConfig()

    const root = document.documentElement
    expect(defaultMotionConfig.preset).toBe('standard')
    expect(normalizeMotionConfig().preset).toBe('standard')
    expect(root.dataset.fsusMotionPreset).toBe('standard')
    expect(root.style.getPropertyValue('--fsus-motion-control')).toBe('220ms')
    expect(root.style.getPropertyValue('--fsus-motion-panel')).toBe('360ms')
    expect(root.style.getPropertyValue('--fsus-motion-blur')).toBe('0px')
    expect(root.style.getPropertyValue('--fsus-motion-drag-blur')).toBe('0px')
    expect(root.style.getPropertyValue('--fsus-motion-trail')).toBe(
      'transparent',
    )
    expect(root.style.getPropertyValue('--fsus-motion-slider-trail')).toBe(
      'transparent',
    )
    expect(
      root.style.getPropertyValue('--fsus-motion-scroll-trail-opacity'),
    ).toBe('0')
    expect(root.style.getPropertyValue('--fsus-motion-drag-scale')).toBe('0')
  })

  it('keeps smooth and expressive available only through explicit selection', () => {
    for (const preset of ['smooth', 'expressive'] as const) {
      syncMotionConfig({ mode: 'enabled', preset })
      expect(document.documentElement.dataset.fsusMotionPreset).toBe(preset)
    }

    syncMotionConfig({ preset: 'unknown' as never })
    expect(document.documentElement.dataset.fsusMotionPreset).toBe('standard')
  })

  it('syncs explicit motion preset tokens to the document root', () => {
    syncMotionConfig({
      mode: 'enabled',
      preset: 'expressive',
      budget: {
        maxStaggerItems: 12,
        maxAnimatedNodesPerViewport: 24,
      },
    })

    const root = document.documentElement
    expect(root.dataset.fsusMotionMode).toBe('enabled')
    expect(root.dataset.fsusMotion).toBe('enabled')
    expect(root.dataset.fsusMotionPreset).toBe('expressive')
    expect(root.dataset.fsusMotionMaxStaggerItems).toBe('12')
    expect(root.dataset.fsusMotionMaxAnimatedNodesPerViewport).toBe('24')
    expect(root.style.getPropertyValue('--fsus-motion-panel')).toBe('520ms')
    expect(root.style.getPropertyValue('--fsus-motion-distance-sm')).toBe(
      '10px',
    )
    expect(root.style.getPropertyValue('--fsus-motion-stagger')).toBe('70ms')
    expect(root.style.getPropertyValue('--fsus-motion-scroll-settle')).toBe(
      '150ms',
    )
    expect(root.style.getPropertyValue('--fsus-motion-spring-damping')).toBe(
      '24',
    )
  })

  it('tracks system reduced motion changes', () => {
    syncMotionConfig({ mode: 'system', preset: 'smooth' })

    expect(document.documentElement.dataset.fsusMotion).toBe('enabled')

    matchMediaController.setMatches(true)

    expect(document.documentElement.dataset.fsusMotionMode).toBe('system')
    expect(document.documentElement.dataset.fsusMotion).toBe('reduced')
    expect(
      document.documentElement.style.getPropertyValue('--fsus-motion-blur'),
    ).toBe('0px')
  })

  it('restores parent motion when a nested provider unmounts', async () => {
    const showNestedProvider = ref(true)
    const wrapper = mount(() => (
      <ConfigProvider motion={{ mode: 'enabled', preset: 'standard' }}>
        {showNestedProvider.value ? (
          <ConfigProvider motion={{ mode: 'disabled', preset: 'expressive' }}>
            <div>nested</div>
          </ConfigProvider>
        ) : (
          <div>root</div>
        )}
      </ConfigProvider>
    ))

    expect(document.documentElement.dataset.fsusMotion).toBe('disabled')
    expect(document.documentElement.dataset.fsusMotionPreset).toBe('expressive')

    showNestedProvider.value = false
    await nextTick()

    expect(document.documentElement.dataset.fsusMotion).toBe('enabled')
    expect(document.documentElement.dataset.fsusMotionPreset).toBe('standard')

    wrapper.unmount()
    expect(document.documentElement.dataset.fsusMotion).toBeUndefined()
  })
})
