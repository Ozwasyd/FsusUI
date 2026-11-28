import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const diagnostics = new WeakMap<Page, string[]>()

const demoRoutes = [
  { name: 'home', path: '/?theme=light' },
  { name: 'basic', path: '/?visual=basic&theme=light', testId: 'section-basic' },
  { name: 'form', path: '/?visual=form&theme=light', testId: 'section-form' },
  { name: 'data', path: '/?visual=data&theme=light', testId: 'section-data' },
  {
    name: 'navigation',
    path: '/?visual=navigation&theme=light',
    testId: 'section-navigation',
  },
  {
    name: 'feedback',
    path: '/?visual=feedback&theme=light',
    testId: 'section-feedback',
  },
  { name: 'others', path: '/?visual=others&theme=light', testId: 'section-others' },
  { name: 'icons', path: '/?visual=icons&theme=light', testId: 'section-icons' },
  {
    name: 'markdown-stress',
    path: '/?visual=markdown-stress&theme=light',
    testId: 'section-markdown-stress',
  },
] as const

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

for (const route of demoRoutes) {
  test(`dev server renders ${route.name} route with zero diagnostics`, async ({
    page,
  }) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' })
    if ('testId' in route) {
      await expect(page.getByTestId(route.testId)).toBeVisible()
    } else {
      await expect(page.getByTestId('demo-virtual-home')).toBeVisible()
    }
  })
}

test('default home mounts virtualized sections and navigates via tabs', async ({
  page,
}) => {
  await page.goto('/?theme=light', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('demo-virtual-home')).toBeVisible()
  await expect(page.getByTestId('section-basic')).toBeVisible()

  await page.getByRole('button', { name: 'Navigation', exact: true }).click()
  await expect(page.getByTestId('section-navigation')).toBeVisible()
})

test('Others card header keeps title and action separated on narrow screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto('/?visual=others&theme=light', {
    waitUntil: 'domcontentloaded',
  })
  const card = page.locator('.box-card').first()
  await expect(card).toBeVisible()

  const layout = await card.evaluate((element) => {
    const header = element.querySelector<HTMLElement>('.card-header')
    const title = header?.querySelector<HTMLElement>('span')
    const button = header?.querySelector<HTMLElement>('.fsus-button')
    if (!title || !button) return null
    const titleRect = title.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    const horizontalOverlap =
      Math.min(titleRect.right, buttonRect.right) -
      Math.max(titleRect.left, buttonRect.left)
    const verticalOverlap =
      Math.min(titleRect.bottom, buttonRect.bottom) -
      Math.max(titleRect.top, buttonRect.top)
    return {
      overlaps: horizontalOverlap > 0 && verticalOverlap > 0,
      titleWidth: titleRect.width,
      buttonWidth: buttonRect.width,
    }
  })

  expect(layout).not.toBeNull()
  expect(layout!.overlaps).toBe(false)
  expect(layout!.titleWidth).toBeGreaterThan(20)
  expect(layout!.buttonWidth).toBeGreaterThan(20)
})

test('markdown stress route renders long WASM content without diagnostics', async ({
  page,
}) => {
  await page.goto('/?visual=markdown-stress&theme=light', {
    waitUntil: 'domcontentloaded',
  })
  const section = page.getByTestId('section-markdown-stress')
  await expect(section).toBeVisible()
  const renderer = section.locator('.markdown-stress-renderer').first()
  await expect(renderer).toBeVisible()
  expect(await renderer.locator('h1, h2, h3').count()).toBeGreaterThan(0)
})
