import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { openGeometryFixture, runGeometryContract } from './geometry-contract'

const widths = [320, 375, 390, 768, 1440] as const
const zooms = [1, 1.5] as const

type ComponentFixture = {
  component: string
  focusSelector: string
  hitSelector: string
  peerSelector?: string
  ready: string
  root: (page: Page) => Locator
  route: string
}

const fixtures: ComponentFixture[] = [
  {
    component: 'Transfer',
    route: '/?visual=transfer-responsive&theme=light',
    ready: '[data-testid="transfer-standard"]',
    root: (page) =>
      page.getByTestId('transfer-standard').locator('.el-transfer'),
    hitSelector:
      '.el-transfer__button,.el-transfer-panel__item,.el-input__wrapper',
    focusSelector:
      '.el-transfer__button:not(:disabled),.el-transfer-panel__item:not(.is-disabled) input,.el-input__inner',
    peerSelector: '.el-transfer-panel,.el-transfer__buttons',
  },
  {
    component: 'Descriptions',
    route: '/?visual=data&theme=light',
    ready: '[data-testid="section-data"]',
    root: (page) => page.locator('.el-descriptions').first(),
    hitSelector: 'a,button',
    focusSelector: 'a,button',
    peerSelector: '.el-descriptions__stack-item',
  },
  {
    component: 'Table',
    route: '/?visual=data&theme=light',
    ready: '[data-testid="section-data"]',
    root: (page) => page.locator('.el-table--responsive-auto').first(),
    hitSelector: 'button,[role="button"]',
    focusSelector: 'button:not(:disabled),[role="button"][tabindex="0"]',
    peerSelector: '.el-table__responsive-detail-field',
  },
  {
    component: 'Pagination',
    route: '/?visual=data&theme=light',
    ready: '[data-testid="section-data"]',
    root: (page) => page.locator('.el-pagination--responsive-auto').first(),
    hitSelector: 'button:not(:disabled),[role="button"]',
    focusSelector: 'button:not(:disabled),input:not(:disabled)',
    peerSelector: '.el-pagination__navigation,.el-pagination__information',
  },
  {
    component: 'Calendar',
    route: '/?visual=data&theme=light',
    ready: '[data-testid="section-data"]',
    root: (page) => page.locator('.el-calendar').first(),
    hitSelector: 'button:not(:disabled)',
    focusSelector: 'button:not(:disabled)',
    peerSelector: '.el-calendar__title,.el-calendar__button-group',
  },
  {
    component: 'Breadcrumb',
    route: '/?visual=navigation&theme=light',
    ready: '[data-testid="section-navigation"]',
    root: (page) => page.getByTestId('breadcrumb-10').locator('nav'),
    hitSelector: 'a,button,[role="button"]',
    focusSelector: 'a,button,[role="button"][tabindex="0"]',
    peerSelector: ':scope > ol > .el-breadcrumb__item',
  },
  {
    component: 'Steps',
    route: '/?visual=navigation&theme=light',
    ready: '[data-testid="section-navigation"]',
    root: (page) =>
      page.getByTestId('steps-description').locator('ol.el-steps'),
    hitSelector: 'button,[role="button"]',
    focusSelector: 'button:not(:disabled),[role="button"][tabindex="0"]',
    peerSelector: ':scope > .el-step',
  },
]

for (const fixture of fixtures) {
  test(`${fixture.component} has an independent geometry contract`, async ({
    page,
  }, testInfo) => {
    const diagnostics: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        diagnostics.push(`${message.type()}: ${message.text()}`)
      }
    })
    page.on('pageerror', (error) =>
      diagnostics.push(`pageerror: ${error.message}`),
    )

    await openGeometryFixture(page, fixture.route, fixture.ready)
    for (const zoom of zooms) {
      for (const viewport of widths) {
        await runGeometryContract(page, testInfo, {
          component: fixture.component,
          focusSelector: fixture.focusSelector,
          hitSelector: fixture.hitSelector,
          peerSelector: fixture.peerSelector,
          root: fixture.root(page),
          viewport,
          zoom,
        })
      }
    }

    expect(diagnostics, `${fixture.component} console health`).toEqual([])
  })
}

test('geometry gate is independent from PNG baseline acceptance', async () => {
  const source = await readFile(
    resolve('vue/tests/geometry/geometry-contract.ts'),
    'utf8',
  )
  expect(source).not.toContain('toHaveScreenshot')
  expect(source).not.toContain('updateSnapshots')
  expect(source).toContain('failures')
})

for (const locale of ['en-US', 'de-DE', 'zh-CN'] as const) {
  test(`Calendar preserves locale order and long month geometry for ${locale}`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript((language) => {
      Object.defineProperty(navigator, 'language', {
        configurable: true,
        get: () => language,
      })
      Object.defineProperty(navigator, 'languages', {
        configurable: true,
        get: () => [language],
      })
    }, locale)
    await openGeometryFixture(
      page,
      '/?visual=data&theme=light',
      '[data-testid="section-data"]',
    )
    await page.setViewportSize({ width: 320, height: 1600 })

    const calendar = page.locator('.el-calendar').first()
    const next = calendar.locator('.el-calendar__button-group button').last()
    for (let month = 0; month < 2; month += 1) await next.click()

    const title = calendar.locator('.el-calendar__title')
    const actions = calendar.locator('.el-calendar__button-group')
    const [titleBox, actionsBox] = await Promise.all([
      title.boundingBox(),
      actions.boundingBox(),
    ])
    expect(titleBox).not.toBeNull()
    expect(actionsBox).not.toBeNull()
    expect(actionsBox!.y).toBeGreaterThanOrEqual(
      titleBox!.y + titleBox!.height + 7,
    )

    const headers = await calendar
      .locator('.el-calendar-table thead th')
      .allTextContents()
    expect(headers).toHaveLength(7)
    expect(headers[0]?.trim()).toMatch(
      locale === 'en-US' ? /Sun/i : locale === 'de-DE' ? /Mo/i : /一/,
    )
    await testInfo.attach(`calendar-${locale}-320.png`, {
      body: await calendar.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
  })
}
