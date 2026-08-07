import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'

const computedMaterial = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = window.getComputedStyle(element)

    return {
      backdropFilter: style.backdropFilter,
      backgroundColor: style.backgroundColor,
      blurOverlay: style
        .getPropertyValue('--fsus-backdrop-blur-overlay')
        .trim(),
      saturate: style.getPropertyValue('--fsus-backdrop-saturate').trim(),
    }
  })

/** Issue #298: resolve computed shadow against canonical depth tokens. */
const computedOverlayDepth = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = window.getComputedStyle(element)
    const root = getComputedStyle(document.documentElement)
    const normalize = (value: string) =>
      value.replace(/\s+/g, ' ').trim().toLowerCase()
    const resolveTokenShadow = (name: string) => {
      if (!root.getPropertyValue(name).trim()) return ''

      const probe = document.createElement('div')
      probe.style.boxShadow = `var(${name})`
      document.body.append(probe)
      const computed = getComputedStyle(probe).boxShadow
      probe.remove()
      return computed === 'none' ? 'none' : computed
    }

    const panel = resolveTokenShadow('--fsus-shadow-panel')
    const floating = resolveTokenShadow('--fsus-shadow-floating')
    const boxShadow = style.boxShadow === 'none' ? 'none' : style.boxShadow
    const normalizedShadow = normalize(boxShadow)
    const matchesToken = (token: string) =>
      token !== '' && normalizedShadow === normalize(token)

    return {
      boxShadow,
      borderRadius: style.borderRadius,
      backdropFilter: style.backdropFilter,
      blurOverlay: style
        .getPropertyValue('--fsus-backdrop-blur-overlay')
        .trim(),
      panelToken: panel || 'none',
      floatingToken: floating,
      matchesPanel: matchesToken(panel),
      matchesFloating: matchesToken(floating),
      isNone: normalizedShadow === 'none',
    }
  })

const computedHeaderMaterial = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = window.getComputedStyle(element)

    return {
      backdropFilter: style.backdropFilter,
      backgroundColor: style.backgroundColor,
      blurSoft: style.getPropertyValue('--fsus-backdrop-blur-soft').trim(),
      saturate: style.getPropertyValue('--fsus-backdrop-saturate').trim(),
    }
  })

const verifyPaperAndGlassHeader = async (header: Locator) => {
  await header.evaluate((element) => {
    const root = element as HTMLElement
    root.style.setProperty('--fsus-backdrop-blur-soft', '8px')
    root.style.setProperty('--fsus-backdrop-saturate', '120%')
  })
  await expect
    .poll(() => computedHeaderMaterial(header))
    .toMatchObject({
      backdropFilter: 'blur(0px) saturate(1)',
      blurSoft: '8px',
      saturate: '120%',
    })

  await header.evaluate((element) => element.classList.add('is-glass'))
  await expect
    .poll(() => computedHeaderMaterial(header))
    .toMatchObject({
      backdropFilter: 'blur(8px) saturate(1.2)',
    })

  await header.evaluate((element) => {
    element.classList.remove('is-glass')
    element.setAttribute('data-fsus-material', 'glass')
  })
  await expect
    .poll(() => computedHeaderMaterial(header))
    .toMatchObject({
      backdropFilter: 'blur(8px) saturate(1.2)',
    })
}

const attachScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
) => {
  await testInfo.attach(name, {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
}

test('paper overlays keep blur disabled', async ({ page }, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(buildVisualUrl('feedback', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })

  const loadingMask = page.locator('.el-loading-mask').first()
  await expect(loadingMask).toBeVisible()
  await expect
    .poll(() => computedMaterial(loadingMask))
    .toMatchObject({
      backdropFilter: 'blur(0px) saturate(1)',
      blurOverlay: '0px',
      saturate: '100%',
    })

  await page.getByTestId('open-publish-dialog').click()
  const dialog = page.locator('.el-dialog').last()
  await expect(dialog).toBeVisible()
  await expect
    .poll(() => computedMaterial(dialog))
    .toMatchObject({
      backdropFilter: 'blur(0px) saturate(1)',
      blurOverlay: '0px',
      saturate: '100%',
    })

  await attachScreenshot(page, testInfo, `paper-loading-${theme}`)
})

test('dialog drawer notification keep correct overlay depth hierarchy', async ({
  page,
}, testInfo) => {
  // #298: same-screen depth comparison. This fixture intentionally coexists
  // multiple modal layers to compare computed material; only the first action
  // models user interaction. Later controls are dispatched programmatically so
  // the test does not require pointer events to pass through an active modal.
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(buildVisualUrl('feedback', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })

  await page.getByTestId('open-publish-dialog').click()
  const dialog = page.locator('.el-dialog').last()
  await expect(dialog).toBeVisible()

  await page.getByTestId('open-review-drawer').dispatchEvent('click')
  const drawer = page.locator('.el-drawer').last()
  await expect(drawer).toBeVisible()

  await page.getByTestId('open-notification').dispatchEvent('click')
  const notification = page.locator('.el-notification').last()
  await expect(notification).toBeVisible()

  const dialogDepth = await computedOverlayDepth(dialog)
  const drawerDepth = await computedOverlayDepth(drawer)
  const notificationDepth = await computedOverlayDepth(notification)
  expect({
    dialogIsPanel: dialogDepth.matchesPanel || dialogDepth.isNone,
    drawerIsPanel: drawerDepth.matchesPanel || drawerDepth.isNone,
    dialogNotFloating: !dialogDepth.matchesFloating || dialogDepth.isNone,
    drawerNotFloating: !drawerDepth.matchesFloating || drawerDepth.isNone,
    notificationIsFloating:
      notificationDepth.matchesFloating && !notificationDepth.isNone,
    dialogBlur: dialogDepth.blurOverlay,
    drawerBlur: drawerDepth.blurOverlay,
    notificationBlur: notificationDepth.blurOverlay,
  }).toMatchObject({
    dialogIsPanel: true,
    drawerIsPanel: true,
    dialogNotFloating: true,
    drawerNotFloating: true,
    notificationIsFloating: true,
    dialogBlur: '0px',
    drawerBlur: '0px',
    notificationBlur: '0px',
  })

  expect(dialogDepth.borderRadius).toMatch(/^12px$/)
  expect(drawerDepth.borderRadius).toMatch(/^12px$/)
  expect(notificationDepth.borderRadius).toMatch(/^10px$/)

  expect(notificationDepth.boxShadow).not.toMatch(
    /rgb\(\s*42\s*,\s*89\s*,\s*156/i,
  )
  expect(notificationDepth.boxShadow).not.toMatch(/var\(--el-color-primary/i)

  await attachScreenshot(page, testInfo, `overlay-depth-hierarchy-${theme}`)
})

test('image viewer owns the only public glass mask', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(buildVisualUrl('others', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Direct Viewer' }).click()

  const wrapper = page.locator('.el-image-viewer__wrapper')
  const mask = page.locator('.el-image-viewer__mask')
  await expect(wrapper).toHaveAttribute('data-fsus-material', 'glass')
  await expect(mask).toBeVisible()
  await expect
    .poll(() => computedMaterial(mask))
    .toMatchObject({
      backdropFilter: 'blur(8px) saturate(1.2)',
      blurOverlay: '8px',
      saturate: '120%',
    })
  await attachScreenshot(page, testInfo, `image-viewer-glass-${theme}`)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(wrapper).toHaveCSS('animation-duration', /^(?:0\.00001|1e-05)s$/)
  await attachScreenshot(page, testInfo, `image-viewer-reduced-motion-${theme}`)
})

test('site and public headers keep glass opt-in', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.goto(buildVisualUrl('issue-primitives', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  const siteHeader = page
    .locator('.issue-primitives__site-header-fixtures .el-site-header')
    .first()
  await expect(siteHeader).toBeVisible()
  await verifyPaperAndGlassHeader(siteHeader)

  await page.goto(
    buildVisualUrl('public-shell-search-mode', testInfo.project.name),
    {
      waitUntil: 'domcontentloaded',
    },
  )
  const publicHeader = page.locator('[data-public-shell-header]')
  await expect(publicHeader).toBeVisible()
  await verifyPaperAndGlassHeader(publicHeader)

  await testInfo.attach(`header-glass-opt-in-${theme}`, {
    body: await publicHeader.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})
