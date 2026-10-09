import { expect, test } from '@playwright/test'

for (const theme of ['light', 'dark']) {
  test.describe(`portrait-notch390x844 ${theme}`, () => {
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

    for (const destroy of [false, true]) {
      test(`returns to actual pointer trigger on repeated closes (destroy=${destroy})`, async ({
        page,
      }, testInfo) => {
        await page.getByLabel('Destroy content').setChecked(destroy)
        const trigger = page.getByRole('button', {
          name: 'Open dialog',
          exact: true,
        })
        for (const close of ['footer', 'Escape', 'external', 'header']) {
          await trigger.click()
          const dialog = page.getByRole('dialog', {
            name: 'Focus restoration',
            exact: true,
          })
          await expect(dialog).toBeVisible()
          if (close === 'footer' && !destroy) {
            await page.evaluate(async () => {
              await new Promise(requestAnimationFrame)
              await new Promise(requestAnimationFrame)
              await Promise.allSettled(
                document.getAnimations().map((animation) => animation.finished),
              )
            })
            await page.screenshot({
              path: testInfo.outputPath('dialog-open.png'),
            })
          }
          if (close === 'footer')
            await page
              .getByRole('button', { name: 'Close dialog', exact: true })
              .click()
          else if (close === 'Escape') await page.keyboard.press('Escape')
          else if (close === 'external')
            await page
              .getByRole('button', { name: 'External close' })
              .evaluate((el: HTMLButtonElement) => el.click())
          else
            await dialog
              .getByRole('button', { name: 'Close this dialog' })
              .click()
          await expect(dialog).toBeHidden()
          await expect(trigger).toBeFocused({ timeout: 3_000 })
        }
        if (!destroy)
          await page.screenshot({
            path: testInfo.outputPath('dialog-closed.png'),
          })
      })
    }

    test('keeps the original opener through an interrupted close', async ({
      page,
    }) => {
      const trigger = page.getByRole('button', {
        name: 'Open dialog',
        exact: true,
      })
      await trigger.click()
      await page.getByRole('button', { name: 'Interrupt close' }).click()
      await expect(
        page.getByRole('dialog', { name: 'Focus restoration', exact: true }),
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(
        page.getByRole('dialog', { name: 'Focus restoration', exact: true }),
      ).toBeHidden()
      await expect(trigger).toBeFocused({ timeout: 3_000 })
    })

    test('restores keyboard activation after Escape', async ({ page }) => {
      const trigger = page.getByRole('button', {
        name: 'Open dialog',
        exact: true,
      })
      await trigger.focus()
      await page.keyboard.press('Enter')
      await expect(
        page.getByRole('dialog', { name: 'Focus restoration', exact: true }),
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused({ timeout: 3_000 })
    })

    test('returns nested focus to its trigger before releasing the parent', async ({
      page,
    }) => {
      const trigger = page.getByRole('button', {
        name: 'Open dialog',
        exact: true,
      })
      await trigger.click()
      const nestedTrigger = page.getByRole('button', {
        name: 'Open nested dialog',
        exact: true,
      })
      await nestedTrigger.click()
      await page
        .getByRole('button', { name: 'Close nested dialog', exact: true })
        .click()
      await expect(
        page.getByRole('dialog', { name: 'Nested focus', exact: true }),
      ).toBeHidden()
      await expect(nestedTrigger).toBeFocused({ timeout: 3_000 })
      await expect(
        page.getByRole('dialog', { name: 'Focus restoration', exact: true }),
      ).toBeVisible()
      await nestedTrigger.click()
      await page.keyboard.press('Escape')
      await expect(
        page.getByRole('dialog', { name: 'Nested focus', exact: true }),
      ).toBeHidden()
      await expect(nestedTrigger).toBeFocused({ timeout: 3_000 })
      await expect(
        page.getByRole('dialog', { name: 'Focus restoration', exact: true }),
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused({ timeout: 3_000 })
    })
  })
}
