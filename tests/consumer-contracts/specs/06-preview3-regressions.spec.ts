import { expect, test } from '@playwright/test'
import { attachPageErrorCollector } from './helpers'

test.describe('FsusUI 2.0 preview.3 regressions (#1155, #1156, #1157)', () => {
  test('#1155: FsusMessageBox confirmation exposes accessible name and description', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)

    await page.goto('/preview3?theme=light')
    await expect(page.getByTestId('preview3-contract')).toBeVisible()

    await page.locator('#p3-confirm-launch').click()
    const alertDialog = page.getByRole('alertdialog', { name: 'Delete document' })
    await expect(alertDialog).toBeVisible()
    await expect(alertDialog).toHaveAccessibleDescription('Remove the document?')

    await alertDialog.getByRole('button', { name: 'Confirm' }).click()
    await expect(alertDialog).toHaveCount(0)
    await expect(page.getByTestId('p3-confirm-result')).toHaveText('confirmed')
    expect(errors).toEqual([])
  })

  test('#1156: single Escape closes only the active top FsusDialog and restores focus to parent Drawer opener', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)

    await page.goto('/preview3?theme=light')
    await expect(page.getByTestId('preview3-contract')).toBeVisible()

    // Case 1: Conditional v-if Drawer mounted open + guarded :close-on-escape="!comparisonOpen"
    await page.locator('#launch').click()
    await expect(page.getByRole('dialog', { name: 'Parent' })).toBeVisible()
    await page.locator('#compare').click()
    await expect(page.getByRole('dialog', { name: 'Child' })).toBeVisible()

    await page.locator('#p3-source').focus()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: 'Child' })).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'Parent' })).toBeVisible()
    await expect(page.locator('#compare')).toBeFocused()

    // Second Escape closes parent Drawer and restores focus to #launch
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Parent' })).toHaveCount(0)
    await expect(page.locator('#launch')).toBeFocused()

    // Case 2: Conditional v-if Drawer mounted open + always-true closeOnEscape
    await page.locator('#launch-unguarded').click()
    await expect(page.getByRole('dialog', { name: 'Unguarded Parent' })).toBeVisible()
    await page.locator('#compare-unguarded').click()
    await expect(page.getByRole('dialog', { name: 'Unguarded Child' })).toBeVisible()

    await page.locator('#p3-source-unguarded').focus()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: 'Unguarded Child' })).toHaveCount(0)
    await expect(page.getByRole('dialog', { name: 'Unguarded Parent' })).toBeVisible()
    await expect(page.locator('#compare-unguarded')).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Unguarded Parent' })).toHaveCount(0)

    // Case 3: Top FsusDialog with closeOnEscape=false blocks Escape without closing parent Drawer
    await page.locator('#launch-locked').click()
    await expect(page.getByRole('dialog', { name: 'Locked Parent' })).toBeVisible()
    await page.locator('#compare-locked').click()
    await expect(page.getByRole('dialog', { name: 'Locked Child' })).toBeVisible()

    await page.locator('#p3-source-locked').focus()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Locked Child' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Locked Parent' })).toBeVisible()

    expect(errors).toEqual([])
  })

  test('#1157: isolated heavy-feature frame renders Shiki code highlighting, KaTeX math, Mermaid diagram, and #sample reveal in Vite production build', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)

    await page.goto('/preview3?theme=light')
    const renderer = page.getByTestId('p3-heavy-markdown')
    await expect(renderer).toBeVisible()

    // Shiki code highlight renders pre#sample[data-code-highlighted="shiki"] with zero error fallback
    const sampleCode = renderer.locator('pre#sample[data-code-highlighted="shiki"]')
    await expect(sampleCode).toBeVisible({ timeout: 20_000 })
    await expect(sampleCode).toContainText('const answer = 42')

    // KaTeX MathML renders via isolated frame (data-markdown-feature-activated="latex")
    await expect(
      renderer.locator('[data-markdown-feature-activated="latex"] .katex').first(),
    ).toBeVisible({ timeout: 20_000 })

    // Mermaid SVG renders via isolated frame (data-markdown-feature-activated="mermaid")
    await expect(
      renderer.locator('[data-markdown-feature-activated="mermaid"] svg').first(),
    ).toBeVisible({ timeout: 20_000 })

    // Zero feature error placeholders anywhere
    await expect(renderer.locator('[data-markdown-feature-error]')).toHaveCount(0)

    // revealFragment('#sample') locates the highlighted <pre id="sample" data-code-highlighted="shiki">
    await page.locator('#p3-reveal-sample').click()
    await expect(page.getByTestId('p3-reveal-outcome')).toHaveText('true:PRE:sample:shiki')

    expect(errors).toEqual([])
  })
})
