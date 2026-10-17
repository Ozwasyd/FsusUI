import { expect, test } from '@playwright/test'

// Supplemental browser touch emulation, not WebKit or physical-device evidence.
for (const theme of ['light', 'dark']) {
  test.describe(`touch emulation ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.evaluate((theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        document.documentElement.style.setProperty(
          '--fsus-safe-area-inset-top',
          '47px',
        )
        document.documentElement.style.setProperty(
          '--fsus-safe-area-inset-bottom',
          '34px',
        )
      }, theme)
    })

    test('returns actual trigger focus after repeated taps', async ({
      page,
    }) => {
      const trigger = page.getByRole('button', {
        name: 'Open dialog',
        exact: true,
      })
      for (const destroy of [false, true]) {
        await page.getByLabel('Destroy content').setChecked(destroy)
        await trigger.tap()
        await page
          .getByRole('button', { name: 'Close dialog', exact: true })
          .tap()
        await expect(
          page.getByRole('dialog', { name: 'Focus restoration', exact: true }),
        ).toBeHidden()
        await expect(trigger).toBeFocused({ timeout: 3_000 })
      }
    })

    test('retains the original trigger after tap interrupts closure', async ({
      page,
    }) => {
      const trigger = page.getByRole('button', {
        name: 'Open dialog',
        exact: true,
      })
      await trigger.tap()
      await page.getByRole('button', { name: 'Interrupt close' }).tap()
      await expect(
        page.getByRole('dialog', { name: 'Focus restoration', exact: true }),
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused({ timeout: 3_000 })
    })

    test('restores nested tap focus in stack order', async ({ page }) => {
      const trigger = page.getByRole('button', {
        name: 'Open dialog',
        exact: true,
      })
      await trigger.tap()
      const nestedTrigger = page.getByRole('button', {
        name: 'Open nested dialog',
        exact: true,
      })
      await nestedTrigger.tap()
      await page
        .getByRole('button', { name: 'Close nested dialog', exact: true })
        .tap()
      await expect(nestedTrigger).toBeFocused({ timeout: 3_000 })
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused({ timeout: 3_000 })
    })
  })
}
