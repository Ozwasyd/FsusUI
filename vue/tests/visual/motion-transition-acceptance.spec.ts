import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { collectCssRules } from '../support/css-scan'
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

  // Selector-scoped gate: evaluate each rule against its own selector and
  // declarations, not joined whole-sheet text (cross-rule joins false-positive
  // on unrelated rules in the same stylesheet).
  const rules = await collectCssRules(page)
  const violations: string[] = []
  for (const rule of rules) {
    const selector = rule.selectorText
    const css = rule.cssText
    if ((selector.includes('zoom-in') || selector.includes('el-zoom-in')) && /scale[XY]\(0\)/.test(css))
      violations.push('axis scale-to-zero found')
    if ((selector.includes('zoom-in') || selector.includes('el-zoom-in')) && /scale\(0\.45\)/.test(css))
      violations.push('scale(0.45) found')
    if (selector.includes('list-enter-from') && /translateY\(-30px\)/.test(css))
      violations.push('30px list displacement found')
    if (selector.includes('zoom-in-center') && /scaleX/.test(css))
      violations.push('fade-linear axis compression found')
  }
  expect(violations).toEqual([])
})

// List displacement <= 8px
test('list transitions use <=8px displacement', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)

  const rules = await collectCssRules(page)
  const displacements: string[] = []
  for (const rule of rules) {
    if (
      rule.selectorText.includes('list-enter-from') ||
      rule.selectorText.includes('list-leave-to')
    ) {
      const m = rule.cssText.match(/translateY\((-?\d+)px\)/g)
      if (m) displacements.push(...m)
    }
  }
  for (const d of displacements) {
    const px = parseInt(d.match(/(-?\d+)/)?.[1] ?? '0')
    expect(Math.abs(px)).toBeLessThanOrEqual(8)
  }
})

// Overlay transitions have scale >= 0.98
test('zoom-in overlay transitions have scale >= 0.98', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)

  const rules = await collectCssRules(page)
  const scales: string[] = []
  for (const rule of rules) {
    if (
      rule.selectorText.includes('zoom-in-bottom-enter-from') ||
      rule.selectorText.includes('zoom-in-left-enter-from')
    ) {
      const m = rule.cssText.match(/scale\(([0-9.]+)\)/g)
      if (m) scales.push(...m)
    }
  }
  for (const sc of scales) {
    const val = parseFloat(sc.match(/\(([0-9.]+)\)/)?.[1] ?? '0')
    expect(val).toBeGreaterThanOrEqual(0.98)
  }
})

// No legacy 500ms motion
test('no transition uses 500ms', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)

  const rules = await collectCssRules(page)
  const has500ms = rules.some((rule) =>
    /transition-duration:\s*500ms/.test(rule.cssText),
  )
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
