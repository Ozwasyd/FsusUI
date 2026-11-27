import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'
import { createVisualCaptureTestTitle } from '../../../scripts/visual-profiles.mjs'
import {
  openStableVisualPage,
  registerStableVisualHooks,
} from '../support/visual-variant-fixture'

type VisualSection = {
  name: string
  testId: string
  action?: (page: Page) => Promise<void>
}

registerStableVisualHooks(test)

const sections: VisualSection[] = [
  { name: 'basic', testId: 'section-basic' },
  { name: 'form', testId: 'section-form' },
  { name: 'data', testId: 'section-data' },
  {
    name: 'navigation',
    testId: 'section-navigation',
    action: async (page) => {
      await page
        .locator('.dropdown-trigger-proxy button')
        .click({ force: true })
      await page.waitForTimeout(500)
    },
  },
  {
    name: 'feedback',
    testId: 'section-feedback',
    action: async (page) => {
      await page.getByTestId('open-publish-dialog').click()
      await page.waitForTimeout(500)
    },
  },
  { name: 'others', testId: 'section-others' },
  { name: 'icons', testId: 'section-icons' },
]

for (const section of sections) {
  test(
    createVisualCaptureTestTitle(section.name),
    async ({ page }, testInfo) => {
      const variant = resolveVisualVariant(testInfo.project.name)
      await openStableVisualPage(
        page,
        buildVisualUrl(section.name, testInfo.project.name),
      )

      const locator = page.locator(`[data-testid="${section.testId}"]`)
      await expect(locator).toBeVisible()

      if (section.action) {
        await section.action(page)
      }

      await page.screenshot({
        path: testInfo.outputPath(
          'screenshots',
          'capture-all',
          testInfo.project.name,
          section.name,
          `${variant.theme}-full-page.png`,
        ),
        fullPage: true,
      })
    },
  )
}
