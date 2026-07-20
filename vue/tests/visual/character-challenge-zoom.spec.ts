import { expect, test } from '@playwright/test'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'

test('200% and 400% zoom retain required controls without component overflow', async ({
  page,
}, testInfo) => {
  await page.goto(
    buildVisualUrl('character-challenge-conformance', testInfo.project.name),
    { waitUntil: 'networkidle' },
  )

  for (const zoom of [2, 4]) {
    await page.locator('html').evaluate((element, scale) => {
      element.style.zoom = String(scale)
    }, zoom)

    const ready = page.locator('[data-state="ready"]')
    await expect(ready.getByLabel('Character response')).toBeVisible()
    await expect(
      ready.getByRole('button', { name: 'Submit response' }),
    ).toBeVisible()
    expect(
      await ready.evaluate((node) => node.scrollWidth - node.clientWidth),
    ).toBeLessThanOrEqual(1)
    await testInfo.attach(`character-conformance-zoom-${zoom * 100}`, {
      body: await ready.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
  }
})
