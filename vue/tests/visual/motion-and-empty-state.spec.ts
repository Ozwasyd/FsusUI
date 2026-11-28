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

test('empty state variants render clean hierarchy without overflow', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.goto(
    buildVisualUrl('empty-illustration', testInfo.project.name),
    { waitUntil: 'domcontentloaded' },
  )

  const fixture = page.getByTestId('empty-illustration-fixture')
  await expect(fixture).toBeVisible()
  expect(await fixture.locator('.fsus-empty-state').count()).toBeGreaterThanOrEqual(5)

  await testInfo.attach(`empty-states-${theme}`, {
    body: await fixture.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})

test('transfer responsive layout renders panels without horizontal clipping', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.goto(
    buildVisualUrl('transfer-responsive', testInfo.project.name),
    { waitUntil: 'domcontentloaded' },
  )

  const fixture = page.getByTestId('transfer-responsive-fixture')
  await expect(fixture).toBeVisible()
  await expect(fixture.locator('.fsus-transfer').first()).toBeVisible()

  await testInfo.attach(`transfer-responsive-${theme}`, {
    body: await fixture.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})

test('segmented control switches active item cleanly', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.goto(buildVisualUrl('segmented-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })

  const segmented = page.locator('.fsus-segmented').first()
  await expect(segmented).toBeVisible()
  const items = segmented.locator('.fsus-segmented__item')
  expect(await items.count()).toBeGreaterThanOrEqual(2)

  await testInfo.attach(`segmented-control-${theme}`, {
    body: await segmented.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})
