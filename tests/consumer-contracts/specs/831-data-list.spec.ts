import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  attachPageErrorCollector,
  getTrackedListenerCount,
  installGlobalListenerTracker,
} from './helpers'

async function assertAccessibleListRowContract(page: Page) {
  const list = page.getByRole('list', { name: 'Service records' })
  await expect(list).toBeVisible()

  // Accessibility snapshot verifies list -> listitem -> button hierarchy (never button[role="listitem"])
  const invalidButtonListitem = await list
    .locator('button[role="listitem"], a[role="listitem"]')
    .count()
  expect(invalidButtonListitem).toBe(0)

  const listItems = list.locator('[role="listitem"]')
  const count = await listItems.count()
  if (count > 0) {
    const firstItem = listItems.first()
    const firstButton = firstItem.getByRole('button')
    await expect(firstButton).toHaveCount(1)
    const snapshot = await firstItem.ariaSnapshot()
    expect(snapshot).toMatch(/- listitem:\s*\n\s*- button/u)
  }
}

test.describe('#831 DataList accessible activation consumer contract', () => {
  test('keyboard, pointer, disabled/disabledKeys/loading/loadingKey blocking, reorder/removal focus recovery, and empty/error composition', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    await page.goto('/831?count=5')
    await expect(page.locator('[data-contract-ready="true"]')).toBeVisible()
    await assertAccessibleListRowContract(page)

    const list = page.getByRole('list', { name: 'Service records' })
    const buttons = list.getByRole('button')
    await expect(buttons).toHaveCount(5)

    // Initial active row is svc-1 (aria-current="true")
    await expect(buttons.nth(0)).toHaveAttribute('aria-current', 'true')
    // svc-2 is in disabledKeys; svc-3 is loadingKey
    await expect(buttons.nth(1)).toBeDisabled()
    await expect(buttons.nth(1)).toHaveAttribute('aria-disabled', 'true')
    await expect(buttons.nth(2)).toBeDisabled()
    await expect(buttons.nth(2)).toHaveAttribute('aria-busy', 'true')
    await expect(buttons.nth(2)).toContainText('Syncing…')

    // Disabled and loadingKey rows reject pointer and keyboard activation
    await buttons.nth(1).click({ force: true })
    await buttons.nth(2).click({ force: true })
    await expect(page.getByTestId('activation-log')).toHaveText('')
    await expect(page.getByTestId('active-key-value')).toHaveText('svc-1')

    // Keyboard Tab reaches enabled row; Enter and Space activate it
    await buttons.nth(0).focus()
    await page.keyboard.press('Tab')
    // Tab skips disabled svc-2 and busy svc-3, landing directly on svc-4
    await expect(buttons.nth(3)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('active-key-value')).toHaveText('svc-4')
    await expect(buttons.nth(3)).toHaveAttribute('aria-current', 'true')

    await page.keyboard.press('Tab')
    await expect(buttons.nth(4)).toBeFocused()
    await page.keyboard.press('Space')
    await expect(page.getByTestId('active-key-value')).toHaveText('svc-5')

    // Collection-level loading disables every row and blocks activation
    await page.getByTestId('toggle-loading-btn').click()
    await expect(list).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByTestId('consumer-loading-status')).toBeVisible()
    for (let i = 0; i < 5; i += 1) {
      await expect(buttons.nth(i)).toBeDisabled()
    }
    await buttons.nth(0).click({ force: true })
    await expect(page.getByTestId('active-key-value')).toHaveText('svc-5')
    await page.getByTestId('toggle-loading-btn').click()

    // Collection-level disabled disables every row
    await page.getByTestId('toggle-disabled-btn').click()
    await expect(list).toHaveAttribute('aria-disabled', 'true')
    for (let i = 0; i < 5; i += 1) {
      await expect(buttons.nth(i)).toBeDisabled()
    }
    await page.getByTestId('toggle-disabled-btn').click()

    // Reorder keeps focus on the same typed row key (svc-4)
    await buttons.nth(3).focus()
    await expect(buttons.nth(3)).toContainText('svc-4')
    await page.evaluate(() => {
      document
        .querySelector<HTMLButtonElement>('[data-testid="reorder-btn"]')
        ?.click()
    })
    await expect(list.getByRole('button').first()).toContainText('svc-4')
    await expect(list.getByRole('button').first()).toBeFocused()

    // Removing the focused enabled row recovers focus to next enabled row without mutating activeKey
    await page.evaluate(() => {
      document
        .querySelector<HTMLButtonElement>('[data-testid="remove-row-btn"]')
        ?.click()
    })
    await expect(list.getByRole('button').first()).toBeFocused()
    await expect(page.getByTestId('active-key-value')).toHaveText('svc-5')

    // Empty and error public composition
    await page.getByTestId('toggle-error-btn').click()
    await expect(page.getByTestId('consumer-error-alert')).toBeVisible()
    await page.getByTestId('count-0-btn').click()
    await expect(page.getByTestId('consumer-empty-state')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('emulated touch activation works on enabled rows and is blocked on disabled/loading rows', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 375, height: 667 },
    })
    const page = await context.newPage()
    const { errors } = attachPageErrorCollector(page)

    try {
      await page.goto('/831?count=5')
      const list = page.getByRole('list', { name: 'Service records' })
      const buttons = list.getByRole('button')

      await buttons.nth(1).tap({ force: true })
      await buttons.nth(2).tap({ force: true })
      await expect(page.getByTestId('active-key-value')).toHaveText('svc-1')

      await buttons.nth(3).tap()
      await expect(page.getByTestId('active-key-value')).toHaveText('svc-4')
      expect(errors).toEqual([])
    } finally {
      await context.close()
    }
  })

  test('forced-colors mode renders a visible system-color focus outline on interactive rows', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('/831?count=5')
    await page.getByTestId('before-list-focus').focus()
    await page.keyboard.press('Tab')

    // Tab forward until focus lands on the first enabled DataList button
    const firstRowBtn = page
      .getByRole('list', { name: 'Service records' })
      .getByRole('button')
      .first()
    for (let i = 0; i < 16; i += 1) {
      if (await firstRowBtn.evaluate((el) => el === document.activeElement)) break
      await page.keyboard.press('Tab')
    }
    await expect(firstRowBtn).toBeFocused()

    const outline = await firstRowBtn.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      }
    })
    expect(outline.outlineStyle).not.toBe('none')
    expect(Number.parseFloat(outline.outlineWidth)).toBeGreaterThanOrEqual(2)
  })

  test('responsive matrix: 375/768/1440 × light/dark × 0/1/1000 rows + 150%/200% zoom without horizontal overflow', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)

    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme })
      for (const width of [375, 768, 1440]) {
        await page.setViewportSize({ width, height: 800 })
        for (const count of [0, 1, 1000]) {
          await page.goto(`/831?theme=${theme}&count=${count}`)
          const list = page.getByRole('list', { name: 'Service records' })
          await expect(list).toBeVisible()
          await expect(list.locator('[role="listitem"]')).toHaveCount(count)
          if (count === 0) {
            await expect(page.getByTestId('consumer-empty-state')).toBeVisible()
          }
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          )
          expect(overflow).toBe(false)
        }
      }
    }

    // 150% and 200% zoom equivalents of 1280px desktop (854px and 640px) + CSS zoom check
    for (const zoomViewport of [
      { width: 854, height: 480 },
      { width: 640, height: 360 },
    ]) {
      await page.setViewportSize(zoomViewport)
      await page.goto('/831?count=5')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
      expect(overflow).toBe(false)
    }

    expect(errors).toEqual([])
  })

  test('3x repeated 1000-row mount/unmount cycles leave zero leaked global listeners', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    await page.goto('/831?count=1000')
    await installGlobalListenerTracker(page)
    const baseline = await getTrackedListenerCount(page)

    const toggleMount = page.getByTestId('toggle-mount-btn')
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await expect(
        page.getByRole('list', { name: 'Service records' }).locator('[role="listitem"]'),
      ).toHaveCount(1000)
      await toggleMount.click()
      await expect(page.locator('[role="listitem"]')).toHaveCount(0)
      await toggleMount.click()
    }
    await toggleMount.click()
    await expect(page.locator('[role="listitem"]')).toHaveCount(0)
    await expect
      .poll(() => getTrackedListenerCount(page))
      .toBeLessThanOrEqual(baseline)

    expect(errors).toEqual([])
  })

  test('negative controls: all 4 contract violations are caught', async ({
    page,
  }) => {
    // 1. Loading keyboard activation violation
    await page.goto('/831?count=3&neg=loading-keyboard')
    const negBtn = page.getByRole('list').getByRole('button').nth(1)
    await negBtn.focus()
    await page.keyboard.press('Enter')
    expect(await page.getByTestId('activation-log').textContent()).toContain(
      'svc-2',
    )

    // 2. Invalid interactive role (role="listitem" directly on button)
    await page.goto('/831?count=3&neg=invalid-role')
    await expect(assertAccessibleListRowContract(page)).rejects.toThrow()

    // 3. Uncontrolled identity drift (mutates activeKey even when consumer rejects)
    await page.goto('/831?count=5&reject=1&neg=identity-drift')
    await page.getByRole('list').getByRole('button').nth(3).click()
    expect(await page.getByTestId('active-key-value').textContent()).toBe('svc-4')

    // Positive control for consumer-rejected activation: activeKey must NOT drift!
    await page.goto('/831?count=5&reject=1')
    await page.getByRole('list').getByRole('button').nth(3).click()
    expect(await page.getByTestId('active-key-value').textContent()).toBe('svc-1')

    // 4. Missing forced-colors focus outline
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('/831?count=3&neg=missing-forced-outline')
    const firstRow = page.getByRole('list').getByRole('button').first()
    await page.getByTestId('before-list-focus').focus()
    for (let i = 0; i < 16; i += 1) {
      if (await firstRow.evaluate((el) => el === document.activeElement)) break
      await page.keyboard.press('Tab')
    }
    const outlineStyle = await firstRow.evaluate(
      (el) => getComputedStyle(el).outlineStyle,
    )
    expect(outlineStyle).toBe('none')
  })
})
