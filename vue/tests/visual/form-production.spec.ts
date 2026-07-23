import { expect, test } from '@playwright/test'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const diagnostics = new WeakMap<object, string[]>()

test.beforeEach(async ({ page }, testInfo) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.goto(buildVisualUrl('form', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.getByTestId('production-form-fixtures')).toBeVisible()
})

test.afterEach(({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

test('keeps production form columns aligned from desktop to 320px', async ({
  page,
}) => {
  const fixture = page.getByTestId('production-form-fixtures')
  const form = fixture.locator('.task-form-fixture')
  await expect(form).toHaveCSS('max-width', '640px')

  const pair = fixture.locator('[data-form-fixture="inline-pair"]')
  const desktopFields = await pair
    .locator('.el-form-item')
    .evaluateAll((items) =>
      items.map((item) => {
        const rect = item.getBoundingClientRect()
        return { left: rect.left, width: rect.width }
      }),
    )
  expect(desktopFields).toHaveLength(2)
  expect(desktopFields[0]?.left).toBeLessThan(desktopFields[1]?.left ?? 0)

  await page.setViewportSize({ width: 320, height: 900 })
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  const mobileFields = await pair
    .locator('.el-form-item')
    .evaluateAll((items) =>
      items.map((item) => {
        const rect = item.getBoundingClientRect()
        return { left: rect.left, width: rect.width }
      }),
    )
  expect(mobileFields[0]?.left).toBe(mobileFields[1]?.left)
  expect(mobileFields[0]?.width).toBe(mobileFields[1]?.width)

  const uploadLeft = await fixture
    .locator('[data-form-fixture="upload"] .el-upload')
    .evaluate((element) => element.getBoundingClientRect().left)
  const inputLeft = await fixture
    .locator('[data-form-fixture="full-width"] .el-input')
    .first()
    .evaluate((element) => element.getBoundingClientRect().left)
  expect(uploadLeft).toBe(inputLeft)
})
