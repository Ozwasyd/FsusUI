import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const diagnostics = new WeakMap<object, string[]>()

const waitForStableLayout = async (page: Page) => {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
}

const expectNoHorizontalOverflow = async (page: Page) => {
  await waitForStableLayout(page)
  const geometry = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const scrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    )
    const offenders = [...document.body.querySelectorAll<HTMLElement>('*')]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          selector: `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        }
      })
      .filter(({ left, right }) => left < -1 || right > viewportWidth + 1)
      .slice(0, 10)

    return { offenders, scrollWidth, viewportWidth }
  })

  expect(
    geometry.scrollWidth,
    `horizontal overflow: ${JSON.stringify(geometry)}`,
  ).toBeLessThanOrEqual(geometry.viewportWidth + 1)
}

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

test('keeps production form columns aligned for its project viewport and 320px', async ({
  page,
}, testInfo) => {
  const fixture = page.getByTestId('production-form-fixtures')
  const form = fixture.locator('.task-form-fixture')
  const startsDesktop = testInfo.project.name.startsWith('desktop-')

  await waitForStableLayout(page)
  await expect(form).toHaveCSS('max-width', startsDesktop ? '640px' : 'none')

  const pair = fixture.locator('[data-form-fixture="inline-pair"]')
  if (startsDesktop) {
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
  }

  await page.setViewportSize({ width: 320, height: 900 })
  await expectNoHorizontalOverflow(page)
  await expect(form).toHaveCSS('max-width', 'none')

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

test('captures dark form role hierarchy in color and grayscale', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes('dark'))

  const fixture = page.getByTestId('production-form-fixtures')
  const selectors = [
    '.el-input',
    '.el-textarea',
    '.el-select',
    '.el-input-number',
    '.el-date-editor',
    '.el-upload',
    '.el-checkbox',
    '.el-switch',
    '.el-radio',
    '.el-button',
  ]
  for (const selector of selectors) {
    await expect(fixture.locator(selector).first()).toBeVisible()
  }

  const label = fixture.locator('.el-form-item__label').first()
  const placeholder = fixture.locator('input[placeholder]').first()
  const disabled = fixture.locator('.el-input.is-disabled').first()
  await expect(label).toHaveCSS('color', 'rgb(161, 161, 170)')
  expect(
    await placeholder.evaluate(
      (element) => getComputedStyle(element, '::placeholder').color,
    ),
  ).toBe('rgb(133, 133, 143)')
  await expect(disabled).not.toHaveCSS('opacity', /0\.\d+/)

  await placeholder.focus()
  const focusedWrapper = placeholder.locator('..')
  await page.waitForTimeout(300)
  await expect(focusedWrapper).toHaveCSS(
    'box-shadow',
    /rgb\(75, 121, 204\).*inset/,
  )

  await page.screenshot({
    path: testInfo.outputPath('dark-form-original.png'),
    fullPage: true,
  })
  await page.addStyleTag({
    content:
      '[data-testid="production-form-fixtures"] { filter: grayscale(1); }',
  })
  await page.screenshot({
    path: testInfo.outputPath('dark-form-grayscale.png'),
    fullPage: true,
  })
})
