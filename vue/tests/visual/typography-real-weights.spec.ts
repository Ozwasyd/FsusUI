import { expect, test } from '@playwright/test'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'

test('CJK and Latin use real bundled weights in light and dark modes', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.goto(buildVisualUrl('basic', testInfo.project.name))
  const fixture = page.getByTestId('typography-real-weight-fixture')

  await expect(fixture).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await expect(fixture.locator('span')).toHaveCount(3)
  await expect
    .poll(() =>
      page.evaluate(() => ({
        synthesis: getComputedStyle(document.documentElement).fontSynthesis,
        google: [400, 500, 700].every((weight) =>
          document.fonts.check(`${weight} 14px "Google Sans"`, 'Latin'),
        ),
        noto: [400, 500, 700].every((weight) =>
          document.fonts.check(`${weight} 14px "Noto Sans SC"`, '中文'),
        ),
      })),
    )
    .toEqual({ synthesis: 'none', google: true, noto: true })

  const weightMetrics = await fixture.evaluate((el) =>
    [...el.querySelectorAll('span')].map((span) => {
      const style = getComputedStyle(span)
      const rect = span.getBoundingClientRect()
      return {
        fontWeight: style.fontWeight,
        width: rect.width,
        height: rect.height,
      }
    }),
  )
  expect(weightMetrics.map((m) => m.fontWeight)).toEqual(['400', '500', '700'])
  for (const metric of weightMetrics) {
    expect(metric.width).toBeGreaterThan(80)
    expect(metric.height).toBeGreaterThan(12)
  }

  await testInfo.attach(`typography-real-weights-${theme}`, {
    body: await fixture.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})
