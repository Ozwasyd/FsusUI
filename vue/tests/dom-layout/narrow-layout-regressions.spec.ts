import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

const countRenderedLines = (locator: Locator) =>
  locator.evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const rects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 0.5 && rect.height > 0.5,
    )
    const tops: number[] = []
    for (const rect of rects) {
      if (!tops.some((top) => Math.abs(top - rect.top) <= 2)) {
        tops.push(rect.top)
      }
    }
    return tops.length
  })

test.describe('narrow layout and reactive slot regressions (#1125, #1126, #1127)', () => {
  test('ElThreadPanel keeps readable title width and clickable controls at 320px/375px and single-row desktop header (#1125)', async ({
    page,
  }, testInfo) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    for (const theme of ['light', 'dark'] as const) {
      for (const width of [320, 375, 768, 1280] as const) {
        await page.setViewportSize({ width, height: 800 })
        await page.goto(
          `/?visual=narrow-layout-regressions&fixture=thread-panel&theme=${theme}`,
          { waitUntil: 'domcontentloaded' },
        )
        const section = page.getByTestId('thread-panel-regression')
        await expect(section).toBeVisible()
        await settle(page)

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        )
        expect(overflow, `${theme} ${width}px overflow`).toBeLessThanOrEqual(0)

        const both = page.getByTestId('thread-panel-both')
        const header = both.locator('.el-thread-panel__header')
        const title = both.locator('.el-thread-panel__title')
        const backBtn = both.getByRole('button', {
          name: 'Back to conversations',
        })
        const reloadBtn = both.getByRole('button', {
          name: 'Reload conversation',
        })

        const [headerBox, titleBox, backBox, reloadBox, titleLines] =
          await Promise.all([
            header.boundingBox(),
            title.boundingBox(),
            backBtn.boundingBox(),
            reloadBtn.boundingBox(),
            countRenderedLines(title),
          ])

        expect(headerBox).not.toBeNull()
        expect(titleBox).not.toBeNull()
        expect(backBox).not.toBeNull()
        expect(reloadBox).not.toBeNull()

        if (width <= 375) {
          // Title keeps a readable width (>= 9rem / 144px) instead of a 14px leftover column.
          expect(
            titleBox!.width,
            `${theme} ${width}px title width`,
          ).toBeGreaterThanOrEqual(Math.min(headerBox!.width - 32, 144))
          expect(
            titleLines,
            `${theme} ${width}px title lines`,
          ).toBeLessThanOrEqual(2)
          // Controls never overlap the heading.
          const overlaps = (
            a: { x: number; y: number; width: number; height: number },
            b: { x: number; y: number; width: number; height: number },
          ) =>
            a.x < b.x + b.width - 1 &&
            a.x + a.width > b.x + 1 &&
            a.y < b.y + b.height - 1 &&
            a.y + a.height > b.y + 1
          expect(overlaps(backBox!, titleBox!)).toBe(false)
          expect(overlaps(reloadBox!, titleBox!)).toBe(false)
          expect(overlaps(backBox!, reloadBox!)).toBe(false)
        } else {
          // Wide container preserves single-row 3-column header.
          expect(titleLines).toBe(1)
          expect(Math.abs(backBox!.y - titleBox!.y)).toBeLessThanOrEqual(16)
          expect(Math.abs(reloadBox!.y - titleBox!.y)).toBeLessThanOrEqual(16)
        }

        // Verify all three single/empty slot variants render cleanly without squeezing titles.
        for (const variantId of [
          'thread-panel-back-only',
          'thread-panel-actions-only',
          'thread-panel-title-only',
        ]) {
          const variantTitle = page
            .getByTestId(variantId)
            .locator('.el-thread-panel__title')
          const lines = await countRenderedLines(variantTitle)
          expect(lines, `${variantId} ${theme} ${width}px`).toBeLessThanOrEqual(
            2,
          )
        }

        if (width === 375 || width === 1280) {
          await both.screenshot({
            path: testInfo.outputPath(`thread-panel-${theme}-${width}.png`),
          })
        }

        if (theme === 'light' && width === 375) {
          await backBtn.click()
          await reloadBtn.click()
          await expect(
            page.getByTestId('thread-panel-click-counts'),
          ).toHaveText('1:1')
        }
      }
    }

    expect(pageErrors).toEqual([])
  })

  test('ElCheckbox wraps long labels without horizontal overflow at 320px/375px in enabled, disabled, bordered, and group modes (#1126)', async ({
    page,
  }, testInfo) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    for (const theme of ['light', 'dark'] as const) {
      for (const width of [320, 375, 1280] as const) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(
          `/?visual=narrow-layout-regressions&fixture=checkbox&theme=${theme}`,
          { waitUntil: 'domcontentloaded' },
        )
        const section = page.getByTestId('checkbox-regression')
        await expect(section).toBeVisible()
        await settle(page)

        const metrics = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }))
        expect(
          metrics.scrollWidth,
          `${theme} ${width}px document scrollWidth`,
        ).toBeLessThanOrEqual(metrics.clientWidth)

        const longEnabled = page.getByTestId('checkbox-long-enabled')
        const longDisabled = page.getByTestId('checkbox-long-disabled')
        const shortEnabled = page.getByTestId('checkbox-short-enabled')
        const longBordered = page.getByTestId('checkbox-long-bordered')

        const [
          enabledLines,
          disabledLines,
          shortLines,
          borderedLines,
          indicatorBox,
        ] = await Promise.all([
          countRenderedLines(longEnabled.locator('.el-checkbox__label')),
          countRenderedLines(longDisabled.locator('.el-checkbox__label')),
          countRenderedLines(shortEnabled.locator('.el-checkbox__label')),
          countRenderedLines(longBordered.locator('.el-checkbox__label')),
          longEnabled.locator('.el-checkbox__inner').boundingBox(),
        ])

        expect(indicatorBox).not.toBeNull()
        expect(indicatorBox!.width).toBeGreaterThanOrEqual(13)
        expect(indicatorBox!.height).toBeGreaterThanOrEqual(13)
        expect(shortLines).toBe(1)

        if (width <= 375) {
          expect(enabledLines, `${theme} ${width}px enabled`).toBeGreaterThan(1)
          expect(disabledLines, `${theme} ${width}px disabled`).toBeGreaterThan(
            1,
          )
          expect(borderedLines, `${theme} ${width}px bordered`).toBeGreaterThan(
            1,
          )
        } else {
          expect(enabledLines).toBe(1)
          expect(disabledLines).toBe(1)
        }

        // Preserve accessible name & enabled/disabled semantics.
        const enabledInput = longEnabled.getByRole('checkbox', {
          name: /I have verified these changes and confirm updating public site configuration immediately\./,
        })
        const disabledInput = longDisabled.getByRole('checkbox', {
          name: /I have verified these changes and confirm updating public site configuration immediately\./,
        })
        await expect(enabledInput).toBeEnabled()
        await expect(disabledInput).toBeDisabled()

        if (theme === 'light' && width === 320) {
          await longEnabled.locator('.el-checkbox').click()
          await expect(enabledInput).toBeChecked()
        }

        if (width === 320 || width === 375 || width === 1280) {
          await section.screenshot({
            path: testInfo.outputPath(`checkbox-${theme}-${width}.png`),
          })
        }
      }
    }

    expect(pageErrors).toEqual([])
  })

  test('ElResourceListItem renders conditional badge slot added after initial mount (#1127)', async ({
    page,
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto(
      '/?visual=narrow-layout-regressions&fixture=resource-list&theme=light',
      { waitUntil: 'domcontentloaded' },
    )
    const section = page.getByTestId('resource-list-regression')
    await expect(section).toBeVisible()

    const dynamicItem = page.getByTestId('resource-list-dynamic')
    const initialItem = page.getByTestId('resource-list-initial')

    await expect(dynamicItem.locator('.el-resource-list-item__title')).toHaveText(
      'Current device',
    )
    await expect(
      dynamicItem.locator('.el-resource-list-item__badge'),
    ).toHaveCount(0)
    await expect(
      initialItem.locator('.el-resource-list-item__badge'),
    ).toHaveText('Current device')

    await page.getByTestId('toggle-resource-badge').click()

    await expect(dynamicItem.locator('.el-resource-list-item__title')).toHaveText(
      'Named device',
    )
    await expect(
      dynamicItem.locator('.el-resource-list-item__badge'),
    ).toHaveText('Current device')

    await page.getByTestId('toggle-resource-badge').click()

    await expect(dynamicItem.locator('.el-resource-list-item__title')).toHaveText(
      'Current device',
    )
    await expect(
      dynamicItem.locator('.el-resource-list-item__badge'),
    ).toHaveCount(0)

    expect(pageErrors).toEqual([])
  })
})
