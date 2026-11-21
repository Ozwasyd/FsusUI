import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  attachPageErrorCollector,
  getTrackedListenerCount,
  installGlobalListenerTracker,
  waitForViewerImageLoaded,
} from './helpers'

async function assertCleanupState(
  page: Page,
  expectedScrollY: number,
  expectedFocusTestId?: string,
) {
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.body.classList.contains('el-popup-parent--hidden'),
      ),
    )
    .toBe(false)
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          document
            .querySelector('[data-testid="bg-action-btn"]')
            ?.closest('[inert]'),
        ),
      ),
    )
    .toBe(false)
  expect(
    await page.getByTestId('app-pre-inert').getAttribute('inert'),
  ).toBe('app-owned')
  const currentScrollY = await page.evaluate(() => Math.round(window.scrollY))
  expect(Math.abs(currentScrollY - expectedScrollY)).toBeLessThanOrEqual(2)
  if (expectedFocusTestId) {
    await expect(page.getByTestId(expectedFocusTestId)).toBeFocused()
  }
}

test.describe('#832 ImageViewer modal lifecycle consumer contract', () => {
  test('dialog semantics, Tab/Shift+Tab focus trap, background inert exclusion, scroll lock, and all 5 dismissal paths', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/832')
    await expect(page.locator('[data-contract-ready="true"]')).toBeVisible()
    await installGlobalListenerTracker(page)

    // Scroll down to non-zero scrollY before opening
    await page.evaluate(() => window.scrollTo(0, 420))
    const initialScrollY = await page.evaluate(() => Math.round(window.scrollY))
    expect(initialScrollY).toBeGreaterThanOrEqual(350)

    const openBtn = page.getByTestId('open-viewer-btn')
    await openBtn.focus()
    await openBtn.click()

    const dialog = page.getByRole('dialog', { name: 'Modal lifecycle viewer' })
    await waitForViewerImageLoaded(dialog)
    await expect(dialog).toHaveAttribute('aria-modal', 'true')

    // Focus must enter dialog
    await expect
      .poll(() =>
        dialog.evaluate((el) => el.contains(document.activeElement)),
      )
      .toBe(true)

    // Tab forward loop never escapes dialog
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Tab')
      const inside = await dialog.evaluate((el) =>
        el.contains(document.activeElement),
      )
      expect(inside).toBe(true)
    }

    // Shift+Tab reverse loop never escapes dialog
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Shift+Tab')
      const inside = await dialog.evaluate((el) =>
        el.contains(document.activeElement),
      )
      expect(inside).toBe(true)
    }

    // Background is inert: programmatic .focus() and pointer click are excluded
    const bgFocused = await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>(
        '[data-testid="bg-action-btn"]',
      )!
      const isInert = Boolean(btn.closest('[inert]'))
      btn.focus()
      return { isInert, focused: document.activeElement === btn }
    })
    expect(bgFocused.isInert).toBe(true)
    expect(bgFocused.focused).toBe(false)

    // Background scroll exclusion: wheel and PageDown leave scrollY unchanged
    await page.mouse.move(10, 10)
    await page.mouse.wheel(0, 600)
    await page.keyboard.press('PageDown')
    await page.waitForTimeout(80)
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(
      initialScrollY,
    )

    // Dismissal path 1: Close button
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await assertCleanupState(page, initialScrollY, 'open-viewer-btn')

    // Dismissal path 2: Escape key
    await openBtn.click()
    await waitForViewerImageLoaded(dialog)
    await page.keyboard.press('Escape')
    await assertCleanupState(page, initialScrollY, 'open-viewer-btn')

    // Dismissal path 3: Mask click (hide-on-click-modal=true)
    await openBtn.click()
    await waitForViewerImageLoaded(dialog)
    await page.mouse.click(12, 12)
    await assertCleanupState(page, initialScrollY, 'open-viewer-btn')

    // Dismissal path 4: External visible=false
    await openBtn.click()
    await waitForViewerImageLoaded(dialog)
    await page.evaluate(() => window.__viewerModalControls?.hideExternally())
    await assertCleanupState(page, initialScrollY, 'open-viewer-btn')

    // Dismissal path 5: Route unmount while open
    await openBtn.click()
    await waitForViewerImageLoaded(dialog)
    await page.evaluate(() => window.__viewerModalControls?.unmountRoute())
    await assertCleanupState(page, initialScrollY, 'open-viewer-btn')

    // Remount route and verify repeated open/close + listener cleanup
    await page.evaluate(() => window.__viewerModalControls?.remountRoute())
    const baseline = await getTrackedListenerCount(page)
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await openBtn.click()
      await waitForViewerImageLoaded(dialog)
      await page.keyboard.press('Escape')
      await assertCleanupState(page, initialScrollY, 'open-viewer-btn')
    }
    await expect
      .poll(() => getTrackedListenerCount(page))
      .toBeLessThanOrEqual(baseline)

    expect(errors).toEqual([])
  })

  test('emulated touch scroll does not scroll background page while viewer is open', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 390, height: 844 },
    })
    const page = await context.newPage()
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/832')
      await page.evaluate(() => window.scrollTo(0, 380))
      const beforeScroll = await page.evaluate(() => Math.round(window.scrollY))
      await page.getByTestId('open-viewer-btn').tap()
      const dialog = page.getByRole('dialog', { name: 'Modal lifecycle viewer' })
      await waitForViewerImageLoaded(dialog)

      await page.touchscreen.tap(20, 200)
      await page.mouse.wheel(0, 500)
      expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(
        beforeScroll,
      )
    } finally {
      await context.close()
    }
  })

  test('nested modal ownership suspends viewer inert while appended dialog is open and restores on close', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/832')

    const openBtn = page.getByTestId('open-viewer-btn')
    await openBtn.click()
    const viewer = page.getByRole('dialog', { name: 'Modal lifecycle viewer' })
    await waitForViewerImageLoaded(viewer)

    await page.getByTestId('open-nested-dialog-btn').click()
    const nestedAction = page.getByTestId('nested-dialog-action-btn')
    await expect(nestedAction).toBeVisible()
    expect(
      await nestedAction.evaluate((el) => Boolean(el.closest('[inert]'))),
    ).toBe(false)
    await nestedAction.focus()
    await expect(nestedAction).toBeFocused()
    await nestedAction.click()

    await expect(nestedAction).toBeHidden()
    await expect(page.getByTestId('open-nested-dialog-btn')).toBeFocused()
    expect(
      await page
        .getByTestId('bg-action-btn')
        .evaluate((el) => Boolean(el.closest('[inert]'))),
    ).toBe(true)

    await page.keyboard.press('Escape')
    await assertCleanupState(page, 0, 'open-viewer-btn')
    expect(errors).toEqual([])
  })

  test('negative failure controls detect unprotected background, unrestored focus, and unrestored scroll', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // 1. Unprotected background allows programmatic focus escape
    await page.goto('/832?neg=unprotected-background')
    await page.getByTestId('open-viewer-btn').click()
    await waitForViewerImageLoaded(
      page.getByRole('dialog', { name: 'Modal lifecycle viewer' }),
    )
    await page.waitForTimeout(60)
    const escaped = await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>(
        '[data-testid="bg-action-btn"]',
      )!
      btn.focus()
      return document.activeElement === btn
    })
    expect(escaped).toBe(true)

    // 2. Unrestored focus loses trigger focus on close
    await page.goto('/832?neg=unrestored-focus')
    await page.getByTestId('open-viewer-btn').click()
    await waitForViewerImageLoaded(
      page.getByRole('dialog', { name: 'Modal lifecycle viewer' }),
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(40)
    await expect(page.getByTestId('open-viewer-btn')).not.toBeFocused()

    // 3. Unrestored scroll fails scroll-preservation check
    await page.goto('/832?neg=unrestored-scroll')
    await page.evaluate(() => window.scrollTo(0, 420))
    const savedY = await page.evaluate(() => Math.round(window.scrollY))
    await page.getByTestId('open-viewer-btn').click()
    await waitForViewerImageLoaded(
      page.getByRole('dialog', { name: 'Modal lifecycle viewer' }),
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(40)
    const afterY = await page.evaluate(() => Math.round(window.scrollY))
    expect(Math.abs(afterY - savedY)).toBeGreaterThan(100)
  })
})
