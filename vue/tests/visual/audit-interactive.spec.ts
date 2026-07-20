import { test, expect } from '@playwright/test'

test.describe('FsusUI Visual Alignment Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure reduced motion is off to see transitions if needed,
    // but here we want stable shots.
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  for (const theme of ['light', 'dark']) {
    test(`Verify Button States - ${theme}`, async ({ page }) => {
      await page.goto(`/?visual=basic&theme=${theme}`, {
        waitUntil: 'networkidle',
      })
      const btn = page
        .locator(
          '.demo-block:has-text("Button & ButtonGroup") .el-button--primary',
        )
        .first()

      // Capture Normal State
      await btn.screenshot({
        path: `screenshots/audit-button-normal-${theme}.png`,
      })

      // Capture Hover State (Should turn Scholarly Blue)
      await btn.hover()
      await page.waitForTimeout(300) // Wait for transition
      await btn.screenshot({
        path: `screenshots/audit-button-hover-${theme}.png`,
      })
    })

    test(`Verify Input Focus - ${theme}`, async ({ page }) => {
      await page.goto(`/?visual=form&theme=${theme}`, {
        waitUntil: 'networkidle',
      })
      const input = page.locator('.el-input__inner').first()

      // Capture Focus State (Should have 1px inset Scholarly Blue ring)
      await input.focus()
      await page.waitForTimeout(300)
      await input.screenshot({
        path: `screenshots/audit-input-focus-${theme}.png`,
      })
    })

    test(`Verify Dialog Blur - ${theme}`, async ({ page }) => {
      await page.goto(`/?visual=feedback&theme=${theme}`, {
        waitUntil: 'networkidle',
      })
      await page.getByTestId('open-publish-dialog').click()
      await expect(page.locator('.el-dialog')).toBeVisible()

      // Capture full page to see overlay blur
      await page.screenshot({
        path: `screenshots/audit-dialog-blur-${theme}.png`,
        fullPage: false,
      })
    })

    test(`Verify Icon Stroke Rounding - ${theme}`, async ({ page }) => {
      await page.goto(`/?visual=icons&theme=${theme}`, {
        waitUntil: 'networkidle',
      })
      const icon = page.locator('.icon-item').first()
      // High resolution crop of an icon
      await icon.screenshot({
        path: `screenshots/audit-icon-detail-${theme}.png`,
      })
    })
  }
})
