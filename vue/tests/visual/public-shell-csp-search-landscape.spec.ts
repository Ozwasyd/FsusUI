import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'

const diagnostics = new WeakMap<Page, string[]>()

type CspViolationRecord = {
  blockedURI: string
  effectiveDirective: string
  violatedDirective: string
}

declare global {
  interface Window {
    __fsusCspViolations?: CspViolationRecord[]
  }
}

const installStrictStyleAttrCsp = async (page: Page) => {
  await page.addInitScript(() => {
    window.__fsusCspViolations = []
    window.addEventListener('securitypolicyviolation', (event) => {
      window.__fsusCspViolations?.push({
        blockedURI: event.blockedURI,
        effectiveDirective: event.effectiveDirective,
        violatedDirective: event.violatedDirective,
      })
    })
  })

  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') {
      await route.continue()
      return
    }
    const response = await route.fetch()
    const headers = {
      ...response.headers(),
      'content-security-policy': "style-src-attr 'none'",
    }
    await route.fulfill({ response, headers })
  })
}

const readCspViolations = async (page: Page) =>
  page.evaluate(() => window.__fsusCspViolations ?? [])

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

const portraitCspViewports = [
  { name: 'portrait-375x812', width: 375, height: 812 },
  { name: 'portrait-320x800', width: 320, height: 800 },
] as const

for (const viewport of portraitCspViewports) {
  test.describe(`#1093 CSP-safe portrait mobile trigger search (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('renders in-flow below primary row with single Cancel, zero inline styles, outside tap and Escape close', async ({
      page,
    }, testInfo) => {
      await installStrictStyleAttrCsp(page)

      await page.goto(
        buildVisualUrl('public-shell-nav-mode', testInfo.project.name, {
          navMode: 'menu',
          cspSafe: 1,
        }),
        { waitUntil: 'domcontentloaded' },
      )
      await page.addStyleTag({
        content: '.demo-app-container { max-width: none; padding: 0; }',
      })
      await expect(page.getByTestId('public-shell-nav-fixture')).toBeVisible()

      const shell = page.locator('.el-public-shell')
      const primaryRow = shell.locator('.el-public-shell__primary-row')
      const brand = shell.locator('.el-public-shell__brand')
      const triggers = shell.locator('.el-public-shell__mobile-search-trigger')
      const trigger = triggers.first()
      const host = shell.locator('.el-public-shell__mobile-search-host')
      const searchRow = shell.locator('.el-public-shell__mobile-search-row')

      await expect(triggers).toHaveCount(1)
      await expect(shell.locator('[style]')).toHaveCount(0)
      await expect(trigger).toHaveCSS('text-decoration-line', 'none')
      await expect(searchRow).toBeHidden()

      const restingTriggerBox = await trigger.boundingBox()
      expect(restingTriggerBox).not.toBeNull()
      expect(restingTriggerBox!.height).toBeGreaterThanOrEqual(44)
      expect(restingTriggerBox!.width).toBeGreaterThanOrEqual(44)

      // Open mobile trigger search
      await trigger.click()
      await expect(triggers).toHaveCount(1)
      await expect(trigger).toHaveText('Cancel')
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
      await expect(trigger).toHaveCSS('text-decoration-line', 'none')
      await expect(searchRow).toBeVisible()
      await expect(shell.locator('[style]')).toHaveCount(0)

      const input = searchRow.locator('input:not([type="hidden"])')
      await expect(input).toBeFocused()
      await input.fill('minimalist')
      await expect(shell.locator('[style]')).toHaveCount(0)

      const openMetrics = await page.evaluate(() => {
        const hostEl = document.querySelector<HTMLElement>(
          '.el-public-shell__mobile-search-host',
        )!
        const rowEl = document.querySelector<HTMLElement>(
          '.el-public-shell__mobile-search-row',
        )!
        const primaryEl = document.querySelector<HTMLElement>(
          '.el-public-shell__primary-row',
        )!
        const brandEl = document.querySelector<HTMLElement>(
          '.el-public-shell__brand',
        )!
        const primaryRect = primaryEl.getBoundingClientRect()
        const brandRect = brandEl.getBoundingClientRect()
        const rowRect = rowEl.getBoundingClientRect()
        return {
          hostMatchesPopoverOpen: hostEl.matches(':popover-open'),
          hostHasPopoverAttr: hostEl.hasAttribute('popover'),
          rowBelowPrimaryRow: rowRect.top >= primaryRect.bottom - 1,
          rowBelowBrand: rowRect.top >= brandRect.bottom - 1,
          rowWidth: rowRect.width,
          primaryWidth: primaryRect.width,
          overflow:
            document.documentElement.scrollWidth - window.innerWidth,
        }
      })

      expect(openMetrics.hostMatchesPopoverOpen).toBe(false)
      expect(openMetrics.hostHasPopoverAttr).toBe(false)
      expect(openMetrics.rowBelowPrimaryRow).toBe(true)
      expect(openMetrics.rowBelowBrand).toBe(true)
      expect(openMetrics.rowWidth).toBeGreaterThanOrEqual(
        openMetrics.primaryWidth - 2,
      )
      expect(openMetrics.overflow).toBeLessThanOrEqual(1)

      // Outside tap dismisses portrait search without stealing focus
      const articleHeading = page.locator('.public-shell-nav-fixture h1')
      await articleHeading.click()
      await expect(searchRow).toBeHidden()
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
      await expect(trigger).toHaveText('Search')
      await expect(shell.locator('[style]')).toHaveCount(0)

      // Re-open and close with Escape -> restores focus to trigger
      await trigger.click()
      await expect(searchRow).toBeVisible()
      await expect(input).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(searchRow).toBeHidden()
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
      await expect(trigger).toBeFocused()
      await expect(shell.locator('[style]')).toHaveCount(0)

      expect(await readCspViolations(page)).toEqual([])
      expect(await host.getAttribute('style')).toBeNull()
      expect(await primaryRow.boundingBox()).not.toBeNull()
      expect(await brand.boundingBox()).not.toBeNull()

      // Capture visual evidence after all strict CSP and [style] assertions complete
      await trigger.click()
      await expect(searchRow).toBeVisible()
      await testInfo.attach(
        `csp-mobile-search-${viewport.name}-${testInfo.project.name}`,
        {
          body: await page.screenshot({ animations: 'disabled' }),
          contentType: 'image/png',
        },
      )
    })
  })
}

test.describe('#1093 CSP-safe short-landscape trigger search (667x375)', () => {
  test.use({ viewport: { width: 667, height: 375 } })

  test('opens below compact header with opaque paper surface, absorbs backdrop taps, and restores focus on Escape', async ({
    page,
  }, testInfo) => {
    await installStrictStyleAttrCsp(page)

    await page.goto(
      buildVisualUrl('public-shell-nav-mode', testInfo.project.name, {
        navMode: 'menu',
        cspSafe: 1,
      }),
      { waitUntil: 'domcontentloaded' },
    )
    // Remove demo-app's outer gallery wrapper padding so ElPublicShell mounts
    // at viewport y=0 like a real full-bleed public site (stylesheet rule, no inline style).
    await page.addStyleTag({
      content: '.demo-app-container { max-width: none; padding: 0; }',
    })
    await expect(page.getByTestId('public-shell-nav-fixture')).toBeVisible()

    const shell = page.locator('.el-public-shell')
    const header = shell.locator('[data-public-shell-header]')
    const triggers = shell.locator('.el-public-shell__mobile-search-trigger')
    const trigger = triggers.first()
    const searchRow = shell.locator('.el-public-shell__mobile-search-row')

    await expect(triggers).toHaveCount(1)
    await expect(shell.locator('[style]')).toHaveCount(0)
    await expect(trigger).toHaveCSS('text-decoration-line', 'none')

    const triggerBox = await trigger.boundingBox()
    expect(triggerBox).not.toBeNull()
    expect(triggerBox!.height).toBeGreaterThanOrEqual(44)

    // Open in short landscape -> native top-layer popover
    await trigger.click()
    await expect(triggers).toHaveCount(1)
    await expect(trigger).toHaveText('Cancel')
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(searchRow).toBeVisible()
    await expect(shell.locator('[style]')).toHaveCount(0)

    const input = searchRow.locator('input:not([type="hidden"])')
    await expect(input).toBeFocused()
    await input.fill('landscape')
    await expect(shell.locator('[style]')).toHaveCount(0)

    const landscapeMetrics = await page.evaluate(() => {
      const headerEl = document.querySelector<HTMLElement>(
        '[data-public-shell-header]',
      )!
      const brandEl = document.querySelector<HTMLElement>(
        '.el-public-shell__brand',
      )!
      const hostEl = document.querySelector<HTMLElement>(
        '.el-public-shell__mobile-search-host',
      )!
      const rowEl = document.querySelector<HTMLElement>(
        '.el-public-shell__mobile-search-row',
      )!
      const headerRect = headerEl.getBoundingClientRect()
      const brandRect = brandEl.getBoundingClientRect()
      const rowRect = rowEl.getBoundingClientRect()
      const rowBg = getComputedStyle(rowEl).backgroundColor
      const hostPointerEvents = getComputedStyle(hostEl).pointerEvents
      return {
        hostMatchesPopoverOpen: hostEl.matches(':popover-open'),
        hostPointerEvents,
        rowBg,
        rowBelowHeader: rowRect.top >= headerRect.bottom - 1,
        rowBelowBrand: rowRect.top >= brandRect.bottom - 1,
        rowWithinViewportRight: rowRect.right <= window.innerWidth + 1,
        rowWithinViewportBottom: rowRect.bottom <= window.innerHeight + 1,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        brandCenterX: brandRect.left + brandRect.width / 2,
        brandCenterY: brandRect.top + brandRect.height / 2,
      }
    })

    expect(landscapeMetrics.hostMatchesPopoverOpen).toBe(true)
    expect(landscapeMetrics.hostPointerEvents).toBe('auto')
    expect(landscapeMetrics.rowBelowHeader).toBe(true)
    expect(landscapeMetrics.rowBelowBrand).toBe(true)
    expect(landscapeMetrics.rowWithinViewportRight).toBe(true)
    expect(landscapeMetrics.rowWithinViewportBottom).toBe(true)
    expect(landscapeMetrics.overflow).toBeLessThanOrEqual(1)
    // Opaque paper surface: rgb(...) without alpha channel
    expect(landscapeMetrics.rowBg).toMatch(/^rgb\(\d+,\s*\d+,\s*\d+\)$/u)

    // Clicking on the backdrop directly over the underlying brand link (#home)
    // must be absorbed without navigating the hash, close the overlay, and restore focus.
    const urlBeforeBackdropTap = page.url()
    await page.mouse.click(
      landscapeMetrics.brandCenterX,
      landscapeMetrics.brandCenterY,
    )
    await expect(searchRow).toBeHidden()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toHaveText('Search')
    await expect(trigger).toBeFocused()
    expect(page.url()).toBe(urlBeforeBackdropTap)
    await expect(shell.locator('[style]')).toHaveCount(0)

    // Re-open and close with Escape -> restores focus to trigger
    await trigger.click()
    await expect(searchRow).toBeVisible()
    await expect(input).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(searchRow).toBeHidden()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toBeFocused()
    await expect(shell.locator('[style]')).toHaveCount(0)

    expect(await header.boundingBox()).not.toBeNull()
    expect(await readCspViolations(page)).toEqual([])

    // Capture visual evidence after all strict CSP and [style] assertions complete
    await trigger.click()
    await expect(searchRow).toBeVisible()
    await testInfo.attach(
      `csp-mobile-search-landscape-667x375-${testInfo.project.name}`,
      {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      },
    )
  })
})

const landscapeZoomLevels = [1, 1.5, 2] as const

test.describe('#828 short-landscape collapsed header height budget (844x390)', () => {
  test.use({ viewport: { width: 844, height: 390 } })

  for (const zoom of landscapeZoomLevels) {
    test(`stays within chrome budget and retains 44px touch targets at ${zoom * 100}% zoom`, async ({
      page,
    }, testInfo) => {
      await page.goto(
        buildVisualUrl('public-shell-nav-mode', testInfo.project.name, {
          contract: 1,
          navMode: 'menu',
        }),
        { waitUntil: 'domcontentloaded' },
      )
      if (zoom !== 1) {
        await page.evaluate((level) => {
          document.documentElement.style.zoom = String(level)
        }, zoom)
      }
      await expect(page.getByTestId('public-shell-nav-fixture')).toBeVisible()

      const metrics = await page.evaluate((level) => {
        const header = document.querySelector<HTMLElement>(
          '[data-public-shell-header]',
        )!
        const brand = document.querySelector<HTMLElement>(
          '.el-public-shell__brand',
        )!
        const search = document.querySelector<HTMLElement>(
          '.el-public-shell__mobile-search-trigger',
        )!
        const menu = document.querySelector<HTMLElement>(
          '.el-public-shell__mobile-nav-menu-trigger',
        )!
        const desktopNav = document.querySelector<HTMLElement>(
          '.el-public-shell__desktop-nav',
        )!
        const headerRect = header.getBoundingClientRect()
        const brandRect = brand.getBoundingClientRect()
        const searchRect = search.getBoundingClientRect()
        const menuRect = menu.getBoundingClientRect()

        return {
          headerRenderedHeight: headerRect.height,
          headerLogicalHeight: headerRect.height / level,
          viewportHeight: window.innerHeight,
          brandLogicalHeight: brandRect.height / level,
          searchLogicalHeight: searchRect.height / level,
          menuLogicalHeight: menuRect.height / level,
          brandOverlapsSearch: brandRect.right > searchRect.left + 1,
          desktopNavDisplay: getComputedStyle(desktopNav).display,
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        }
      }, zoom)

      // <= 34% of 390px viewport height (<= 132.6px rendered) and <= 66px logical height
      expect(metrics.headerRenderedHeight).toBeLessThanOrEqual(
        metrics.viewportHeight * 0.34,
      )
      expect(metrics.headerLogicalHeight).toBeLessThanOrEqual(66)
      // All interactive header controls retain >= 44px logical touch target height
      expect(metrics.brandLogicalHeight).toBeGreaterThanOrEqual(43.5)
      expect(metrics.searchLogicalHeight).toBeGreaterThanOrEqual(43.5)
      expect(metrics.menuLogicalHeight).toBeGreaterThanOrEqual(43.5)
      expect(metrics.brandOverlapsSearch).toBe(false)
      expect(metrics.desktopNavDisplay).toBe('none')
      expect(metrics.overflow).toBeLessThanOrEqual(1)

      if (zoom === 2) {
        await testInfo.attach(
          `short-landscape-844x390-zoom-200-${testInfo.project.name}`,
          {
            body: await page.screenshot({ animations: 'disabled' }),
            contentType: 'image/png',
          },
        )
      }
    })
  }
})

test.describe('#828 desktop viewport remains unaffected (1440x900)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('retains standard desktop header padding and desktop nav visibility', async ({
    page,
  }, testInfo) => {
    await page.goto(
      buildVisualUrl('public-shell-nav-mode', testInfo.project.name, {
        navMode: 'menu',
      }),
      { waitUntil: 'domcontentloaded' },
    )
    await expect(page.getByTestId('public-shell-nav-fixture')).toBeVisible()

    const inner = page.locator('.el-public-shell__inner')
    await expect(page.locator('.el-public-shell__desktop-nav')).toBeVisible()
    await expect(
      page.locator('.el-public-shell__mobile-primary-actions'),
    ).toBeHidden()
    await expect(inner).toHaveCSS('padding-top', '24px')
    await expect(inner).toHaveCSS('padding-bottom', '24px')
  })
})

test.describe('#828 portrait viewport remains unaffected (375x812)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('retains standard portrait header padding and mobile actions visibility', async ({
    page,
  }, testInfo) => {
    await page.goto(
      buildVisualUrl('public-shell-nav-mode', testInfo.project.name, {
        navMode: 'menu',
      }),
      { waitUntil: 'domcontentloaded' },
    )
    await expect(page.getByTestId('public-shell-nav-fixture')).toBeVisible()

    const inner = page.locator('.el-public-shell__inner')
    await expect(page.locator('.el-public-shell__desktop-nav')).toBeHidden()
    await expect(
      page.locator('.el-public-shell__mobile-primary-actions'),
    ).toBeVisible()
    await expect(inner).toHaveCSS('padding-top', '20px')
    await expect(inner).toHaveCSS('padding-bottom', '20px')
  })
})
