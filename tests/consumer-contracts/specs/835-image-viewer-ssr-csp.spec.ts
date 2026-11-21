import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  SAFE_AREA_PROFILES,
  applySafeAreaProfile,
  attachPageErrorCollector,
  measureControl,
  waitForViewerImageLoaded,
} from './helpers'

interface CspViolation {
  blockedURI: string
  effectiveDirective: string
  violatedDirective: string
  disposition: string
}

async function getCspViolations(page: Page) {
  return page.evaluate(
    () =>
      ((window as unknown as { __cspViolations?: CspViolation[] })
        .__cspViolations ?? []),
  )
}

test.describe('#835 ImageViewer SSR teleport + strict CSP consumer contract', () => {
  test('raw SSR responses enforce strict style-src-attr none CSP, zero inline styles, and populate dedicated teleport hosts', async ({
    request,
  }) => {
    // 1. Initially open SSR HTML
    const openResp = await request.get('/ssr/open')
    expect(openResp.status()).toBe(200)
    const cspHeader = openResp.headers()['content-security-policy'] || ''
    expect(cspHeader).toContain("style-src 'self'")
    expect(cspHeader).toContain("style-src-attr 'none'")
    const openHtml = await openResp.text()

    expect(openHtml).not.toMatch(/<style\b/iu)
    expect(openHtml).not.toMatch(/\sstyle=/iu)
    expect(openHtml).toContain('<div id="probe-teleports">')
    expect(openHtml).toContain('Dedicated plain Vue teleport positive control')
    expect(openHtml).toContain('<div id="viewer-teleports">')
    expect(openHtml).toContain('role="dialog"')
    expect(openHtml).toContain('aria-label="SSR CSP gallery"')

    // 2. Initially closed SSR HTML
    const closedResp = await request.get('/ssr/closed')
    expect(closedResp.status()).toBe(200)
    expect(closedResp.headers()['content-security-policy']).toContain(
      "style-src-attr 'none'",
    )
    const closedHtml = await closedResp.text()
    expect(closedHtml).not.toMatch(/<style\b/iu)
    expect(closedHtml).not.toMatch(/\sstyle=/iu)
    expect(closedHtml).toContain('Dedicated plain Vue teleport positive control')
    expect(closedHtml).not.toContain('role="dialog"')
  })

  test('initially open SSR viewer hydrates in real Chromium with 1 viewer, 0 hydration warnings, 0 CSP violations, full modal/safe-area/nav lifecycle', async ({
    page,
  }) => {
    const { errors, warnings } = attachPageErrorCollector(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/ssr/open')
    await page.waitForFunction(() => Boolean(window.__ssrContractControls))

    // Positive control: plain Vue Teleport dedicated host hydrated cleanly outside #app
    const probeInDedicatedHost = page.locator(
      '#probe-teleports [data-testid="probe-teleport"]',
    )
    await expect(probeInDedicatedHost).toHaveCount(1)
    await expect(probeInDedicatedHost).toBeVisible()

    // Exactly 1 dialog inside #viewer-teleports
    const dialogs = page.getByRole('dialog', { name: 'SSR CSP gallery' })
    await expect(dialogs).toHaveCount(1)
    await expect(page.locator('#viewer-teleports [role="dialog"]')).toHaveCount(1)
    await waitForViewerImageLoaded(dialogs.first())

    // Zero Vue hydration warnings and zero CSP violations
    const hydrationWarnings = warnings.filter((w) =>
      /hydration|mismatch|\[Vue warn\]/iu.test(w),
    )
    expect(hydrationWarnings).toEqual([])
    expect(await getCspViolations(page)).toEqual([])

    // Navigation updates image and caption
    await expect(page.getByTestId('ssr-caption')).toContainText(
      '1 / 2: SSR primary diagram',
    )
    await dialogs.first().getByRole('button', { name: 'Next image' }).click()
    await expect(page.getByTestId('ssr-caption')).toContainText(
      '2 / 2: SSR secondary diagram',
    )

    // Safe-area profile via CSSOM produces zero CSP violations and valid >=44x44 controls
    const landscapeProfile = SAFE_AREA_PROFILES.find(
      (p) => p.id === 'landscape-notch',
    )!
    await applySafeAreaProfile(page, landscapeProfile)
    for (const control of await dialogs.first().locator('[role="button"]').all()) {
      const rect = await measureControl(control)
      expect(rect.width).toBeGreaterThanOrEqual(44)
      expect(rect.height).toBeGreaterThanOrEqual(44)
      expect(rect.reachable).toBe(true)
      expect(rect.x).toBeGreaterThanOrEqual(landscapeProfile.insets.left - 0.5)
      expect(rect.right).toBeLessThanOrEqual(
        landscapeProfile.viewport.width - landscapeProfile.insets.right + 0.5,
      )
    }

    // Focus trap inside dialog
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press('Tab')
      expect(
        await dialogs
          .first()
          .evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true)
    }

    // Escape closes viewer, clears inert, preserves app-owned inert, unlocks body scroll
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.body.classList.contains('el-popup-parent--hidden'),
        ),
      )
      .toBe(false)
    expect(
      await page.getByTestId('ssr-app-pre-inert').getAttribute('inert'),
    ).toBe('app-owned')

    // Repeated open/close + focus return + route unmount
    const openBtn = page.getByTestId('ssr-open-viewer-btn')
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.evaluate(() => window.scrollTo(0, 320))
    const savedY = await page.evaluate(() => Math.round(window.scrollY))

    for (let i = 0; i < 2; i += 1) {
      await openBtn.focus()
      await openBtn.click()
      await expect(page.getByRole('dialog')).toHaveCount(1)
      await waitForViewerImageLoaded(page.getByRole('dialog'))
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(openBtn).toBeFocused()
    }

    // Route unmount while open cleans up cleanly
    await openBtn.click()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await page.evaluate(() => window.__ssrContractControls?.unmountRoute())
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.body.classList.contains('el-popup-parent--hidden'),
        ),
      )
      .toBe(false)
    expect(
      Math.abs((await page.evaluate(() => Math.round(window.scrollY))) - savedY),
    ).toBeLessThanOrEqual(2)
    expect(
      await page.getByTestId('ssr-app-pre-inert').getAttribute('inert'),
    ).toBe('app-owned')

    expect(await getCspViolations(page)).toEqual([])
    expect(errors).toEqual([])
  })

  test('initially closed SSR viewer hydrates with 0 viewers, 0 warnings, 0 CSP violations, then opens/navigates/closes cleanly', async ({
    page,
  }) => {
    const { errors, warnings } = attachPageErrorCollector(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/ssr/closed')
    await page.waitForFunction(() => Boolean(window.__ssrContractControls))

    await expect(
      page.locator('#probe-teleports [data-testid="probe-teleport"]'),
    ).toHaveCount(1)
    await expect(page.getByRole('dialog')).toHaveCount(0)

    const hydrationWarnings = warnings.filter((w) =>
      /hydration|mismatch|\[Vue warn\]/iu.test(w),
    )
    expect(hydrationWarnings).toEqual([])
    expect(await getCspViolations(page)).toEqual([])

    const openBtn = page.getByTestId('ssr-open-viewer-btn')
    await openBtn.focus()
    await openBtn.click()

    const dialog = page.getByRole('dialog', { name: 'SSR CSP gallery' })
    await expect(dialog).toHaveCount(1)
    await expect(page.locator('#viewer-teleports [role="dialog"]')).toHaveCount(1)
    await waitForViewerImageLoaded(dialog)

    await dialog.getByRole('button', { name: 'Next image' }).click()
    await expect(page.getByTestId('ssr-caption')).toContainText(
      '2 / 2: SSR secondary diagram',
    )

    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(openBtn).toBeFocused()
    expect(await getCspViolations(page)).toEqual([])
    expect(errors).toEqual([])
  })

  test('negative control: inline style attribute under the exact same strict CSP triggers real securitypolicyviolation', async ({
    page,
  }) => {
    await page.goto('/ssr/csp-violation-probe')
    await page.waitForFunction(() => Boolean(window.__ssrContractControls))
    const violations = await getCspViolations(page)
    expect(violations.length).toBeGreaterThanOrEqual(1)
    expect(
      violations.some((v) =>
        `${v.effectiveDirective} ${v.violatedDirective}`.includes(
          'style-src-attr',
        ),
      ),
    ).toBe(true)
  })
})
