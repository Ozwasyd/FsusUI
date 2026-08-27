import { expect, test } from '@playwright/test'
import type { Locator } from '@playwright/test'

const table = [
  '| Project | Owner | Status |',
  '| --- | --- | --- |',
  '| Documentation migration | Editorial systems | In review |',
  '| Runtime projection | Platform team | Ready |',
].join('\n')

const selectTableCell = async (
  textarea: Locator,
  value: string,
  needle: string,
) => {
  await textarea.evaluate(
    (element, { source, targetText }) => {
      const target = element as HTMLTextAreaElement
      const offset = source.indexOf(targetText)
      target.setSelectionRange(offset, offset)
      target.dispatchEvent(new Event('select', { bubbles: true }))
    },
    { source: value, targetText: needle },
  )
}

const expectContainedByEditor = async (editor: Locator, overlay: Locator) => {
  const [editorBox, overlayBox] = await Promise.all([
    editor.boundingBox(),
    overlay.boundingBox(),
  ])
  expect(editorBox).not.toBeNull()
  expect(overlayBox).not.toBeNull()
  if (!editorBox || !overlayBox) return

  expect(overlayBox.x).toBeGreaterThanOrEqual(editorBox.x - 1)
  expect(overlayBox.y).toBeGreaterThanOrEqual(editorBox.y - 1)
  expect(overlayBox.x + overlayBox.width).toBeLessThanOrEqual(
    editorBox.x + editorBox.width + 1,
  )
  expect(overlayBox.y + overlayBox.height).toBeLessThanOrEqual(
    editorBox.y + editorBox.height + 1,
  )
}

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
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  await expect(textarea).toBeVisible()
  await expect(textarea).toHaveValue(table)
  await selectTableCell(textarea, table, 'Documentation migration')

  const trigger = fixture.getByRole('button', { name: '表格操作' })
  const menu = fixture.getByRole('menu', { name: '表格操作' })
  await expect(trigger).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeHidden()

  await textarea.press('Tab')
  await expect
    .poll(() =>
      textarea.evaluate((element) => (element as HTMLTextAreaElement).selectionStart),
    )
    .toBe(table.indexOf('Editorial systems') - 1)

  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem')).toHaveCount(10)
  await expect(menu.getByRole('menuitem', { name: '在上方插入行' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: '在下方插入行' })).toBeFocused()
  await expectContainedByEditor(editor, menu)
  await editor.screenshot({
    path: testInfo.outputPath('table-context-keyboard-focus.png'),
  })
  await page.keyboard.press('End')
  const finalAction = menu.getByRole('menuitem', { name: '格式化表格' })
  await expect(finalAction).toBeFocused()
  await expect(finalAction).toBeVisible()
  expect(await menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await page.keyboard.press('Home')
  await expect(menu.getByRole('menuitem', { name: '在上方插入行' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toBeFocused()

  await trigger.click()
  await menu.getByRole('menuitem', { name: '在下方插入行' }).click()
  await expect(textarea).toHaveValue(/\n\| {2}\| {2}\| {2}\|\n/)
  await expect(menu).toBeHidden()

  await editor.screenshot({ path: testInfo.outputPath('table-context-light.png') })

  await page.setViewportSize({ width: 390, height: 844 })
  await selectTableCell(textarea, await textarea.inputValue(), 'Documentation migration')
  await trigger.click()
  const touchTarget = await trigger.boundingBox()
  expect(touchTarget?.height).toBeGreaterThanOrEqual(44)
  await expect
    .poll(() =>
      menu.evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true)
  await page.keyboard.press('End')
  await expect(menu.getByRole('menuitem', { name: '格式化表格' })).toBeVisible()
  await expectContainedByEditor(editor, menu)
  await editor.screenshot({
    path: testInfo.outputPath('table-context-mobile-compact.png'),
  })
})

test('renders the table context surface in dark theme', async ({ page }, testInfo) => {
  await page.goto(
    '/?audit=ui-states&theme=dark&markdownEditorTransaction=1&markdownEditorTable=1',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  await expect(textarea).toHaveValue(table)
  await selectTableCell(textarea, table, 'Runtime projection')
  const trigger = fixture.getByRole('button', { name: '表格操作' })
  await expect(trigger).toBeVisible()
  await trigger.click()
  const menu = fixture.getByRole('menu', { name: '表格操作' })
  await expect(menu).toBeVisible()
  await expectContainedByEditor(editor, menu)
  await editor.screenshot({ path: testInfo.outputPath('table-context-dark.png') })
})

test('keeps the compact menu usable in RTL, zoom and simulated touch input', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  await expect(textarea).toHaveValue(table)
  await selectTableCell(textarea, table, 'Runtime projection')
  await fixture.evaluate((element) => {
    element.setAttribute('dir', 'rtl')
    ;(element as HTMLElement).style.zoom = '2'
  })

  const trigger = fixture.getByRole('button', { name: '表格操作' })
  await trigger.dispatchEvent('pointerdown', {
    pointerType: 'touch',
    isPrimary: true,
  })
  await trigger.dispatchEvent('pointerup', {
    pointerType: 'touch',
    isPrimary: true,
  })
  await trigger.click()
  const menu = fixture.getByRole('menu', { name: '表格操作' })
  await expect(menu).toBeVisible()
  await page.keyboard.press('End')
  await expect(menu.getByRole('menuitem', { name: '格式化表格' })).toBeFocused()
  await expect(menu.getByRole('menuitem', { name: '格式化表格' })).toBeVisible()
  const fixtureWidth = await fixture.evaluate((element) => element.getBoundingClientRect().width)
  const bodyWidth = await page.evaluate(() => document.documentElement.clientWidth)
  expect(fixtureWidth).toBeLessThanOrEqual(bodyWidth)
  await expectContainedByEditor(editor, menu)
  await editor.screenshot({
    path: testInfo.outputPath('table-context-rtl-zoom-touch-simulation.png'),
  })
})

test('contains a 20 by 50 table and restores selection and scroll across modes', async ({
  page,
}, testInfo) => {
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1&markdownEditorTableMatrix=20x50&markdownEditorModeMatrix=1&markdownEditorMode=split',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  const preview = editor.locator('.el-markdown-editor__preview')
  await expect(textarea).toBeVisible()
  await expect(textarea).toHaveValue(/r50c20/)
  await expect(preview).toBeVisible()

  const source = await textarea.inputValue()
  await selectTableCell(textarea, source, 'r25c10')
  const selectionStart = await textarea.evaluate(
    (element) => (element as HTMLTextAreaElement).selectionStart,
  )
  const scroll = await preview.evaluate((element) => {
    element.scrollLeft = element.scrollWidth
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
    return {
      clientWidth: element.clientWidth,
      left: element.scrollLeft,
      scrollWidth: element.scrollWidth,
    }
  })
  expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth)
  expect(scroll.left).toBeGreaterThan(0)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)

  await editor.locator('.el-markdown-editor__mode--source').click()
  await expect(preview).toBeHidden()
  await editor.locator('.el-markdown-editor__mode--live').click()
  await expect(preview).toBeHidden()
  await expect(textarea).toBeVisible()
  await editor.locator('.el-markdown-editor__mode--split').click()
  await expect(preview).toBeVisible()
  await expect(textarea).toBeVisible()
  await expect
    .poll(() =>
      textarea.evaluate((element) => (element as HTMLTextAreaElement).selectionStart),
    )
    .toBe(selectionStart)
  await expect
    .poll(() => preview.evaluate((element) => element.scrollLeft))
    .toBe(scroll.left)
  await expect(fixture.getByRole('button', { name: '表格操作' })).toBeVisible()

  await editor.screenshot({
    path: testInfo.outputPath('table-20x50-split-scroll.png'),
  })
})

test('keeps 1 by 1 and large-document table transactions scoped', async ({
  page,
}) => {
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1&markdownEditorTableMatrix=1x1',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  await expect(textarea).toHaveValue('| Column 1 |\n| --- |\n| r1c1 |')
  await selectTableCell(textarea, await textarea.inputValue(), 'r1c1')
  await textarea.press('Tab')
  await expect(textarea).toHaveValue('| Column 1 |\n| --- |\n| r1c1 |\n|  |')
  await expect(fixture.getByRole('button', { name: '表格操作' })).toBeVisible()

  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1&markdownEditorTableMatrix=large',
    { waitUntil: 'domcontentloaded' },
  )
  const largeFixture = page.getByTestId('markdown-editor-transaction-fixture')
  const largeEditor = largeFixture.locator('.el-markdown-editor')
  const largeTextarea = largeEditor.locator('textarea')
  const source = await largeTextarea.inputValue()
  const tableStart = source.indexOf('| Project |')
  const tableEnd = source.indexOf('\n\nParagraph after table 1.')
  expect(tableStart).toBeGreaterThan(0)
  expect(tableEnd).toBeGreaterThan(tableStart)
  const prefix = source.slice(0, tableStart)
  const suffix = source.slice(tableEnd)

  await selectTableCell(largeTextarea, source, 'Runtime projection')
  const trigger = largeFixture.getByRole('button', { name: '表格操作' })
  await trigger.click()
  const menu = largeFixture.getByRole('menu', { name: '表格操作' })
  await expectContainedByEditor(largeEditor, menu)
  await menu.getByRole('menuitem', { name: '格式化表格' }).click()
  const formatted = await largeTextarea.inputValue()
  expect(formatted.startsWith(prefix)).toBe(true)
  expect(formatted.endsWith(suffix)).toBe(true)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
})
