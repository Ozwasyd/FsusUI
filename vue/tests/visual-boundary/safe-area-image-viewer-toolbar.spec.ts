import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import {
  applySafeAreaProfile,
  getSafeAreaProfile,
  SAFE_AREA_PROFILE_IDS,
} from '../support/safe-area-profile'

async function openViewer(page: Page, theme: 'light' | 'dark') {
  await page.goto(`/?audit=ui-boundaries&state=focus&theme=${theme}`)
  await expect(page).toHaveTitle(/FsusUI/)
  await expect(page.locator('[data-audit-ready="true"]')).toBeVisible()
  await page.locator('[data-safe-area-open="image-viewer"]').click()
  const viewer = page.locator('.el-image-viewer__wrapper')
  await expect(viewer).toBeVisible()
  await expect(viewer).not.toHaveClass(/viewer-fade-enter-active/)
  await expect
    .poll(() =>
      viewer
        .locator('img')
        .first()
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    )
    .toBe(true)
  return viewer
}

async function measureControl(control: Locator) {
  return control.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const hit = document.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    )
    return {
      x: rect.x,
      y: rect.y,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      reachable: hit !== null && element.contains(hit),
    }
  })
}

for (const profileId of SAFE_AREA_PROFILE_IDS) {
  for (const theme of ['light', 'dark'] as const) {
    for (const reducedMotion of ['reduce', 'no-preference'] as const) {
      test(`ImageViewer actions: ${profileId}, ${theme}, ${reducedMotion}`, async ({
        page,
      }, testInfo) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text())
        })
        await page.emulateMedia({ colorScheme: theme, reducedMotion })
        const viewer = await openViewer(page, theme)
        const profile = getSafeAreaProfile(profileId)
        await applySafeAreaProfile(page, profile)
        await expect(page.locator('vite-error-overlay')).toHaveCount(0)
        const actions = viewer.locator('.el-image-viewer__action')
        await expect(actions).toHaveCount(5)
        await expect(actions.locator('svg')).toHaveCount(5)
        for (const control of await viewer.locator('[role="button"]').all()) {
          const rect = await measureControl(control)
          expect(rect.width).toBeGreaterThanOrEqual(44)
          expect(rect.height).toBeGreaterThanOrEqual(44)
          expect(rect.reachable).toBe(true)
          expect(rect.x).toBeGreaterThanOrEqual(profile.insets.left)
          expect(rect.y).toBeGreaterThanOrEqual(profile.insets.top)
          expect(rect.right).toBeLessThanOrEqual(
            profile.viewport.width - profile.insets.right,
          )
          expect(rect.bottom).toBeLessThanOrEqual(
            profile.viewport.height - profile.insets.bottom,
          )
        }
        for (const icon of await actions.locator('svg').all()) {
          const rect = await icon.boundingBox()
          expect(rect?.width).toBeGreaterThan(0)
          expect(rect?.height).toBeGreaterThan(0)
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true)
        expect(errors).toEqual([])
        if (
          reducedMotion === 'reduce' &&
          ((profileId === 'no-inset' && theme === 'light') ||
            (profileId === 'landscape-notch' && theme === 'dark'))
        ) {
          await page.screenshot({
            path: testInfo.outputPath(`${profileId}-${theme}.png`),
          })
        }
      })
    }
  }
}

test('wrapped ImageViewer toolbar scrolls with the wheel while canvas wheel still zooms', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const viewer = await openViewer(page, 'light')
  await applySafeAreaProfile(page, {
    ...getSafeAreaProfile('no-inset'),
    viewport: { width: 240, height: 200 },
  })
  const toolbar = viewer.locator('.el-image-viewer__actions')
  const image = viewer.locator('img').first()
  await expect
    .poll(() =>
      toolbar.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    )
    .toBe(true)
  const transform = await image.evaluate((element) => element.style.transform)
  await page.screenshot({
    path: testInfo.outputPath('toolbar-before-wheel.png'),
  })
  await toolbar.hover()
  await page.mouse.wheel(0, 120)
  await expect
    .poll(() => toolbar.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0)
  const backgroundScroll = await page.evaluate(() => scrollY)
  await page.mouse.wheel(0, 120)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => scrollY)).toBe(backgroundScroll)
  expect(await image.evaluate((element) => element.style.transform)).toBe(
    transform,
  )
  const lastAction = toolbar.locator('.el-image-viewer__action').last()
  expect((await measureControl(lastAction)).reachable).toBe(true)
  await page.screenshot({
    path: testInfo.outputPath('toolbar-after-wheel.png'),
  })
  await lastAction.click()
  await expect
    .poll(() => image.evaluate((element) => element.style.transform))
    .not.toBe(transform)
  const beforeCanvasWheel = await image.evaluate(
    (element) => element.style.transform,
  )
  await page.mouse.move(120, 20)
  await page.mouse.wheel(0, -120)
  await expect
    .poll(() => image.evaluate((element) => element.style.transform))
    .not.toBe(beforeCanvasWheel)
})

test('ImageViewer geometry rejects actual zero-area and escaped action controls', async ({
  page,
}) => {
  const viewer = await openViewer(page, 'light')
  await applySafeAreaProfile(page, getSafeAreaProfile('no-inset'))
  const action = viewer.locator('.el-image-viewer__action').first()
  const originalStyle = await action.getAttribute('style')
  const isReachableTarget = async () => {
    const rect = await measureControl(action)
    return rect.width >= 44 && rect.height >= 44 && rect.reachable
  }
  expect(await isReachableTarget()).toBe(true)
  try {
    await action.evaluate((element: HTMLElement) => {
      element.style.cssText =
        'width:0;height:0;min-width:0;min-height:0;font-size:0;overflow:hidden'
    })
    expect(await isReachableTarget()).toBe(false)
    await action.evaluate((element: HTMLElement) => {
      element.style.cssText = 'transform:translateX(10000px)'
    })
    expect(await isReachableTarget()).toBe(false)
  } finally {
    await action.evaluate((element, style) => {
      if (style === null) element.removeAttribute('style')
      else element.setAttribute('style', style)
    }, originalStyle)
  }
  expect(await isReachableTarget()).toBe(true)
})

test('short ImageViewer preserves a full action row below navigation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const viewer = await openViewer(page, 'light')
  await applySafeAreaProfile(page, {
    ...getSafeAreaProfile('no-inset'),
    viewport: { width: 320, height: 180 },
  })
  const toolbar = await measureControl(
    viewer.locator('.el-image-viewer__actions'),
  )
  const navigation = await measureControl(
    viewer.locator('.el-image-viewer__next'),
  )
  expect(toolbar.y).toBeGreaterThanOrEqual(navigation.bottom)
  expect(toolbar.bottom).toBeLessThanOrEqual(180)
  for (const action of await viewer.locator('.el-image-viewer__action').all()) {
    const rect = await measureControl(action)
    expect(rect.width).toBeGreaterThanOrEqual(44)
    expect(rect.height).toBeGreaterThanOrEqual(44)
    expect(rect.reachable).toBe(true)
  }
})

test('short ImageViewer chrome remains reachable and disjoint from the toolbar', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const viewer = await openViewer(page, 'light')
  for (const profileId of ['no-inset', 'portrait-notch'] as const) {
    const canonical = getSafeAreaProfile(profileId)
    for (const viewport of [
      { width: 320, height: 180 },
      { width: 240, height: 180 },
      { width: 240, height: 200 },
      { width: 320, height: 200 },
      { width: 320, height: 212 },
    ]) {
      await applySafeAreaProfile(page, { ...canonical, viewport })
      const controls = []
      for (const name of ['close', 'prev', 'next']) {
        const rect = await measureControl(
          viewer.locator(`.el-image-viewer__${name}`),
        )
        expect(rect.width).toBe(44)
        expect(rect.height).toBe(44)
        expect(rect.reachable).toBe(true)
        expect(rect.x).toBeGreaterThanOrEqual(canonical.insets.left)
        expect(rect.y).toBeGreaterThanOrEqual(canonical.insets.top)
        expect(rect.right).toBeLessThanOrEqual(
          viewport.width - canonical.insets.right,
        )
        expect(rect.bottom).toBeLessThanOrEqual(
          viewport.height - canonical.insets.bottom,
        )
        controls.push(rect)
      }
      const toolbar = await measureControl(
        viewer.locator('.el-image-viewer__actions'),
      )
      expect(viewport.height - toolbar.bottom).toBeGreaterThanOrEqual(
        Math.max(30, canonical.insets.bottom),
      )
      for (let first = 0; first < controls.length; first++) {
        const a = controls[first]
        for (const b of [...controls.slice(first + 1), toolbar]) {
          const overlapWidth = Math.max(
            0,
            Math.min(a.right, b.right) - Math.max(a.x, b.x),
          )
          const overlapHeight = Math.max(
            0,
            Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y),
          )
          expect(overlapWidth * overlapHeight).toBe(0)
        }
      }
    }
  }
})
