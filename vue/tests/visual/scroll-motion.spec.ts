import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const diagnostics = new WeakMap<Page, string[]>()
const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
)

const getVisualVariant = (projectName: string) => {
  switch (projectName) {
    case 'mobile-light':
      return { theme: 'light', compact: true }
    case 'desktop-dark':
      return { theme: 'dark', compact: false }
    case 'mobile-dark':
      return { theme: 'dark', compact: true }
    default:
      return { theme: 'light', compact: false }
  }
}

const buildVisualUrl = (mode: string, projectName: string) => {
  const { theme, compact } = getVisualVariant(projectName)
  const params = new URLSearchParams()

  params.set('visual', mode)
  params.set('theme', theme)
  if (compact) params.set('compact', '1')

  return `/?${params.toString()}`
}

const stabilizePage = async (page: Page) => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        transition-duration: 0s !important;
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  })
}

const blurRadius = (filter: string) => {
  const match = /blur\(([\d.]+)px\)/.exec(filter)
  return match ? Number.parseFloat(match[1]) : 0
}

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.route('https://cube.elemecdn.com/**', (route) =>
    route.fulfill({
      body: transparentPng,
      contentType: 'image/png',
      status: 200,
    }),
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

test('scroll containers expose unified motion without text blur while scrolling', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(buildVisualUrl('data', test.info().project.name))
  await stabilizePage(page)

  const treeWrapper = page
    .locator('[data-testid="tree-v2-container"] .el-vl__wrapper')
    .first()
  const treeWindow = page
    .locator('[data-testid="tree-v2-container"] .el-tree-virtual-list')
    .first()

  await expect(treeWrapper).toBeVisible()
  await treeWindow.evaluate((element) => {
    element.scrollTop = 88
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(treeWrapper).toHaveClass(/is-scrolling/)

  const treeMotion = await treeWrapper.evaluate((wrapper) => {
    const item = wrapper.querySelector<HTMLElement>('.el-vl__inner > *')
    const thumb = wrapper.querySelector<HTMLElement>(
      '.el-virtual-scrollbar .el-scrollbar__thumb',
    )

    if (!item || !thumb) {
      throw new Error('TreeV2 virtual scrolling internals are missing')
    }

    const itemStyle = window.getComputedStyle(item)
    const thumbStyle = window.getComputedStyle(thumb)

    return {
      compositor: wrapper.getAttribute('data-fsus-compositor'),
      hardware: wrapper.getAttribute('data-fsus-render-hardware'),
      itemFilter: itemStyle.filter,
      itemTransform: itemStyle.transform,
      thumbFilter: thumbStyle.filter,
      thumbShadow: thumbStyle.boxShadow,
    }
  })

  expect(treeMotion.itemTransform).toBe('none')
  expect(blurRadius(treeMotion.itemFilter)).toBeLessThanOrEqual(0.05)
  expect(blurRadius(treeMotion.thumbFilter)).toBeLessThanOrEqual(0.05)
  expect(treeMotion.thumbShadow).not.toBe('none')

  await page.goto(buildVisualUrl('basic', test.info().project.name))
  await stabilizePage(page)

  const scrollbarBlock = page.locator('.demo-block', { hasText: 'Scrollbar' })
  const scrollbar = scrollbarBlock.locator('.el-scrollbar').first()
  const scrollWrap = scrollbar.locator('.el-scrollbar__wrap').first()

  await expect(scrollbar).toBeVisible()
  await scrollWrap.evaluate((element) => {
    element.scrollTop = 48
    element.dispatchEvent(new Event('scroll'))
  })
  await expect(scrollbar).toHaveClass(/is-scrolling/)

  const scrollbarMotion = await scrollbar.evaluate((element) => {
    const item = element.querySelector<HTMLElement>('.el-scrollbar__view > *')
    const thumb = element.querySelector<HTMLElement>(
      '.el-scrollbar__bar.is-vertical .el-scrollbar__thumb',
    )

    if (!item || !thumb) {
      throw new Error('Scrollbar motion internals are missing')
    }

    const itemStyle = window.getComputedStyle(item)
    const thumbStyle = window.getComputedStyle(thumb)

    return {
      itemFilter: itemStyle.filter,
      itemTransform: itemStyle.transform,
      thumbFilter: thumbStyle.filter,
      thumbShadow: thumbStyle.boxShadow,
    }
  })

  expect(scrollbarMotion.itemTransform).not.toBe('none')
  expect(blurRadius(scrollbarMotion.itemFilter)).toBeLessThanOrEqual(0.05)
  expect(blurRadius(scrollbarMotion.thumbFilter)).toBeLessThanOrEqual(0.05)
  expect(scrollbarMotion.thumbShadow).not.toBe('none')

  await expect(scrollbar).not.toHaveClass(/is-scrolling/, { timeout: 900 })
  const idleFilter = await scrollbar.evaluate((element) => {
    const item = element.querySelector<HTMLElement>('.el-scrollbar__view > *')
    return item ? window.getComputedStyle(item).filter : 'none'
  })
  expect(blurRadius(idleFilter)).toBeLessThanOrEqual(0.05)
})
