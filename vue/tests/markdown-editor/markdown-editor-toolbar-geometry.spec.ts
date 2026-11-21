import { expect, test } from '@playwright/test'

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [
    { width: 320, height: 812 },
    { width: 375, height: 812 },
    { width: 844, height: 390 },
    { width: 1280, height: 1100 },
  ]) {
    test(`overflow adapts cleanly to container width without clipping and preserves #825 geometry ${theme} ${viewport.width}x${viewport.height}`, async ({
      page,
      browserName,
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

      // Wait for frame-scheduled responsive toolbar overflow measurement to settle.
      await expect
        .poll(async () =>
          commands.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
        )
        .toBe(true)

      await expect(more).toHaveCSS('position', 'static')
      const before = await more.boundingBox()
      const primaryButtons = commands.getByRole('button')
      const counts = await primaryButtons.count()
      const geometry = await commands.evaluate((element) => {
        const containerRect = element.getBoundingClientRect()
        const buttonRects = Array.from(
          element.querySelectorAll<HTMLButtonElement>('button'),
          (button) => button.getBoundingClientRect(),
        )
        return {
          allButtonsFit: buttonRects.every(
            (rect) =>
              rect.left >= containerRect.left - 1 &&
              rect.right <= containerRect.right + 1,
          ),
          clientWidth: element.clientWidth,
          scrollLeft: element.scrollLeft,
          scrollWidth: element.scrollWidth,
        }
      })
      expect(geometry.scrollWidth).toBeLessThanOrEqual(
        geometry.clientWidth + 1,
      )
      expect(geometry.scrollLeft).toBe(0)
      expect(geometry.allButtonsFit).toBe(true)

      expect(await more.boundingBox()).toEqual(before)
      const scroller = await commands.boundingBox()
      expect(scroller!.x + scroller!.width).toBeLessThanOrEqual(before!.x + 1)
      expect(before!.x + before!.width).toBeLessThanOrEqual(viewport.width)

      const badgeText = await more
        .locator('.el-markdown-editor__command-more-count')
        .textContent()
      const badgeCount = Number.parseInt(badgeText?.trim() ?? '0', 10)
      expect(badgeCount).toBeGreaterThan(0)

      await more.click()
      const tray = editor.locator('.el-markdown-editor__command-tray')
      await expect(tray).toBeVisible()
      const trayCount = await tray.getByRole('button').count()
      expect(trayCount).toBe(badgeCount)
      const totalProbeCommands = await editor
        .locator(
          '.el-markdown-editor__command-measure [data-measure-role="command"]',
        )
        .count()
      expect(counts).toBeLessThanOrEqual(totalProbeCommands)
      expect(counts + trayCount).toBeGreaterThanOrEqual(totalProbeCommands)

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
      await textarea.press(
        process.platform === 'darwin' && browserName === 'webkit'
          ? 'Alt+Shift+Tab'
          : 'Shift+Tab',
      )
      await expect(more).toBeFocused()
      await expect(more).toBeInViewport()
      await more.press('Enter')
      await expect(tray).toBeVisible()
      await tray.getByRole('button').first().press('Escape')
      await expect(more).toBeFocused()
    })
  }
}
