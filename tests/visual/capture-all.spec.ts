import { test, expect } from '@playwright/test'

const sections = [
  { name: 'basic', testId: 'section-basic' },
  { name: 'form', testId: 'section-form' },
  { name: 'data', testId: 'section-data' },
  { name: 'navigation', testId: 'section-navigation', action: async (page) => {
    await page.locator('.dropdown-trigger-proxy button').click({ force: true })
    await page.waitForTimeout(500)
  }},
  { name: 'feedback', testId: 'section-feedback', action: async (page) => {
    await page.getByText('Open Dialog').click()
    await page.waitForTimeout(500)
  }},
  { name: 'others', testId: 'section-others' },
  { name: 'icons', testId: 'section-icons' },
]

for (const theme of ['light', 'dark']) {
  for (const section of sections) {
    test(`capture ${section.name} in ${theme} mode`, async ({ page }) => {
      await page.goto(`/?visual=${section.name}&theme=${theme}`, { waitUntil: 'networkidle' })
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
