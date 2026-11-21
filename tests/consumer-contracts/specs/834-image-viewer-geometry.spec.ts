import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import {
  SAFE_AREA_PROFILES,
  applySafeAreaProfile,
  attachPageErrorCollector,
  measureControl,
  waitForViewerImageLoaded,
} from './helpers'

async function openGeometryViewer(page: Page, theme: 'light' | 'dark') {
  await page.goto(`/834?theme=${theme}`)
  await expect(page.locator('[data-contract-ready="true"]')).toBeVisible()
  await page.getByTestId('open-geometry-viewer-btn').click()
  const viewer = page.getByRole('dialog', { name: 'Geometry verification viewer' })
  await waitForViewerImageLoaded(viewer)
  return viewer
}

async function assertScrimCoversViewport(
  viewer: Locator,
  viewport: { width: number; height: number },
) {
  const maskRect = await viewer
    .locator('.el-image-viewer__mask')
    .evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }
    })
  expect(maskRect.x).toBeLessThanOrEqual(0.5)
  expect(maskRect.y).toBeLessThanOrEqual(0.5)
  expect(maskRect.right).toBeGreaterThanOrEqual(viewport.width - 0.5)
  expect(maskRect.bottom).toBeGreaterThanOrEqual(viewport.height - 0.5)
}

test.describe('#834 ImageViewer toolbar geometry consumer contract', () => {
  for (const profile of SAFE_AREA_PROFILES) {
    for (const theme of ['light', 'dark'] as const) {
      for (const reducedMotion of ['reduce', 'no-preference'] as const) {
        test(`${profile.id} × ${theme} × ${reducedMotion}: all 8 controls >=44x44 inside safe rect, visible SVG, reachable, full scrim, zero overflow`, async ({
          page,
        }) => {
          const { errors } = attachPageErrorCollector(page)
          await page.emulateMedia({ colorScheme: theme, reducedMotion })
          const viewer = await openGeometryViewer(page, theme)
          await applySafeAreaProfile(page, profile)

          await assertScrimCoversViewport(viewer, profile.viewport)

          const controls = await viewer.locator('[role="button"]').all()
          expect(controls).toHaveLength(8)

          for (const control of controls) {
            const rect = await measureControl(control)
            expect(rect.width).toBeGreaterThanOrEqual(44)
            expect(rect.height).toBeGreaterThanOrEqual(44)
            expect(rect.hasVisibleSvg).toBe(true)
            expect(rect.reachable).toBe(true)
            expect(rect.x).toBeGreaterThanOrEqual(profile.insets.left - 0.5)
            expect(rect.y).toBeGreaterThanOrEqual(profile.insets.top - 0.5)
            expect(rect.right).toBeLessThanOrEqual(
              profile.viewport.width - profile.insets.right + 0.5,
            )
            expect(rect.bottom).toBeLessThanOrEqual(
              profile.viewport.height - profile.insets.bottom + 0.5,
            )
          }

          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth > window.innerWidth ||
              document.body.scrollWidth > window.innerWidth,
          )
          expect(overflow).toBe(false)
          expect(errors).toEqual([])
        })
      }
    }
  }

  test('narrow/short layouts and 200% zoom keep >=44px targets and zero body horizontal overflow', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const viewer = await openGeometryViewer(page, 'light')

    // Narrow/short layout: 320x180
    const shortProfile = {
      id: 'no-inset' as const,
      viewport: { width: 320, height: 180 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    }
    await applySafeAreaProfile(page, shortProfile)
    await assertScrimCoversViewport(viewer, shortProfile.viewport)
    for (const control of await viewer.locator('[role="button"]').all()) {
      const rect = await measureControl(control)
      expect(rect.width).toBeGreaterThanOrEqual(44)
      expect(rect.height).toBeGreaterThanOrEqual(44)
      expect(rect.hasVisibleSvg).toBe(true)
      expect(rect.reachable).toBe(true)
    }

    // 200% browser page zoom equivalent of 1280x720 -> 640x360 CSS px
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      const zoomedViewer = await openGeometryViewer(page, theme)
      const zoomedProfile = {
        id: 'no-inset' as const,
        viewport: { width: 640, height: 360 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }
      await applySafeAreaProfile(page, zoomedProfile)
      await assertScrimCoversViewport(zoomedViewer, zoomedProfile.viewport)
      for (const control of await zoomedViewer.locator('[role="button"]').all()) {
        const rect = await measureControl(control)
        expect(rect.width).toBeGreaterThanOrEqual(44)
        expect(rect.height).toBeGreaterThanOrEqual(44)
        expect(rect.hasVisibleSvg).toBe(true)
        expect(rect.reachable).toBe(true)
        expect(rect.right).toBeLessThanOrEqual(zoomedProfile.viewport.width + 0.5)
        expect(rect.bottom).toBeLessThanOrEqual(zoomedProfile.viewport.height + 0.5)
      }
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth > window.innerWidth ||
          document.body.scrollWidth > window.innerWidth,
      )
      expect(overflow).toBe(false)
    }

    expect(errors).toEqual([])
  })

  test('negative controls: zero-area and safe-rect escape fail geometry assertions', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const viewer = await openGeometryViewer(page, 'light')
    const notchProfile = SAFE_AREA_PROFILES.find(
      (profile) => profile.id === 'portrait-notch',
    )!
    await applySafeAreaProfile(page, notchProfile)

    const action = viewer.locator('.el-image-viewer__action').last()
    const isValidTarget = async () => {
      const rect = await measureControl(action)
      return (
        rect.width >= 44 &&
        rect.height >= 44 &&
        rect.reachable &&
        rect.x >= notchProfile.insets.left &&
        rect.y >= notchProfile.insets.top &&
        rect.right <= notchProfile.viewport.width - notchProfile.insets.right &&
        rect.bottom <= notchProfile.viewport.height - notchProfile.insets.bottom
      )
    }

    expect(await isValidTarget()).toBe(true)

    // Negative 1: zero-area control
    await action.evaluate((el: HTMLElement) => {
      el.style.cssText =
        'width:0 !important;height:0 !important;min-width:0 !important;min-height:0 !important;flex:0 0 0px !important;font-size:0 !important;overflow:hidden !important'
      void el.getBoundingClientRect()
    })
    await expect.poll(isValidTarget).toBe(false)

    // Negative 2: safe-rect escape
    await action.evaluate((el: HTMLElement) => {
      el.style.cssText = 'transform:translateX(10000px) !important'
      void el.getBoundingClientRect()
    })
    await expect.poll(isValidTarget).toBe(false)
  })
})
