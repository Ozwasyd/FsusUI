import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const modes = ['inline', 'trigger', 'none'] as const
const diagnostics = new WeakMap<Page, string[]>()

const openMode = async (
  page: Page,
  mode: (typeof modes)[number],
  cspSafe = false,
) => {
  const cspQuery = cspSafe ? '&cspSafe=1' : ''
  await page.goto(
    `/?visual=public-shell-search-mode&searchMode=${mode}${cspQuery}`,
    { waitUntil: 'domcontentloaded' },
  )
  await expect(page.getByTestId('public-shell-search-fixture')).toBeVisible()
  await expect(page.locator('.el-public-shell')).toHaveAttribute(
    'data-desktop-search-mode',
    mode,
  )
}

const shellGeometry = async (page: Page) =>
  page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(
      '[data-public-shell-header]',
    )!
    const brand = document.querySelector<HTMLElement>(
      '.el-public-shell__brand',
    )!
    const nav = document.querySelector<HTMLElement>(
      '.el-public-shell__desktop-nav',
    )!
    const headerRect = header.getBoundingClientRect()
    const brandRect = brand.getBoundingClientRect()
    const navRect = nav.getBoundingClientRect()
    return {
      headerHeight: headerRect.height,
      brandX: brandRect.x,
      brandY: brandRect.y,
      navX: navRect.x,
      navY: navRect.y,
    }
  })

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('mobile'))
  diagnostics.set(page, attachPageDiagnostics(page))
})

test.afterEach(async ({ page }, testInfo) => {
  if (!testInfo.project.name.startsWith('mobile')) {
    expect(diagnostics.get(page) ?? []).toEqual([])
  }
})

test('renders inline, trigger, and none without shifting shell geometry', async ({
  page,
}, testInfo) => {
  const geometries = []
  await openMode(page, 'inline')

  for (const mode of modes) {
    if (mode !== 'inline') {
      await page.getByTestId(`set-search-mode-${mode}`).click()
      await expect(page.locator('.el-public-shell')).toHaveAttribute(
        'data-desktop-search-mode',
        mode,
      )
    }
    const header = page.locator('[data-public-shell-header]')
    geometries.push(await shellGeometry(page))

    if (mode === 'inline') {
      await expect(
        header.locator('.el-public-shell__search--desktop input[type="text"]'),
      ).toBeVisible()
    } else if (mode === 'trigger') {
      await expect(
        page.getByRole('link', { name: 'Search archive' }),
      ).toHaveAttribute('aria-expanded', 'false')
      await expect(
        header.locator('.el-public-shell__desktop-search-panel'),
      ).toBeHidden()
    } else {
      await expect(
        header.locator(
          '.el-public-shell__search--desktop, .el-public-shell__desktop-search-trigger',
        ),
      ).toHaveCount(0)
    }

    await testInfo.attach(`desktop-search-${mode}-${testInfo.project.name}`, {
      body: await header.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
  }

  for (const geometry of geometries.slice(1)) {
    expect(Math.abs(geometry.headerHeight - geometries[0].headerHeight)).toBe(0)
    expect(geometry.brandX).toBe(geometries[0].brandX)
    expect(geometry.brandY).toBe(geometries[0].brandY)
    expect(geometry.navX).toBe(geometries[0].navX)
    expect(geometry.navY).toBe(geometries[0].navY)
  }
})

test('aligns 30px brand and 18px navigation text at 1280px', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openMode(page, 'inline')

  const header = page.locator('[data-public-shell-header]')
  const brand = header.locator('.el-public-shell__brand')
  const navLink = header.locator('.el-public-shell__nav-link').first()
  await expect(brand).toHaveCSS('font-size', '24px')
  await expect(brand).toHaveCSS('line-height', '30px')
  await expect(navLink).toHaveCSS('font-size', '12px')
  await expect(navLink).toHaveCSS('line-height', '18px')
  await expect(navLink).toHaveCSS('padding-bottom', '0px')

  const textBaselines = await Promise.all(
    [brand, navLink].map((locator) =>
      locator.evaluate((element) => {
        const marker = document.createElement('span')
        marker.setAttribute('aria-hidden', 'true')
        marker.style.cssText =
          'display:inline-block;width:0;height:0;vertical-align:baseline;pointer-events:none'
        element.append(marker)
        const baseline = marker.getBoundingClientRect().bottom
        marker.remove()
        return baseline
      }),
    ),
  )
  expect(Math.abs(textBaselines[0] - textBaselines[1])).toBeLessThanOrEqual(1)

  await testInfo.attach(`public-shell-baseline-1280-${testInfo.project.name}`, {
    body: await header.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})

test('straddles the header border with a stable 2px active indicator', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await openMode(page, 'inline')

  const header = page.locator('[data-public-shell-header]')
  const nav = header.locator('.el-public-shell__desktop-nav')
  const activeLink = nav.locator('.el-public-shell__nav-link.is-active')
  const indicator = nav.locator('.el-public-shell__active-nav-indicator')
  await expect(indicator).toBeVisible()
  await expect(indicator).toHaveCSS('bottom', '-1px')
  await expect(indicator).toHaveCSS('height', '2px')
  await expect(indicator).toHaveCSS('border-radius', '1px')
  await expect(indicator).not.toHaveCSS('transition-duration', '0s')

  const geometry = await Promise.all(
    [nav, activeLink, indicator].map((locator) =>
      locator.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }
      }),
    ),
  )
  const [navRect, linkRect, indicatorRect] = geometry
  expect(
    Math.abs(indicatorRect.top - (navRect.bottom - 1)),
  ).toBeLessThanOrEqual(0.5)
  expect(
    Math.abs(indicatorRect.bottom - (navRect.bottom + 1)),
  ).toBeLessThanOrEqual(0.5)
  expect(indicatorRect.left).toBeGreaterThanOrEqual(navRect.left)
  expect(indicatorRect.right).toBeLessThanOrEqual(navRect.right)

  await indicator.evaluate((element) => {
    ;(element as HTMLElement).style.display = 'none'
  })
  const linkWithoutIndicator = await activeLink.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    }
  })
  expect(linkWithoutIndicator).toEqual({
    top: linkRect.top,
    left: linkRect.left,
    width: linkRect.width,
    height: linkRect.height,
  })
  await indicator.evaluate((element) => {
    ;(element as HTMLElement).style.removeProperty('display')
  })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedDurations = await indicator.evaluate((element) =>
    getComputedStyle(element)
      .transitionDuration.split(',')
      .map((duration) => Number.parseFloat(duration) || 0),
  )
  expect(Math.max(...reducedDurations)).toBeLessThanOrEqual(0.00001)
  await testInfo.attach(
    `public-shell-active-indicator-${testInfo.project.name}`,
    {
      body: await header.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    },
  )
})

test('opens, submits, escapes, and closes outside without stealing focus', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openMode(page, 'trigger')

  const header = page.locator('[data-public-shell-header]')
  const trigger = page.getByRole('link', { name: 'Search archive' })
  const panel = header.locator('.el-public-shell__desktop-search-panel')

  await testInfo.attach(
    `desktop-search-trigger-closed-${testInfo.project.name}`,
    {
      body: await header.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    },
  )

  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(panel).toBeVisible()
  const input = panel.getByRole('textbox', { name: 'Search Field Notes' })
  await expect(input).toBeFocused()
  const overlayContract = await panel.evaluate((element) => {
    const style = getComputedStyle(element)
    const probe = document.createElement('div')
    probe.style.background = 'var(--fsus-surface-overlay)'
    element.append(probe)
    const expectedBackgroundColor = getComputedStyle(probe).backgroundColor
    probe.remove()
    return {
      backgroundColor: style.backgroundColor,
      expectedBackgroundColor,
    }
  })
  expect(overlayContract.backgroundColor).toBe(
    overlayContract.expectedBackgroundColor,
  )
  const transitionDuration = await panel.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).transitionDuration),
  )
  expect(transitionDuration).toBeLessThanOrEqual(0.001)

  await input.fill('layout')
  await input.press('Enter')
  await expect(page.getByTestId('search-result')).toHaveText(
    'Submitted: layout',
  )

  await testInfo.attach(
    `desktop-search-trigger-open-${testInfo.project.name}`,
    {
      body: await header.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    },
  )

  await panel.evaluate((element) => {
    ;(element as HTMLElement).style.setProperty(
      '--fsus-surface-overlay',
      'rgb(12, 34, 56)',
    )
  })
  await expect(panel).toHaveCSS('background-color', 'rgb(12, 34, 56)')

  await input.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()

  await trigger.click()
  const outside = page.getByTestId('outside-search-action')
  await outside.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(outside).toBeFocused()

  const overflow = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test('keeps trigger disclosure free of inline styles in CSP-safe mode', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-light')
  await openMode(page, 'trigger', true)

  const shell = page.locator('.el-public-shell')
  const trigger = page.getByRole('link', { name: 'Search archive' })
  const panel = shell.locator('.el-public-shell__desktop-search-panel')
  await expect(shell.locator('[style]')).toHaveCount(0)
  await expect(panel).toBeHidden()

  await trigger.click()
  await expect(panel).toBeVisible()
  await expect(panel).not.toHaveAttribute('style', /.+/u)
  await expect(shell.locator('[style]')).toHaveCount(0)
})
