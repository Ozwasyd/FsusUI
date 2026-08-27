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
  await slash.getByRole('button').first().press('Escape')
  await expect(slash).toBeHidden()
  await expect(textarea).toHaveValue('/bol')

  await textarea.fill('')
  await textarea.fill('/bol')
  await expect(slash).toBeVisible()
  await slash.getByRole('button', { name: 'Bold' }).click()
  await expect(textarea).toHaveValue('**text**')
  await expect(page.getByTestId('markdown-editor-revision')).toHaveText('3')

  await page.getByTestId('markdown-open-command-palette').click()
  const palette = page.locator('.el-markdown-editor__palette-dialog')
  await expect(palette).toBeVisible()
  await expect(palette).toHaveAccessibleName('Command palette')
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
