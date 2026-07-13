import { expect, test } from '@playwright/test'

test('CJK and Latin use real bundled weights in light and dark modes', async ({
  page,
}, testInfo) => {
  const theme = testInfo.project.name.includes('dark') ? 'dark' : 'light'
  await page.goto(`/?visual=basic&theme=${theme}`)
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
  await expect(fixture).toHaveScreenshot('typography-real-weights.png')
})
