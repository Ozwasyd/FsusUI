import { devices, expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'
import playwrightConfig from '../../playwright.config'

test.use({
  launchOptions: {
    ...playwrightConfig.use?.launchOptions,
    chromiumSandbox: true,
  },
})

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
        test(`keeps the Button ring when hover and focus-visible coexist in ${theme}`, async ({
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
          const actualViewport = await page.evaluate(() => ({
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight,
          }))
          if (mobile) {
            expect(page.viewportSize()).toEqual({ width: 412, height: 1200 })
            expect(actualViewport).toEqual({ width: 412, height: 1200 })
          }
          expect(
            await page.evaluate(() => ({
              coarsePointer: window.matchMedia('(pointer: coarse)').matches,
              noHover: window.matchMedia('(hover: none)').matches,
            })),
          ).toEqual({ coarsePointer: true, noHover: true })

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
          const focusState = () =>
            button.evaluate((element) => ({
              hovered: element.matches(':hover'),
              focusVisible: element.matches(':focus-visible'),
            }))

          const renderedState = () =>
            button.evaluate((element) => {
              const style = getComputedStyle(element)
              const { x, y, width, height } = element.getBoundingClientRect()
              return {
                hovered: element.matches(':hover'),
                focusVisible: element.matches(':focus-visible'),
                boxShadow: style.boxShadow,
                transform: style.transform,
                bounds: { x, y, width, height },
              }
            })

          await button.scrollIntoViewIfNeeded()
          const restingBounds = await button.boundingBox()
          expect(restingBounds).not.toBeNull()
          const expectNoTravel = async () => {
            await expect
              .poll(() =>
                button.evaluate((element) => getComputedStyle(element).transform),
              )
              .toBe('none')
            await expect.poll(() => button.boundingBox()).toEqual(restingBounds)
          }
          await expectNoTravel()

          await button.tap()
          await expect(button).toBeFocused()
          await expect
            .poll(focusState)
            .toEqual({ hovered: true, focusVisible: false })
          await expect
            .poll(() =>
              button.evaluate(
                (element) => window.getComputedStyle(element).boxShadow,
              ),
            )
            .toBe('none')
          await expectNoTravel()
          const tapState = await renderedState()

          await page.keyboard.press('Tab')
          await expect(nextButton).toBeFocused()
          await page.keyboard.press('Shift+Tab')
          await expect(button).toBeFocused()
          await expect
            .poll(focusState)
            .toEqual({ hovered: true, focusVisible: true })
          await expectNoTravel()
          await testInfo.attach(`theme-scale-button-coarse-state-${theme}`, {
            contentType: 'application/json',
            body: JSON.stringify(
              {
                theme,
                actualViewport,
                restingBounds,
                tap: tapState,
                keyboard: await renderedState(),
              },
              null,
              2,
            ),
          })
          await expectTwoPixelInsetRing(button)
          await expectNoTravel()
          await testInfo.attach(`theme-scale-button-coarse-settled-state-${theme}`, {
            contentType: 'application/json',
            body: JSON.stringify(
              {
                theme,
                actualViewport,
                restingBounds,
                keyboard: await renderedState(),
              },
              null,
              2,
            ),
          })
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
