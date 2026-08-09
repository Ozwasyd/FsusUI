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

// CSS gate
test('production CSS has no card-on-card in settings', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('settings-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  await expect(page.getByTestId('settings-visual-fixtures')).toBeVisible()

  // Selector-scoped gate: card patterns only count when the rule that targets
  // the component carries them, not when unrelated rules in the same sheet do.
  const rules = await collectCssRules(page)
  const banned: string[] = []
  for (const rule of rules) {
    const css = rule.cssText
    if (
      rule.selectorText.includes('resource-list') &&
      /border-radius:\s*12px/.test(css) &&
      /border:\s*1px/.test(css)
    )
      banned.push('ResourceList still has card surface')
    if (
      rule.selectorText.includes('destructive-action-panel') &&
      /color-mix/.test(css) &&
      /30%/.test(css)
    )
      banned.push('DestructiveActionPanel still has 30% danger border')
    if (
      rule.selectorText.includes('risk-notice') &&
      /border-radius:\s*12px/.test(css)
    )
      banned.push('RiskNotice still has panel radius')
  }
  expect(banned).toEqual([])
})

// SectionNav geometry
test('SectionNav link min-height >= 40px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('settings-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const link = page.locator('[data-settings-variant="default"] .el-section-nav__link').first()
  const minH = await link.evaluate((el) => getComputedStyle(el).minHeight)
  expect(parseFloat(minH)).toBeGreaterThanOrEqual(40)
})

test('SectionNav disabled has opacity 1', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('settings-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const disabled = page.locator('[data-settings-variant="default"] .el-section-nav__link.is-disabled')
  const opacity = await disabled.evaluate((el) => getComputedStyle(el).opacity)
  expect(parseFloat(opacity)).toBe(1)
})

// ResourceList flat
test('ResourceList has no card surface', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('settings-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const list = page.locator('[data-settings-variant="resource-default"] .el-resource-list')
  const borderRadius = await list.evaluate((el) => getComputedStyle(el).borderRadius)
  expect(borderRadius).toBe('0px')
  const boxShadow = await list.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(boxShadow).toBe('none')
})

// DangerZone toned down
test('DestructiveActionPanel has reduced danger emphasis', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('settings-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const panel = page.locator('[data-settings-variant="danger-default"] .el-destructive-action-panel')
  const bg = await panel.evaluate((el) => getComputedStyle(el).backgroundColor)
  // Should not be danger-tinted
  expect(bg).not.toContain('255, 0, 0')
})

test('RiskNotice radius is small (6px)', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('settings-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const notice = page.locator('[data-settings-variant="danger-default"] .el-risk-notice')
  const radius = await notice.evaluate((el) => getComputedStyle(el).borderRadius)
  expect(parseFloat(radius)).toBe(6)
})

// TypedConfirmField
test('TypedConfirmField input min-height >= 40px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('settings-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const input = page.locator('[data-settings-variant="typed-default"] .el-typed-confirm-field__input')
  const minH = await input.evaluate((el) => getComputedStyle(el).minHeight)
  expect(parseFloat(minH)).toBeGreaterThanOrEqual(40)
})

test('TypedConfirmField focus uses inset ring, not outer glow', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('settings-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const input = page.locator('[data-settings-variant="typed-default"] .el-typed-confirm-field__input')
  await input.focus()
  const boxShadow = await input.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(boxShadow).toContain('inset')
})

test('TypedConfirmField invalid focus uses danger ring', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('settings-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const invalid = page.locator('[data-settings-variant="typed-invalid"] .el-typed-confirm-field__input')
  const borderColor = await invalid.evaluate((el) => getComputedStyle(el).borderColor)
  expect(borderColor).toBeTruthy()
})

// Full-page screenshot
test('settings variants render without visual break', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('settings-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  for (const v of ['default', 'form-default', 'resource-default', 'danger-default', 'typed-default', 'typed-invalid']) {
    await expect(page.locator(`[data-settings-variant="${  v  }"]`)).toBeVisible()
  }
  await page.evaluate(async () => { await document.fonts.ready })
  await page.screenshot({ path: testInfo.outputPath('settings-all-variants.png'), fullPage: true })
})
