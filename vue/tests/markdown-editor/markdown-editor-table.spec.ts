import { writeFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'
import type { Locator, TestInfo } from '@playwright/test'

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
  if (!editorBox || !overlayBox) return null

  expect(overlayBox.x).toBeGreaterThanOrEqual(editorBox.x - 1)
  expect(overlayBox.y).toBeGreaterThanOrEqual(editorBox.y - 1)
  expect(overlayBox.x + overlayBox.width).toBeLessThanOrEqual(
    editorBox.x + editorBox.width + 1,
  )
  expect(overlayBox.y + overlayBox.height).toBeLessThanOrEqual(
    editorBox.y + editorBox.height + 1,
  )
  return {
    editor: {
      bottom: editorBox.y + editorBox.height,
      left: editorBox.x,
      right: editorBox.x + editorBox.width,
      top: editorBox.y,
    },
    overlay: {
      bottom: overlayBox.y + overlayBox.height,
      left: overlayBox.x,
      right: overlayBox.x + overlayBox.width,
      top: overlayBox.y,
    },
    tolerancePx: 1,
  }
}

const attachContainmentEvidence = async (
  testInfo: TestInfo,
  name: string,
  evidence: Awaited<ReturnType<typeof expectContainedByEditor>>,
  viewport: { height: number; width: number } | null,
) => {
  expect(evidence).not.toBeNull()
  const path = testInfo.outputPath(`${name}.json`)
  const body = JSON.stringify(
    {
      ...evidence,
      input: name.includes('touch') ? 'simulated-touch' : 'keyboard',
      limitation: name.includes('touch')
        ? 'Deterministic browser simulation; no physical touch hardware was used.'
        : undefined,
      name,
      viewport,
    },
    null,
    2,
  )
  await writeFile(path, body)
  await testInfo.attach(`${name}.json`, {
    path,
    contentType: 'application/json',
  })
}

test('renders and operates the source-anchored table context surface', async ({
  page,
}, testInfo) => {
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1&markdownEditorTableEvidence=1',
    {
      waitUntil: 'domcontentloaded',
    },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  await expect(fixture.getByTestId('markdown-attachment-batch')).toHaveCount(0)
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
    .toBe(table.indexOf('Editorial systems'))
  await expect(editor.locator('[aria-live="polite"]')).toHaveText(
    'Row 2, Column 2',
  )

  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem')).toHaveCount(14)
  await expect(menu.getByRole('menuitem', { name: '在上方插入行' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: '在下方插入行' })).toBeFocused()
  await attachContainmentEvidence(
    testInfo,
    'desktop-keyboard-containment',
    await expectContainedByEditor(editor, menu),
    page.viewportSize(),
  )
  await fixture.screenshot({
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

  await trigger.click()
  await menu.getByRole('menuitem', { name: '下移当前行' }).click()
  await expect(textarea).toHaveValue(
    /\| {2}\| {2}\| {2}\|\n\| Documentation migration \| Editorial systems \| In review \|/,
  )
  await trigger.click()
  await menu.getByRole('menuitem', { name: '右移当前列' }).click()
  await expect(textarea).toHaveValue(
    /^\| Project \| Status \| Owner \|[\s\S]*\| Documentation migration \| In review \| Editorial systems \|/,
  )

  await fixture.screenshot({ path: testInfo.outputPath('table-context-light.png') })

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
  await attachContainmentEvidence(
    testInfo,
    'mobile-touch-target-containment',
    await expectContainedByEditor(editor, menu),
    page.viewportSize(),
  )
  await fixture.screenshot({
    path: testInfo.outputPath('table-context-mobile-compact.png'),
  })
})

test('freezes table navigation during deterministic IME simulation', async ({
  page,
}) => {
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1&markdownEditorTableEvidence=1',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  await expect(textarea).toHaveValue(table)
  await selectTableCell(textarea, table, 'Documentation migration')
  const initialSelection = await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    return { end: target.selectionEnd, start: target.selectionStart }
  })

  await textarea.dispatchEvent('compositionstart', { data: '编' })
  await textarea.dispatchEvent('keydown', {
    bubbles: true,
    cancelable: true,
    isComposing: true,
    key: 'Tab',
  })
  await expect
    .poll(() =>
      textarea.evaluate((element) => {
        const target = element as HTMLTextAreaElement
        return { end: target.selectionEnd, start: target.selectionStart }
      }),
    )
    .toEqual(initialSelection)
  await expect(editor.locator('[aria-live="polite"]')).toHaveText('')

  await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    const insertAt = target.selectionStart
    target.value = `${target.value.slice(0, insertAt)}编${target.value.slice(insertAt)}`
    target.setSelectionRange(insertAt + 1, insertAt + 1)
  })
  await textarea.dispatchEvent('compositionend', { data: '编' })
  await expect(textarea).toHaveValue(/编Documentation migration/)
  const composedValue = await textarea.inputValue()
  await textarea.press('Control+z')
  await expect(textarea).toHaveValue(table)
  await textarea.press('Control+Shift+z')
  await expect(textarea).toHaveValue(composedValue)
  await expect(fixture.getByRole('button', { name: '表格操作' })).toBeVisible()
  await textarea.press('Tab')
  await expect
    .poll(() =>
      textarea.evaluate((element) => (element as HTMLTextAreaElement).selectionStart),
    )
    .toBe(table.indexOf('Editorial systems') + 1)
  await expect(editor.locator('[aria-live="polite"]')).toHaveText(
    'Row 2, Column 2',
  )
})

test('pastes one table transaction, undoes once, and exits to source caret', async ({
  page,
}) => {
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  await expect(textarea).toHaveValue(table)
  await selectTableCell(textarea, table, 'Runtime projection')

  await textarea.evaluate((element) => {
    const transfer = new DataTransfer()
    transfer.setData('text/tab-separated-values', 'A\tB\nC\tD')
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: transfer })
    element.dispatchEvent(event)
  })
  await expect(textarea).toHaveValue(/\| A \| B \| Ready \|/)
  await expect(textarea).toHaveValue(/\| C \| D \| {2}\|/)
  await expect(fixture.getByTestId('markdown-editor-history')).toContainText(
    '"undoDepth":1',
  )

  const trigger = fixture.getByRole('button', { name: '表格操作' })
  await expect(trigger).toBeVisible()
  await trigger.click()
  await fixture
    .getByRole('menu', { name: '表格操作' })
    .getByRole('menuitem', { name: '格式化表格' })
    .click()
  await expect(fixture.getByTestId('markdown-editor-history')).toContainText(
    '"undoDepth":2',
  )

  await fixture.getByTestId('markdown-undo').click()
  await expect(textarea).toHaveValue(/\| A \| B \| Ready \|/)
  await fixture.getByTestId('markdown-undo').click()
  await expect(textarea).toHaveValue(table)

  await selectTableCell(textarea, table, 'Project')
  await textarea.press('Shift+Tab')
  await expect
    .poll(() =>
      textarea.evaluate((element) => (element as HTMLTextAreaElement).selectionStart),
    )
    .toBe(0)
  await expect(fixture.getByRole('button', { name: '表格操作' })).toBeHidden()
  await expect(editor.locator('[aria-live="polite"]')).toHaveText(
    'Exited table backward',
  )
})

test('renders the table context surface in dark theme', async ({ page }, testInfo) => {
  await page.goto(
    '/?audit=ui-states&theme=dark&markdownEditorTransaction=1&markdownEditorTable=1&markdownEditorTableEvidence=1',
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
  await attachContainmentEvidence(
    testInfo,
    'dark-keyboard-containment',
    await expectContainedByEditor(editor, menu),
    page.viewportSize(),
  )
  await fixture.screenshot({ path: testInfo.outputPath('table-context-dark.png') })
})

test('keeps the compact menu usable in RTL, zoom and simulated touch input', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1&markdownEditorTableEvidence=1',
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
  await attachContainmentEvidence(
    testInfo,
    'rtl-200pct-simulated-touch-containment',
    await expectContainedByEditor(editor, menu),
    page.viewportSize(),
  )
  await fixture.screenshot({
    path: testInfo.outputPath('table-context-rtl-zoom-touch-simulation.png'),
  })
})

test('contains a 20 by 50 table and restores selection and scroll across modes', async ({
  page,
}, testInfo) => {
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1&markdownEditorTableEvidence=1&markdownEditorTableMatrix=20x50&markdownEditorModeMatrix=1&markdownEditorMode=split',
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

  await fixture.screenshot({
    path: testInfo.outputPath('table-20x50-split-scroll.png'),
  })
})

test('keeps 1 by 1 and large-document table transactions scoped', async ({
  page,
}) => {
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1&markdownEditorTableEvidence=1&markdownEditorTableMatrix=1x1',
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
    '/?audit=ui-states&markdownEditorTransaction=1&markdownEditorTable=1&markdownEditorTableEvidence=1&markdownEditorTableMatrix=large',
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
