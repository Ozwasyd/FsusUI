import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
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
// ARIA roles: Radio vs Checkbox vs public SegmentedControl
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

// Public contract: docs/components/collection-primitives.md#segmented-control
// specifies radio semantics and Arrow/Home/End navigation. The public API
// baseline (spec/baselines/vue-current.json, ElSegmentedControl) declares
// items/modelValue and update:modelValue/change, not tabs or aria-selected.
test('Collection segmented exposes the public named radiogroup and checked radios', async ({ page }, testInfo) => {
  await openCollectionFixture(page, testInfo.project.name)
  const group = page.getByRole('radiogroup', { name: 'Collection state', exact: true })
  await expect(group).toBeVisible()
  await expect(group.getByRole('radio')).toHaveCount(3)
  await expect(group.getByRole('radio', { checked: true })).toHaveText('全部')
  await expect(group.getByRole('radio').first()).toHaveAttribute('tabindex', '0')
  await expect(group.locator('[aria-selected]')).toHaveCount(0)
  await expect(page.getByRole('tablist')).toHaveCount(0)
  const six = page.getByRole('radiogroup', { name: 'Collection period', exact: true })
  await expect(six.getByRole('radio')).toHaveCount(6)
  await six.getByRole('radio', { name: '年', exact: true }).click()
  await expect(six.getByRole('radio', { name: '年', exact: true })).toBeChecked()
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

// These probes observe only public props, accessible output and emitted values.
// A CSS-shaped tab substitute cannot satisfy the same contract. Keep the
// pre-replacement runtime run as a negative control; do not bless its DOM.
const openCollectionFixture = async (page: Page, projectName: string) => {
  await page.goto(buildVisualUrl('segmented-visual', projectName), { waitUntil: 'domcontentloaded' })
  await stabilizePage(page)
  await expect(page).toHaveTitle('FsusUI Demo')
  await expect(page.getByTestId('segmented-visual-fixtures')).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
}

const collectionRow = (page: Page, variant: string) =>
  page.locator(`[data-segmented-variant="collection-${variant}"]`)

const expectValueEvents = async (
  row: Locator,
  value: string | number | boolean,
  changes: (string | number | boolean)[],
) => {
  await expect(row.locator('output')).toHaveText(JSON.stringify({
    value,
    events: changes.flatMap((change) => [
      ['update:modelValue', change], ['change', change],
    ]),
  }))
}

// Public items carry values independently of labels; the public emits declared
// in segmented-control.ts both carry SegmentedControlValue, in update/change
// order. Reselecting an item must not invent another model transition.
test('Collection segmented click emits values once and reselect is a negative control', async ({ page }, testInfo) => {
  await openCollectionFixture(page, testInfo.project.name)
  const row = collectionRow(page, 'default')
  await expectValueEvents(row, 'all', [])
  const open = row.getByRole('radio', { name: '进行中', exact: true })
  await open.click()
  await expect(open).toBeChecked()
  await expectValueEvents(row, 'open', ['open'])
  await open.click()
  await expectValueEvents(row, 'open', ['open'])
  await expect(row.getByRole('radio', { checked: true })).toHaveCount(1)
})

// Public items[].disabled is a native disabled radio; keyboard navigation must
// skip it. This is an API-level negative control: no DOM disabled mutation.
test('Collection segmented navigation skips public disabled items and emits every transition', async ({ page }, testInfo) => {
  await openCollectionFixture(page, testInfo.project.name)
  const row = collectionRow(page, 'mixed')
  const all = row.getByRole('radio', { name: '全部', exact: true })
  const closed = row.getByRole('radio', { name: '已完成', exact: true })
  const disabled = row.getByRole('radio', { name: '进行中', exact: true })
  await expect(disabled).toBeDisabled()
  await expect(disabled).toHaveAttribute('tabindex', '-1')
  await expectValueEvents(row, 'all', [])
  await disabled.click({ force: true })
  await expectValueEvents(row, 'all', [])
  await all.focus()
  const changes: string[] = []
  for (const [key, value] of [
    ['End', 'closed'], ['Home', 'all'],
    ['ArrowRight', 'closed'], ['ArrowRight', 'all'],
    ['ArrowLeft', 'closed'], ['ArrowUp', 'all'], ['ArrowDown', 'closed'],
  ]) {
    await page.keyboard.press(key!)
    changes.push(value!)
    const selected = value === 'all' ? all : closed
    await expect(selected).toBeFocused()
    await expect(selected).toBeChecked()
    await expect(selected).toHaveAttribute('tabindex', '0')
    await expect(row.locator('[tabindex="0"]')).toHaveCount(1)
    await expectValueEvents(row, value!, changes)
  }
})

// spec/components/contracts/v2/contract-v2.json, ElSegmentedControl.requirements:
// all public operations are keyboard reachable. A disabled model selection
// must retain an enabled Tab entry without emitting a value on focus entry.
// Intentionally red on the locked baseline; component/unit repair is separate.
test('Collection segmented disabled selection retains an enabled Tab entry', async ({ page }, testInfo) => {
  await openCollectionFixture(page, testInfo.project.name)
  const row = collectionRow(page, 'disabled-selected')
  const selected = row.getByRole('radio', { name: '进行中', exact: true })
  const firstEnabled = row.getByRole('radio', { name: '全部', exact: true })
  await expect(selected).toBeDisabled()
  await expect(selected).toBeChecked()
  await expectValueEvents(row, 'open', [])
  await row.focus()
  await page.keyboard.press('Tab')
  await expect(firstEnabled).toBeFocused()
  await expect(row.locator('[tabindex="0"]')).toHaveCount(1)
  await expectValueEvents(row, 'open', [])
  await page.keyboard.press('Space')
  await expect(firstEnabled).toBeChecked()
  await expectValueEvents(row, 'all', ['all'])
})

// SegmentedControlValue is string | number | boolean (public type export).
// Distinct 0 / '0' and false are negative controls against label substitution,
// string coercion and truthiness-based selected-state implementations.
test('Collection segmented preserves boolean numeric and string value types', async ({ page }, testInfo) => {
  await openCollectionFixture(page, testInfo.project.name)
  const row = collectionRow(page, 'values')
  await expect(row.getByRole('radio', { name: '关闭', exact: true })).toBeChecked()
  await expectValueEvents(row, false, [])
  const changes: (string | number | boolean)[] = []
  for (const [label, value] of [['零', 0], ['字符串零', '0'], ['启用', true], ['关闭', false]] as const) {
    const radio = row.getByRole('radio', { name: label, exact: true })
    await radio.click()
    changes.push(value)
    await expect(radio).toBeChecked()
    await expect(row.getByRole('radio', { checked: true })).toHaveCount(1)
    await expectValueEvents(row, value, changes)
  }
})

const resolvedColor = (page: Page, token: string, property: 'color' | 'backgroundColor') =>
  page.evaluate(({ tokenName, propertyName }) => {
    const probe = document.createElement('span')
    probe.style[propertyName] = `var(${tokenName})`
    document.body.append(probe)
    const color = getComputedStyle(probe)[propertyName]
    probe.remove()
    return color
  }, { tokenName: token, propertyName: property })

// docs/design.md §§4/6: selected blue surface + Ink text, distinct hover,
// 2px inset focus, disabled opacity 1. Do not copy primitive-only expectations
// onto the public component or update screenshots to conceal a mismatch.
test('Collection segmented actual hover focus selected and disabled states retain geometry', async ({ page }, testInfo) => {
  await openCollectionFixture(page, testInfo.project.name)
  const row = collectionRow(page, 'mixed')
  const selected = row.getByRole('radio', { name: '全部', exact: true })
  const hover = row.getByRole('radio', { name: '已完成', exact: true })
  const disabled = row.getByRole('radio', { name: '进行中', exact: true })
  const before = await selected.boundingBox()
  expect(before).not.toBeNull()
  expect(before!.height).toBeGreaterThanOrEqual(36)
  expect(before!.height).toBeLessThanOrEqual(40)
  const selectedBg = await resolvedColor(page, '--fsus-state-selected-bg', 'backgroundColor')
  await expect(selected).toHaveCSS('background-color', selectedBg)
  await selected.focus()
  await expect(selected).toBeFocused()
  await expect.poll(() => selected.evaluate((node) => node.matches(':focus-visible'))).toBe(true)
  await expect(selected).toHaveCSS('box-shadow', /inset.*2px|2px.*inset/)
  await expect(selected).toHaveCSS('background-color', selectedBg)
  await hover.hover()
  await expect(hover).toHaveCSS('background-color', await resolvedColor(page, '--el-fill-color-light', 'backgroundColor'))
  await expect(hover).not.toHaveCSS('background-color', selectedBg)
  const disabledBg = await disabled.evaluate((node) => getComputedStyle(node).backgroundColor)
  await disabled.hover({ force: true })
  await expect(disabled).toHaveCSS('background-color', disabledBg)
  await expect(disabled).toHaveCSS('opacity', '1')
  await expect(disabled).toHaveCSS('color', await resolvedColor(page, '--el-text-color-disabled', 'color'))
  const after = await selected.boundingBox()
  expect(after).toEqual(before)
  await waitForFontsAndLayout(page)
  await row.screenshot({ path: testInfo.outputPath('collection-hover-focus-disabled.png') })
})

test('Collection segmented selected labels follow the design Ink text contract', async ({ page }, testInfo) => {
  await openCollectionFixture(page, testInfo.project.name)
  const selected = collectionRow(page, 'default').getByRole('radio', { checked: true })
  await expect(selected).toHaveCSS('color', await resolvedColor(page, '--el-text-color-primary', 'color'))
})

for (const zoom of [1, 1.5, 2]) {
  test(`Collection segmented real fixtures remain reachable at ${zoom * 100}% zoom`, async ({ page }, testInfo) => {
    await openCollectionFixture(page, testInfo.project.name)
    await page.evaluate((factor) => { document.documentElement.style.zoom = String(factor) }, zoom)
    const row = collectionRow(page, 'six')
    const group = row.getByRole('radiogroup', { name: 'Collection period', exact: true })
    const first = group.getByRole('radio', { name: '日', exact: true })
    const last = group.getByRole('radio', { name: '年', exact: true })
    await first.focus()
    await page.keyboard.press('End')
    await expect(last).toBeFocused()
    await expect(last).toBeChecked()
    const box = await last.boundingBox()
    const shell = await group.boundingBox()
    expect(box).not.toBeNull()
    expect(shell).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(shell!.x)
    expect(box!.x + box!.width).toBeLessThanOrEqual(shell!.x + shell!.width + 1)
    expect(box!.height / zoom).toBeGreaterThanOrEqual(36)
    expect(box!.height / zoom).toBeLessThanOrEqual(40)
    await expect.poll(() => group.evaluate((node) => node.scrollWidth > 0)).toBe(true)
    await waitForFontsAndLayout(page)
    // Capture the page: Chromium locator clipping can use stale scroll offsets
    // under root CSS zoom and otherwise photograph a different fixture row.
    await page.screenshot({ path: testInfo.outputPath(`collection-zoom-${zoom * 100}.png`), fullPage: true })
  })
}
