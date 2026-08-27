import { expect, test } from '@playwright/test'

test('renders and dismisses command surfaces without a stale slash commit', async ({
  page,
}) => {
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownCommandSurfaces=1',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  const slash = editor.locator('.el-markdown-editor__slash-menu')

  await expect(slash).toBeVisible()
  await expect(textarea).toHaveAttribute('aria-haspopup', 'menu')
  await textarea.press('Escape')
  await expect(slash).toBeHidden()
  await expect(textarea).toHaveValue('/bol')
  await expect(textarea).toBeFocused()

  await textarea.fill('')
  await textarea.fill('/bol')
  await expect(slash).toBeVisible()
  await textarea.press('Enter')
  await expect(textarea).toHaveValue('**text**')
  await expect(page.getByTestId('markdown-editor-revision')).toHaveText('3')

  await page.getByTestId('markdown-open-command-palette').click()
  const palette = page.locator('.el-markdown-editor__palette-dialog')
  await expect(palette).toBeVisible()
  await expect(palette).toHaveAccessibleName('命令面板')
  await palette.locator('input').fill('bold')
  await expect(palette.getByRole('option')).toHaveCount(1)
  await palette.press('Escape')
  await expect(palette).toBeHidden()
  await expect(textarea).toBeFocused()

  await page.setViewportSize({ height: 812, width: 375 })
  await page.getByTestId('markdown-open-command-palette').click()
  await expect(palette).toBeVisible()
  const mobileBox = await palette.boundingBox()
  expect(mobileBox).not.toBeNull()
  expect(mobileBox!.x).toBeGreaterThanOrEqual(0)
  expect(mobileBox!.x + mobileBox!.width).toBeLessThanOrEqual(375)
  expect(mobileBox!.y + mobileBox!.height).toBeLessThanOrEqual(812)
})

test('renders locale authority, long copy, RTL, and status density without fallback copy', async ({
  page,
}) => {
  for (const locale of [
    'zh-CN',
    'zh-TW',
    'en',
    'ja',
    'ko',
    'ru',
    'ar',
    'de',
  ]) {
    const prefix = locale.toUpperCase()
    await page.goto(
      `/?audit=ui-states&markdownEditorTransaction=1&markdownCommandSurfaces=1&markdownLocale=${locale}`,
      { waitUntil: 'domcontentloaded' },
    )
    const fixture = page.getByTestId('markdown-editor-transaction-fixture')
    const editor = fixture.locator('.el-markdown-editor')
    await expect(editor).toHaveAccessibleName(`${prefix} Markdown editor`)
    await expect(editor).toContainText(`${prefix} bold`)
    await expect(editor).not.toContainText('加粗')
    await page.getByTestId('markdown-open-command-palette').click()
    const palette = page.locator('.el-markdown-editor__palette-dialog')
    await expect(palette).toHaveAccessibleName(`${prefix} command palette`)
    await expect(palette.getByRole('group').first()).toHaveAccessibleName(
      `${prefix} format`,
    )
    await palette.press('Escape')
    if (locale === 'ar') {
      await expect(fixture).toHaveAttribute('dir', 'rtl')
    }
  }

  await page.setViewportSize({ height: 812, width: 375 })
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownCommandSurfaces=1&markdownLocale=long&markdownStatus=detailed&markdownMobile=compact',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  await expect(editor.locator('.el-markdown-editor__status-details')).toBeVisible()
  await page.getByTestId('markdown-open-command-palette').click()
  const palette = page.locator('.el-markdown-editor__palette-dialog')
  const paletteBox = await palette.boundingBox()
  expect(paletteBox).not.toBeNull()
  expect(paletteBox!.x).toBeGreaterThanOrEqual(0)
  expect(paletteBox!.x + paletteBox!.width).toBeLessThanOrEqual(375)
  expect(paletteBox!.y + paletteBox!.height).toBeLessThanOrEqual(812)

  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownCommandSurfaces=1&markdownLocale=en&markdownStatus=none',
    { waitUntil: 'domcontentloaded' },
  )
  await expect(
    page
      .getByTestId('markdown-editor-transaction-fixture')
      .locator('.el-markdown-editor__status'),
  ).toHaveCount(0)
})
