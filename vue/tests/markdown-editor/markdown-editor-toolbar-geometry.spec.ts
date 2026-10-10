import { expect, test } from '@playwright/test'

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [
    { width: 844, height: 390 },
    { width: 375, height: 812 },
    { width: 1280, height: 1100 },
  ]) {
    test(`overflow follows toolbar page scroll and stays beside horizontal commands ${theme} ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await page.emulateMedia({ colorScheme: theme })
      await page.goto(
        `/?audit=ui-states&theme=${theme}&markdownEditorTransaction=1&markdownCommandSurfaces=1&markdownLocale=en`,
        { waitUntil: 'domcontentloaded' },
      )
      const fixture = page.getByTestId('markdown-editor-transaction-fixture')
      const editor = fixture.locator('.el-markdown-editor')
      const toolbar = editor.locator('.el-markdown-editor__toolbar')
      const commands = editor.locator('.el-markdown-editor__commands')
      const more = editor.locator('.el-markdown-editor__command-more')
      await expect(more).toBeVisible()
      await toolbar.evaluate((element) =>
        element.scrollIntoView({ block: 'start' }),
      )
      await expect(more).toHaveCSS('position', 'static')
      const before = await more.boundingBox()
      const counts = await commands.getByRole('button').count()
      const scroll = await commands.evaluate((element) => {
        element.scrollLeft = element.scrollWidth
        return {
          offset: element.scrollLeft,
          overflow: element.scrollWidth > element.clientWidth,
        }
      })
      if (viewport.width === 375) {
        expect(scroll.overflow).toBe(true)
        expect(scroll.offset).toBeGreaterThan(0)
      }
      expect(await more.boundingBox()).toEqual(before)
      const scroller = await commands.boundingBox()
      expect(scroller!.x + scroller!.width).toBeLessThanOrEqual(before!.x)
      expect(before!.x + before!.width).toBeLessThanOrEqual(viewport.width)
      await more.click()
      const tray = editor.locator('.el-markdown-editor__command-tray')
      await expect(tray).toBeVisible()
      await expect(more).toHaveAttribute(
        'aria-controls',
        (await tray.getAttribute('id')) ?? '',
      )
      await expect(tray.getByRole('button').first()).toBeFocused()
      await tray.getByRole('button').first().press('Escape')
      await expect(tray).toBeHidden()
      await expect(more).toBeFocused()
      await expect(commands.getByRole('button')).toHaveCount(counts)
      await toolbar.evaluate((element) => {
        window.scrollBy(0, element.getBoundingClientRect().bottom + 60)
      })
      expect((await toolbar.boundingBox())!.y).toBeLessThan(-2)
      expect((await more.boundingBox())!.y).toBeLessThan(-2)
      await expect(more).toHaveCSS('position', 'static')
      const textarea = editor.locator('textarea')
      await textarea.focus()
      await textarea.press('Shift+Tab')
      await expect(more).toBeFocused()
      await expect(more).toBeInViewport()
      await more.press('Enter')
      await expect(tray).toBeVisible()
      await tray.getByRole('button').first().press('Escape')
      await expect(more).toBeFocused()
    })
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`long locale keeps narrow primary commands visible and keyboard reachable ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.emulateMedia({ colorScheme: theme })
    await page.goto(
      `/?audit=ui-states&markdownEditorTransaction=1&markdownCommandSurfaces=1&markdownLocale=long${theme === 'dark' ? '&theme=dark' : ''}`,
      { waitUntil: 'domcontentloaded' },
    )
    const editor = page
      .getByTestId('markdown-editor-transaction-fixture')
      .locator('.el-markdown-editor')
    const toolbar = editor.locator('.el-markdown-editor__toolbar')
    const commands = editor.locator('.el-markdown-editor__commands')
    const more = editor.locator('.el-markdown-editor__command-more')
    const buttons = commands.getByRole('button')
    await expect(buttons).toHaveCount(6)
    await expect(page.locator('html')).toHaveAttribute(
      'data-theme-resolved',
      theme,
    )
    await page.evaluate(() => document.fonts.ready)
    await toolbar.evaluate((element) =>
      element.scrollIntoView({ block: 'start' }),
    )
    const minimumCommandWidth = await buttons.first().evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).minInlineSize),
    )
    expect((await commands.boundingBox())!.width).toBeGreaterThanOrEqual(
      minimumCommandWidth,
    )
    await buttons.first().focus()
    for (let index = 0; index < 6; index++) {
      const button = buttons.nth(index)
      await expect(button).toBeFocused()
      const visibleWidth = await button.evaluate((element) => {
        const target = element.getBoundingClientRect()
        const scroller = element.parentElement!.getBoundingClientRect()
        return Math.max(
          0,
          Math.min(target.right, scroller.right, innerWidth) -
            Math.max(target.left, scroller.left, 0),
        )
      })
      expect(visibleWidth).toBeGreaterThanOrEqual(minimumCommandWidth)
      await button.press('Tab')
    }
    await expect(more).toBeFocused()
    await expect(more).toBeInViewport()
    const overflowBox = (await more.boundingBox())!
    expect(overflowBox.x).toBeGreaterThanOrEqual(0)
    expect(overflowBox.x + overflowBox.width).toBeLessThanOrEqual(375)
    await expect(more).toHaveAccessibleName(
      'A deliberately extended localization fixture that preserves every semantic label 2 format tools',
    )
    await more.press('Enter')
    const tray = editor.locator('.el-markdown-editor__command-tray')
    await expect(tray.getByRole('button')).toHaveCount(2)
    await expect(tray.getByRole('button').first()).toBeFocused()
    await tray.getByRole('button').first().press('Escape')
    await expect(tray).toBeHidden()
    await expect(more).toBeFocused()
    await expect(buttons).toHaveCount(6)
  })
}
