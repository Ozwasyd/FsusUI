import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface SafeAreaProfile {
  id: 'no-inset' | 'portrait-notch' | 'landscape-notch' | 'short-visual'
  viewport: { width: number; height: number }
  insets: { top: number; right: number; bottom: number; left: number }
}

export const SAFE_AREA_PROFILES: readonly SafeAreaProfile[] = [
  {
    id: 'no-inset',
    viewport: { width: 390, height: 844 },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  {
    id: 'portrait-notch',
    viewport: { width: 390, height: 844 },
    insets: { top: 47, right: 0, bottom: 34, left: 0 },
  },
  {
    id: 'landscape-notch',
    viewport: { width: 844, height: 390 },
    insets: { top: 0, right: 59, bottom: 21, left: 59 },
  },
  {
    id: 'short-visual',
    viewport: { width: 390, height: 430 },
    insets: { top: 47, right: 0, bottom: 34, left: 0 },
  },
]

export async function applySafeAreaProfile(
  page: Page,
  profile: SafeAreaProfile,
) {
  await page.setViewportSize(profile.viewport)
  await page.evaluate((p) => {
    const root = document.documentElement
    root.style.setProperty('--fsus-safe-area-inset-top', `${p.insets.top}px`)
    root.style.setProperty('--fsus-safe-area-inset-right', `${p.insets.right}px`)
    root.style.setProperty(
      '--fsus-safe-area-inset-bottom',
      `${p.insets.bottom}px`,
    )
    root.style.setProperty('--fsus-safe-area-inset-left', `${p.insets.left}px`)
    root.style.setProperty('--fsus-viewport-block-size', `${p.viewport.height}px`)
  }, profile)
}

export function attachPageErrorCollector(page: Page) {
  const errors: string[] = []
  const warnings: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console.error: ${message.text()}`)
    } else if (message.type() === 'warning') {
      warnings.push(message.text())
    }
  })
  return { errors, warnings }
}

export async function installGlobalListenerTracker(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>
    if (w.__listenerTrackerInstalled) return
    const active = new Map<string, Set<EventListenerOrEventListenerObject>>()
    const makeKey = (
      target: 'window' | 'document',
      type: string,
      options?: boolean | AddEventListenerOptions,
    ) => {
      const capture =
        typeof options === 'boolean' ? options : Boolean(options?.capture)
      return `${target}:${type}:${capture}`
    }

    const patch = (target: 'window' | 'document', obj: EventTarget) => {
      const origAdd = obj.addEventListener.bind(obj)
      const origRemove = obj.removeEventListener.bind(obj)
      obj.addEventListener = ((
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) => {
        if (listener) {
          const key = makeKey(target, type, options)
          if (!active.has(key)) active.set(key, new Set())
          active.get(key)!.add(listener)
        }
        return origAdd(type, listener, options)
      }) as typeof obj.addEventListener

      obj.removeEventListener = ((
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions,
      ) => {
        if (listener) {
          const key = makeKey(target, type, options)
          const set = active.get(key)
          set?.delete(listener)
          if (set && set.size === 0) active.delete(key)
        }
        return origRemove(type, listener, options)
      }) as typeof obj.removeEventListener
    }

    patch('window', window)
    patch('document', document)
    w.__listenerTrackerInstalled = true
    w.__getTrackedListenerCount = () => {
      let total = 0
      for (const set of active.values()) total += set.size
      return total
    }
    w.__getTrackedListenerSummary = () =>
      Array.from(active.entries()).map(([k, set]) => `${k}=${set.size}`)
  })
}

export async function getTrackedListenerCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const fn = (window as unknown as { __getTrackedListenerCount?: () => number })
      .__getTrackedListenerCount
    return fn ? fn() : 0
  })
}

export async function measureControl(control: Locator) {
  return control.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    const hit = document.elementFromPoint(cx, cy)
    const svg = element.querySelector('svg')
    const svgRect = svg?.getBoundingClientRect()
    return {
      x: rect.x,
      y: rect.y,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      reachable: hit !== null && element.contains(hit),
      hasVisibleSvg: Boolean(svgRect && svgRect.width > 0 && svgRect.height > 0),
    }
  })
}

export async function waitForViewerImageLoaded(viewer: Locator) {
  await expect(viewer).toBeVisible()
  await expect(viewer).not.toHaveClass(/viewer-fade-enter-active/)
  await expect
    .poll(() =>
      viewer
        .locator('img:visible')
        .first()
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true)
}

export function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function parseCssRgb(color: string): [number, number, number] {
  const match = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/u)
  if (!match) {
    throw new Error(`Unable to parse CSS color: "${color}"`)
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}
