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

// CSS gate: no card surfaces on metric primitives
test('production CSS has no card surfaces on metric primitives', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  await expect(page.getByTestId('metric-visual-fixtures')).toBeVisible()

  // Selector-scoped gate: a card surface only counts when a rule that targets
  // the primitive itself carries the card pattern (joined whole-sheet text
  // would match unrelated rules in the same stylesheet).
  const rules = await collectCssRules(page)
  const banned: string[] = []
  for (const rule of rules) {
    const css = rule.cssText
    if (rule.selectorText.includes('metric-list') && /border:\s*1px\s+solid/.test(css) && /\b12px\b/.test(css))
      banned.push('MetricList has card surface')
    if (rule.selectorText.includes('key-value-grid') && /border:\s*1px\s+solid/.test(css))
      banned.push('KeyValueGrid has card surface')
    if (rule.selectorText.includes('diagnostics-item') && /padding:\s*12px/.test(css) && /border:\s*1px/.test(css))
      banned.push('DiagnosticsItem has card surface')
  }
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

test('ordinary metric labels and values stay within the approved typography budget', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)

  const selectors = [
    '.el-distribution-bar-row__value',
    '.el-key-value-item__label',
    '.el-key-value-item__value',
    '.el-status-summary__label',
    '.el-status-summary__status',
    '.el-diagnostics-item__detail-toggle',
    '.el-copyable-detail__button',
  ]
  for (const selector of selectors) {
    await expect(page.locator(selector).first(), selector).toBeVisible()
  }
  const computed = await page
    .locator(selectors.join(','))
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element)
        return {
          className: element.className,
          fontSize: Number.parseFloat(style.fontSize),
          fontWeight: Number.parseInt(style.fontWeight, 10),
        }
      }),
    )

  expect(computed.length).toBeGreaterThan(0)
  for (const entry of computed) {
    expect([12, 14, 16], entry.className).toContain(entry.fontSize)
    expect(entry.fontWeight, entry.className).toBeLessThanOrEqual(500)
  }
})

test('default key labels omit punctuation and the explicit motif remains decorative gray', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)

  const labels = page.locator('.el-key-value-item__label')
  const pseudoContent = await labels.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element, '::before').content),
  )
  expect(
    pseudoContent.every(
      (content) => content === 'none' || content === 'normal',
    ),
  ).toBe(true)

  const motif = page.locator(
    '.el-key-value-item__badge [aria-label="Highlighted metric"]',
  )
  await expect(motif).toHaveText('·')
  const colors = await motif.evaluate((element) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--fsus-dot-gray)'
    document.body.append(probe)
    const expected = getComputedStyle(probe).color
    probe.remove()
    return {
      actual: getComputedStyle(element.parentElement as Element).color,
      expected,
    }
  })
  expect(colors.actual).toBe(colors.expected)
})

test('CJK and RTL metric content preserve hierarchy and direction', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)

  const cjk = page.locator('[data-metric-typography="cjk"]')
  const rtl = page.locator('[data-metric-typography="rtl"]')
  await expect(cjk.getByText('请求延迟')).toBeVisible()
  await expect(rtl.getByText('زمن الاستجابة')).toBeVisible()
  await expect(rtl).toHaveAttribute('dir', 'rtl')

  for (const item of [cjk, rtl]) {
    const geometry = await item.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  }
})

test('long and RTL metric content reflows at 200 percent zoom', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  await page.evaluate(() => {
    document.documentElement.style.zoom = '200%'
  })

  for (const selector of [
    '[data-metric-typography="long"]',
    '[data-metric-typography="rtl"]',
  ]) {
    const item = page.locator(selector)
    await expect(item).toBeVisible()
    const geometry = await item.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  }
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
  for (const v of ['metric-default','kpi-default','distribution-default','kv-default','status-default','diag-default','diag-danger','copy-default']) {
    await expect(page.locator(`[data-metric-variant="${  v  }"]`)).toBeVisible()
  }
  await page.evaluate(async () => { await document.fonts.ready })
  await page.screenshot({ path: testInfo.outputPath('metric-all-variants.png'), fullPage: true })
})
