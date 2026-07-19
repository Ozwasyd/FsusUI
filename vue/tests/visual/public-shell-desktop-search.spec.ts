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
