import { expect, test } from '@playwright/test'

// Real production browsers; suppressing mousedown focus reproduces unfocused
// activation, but Chromium results do not establish WebKit acceptance.
for (const opener of [
  'delay',
  'negative-tabindex',
  'conditional',
  'conditional-delay',
]) {
  for (const theme of ['light', 'dark']) {
    test(`${opener} returns to the actual unfocused trigger (${theme})`, async ({
      page,
    }, testInfo) => {
      await page.goto(`/?opener=${opener}`)
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
      const input = page.getByRole('textbox', { name: 'Previous focus' })
      const trigger = page.getByRole('button', {
        name: 'Open dialog',
        exact: true,
      })
      const dialog = page.getByRole('dialog', {
        name: 'Focus restoration',
        exact: true,
      })
      for (const close of ['footer', 'Escape', 'external']) {
        await input.focus()
        await trigger.click()
        await expect(dialog).toBeVisible()
        await expect(input).not.toBeFocused()
        if (close === 'footer')
          await page.screenshot({
            path: testInfo.outputPath('unfocused-opener-open.png'),
          })
        if (close === 'footer')
          await page
            .getByRole('button', { name: 'Close dialog', exact: true })
            .click()
        else if (close === 'Escape') await page.keyboard.press('Escape')
        else
          await page
            .getByRole('button', { name: 'External close' })
            .evaluate((el: HTMLButtonElement) => el.click())
        await expect(dialog).toBeHidden()
        await expect(trigger).toBeFocused({ timeout: 3_000 })
        if (close === 'footer')
          await page.screenshot({
            path: testInfo.outputPath('unfocused-opener-restored.png'),
          })
      }
    })
  }
}
