import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const openDataSection = async (page: Page) => {
  await page.goto('/?visual=data', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="section-data"]')).toBeVisible()
}

const settleResponsiveLayout = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

test('Descriptions auto projection preserves complete values at constrained widths and zoom', async ({
  page,
}) => {
  await openDataSection(page)

  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 })
    await settleResponsiveLayout(page)
    const descriptions = page.locator('.el-descriptions').first()
    await expect(descriptions).toBeVisible()
    const descriptionsBounds = await descriptions.boundingBox()
    expect(descriptionsBounds?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect(
      (descriptionsBounds?.x ?? 0) + (descriptionsBounds?.width ?? 0),
    ).toBeLessThanOrEqual(width)

    if (width < 560) {
      const values = descriptions.locator('dd.el-descriptions__stack-value')
      await expect(values).toHaveCount(7)
      await expect(values.nth(4)).toContainText(
        '江苏省苏州市吴中区吴中大道 1188 号',
      )
      await expect(values.nth(5)).toContainText(
        'https://example.com/authors/青砚/research-notes-and-publications',
      )
      await expect(descriptions.locator('table')).toBeHidden()
      const stackItems = descriptions.locator('.el-descriptions__stack-item')
      const radii = await stackItems.evaluateAll((items) =>
        items.map((item) => getComputedStyle(item).borderRadius),
      )
      expect(radii.every((radius) => radius === '0px')).toBe(true)
    } else {
      await expect(descriptions.locator('table')).toBeVisible()
    }
  }

  await page.setViewportSize({ width: 640, height: 1100 })
  await page.evaluate(() => {
    document.body.style.zoom = '2'
  })
  await settleResponsiveLayout(page)
  const zoomedDescriptions = page.locator('.el-descriptions').first()
  await expect(zoomedDescriptions.locator('dl')).toBeVisible()
  const zoomGeometry = await zoomedDescriptions.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }))
  expect(zoomGeometry.scrollWidth).toBeLessThanOrEqual(
    zoomGeometry.clientWidth + 1,
  )
})

test('Table priority projection preserves every column and explicit scroll is keyboard discoverable', async ({
  page,
}) => {
  await openDataSection(page)

  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1300 })
    await settleResponsiveLayout(page)
    const table = page.locator('.el-table--responsive-auto').first()
    await expect(table).toBeVisible()

    if (width < 640) {
      await expect(
        table.locator('th[data-responsive-priority="secondary"]').first(),
      ).toBeHidden()
      await expect(
        table.locator('th[data-responsive-priority="detail"]').first(),
      ).toBeHidden()
      const toggle = table.locator('.el-table__responsive-toggle').first()
      const toggleBox = await toggle.boundingBox()
      expect(toggleBox?.width ?? 0).toBeGreaterThanOrEqual(40)
      expect(toggleBox?.height ?? 0).toBeGreaterThanOrEqual(40)
      if ((await toggle.getAttribute('aria-expanded')) === 'false') {
        await toggle.click()
      }
      const detailRow = table
        .locator('.el-table__responsive-detail-row')
        .first()
      await expect(detailRow).toHaveAttribute('aria-hidden', 'false')
      await expect(
        detailRow.locator('.el-table__responsive-detail-field'),
      ).toHaveCount(7)
      await expect(detailRow).toContainText(
        'research-note-2016-05-03-long-identifier',
      )

      const operation = table.locator('button', { hasText: '打开' }).first()
      const operationBox = await operation.boundingBox()
      expect(operationBox?.width ?? 0).toBeGreaterThanOrEqual(40)
      expect(operationBox?.height ?? 0).toBeGreaterThanOrEqual(40)
    } else {
      await expect(
        table.locator('th[data-responsive-priority="secondary"]').first(),
      ).toBeVisible()
      await expect(
        table.locator('th[data-responsive-priority="detail"]').first(),
      ).toBeVisible()
    }

    const tableBounds = await table.boundingBox()
    expect(tableBounds?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect(
      (tableBounds?.x ?? 0) + (tableBounds?.width ?? 0),
    ).toBeLessThanOrEqual(width)
  }

  await page.setViewportSize({ width: 375, height: 1300 })
  await settleResponsiveLayout(page)
  const scrollTable = page.locator(
    '[data-testid="table-scroll-fixture"] .el-table',
  )
  const scrollRegion = scrollTable.locator('.el-table__body-wrapper')
  const scrollWrap = scrollTable.locator('.el-scrollbar__wrap')
  const geometry = await scrollWrap.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }))
  expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth)
  await scrollRegion.focus()
  await expect(scrollRegion).toBeFocused()
  await scrollRegion.press('ArrowRight')
  await expect
    .poll(() => scrollWrap.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0)
  await expect(scrollTable.locator('.el-table__scroll-affordance')).toHaveCSS(
    'opacity',
    '0',
  )
})
