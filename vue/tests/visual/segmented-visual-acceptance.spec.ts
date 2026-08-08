import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { collectCssRules } from '../support/css-scan'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'

const diagnostics = new WeakMap<Page, string[]>()

const stabilizePage = async (page: Page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  })
}

const waitForFontsAndLayout = async (page: Page) => {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
}

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

// ============================================================
// CSS Gate: no legacy segmented patterns
// ============================================================

test('production CSS has no legacy segmented tokens', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
  await expect(page.getByTestId('segmented-visual-fixtures')).toBeVisible()

  // Selector-scoped gate: legacy patterns only count when the rule that
  // targets the segmented primitive carries them (joined whole-sheet text
  // false-positives on unrelated rules in the same stylesheet).
  const rules = await collectCssRules(page)
  const bannedPatterns: string[] = []
  for (const rule of rules) {
    const selector = rule.selectorText
    const css = rule.cssText
    if (/opacity:\s*0\.46/.test(css) && selector.includes('radio-button'))
      bannedPatterns.push('ancestor opacity disabled found')
    if (/min-height:\s*28px/.test(css) && selector.includes('segmented-control'))
      bannedPatterns.push('28px item height found in collection')
    if (/outline:\s*2px solid/.test(css) && selector.includes('segmented') && !css.includes('inset'))
      bannedPatterns.push('outer outline focus found')
    if (/box-shadow:\s*inset 0 0 0 1px/.test(css) && selector.includes('radio-button'))
      bannedPatterns.push('1px focus ring found')
  }
  expect(bannedPatterns).toEqual([])
})

// ============================================================
// Geometry: shell = 6px, item = 36-40px
// ============================================================

test('RadioButton shell radius is 6px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const item = page.locator('[data-segmented-variant="radio-default"] .el-radio-button__inner').first()
  await expect(item).toBeVisible()
  const radius = await item.evaluate((el) => getComputedStyle(el).borderRadius)
  expect(parseFloat(radius)).toBe(6)
})

test('RadioButton item height is 36-40px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const item = page.locator('[data-segmented-variant="radio-default"] .el-radio-button__inner').first()
  const height = await item.evaluate((el) => getComputedStyle(el).height)
  const h = parseFloat(height)
  expect(h).toBeGreaterThanOrEqual(36)
  expect(h).toBeLessThanOrEqual(40)
})

test('CheckboxButton item height is 36-40px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const item = page.locator('[data-segmented-variant="checkbox-default"] .el-checkbox-button__inner').first()
  const height = await item.evaluate((el) => getComputedStyle(el).height)
  const h = parseFloat(height)
  expect(h).toBeGreaterThanOrEqual(36)
  expect(h).toBeLessThanOrEqual(40)
})

test('Collection segmented item height >= 36px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const item = page.locator('[data-segmented-variant="collection-default"] .el-segmented-control__item').first()
  const minHeight = await item.evaluate((el) => getComputedStyle(el).minHeight)
  expect(parseFloat(minHeight)).toBeGreaterThanOrEqual(36)
})

// ============================================================
// Selected state: Scholarly Blue
// ============================================================

test('RadioButton selected has non-neutral background', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const checkedItem = page.locator('[data-segmented-variant="radio-default"] .is-active .el-radio-button__inner')
  await expect(checkedItem).toBeVisible()
  const bg = await checkedItem.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).toBeTruthy()
  expect(bg).not.toBe('rgba(0, 0, 0, 0)')
})

// ============================================================
// Focus: 2px inset ring
// ============================================================

test('RadioButton focus-visible uses 2px inset ring', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const input = page.locator('[data-segmented-variant="radio-default"] .el-radio-button__original-radio').first()
  await input.focus()
  await expect(input).toBeFocused()
  const inner = page.locator('[data-segmented-variant="radio-default"] .el-radio-button__inner').first()
  const boxShadow = await inner.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(boxShadow).toContain('inset')
  expect(boxShadow).not.toBe('none')
})

test('Collection segmented focus-visible uses inset ring', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const item = page.locator('[data-segmented-variant="collection-default"] .el-segmented-control__item').first()
  await item.focus()
  await expect(item).toBeFocused()
  const boxShadow = await item.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(boxShadow).toContain('inset')
})

// ============================================================
// Disabled: opacity = 1
// ============================================================

test('RadioButton disabled has opacity 1', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const item = page.locator('[data-segmented-variant="radio-disabled"] .el-radio-button__inner').first()
  const opacity = await item.evaluate((el) => getComputedStyle(el).opacity)
  expect(parseFloat(opacity)).toBe(1)
})

test('CheckboxButton disabled has opacity 1', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const item = page.locator('[data-segmented-variant="checkbox-disabled"] .el-checkbox-button__inner').first()
  const opacity = await item.evaluate((el) => getComputedStyle(el).opacity)
  expect(parseFloat(opacity)).toBe(1)
})

// ============================================================
// ARIA roles: Radio vs Checkbox vs Tab
// ============================================================

test('RadioButton uses role=radio', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const input = page.locator('[data-segmented-variant="radio-default"] .el-radio-button__original-radio').first()
  const role = await input.getAttribute('role')
  expect(role).toBe('radio')
})

test('CheckboxButton uses role=checkbox', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const input = page.locator('[data-segmented-variant="checkbox-default"] .el-checkbox-button__original').first()
  const role = await input.getAttribute('role')
  expect(role).toBe('checkbox')
})

test('Collection segmented uses role=tab', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const item = page.locator('[data-segmented-variant="collection-default"] .el-segmented-control__item').first()
  const role = await item.getAttribute('role')
  expect(role).toBe('tab')
})

// ============================================================
// Keyboard navigation
// ============================================================

test('RadioButton supports arrow key navigation', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const firstInput = page.locator('[data-segmented-variant="radio-default"] .el-radio-button__original-radio').first()
  await firstInput.focus()
  await expect(firstInput).toBeFocused()
  await page.keyboard.press('ArrowRight')
  const secondInput = page.locator('[data-segmented-variant="radio-default"] .el-radio-button__original-radio').nth(1)
  await expect(secondInput).toBeFocused()
})

// ============================================================
// RTL
// ============================================================

test('RadioButton renders correctly in RTL', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const rtlContainer = page.locator('[data-segmented-variant="radio-rtl"]')
  const dir = await rtlContainer.getAttribute('dir')
  expect(dir).toBe('rtl')
  const group = rtlContainer.locator('.el-radio-group')
  await expect(group).toBeVisible()
})

// ============================================================
// CheckboxButton multi-selection
// ============================================================

test('CheckboxButton supports multi-selection', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const items = page.locator('[data-segmented-variant="checkbox-multi"] .el-checkbox-button')
  // is-checked is applied to the button label itself, so :scope is required;
  // toHaveCount auto-waits for Vue to flush the pre-selected state. The
  // fixture model is ['a', 'c'], so exactly two buttons must be checked.
  await expect(items.locator(':scope.is-checked')).toHaveCount(2)
})

// ============================================================
// ThemeModeToggle
// ============================================================

test('ThemeModeToggle renders in segmented mode', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const toggle = page.locator('[data-segmented-variant="toggle-default"] .el-theme-mode-toggle')
  await expect(toggle).toBeVisible()
})

test('ThemeModeToggle focus-visible uses inset ring', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const input = page.locator('[data-segmented-variant="toggle-default"] .el-radio-button__original-radio').first()
  await input.focus()
  const inner = page.locator('[data-segmented-variant="toggle-default"] .el-radio-button__inner').first()
  const boxShadow = await inner.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(boxShadow).toContain('inset')
})

// ============================================================
// CJK rendering
// ============================================================

test('RadioButton renders CJK without cutoff', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const cjkItem = page.locator('[data-segmented-variant="radio-cjk"] .el-radio-button').first()
  await expect(cjkItem).toBeVisible()
  await expect(cjkItem).toContainText('简体中文')
})

// ============================================================
// Full-page screenshot
// ============================================================

test('segmented variants render without visual break', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  const fixtures = [
    'radio-default', 'radio-disabled', 'radio-six', 'radio-cjk', 'radio-rtl',
    'checkbox-default', 'checkbox-disabled', 'checkbox-multi',
    'toggle-default', 'toggle-menu',
    'collection-default', 'collection-six',
  ]
  for (const variant of fixtures) {
    await expect(page.locator(`[data-segmented-variant="${  variant  }"]`)).toBeVisible()
  }
  await waitForFontsAndLayout(page)
  await page.screenshot({
    path: testInfo.outputPath('segmented-all-variants.png'),
    fullPage: true,
  })
})
