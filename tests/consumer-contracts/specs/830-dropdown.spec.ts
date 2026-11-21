import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  attachPageErrorCollector,
  getTrackedListenerCount,
  installGlobalListenerTracker,
} from './helpers'

const dropdownFixturePath = path.resolve(
  process.cwd(),
  'tests/consumer-contracts/fixture/src/views/DropdownContractView.vue',
)
const sharedStylePath = path.resolve(
  process.cwd(),
  'tests/consumer-contracts/fixture/src/style.css',
)

async function assertRadioSemantics(page: Page, expectedCheckedTestId: string) {
  const menu = page.locator('[role="menu"]:visible')
  await expect(menu).toBeVisible()

  const radios = menu.locator('[role="menuitemradio"]')
  const radioCount = await radios.count()
  expect(radioCount).toBe(4)

  const checkedRadios = menu.locator('[role="menuitemradio"][aria-checked="true"]')
  await expect(checkedRadios).toHaveCount(1)
  await expect(checkedRadios.first()).toHaveAttribute(
    'data-testid',
    expectedCheckedTestId,
  )

  const uncheckedRadios = menu.locator(
    '[role="menuitemradio"][aria-checked="false"]',
  )
  await expect(uncheckedRadios).toHaveCount(3)

  // Ordinary action items (role="menuitem") must NEVER carry aria-checked.
  const ordinaryItems = menu.locator('[role="menuitem"]')
  const ordinaryCount = await ordinaryItems.count()
  expect(ordinaryCount).toBeGreaterThanOrEqual(1)
  for (let i = 0; i < ordinaryCount; i += 1) {
    await expect(ordinaryItems.nth(i)).not.toHaveAttribute('aria-checked')
  }
}

test.describe('#830 Dropdown consumer contract', () => {
  test('radio semantics, keyboard navigation, disabled blocking, Escape return, outside dismissal, URL/command composition, and cleanup', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    await page.goto('/830')
    await expect(page.locator('[data-contract-ready="true"]')).toBeVisible()
    await installGlobalListenerTracker(page)
    const baselineListeners = await getTrackedListenerCount(page)

    const trigger = page.getByTestId('compact-trigger')
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    await expect(trigger).toHaveAttribute('role', 'button')

    // Keyboard open with ArrowDown enters menu on currently checked item
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    await assertRadioSemantics(page, 'channel-item-stable')
    await expect(page.getByTestId('channel-item-stable')).toBeFocused()

    // ArrowDown moves to preview, next ArrowDown skips disabled archived -> lands on canary
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('channel-item-preview')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('channel-item-canary')).toBeFocused()

    // ArrowUp goes back to preview, Home goes to first enabled, End goes to last enabled
    await page.keyboard.press('ArrowUp')
    await expect(page.getByTestId('channel-item-preview')).toBeFocused()
    await page.keyboard.press('Home')
    await expect(page.getByTestId('channel-item-stable')).toBeFocused()
    await page.keyboard.press('End')
    const urlItem = page.getByRole('menuitem', {
      name: /Open channel specification/u,
    })
    await expect(urlItem).toBeFocused()

    // Disabled item pointer click does not emit or mutate committed value
    await page.getByTestId('channel-item-archived').click({ force: true })
    await expect(page.getByTestId('committed-value')).toHaveText('stable')

    // Escape closes menu and returns focus directly to compact trigger
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)
    await expect(trigger).toBeFocused()

    // Space opens menu and Enter activates preview selection
    await page.keyboard.press('Space')
    await assertRadioSemantics(page, 'channel-item-stable')
    await expect(page.getByTestId('channel-item-stable')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByTestId('channel-item-preview')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('committed-value')).toHaveText('preview')
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)

    // Reopen and verify single aria-checked moved to preview; activate canary with Space
    await trigger.click()
    await assertRadioSemantics(page, 'channel-item-preview')
    await page.getByTestId('channel-item-canary').focus()
    await page.keyboard.press('Space')
    await expect(page.getByTestId('committed-value')).toHaveText('canary')
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)

    // Outside dismissal closes menu without hijacking focus back to trigger
    await trigger.click()
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(1)
    await expect(page.locator('.el-dropdown__popper')).not.toHaveClass(
      /enter-active/u,
    )
    const outsideBtn = page.getByTestId('outside-button')
    await outsideBtn.click()
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)
    await expect(outsideBtn).toBeFocused()

    // URL + command item composition via keyboard Enter
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(1)
    await expect(page.getByTestId('channel-item-canary')).toBeFocused()
    await page.keyboard.press('End')
    await expect(urlItem).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('navigated-urls')).toHaveText('/docs/channels')
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)

    // Repeated open/close cycles stay clean
    for (let i = 0; i < 3; i += 1) {
      await trigger.click()
      await expect(page.locator('[role="menu"]:visible')).toHaveCount(1)
      await page.keyboard.press('Escape')
      await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)
      await expect(trigger).toBeFocused()
    }

    // Unmount while open cleans up teleported popper & listeners
    await trigger.click()
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(1)
    await page.getByTestId('unmount-dropdown-btn').click()
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)
    await expect
      .poll(() => getTrackedListenerCount(page))
      .toBeLessThanOrEqual(baselineListeners)

    expect(errors).toEqual([])
  })

  test('async activation with hide-on-click=false preserves committed selection while pending/failed and allows reachable retry', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    await page.goto('/830?async=1')
    await expect(page.locator('[data-contract-ready="true"]')).toBeVisible()

    const trigger = page.getByTestId('compact-trigger')
    await trigger.click()
    await assertRadioSemantics(page, 'channel-item-stable')

    // Click preview -> starts pending; menu MUST stay open and committed selection stays on stable
    await page.getByTestId('channel-item-preview').click()
    await expect(page.getByTestId('pending-value')).toHaveText('preview')
    await expect(page.getByTestId('pending-indicator')).toBeVisible()
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(1)
    await assertRadioSemantics(page, 'channel-item-stable')

    // Fail pending -> menu stays open, committed selection stays on stable, alert + retry item reachable
    await page.evaluate(() => {
      window.__dropdownContractControls?.resolvePending(false)
    })
    await expect(page.getByTestId('error-alert')).toContainText(
      'Activation failed for preview',
    )
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(1)
    await assertRadioSemantics(page, 'channel-item-stable')

    // Activate reachable retry item -> pending again -> resolve OK -> commits & closes
    const retryItem = page.getByRole('menuitem', { name: /Retry activation/u })
    await expect(retryItem).toHaveAttribute('role', 'menuitem')
    await expect(retryItem).not.toHaveAttribute('aria-checked')
    await retryItem.click()
    await expect(page.getByTestId('pending-value')).toHaveText('preview')
    await assertRadioSemantics(page, 'channel-item-stable')

    await page.evaluate(() => {
      window.__dropdownContractControls?.resolvePending(true)
    })
    await expect(page.getByTestId('committed-value')).toHaveText('preview')
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)

    expect(errors).toEqual([])
  })

  for (const config of [
    { name: 'narrow-light-ltr-reduced', width: 375, height: 667, theme: 'light', dir: 'ltr', reducedMotion: 'reduce' as const, forcedColors: 'none' as const },
    { name: 'narrow-dark-rtl-reduced', width: 375, height: 667, theme: 'dark', dir: 'rtl', reducedMotion: 'reduce' as const, forcedColors: 'none' as const },
    { name: 'wide-light-ltr', width: 1280, height: 720, theme: 'light', dir: 'ltr', reducedMotion: 'no-preference' as const, forcedColors: 'none' as const },
    { name: 'wide-dark-forced-colors', width: 1280, height: 720, theme: 'dark', dir: 'ltr', reducedMotion: 'reduce' as const, forcedColors: 'active' as const },
  ]) {
    test(`matrix (${config.name}): viewport-bounded multiline layout stays inside viewport`, async ({
      page,
    }) => {
      const { errors } = attachPageErrorCollector(page)
      await page.setViewportSize({ width: config.width, height: config.height })
      await page.emulateMedia({
        colorScheme: config.theme as 'light' | 'dark',
        reducedMotion: config.reducedMotion,
        forcedColors: config.forcedColors,
      })

      await page.goto(`/830?theme=${config.theme}&dir=${config.dir}`)
      await expect(page.locator('[data-contract-ready="true"]')).toBeVisible()

      const trigger = page.getByTestId('compact-trigger')
      await trigger.focus()
      await page.keyboard.press('ArrowDown')
      await assertRadioSemantics(page, 'channel-item-stable')

      const popper = page.locator('.el-dropdown__popper:visible')
      await expect(popper).toBeVisible()
      const rect = await popper.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return {
          left: r.left,
          right: r.right,
          width: r.width,
          height: r.height,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          docOverflow: document.documentElement.scrollWidth > window.innerWidth,
        }
      })
      expect(rect.left).toBeGreaterThanOrEqual(-1)
      expect(rect.right).toBeLessThanOrEqual(rect.innerWidth + 1)
      expect(rect.height).toBeLessThanOrEqual(rect.innerHeight)
      expect(rect.docOverflow).toBe(false)

      // Multiline item wraps naturally above single-line height
      const previewItem = page.getByTestId('channel-item-preview')
      const previewBox = await previewItem.boundingBox()
      expect(previewBox?.height ?? 0).toBeGreaterThan(34)

      if (config.forcedColors === 'active') {
        const bgColor = await popper.evaluate(
          (el) => getComputedStyle(el).backgroundColor,
        )
        expect(bgColor).not.toBe('rgba(0, 0, 0, 0)')
      }

      expect(errors).toEqual([])
    })
  }

  test('negative controls: all 5 contract violations are caught by assertions', async ({
    page,
  }) => {
    // 1. menuitem with aria-checked must fail radio-role contract
    await page.goto('/830?neg=menuitem-checked')
    await expect(page.locator('[role="menu"]:visible')).toBeVisible()
    const invalidMenuitemChecked = await page
      .locator('[role="menu"]:visible [role="menuitem"][aria-checked]')
      .count()
    expect(invalidMenuitemChecked).toBeGreaterThan(0)
    await expect(assertRadioSemantics(page, 'channel-item-stable')).rejects.toThrow()

    // 2. Half-committed selection during pending must fail pending-preservation contract
    await page.goto('/830?async=1&neg=half-commit')
    await page.getByTestId('compact-trigger').click()
    await page.getByTestId('channel-item-preview').click()
    await expect(page.getByTestId('pending-value')).toHaveText('preview')
    await expect(assertRadioSemantics(page, 'channel-item-stable')).rejects.toThrow()

    // 3. Immediate close on pending must fail open-while-pending contract
    await page.goto('/830?async=1&neg=close-on-pending')
    await page.getByTestId('compact-trigger').click()
    await page.getByTestId('channel-item-preview').click()
    await expect(page.getByTestId('pending-value')).toHaveText('preview')
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(0)

    // 4. Broken Escape focus return must fail focus-return assertion
    await page.goto('/830?neg=broken-escape-focus')
    const trigger = page.getByTestId('compact-trigger')
    await trigger.focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('[role="menu"]:visible')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('distractor-button')).toBeFocused()
    await expect(trigger).not.toBeFocused()

    // 5. Private-selector workaround detection catches injected `.el-*` consumer CSS while clean fixture passes
    const cleanStyle = readFileSync(sharedStylePath, 'utf8')
    const cleanView = readFileSync(dropdownFixturePath, 'utf8')
    const privateSelectorRe = /\.el-[a-z0-9_-]+\s*\{/iu
    expect(privateSelectorRe.test(cleanStyle)).toBe(false)
    // Only the explicit negative-control block inside the view contains the synthetic probe text
    expect(cleanView).toContain('neg === \'private-selector\'')
    await page.goto('/830?neg=private-selector')
    const injectedText = await page
      .getByTestId('private-selector-fixture')
      .textContent()
    expect(privateSelectorRe.test(injectedText || '')).toBe(true)
  })
})
