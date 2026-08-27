import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

const openFixture = async (page: Page, theme: 'light' | 'dark') => {
  await page.goto(`/?audit=ui-states&markdownWritingAids=1&theme=${theme}`, {
    waitUntil: 'domcontentloaded',
  })
  const fixture = page.getByTestId('markdown-writing-aids-fixture')
  await expect(fixture).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  return fixture
}

test('renders focus mode and reveals a source range on desktop and mobile', async ({
  page,
}, testInfo) => {
  const desktop = await openFixture(page, 'light')
  const desktopEditor = desktop.locator('.el-markdown-editor')
  const textarea = desktopEditor.locator('textarea')

  await expect(desktopEditor).toHaveAttribute(
    'data-markdown-focus-enabled',
    'true',
  )
  await expect(
    desktopEditor.locator('.el-markdown-editor__focus-layer'),
  ).toBeVisible()
  await desktop.getByTestId('markdown-reveal-details').click()
  await expect(desktop.getByTestId('markdown-reveal-status')).toHaveText(
    '1072:success',
  )
  await expect(textarea).toBeFocused()
  await expect(desktopEditor).toHaveAttribute(
    'data-markdown-writing-aids-state',
    'explicit-navigation',
  )
  expect(
    await textarea.evaluate((element) => {
      const target = element as HTMLTextAreaElement
      return target.value.slice(
        target.selectionStart,
        target.selectionStart + 38,
      )
    }),
  ).toBe('::embed[target="details" mode="block"]')
  await expect
    .poll(() => desktopEditor.locator('.is-dimmed').count())
    .toBeGreaterThan(0)
  await expect(
    desktopEditor
      .locator('.el-markdown-editor__focus-layer span:not(.is-dimmed)')
      .filter({ hasText: '::embed[target="details" mode="block"]' }),
  ).toBeVisible()
  await desktop.screenshot({
    path: testInfo.outputPath('writing-aids-light-desktop.png'),
  })

  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = await openFixture(page, 'dark')
  const mobileEditor = mobile.locator('.el-markdown-editor')
  await expect(
    mobileEditor.locator('.el-markdown-editor__focus-layer'),
  ).toBeVisible()
  expect(
    await mobileEditor.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  await mobile.screenshot({
    path: testInfo.outputPath('writing-aids-dark-mobile.png'),
  })
})
