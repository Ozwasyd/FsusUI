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

test('Pagination converges in stable semantic zones without page overflow', async ({
  page,
}) => {
  await openDataSection(page)
  const pagination = page.locator('.el-pagination--responsive-auto')

  for (const width of [320, 360, 375, 560, 768, 1440]) {
    await page.setViewportSize({ width, height: 1300 })
    await settleResponsiveLayout(page)
    await expect(pagination).toBeVisible()
    const paginationBox = await pagination.boundingBox()
    const availableWidth = paginationBox?.width ?? 0

    const prev = pagination.locator('.btn-prev')
    const next = pagination.locator('.btn-next')
    for (const action of [prev, next]) {
      const box = await action.boundingBox()
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(40)
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40)
    }

    if (availableWidth < 360) {
      await expect(
        pagination.locator('.el-pagination__compact-indicator'),
      ).toBeVisible()
      await expect(
        pagination.locator('.el-pagination__compact-pager'),
      ).toBeHidden()
      await expect(
        pagination.locator('.el-pagination__information'),
      ).toBeHidden()
    } else if (availableWidth < 560) {
      await expect(
        pagination.locator('.el-pagination__compact-pager'),
      ).toBeVisible()
      await expect(
        pagination.locator('.el-pagination__full-pager'),
      ).toBeHidden()
      const navigationBox = await pagination
        .locator('.el-pagination__navigation')
        .boundingBox()
      const informationBox = await pagination
        .locator('.el-pagination__information')
        .boundingBox()
      expect(informationBox?.y ?? 0).toBeGreaterThanOrEqual(
        (navigationBox?.y ?? 0) + (navigationBox?.height ?? 0),
      )
    } else if (availableWidth < 768) {
      await expect(
        pagination.locator('.el-pagination__full-pager'),
      ).toBeVisible()
      await expect(pagination.locator('.el-pagination__total')).toBeVisible()
      await expect(pagination.locator('.el-pagination__jump')).toBeHidden()
    } else {
      await expect(
        pagination.locator('.el-pagination__full-pager'),
      ).toBeVisible()
      await expect(pagination.locator('.el-pagination__jump')).toBeVisible()
    }

    const pageOverflow = await page.evaluate(
      () =>
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ) - document.documentElement.clientWidth,
    )
    expect(pageOverflow).toBeLessThanOrEqual(1)
  }

  await page.setViewportSize({ width: 720, height: 1300 })
  await page.evaluate(() => {
    document.body.style.zoom = '2'
  })
  await settleResponsiveLayout(page)
  await expect(
    pagination.locator('.el-pagination__compact-indicator'),
  ).toBeVisible()
  const zoomOverflow = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) - document.documentElement.clientWidth,
  )
  expect(zoomOverflow).toBeLessThanOrEqual(1)
})

test('Calendar keeps title, navigation, and date grid aligned without collisions', async ({
  page,
}) => {
  await openDataSection(page)
  const calendar = page.locator('.el-calendar').first()

  for (const width of [320, 375, 390, 560, 768, 1440]) {
    await page.setViewportSize({ width, height: 1400 })
    await settleResponsiveLayout(page)
    const calendarBox = await calendar.boundingBox()
    const availableWidth = calendarBox?.width ?? 0
    const header = calendar.locator('.el-calendar__header')
    const title = calendar.locator('.el-calendar__title')
    const actions = calendar.locator('.el-calendar__button-group')

    for (const button of await actions.locator('button').all()) {
      const box = await button.boundingBox()
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(40)
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(40)
    }

    if (availableWidth < 560) {
      const titleBox = await title.boundingBox()
      const actionsBox = await actions.boundingBox()
      expect(actionsBox?.y ?? 0).toBeGreaterThanOrEqual(
        (titleBox?.y ?? 0) + (titleBox?.height ?? 0) + 7,
      )
      await expect(
        actions.locator('.el-calendar__mobile-nav-icon').first(),
      ).toBeVisible()
      await expect(
        actions.locator('.el-calendar__nav-label').first(),
      ).toBeHidden()
      await expect(actions.locator('button').first()).toHaveAttribute(
        'aria-label',
        /.+/,
      )
      await expect(actions.locator('button').first()).toHaveAttribute(
        'title',
        /.+/,
      )
      const firstAction = actions.locator('button').first()
      await firstAction.focus()
      // Mobile-emulation projects expose a touch primary pointer. Move focus
      // with the keyboard before checking :focus-visible so this assertion
      // measures the keyboard contract instead of Playwright's programmatic
      // focus heuristic.
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(firstAction).toBeFocused()
      const focusPresentation = await firstAction.evaluate((node) => {
        const style = getComputedStyle(node)
        return {
          outlineStyle: style.outlineStyle,
          boxShadow: style.boxShadow,
        }
      })
      expect(
        focusPresentation.outlineStyle !== 'none' ||
          focusPresentation.boxShadow !== 'none',
      ).toBe(true)
    } else {
      await expect(
        actions.locator('.el-calendar__nav-label').first(),
      ).toBeVisible()
    }

    const headerBox = await header.boundingBox()
    const bodyBox = await calendar.locator('.el-calendar__body').boundingBox()
    const titleBox = await title.boundingBox()
    const tableBox = await calendar.locator('.el-calendar-table').boundingBox()
    expect(
      Math.abs((titleBox?.x ?? 0) - (tableBox?.x ?? 0)),
    ).toBeLessThanOrEqual(1)
    expect(headerBox?.width ?? 0).toBe(bodyBox?.width ?? -1)

    const firstDay = calendar.locator('.el-calendar-day').first()
    const dayBox = await firstDay.boundingBox()
    expect(dayBox?.height ?? 0).toBeGreaterThanOrEqual(40)

    const pageOverflow = await page.evaluate(
      () =>
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ) - document.documentElement.clientWidth,
    )
    expect(pageOverflow).toBeLessThanOrEqual(1)
  }

  await page.setViewportSize({ width: 720, height: 1400 })
  await page.evaluate(() => {
    document.body.style.zoom = '2'
  })
  await settleResponsiveLayout(page)
  const zoomTitleBox = await calendar
    .locator('.el-calendar__title')
    .boundingBox()
  const zoomActionsBox = await calendar
    .locator('.el-calendar__button-group')
    .boundingBox()
  expect(zoomActionsBox?.y ?? 0).toBeGreaterThanOrEqual(
    (zoomTitleBox?.y ?? 0) + (zoomTitleBox?.height ?? 0) + 7,
  )
  const zoomOverflow = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) - document.documentElement.clientWidth,
  )
  expect(zoomOverflow).toBeLessThanOrEqual(1)
})
