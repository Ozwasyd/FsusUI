import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'

const variants = ['default', 'inline', 'compact', 'page'] as const
const diagnostics = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }, testInfo) => {
  diagnostics.set(page, attachPageDiagnostics(page))

  await page.goto(buildVisualUrl('empty-illustration', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  })
  await expect(page.getByTestId('empty-illustration-fixture')).toBeVisible()
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

for (const variant of variants) {
  test(`${variant} empty state visual`, async ({ page }) => {
    await expect(
      page.locator(`[data-empty-variant="${variant}"]`),
    ).toHaveScreenshot(`empty-${variant}.png`)
  })
}

test('keeps illustrations quiet, decorative, and size-aware', async ({
  page,
}) => {
  const defaultState = page.locator('[data-empty-variant="default"]')
  const defaultSvg = defaultState.locator('.el-empty__image svg')

  await expect(defaultSvg).toHaveAttribute('aria-hidden', 'true')
  await expect(defaultSvg).toHaveAttribute('focusable', 'false')
  await expect(defaultSvg).toHaveCSS('fill', 'none')
  await expect(defaultSvg.locator('path').first()).toHaveCSS('fill', 'none')
  await expect(defaultSvg.locator('circle')).toHaveCount(0)
  await expect(defaultSvg.locator('linearGradient')).toHaveCount(0)
  await expect(
    page.locator('[data-empty-variant="inline"] .el-empty-state__illustration'),
  ).toHaveCount(0)
  await expect(
    page.locator(
      '[data-empty-variant="compact"] .el-empty-state__illustration',
    ),
  ).toHaveCount(0)
  await expect(
    page.locator('[data-empty-variant="page"] .el-empty-state__illustration'),
  ).toHaveAttribute('aria-hidden', 'true')
})
