import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'

type VisualSection = {
  name: string
  testId: string
  action?: (page: Page) => Promise<void>
}

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

const sections: VisualSection[] = [
  { name: 'basic', testId: 'section-basic' },
  { name: 'form', testId: 'section-form' },
  { name: 'data', testId: 'section-data' },
  { name: 'navigation', testId: 'section-navigation', action: async (page) => {
    await page.locator('.dropdown-trigger-proxy button').click({ force: true })
    await page.waitForTimeout(500)
  }},
  { name: 'feedback', testId: 'section-feedback', action: async (page) => {
    await page.getByTestId('open-publish-dialog').click()
    await page.waitForTimeout(500)
  }},
  { name: 'others', testId: 'section-others' },
  { name: 'icons', testId: 'section-icons' },
]

for (const theme of ['light', 'dark']) {
  for (const section of sections) {
    test(`capture ${section.name} in ${theme} mode`, async ({ page }) => {
      await page.goto(`/?visual=${section.name}&theme=${theme}`, {
        waitUntil: 'domcontentloaded',
      })
      await stabilizePage(page)

      const locator = page.locator(`[data-testid="${section.testId}"]`)
      await expect(locator).toBeVisible()
      
      if (section.action) {
        await section.action(page)
      }
      
      await page.screenshot({ 
        path: `screenshots/${section.name}-${theme}.png`,
        fullPage: true 
      })
    })
  }
}
