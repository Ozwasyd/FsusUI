import { expect, test, type Page } from '@playwright/test'

const installClipboardProbe = async (page: Page) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          ;(
            globalThis as typeof globalThis & {
              __markdownClipboardProbe?: string
            }
          ).__markdownClipboardProbe = value
        },
      },
    })
  })
}

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

  const body = editor.locator('.el-markdown-editor__body')
  const bodyBeforeOverflow = await body.boundingBox()
  const selectionBeforeOverflow = await textarea.evaluate((element) => ({
    end: element.selectionEnd,
    start: element.selectionStart,
  }))
  const revisionBeforeOverflow = await page
    .getByTestId('markdown-editor-revision')
    .textContent()
  await editor.locator('.el-markdown-editor__command-more').click()
  await expect(
    editor.locator('.el-markdown-editor__command-tray'),
  ).toBeVisible()
  const bodyAfterOverflow = await body.boundingBox()
  expect(bodyAfterOverflow).toEqual(bodyBeforeOverflow)
  expect(
    await textarea.evaluate((element) => ({
      end: element.selectionEnd,
      start: element.selectionStart,
    })),
  ).toEqual(selectionBeforeOverflow)
  await expect(page.getByTestId('markdown-editor-revision')).toHaveText(
    revisionBeforeOverflow ?? '',
  )
  const tray = editor.locator('.el-markdown-editor__command-tray')
  await expect(tray.getByRole('button').first()).toBeFocused()
  await tray.getByRole('button').first().press('Escape')
  await expect(editor.locator('.el-markdown-editor__command-tray')).toBeHidden()
  await expect(
    editor.locator('.el-markdown-editor__command-more'),
  ).toBeFocused()
  await expect(textarea).toHaveValue('**text**')

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

test('edits, validates, reveals, copies, opens, and unwraps a projected link', async ({
  page,
}) => {
  await installClipboardProbe(page)
  await page.context().route('https://old.test/**', async (route) => {
    await route.fulfill({ body: 'local URL authority fixture', status: 200 })
  })
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownCommandSurfaces=1&markdownContextual=link',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  const body = editor.locator('.el-markdown-editor__body')
  const bodyBefore = await body.boundingBox()
  await textarea.evaluate((element: HTMLTextAreaElement) => {
    element.setSelectionRange(1, 5)
    element.dispatchEvent(new Event('select', { bubbles: true }))
  })
  await editor.getByRole('button', { name: '编辑链接' }).click()

  const surface = editor.locator('.el-markdown-editor__property-surface')
  await expect(surface).toBeVisible()
  await expect(surface).toHaveAttribute(
    'data-markdown-anchor-id',
    /^syn:markdown-command-link:1:link:/,
  )
  await expect(surface.locator('input').first()).toBeFocused()
  expect(await body.boundingBox()).toEqual(bodyBefore)

  await surface.getByRole('button', { name: '复制' }).click()
  expect(
    await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __markdownClipboardProbe?: string
          }
        ).__markdownClipboardProbe,
    ),
  ).toBe('https://old.test')

  const popupPromise = page.waitForEvent('popup')
  await surface.getByRole('button', { name: '打开' }).click()
  const popup = await popupPromise
  await expect(popup).toHaveURL(/^https:\/\/old\.test\/?$/)
  await popup.close()

  await surface.locator('input').nth(1).fill('javascript:alert(1)')
  await surface.getByRole('button', { name: '应用' }).click()
  await expect(surface.getByRole('alert')).toHaveText(
    '链接地址不安全或不受支持',
  )
  await expect(textarea).toHaveValue('[Docs](https://old.test "Title")')

  await surface.locator('input').nth(0).fill('Guide')
  await surface.locator('input').nth(1).fill('https://next.test')
  await surface.locator('input').nth(2).fill('Next')
  await surface.getByRole('button', { name: '应用' }).click()
  await expect(textarea).toHaveValue('[Guide](https://next.test "Next")')
  await expect(surface).toBeHidden()

  await textarea.evaluate((element: HTMLTextAreaElement) => {
    element.setSelectionRange(1, 6)
    element.dispatchEvent(new Event('select', { bubbles: true }))
  })
  await editor.getByRole('button', { name: '编辑链接' }).click()
  await surface.getByRole('button', { name: '在源码中显示' }).click()
  await expect(textarea).toBeFocused()
  expect(
    await textarea.evaluate((element: HTMLTextAreaElement) => ({
      end: element.selectionEnd,
      start: element.selectionStart,
    })),
  ).toEqual({ end: 33, start: 0 })

  await editor.getByRole('button', { name: '编辑链接' }).click()
  await surface.getByRole('button', { name: '移除链接' }).click()
  await expect(textarea).toHaveValue('Guide')
  await page.getByTestId('markdown-undo').click()
  await expect(textarea).toHaveValue('[Guide](https://next.test "Next")')
})

test('inserts, edits, copies, and removes a projected block anchor', async ({
  page,
}) => {
  await installClipboardProbe(page)
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownCommandSurfaces=1&markdownContextual=anchor',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  const textarea = editor.locator('textarea')
  await textarea.evaluate((element: HTMLTextAreaElement) => {
    element.setSelectionRange(12, 14)
    element.dispatchEvent(new Event('select', { bubbles: true }))
  })
  await editor.getByRole('button', { name: '编辑块锚点' }).click()
  const surface = editor.locator('.el-markdown-editor__property-surface')
  await expect(surface).toHaveAttribute(
    'data-markdown-anchor-id',
    /^syn:markdown-command-anchor:1:anchor:/,
  )
  await surface.locator('input').fill('updated')
  await surface.getByRole('button', { name: '应用' }).click()
  await expect(textarea).toHaveValue('Paragraph ^updated')

  await textarea.evaluate((element: HTMLTextAreaElement) => {
    element.setSelectionRange(12, 15)
    element.dispatchEvent(new Event('select', { bubbles: true }))
  })
  await editor.getByRole('button', { name: '编辑块锚点' }).click()
  await surface.getByRole('button', { name: '复制' }).click()
  expect(
    await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __markdownClipboardProbe?: string
          }
        ).__markdownClipboardProbe,
    ),
  ).toBe('^updated')
  await surface.getByRole('button', { name: '移除锚点' }).click()
  await expect(textarea).toHaveValue('Paragraph')

  await page.getByTestId('markdown-open-command-palette').click()
  const palette = page.locator('.el-markdown-editor__palette-dialog')
  await palette.getByRole('option', { name: '插入块锚点' }).click()
  await surface.locator('input').fill('explicit')
  await surface.getByRole('button', { name: '应用' }).click()
  await expect(textarea).toHaveValue('Paragraph ^explicit')
})

test('renders locale authority, long copy, RTL, and status density without fallback copy', async ({
  page,
}) => {
  test.setTimeout(360_000)

  for (const locale of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'ru', 'ar', 'de']) {
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
    if (locale === 'ar') {
      await expect(fixture).toHaveAttribute('dir', 'rtl')
      expect(
        await palette.evaluate(
          (element) => getComputedStyle(element).direction,
        ),
      ).toBe('rtl')
    }
    await palette.press('Escape')
  }

  await page.setViewportSize({ height: 812, width: 375 })
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownCommandSurfaces=1&markdownLocale=long&markdownStatus=detailed&markdownMobile=compact',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const editor = fixture.locator('.el-markdown-editor')
  await expect(
    editor.locator('.el-markdown-editor__status-details'),
  ).toBeVisible()
  await page.getByTestId('markdown-open-command-palette').click()
  const palette = page.locator('.el-markdown-editor__palette-dialog')
  const paletteInput = palette.locator('.el-markdown-editor__palette-input')
  const paletteSearchLabel = palette.locator(
    '.el-markdown-editor__palette-search-label',
  )
  expect(await paletteInput.getAttribute('aria-label')).toBe(
    await paletteInput.getAttribute('placeholder'),
  )
  await expect(paletteSearchLabel).toBeVisible()
  await expect(paletteSearchLabel).toHaveText(
    await paletteInput.getAttribute('placeholder')!,
  )
  const paletteBox = await palette.boundingBox()
  expect(paletteBox).not.toBeNull()
  expect(paletteBox!.x).toBeGreaterThanOrEqual(0)
  expect(paletteBox!.x + paletteBox!.width).toBeLessThanOrEqual(375)
  expect(paletteBox!.y + paletteBox!.height).toBeLessThanOrEqual(812)
  expect(
    await palette.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true)
  expect(
    await paletteSearchLabel.evaluate(
      (element) =>
        element.scrollWidth <= element.clientWidth &&
        element.getBoundingClientRect().height /
          Number.parseFloat(getComputedStyle(element).fontSize) >
          1.5,
    ),
  ).toBe(true)
  const optionLayouts = await palette
    .getByRole('option')
    .evaluateAll((options) =>
      options.map((option) => {
        const label = option.querySelector('span')
        if (!(label instanceof HTMLElement)) {
          return { labelLines: 0, overflowFree: false }
        }
        const fontSize = Number.parseFloat(getComputedStyle(label).fontSize)
        return {
          labelLines: label.getBoundingClientRect().height / fontSize,
          overflowFree:
            option.scrollWidth <= option.clientWidth &&
            label.scrollWidth <= label.clientWidth,
        }
      }),
    )
  expect(optionLayouts.every(({ overflowFree }) => overflowFree)).toBe(true)
  expect(optionLayouts.some(({ labelLines }) => labelLines > 1.5)).toBe(true)

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
