import { devices, expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'

test.setTimeout(120_000)

const openFixture = async (
  page: Page,
  visual: string,
  theme: string,
  projectName: 'desktop-light' | 'mobile-light' = 'desktop-light',
) => {
  await page.goto(buildVisualUrl(visual, projectName), {
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

const expectFocusRing = async (locator: Locator) => {
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const style = window.getComputedStyle(element)
        return {
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
          borderColor: style.borderColor,
        }
      }),
    )
    .toMatchObject({ outlineStyle: 'solid', outlineWidth: '2px' })
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

    const input = page.locator('.fsus-input').first()
    const nativeInput = input.locator('.fsus-input__native').first()
    await nativeInput.focus()
    await expect(nativeInput).toBeFocused()
    await expect(input).toHaveAttribute('data-focused', '')

    const checkbox = page.locator('.fsus-checkbox input[type="checkbox"]').first()
    await focusWithKeyboardModality(page, checkbox)
    await expect(checkbox).toBeFocused()

    const radio = page.locator('.fsus-radio input[type="radio"]').first()
    await focusWithKeyboardModality(page, radio)
    await expect(radio).toBeFocused()

    await attachScreenshot(page, testInfo, `theme-scale-form-${theme}`)
  })

  test(`tab focus ring follows the public scale in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, 'navigation', theme)

    const tab = page.locator('.fsus-tabs__tab').first()
    await focusWithKeyboardModality(page, tab)
    await expectFocusRing(tab)
    await attachScreenshot(page, testInfo, `theme-scale-tabs-${theme}`)
  })

  test(`overlay focus rings and reduced motion follow the public scale in ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await openFixture(page, 'feedback', theme)

    await page.getByTestId('open-publish-dialog').click()
    const dialogClose = page.locator('.fsus-dialog__close').last()
    await focusWithKeyboardModality(page, dialogClose)
    await expectFocusRing(dialogClose)
    await page.keyboard.press('Escape')

    await page.getByTestId('open-review-drawer').click()
    const drawerClose = page.locator('.fsus-drawer__close').last()
    await focusWithKeyboardModality(page, drawerClose)
    await expectFocusRing(drawerClose)
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
  })
}

const mobileDevice = devices['Pixel 7']

for (const mobile of [false, true]) {
  test.describe(
    mobile
      ? 'narrow mobile coarse pointer Button keyboard focus'
      : 'coarse pointer Button keyboard focus',
    () => {
      test.use({
        ...(mobile
          ? {
              userAgent: mobileDevice.userAgent,
              deviceScaleFactor: mobileDevice.deviceScaleFactor,
              isMobile: mobileDevice.isMobile,
              screen: mobileDevice.screen,
              viewport: { width: 412, height: 1200 },
            }
          : {}),
        hasTouch: true,
      })

      for (const theme of ['light', 'dark'] as const) {
        test(`keeps the Button focus ring under coarse pointer in ${theme}`, async ({
          page,
        }, testInfo) => {
          await openFixture(
            page,
            'basic',
            theme,
            mobile ? 'mobile-light' : 'desktop-light',
          )
          await page.evaluate(async () => {
            await document.fonts.ready
          })

          const buttons = page
            .getByTestId('section-basic')
            .locator('.demo-block')
            .filter({
              has: page.getByRole('heading', {
                name: 'Button & ButtonGroup',
                exact: true,
              }),
            })
          const button = buttons.getByRole('button', {
            name: 'Default',
            exact: true,
          })
          const nextButton = buttons.getByRole('button', {
            name: 'Primary',
            exact: true,
          })

          await button.scrollIntoViewIfNeeded()
          const restingBounds = await button.boundingBox()
          expect(restingBounds).not.toBeNull()

          await button.tap()
          await expect(button).toBeFocused()
          await page.keyboard.press('Tab')
          await expect(nextButton).toBeFocused()
          await page.keyboard.press('Shift+Tab')
          await expect(button).toBeFocused()
          await expectFocusRing(button)
          expect(await button.boundingBox()).toEqual(restingBounds)

          await attachScreenshot(
            page,
            testInfo,
            `theme-scale-button-coarse-focus-${theme}`,
          )
        })
      }
    },
  )
}
