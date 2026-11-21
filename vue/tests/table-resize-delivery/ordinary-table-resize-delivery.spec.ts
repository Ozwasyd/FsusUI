import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

interface Delivery {
  width: number
  height: number
}

declare global {
  interface Window {
    rawErrors: { message: string }[]
    tableDeliveries: { root: Delivery[]; body: Delivery[] }
  }
}

const threeFrames = async (page: Page) => {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      ),
  )
}

test('ordinary public Table delivers final geometry after six viewport changes', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.addInitScript(() => {
    window.rawErrors = []
    window.addEventListener('error', (event) => {
      window.rawErrors.push({ message: event.message })
    })
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('tbody tr')).toHaveCount(50)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await page.evaluate(() => {
    window.tableDeliveries = { root: [], body: [] }
    for (const [key, selector] of [
      ['root', '.el-table'],
      ['body', '.el-table__body-wrapper'],
    ] as const) {
      // Additional read-only native observers verify delivery; Table's own
      // observers, callbacks and the browser implementation remain intact.
      new ResizeObserver(([entry]) => {
        window.tableDeliveries[key].push({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }).observe(document.querySelector(selector)!)
    }
  })
  await threeFrames(page)
  const geometry: { width: number; height: number; columns: number[] }[] = []
  for (let i = 0; i < 6; i++) {
    const previous = await page.evaluate(() => ({
      root: window.tableDeliveries.root.length,
      body: window.tableDeliveries.body.length,
    }))
    await page.setViewportSize(
      i % 2 ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    )
    await threeFrames(page)
    const snapshot = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('.el-table')!
      const body = document.querySelector<HTMLElement>(
        '.el-table__body-wrapper',
      )!
      const columns = [...document.querySelectorAll('.el-table__body col')].map(
        (col) => Number(col.getAttribute('width')),
      )
      return {
        width: root.clientWidth,
        height: root.clientHeight,
        columns,
        bodyWidth: body.clientWidth,
        bodyHeight: body.clientHeight,
        rootCount: window.tableDeliveries.root.length,
        bodyCount: window.tableDeliveries.body.length,
        rootDelivery: window.tableDeliveries.root.at(-1)!,
        bodyDelivery: window.tableDeliveries.body.at(-1)!,
      }
    })
    expect(snapshot.width).toBe(i % 2 ? 912 : 342)
    expect(snapshot.columns).toEqual(
      i % 2 ? [228, 228, 228, 228] : [87, 85, 85, 85],
    )
    expect(snapshot.columns.reduce((sum, width) => sum + width, 0)).toBe(
      snapshot.width,
    )
    expect(snapshot.height).toBeGreaterThan(0)
    expect(snapshot.rootCount).toBeGreaterThan(previous.root)
    expect(snapshot.bodyCount).toBeGreaterThan(previous.body)
    expect(snapshot.rootDelivery.width).toBe(snapshot.width)
    expect(snapshot.rootDelivery.height).toBe(snapshot.height)
    expect(snapshot.bodyDelivery.width).toBe(snapshot.bodyWidth)
    expect(snapshot.bodyDelivery.height).toBe(snapshot.bodyHeight)
    geometry.push({
      width: snapshot.width,
      height: snapshot.height,
      columns: snapshot.columns,
    })
    expect(await page.evaluate(() => window.rawErrors)).toEqual([])
    await expect(page.locator('tbody tr')).toHaveCount(50)
  }
  expect(geometry[0].height).toBeGreaterThan(geometry[1].height)
  expect(geometry[2]).toEqual(geometry[0])
  expect(geometry[4]).toEqual(geometry[0])
  expect(geometry[3]).toEqual(geometry[1])
  expect(geometry[5]).toEqual(geometry[1])
  expect(consoleErrors).toEqual([])
  await test.info().attach('six-resize-geometry', {
    body: JSON.stringify(geometry, null, 2),
    contentType: 'application/json',
  })
  await page.screenshot({
    path: `${test.info().outputDir}/ordinary-table-desktop.png`,
  })
})

for (const mode of ['fit-false', 'fixed', 'flexible', 'auto']) {
  test(`ordinary Table ${mode} preserves resize, geometry and remount updates`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.rawErrors = []
      window.addEventListener('error', (event) => {
        window.rawErrors.push({ message: event.message })
      })
    })
    await page.goto(`/modes.html?mode=${mode}`, { waitUntil: 'networkidle' })
    await expect(page.locator('tbody tr')).toHaveCount(50)
    for (let i = 0; i < 6; i++) {
      await page.setViewportSize(
        i % 2 ? { width: 1440, height: 900 } : { width: 390, height: 844 },
      )
      await threeFrames(page)
      const snapshot = await page.locator('.el-table').evaluate((root) => ({
        width: root.clientWidth,
        height: root.clientHeight,
        columns: [...root.querySelectorAll('colgroup:first-child col')]
          .slice(0, 4)
          .map((col) => Number(col.getAttribute('width'))),
        renderedColumns: [...root.querySelectorAll('colgroup:first-child col')]
          .slice(0, 4)
          .map((col) => col.getBoundingClientRect().width),
        scrollable: root.classList.contains('el-table--scrollable-x'),
        minWidth: (root.parentElement as HTMLElement).style.minWidth,
      }))
      expect(snapshot.width).toBe(i % 2 ? 912 : 342)
      if (mode === 'auto') {
        expect(snapshot.renderedColumns).toHaveLength(4)
        expect(
          snapshot.renderedColumns.reduce((sum, width) => sum + width, 0),
        ).toBe(i % 2 ? 912 : 400)
        expect(snapshot.renderedColumns.every((width) => width > 0)).toBe(true)
      } else {
        expect(snapshot.columns).toEqual(
          mode === 'fit-false' || i % 2 === 0
            ? [120, 80, 80, 120]
            : [120, 336, 336, 120],
        )
      }
      expect(snapshot.scrollable).toBe(i % 2 === 0)
      if (mode !== 'auto') expect(snapshot.height).toBe(300)
      if (mode === 'flexible') expect(snapshot.minWidth).toBe('0px')
      expect(await page.evaluate(() => window.rawErrors)).toEqual([])
    }
    if (mode !== 'auto') {
      await page
        .getByRole('button', { name: 'Resize height', exact: true })
        .click()
      await threeFrames(page)
      expect(
        await page.locator('.el-table').evaluate((root) => root.clientHeight),
      ).toBe(400)
    }
    await page
      .getByRole('button', { name: 'Resize container', exact: true })
      .click()
    await threeFrames(page)
    expect(
      await page.locator('.el-table').evaluate((root) => root.clientWidth),
    ).toBe(552)
    if (mode === 'fixed') {
      await page.setViewportSize({ width: 390, height: 844 })
      await threeFrames(page)
      await page.locator('.el-scrollbar__wrap').evaluate((wrap) => {
        wrap.scrollLeft = wrap.scrollWidth
      })
      await threeFrames(page)
      const fixedOffsets = async () => {
        const bounds = await page
          .locator('.el-table__body tbody tr')
          .first()
          .evaluate((row) => {
            const cells = row.querySelectorAll('td')
            const region = row
              .closest('.el-scrollbar__wrap')!
              .getBoundingClientRect()
            return {
              regionLeft: region.left,
              regionRight: region.right,
              left: cells[0].getBoundingClientRect().left,
              right: cells[3].getBoundingClientRect().right,
            }
          })
        return Math.max(
          Math.abs(bounds.left - bounds.regionLeft),
          Math.abs(bounds.right - bounds.regionRight),
        )
      }
      await expect.poll(fixedOffsets).toBeLessThanOrEqual(1)
    }
    await page
      .getByRole('button', { name: 'Toggle table', exact: true })
      .click()
    await expect(page.locator('.el-table')).toHaveCount(0)
    await page.setViewportSize({ width: 1440, height: 900 })
    await threeFrames(page)
    await page
      .getByRole('button', { name: 'Toggle table', exact: true })
      .click()
    await expect(page.locator('tbody tr')).toHaveCount(50)
    await threeFrames(page)
    expect(
      await page.locator('.el-table').evaluate((root) => root.clientWidth),
    ).toBe(552)
    expect(await page.evaluate(() => window.rawErrors)).toEqual([])
  })
}
