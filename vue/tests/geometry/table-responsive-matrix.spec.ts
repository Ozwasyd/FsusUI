import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const columnCounts = [3, 8, 15] as const
const viewports = [320, 375, 768, 1440] as const
const themes = ['light', 'dark'] as const

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

const openFixture = async (
  page: Page,
  theme: (typeof themes)[number],
  viewport: (typeof viewports)[number],
) => {
  await page.setViewportSize({ width: viewport, height: 1800 })
  await page.goto(`/?visual=data&theme=${theme}&tableMatrix=1`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.getByTestId('table-responsive-matrix')).toBeVisible()
  await settle(page)
}

const expectNoPageOverflow = async (page: Page) => {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
  }))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
}

const expectNoIntersection = async (left: Locator, right: Locator) => {
  const [leftBox, rightBox] = await Promise.all([
    left.boundingBox(),
    right.boundingBox(),
  ])
  expect(leftBox).not.toBeNull()
  expect(rightBox).not.toBeNull()
  const width = Math.max(
    0,
    Math.min(leftBox!.x + leftBox!.width, rightBox!.x + rightBox!.width) -
      Math.max(leftBox!.x, rightBox!.x),
  )
  const height = Math.max(
    0,
    Math.min(leftBox!.y + leftBox!.height, rightBox!.y + rightBox!.height) -
      Math.max(leftBox!.y, rightBox!.y),
  )
  expect(width * height).toBeLessThanOrEqual(1)
}

for (const theme of themes) {
  for (const viewport of viewports) {
    test(`${theme} ${viewport}px preserves 3/8/15-column table data and fixed controls`, async ({
      page,
    }) => {
      await openFixture(page, theme, viewport)

      for (const columnCount of columnCounts) {
        const table = page.getByTestId(`table-matrix-${columnCount}`)
        await expect(table).toBeVisible()
        await expect(
          table.locator(
            'td[data-responsive-priority]:not(.el-table-column--selection):not(.matrix-operation-column)',
          ),
        ).toHaveCount(columnCount)

        const selection = table
          .locator('.el-table__body-wrapper td.el-table-column--selection')
          .first()
        const operation = table
          .locator('.el-table__body-wrapper button', { hasText: '打开' })
          .first()
        for (const target of [selection, operation]) {
          const box = await target.boundingBox()
          expect(box?.width ?? 0).toBeGreaterThanOrEqual(40)
          expect(box?.height ?? 0).toBeGreaterThanOrEqual(40)
        }

        if (viewport < 640) {
          const toggle = table.locator('.el-table__responsive-toggle').first()
          await toggle.focus()
          await expect(toggle).toBeFocused()
          await toggle.press('Enter')
          await expect(toggle).toHaveAttribute('aria-expanded', 'true')

          const details = table
            .locator('.el-table__responsive-detail-row')
            .first()
          await expect(details).toHaveAttribute('aria-hidden', 'false')
          await expect(
            details.locator('.el-table__responsive-detail-field'),
          ).toHaveCount(columnCount - 1)
          await expect(details).toContainText(
            '超长中文字段值用于确认移动端不会静默丢失任何业务信息',
          )
          await expect(details).toContainText(
            'latin-value-with-a-deliberately-long-unbroken-identifier',
          )

          const firstPrimary = table
            .locator(
              '.el-table__body-wrapper td[data-responsive-priority="primary"]:not(.el-table-column--selection):not(.matrix-operation-column)',
            )
            .first()
          await expectNoIntersection(selection, firstPrimary)
          await expectNoIntersection(firstPrimary, operation)
        } else {
          await expect(
            table.locator(
              '.el-table__body-wrapper td[data-responsive-priority="detail"]',
            ),
          ).toHaveCount(Math.max(0, columnCount - 3))
        }
      }

      const empty = page.getByTestId('table-matrix-empty')
      await expect(empty.locator('.el-table__empty-text')).toContainText(
        '暂无可展示的数据',
      )
      await expectNoPageOverflow(page)
    })
  }
}

for (const theme of themes) {
  test(`${theme} explicit-scroll matrix exposes overflow and responds to keyboard`, async ({
    page,
  }) => {
    await openFixture(page, theme, 375)
    const table = page.getByTestId('table-matrix-scroll')
    const region = table.locator('.el-table__body-wrapper')
    const wrap = table.locator('.el-scrollbar__wrap')
    const affordance = table.locator('.el-table__scroll-affordance')

    await expect(region).toHaveAttribute('tabindex', '0')
    await expect(region).toHaveAttribute('role', 'region')
    await expect(region).toHaveAttribute('aria-label', '横向浏览十五列数据')
    await expect(affordance).toBeVisible()
    const geometry = await wrap.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }))
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth)

    await region.focus()
    await region.press('ArrowRight')
    await expect
      .poll(() => wrap.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(0)
    await expect(affordance).toHaveCSS('opacity', '0')
    await expectNoPageOverflow(page)
  })
}
