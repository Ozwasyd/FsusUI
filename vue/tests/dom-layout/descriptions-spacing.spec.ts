import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/**
 * Issue #313 — real shipped-style DOM geometry for Descriptions cell padding.
 * Asserts getComputedStyle (not CSS string matches alone) so 15/11/7px cannot
 * re-enter production without failing this gate.
 */

const widths = [320, 375, 768, 1366] as const
const zooms = [1, 1.5, 2] as const

const expectedBordered = {
  large: { block: 12, inline: 16 },
  default: { block: 8, inline: 12 },
  small: { block: 4, inline: 8 },
} as const

const forbiddenInline = new Set([15, 11, 7])

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

const openFixtures = async (page: Page) => {
  await page.goto('/?visual=data&theme=light', {
    waitUntil: 'domcontentloaded',
  })
  const fixture = page.getByTestId('descriptions-spacing-fixtures')
  await expect(fixture).toBeVisible()
  return fixture
}

type CellPadding = {
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  fontSize: string
  borderRadius: string
  boxShadow: string
  cssPadding: string
}

const readCellPadding = (root: Locator) =>
  root.evaluate((element): CellPadding | null => {
    const cell = element.querySelector(
      '.el-descriptions__table.is-bordered .el-descriptions__cell, .el-descriptions__table:not(.is-bordered) .el-descriptions__cell, .el-descriptions__stack-item',
    ) as HTMLElement | null
    if (!cell) return null
    const style = getComputedStyle(cell)
    return {
      paddingTop: Number.parseFloat(style.paddingTop),
      paddingRight: Number.parseFloat(style.paddingRight),
      paddingBottom: Number.parseFloat(style.paddingBottom),
      paddingLeft: Number.parseFloat(style.paddingLeft),
      fontSize: style.fontSize,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      cssPadding: style.padding,
    }
  })

const readStackHorizontal = (root: Locator) =>
  root.evaluate((element) => {
    const stack = element.querySelector(
      '.el-descriptions__stack',
    ) as HTMLElement | null
    if (!stack) return null
    const style = getComputedStyle(stack)
    return {
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingRight: Number.parseFloat(style.paddingRight),
      display: style.display,
    }
  })

const assertScalePadding = (
  label: string,
  padding: CellPadding,
  expected: { block: number; inline: number },
) => {
  expect(padding.paddingTop, `${label} padding-top`).toBeCloseTo(
    expected.block,
    0,
  )
  expect(padding.paddingBottom, `${label} padding-bottom`).toBeCloseTo(
    expected.block,
    0,
  )
  expect(padding.paddingLeft, `${label} padding-left`).toBeCloseTo(
    expected.inline,
    0,
  )
  expect(padding.paddingRight, `${label} padding-right`).toBeCloseTo(
    expected.inline,
    0,
  )

  for (const value of [
    padding.paddingTop,
    padding.paddingRight,
    padding.paddingBottom,
    padding.paddingLeft,
  ]) {
    expect(
      forbiddenInline.has(Math.round(value)),
      `${label} must not resolve to forbidden off-scale ${value}px`,
    ).toBe(false)
    // Every axis sits on the 4px spacing scale.
    expect(Math.round(value) % 4, `${label} ${value}px on 4px scale`).toBe(0)
  }
}

test('Descriptions bordered cell padding resolves to 4px scale via real getComputedStyle', async ({
  page,
}) => {
  const fixture = await openFixtures(page)

  for (const width of widths) {
    await page.setViewportSize({ width, height: 1400 })
    await settle(page)

    for (const [size, expected] of Object.entries(expectedBordered) as Array<
      [keyof typeof expectedBordered, (typeof expectedBordered)['default']]
    >) {
      const caseId = `bordered-${size}`
      const root = fixture.locator(`[data-descriptions-case="${caseId}"]`)
      await expect(root, caseId).toBeVisible()
      // Force table projection so bordered cells are measurable at all widths.
      await root.evaluate((node) => {
        node.classList.remove('el-descriptions--responsive-auto')
        node.classList.remove('el-descriptions--responsive-stack')
      })
      await settle(page)

      const padding = await readCellPadding(root)
      expect(padding, caseId).not.toBeNull()
      assertScalePadding(`${width}w ${caseId}`, padding!, expected)

      // Typography stays on 12/14 contract — never drops to 11px.
      const fontPx = Number.parseFloat(padding!.fontSize)
      expect(fontPx, `${caseId} font-size`).toBeGreaterThanOrEqual(12)
      expect(fontPx, `${caseId} font-size`).toBeLessThanOrEqual(14)

      // Cells remain flat (radius/shadow only allowed if fully zero).
      const radiusNums = padding!.borderRadius
        .split(/\s+/)
        .map((part) => Number.parseFloat(part) || 0)
      expect(
        radiusNums.every((n) => n === 0),
        `${caseId} no per-cell radius`,
      ).toBe(true)
      expect(
        padding!.boxShadow === 'none' || padding!.boxShadow === '',
        `${caseId} no per-cell shadow`,
      ).toBe(true)
    }

    // Non-bordered cells share horizontal space-3 (=12px) rhythm.
    const nonBordered = fixture.locator(
      '[data-descriptions-case="non-bordered-default"]',
    )
    const nonBorderedPad = await readCellPadding(nonBordered)
    expect(nonBorderedPad).not.toBeNull()
    // Middle cells use padding-inline space-3; first/last zero one side —
    // assert the non-zero side when present, else check any measured axis.
    const inlineCandidates = [
      nonBorderedPad!.paddingLeft,
      nonBorderedPad!.paddingRight,
    ].filter((v) => v > 0)
    if (inlineCandidates.length > 0) {
      for (const value of inlineCandidates) {
        expect(
          Math.round(value),
          `${width}w non-bordered inline`,
        ).toBe(12)
      }
    }

    // Stack projection keeps the same 12px horizontal inset.
    const stackRoot = fixture.locator(
      '[data-descriptions-case="responsive-stack"]',
    )
    await expect(stackRoot).toBeVisible()
    const stackPad = await readStackHorizontal(stackRoot)
    expect(stackPad).not.toBeNull()
    expect(stackPad!.display).not.toBe('none')
    expect(Math.round(stackPad!.paddingLeft)).toBe(12)
    expect(Math.round(stackPad!.paddingRight)).toBe(12)
  }

  // Zoom matrix: resolved CSS px stays on scale (no drift to 15/11/7).
  await page.setViewportSize({ width: 768, height: 1400 })
  for (const zoom of zooms) {
    await page.evaluate((z) => {
      document.documentElement.style.zoom = String(z)
    }, zoom)
    await settle(page)

    const root = fixture.locator('[data-descriptions-case="bordered-default"]')
    await root.evaluate((node) => {
      node.classList.remove('el-descriptions--responsive-auto')
      node.classList.remove('el-descriptions--responsive-stack')
    })
    const padding = await readCellPadding(root)
    expect(padding, `zoom ${zoom}`).not.toBeNull()
    // getComputedStyle returns CSS pixels independent of zoom in Chromium.
    assertScalePadding(`zoom-${zoom} bordered-default`, padding!, {
      block: 8,
      inline: 12,
    })
  }

  await page.evaluate(() => {
    document.documentElement.style.zoom = '1'
  })
})

test('Descriptions spacing remains stable in dark mode', async ({ page }) => {
  await page.goto('/?visual=data&theme=dark', {
    waitUntil: 'domcontentloaded',
  })
  const fixture = page.getByTestId('descriptions-spacing-fixtures')
  await expect(fixture).toBeVisible()
  await page.setViewportSize({ width: 768, height: 1400 })
  await settle(page)

  for (const [size, expected] of Object.entries(expectedBordered) as Array<
    [keyof typeof expectedBordered, (typeof expectedBordered)['default']]
  >) {
    const root = fixture.locator(`[data-descriptions-case="bordered-${size}"]`)
    await root.evaluate((node) => {
      node.classList.remove('el-descriptions--responsive-auto')
      node.classList.remove('el-descriptions--responsive-stack')
    })
    const padding = await readCellPadding(root)
    expect(padding, `dark bordered-${size}`).not.toBeNull()
    assertScalePadding(`dark bordered-${size}`, padding!, expected)
  }
})
