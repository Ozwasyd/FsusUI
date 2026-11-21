import { expect, test } from '@playwright/test'

const sampleDocument = [
  '# Heading Title',
  '',
  'Paragraph with **bold**, *italic*, `inline code`, and [FsusUI](https://example.test).',
  '',
  '- List item one',
  '- [x] Completed task',
  '',
  '> Blockquote line',
  '',
  '```ts',
  'const answer = 42',
  '```',
].join('\n')

for (const theme of ['light', 'dark'] as const) {
  test(`live mode projects visible semantic tokens, reveals active markers, clears on Escape, and syncs scroll (${theme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme })
    await page.goto(
      `/?audit=ui-states&theme=${theme}&markdownEditorTransaction=1&markdownEditorModeMatrix=1&markdownLocale=en`,
      { waitUntil: 'domcontentloaded' },
    )

    const fixture = page.getByTestId('markdown-editor-transaction-fixture')
    const editor = fixture.locator('.el-markdown-editor')
    const textarea = editor.locator('textarea')
    const liveLayer = editor.locator('.el-markdown-editor__live-layer')
    const liveTab = editor.locator('.el-markdown-editor__mode--live')

    await expect(editor).toBeVisible()
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)

    // In source mode, live visual layer is not rendered.
    await textarea.fill(sampleDocument)
    await expect(liveLayer).toHaveCount(0)

    // Switch source -> live: visible formatted live-layer appears with exact text fidelity.
    await liveTab.click()
    await expect(editor).toHaveClass(/is-live-visual/)
    await expect(liveLayer).toBeVisible()
    await expect(liveLayer).toHaveAttribute('aria-hidden', 'true')
    await expect(liveLayer).toHaveAttribute('data-markdown-live-visual', '')
    expect(await liveLayer.textContent()).toBe(sampleDocument)

    await expect(
      liveLayer.locator('.el-markdown-editor__live-token--heading').first(),
    ).toBeVisible()
    await expect(
      liveLayer.locator('.el-markdown-editor__live-token--strong').first(),
    ).toBeVisible()
    await expect(
      liveLayer.locator('.el-markdown-editor__live-token--emphasis').first(),
    ).toBeVisible()
    await expect(
      liveLayer.locator('.el-markdown-editor__live-token--inline-code').first(),
    ).toBeVisible()
    await expect(
      liveLayer.locator('.el-markdown-editor__live-token--link-label').first(),
    ).toBeVisible()
    await expect(
      liveLayer.locator('.el-markdown-editor__live-token--list-marker').first(),
    ).toBeVisible()
    await expect(
      liveLayer.locator('.el-markdown-editor__live-token--quote').first(),
    ).toBeVisible()
    await expect(
      liveLayer.locator('.el-markdown-editor__live-token--code-block').first(),
    ).toBeVisible()

    // Move caret into **bold** to reveal active syntax markers.
    const boldOffset = sampleDocument.indexOf('bold') + 1
    await textarea.focus()
    await textarea.evaluate((element, offset) => {
      const target = element as HTMLTextAreaElement
      target.setSelectionRange(offset, offset)
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }, boldOffset)

    const revealedMarkers = liveLayer.locator(
      '.el-markdown-editor__live-token.is-marker.is-revealed',
    )
    await expect(revealedMarkers).toHaveCount(2)
    await expect(revealedMarkers.first()).toHaveCSS('opacity', '1')

    // Escape dismisses reveal without mutating source.
    await textarea.press('Escape')
    await expect(
      liveLayer.locator('.el-markdown-editor__live-token.is-revealed'),
    ).toHaveCount(0)
    expect(await textarea.inputValue()).toBe(sampleDocument)
    expect(await liveLayer.textContent()).toBe(sampleDocument)

    // Tall document scroll synchronizes textarea and live-layer scrollTop.
    const tallDocument = Array.from(
      { length: 40 },
      (_, index) => `## Section ${index + 1}\n\nBody paragraph **${index + 1}**.\n`,
    ).join('\n')
    await textarea.fill(tallDocument)
    await expect.poll(async () => liveLayer.textContent()).toBe(tallDocument)

    await textarea.evaluate((element) => {
      const target = element as HTMLTextAreaElement
      target.scrollTop = 180
      target.dispatchEvent(new Event('scroll'))
    })
    await expect
      .poll(async () => {
        const [textareaTop, layerTop] = await Promise.all([
          textarea.evaluate((element) => element.scrollTop),
          liveLayer.evaluate((element) => element.scrollTop),
        ])
        return Math.abs(textareaTop - layerTop)
      })
      .toBeLessThanOrEqual(1)
  })
}
