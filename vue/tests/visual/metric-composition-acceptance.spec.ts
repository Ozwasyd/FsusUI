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

// CSS gate: no card surfaces on metric primitives
test('production CSS has no card surfaces on metric primitives', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  await expect(page.getByTestId('metric-visual-fixtures')).toBeVisible()

  const banned = await page.evaluate(() => {
    const p: string[] = []
    for (const s of Array.from(document.styleSheets)) {
      try {
        const t = Array.from(s.cssRules).map((r) => r.cssText).join('\\n')
        if (t.includes('metric-list') && t.includes('border: 1px solid') && t.includes('12px'))
          p.push('MetricList has card surface')
        if (t.includes('key-value-grid') && t.includes('border: 1px solid'))
          p.push('KeyValueGrid has card surface')
        if (t.includes('diagnostics-item') && t.includes('padding: 12px') && t.includes('border: 1px'))
          p.push('DiagnosticsItem has card surface')
      } catch {}
    }
    return p
  })
  expect(banned).toEqual([])
})

// Typography: 12/14/16px ladder
test('KPI primary value uses 16px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const primary = page.locator('[data-metric-variant="metric-default"] .el-metric-item__primary').first()
  const fontSize = await primary.evaluate((el) => getComputedStyle(el).fontSize)
  expect(parseFloat(fontSize)).toBe(16)
})

test('KeyValue label uses 12px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const label = page.locator('[data-metric-variant="kv-default"] .el-key-value-item__label').first()
  const fontSize = await label.evaluate((el) => getComputedStyle(el).fontSize)
  expect(parseFloat(fontSize)).toBe(12)
})

// MetricList flat
test('MetricList has no card surface', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const list = page.locator('[data-metric-variant="metric-default"] .el-metric-list')
  const borderRadius = await list.evaluate((el) => getComputedStyle(el).borderRadius)
  expect(borderRadius).toBe('0px')
})

// KeyValueGrid flat
test('KeyValueGrid has no card surface', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const grid = page.locator('[data-metric-variant="kv-default"] .el-key-value-grid')
  const borderRadius = await grid.evaluate((el) => getComputedStyle(el).borderRadius)
  expect(borderRadius).toBe('0px')
})

// Diagnostics: 3px left border
test('DiagnosticsItem warning uses 3px left border', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const item = page.locator('[data-metric-variant="diag-default"] .el-diagnostics-item.is-warning')
  const borderLeft = await item.evaluate((el) => getComputedStyle(el).borderLeftWidth)
  expect(parseFloat(borderLeft)).toBe(3)
})

// CopyableDetail: 40px button
test('CopyableDetail button min-height >= 40px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const btn = page.locator('[data-metric-variant="copy-default"] .el-copyable-detail__button')
  const minH = await btn.evaluate((el) => getComputedStyle(el).minHeight)
  expect(parseFloat(minH)).toBeGreaterThanOrEqual(40)
})

test('CopyableDetail focus uses inset ring', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const btn = page.locator('[data-metric-variant="copy-default"] .el-copyable-detail__button')
  await btn.focus()
  const boxShadow = await btn.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(boxShadow).toContain('inset')
})

// Full-page screenshot
test('metric variants render without visual break', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  for (const v of ['metric-default','kpi-default','kv-default','diag-default','diag-danger','copy-default']) {
    await expect(page.locator(`[data-metric-variant="${  v  }"]`)).toBeVisible()
  }
  await page.evaluate(async () => { await document.fonts.ready })
  await page.screenshot({ path: testInfo.outputPath('metric-all-variants.png'), fullPage: true })
})
