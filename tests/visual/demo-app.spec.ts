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

const visualFixtures = [
  { mode: 'forms', testId: 'fixture-forms', screenshot: 'visual-forms.png' },
  { mode: 'data', testId: 'fixture-data', screenshot: 'visual-data.png' },
  {
    mode: 'surfaces',
    testId: 'fixture-surfaces',
    screenshot: 'visual-surfaces.png',
    openDropdown: true,
  },
  { mode: 'states', testId: 'fixture-states', screenshot: 'visual-states.png' },
  {
    mode: 'overlays',
    testId: 'fixture-overlays',
    screenshot: 'visual-overlays.png',
    openDropdown: true,
  },
  {
    mode: 'data-boundaries',
    testId: 'fixture-data-boundaries',
    screenshot: 'visual-data-boundaries.png',
  },
  { mode: 'icons', testId: 'fixture-icons', screenshot: 'visual-icons.png' },
] as const

test('home smoke page stays stable', async ({ page }) => {
  await page.goto(buildVisualUrl(null, test.info().project.name))
  await stabilizePage(page)
  await expect(page).toHaveScreenshot('home-smoke.png')
})

for (const fixture of visualFixtures) {
  test(`${fixture.mode} fixtures stay stable`, async ({ page }) => {
    await page.goto(buildVisualUrl(fixture.mode, test.info().project.name))
    await stabilizePage(page)

    if ('openDropdown' in fixture && fixture.openDropdown) {
      await page.locator('.dropdown-trigger-proxy button').click({ force: true })
    }

    await expect(page.locator(`[data-testid="${fixture.testId}"]`)).toHaveScreenshot(
      fixture.screenshot
    )
  })
}
