import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'

const themes = ['light', 'dark'] as const
const languages = ['en', 'zh-CN'] as const
const viewports = [320, 375, 768, 1024, 1440] as const

type Rect = {
  height: number
  left: number
  top: number
  width: number
}

const readRect = (locator: Locator) =>
  locator.evaluate((element): Rect => {
    const rect = element.getBoundingClientRect()
    return {
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width,
    }
  })

const expectClose = (actual: number, expected: number, tolerance = 1) => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance)
}

const setTheme = async (page: Page, theme: (typeof themes)[number]) => {
  await page.evaluate((value) => {
    const root = document.documentElement
    root.classList.toggle('dark', value === 'dark')
    root.classList.toggle('light', value === 'light')
    root.dataset.themeMode = value
    root.dataset.themeResolved = value
    root.style.colorScheme = value
  }, theme)
}

const expectNoPageOverflow = async (page: Page) => {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
  }))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
}

const expectNoFixtureOverflow = async (fixture: Locator) => {
  const geometry = await fixture.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
}

const selectLanguage = async (
  fixture: Locator,
  language: (typeof languages)[number],
) => {
  await fixture.getByTestId(`form-language-${language}`).click()
  await expect(fixture).toHaveAttribute('data-form-language', language)
}

const assertGeometry = async (
  page: Page,
  fixture: Locator,
  viewport: number,
  scope: 'fixture' | 'page' = 'page',
) => {
  if (scope === 'page') {
    await expectNoPageOverflow(page)
  } else {
    await expectNoFixtureOverflow(fixture)
  }

  const form = fixture.locator('.task-form-fixture')
  const formRect = await readRect(form)
  expect(formRect.width).toBeLessThanOrEqual(640.5)

  const fullWidthControls = fixture.locator(
    '[data-form-fixture="full-width"] :is(.el-input, .el-select, .el-textarea)',
  )
  const fullWidthRects = await fullWidthControls.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, width: rect.width }
    }),
  )
  expect(fullWidthRects.length).toBeGreaterThanOrEqual(3)
  for (const rect of fullWidthRects) {
    expectClose(rect.left, fullWidthRects[0]!.left)
    expectClose(rect.width, fullWidthRects[0]!.width)
  }

  const baseline = fullWidthRects[0]!.left
  const uploadRect = await readRect(
    fixture.locator('[data-form-fixture="upload"] .el-upload').first(),
  )
  const numberRect = await readRect(
    fixture.locator('[data-form-fixture="short-values"] .el-input-number'),
  )
  const dateRect = await readRect(
    fixture
      .locator('[data-form-fixture="short-values"] .el-date-editor')
      .first(),
  )
  const selectRect = await readRect(
    fixture.locator('[data-form-fixture="short-values"] .el-select'),
  )
  const pairFirstRect = await readRect(
    fixture.locator('[data-form-fixture="inline-pair"] .el-form-item').first(),
  )
  for (const rect of [uploadRect, numberRect, selectRect, pairFirstRect]) {
    expectClose(rect.left, baseline)
  }

  if (viewport < 480) {
    for (const rect of [uploadRect, numberRect, dateRect, selectRect]) {
      expectClose(rect.left, baseline)
      expectClose(rect.width, fullWidthRects[0]!.width)
    }
  } else {
    expect(dateRect.left).toBeGreaterThan(baseline)
    expect(numberRect.width).toBeGreaterThanOrEqual(160)
    expect(numberRect.width).toBeLessThanOrEqual(200)
    for (const rect of [dateRect, selectRect]) {
      expect(rect.width).toBeGreaterThanOrEqual(220)
      expect(rect.width).toBeLessThanOrEqual(260)
    }
  }

  const pair = fixture.locator('[data-form-fixture="inline-pair"]')
  const before = await pair.locator('.el-form-item').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, width: rect.width }
    }),
  )
  await fixture.getByTestId('form-validation-toggle').click()
  const after = await pair.locator('.el-form-item').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { left: rect.left, width: rect.width }
    }),
  )
  expect(before).toHaveLength(2)
  expect(after).toHaveLength(2)
  before.forEach((rect, index) => {
    expectClose(after[index]!.left, rect.left)
    expectClose(after[index]!.width, rect.width)
  })

  if (viewport < 480) {
    expectClose(after[0]!.left, after[1]!.left)
    expectClose(after[0]!.width, after[1]!.width)
  } else {
    expect(after[0]!.left).toBeLessThan(after[1]!.left)
    expectClose(after[0]!.width, after[1]!.width)
  }

  await expect(
    fixture.locator('[data-form-state="empty"] input').first(),
  ).toHaveValue('')
  await expect(
    fixture.locator('[data-form-fixture="states"] input:disabled').first(),
  ).toBeDisabled()
  await expect(fixture.locator('[data-form-state="loading"]')).toHaveClass(
    /is-loading/,
  )
  await expect(fixture.locator('.task-copy-stress--long-label')).toBeVisible()
  await expect(fixture.locator('.task-copy-stress--long-helper')).toBeVisible()
  await expect(fixture.locator('.task-copy-stress--error')).toBeVisible()
}

test('production task form covers locale, state, viewport, theme and zoom geometry', async ({
  page,
}, testInfo: TestInfo) => {
  await page.goto('/?visual=form&theme=light', {
    waitUntil: 'domcontentloaded',
  })
  const fixture = page.getByTestId('production-form-fixtures')
  await expect(fixture).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)

  for (const theme of themes) {
    await setTheme(page, theme)
    for (const language of languages) {
      await selectLanguage(fixture, language)
      const text = await fixture.innerText()
      expect(text).toMatch(
        language === 'zh-CN' ? /发布|审批|读者/ : /Publish|approval|readers/i,
      )

      for (const viewport of viewports) {
        await test.step(`${theme}/${language}/${viewport}px`, async () => {
          await page.setViewportSize({ width: viewport, height: 1800 })
          await page.evaluate(() => {
            document.documentElement.style.zoom = '1'
          })
          await assertGeometry(page, fixture, viewport)

          if (viewport === 320 || viewport === 1440) {
            await testInfo.attach(`form-${language}-${theme}-${viewport}.png`, {
              body: await fixture.screenshot({ animations: 'disabled' }),
              contentType: 'image/png',
            })
          }
        })
      }

      await test.step(`${theme}/${language}/320px@150%`, async () => {
        await page.setViewportSize({ width: 479, height: 2400 })
        await page.evaluate(() => {
          document.documentElement.style.zoom = '1.5'
        })
        await assertGeometry(page, fixture, 320, 'fixture')
        await testInfo.attach(`form-${language}-${theme}-320-zoom-150.png`, {
          body: await fixture.screenshot({ animations: 'disabled' }),
          contentType: 'image/png',
        })
      })
    }
  }
})
