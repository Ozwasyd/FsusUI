import { chromium, expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'

const geometryPort = process.env.FSUS_GEOMETRY_PORT ?? '5177'
const geometryBaseURL = `http://127.0.0.1:${geometryPort}`

const setTheme = async (page: Page, theme: 'dark' | 'light') => {
  await page.evaluate((value) => {
    const root = document.documentElement
    root.classList.toggle('dark', value === 'dark')
    root.classList.toggle('light', value === 'light')
    root.dataset.themeMode = value
    root.dataset.themeResolved = value
    root.style.colorScheme = value
  }, theme)
}

const open = async (page: Page, visual: string) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`/?visual=${visual}&theme=light`, {
      waitUntil: 'domcontentloaded',
    })
    if (
      await page
        .locator('#app > *')
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      break
    }
    if (attempt === 2) {
      await expect(page.locator('#app > *').first()).toBeVisible()
    }
  }
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
}

const attach = async (
  page: Page,
  testInfo: TestInfo,
  name: string,
  locator?: Locator,
) => {
  await testInfo.attach(`${name}.png`, {
    body: locator
      ? await locator.screenshot({ animations: 'disabled' })
      : await page.screenshot({ animations: 'disabled', fullPage: false }),
    contentType: 'image/png',
  })
}

const expectNoPageOverflow = async (page: Page) => {
  await page.waitForTimeout(120)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
  }))
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
}

test('surface role map has light/dark desktop/mobile rendered evidence', async ({
  browser: _browser,
}, testInfo) => {
  const surfaces = [
    { route: 'feedback', role: 'document' },
    { route: 'data', role: 'data-region' },
    { route: 'navigation', role: 'navigation' },
    { route: 'form', role: 'control-group' },
  ] as const

  for (const surface of surfaces) {
    const routeBrowser = await chromium.launch({
      executablePath: process.env.FSUS_PLAYWRIGHT_EXECUTABLE_PATH,
      headless: true,
    })
    const page = await routeBrowser.newPage({
      baseURL: geometryBaseURL,
      viewport: { width: 1440, height: 1200 },
    })
    try {
      await open(page, surface.route)
      for (const theme of ['light', 'dark'] as const) {
        await setTheme(page, theme)
        for (const viewport of [375, 1440]) {
          await page.setViewportSize({ width: viewport, height: 1200 })
          await expectNoPageOverflow(page)
          await attach(
            page,
            testInfo,
            `surface-${surface.role}-${surface.route}-${theme}-${viewport}`,
          )
        }
      }

      if (surface.route === 'feedback') {
        const alertStyle = await page
          .locator('.el-alert')
          .first()
          .evaluate((element) => {
            const value = getComputedStyle(element)
            return {
              borderRadius: value.borderRadius,
              boxShadow: value.boxShadow,
            }
          })
        expect(alertStyle.borderRadius).toBe('0px')
        expect(alertStyle.boxShadow).toBe('none')
      }

      if (surface.route === 'data') {
        const resultStyle = await page
          .locator('.el-result')
          .evaluate((element) => {
            const value = getComputedStyle(element)
            return {
              borderRadius: value.borderRadius,
              boxShadow: value.boxShadow,
            }
          })
        expect(resultStyle.borderRadius).toBe('0px')
        expect(resultStyle.boxShadow).toBe('none')
        const dataRegion = await page
          .locator('.el-calendar')
          .evaluate((element) => {
            const style = getComputedStyle(element)
            return {
              borderWidth: style.borderTopWidth,
              radius: style.borderRadius,
              shadow: style.boxShadow,
            }
          })
        expect(dataRegion.borderWidth).toBe('1px')
        expect(dataRegion.radius).toBe('12px')
        expect(dataRegion.shadow).toBe('none')
      }
    } finally {
      await routeBrowser.close()
    }
  }
})

test('Empty has the complete viewport, theme, action and focus matrix', async ({
  page,
}, testInfo) => {
  await open(page, 'empty-illustration')
  const fixture = page.getByTestId('empty-illustration-fixture')

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme)
    for (const viewport of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width: viewport, height: 1200 })
      await expectNoPageOverflow(page)
      const actions = fixture.locator(
        '[data-empty-variant="primary-secondary"] .el-button',
      )
      for (let index = 0; index < (await actions.count()); index += 1) {
        const action = actions.nth(index)
        const before = await action.evaluate((element) => {
          const value = element.getBoundingClientRect()
          return {
            height: value.height,
            width: value.width,
            x: value.x + window.scrollX,
            y: value.y + window.scrollY,
          }
        })
        await action.focus()
        const after = await action.evaluate((element) => {
          const value = element.getBoundingClientRect()
          return {
            height: value.height,
            width: value.width,
            x: value.x + window.scrollX,
            y: value.y + window.scrollY,
          }
        })
        expect(after.height).toBeGreaterThanOrEqual(viewport < 420 ? 44 : 40)
        expect(
          Math.max(
            Math.abs(before.x - after.x),
            Math.abs(before.y - after.y),
            Math.abs(before.width - after.width),
            Math.abs(before.height - after.height),
          ),
        ).toBeLessThanOrEqual(2)
      }
      await attach(page, testInfo, `empty-${theme}-${viewport}`, fixture)
    }
  }
})

test('production form keeps the viewport/theme/zoom matrix and ten control roles', async ({
  page,
}, testInfo) => {
  await open(page, 'form')
  const fixture = page.getByTestId('production-form-fixtures')
  const controls = [
    '.el-input',
    '.el-textarea',
    '.el-select',
    '.el-input-number',
    '.el-date-editor',
    '.el-upload',
    '.el-checkbox',
    '.el-switch',
    '.el-radio',
    '.el-button',
  ]

  for (const selector of controls) {
    await expect(fixture.locator(selector).first()).toBeVisible()
  }

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme)
    for (const viewport of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width: viewport, height: 1200 })
      await page.evaluate(() => {
        document.documentElement.style.zoom = '1'
      })
      await expectNoPageOverflow(page)
      await attach(page, testInfo, `form-${theme}-${viewport}`, fixture)
    }

    // Stay one physical pixel below the 480px media-query boundary while
    // applying 150% CSS zoom: this yields the intended ~320 CSS-pixel viewport.
    await page.setViewportSize({ width: 479, height: 1800 })
    await page.evaluate(() => {
      document.documentElement.style.zoom = '1.5'
    })
    await expectNoPageOverflow(page)
    await attach(page, testInfo, `form-${theme}-320-zoom-150`, fixture)
  }

  await setTheme(page, 'dark')
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.evaluate(() => {
    document.documentElement.style.zoom = '1'
  })
  const roleMatrix = await fixture.evaluate((element, selectors) => {
    const color = (value: string) =>
      value
        .match(/\d+(?:\.\d+)?/g)
        ?.slice(0, 3)
        .map(Number) ?? []
    const luminance = (rgb: number[]) => {
      const channels = rgb.map((value) => {
        const channel = value / 255
        return channel <= 0.03928
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4
      })
      return (
        0.2126 * (channels[0] ?? 0) +
        0.7152 * (channels[1] ?? 0) +
        0.0722 * (channels[2] ?? 0)
      )
    }
    const contrast = (foreground: string, background: string) => {
      const left = luminance(color(foreground))
      const right = luminance(color(background))
      return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05)
    }
    const background = getComputedStyle(element).backgroundColor
    return selectors.map((selector) => {
      const node = element.querySelector<HTMLElement>(selector)!
      const style = getComputedStyle(node)
      return {
        background,
        color: style.color,
        contrast: contrast(style.color, background),
        opacity: style.opacity,
        selector,
      }
    })
  }, controls)
  expect(roleMatrix).toHaveLength(10)
  expect(
    roleMatrix.every(
      (entry) =>
        Number.isFinite(entry.contrast) &&
        entry.opacity === '1' &&
        entry.color !== entry.background,
    ),
  ).toBe(true)
  await testInfo.attach('form-dark-role-matrix.json', {
    body: Buffer.from(`${JSON.stringify(roleMatrix, null, 2)}\n`),
    contentType: 'application/json',
  })
  await attach(page, testInfo, 'form-dark-original', fixture)
  await page.addStyleTag({
    content:
      '[data-testid="production-form-fixtures"] { filter: grayscale(1); }',
  })
  await attach(page, testInfo, 'form-dark-grayscale', fixture)
})
