import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const openDataSection = async (page: Page) => {
  await page.goto('/?visual=data', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="section-data"]')).toBeVisible()
}

test('Descriptions auto projection preserves complete values at constrained widths and zoom', async ({
  page,
}) => {
  await openDataSection(page)

  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1100 })
    const descriptions = page.locator('.el-descriptions').first()
    await expect(descriptions).toBeVisible()
    const pageOverflow = await page.evaluate(
      () =>
        Math.max(
          document.documentElement.scrollWidth,
          document.body.scrollWidth,
        ) - document.documentElement.clientWidth,
    )
    expect(pageOverflow).toBeLessThanOrEqual(1)

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
  const zoomedDescriptions = page.locator('.el-descriptions').first()
  await expect(zoomedDescriptions.locator('dl')).toBeVisible()
  const zoomOverflow = await page.evaluate(
    () =>
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) - document.documentElement.clientWidth,
  )
  expect(zoomOverflow).toBeLessThanOrEqual(1)
})
