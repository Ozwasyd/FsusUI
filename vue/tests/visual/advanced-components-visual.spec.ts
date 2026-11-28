import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const diagnostics = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

test('data section renders FsusTable, FsusTree, and FsusPagination with interactive states', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.goto(buildVisualUrl('data', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  const section = page.getByTestId('section-data')
  await expect(section).toBeVisible()

  const table = section.locator('.fsus-table').first()
  await expect(table).toBeVisible()
  expect(await table.locator('tbody tr').count()).toBeGreaterThan(0)

  const tree = section.locator('.fsus-tree').first()
  await expect(tree).toBeVisible()

  const pagination = section.locator('.fsus-pagination').first()
  await expect(pagination).toBeVisible()

  await testInfo.attach(`advanced-data-${theme}`, {
    body: await section.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})

test('form section renders upgraded FsusSelect, FsusDatePicker, FsusColorPicker, FsusCascader, FsusSlider, and FsusUpload', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.goto(buildVisualUrl('form', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  const section = page.getByTestId('section-form')
  await expect(section).toBeVisible()

  await expect(section.locator('.fsus-select').first()).toBeVisible()
  await expect(section.locator('.fsus-date-picker').first()).toBeVisible()
  await expect(section.locator('.fsus-color-picker').first()).toBeVisible()
  await expect(section.locator('.fsus-cascader').first()).toBeVisible()
  await expect(section.locator('.fsus-slider').first()).toBeVisible()
  await expect(section.locator('.fsus-upload').first()).toBeVisible()

  // Exercise DatePicker popover open & close
  const dateInput = section
    .locator('.fsus-date-picker .fsus-date-picker__input')
    .first()
  if (await dateInput.count()) {
    await dateInput.click()
    await expect(page.locator('.fsus-date-panel').last()).toBeVisible()
    await page.keyboard.press('Escape')
  }

  // Exercise ColorPicker panel open & close
  const colorTrigger = section
    .locator('.fsus-color-picker__trigger')
    .first()
  if (await colorTrigger.count()) {
    await colorTrigger.click()
    await expect(page.locator('.fsus-color-picker__panel').last()).toBeVisible()
    await page.keyboard.press('Escape')
  }

  await testInfo.attach(`advanced-form-${theme}`, {
    body: await section.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})

test('navigation and others sections render upgraded FsusMenu, FsusTabs, and FsusCarousel', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.goto(buildVisualUrl('navigation', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  const nav = page.getByTestId('section-navigation')
  await expect(nav).toBeVisible()
  await expect(nav.locator('.fsus-menu').first()).toBeVisible()

  const tabs = nav.locator('.fsus-tabs__tab')
  await expect(tabs.first()).toBeVisible()
  if ((await tabs.count()) >= 2) {
    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
  }

  await testInfo.attach(`advanced-navigation-${theme}`, {
    body: await nav.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })

  await page.goto(buildVisualUrl('others', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  const others = page.getByTestId('section-others')
  await expect(others).toBeVisible()
  await expect(others.locator('.fsus-carousel').first()).toBeVisible()
  await expect(others.locator('.fsus-collapse').first()).toBeVisible()

  await testInfo.attach(`advanced-others-${theme}`, {
    body: await others.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})
