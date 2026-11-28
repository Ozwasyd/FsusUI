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

test('mobile public shell toggles menu drawer and supports bottom nav mode', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.goto(
    buildVisualUrl('public-shell-nav-mode', testInfo.project.name, {
      navMode: 'menu',
    }),
    { waitUntil: 'domcontentloaded' },
  )

  const shell = page.locator('.fsus-public-shell')
  await expect(shell).toBeVisible()

  const menuBtn = shell.locator('[data-public-shell-menu-trigger]')
  await expect(menuBtn).toBeVisible()
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'false')

  await menuBtn.click()
  await expect(menuBtn).toHaveAttribute('aria-expanded', 'true')
  const drawer = shell.locator('[data-public-shell-drawer]')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByTestId('public-shell-theme-action')).toBeVisible()

  await testInfo.attach(`public-shell-mobile-menu-${theme}`, {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })

  await page.goto(
    buildVisualUrl('public-shell-nav-mode', testInfo.project.name, {
      navMode: 'bottom',
    }),
    { waitUntil: 'domcontentloaded' },
  )
  await expect(page.locator('[data-public-shell-bottom-nav]')).toBeVisible()
})
