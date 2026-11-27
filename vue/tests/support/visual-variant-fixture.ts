import { expect, test as base } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'
import { attachPageDiagnostics } from './page-diagnostics'

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
  'markdown-editor-375': { width: 375, height: 900 },
  'markdown-editor-768': { width: 768, height: 900 },
  'markdown-editor-1366': { width: 1366, height: 900 },
  'markdown-editor-1440': { width: 1440, height: 900 },
  'metric-320': { width: 320, height: 900 },
  'metric-375': { width: 375, height: 900 },
  'metric-768': { width: 768, height: 1200 },
  'metric-1366': { width: 1366, height: 1200 },
  'metric-detail-desktop': { width: 1280, height: 800 },
  'metric-detail-mobile': { width: 375, height: 812 },
  'upload-320': { width: 320, height: 1000 },
  'upload-375': { width: 375, height: 1000 },
  'upload-768': { width: 768, height: 1000 },
  'upload-1366': { width: 1366, height: 1000 },
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

export const registerStableVisualHooks = (
  tests: Pick<typeof base, 'beforeEach' | 'afterEach'>,
) => {
  const diagnostics = new WeakMap<Page, string[]>()

  tests.beforeEach(async ({ page }) => {
    diagnostics.set(page, attachPageDiagnostics(page))
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  tests.afterEach(async ({ page }) => {
    expect(diagnostics.get(page) ?? []).toEqual([])
  })
}

export const openStableVisualPage = async (page: Page, url: string) => {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
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

export const waitForFontsAndLayout = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })

export const screenshotPath = (testInfo: TestInfo, name: string) =>
  testInfo.outputPath(name)

export const expectVisualViewport = async (
  page: Page,
  name: VisualViewportName,
) => {
  const expected = visualViewports[name]
  expect(page.viewportSize()).toEqual(expected)
}
