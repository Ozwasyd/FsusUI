import { expect, test } from '@playwright/test'
import {
  attachPageErrorCollector,
  contrastRatio,
  parseCssRgb,
  waitForViewerImageLoaded,
} from './helpers'

test.describe('#833 ImageViewer accessible content & navigation consumer contract', () => {
  test('distinct alt, caption (empty & long scrollable), default slot, reactive activeIndex/urlList updates without duplicate overlays', async ({
    page,
  }) => {
    const { errors } = attachPageErrorCollector(page)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/833?scenario=multi')
    await page.getByTestId('open-content-viewer-btn').click()

    const dialog = page.getByRole('dialog', { name: 'Image preview' })
    await waitForViewerImageLoaded(dialog)
    await expect(page.getByRole('dialog')).toHaveCount(1)

    // Caption associated via aria-describedby & retained #default slot
    const describedById = await dialog.getAttribute('aria-describedby')
    expect(describedById).toBeTruthy()
    await expect(page.locator(`#${describedById}`)).toContainText(
      'Figure 1: concise overview caption.',
    )
    await expect(page.getByTestId('viewer-default-slot')).toHaveText(
      'Slide 1 / 3',
    )
    await expect(dialog.locator('img:visible')).toHaveAttribute(
      'alt',
      'System topology overview diagram',
    )

    // Navigate to index 1 (empty caption)
    await dialog.getByRole('button', { name: 'Next image' }).click()
    await expect(dialog.locator('img:visible')).toHaveAttribute(
      'alt',
      'Empty caption figure alt text',
    )
    await expect(page.getByTestId('viewer-caption-body')).toHaveText('')
    await expect(page.getByTestId('viewer-default-slot')).toHaveText(
      'Slide 2 / 3',
    )

    // Navigate to index 2 (long scrollable caption; wheel scrolls caption without zooming image)
    await dialog.getByRole('button', { name: 'Next image' }).click()
    await expect(dialog.locator('img:visible')).toHaveAttribute(
      'alt',
      'Long narrative technical figure',
    )
    const captionPort = page.locator(`#${describedById}`)
    const captionMetrics = await captionPort.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollTop: el.scrollTop,
    }))
    expect(captionMetrics.scrollHeight).toBeGreaterThan(
      captionMetrics.clientHeight,
    )
    const transformBeforeWheel = await dialog
      .locator('img:visible')
      .evaluate((el) => getComputedStyle(el).transform)
    const box = await captionPort.boundingBox()
    expect(box).not.toBeNull()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + 20)
    await page.mouse.wheel(0, 220)
    await expect
      .poll(() => captionPort.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0)
    expect(
      await dialog
        .locator('img:visible')
        .evaluate((el) => getComputedStyle(el).transform),
    ).toBe(transformBeforeWheel)

    // External reactive activeIndex & urlList updates preserve focus inside dialog with zero duplicate overlays
    await dialog.getByRole('button', { name: 'Close' }).focus()
    await page.evaluate(() => window.__viewerContentControls?.setActiveIndex(0))
    await expect(page.getByTestId('viewer-default-slot')).toHaveText(
      'Slide 1 / 3',
    )
    await expect(page.getByRole('dialog')).toHaveCount(1)
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true)

    await page.evaluate(() =>
      window.__viewerContentControls?.replaceList(
        ['/images/fig-2.svg', '/images/fig-3.svg'],
        ['Replaced A', 'Replaced B'],
        ['New caption A', 'New caption B'],
      ),
    )
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await expect(dialog.locator('img:visible')).toHaveAttribute(
      'alt',
      'Replaced A',
    )
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true)

    expect(errors).toEqual([])
  })

  test('multi-locale accessible names: en, zh-cn, and custom labels/aria-label', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // 1. Default en
    await page.goto('/833?locale=en&scenario=multi')
    await page.getByTestId('open-content-viewer-btn').click()
    const enDialog = page.getByRole('dialog', { name: 'Image preview' })
    await waitForViewerImageLoaded(enDialog)
    const enLabels = await enDialog
      .locator('[role="button"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    expect(enLabels).toEqual([
      'Close',
      'Previous image',
      'Next image',
      'Zoom out',
      'Zoom in',
      'Toggle image size',
      'Rotate left',
      'Rotate right',
    ])

    // 2. zh-cn
    await page.goto('/833?locale=zh-cn&scenario=multi')
    await page.getByTestId('open-content-viewer-btn').click()
    const zhDialog = page.getByRole('dialog', { name: '图片预览' })
    await waitForViewerImageLoaded(zhDialog)
    const zhLabels = await zhDialog
      .locator('[role="button"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    expect(zhLabels).toEqual([
      '关闭',
      '上一张',
      '下一张',
      '缩小',
      '放大',
      '切换图片尺寸',
      '向左旋转',
      '向右旋转',
    ])

    // 3. Custom labels & custom dialog aria-label
    await page.goto('/833?scenario=multi&customLabels=1&ariaLabel=Release+Figures')
    await page.getByTestId('open-content-viewer-btn').click()
    const customDialog = page.getByRole('dialog', { name: 'Release Figures' })
    await waitForViewerImageLoaded(customDialog)
    const customLabels = await customDialog
      .locator('[role="button"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    expect(customLabels).toEqual([
      'Dismiss preview',
      'Back slide',
      'Forward slide',
      'Shrink image',
      'Enlarge image',
      'Switch fit mode',
      'Turn counter-clockwise',
      'Turn clockwise',
    ])
  })

  test('single-image, finite boundaries (infinite=false), circular 2-image directional intent across pointer, keyboard, and touch', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 1024, height: 768 },
    })
    const page = await context.newPage()

    try {
      await page.emulateMedia({ reducedMotion: 'reduce' })

      // Single-image: no prev/next controls, no navigation events
      await page.goto('/833?scenario=single')
      await page.getByTestId('open-content-viewer-btn').click()
      const singleDialog = page.getByRole('dialog', { name: 'Image preview' })
      await waitForViewerImageLoaded(singleDialog)
      await expect(
        singleDialog.getByRole('button', { name: 'Previous image' }),
      ).toHaveCount(0)
      await expect(
        singleDialog.getByRole('button', { name: 'Next image' }),
      ).toHaveCount(0)
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowLeft')
      expect(
        await page.evaluate(() => window.__viewerContentControls?.getEventLog()),
      ).toEqual([])

      // Finite boundaries (infinite=false)
      await page.goto('/833?scenario=circular2&infinite=0')
      await page.getByTestId('open-content-viewer-btn').click()
      const finiteDialog = page.getByRole('dialog', { name: 'Image preview' })
      await waitForViewerImageLoaded(finiteDialog)
      const prevBtn = finiteDialog.getByRole('button', {
        name: 'Previous image',
      })
      const nextBtn = finiteDialog.getByRole('button', { name: 'Next image' })
      await expect(prevBtn).toHaveAttribute('aria-disabled', 'true')
      await prevBtn.click({ force: true })
      await page.keyboard.press('ArrowLeft')
      expect(
        await page.evaluate(() => window.__viewerContentControls?.getEventLog()),
      ).toEqual([])
      await nextBtn.click()
      await expect(nextBtn).toHaveAttribute('aria-disabled', 'true')
      await page.evaluate(() => window.__viewerContentControls?.clearEventLog())
      await nextBtn.click({ force: true })
      await page.keyboard.press('ArrowRight')
      expect(
        await page.evaluate(() => window.__viewerContentControls?.getEventLog()),
      ).toEqual([])

      // Circular 2-image directional intent via pointer, keyboard, and touch tap
      await page.goto('/833?scenario=circular2&infinite=1')
      await page.getByTestId('open-content-viewer-btn').click()
      const circDialog = page.getByRole('dialog', { name: 'Image preview' })
      await waitForViewerImageLoaded(circDialog)

      // From 0: previous -> 1 (emits previous:1), then next -> 0 (emits next:0)
      await circDialog.getByRole('button', { name: 'Previous image' }).click()
      await expect(page.getByTestId('active-index-value')).toHaveText('1')
      await circDialog.getByRole('button', { name: 'Next image' }).tap()
      await expect(page.getByTestId('active-index-value')).toHaveText('0')
      // Keyboard ArrowRight -> next:1, ArrowLeft -> previous:0
      await circDialog.focus()
      await page.keyboard.press('ArrowRight')
      await expect(page.getByTestId('active-index-value')).toHaveText('1')
      await page.keyboard.press('ArrowLeft')
      await expect(page.getByTestId('active-index-value')).toHaveText('0')

      const log = await page.evaluate(() =>
        window.__viewerContentControls?.getEventLog(),
      )
      const directionEvents = (log ?? []).filter(
        (entry) => entry.startsWith('previous:') || entry.startsWith('next:'),
      )
      expect(directionEvents).toEqual([
        'previous:1',
        'next:0',
        'next:1',
        'previous:0',
      ])
    } finally {
      await context.close()
    }
  })

  test('showToolbar=false hides zoom/rotate controls and disables zoom/rotate shortcuts vs showToolbar=true', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // showToolbar=false (nav-only)
    await page.goto('/833?scenario=multi&toolbar=0')
    await page.getByTestId('open-content-viewer-btn').click()
    const navOnly = page.getByRole('dialog', { name: 'Image preview' })
    await waitForViewerImageLoaded(navOnly)
    const navOnlyLabels = await navOnly
      .locator('[role="button"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    expect(navOnlyLabels).toEqual(['Close', 'Previous image', 'Next image'])

    const img = navOnly.locator('img:visible')
    const initialTransform = await img.evaluate(
      (el) => getComputedStyle(el).transform,
    )
    await navOnly.focus()
    await page.keyboard.press('ArrowUp')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Space')
    const imgBox = await img.boundingBox()
    await page.mouse.move(imgBox!.x + imgBox!.width / 2, imgBox!.y + imgBox!.height / 2)
    await page.mouse.wheel(0, -240)
    expect(
      await img.evaluate((el) => getComputedStyle(el).transform),
    ).toBe(initialTransform)

    // showToolbar=true enables zoom and rotate
    await page.goto('/833?scenario=multi&toolbar=1')
    await page.getByTestId('open-content-viewer-btn').click()
    const fullViewer = page.getByRole('dialog', { name: 'Image preview' })
    await waitForViewerImageLoaded(fullViewer)
    await expect(fullViewer.locator('[role="button"]')).toHaveCount(8)
    await fullViewer.getByRole('button', { name: 'Zoom in' }).click()
    await expect
      .poll(() =>
        fullViewer
          .locator('img:visible')
          .evaluate((el) => el.style.transform),
      )
      .toContain('scale(1.2)')
    await fullViewer.getByRole('button', { name: 'Rotate right' }).click()
    expect(
      await page.evaluate(() => window.__viewerContentControls?.getEventLog()),
    ).toContain('rotate:90')
  })

  test('load failure is visibly nonblank, readable contrast in light & dark themes, accessible, and closable', async ({
    page,
  }) => {
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await page.goto(`/833?scenario=broken&theme=${theme}`)
      await page.getByTestId('open-content-viewer-btn').click()

      const dialog = page.getByRole('dialog', { name: 'Image preview' })
      await expect(dialog).toBeVisible()
      const brokenImg = dialog.locator('img:visible').first()
      await expect
        .poll(() =>
          brokenImg.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth === 0,
          ),
        )
        .toBe(true)

      await expect(brokenImg).toHaveAttribute(
        'alt',
        'Unavailable architecture diagram',
      )

      const metrics = await brokenImg.evaluate((el) => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return {
          width: rect.width,
          height: rect.height,
          color: style.color,
          position: style.position,
        }
      })
      // Nonblank broken image box & readable light text against dark scrim
      expect(metrics.width).toBeGreaterThan(0)
      expect(metrics.height).toBeGreaterThan(0)
      const fgRgb = parseCssRgb(metrics.color)
      // Against dark viewer scrim (~rgb(20, 20, 22))
      expect(contrastRatio(fgRgb, [20, 20, 22])).toBeGreaterThanOrEqual(7)

      // Closable via Close control
      await dialog.getByRole('button', { name: 'Close' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }

    // Without custom alt, localized fallback alt text is populated on error
    await page.goto('/833?scenario=brokenNoAlt&locale=zh-cn')
    await page.getByTestId('open-content-viewer-btn').click()
    const zhDialog = page.getByRole('dialog', { name: '图片预览' })
    const fallbackImg = zhDialog.locator('img:visible').first()
    await expect(fallbackImg).toHaveAttribute('alt', '加载失败')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
