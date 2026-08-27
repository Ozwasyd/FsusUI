import { expect, test } from '@playwright/test'

const table = [
  '| Project | Owner | Status |',
  '| --- | --- | --- |',
  '| Documentation migration | Editorial systems | In review |',
  '| Runtime projection | Platform team | Ready |',
].join('\n')

test('renders and operates the source-anchored table context surface', async ({
  page,
}, testInfo) => {
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1',
    {
    waitUntil: 'domcontentloaded',
    },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const textarea = fixture.locator('.el-markdown-editor textarea')
  await expect(textarea).toBeVisible()
  await expect(textarea).toHaveValue(table)
  await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    const offset = target.value.indexOf('Documentation migration')
    target.setSelectionRange(offset, offset)
    target.dispatchEvent(new Event('select', { bubbles: true }))
  })
  const toolbar = fixture.getByRole('toolbar', { name: 'Table actions' })
  await expect(toolbar).toBeVisible()
  await expect(toolbar.getByRole('button', { name: '在下方插入行' })).toBeVisible()

  await textarea.press('Tab')
  await expect
    .poll(() =>
      textarea.evaluate((element) => (element as HTMLTextAreaElement).selectionStart),
    )
    .toBe(table.indexOf('Editorial systems') - 1)

  await toolbar.getByRole('button', { name: '在下方插入行' }).click()
  await expect(textarea).toHaveValue(/\n\|  \|  \|  \|\n/)

  await fixture.screenshot({ path: testInfo.outputPath('table-context-light.png') })

  await page.setViewportSize({ width: 390, height: 844 })
  await toolbar.getByRole('button', { name: '列左对齐' }).focus()
  await expect
    .poll(() =>
      toolbar.evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true)
  await fixture.screenshot({
    path: testInfo.outputPath('table-context-mobile-compact.png'),
  })
})

test('renders the table context surface in dark theme', async ({ page }, testInfo) => {
  await page.goto(
    '/?audit=ui-states&theme=dark&markdownEditorTransaction=1&markdownEditorTable=1',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const textarea = fixture.locator('.el-markdown-editor textarea')
  await expect(textarea).toHaveValue(table)
  await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    const offset = target.value.indexOf('Runtime projection')
    target.setSelectionRange(offset, offset)
    target.dispatchEvent(new Event('select', { bubbles: true }))
  })
  await expect(fixture.getByRole('toolbar', { name: 'Table actions' })).toBeVisible()
  await fixture.screenshot({ path: testInfo.outputPath('table-context-dark.png') })
})
