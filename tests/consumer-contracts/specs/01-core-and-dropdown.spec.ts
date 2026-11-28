import { expect, test } from '@playwright/test'
import { attachPageErrorCollector } from './helpers'

test.describe('FsusUI 2.0 core & dropdown consumer contract', () => {
  test('dropdown interactions, disabled item blocking, Escape/outside dismissal, button-group alignment, check-tag, and segmented control', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    await page.goto('/core?theme=dark')
    await expect(page.locator('[data-contract-ready="true"]')).toBeVisible()

    // Dropdown open, disabled item blocked, command selection commits and closes menu
    const trigger = page.getByTestId('dropdown-trigger')
    await trigger.click()
    const menu = page.locator('[role="menu"]:visible')
    await expect(menu).toBeVisible()

    const archivedItem = page.getByTestId('cmd-archived')
    await expect(archivedItem).toBeDisabled()
    await archivedItem.click({ force: true })
    await expect(page.getByTestId('selected-command')).toHaveText('stable')

    await page.getByTestId('cmd-preview').click()
    await expect(page.getByTestId('selected-command')).toHaveText('preview')
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)

    // Keyboard roving navigation + Escape dismissal
    await trigger.click()
    await expect(menu).toBeVisible()
    await page.getByTestId('cmd-stable').focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('cmd-preview')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)

    // Outside click dismissal
    await trigger.click()
    await expect(menu).toBeVisible()
    await page.getByTestId('outside-button').click()
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)

    // ButtonGroup prop-icon (Prev) and inline-slot icon (Next) stay vertically aligned
    const alignment = await page
      .getByTestId('button-group')
      .evaluate((element) => {
        const buttons = Array.from(
          element.querySelectorAll<HTMLElement>('.fsus-button'),
        )
        const textMidY = (root: HTMLElement) => {
          const label = root.querySelector<HTMLElement>('.fsus-button__label')
          if (!label) return null
          const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT)
          let node = walker.nextNode()
          while (node) {
            if (node.textContent && node.textContent.trim().length > 0) {
              const range = document.createRange()
              range.selectNodeContents(node)
              const rect = range.getBoundingClientRect()
              return (rect.top + rect.bottom) / 2
            }
            node = walker.nextNode()
          }
          return null
        }
        const prevY = textMidY(buttons[0])
        const nextY = textMidY(buttons[1])
        return prevY !== null && nextY !== null ? Math.abs(prevY - nextY) : null
      })
    expect(alignment).not.toBeNull()
    expect(alignment!).toBeLessThanOrEqual(1)

    // CheckTag keyboard + click toggles checked state cleanly
    const checkTag = page.getByTestId('check-tag')
    await expect(checkTag).toHaveAttribute('role', 'checkbox')
    await expect(checkTag).toHaveAttribute('aria-checked', 'false')
    await checkTag.click()
    await expect(checkTag).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('check-tag-state')).toHaveText('true')

    // SegmentedControl radiogroup updates active value
    await page
      .getByTestId('segmented-control')
      .getByRole('radio', { name: 'Published' })
      .click()
    await expect(page.getByTestId('segment-state')).toHaveText('published')

    // Canonical --fsus-* tokens active with zero retired --el-* leakage
    const cssHealth = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return {
        fsusInk: style.getPropertyValue('--fsus-ink').trim(),
        fsusPaper: style.getPropertyValue('--fsus-paper').trim(),
        elPrimary: style.getPropertyValue('--el-color-primary').trim(),
      }
    })
    expect(cssHealth.fsusInk.length).toBeGreaterThan(0)
    expect(cssHealth.fsusPaper.length).toBeGreaterThan(0)
    expect(cssHealth.elPrimary).toBe('')
    expect(errors).toEqual([])
  })

  for (const config of [
    { name: 'mobile-light-ltr', width: 375, height: 667, theme: 'light', dir: 'ltr' },
    { name: 'mobile-dark-rtl', width: 375, height: 667, theme: 'dark', dir: 'rtl' },
  ]) {
    test(`responsive matrix (${config.name}): zero horizontal overflow`, async ({
      page,
    }) => {
      const { errors } = attachPageErrorCollector(page)
      await page.setViewportSize({ width: config.width, height: config.height })
      await page.goto(`/core?theme=${config.theme}&dir=${config.dir}`)
      await expect(page.locator('[data-contract-ready="true"]')).toBeVisible()

      await page.getByTestId('dropdown-trigger').click()
      const popper = page.locator('.fsus-dropdown__popper:visible')
      await expect(popper).toBeVisible()

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(overflow).toBe(false)
      expect(errors).toEqual([])
    })
  }
})
