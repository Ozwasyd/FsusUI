import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'

test.setTimeout(120_000)

const openFixture = async (page: Page, visual: string, theme: string) => {
  await page.goto(buildVisualUrl(visual, 'desktop-light'), {
    waitUntil: 'domcontentloaded',
  })
  await page.locator('[data-testid^="section-"]').waitFor()
  await page.evaluate((resolvedTheme) => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.classList.toggle('light', resolvedTheme === 'light')
    root.dataset.themeMode = resolvedTheme
    root.dataset.themeResolved = resolvedTheme
    root.style.colorScheme = resolvedTheme
  }, theme)
}

const expectTwoPixelInsetRing = async (locator: Locator) => {
  await expect
    .poll(() =>
      locator.evaluate((element) => window.getComputedStyle(element).boxShadow),
    )
    .toMatch(/0px 0px 0px 2px inset/)
}

const focusWithKeyboardModality = async (page: Page, locator: Locator) => {
  await page.keyboard.press('Tab')
  await locator.evaluate((element) => (element as HTMLElement).focus())
  await expect(locator).toBeFocused()
  await expect
    .poll(() =>
      locator.evaluate((element) => element.matches(':focus-visible')),
    )
    .toBe(true)
}

const attachScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
) => {
  await testInfo.attach(name, {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
}

for (const theme of ['light', 'dark'] as const) {
  test(`form focus rings follow the public scale in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, 'form', theme)

    const input = page.locator('.el-input').first()
    await input
      .locator('.el-input__inner')
      .evaluate((element) => (element as HTMLElement).focus())
    await expect(input.locator('.el-input__inner')).toBeFocused()
    await expectTwoPixelInsetRing(input.locator('.el-input__wrapper'))

    const textarea = page.locator('.el-textarea__inner').first()
    await textarea.evaluate((element) => (element as HTMLElement).focus())
    await expect(textarea).toBeFocused()
    await expectTwoPixelInsetRing(textarea)

    const select = page
      .locator('.demo-block')
      .filter({
        has: page.getByRole('heading', {
          name: 'Select & Option & OptionGroup',
        }),
      })
      .locator('.el-input__wrapper')
    await select.click()
    await expectTwoPixelInsetRing(select)
    await page.keyboard.press('Escape')

    const checkbox = page.locator('.el-checkbox').first()
    await focusWithKeyboardModality(
      page,
      checkbox.locator('.el-checkbox__original'),
    )
    await expectTwoPixelInsetRing(checkbox.locator('.el-checkbox__inner'))

    const radio = page.locator('.el-radio').first()
    await focusWithKeyboardModality(page, radio.locator('.el-radio__original'))
    await expectTwoPixelInsetRing(radio.locator('.el-radio__inner'))
    await attachScreenshot(page, testInfo, `theme-scale-form-${theme}`)
  })

  test(`tab focus ring follows the public scale in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, 'navigation', theme)

    const tab = page.locator('.el-tabs__item').first()
    await focusWithKeyboardModality(page, tab)
    await expectTwoPixelInsetRing(tab)
    await attachScreenshot(page, testInfo, `theme-scale-tabs-${theme}`)
  })

  test(`overlay focus rings and reduced motion follow the public scale in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, 'feedback', theme)

    await page.getByTestId('open-publish-dialog').click()
    const dialogClose = page.locator('.el-dialog__headerbtn').last()
    await focusWithKeyboardModality(page, dialogClose)
    await expectTwoPixelInsetRing(dialogClose)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: '查看审阅记录' }).click()
    const drawerClose = page.locator('.el-drawer__close-btn').last()
    await focusWithKeyboardModality(page, drawerClose)
    await expectTwoPixelInsetRing(drawerClose)
    await attachScreenshot(page, testInfo, `theme-scale-overlays-${theme}`)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect
      .poll(() =>
        drawerClose.evaluate((element) => {
          const durations = window
            .getComputedStyle(element)
            .transitionDuration.split(',')
            .map((duration) => Number.parseFloat(duration) * 1000)

          return Math.max(...durations)
        }),
      )
      .toBeLessThanOrEqual(1)
    await attachScreenshot(
      page,
      testInfo,
      `theme-scale-reduced-motion-${theme}`,
    )
  })
}
