import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const stabilizePage = async (page: Page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      .el-overlay,
      .el-overlay-dialog {
        animation: none !important;
      }
    `,
  })
}

const getVisualVariant = (projectName: string) => {
  switch (projectName) {
    case 'mobile-light':
      return { theme: 'light', compact: true }
    case 'desktop-dark':
      return { theme: 'dark', compact: false }
    case 'mobile-dark':
      return { theme: 'dark', compact: true }
    default:
      return { theme: 'light', compact: false }
  }
}

const buildVisualUrl = (mode: string | null, projectName: string) => {
  const { theme, compact } = getVisualVariant(projectName)
  const params = new URLSearchParams()

  if (mode) params.set('visual', mode)
  params.set('theme', theme)
  if (compact) params.set('compact', '1')

  return `/?${params.toString()}`
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('home smoke page stays stable', async ({ page }) => {
  await page.goto(buildVisualUrl(null, test.info().project.name))
  await stabilizePage(page)
  await expect(page).toHaveScreenshot('home-smoke.png')
})

test('forms fixtures stay stable', async ({ page }) => {
  await page.goto(buildVisualUrl('forms', test.info().project.name))
  await stabilizePage(page)
  await expect(page.locator('[data-testid="fixture-forms"]')).toHaveScreenshot(
    'visual-forms.png'
  )
})

test('data fixtures stay stable', async ({ page }) => {
  await page.goto(buildVisualUrl('data', test.info().project.name))
  await stabilizePage(page)
  await expect(page.locator('[data-testid="fixture-data"]')).toHaveScreenshot(
    'visual-data.png'
  )
})

test('surfaces fixtures stay stable', async ({ page }) => {
  await page.goto(buildVisualUrl('surfaces', test.info().project.name))
  await stabilizePage(page)
  await page.locator('.dropdown-trigger-proxy button').click({ force: true })
  await expect(page.locator('[data-testid="fixture-surfaces"]')).toHaveScreenshot(
    'visual-surfaces.png'
  )
})
