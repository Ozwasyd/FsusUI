import { expect, test } from '@playwright/test'
import * as path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import {
  applySafeAreaProfile,
  getSafeAreaProfile,
} from '../support/safe-area-profile'

const drawerFixtureUrl =
  process.env.FSUS_DRAWER_FIXTURE_URL ??
  `/@fs/${path.resolve(process.cwd(), 'tests/fixtures/drawer-safe-area/index.html')}`

type Direction = 'rtl' | 'ltr' | 'ttb' | 'btt'
type Theme = 'light' | 'dark'

const EXPECTED_BORDERS: Record<
  Direction,
  { top: string; right: string; bottom: string; left: string }
> = {
  rtl: { top: '0px', right: '0px', bottom: '0px', left: '1px' },
  ltr: { top: '0px', right: '1px', bottom: '0px', left: '0px' },
  ttb: { top: '0px', right: '0px', bottom: '1px', left: '0px' },
  btt: { top: '1px', right: '0px', bottom: '0px', left: '0px' },
}

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

const resolvePrimaryColor = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--el-color-primary)'
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })

const measureDrawer = async (panel: Locator) =>
  panel.evaluate((drawer) => {
    const header = drawer.querySelector<HTMLElement>('.el-drawer__header')!
    const title = drawer.querySelector<HTMLElement>('.el-drawer__title')!
    const closeBtn = drawer.querySelector<HTMLButtonElement>(
      '.el-drawer__close-btn',
    )!
    const closeIcon = closeBtn.querySelector<HTMLElement>('i')!
    const body = drawer.querySelector<HTMLElement>('.el-drawer__body')!
    const firstBodyItem = body.querySelector<HTMLElement>('a, button, span')

    const drawerStyle = getComputedStyle(drawer)
    const headerStyle = getComputedStyle(header)
    const closeBtnStyle = getComputedStyle(closeBtn)
    const closeIconStyle = getComputedStyle(closeIcon)

    const headerRect = header.getBoundingClientRect()
    const titleRect = title.getBoundingClientRect()
    const closeRect = closeBtn.getBoundingClientRect()
    const bodyRect = body.getBoundingClientRect()
    const firstBodyRect = firstBodyItem?.getBoundingClientRect() ?? null

    const closeHit = document.elementFromPoint(
      closeRect.left + closeRect.width / 2,
      closeRect.top + closeRect.height / 2,
    )
    const bodyItemHit = firstBodyRect
      ? document.elementFromPoint(
          firstBodyRect.left + Math.min(24, firstBodyRect.width / 2),
          firstBodyRect.top + firstBodyRect.height / 2,
        )
      : null

    return {
      borderRadius: drawerStyle.borderRadius,
      borders: {
        top: drawerStyle.borderTopWidth,
        right: drawerStyle.borderRightWidth,
        bottom: drawerStyle.borderBottomWidth,
        left: drawerStyle.borderLeftWidth,
      },
      headerPaddingTop: Number.parseFloat(headerStyle.paddingTop),
      headerRect: {
        top: headerRect.top,
        bottom: headerRect.bottom,
        height: headerRect.height,
      },
      titleRect: {
        top: titleRect.top,
        bottom: titleRect.bottom,
        right: titleRect.right,
        height: titleRect.height,
        centerY: titleRect.top + titleRect.height / 2,
      },
      closeRect: {
        top: closeRect.top,
        bottom: closeRect.bottom,
        left: closeRect.left,
        right: closeRect.right,
        width: closeRect.width,
        height: closeRect.height,
        centerY: closeRect.top + closeRect.height / 2,
      },
      bodyRect: {
        top: bodyRect.top,
      },
      firstBodyRect: firstBodyRect
        ? {
            top: firstBodyRect.top,
            bottom: firstBodyRect.bottom,
            height: firstBodyRect.height,
          }
        : null,
      closeHitOk: closeHit !== null && closeBtn.contains(closeHit),
      bodyItemHitOk:
        firstBodyItem !== null &&
        bodyItemHit !== null &&
        firstBodyItem.contains(bodyItemHit),
      closeFocused: closeBtn.matches(':focus'),
      closeFocusVisible: closeBtn.matches(':focus-visible'),
      closeIconColor: closeIconStyle.color,
      closeBoxShadow: closeBtnStyle.boxShadow,
      closeBorderRadius: Number.parseFloat(closeBtnStyle.borderRadius),
    }
  })

const tabKey = (browserName: string) =>
  process.platform === 'darwin' && browserName === 'webkit' ? 'Alt+Tab' : 'Tab'

const VIEWPORT_MATRIX: Array<{
  label: string
  viewport: { width: number; height: number }
  theme: Theme
  reducedMotion: 'no-preference' | 'reduce'
}> = [
  {
    label: 'desktop-light',
    viewport: { width: 1280, height: 800 },
    theme: 'light',
    reducedMotion: 'no-preference',
  },
  {
    label: 'desktop-dark-reduced-motion',
    viewport: { width: 1280, height: 800 },
    theme: 'dark',
    reducedMotion: 'reduce',
  },
  {
    label: 'mobile-light',
    viewport: { width: 375, height: 812 },
    theme: 'light',
    reducedMotion: 'no-preference',
  },
  {
    label: 'mobile-dark-reduced-motion',
    viewport: { width: 375, height: 812 },
    theme: 'dark',
    reducedMotion: 'reduce',
  },
]

test.describe('issue #1096 ElDrawer header alignment, focus-visible tint, and edge geometry', () => {
  for (const scenario of VIEWPORT_MATRIX) {
    test(`${scenario.label}: all 4 directions align close button, scope focus tint, and flush edges`, async ({
      page,
      browserName,
    }) => {
      await page.setViewportSize(scenario.viewport)
      await page.emulateMedia({
        colorScheme: scenario.theme,
        reducedMotion: scenario.reducedMotion,
      })

      for (const direction of ['rtl', 'ltr', 'ttb', 'btt'] as const) {
        const size =
          direction === 'ltr' || direction === 'rtl'
            ? scenario.viewport.width <= 480
              ? 'min(86vw, 22rem)'
              : '360px'
            : '50%'
        const params = new URLSearchParams({
          direction,
          size,
          theme: scenario.theme,
        })
        await page.goto(`${drawerFixtureUrl}?${params}`, {
          waitUntil: 'domcontentloaded',
        })
        // Park pointer away from the close button before pointer-opening.
        await page.mouse.move(4, 4)
        await page.locator('#open').click()
        await expect(page.locator('#events')).toHaveText('open,opened')
        await page.mouse.move(4, 4)
        await settle(page)

        const panel = page.locator(`.el-drawer.${direction}`).last()
        await expect(panel).toBeVisible()
        const primaryColor = await resolvePrimaryColor(page)

        const initial = await measureDrawer(panel)
        const ctx = `${scenario.label}/${direction}`

        // 1. Close button stays strictly inside .el-drawer__header, never overhangs body/link.
        expect(initial.closeRect.width, `${ctx} close width`).toBeGreaterThanOrEqual(53)
        expect(initial.closeRect.width, `${ctx} close width max`).toBeLessThanOrEqual(55)
        expect(initial.closeRect.height, `${ctx} close height`).toBeGreaterThanOrEqual(53)
        expect(initial.closeRect.height, `${ctx} close height max`).toBeLessThanOrEqual(55)
        expect(
          initial.closeRect.top,
          `${ctx} close inside header top`,
        ).toBeGreaterThanOrEqual(initial.headerRect.top - 1)
        expect(
          initial.closeRect.bottom,
          `${ctx} close must not overhang header bottom`,
        ).toBeLessThanOrEqual(initial.headerRect.bottom + 1)
        expect(
          initial.closeRect.bottom,
          `${ctx} close must not overhang into body`,
        ).toBeLessThanOrEqual(initial.bodyRect.top + 1)
        expect(initial.firstBodyRect, `${ctx} first body link exists`).not.toBeNull()
        expect(
          initial.closeRect.bottom,
          `${ctx} close must not overlap first body item hit box`,
        ).toBeLessThanOrEqual(initial.firstBodyRect!.top + 1)
        expect(initial.closeHitOk, `${ctx} close hit target`).toBe(true)
        expect(initial.bodyItemHitOk, `${ctx} first body link hit target`).toBe(true)

        // Single-line title vertically centers with close button (<= 2px delta).
        expect(
          Math.abs(initial.titleRect.centerY - initial.closeRect.centerY),
          `${ctx} single-line title/close vertical center delta`,
        ).toBeLessThanOrEqual(2)

        // 2. Viewport-flush border radius and single inner 1px separating border.
        expect(initial.borderRadius, `${ctx} flush radius`).toBe('0px')
        expect(initial.borders, `${ctx} directional borders`).toEqual(
          EXPECTED_BORDERS[direction],
        )

        // 3. Pointer open does NOT tint close icon in primary color.
        expect(
          initial.closeIconColor,
          `${ctx} pointer-open close icon must not be primary color`,
        ).not.toBe(primaryColor)

        // Even under programmatic focus during pointer modality, bare :focus must not tint.
        await panel.locator('.el-drawer__close-btn').focus()
        await settle(page)
        const pointerFocused = await measureDrawer(panel)
        if (!pointerFocused.closeFocusVisible) {
          expect(
            pointerFocused.closeIconColor,
            `${ctx} non-focus-visible programmatic focus must not tint close icon`,
          ).not.toBe(primaryColor)
        }

        // Keyboard Tab from drawer focus start into close button triggers :focus-visible
        // primary color + circular ring (forward focus order without wrap-around).
        await panel.locator('.el-drawer__sr-focus').focus()
        await page.keyboard.press(tabKey(browserName))
        await settle(page)
        const keyboardFocused = await measureDrawer(panel)
        expect(
          keyboardFocused.closeFocused,
          `${ctx} keyboard Tab should focus close button`,
        ).toBe(true)
        expect(
          keyboardFocused.closeFocusVisible,
          `${ctx} keyboard Tab should trigger :focus-visible`,
        ).toBe(true)
        expect(
          keyboardFocused.closeIconColor,
          `${ctx} :focus-visible close icon should use primary color`,
        ).toBe(primaryColor)
        expect(
          keyboardFocused.closeBoxShadow,
          `${ctx} :focus-visible circular 2px inset ring`,
        ).toMatch(/inset/i)
        expect(
          keyboardFocused.closeBoxShadow,
          `${ctx} :focus-visible 2px ring width`,
        ).toMatch(/0px 0px 0px 2px|inset 0 0 0 2px/i)
        expect(
          keyboardFocused.closeBorderRadius,
          `${ctx} :focus-visible circular radius`,
        ).toBeGreaterThanOrEqual(27)
      }
    })
  }

  test('btt close button aligns with header base top padding on portrait-notch viewport', async ({
    page,
  }) => {
    const profile = getSafeAreaProfile('portrait-notch')

    for (const direction of ['btt', 'rtl'] as const) {
      const params = new URLSearchParams({
        direction,
        size: '70%',
        theme: 'light',
      })
      await page.goto(`${drawerFixtureUrl}?${params}`, {
        waitUntil: 'domcontentloaded',
      })
      await applySafeAreaProfile(page, profile)
      await page.locator('#open').click()
      await expect(page.locator('#events')).toHaveText('open,opened')
      await settle(page)

      const panel = page.locator(`.el-drawer.${direction}`).last()
      const metrics = await measureDrawer(panel)
      const expectedTopOffset = direction === 'btt' ? 16 : profile.insets.top

      expect(
        Math.abs(metrics.headerPaddingTop - expectedTopOffset),
        `${direction} header padding-top on portrait-notch`,
      ).toBeLessThanOrEqual(1)
      expect(
        Math.abs(
          metrics.closeRect.top - metrics.headerRect.top - expectedTopOffset,
        ),
        `${direction} close button top offset matches header padding-top`,
      ).toBeLessThanOrEqual(1)
      expect(
        metrics.closeRect.bottom,
        `${direction} close button stays inside header on portrait-notch`,
      ).toBeLessThanOrEqual(metrics.headerRect.bottom + 1)
      expect(
        Math.abs(metrics.titleRect.centerY - metrics.closeRect.centerY),
        `${direction} title/close center alignment on portrait-notch`,
      ).toBeLessThanOrEqual(2)
    }
  })

  test('wrapping drawer title stays inside header while ElDialog keeps 12px radius and 4-side 1px border', async ({
    page,
  }) => {
    for (const theme of ['light', 'dark'] as const) {
      for (const viewport of [
        { width: 1280, height: 800 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(viewport)
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: 'reduce',
        })
        await page.goto(`/?visual=feedback&theme=${theme}`, {
          waitUntil: 'domcontentloaded',
        })
        await expect(page.getByTestId('section-feedback')).toBeVisible()

        // 1. Wrapping drawer title stays cleanly inside header without close overhang.
        await page.getByTestId('open-review-drawer').click()
        const drawer = page.locator('.el-drawer.rtl').last()
        await expect(drawer).toBeVisible()
        await expect(drawer).toHaveClass(/open/)
        await settle(page)

        const drawerMetrics = await measureDrawer(drawer)
        const ctx = `feedback-${theme}-${viewport.width}`
        expect(
          drawerMetrics.titleRect.height,
          `${ctx} long title wraps to multiple lines`,
        ).toBeGreaterThan(40)
        expect(
          drawerMetrics.titleRect.bottom,
          `${ctx} wrapping title stays inside header`,
        ).toBeLessThanOrEqual(drawerMetrics.headerRect.bottom + 1)
        expect(
          drawerMetrics.titleRect.right,
          `${ctx} wrapping title clears close button`,
        ).toBeLessThanOrEqual(drawerMetrics.closeRect.left + 1)
        expect(
          drawerMetrics.closeRect.bottom,
          `${ctx} close stays inside header`,
        ).toBeLessThanOrEqual(drawerMetrics.headerRect.bottom + 1)
        expect(
          drawerMetrics.closeRect.bottom,
          `${ctx} close does not overhang body`,
        ).toBeLessThanOrEqual(drawerMetrics.bodyRect.top + 1)
        expect(drawerMetrics.borderRadius, `${ctx} drawer radius`).toBe('0px')
        expect(drawerMetrics.borders, `${ctx} drawer rtl borders`).toEqual(
          EXPECTED_BORDERS.rtl,
        )

        await page.keyboard.press('Escape')
        await expect(drawer).toBeHidden()
        await settle(page)

        // 2. Centered ElDialog preserves 12px panel radius and 4-side 1px border.
        await page.getByTestId('open-publish-dialog').click()
        const dialog = page.locator('.el-dialog').last()
        await expect(dialog).toBeVisible()
        await settle(page)

        const dialogGeometry = await dialog.evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            borderRadius: style.borderRadius,
            borders: {
              top: style.borderTopWidth,
              right: style.borderRightWidth,
              bottom: style.borderBottomWidth,
              left: style.borderLeftWidth,
            },
          }
        })

        expect(dialogGeometry.borderRadius, `${ctx} dialog radius`).toBe('12px')
        expect(dialogGeometry.borders, `${ctx} dialog 4-side border`).toEqual({
          top: '1px',
          right: '1px',
          bottom: '1px',
          left: '1px',
        })

        await page.keyboard.press('Escape')
        await expect(dialog).toBeHidden()
        await settle(page)
      }
    }
  })
})
