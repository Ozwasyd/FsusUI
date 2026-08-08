import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'

const diagnostics = new WeakMap<Page, string[]>()

const stabilizePage = async (page: Page) => {
  await page.addStyleTag({
    content: `*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important;animation-delay:0s!important;scroll-behavior:auto!important}`,
  })
}

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

// Check compiled CSS for all zoom-in-* transitions
test('zoom-in transitions use opacity+translate, no axis scale', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)

  const violations = await page.evaluate(() => {
    const v: string[] = []
    for (const s of Array.from(document.styleSheets)) {
      try {
        const t = Array.from(s.cssRules).map((r) => r.cssText).join('\\n')
        // No scaleX(0) or scaleY(0) — axis compression
        if ((t.includes('zoom-in') || t.includes('el-zoom-in')) && /scale[XY]\\(0\\)/.test(t))
          v.push('axis scale-to-zero found')
        // No scale(0.45) — strong zoom
        if ((t.includes('zoom-in') || t.includes('el-zoom-in')) && /scale\\(0\\.45/.test(t))
          v.push('scale(0.45) found')
        // No translateY(-30px) — large displacement
        if (t.includes('list-enter-from') && /translateY\\(-30px\\)/.test(t))
          v.push('30px list displacement found')
        // fade-linear must not have scaleX(0)
        if (t.includes('zoom-in-center') && /scaleX/.test(t))
          v.push('fade-linear axis compression found')
      } catch {}
    }
    return v
  })
  expect(violations).toEqual([])
})

// List displacement <= 8px
test('list transitions use <=8px displacement', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)

  const displacements = await page.evaluate(() => {
    const d: string[] = []
    for (const s of Array.from(document.styleSheets)) {
      try {
        const t = Array.from(s.cssRules).map((r) => r.cssText).join('\\n')
        if (t.includes('list-enter-from') || t.includes('list-leave-to')) {
          const m = t.match(/translateY\\((-?\\d+)px\\)/g)
          if (m) d.push(...m)
        }
      } catch {}
    }
    return d
  })
  for (const d of displacements) {
    const px = parseInt(d.match(/(-?\d+)/)?.[1] ?? '0')
    expect(Math.abs(px)).toBeLessThanOrEqual(8)
  }
})

// Overlay transitions have scale >= 0.98
test('zoom-in overlay transitions have scale >= 0.98', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)

  const scales = await page.evaluate(() => {
    const s: string[] = []
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const t = Array.from(sheet.cssRules).map((r) => r.cssText).join('\\n')
        if (t.includes('zoom-in-bottom-enter-from') || t.includes('zoom-in-left-enter-from')) {
          const m = t.match(/scale\\(([0-9.]+)\\)/g)
          if (m) s.push(...m)
        }
      } catch {}
    }
    return s
  })
  for (const sc of scales) {
    const val = parseFloat(sc.match(/\(([0-9.]+)\)/)?.[1] ?? '0')
    expect(val).toBeGreaterThanOrEqual(0.98)
  }
})

// No legacy 500ms motion
test('no transition uses 500ms', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)

  const has500ms = await page.evaluate(() => {
    for (const s of Array.from(document.styleSheets)) {
      try {
        const t = Array.from(s.cssRules).map((r) => r.cssText).join('\\n')
        if (/transition-duration:\\s*500ms/.test(t)) return true
      } catch {}
    }
    return false
  })
  expect(has500ms).toBe(false)
})

// Legacy alias registry: scss compiles
test('motion scss compiles without error', async () => {
  const { resolve } = await import('node:path')
  const { compile } = await import('sass')
  const result = compile(resolve(process.cwd(), 'vue/packages/theme-chalk/src/fsus.scss'), {
    loadPaths: [resolve(process.cwd(), 'vue/packages/theme-chalk/src')],
  })
  expect(result.css).toBeTruthy()
  expect(result.css).toContain('transition')
})
