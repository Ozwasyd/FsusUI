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

test('dark form uses canonical three-tier text budget and opaque disabled surfaces', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  expect(theme).toBe('dark')

  await page.goto(buildVisualUrl('form', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  const section = page.getByTestId('section-form')
  await expect(section).toBeVisible()

  const tokens = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    return {
      readable: root.getPropertyValue('--fsus-form-readable-text').trim().toLowerCase(),
      state: root.getPropertyValue('--fsus-form-state-text').trim().toLowerCase(),
      decorative: root.getPropertyValue('--fsus-form-decorative').trim().toLowerCase(),
      disabledBg: root.getPropertyValue('--fsus-disabled-bg').trim().toLowerCase(),
      disabledBorder: root.getPropertyValue('--fsus-disabled-border').trim().toLowerCase(),
    }
  })

  expect(tokens.readable).toBe('#a1a1aa')
  expect(tokens.state).toBe('#85858f')
  expect(tokens.decorative).toBe('#71717a')
  expect(tokens.disabledBg).toBe('#18181b')
  expect(tokens.disabledBorder).toBe('#27272a')

  const disabledControls = section.locator('[data-disabled]')
  if (await disabledControls.count()) {
    const opacity = await disabledControls
      .first()
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity))
    expect(opacity).toBe(1)
  }

  await testInfo.attach('dark-form-authority-matrix', {
    body: await section.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})
