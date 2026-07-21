import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SMOKE_THEME_SWITCH_TEST_TITLE } from '../../../scripts/visual-profiles.mjs'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const diagnostics = new WeakMap<Page, string[]>()

const readRenderedTheme = (page: Page) =>
  page.evaluate(() => ({
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    color: getComputedStyle(document.body).color,
    mode: document.documentElement.dataset.themeMode,
    resolved: document.documentElement.dataset.themeResolved,
  }))

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

test(SMOKE_THEME_SWITCH_TEST_TITLE, async ({ page }, testInfo) => {
  const initialMode = resolveVisualVariant(testInfo.project.name).theme
  const alternateMode = initialMode === 'light' ? 'dark' : 'light'
  await page.goto(buildVisualUrl('issue-primitives', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })

  const shell = page.locator('.el-public-shell').first()
  const toggle = shell
    .locator('.el-theme-mode-toggle[data-theme-mode-visibility="desktop"]')
    .first()
  await expect(shell).toBeVisible()
  await expect(toggle).toBeVisible()

  const root = page.locator('html')
  await expect(root).toHaveClass(new RegExp(`\\b${initialMode}\\b`, 'u'))
  await expect(root).not.toHaveClass(new RegExp(`\\b${alternateMode}\\b`, 'u'))
  await expect(root).toHaveAttribute('data-theme-mode', initialMode)
  await expect(root).toHaveAttribute('data-theme-resolved', initialMode)
  const initialAppearance = await readRenderedTheme(page)

  await toggle.locator(`[data-theme-mode="${alternateMode}"]`).click()
  await expect(root).toHaveClass(new RegExp(`\\b${alternateMode}\\b`, 'u'))
  await expect(root).not.toHaveClass(new RegExp(`\\b${initialMode}\\b`, 'u'))
  await expect(root).toHaveAttribute('data-theme-mode', alternateMode)
  await expect(root).toHaveAttribute('data-theme-resolved', alternateMode)
  expect(await readRenderedTheme(page)).not.toEqual(initialAppearance)

  await toggle.locator(`[data-theme-mode="${initialMode}"]`).click()
  await expect(root).toHaveClass(new RegExp(`\\b${initialMode}\\b`, 'u'))
  await expect(root).not.toHaveClass(new RegExp(`\\b${alternateMode}\\b`, 'u'))
  await expect(root).toHaveAttribute('data-theme-mode', initialMode)
  await expect(root).toHaveAttribute('data-theme-resolved', initialMode)
  expect(await readRenderedTheme(page)).toEqual(initialAppearance)
})
