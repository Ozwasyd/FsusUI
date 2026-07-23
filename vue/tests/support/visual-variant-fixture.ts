import { expect, test as base } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

const visualViewports = {
  'empty-breakpoint-above': { width: 420, height: 900 },
  'empty-breakpoint-below': { width: 419, height: 900 },
  'empty-mobile': { width: 375, height: 900 },
  'form-mobile': { width: 320, height: 900 },
  'public-shell-320': { width: 320, height: 1200 },
  'public-shell-375': { width: 375, height: 1200 },
  'public-shell-390': { width: 390, height: 1200 },
  'public-shell-768': { width: 768, height: 1200 },
  'public-shell-keyboard': { width: 320, height: 1000 },
  'transfer-320': { width: 320, height: 1400 },
  'transfer-375': { width: 375, height: 1400 },
  'transfer-390': { width: 390, height: 1400 },
  'transfer-768': { width: 768, height: 1400 },
  'transfer-1440': { width: 1440, height: 1400 },
} as const

export type VisualViewportName = keyof typeof visualViewports

type VisualVariantFixtures = {
  useVisualViewport: (name: VisualViewportName) => Promise<void>
}

export const test = base.extend<VisualVariantFixtures>({
  useVisualViewport: async ({ page }, use) => {
    await use(async (name) => {
      await page.setViewportSize(visualViewports[name])
    })
  },
})

export { expect }

export const screenshotPath = (testInfo: TestInfo, name: string) =>
  testInfo.outputPath(name)

export const expectVisualViewport = async (
  page: Page,
  name: VisualViewportName,
) => {
  const expected = visualViewports[name]
  expect(page.viewportSize()).toEqual(expected)
}
