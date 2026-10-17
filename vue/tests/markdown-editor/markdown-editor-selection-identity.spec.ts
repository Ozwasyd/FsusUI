import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const source = '# Same\n\nfirst body\n\n# Same\n\nlast body\n'
const identity = { id: 'markdown-command-default', epoch: 1 }

const observation = async (page: Page) =>
  JSON.parse(
    (
      await page.getByTestId('markdown-editor-selection').textContent()
    )?.trim() || 'null',
  )

for (const mode of ['source', 'live', 'split']) {
  test(`${mode} emits identity-bound native Ctrl+Home/End caret observations`, async ({
    page,
  }) => {
    await page.goto(
      `/?audit=ui-states&markdownEditorTransaction=1&markdownEditorMode=${mode}`,
    )
    const fixture = page.getByTestId('markdown-editor-transaction-fixture')
    await expect(fixture).toBeVisible()
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    const textarea = fixture.locator('textarea')
    await textarea.fill(source)
    await textarea.press('Control+End')
    await expect
      .poll(async () => (await observation(page))?.selection.start)
      .toBe(source.length)
    const revision = (await observation(page)).revision
    await textarea.press('Control+Home')
    await expect
      .poll(async () =>
        textarea.evaluate(
          (element) => (element as HTMLTextAreaElement).selectionStart,
        ),
      )
      .toBe(0)
    await expect
      .poll(async () => observation(page))
      .toMatchObject({
        documentIdentity: identity,
        revision,
        selection: { start: 0, end: 0 },
      })
    await textarea.press('Control+End')
    await expect
      .poll(async () => observation(page))
      .toMatchObject({
        documentIdentity: identity,
        revision,
        selection: { start: source.length, end: source.length },
      })
    await expect(textarea).toHaveValue(source)
  })

  test(`${mode} binds real pointer selection to the current document and revision`, async ({
    page,
  }) => {
    await page.goto(
      `/?audit=ui-states&markdownEditorTransaction=1&markdownEditorMode=${mode}`,
    )
    const textarea = page
      .getByTestId('markdown-editor-transaction-fixture')
      .locator('textarea')
    await textarea.fill(source)
    await textarea.press('Control+End')
    const revision = (await observation(page)).revision
    await textarea.click({ position: { x: 25, y: 15 } })
    await expect
      .poll(async () => (await observation(page))?.selection.start)
      .toBeLessThan(source.length)
    const selection = await textarea.evaluate((element) => {
      const target = element as HTMLTextAreaElement
      return { start: target.selectionStart, end: target.selectionEnd }
    })
    await expect
      .poll(async () => observation(page))
      .toMatchObject({ documentIdentity: identity, revision, selection })
    await expect(textarea).toHaveValue(source)
  })
}
