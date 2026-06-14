import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const diagnostics = new WeakMap<Page, string[]>()

const stabilizePage = async (page: Page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  })
}

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

test('issue primitives render in the demo route', async ({
  page,
}, testInfo) => {
  const projectName = testInfo.project.name
  const isCompact = projectName.includes('mobile')
  const theme = projectName.includes('dark') ? 'dark' : 'light'
  const compactParam = isCompact ? '&compact=1' : ''

  await page.goto(`/?visual=issue-primitives&theme=${theme}${compactParam}`, {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)

  await expect(page.locator('.el-public-shell')).toBeVisible()
  await expect(page.locator('.issue-primitives')).toBeVisible()
  await expect(page.locator('.el-empty-state--inline')).toBeVisible()
  await expect(page.locator('.el-empty-state--compact')).toBeVisible()
  await expect(page.locator('.el-empty-state--page')).toBeVisible()
  await expect(page.locator('.el-empty-state__illustration')).toHaveCount(1)
  await expect(page.locator('.el-collection-toolbar')).toBeVisible()
  await expect(page.locator('.el-filter-group')).toBeVisible()
  await expect(page.locator('.el-segmented-control')).toBeVisible()
  await expect(page.locator('.el-collection-summary')).toBeVisible()
  await expect(page.locator('.el-pagination-bar')).toBeVisible()
  await expect(
    page.locator(
      isCompact
        ? '.el-theme-mode-toggle--mobile'
        : '.el-theme-mode-toggle--desktop',
    ),
  ).toBeVisible()

  const collection = page.locator('.el-responsive-collection')
  await expect(collection).toBeVisible()
  if (isCompact) {
    await expect(
      collection.locator('.el-responsive-collection__compact'),
    ).toBeVisible()
    await expect(collection.locator('.issue-primitives__card')).toHaveCount(2)
  } else {
    await expect(collection.locator('.issue-primitives__table')).toBeVisible()
    await expect(collection.locator('.issue-primitives__row')).toHaveCount(2)
  }

  const uploadSurface = page.locator('.issue-primitives__upload-surface')
  await expect(uploadSurface).toBeVisible()
  const uploadBox = await uploadSurface.boundingBox()
  expect(uploadBox?.width ?? 0).toBeGreaterThan(isCompact ? 250 : 600)
  expect(uploadBox?.height ?? 0).toBeGreaterThan(isCompact ? 120 : 260)

  const horizontalOverflow = await page.evaluate(() => {
    const root = document.documentElement
    return (
      Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth
    )
  })
  expect(horizontalOverflow).toBeLessThanOrEqual(1)
})
