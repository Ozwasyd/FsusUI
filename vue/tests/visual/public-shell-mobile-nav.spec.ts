import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const modes = ['menu', 'inline', 'bottom', 'none'] as const
const diagnostics = new WeakMap<Page, string[]>()

const openMode = async (page: Page, mode?: (typeof modes)[number]) => {
  const query = mode ? `&navMode=${mode}` : ''
  await page.goto(`/?visual=public-shell-nav-mode&compact=1${query}`, {
    waitUntil: 'domcontentloaded',
  })
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

const openCspSafeMenu = async (page: Page) => {
  await page.goto(
    '/?visual=public-shell-nav-mode&compact=1&navMode=menu&cspSafe=1',
    { waitUntil: 'domcontentloaded' },
  )
  await expect(page.getByTestId('public-shell-nav-fixture')).toBeVisible()
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-light')
  diagnostics.set(page, attachPageDiagnostics(page))
})

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === 'mobile-light') {
    expect(diagnostics.get(page) ?? []).toEqual([])
  }
})

for (const mode of modes) {
  test(`mobile ${mode} strategy snapshot`, async ({ page }) => {
    await openMode(page, mode)

    await expect(page).toHaveScreenshot(`public-shell-mobile-${mode}.png`, {
      fullPage: true,
    })
  })
}

test('defaults to the native header menu without a bottom dock', async ({
  page,
}) => {
  await openMode(page)

  await expect(page.locator('.el-public-shell')).toHaveAttribute(
    'data-mobile-nav-mode',
    'menu',
  )
  await expect(page.getByRole('button', { name: 'Sections' })).toBeVisible()
  await expect(page.locator('[data-fsus-bottom-tab-bar]')).toHaveCount(0)
})

test('keeps menu focus order and navigation semantics native', async ({
  page,
}) => {
  await openMode(page, 'menu')
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

test('keeps CSP-safe menu open through its class-driven leave lifecycle', async ({
  page,
}) => {
  await openCspSafeMenu(page)
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
}) => {
  await openMode(page, 'inline')
  let nav = page.getByRole('navigation', { name: 'Primary sections' })
  await expect(nav).toHaveCount(1)
  await expect(nav.getByRole('link', { name: 'Archive' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  await openMode(page, 'bottom')
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

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const footerBounds = await page.locator('.el-public-shell__footer').boundingBox()
  const dockBounds = await page.locator('[data-fsus-bottom-tab-bar]').boundingBox()
  expect(footerBounds).not.toBeNull()
  expect(dockBounds).not.toBeNull()
  expect(footerBounds!.y + footerBounds!.height).toBeLessThanOrEqual(
    dockBounds!.y + 1,
  )

  await openMode(page, 'none')
  await expect(
    page.getByRole('navigation', { name: 'Primary sections' }),
  ).toHaveCount(0)
  await expect(page.locator('[data-fsus-bottom-tab-bar]')).toHaveCount(0)
})
