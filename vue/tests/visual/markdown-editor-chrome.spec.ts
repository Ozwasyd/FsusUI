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

for (const [chrome, mode] of [
  ['framed', 'source'],
  ['embedded', 'live'],
  ['minimal', 'split'],
  ['framed', 'preview'],
] as const) {
  test(`markdown editor renders ${chrome} chrome in ${mode} mode`, async ({
    page,
  }, testInfo) => {
    const { theme } = resolveVisualVariant(testInfo.project.name)
    await page.goto(
      buildVisualUrl('markdown-editor-chrome-visual', testInfo.project.name, {
        chrome,
        mode,
      }),
      { waitUntil: 'domcontentloaded' },
    )

    const section = page.getByTestId('section-markdown-editor-chrome')
    await expect(section).toBeVisible()
    const editor = section.locator('.fsus-markdown-editor').first()
    await expect(editor).toBeVisible()
    const box = await editor.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(240)
    expect(box!.height).toBeGreaterThan(100)

    await testInfo.attach(`markdown-editor-${chrome}-${mode}-${theme}`, {
      body: await editor.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
  })
}
