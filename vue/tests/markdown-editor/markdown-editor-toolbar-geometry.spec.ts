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
