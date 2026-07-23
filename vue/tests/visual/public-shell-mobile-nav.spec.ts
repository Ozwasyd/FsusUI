import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'
import {
  expect,
  test,
  type VisualViewportName,
} from '../support/visual-variant-fixture'

const modes = ['menu', 'inline', 'bottom', 'none'] as const
const diagnostics = new WeakMap<Page, string[]>()

const openMode = async (
  page: Page,
  projectName: string,
  mode?: (typeof modes)[number],
) => {
  await page.goto(
    buildVisualUrl('public-shell-nav-mode', projectName, {
      navMode: mode,
    }),
    {
      waitUntil: 'domcontentloaded',
    },
  )
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  })
  await expect(page.getByTestId('public-shell-nav-fixture')).toBeVisible()
}

const openCspSafeMenu = async (page: Page, projectName: string) => {
  await page.goto(
    buildVisualUrl('public-shell-nav-mode', projectName, {
      navMode: 'menu',
      cspSafe: 1,
    }),
    { waitUntil: 'domcontentloaded' },
  )
  await expect(page.getByTestId('public-shell-nav-fixture')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

for (const mode of modes) {
  test(`mobile ${mode} strategy snapshot`, async ({ page }, testInfo) => {
    await openMode(page, testInfo.project.name, mode)

    await expect(page).toHaveScreenshot(`public-shell-mobile-${mode}.png`, {
      fullPage: true,
    })
  })
}

test('defaults to the native header menu without a bottom dock', async ({
  page,
}, testInfo) => {
  await openMode(page, testInfo.project.name)

  await expect(page.locator('.el-public-shell')).toHaveAttribute(
    'data-mobile-nav-mode',
    'menu',
  )
  await expect(page.getByRole('button', { name: 'Sections' })).toBeVisible()
  await expect(page.locator('[data-fsus-bottom-tab-bar]')).toHaveCount(0)
})

test('keeps menu focus order and navigation semantics native', async ({
  page,
}, testInfo) => {
  await openMode(page, testInfo.project.name, 'menu')
  const trigger = page.getByRole('button', { name: 'Sections' })

  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')

  const nav = page.getByRole('navigation', { name: 'Primary sections' })
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Archive' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await page.keyboard.press('Tab')
  await expect(nav.getByRole('link', { name: 'Home' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})

test('uses one 44px bordered affordance language in the mobile project', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openMode(page, testInfo.project.name, 'menu')

  const header = page.locator('[data-public-shell-header]')
  const menuTrigger = page.getByRole('button', { name: 'Sections' })
  const searchTrigger = page.getByRole('link', { name: 'Search' })
  await menuTrigger.focus()
  await page.keyboard.press('Enter')
  const navLinks = page
    .getByRole('navigation', { name: 'Primary sections' })
    .getByRole('link')

  for (const control of [menuTrigger, searchTrigger, navLinks.first()]) {
    await expect(control).toHaveCSS('min-height', '44px')
    await expect(control).toHaveCSS('border-top-style', 'solid')
    await expect(control).toHaveCSS('border-top-width', '1px')
    await expect(control).toHaveCSS('border-radius', '6px')
    await expect(control).toHaveCSS('transition-duration', /^(?:0s(?:, )?)+$/u)
  }

  await searchTrigger.focus()
  await expect(searchTrigger).toBeFocused()
  const focusRing = await searchTrigger.evaluate((element) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--fsus-color-focus-ring)'
    element.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return {
      color,
      shadow: getComputedStyle(element).boxShadow,
    }
  })
  expect(focusRing.shadow).toContain(`${focusRing.color} 0px 0px 0px 2px inset`)
  const rowHeights = await Promise.all(
    [menuTrigger, searchTrigger].map((control) =>
      control.evaluate((element) => element.getBoundingClientRect().height),
    ),
  )
  expect(new Set(rowHeights)).toEqual(new Set([44]))
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  await testInfo.attach(
    `public-shell-mobile-bordered-${testInfo.project.name}`,
    {
      body: await header.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    },
  )
})

const contractFixtures = [
  {
    name: 'anonymous-zh-long-brand-320',
    viewport: 'public-shell-320',
    width: 320,
    locale: 'zh',
    session: 'anonymous',
    longBrand: true,
    zoom: 1,
  },
  {
    name: 'authenticated-en-375',
    viewport: 'public-shell-375',
    width: 375,
    locale: 'en',
    session: 'authenticated',
    longBrand: false,
    zoom: 1,
  },
  {
    name: 'authenticated-long-copy-390',
    viewport: 'public-shell-390',
    width: 390,
    locale: 'long',
    session: 'authenticated',
    longBrand: true,
    zoom: 1,
  },
  {
    name: 'anonymous-en-breakpoint-768',
    viewport: 'public-shell-768',
    width: 768,
    locale: 'en',
    session: 'anonymous',
    longBrand: true,
    zoom: 1,
  },
  {
    name: 'anonymous-zh-zoom-150',
    viewport: 'public-shell-375',
    width: 375,
    locale: 'zh',
    session: 'anonymous',
    longBrand: true,
    zoom: 1.5,
  },
  {
    name: 'authenticated-long-copy-zoom-200',
    viewport: 'public-shell-390',
    width: 390,
    locale: 'long',
    session: 'authenticated',
    longBrand: true,
    zoom: 2,
  },
] as const satisfies readonly {
  name: string
  viewport: VisualViewportName
  width: number
  locale: string
  session: string
  longBrand: boolean
  zoom: number
}[]

for (const fixture of contractFixtures) {
  test(`mobile action geometry ${fixture.name}`, async ({
    page,
    useVisualViewport,
  }, testInfo) => {
    await useVisualViewport(fixture.viewport)
    await page.goto(
      buildVisualUrl('public-shell-nav-mode', testInfo.project.name, {
        contract: 1,
        fixtureLocale: fixture.locale,
        longBrand: fixture.longBrand ? 1 : 0,
        navMode: 'menu',
        session: fixture.session,
      }),
      { waitUntil: 'domcontentloaded' },
    )
    if (fixture.zoom !== 1) {
      await page.evaluate((zoom) => {
        document.documentElement.style.zoom = String(zoom)
      }, fixture.zoom)
    }
    await expect(page.getByTestId('public-shell-nav-fixture')).toBeVisible()

    const shell = page.locator('.el-public-shell')
    const primary = shell.locator('.el-public-shell__mobile-primary-actions')
    const menu = primary.locator('.el-public-shell__mobile-nav-menu-trigger')

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)

    if (fixture.width >= 768) {
      await expect(primary).toBeHidden()
      await expect(shell.locator('.el-public-shell__desktop-nav')).toBeVisible()
      return
    }

    await expect(
      primary.locator(':scope > .el-public-shell__auth-link'),
    ).toHaveCount(0)
    await expect(
      primary.locator(':scope > [data-testid="public-shell-theme-action"]'),
    ).toHaveCount(0)
    await expect(
      primary.locator(':scope > [data-testid="public-shell-locale-action"]'),
    ).toHaveCount(0)

    const geometry = await primary.evaluate((element) => {
      const row = element.closest('.el-public-shell__primary-row')!
      const brand = row.querySelector<HTMLElement>('.el-public-shell__brand')!
      const search = element.querySelector<HTMLElement>(
        '.el-public-shell__mobile-search-trigger',
      )!
      const menu = element.querySelector<HTMLElement>(
        '.el-public-shell__mobile-nav-menu-trigger',
      )!
      const primaryRect = element.getBoundingClientRect()
      const brandRect = brand.getBoundingClientRect()
      const searchRect = search.getBoundingClientRect()
      const menuRect = menu.getBoundingClientRect()
      const searchStyle = getComputedStyle(search)
      const menuStyle = getComputedStyle(menu)
      return {
        actionToken: getComputedStyle(element.closest('.el-public-shell')!)
          .getPropertyValue('--fsus-public-shell-mobile-action-height')
          .trim(),
        brandOverlapsSearch: brandRect.right > searchRect.left + 1,
        menu: {
          border: menuStyle.borderTopWidth,
          fontSize: menuStyle.fontSize,
          fontWeight: menuStyle.fontWeight,
          height: menuRect.height,
          paddingInline: menuStyle.paddingInline,
          radius: menuStyle.borderRadius,
        },
        primaryHeight: primaryRect.height,
        search: {
          border: searchStyle.borderTopWidth,
          fontSize: searchStyle.fontSize,
          fontWeight: searchStyle.fontWeight,
          height: searchRect.height,
          paddingInline: searchStyle.paddingInline,
          radius: searchStyle.borderRadius,
        },
        verticalDelta: Math.abs(searchRect.top - menuRect.top),
      }
    })

    expect(geometry.actionToken).toBe('44px')
    expect(geometry.brandOverlapsSearch).toBe(false)
    expect(geometry.verticalDelta).toBeLessThanOrEqual(1)
    expect(geometry.primaryHeight).toBeGreaterThanOrEqual(
      44 * fixture.zoom - 0.5,
    )
    for (const action of [geometry.search, geometry.menu]) {
      expect(action.height).toBeGreaterThanOrEqual(44 * fixture.zoom - 0.5)
      expect(action.fontWeight).toBe('500')
      if (fixture.zoom === 1) {
        expect(action.border).toBe('1px')
        expect(action.radius).toBe('6px')
        expect(action.paddingInline).toBe('12px')
        expect(action.fontSize).toBe('14px')
      } else {
        // Chromium reports some computed lengths before CSS zoom and others
        // after device-pixel rounding. Geometry above is the authoritative
        // zoomed hit rectangle; these checks only ensure styles remain present.
        expect(Number.parseFloat(action.border)).toBeGreaterThan(0)
        expect(Number.parseFloat(action.radius)).toBeGreaterThan(0)
        expect(Number.parseFloat(action.paddingInline)).toBeGreaterThan(0)
        expect(Number.parseFloat(action.fontSize)).toBeGreaterThan(0)
      }
    }

    await menu.click()
    const panel = shell.locator('.el-public-shell__mobile-nav-menu-panel')
    await expect(panel).toBeVisible()
    const auth = panel.locator('.el-public-shell__auth-link--mobile')
    const theme = panel.getByTestId('public-shell-theme-action')
    const locale = panel.getByTestId('public-shell-locale-action')
    for (const item of [auth, theme, locale]) {
      await expect(item).toBeVisible()
      const itemGeometry = await item.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          height: element.getBoundingClientRect().height,
          paddingInline: style.paddingInline,
        }
      })
      expect(itemGeometry.height).toBeGreaterThanOrEqual(
        44 * fixture.zoom - 0.5,
      )
      if (fixture.zoom === 1) {
        expect(itemGeometry.paddingInline).toBe('16px')
      } else {
        expect(Number.parseFloat(itemGeometry.paddingInline)).toBeGreaterThan(0)
      }
    }

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1)
  })
}

test('keeps the default keyboard order brand, Search, Menu, then panel actions', async ({
  page,
  useVisualViewport,
}, testInfo) => {
  await useVisualViewport('public-shell-keyboard')
  await page.goto(
    buildVisualUrl('public-shell-nav-mode', testInfo.project.name, {
      contract: 1,
      fixtureLocale: 'zh',
      longBrand: 1,
      navMode: 'menu',
      session: 'anonymous',
    }),
    { waitUntil: 'domcontentloaded' },
  )
  await expect(page.getByTestId('public-shell-nav-fixture')).toBeVisible()

  const brand = page.locator('.el-public-shell__brand')
  const search = page.locator('.el-public-shell__mobile-search-trigger')
  const menu = page.locator('.el-public-shell__mobile-nav-menu-trigger')
  await page.keyboard.press('Tab')
  await expect(brand).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(search).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(menu).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Tab')
  await expect(
    page.locator('.el-public-shell__mobile-nav-link').first(),
  ).toBeFocused()
})

test('keeps CSP-safe menu open through its class-driven leave lifecycle', async ({
  page,
}, testInfo) => {
  await openCspSafeMenu(page, testInfo.project.name)
  const shell = page.locator('.el-public-shell')
  const menu = page.locator('.el-public-shell__mobile-nav-menu')
  const trigger = page.getByRole('button', { name: 'Sections' })
  const panel = page.getByRole('navigation', { name: 'Primary sections' })

  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).not.toHaveAttribute('open', '')
  await expect(panel).toHaveCount(0)
  await expect(shell.locator('[style]')).toHaveCount(0)

  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toHaveAttribute('open', '')
  await expect(panel).toBeVisible()
  await expect(panel).not.toHaveAttribute('style', /.+/u)
  await expect(panel).not.toHaveClass(/\benter-active\b/u)

  const closingState = await trigger.evaluate(async (element) => {
    ;(element as HTMLElement).click()
    await Promise.resolve()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const details = element.closest('details')
    const nav = details?.querySelector<HTMLElement>(
      '.el-public-shell__mobile-nav-menu-panel',
    )
    return {
      detailsOpen: details?.open ?? false,
      expanded: element.getAttribute('aria-expanded'),
      closing: details?.classList.contains('is-closing') ?? false,
      inert: nav?.hasAttribute('inert') ?? false,
      ariaHidden: nav?.getAttribute('aria-hidden'),
      leaveActive:
        nav?.classList.contains(
          'el-public-shell-mobile-nav-menu-leave-active',
        ) ?? false,
      inlineStyle: nav?.getAttribute('style'),
    }
  })

  expect(closingState).toEqual({
    detailsOpen: true,
    expanded: 'false',
    closing: true,
    inert: true,
    ariaHidden: 'true',
    leaveActive: true,
    inlineStyle: null,
  })
  await expect(menu).not.toHaveAttribute('open', '')
  await expect(panel).toHaveCount(0)
})

test('exposes inline, bottom, and none modes without duplicate landmarks', async ({
  page,
}, testInfo) => {
  await openMode(page, testInfo.project.name, 'inline')
  let nav = page.getByRole('navigation', { name: 'Primary sections' })
  await expect(nav).toHaveCount(1)
  await expect(nav.getByRole('link', { name: 'Archive' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await openMode(page, testInfo.project.name, 'bottom')
  nav = page.getByRole('navigation', { name: 'Primary sections' })
  await expect(nav).toHaveCount(1)
  await expect(nav.getByRole('link', { name: 'Archive' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  const bottomMetrics = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.el-public-shell')!
    const dock = document.querySelector<HTMLElement>(
      '[data-fsus-bottom-tab-bar]',
    )!
    const dockStyle = getComputedStyle(dock)
    const shellStyle = getComputedStyle(shell)
    return {
      dockPaddingBottom: dockStyle.paddingBottom,
      dockPosition: dockStyle.position,
      shellPaddingBottom: shellStyle.paddingBottom,
    }
  })
  expect(bottomMetrics.dockPosition).toBe('fixed')
  expect(
    Number.parseFloat(bottomMetrics.shellPaddingBottom),
  ).toBeGreaterThanOrEqual(56)
  expect(
    Number.parseFloat(bottomMetrics.dockPaddingBottom),
  ).toBeGreaterThanOrEqual(0)

  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  )
  const footerBounds = await page
    .locator('.el-public-shell__footer')
    .boundingBox()
  const dockBounds = await page
    .locator('[data-fsus-bottom-tab-bar]')
    .boundingBox()
  expect(footerBounds).not.toBeNull()
  expect(dockBounds).not.toBeNull()
  expect(footerBounds!.y + footerBounds!.height).toBeLessThanOrEqual(
    dockBounds!.y + 1,
  )

  await openMode(page, testInfo.project.name, 'none')
  await expect(
    page.getByRole('navigation', { name: 'Primary sections' }),
  ).toHaveCount(0)
  await expect(page.locator('[data-fsus-bottom-tab-bar]')).toHaveCount(0)
})
