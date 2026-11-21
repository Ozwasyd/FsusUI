import { expect, test, type CDPSession } from '@playwright/test'

// CDP generates trusted Chromium key events, not physical/native OS IME evidence.
for (const viewport of [
  { width: 1280, height: 1100 },
  { width: 375, height: 812 },
]) {
  for (const theme of ['light', 'dark'] as const) {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      test(`palette IME Enter ${viewport.width} ${theme} ${reducedMotion}`, async ({
        page,
      }, testInfo) => {
        const pageErrors: string[] = []
        page.on('pageerror', (error) => pageErrors.push(error.message))
        await page.setViewportSize(viewport)
        await page.emulateMedia({ colorScheme: theme, reducedMotion })
        await page.addInitScript(() => {
          const events: unknown[] = []
          ;(
            window as typeof window & { paletteImeEvents: unknown[] }
          ).paletteImeEvents = events
          for (const name of [
            'keydown',
            'compositionstart',
            'compositionupdate',
            'compositionend',
            'input',
          ]) {
            document.addEventListener(name, (event) => {
              if (
                !(event.target instanceof HTMLInputElement) ||
                event.target.getAttribute('role') !== 'combobox'
              )
                return
              events.push({
                type: event.type,
                key: event instanceof KeyboardEvent ? event.key : undefined,
                keyCode:
                  event instanceof KeyboardEvent ? event.keyCode : undefined,
                isComposing:
                  event instanceof KeyboardEvent || event instanceof InputEvent
                    ? event.isComposing
                    : undefined,
                isTrusted: event.isTrusted,
                defaultPrevented: event.defaultPrevented,
              })
            })
          }
        })
        const observations: unknown[] = []
        let session: CDPSession | undefined
        try {
          await page.goto(
            `/?audit=ui-states&markdownEditorTransaction=1&markdownCommandSurfaces=1&markdownPaletteIme=1&theme=${theme}`,
            { waitUntil: 'domcontentloaded' },
          )
          const fixture = page.getByTestId(
            'markdown-editor-transaction-fixture',
          )
          const source = fixture.locator('textarea').first()
          const originalSource = await source.inputValue()
          const runs = page.getByTestId('markdown-palette-command-runs')
          await expect(runs).toHaveText('0')
          await page.getByTestId('markdown-open-command-palette').click()
          const dialog = page.getByRole('dialog', { name: '命令面板' })
          const search = dialog.getByRole('combobox')
          await expect(search).toBeFocused()
          await expect(dialog.getByRole('option')).toHaveCount(1)
          await page.screenshot({
            path: testInfo.outputPath('palette-before-ime.png'),
          })
          session = await page.context().newCDPSession(page)
          await session.send('Input.imeSetComposition', {
            text: '确认',
            selectionStart: 2,
            selectionEnd: 2,
          })
          await session.send('Input.dispatchKeyEvent', {
            type: 'keyDown',
            key: 'Enter',
            code: 'Enter',
            windowsVirtualKeyCode: 13,
            nativeVirtualKeyCode: 13,
          })
          await session.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: 'Enter',
            code: 'Enter',
            windowsVirtualKeyCode: 13,
            nativeVirtualKeyCode: 13,
          })
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
              ),
          )
          const composingEvents = await page.evaluate(
            () =>
              (
                window as typeof window & {
                  paletteImeEvents: {
                    type: string
                    key?: string
                    isTrusted: boolean
                    isComposing?: boolean
                    defaultPrevented: boolean
                  }[]
                }
              ).paletteImeEvents,
          )
          const composingEnter = composingEvents.find(
            (event) => event.type === 'keydown' && event.key === 'Enter',
          )
          observations.push({
            stage: 'composing-enter',
            runs: await runs.textContent(),
            paletteVisible: await dialog.isVisible(),
            event: composingEnter,
          })
          expect(composingEnter).toMatchObject({
            isTrusted: true,
            isComposing: true,
          })
          expect((await runs.textContent())?.trim()).toBe('0')
          expect(composingEnter?.defaultPrevented).toBe(false)
          await expect(dialog).toBeVisible()
          await expect(search).toBeFocused()
          await expect(source).toHaveValue(originalSource)
          await page.screenshot({
            path: testInfo.outputPath('palette-composing-enter.png'),
          })
          await session.send('Input.insertText', { text: '确认' })
          await expect(search).toHaveValue('确认')
          await expect(dialog.getByRole('option')).toHaveCount(1)
          await search.press('Enter')
          await expect(runs).toHaveText('1')
          await expect(dialog).toBeHidden()
          await expect(source).toHaveValue(originalSource)
          const events = await page.evaluate(
            () =>
              (
                window as typeof window & {
                  paletteImeEvents: {
                    type: string
                    key?: string
                    isTrusted: boolean
                    isComposing?: boolean
                    defaultPrevented: boolean
                  }[]
                }
              ).paletteImeEvents,
          )
          const enters = events.filter(
            (event) => event.type === 'keydown' && event.key === 'Enter',
          )
          expect(enters).toHaveLength(2)
          expect(enters[1]).toMatchObject({
            isTrusted: true,
            isComposing: false,
            defaultPrevented: true,
          })
          observations.push({
            stage: 'ordinary-enter',
            runs: await runs.textContent(),
            paletteVisible: await dialog.isVisible(),
            event: enters[1],
          })
          expect(pageErrors).toEqual([])
        } finally {
          // End browser composition even when a regression assertion fails.
          if (session) {
            try {
              await session.send('Input.imeSetComposition', {
                text: '',
                selectionStart: 0,
                selectionEnd: 0,
              })
            } finally {
              await session.detach()
            }
          }
          const events = await page.evaluate(
            () =>
              (window as typeof window & { paletteImeEvents?: unknown[] })
                .paletteImeEvents ?? [],
          )
          await testInfo.attach('ime-key-sequence', {
            body: JSON.stringify(
              {
                browserVersion: page.context().browser()?.version(),
                nativeOsImeEvidence: false,
                observations,
                events,
                pageErrors,
              },
              null,
              2,
            ),
            contentType: 'application/json',
          })
        }
      })
    }
  }
}
