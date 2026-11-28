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

test('desktop public shell supports inline, trigger, and none search modes', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.goto(
    buildVisualUrl('public-shell-search-mode', testInfo.project.name, {
      searchMode: 'inline',
    }),
    { waitUntil: 'domcontentloaded' },
  )

  const shell = page.locator('.fsus-public-shell')
  await expect(shell).toBeVisible()
  const searchInput = shell.locator('input[type="search"]')
  await expect(searchInput).toBeVisible()
  await searchInput.fill('minimalist')
  await searchInput.press('Enter')
  await expect(page.getByTestId('search-result')).toContainText(
    'Submitted: minimalist',
  )

  await page.getByTestId('set-search-mode-trigger').click()
  const trigger = shell.locator('[data-public-shell-search-trigger]')
  await expect(trigger).toBeVisible()
  await trigger.click()
  await expect(searchInput).toBeVisible()
  await searchInput.press('Escape')
  await expect(searchInput).toBeHidden()

  await page.getByTestId('set-search-mode-none').click()
  await expect(trigger).toHaveCount(0)
  await expect(searchInput).toHaveCount(0)

  await testInfo.attach(`public-shell-desktop-search-${theme}`, {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})
