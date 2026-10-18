import { expect, test } from '@playwright/test'

const fixture =
  '/@fs/workspace/FsusUI/vue/tests/markdown-editor/reveal-completion.fixture.html'
for (const theme of ['light', 'dark']) {
  test(`acknowledges actual full backward selection/focus/viewport in ${theme}`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: theme === 'light' ? 'light' : 'dark',
      reducedMotion: 'reduce',
    })
    await page.goto(fixture)
    await page.locator('[data-action="success"]').click()
    const outcome = page.getByTestId('outcome')
    await expect(outcome).toContainText('full-selection-visible')
    const result = JSON.parse((await outcome.textContent())!)
    const textarea = page.locator('textarea')
    await expect(textarea).toBeFocused()
    expect(result.completion.selection.direction).toBe('backward')
    expect(result.after).toEqual(result.before)
    expect(
      await textarea.evaluate((element: HTMLTextAreaElement) => ({
        start: element.selectionStart,
        end: element.selectionEnd,
        direction: element.selectionDirection,
      })),
    ).toEqual(result.completion.selection)
    expect(
      await textarea.evaluate((element: HTMLTextAreaElement) =>
        element.value.slice(element.selectionStart, element.selectionEnd),
      ),
    ).toBe('Paragraph 60')
    expect(
      await textarea.evaluate(
        (element: HTMLTextAreaElement) => element.scrollTop,
      ),
    ).toBeGreaterThan(0)
    // Independent rendered Focus presentation has the same source layout.
    const active = page
      .locator('.el-markdown-editor__focus-layer span:not(.is-dimmed)')
      .filter({ hasText: 'Paragraph 60' })
    const target = await active.boundingBox()
    const input = await textarea.boundingBox()
    expect(target).not.toBeNull()
    expect(target!.y).toBeGreaterThanOrEqual(input!.y)
    expect(target!.y + target!.height).toBeLessThanOrEqual(
      input!.y + input!.height,
    )
    await page.screenshot({
      path: `/workspace/reveal-evidence/success-${theme}.png`,
    })
  })
}
for (const [action, reason] of [
  ['pre-abort', 'aborted'],
  ['abort', 'aborted'],
  ['admission', 'admission-rejected'],
  ['transaction', 'stale'],
  ['unmount', 'unavailable'],
  ['blur', 'focus-lost'],
  ['timeout', 'timeout'],
]) {
  test(`refuses ${action} without completion`, async ({ page }) => {
    await page.goto(fixture)
    await page.locator(`[data-action="${action}"]`).click()
    await expect(page.getByTestId('outcome')).toContainText(
      `markdown-editor-reveal-${reason}`,
    )
    await expect(page.getByTestId('outcome')).not.toContainText('"completion"')
    // Queued continuations must stay rejected after their normal settle interval.
    await page.waitForTimeout(500)
    await expect(page.getByTestId('outcome')).toContainText(
      `markdown-editor-reveal-${reason}`,
    )
  })
}
