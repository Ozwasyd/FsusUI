import { test, expect } from '@playwright/test'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'

test.describe('FsusUI Visual Alignment Audit', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure reduced motion is off to see transitions if needed,
    // but here we want stable shots.
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  test('Verify Button States', async ({ page }, testInfo) => {
    const variant = resolveVisualVariant(testInfo.project.name)
    await page.goto(buildVisualUrl('basic', testInfo.project.name), {
      waitUntil: 'networkidle',
    })
    const btn = page
      .locator(
        '.demo-block:has-text("Button & ButtonGroup") .el-button--primary',
      )
      .first()

    // Capture Normal State
    await btn.screenshot({
      path: testInfo.outputPath(
        'screenshots',
        'audit-interactive',
        testInfo.project.name,
        'button',
        `${variant.theme}-normal.png`,
      ),
    })

    // Capture Hover State (Should turn Scholarly Blue)
    await btn.hover()
    await page.waitForTimeout(300) // Wait for transition
    await btn.screenshot({
      path: testInfo.outputPath(
        'screenshots',
        'audit-interactive',
        testInfo.project.name,
        'button',
        `${variant.theme}-hover.png`,
      ),
    })
  })

  test('Verify Input Focus', async ({ page }, testInfo) => {
    const variant = resolveVisualVariant(testInfo.project.name)
    await page.goto(buildVisualUrl('form', testInfo.project.name), {
      waitUntil: 'networkidle',
    })
    const input = page.locator('.el-input__inner').first()

    // Capture Focus State (Should have 1px inset Scholarly Blue ring)
    await input.focus()
    await page.waitForTimeout(300)
    await input.screenshot({
      path: testInfo.outputPath(
        'screenshots',
        'audit-interactive',
        testInfo.project.name,
        'input',
        `${variant.theme}-focus.png`,
      ),
    })
  })

  test('Verify Dialog Blur', async ({ page }, testInfo) => {
    const variant = resolveVisualVariant(testInfo.project.name)
    await page.goto(buildVisualUrl('feedback', testInfo.project.name), {
      waitUntil: 'networkidle',
    })
    await page.getByTestId('open-publish-dialog').click()
    await expect(page.locator('.el-dialog')).toBeVisible()

    // Capture full page to see overlay blur
    await page.screenshot({
      path: testInfo.outputPath(
        'screenshots',
        'audit-interactive',
        testInfo.project.name,
        'dialog',
        `${variant.theme}-open.png`,
      ),
      fullPage: false,
    })
  })

  test('Verify Icon Stroke Rounding', async ({ page }, testInfo) => {
    const variant = resolveVisualVariant(testInfo.project.name)
    await page.goto(buildVisualUrl('icons', testInfo.project.name), {
      waitUntil: 'networkidle',
    })
    const icon = page.locator('.icon-item').first()
    // High resolution crop of an icon
    await icon.screenshot({
      path: testInfo.outputPath(
        'screenshots',
        'audit-interactive',
        testInfo.project.name,
        'icon',
        `${variant.theme}-detail.png`,
      ),
    })
  })
})
