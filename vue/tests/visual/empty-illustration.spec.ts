import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'
import { expect, test } from '../support/visual-variant-fixture'

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

test('keeps empty-state actions touchable without using size as hierarchy', async ({
  page,
  useVisualViewport,
}) => {
  const actions = page.locator(
    '[data-empty-variant="primary-secondary"] .el-empty-state__actions',
  )
  const primary = actions.locator('.el-button--primary')
  const secondary = actions.locator('.el-button:not(.el-button--primary)')

  await expect(primary).toHaveCSS('min-height', '44px')
  await expect(secondary).toHaveCSS('min-height', '40px')
  await expect(actions).toHaveCSS('gap', '8px')

  await useVisualViewport('empty-breakpoint-above')
  expect(
    await page.evaluate(() => matchMedia('(max-width: 419px)').matches),
  ).toBe(false)
  await expect(secondary).toHaveCSS('min-height', '40px')

  await useVisualViewport('empty-breakpoint-below')
  expect(
    await page.evaluate(() => matchMedia('(max-width: 419px)').matches),
  ).toBe(true)
  await expect(primary).toHaveCSS('min-height', '44px')
  await expect(secondary).toHaveCSS('min-height', '44px')

  await useVisualViewport('empty-mobile')
  await expect(primary).toHaveCSS('min-height', '44px')
  await expect(secondary).toHaveCSS('min-height', '44px')
  const mobileWidths = await actions.evaluate((element) => {
    const [primaryAction, secondaryAction] = element.children
    return {
      actions: element.getBoundingClientRect().width,
      primary: primaryAction.getBoundingClientRect().width,
      secondary: secondaryAction.getBoundingClientRect().width,
    }
  })
  expect(mobileWidths.actions).toBeLessThanOrEqual(320)
  expect(mobileWidths.primary).toBe(mobileWidths.actions)
  expect(mobileWidths.secondary).toBe(mobileWidths.actions)

  const focusOutline = await primary.evaluate((element) => {
    ;(element as HTMLElement).focus()
    const style = getComputedStyle(element)
    return {
      height: element.getBoundingClientRect().height,
      radius: style.borderRadius,
    }
  })
  expect(focusOutline.height).toBeGreaterThanOrEqual(44)
  expect(focusOutline.radius).toBe('6px')
})
