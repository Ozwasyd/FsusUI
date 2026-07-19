import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'

const themeFor = (projectName: string) =>
  projectName.includes('dark') ? 'dark' : 'light'

const computedMaterial = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = window.getComputedStyle(element)

    return {
      backdropFilter: style.backdropFilter,
      backgroundColor: style.backgroundColor,
      blurOverlay: style.getPropertyValue('--fsus-backdrop-blur-overlay').trim(),
      saturate: style.getPropertyValue('--fsus-backdrop-saturate').trim(),
    }
  })

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
  const theme = themeFor(testInfo.project.name)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(`/?visual=feedback&theme=${theme}`, {
    waitUntil: 'domcontentloaded',
  })

  const loadingMask = page.locator('.el-loading-mask').first()
  await expect(loadingMask).toBeVisible()
  await expect.poll(() => computedMaterial(loadingMask)).toMatchObject({
    backdropFilter: 'blur(0px) saturate(1)',
    blurOverlay: '0px',
    saturate: '100%',
  })

  await page.getByTestId('open-publish-dialog').click()
  const dialog = page.locator('.el-dialog').last()
  await expect(dialog).toBeVisible()
  await expect.poll(() => computedMaterial(dialog)).toMatchObject({
    backdropFilter: 'blur(0px) saturate(1)',
    blurOverlay: '0px',
    saturate: '100%',
  })

  await attachScreenshot(page, testInfo, `paper-loading-${theme}`)
})

test('image viewer owns the only public glass mask', async ({ page }, testInfo) => {
  const theme = themeFor(testInfo.project.name)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto(`/?visual=others&theme=${theme}`, {
    waitUntil: 'domcontentloaded',
  })
  await page.getByRole('button', { name: 'Direct Viewer' }).click()

  const wrapper = page.locator('.el-image-viewer__wrapper')
  const mask = page.locator('.el-image-viewer__mask')
  await expect(wrapper).toHaveAttribute('data-fsus-material', 'glass')
  await expect(mask).toBeVisible()
  await expect.poll(() => computedMaterial(mask)).toMatchObject({
    backdropFilter: 'blur(8px) saturate(1.2)',
    blurOverlay: '8px',
    saturate: '120%',
  })
  await attachScreenshot(page, testInfo, `image-viewer-glass-${theme}`)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(wrapper).toHaveCSS(
    'animation-duration',
    /^(?:0\.00001|1e-05)s$/,
  )
  await attachScreenshot(page, testInfo, `image-viewer-reduced-motion-${theme}`)
})
