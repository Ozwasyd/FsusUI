import { expect, test } from '@playwright/test'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'

const widths = [320, 375, 390, 768, 1440] as const

test('keeps Transfer usable across container widths, states, and themes', async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith('desktop-'),
    'The desktop light/dark projects exercise all required widths.',
  )
  test.setTimeout(120_000)

  const variant = resolveVisualVariant(testInfo.project.name)
  const url = buildVisualUrl('transfer-responsive', testInfo.project.name)
  const consoleProblems: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  for (const width of widths) {
    await page.setViewportSize({ width, height: 1400 })
    await page.goto(url, { waitUntil: 'networkidle' })

    const fixture = page.getByTestId('transfer-responsive-fixture')
    const standard = page.getByTestId('transfer-standard')
    expect(page.url()).toContain('visual=transfer-responsive')
    expect(await page.title()).not.toBe('')
    await expect(fixture).toBeVisible()
    await expect(standard).toBeVisible()
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)

    const geometry = await page.evaluate(() => {
      const cases = Array.from(
        document.querySelectorAll<HTMLElement>(
          '.transfer-responsive__case[data-state]',
        ),
      )
      const standardTransfer = document.querySelector<HTMLElement>(
        '[data-testid="transfer-standard"] .el-transfer',
      )!
      const standardLayout = standardTransfer.querySelector<HTMLElement>(
        '.el-transfer__layout',
      )!
      const panels = Array.from(
        standardTransfer.querySelectorAll<HTMLElement>('.el-transfer-panel'),
      )
      const actionBar = standardTransfer.querySelector<HTMLElement>(
        '.el-transfer__buttons',
      )!
      const buttons = Array.from(
        actionBar.querySelectorAll<HTMLElement>('.el-transfer__button'),
      )
      const firstItem = standardTransfer.querySelector<HTMLElement>(
        '.el-transfer-panel__item',
      )!
      const icon = actionBar.querySelector<HTMLElement>(
        '.el-transfer__direction-icon',
      )!
      const rect = (node: HTMLElement) => {
        const value = node.getBoundingClientRect()
        return {
          bottom: value.bottom,
          height: value.height,
          left: value.left,
          right: value.right,
          top: value.top,
          width: value.width,
        }
      }

      return {
        documentOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        rootWidth: standardTransfer.getBoundingClientRect().width,
        layout: rect(standardLayout),
        panels: panels.map(rect),
        panelStyles: panels.map((panel) => {
          const header = getComputedStyle(
            panel.querySelector<HTMLElement>('.el-transfer-panel__header')!,
          )
          const body = getComputedStyle(
            panel.querySelector<HTMLElement>('.el-transfer-panel__body')!,
          )
          return {
            borderLeftWidth: header.borderLeftWidth,
            bottomRadius: body.borderBottomLeftRadius,
            topRadius: header.borderTopLeftRadius,
          }
        }),
        actionBar: rect(actionBar),
        buttons: buttons.map(rect),
        item: rect(firstItem),
        icon: {
          ...rect(icon),
          transform: getComputedStyle(icon).transform,
        },
        stateWidths: cases.map((item) => {
          const transfer = item.querySelector<HTMLElement>('.el-transfer')!
          const statePanels = Array.from(
            transfer.querySelectorAll<HTMLElement>('.el-transfer-panel'),
          )
          return {
            state: item.dataset.state,
            transfer: transfer.getBoundingClientRect().width,
            panels: statePanels.map(
              (panel) => panel.getBoundingClientRect().width,
            ),
          }
        }),
      }
    })

    expect(geometry.documentOverflow).toBeLessThanOrEqual(0)
    expect(geometry.panels).toHaveLength(2)
    expect(geometry.buttons).toHaveLength(2)
    expect(geometry.item.height).toBeGreaterThanOrEqual(40)
    expect(geometry.icon.width).toBeCloseTo(16, 0)
    expect(geometry.icon.height).toBeCloseTo(16, 0)
    for (const button of geometry.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(40)
      expect(button.height).toBeGreaterThanOrEqual(40)
    }
    for (const style of geometry.panelStyles) {
      expect(style.borderLeftWidth).toBe('1px')
      expect(style.topRadius).toBe('12px')
      expect(style.bottomRadius).toBe('12px')
    }
    for (const state of geometry.stateWidths) {
      expect(state.panels).toHaveLength(2)
      expect(state.panels[0]).toBeCloseTo(state.panels[1], 0)
      expect(state.transfer).toBeCloseTo(geometry.rootWidth, 0)
    }

    if (geometry.rootWidth < 640) {
      expect(geometry.layout.width).toBeCloseTo(geometry.rootWidth, 0)
      expect(geometry.panels[0].width).toBeCloseTo(geometry.rootWidth, 0)
      expect(geometry.panels[1].width).toBeCloseTo(geometry.rootWidth, 0)
      expect(geometry.actionBar.top - geometry.panels[0].bottom).toBeCloseTo(
        8,
        0,
      )
      expect(geometry.panels[1].top - geometry.actionBar.bottom).toBeCloseTo(
        8,
        0,
      )
      expect(geometry.icon.transform).not.toBe('none')
    } else {
      expect(geometry.panels[0].right).toBeLessThanOrEqual(
        geometry.actionBar.left,
      )
      expect(geometry.actionBar.right).toBeLessThanOrEqual(
        geometry.panels[1].left,
      )
      expect(geometry.icon.transform).toBe('none')
    }

    await testInfo.attach(`transfer-${width}-${variant.theme}`, {
      body: await standard.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    })
  }

  expect(consoleProblems).toEqual([])
  expect(pageErrors).toEqual([])
})

test('keeps full labels, focus order, and keyboard move semantics on narrow containers', async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith('desktop-'),
    'The desktop light/dark projects exercise the narrow keyboard flow.',
  )
  test.setTimeout(60_000)

  await page.setViewportSize({ width: 390, height: 1400 })
  await page.goto(
    buildVisualUrl('transfer-responsive', testInfo.project.name),
    { waitUntil: 'networkidle' },
  )

  const standard = page.getByTestId('transfer-standard')
  const longText = page.getByTestId('transfer-long-text')
  const fullTitle =
    '这是一条在窄屏中需要省略显示，但仍应通过 title 读取完整内容的超长文章标题'
  await expect(
    longText.locator('.el-transfer-panel__item-label').first(),
  ).toHaveAttribute('title', fullTitle)

  await page.locator('body').focus()
  const focusGroups: string[] = []
  let moved = false

  for (let index = 0; index < 30; index++) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null
      if (!active) return { group: '', label: '' }
      const transfer = active.closest('[data-testid="transfer-standard"]')
      if (!transfer) return { group: 'outside', label: '' }
      const group = active.closest('.el-transfer__buttons')
        ? 'actions'
        : active.closest('.el-transfer-panel:first-child')
          ? 'source'
          : active.closest('.el-transfer-panel:last-child')
            ? 'target'
            : 'other'
      return {
        group,
        label: active.getAttribute('aria-label') || '',
      }
    })

    if (
      focused.group !== 'outside' &&
      focused.group !== 'other' &&
      focusGroups.at(-1) !== focused.group
    ) {
      focusGroups.push(focused.group)
    }
    if (focused.label === '可用文章 → 已选文章') {
      await page.keyboard.press('Enter')
      moved = true
      break
    }
  }

  expect(moved).toBe(true)
  expect(focusGroups.slice(0, 2)).toEqual(['source', 'actions'])
  await expect(
    standard
      .locator('.el-transfer-panel')
      .last()
      .locator(
        '.el-transfer-panel__item-label[title="季度复盘：内容增长与订阅留存"]',
      ),
  ).toBeVisible()

  for (let index = 0; index < 20; index++) {
    await page.keyboard.press('Tab')
    const inTarget = await page.evaluate(() =>
      Boolean(
        document.activeElement?.closest(
          '[data-testid="transfer-standard"] .el-transfer-panel:last-child',
        ),
      ),
    )
    if (inTarget) {
      focusGroups.push('target')
      break
    }
  }
  expect(focusGroups).toEqual(['source', 'actions', 'target'])
})

test('remains stable at 150 percent zoom', async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith('desktop-'),
    'The desktop light/dark projects exercise zoom.',
  )

  await page.setViewportSize({ width: 390, height: 1400 })
  await page.goto(
    buildVisualUrl('transfer-responsive', testInfo.project.name),
    { waitUntil: 'networkidle' },
  )
  await page.evaluate(() => {
    document.documentElement.style.zoom = '1.5'
  })

  const geometry = await page.evaluate(() => {
    const transfer = document.querySelector<HTMLElement>(
      '[data-testid="transfer-standard"] .el-transfer',
    )!
    const panels = Array.from(
      transfer.querySelectorAll<HTMLElement>('.el-transfer-panel'),
    )
    return {
      documentOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      transferWidth: transfer.getBoundingClientRect().width,
      panelWidths: panels.map((panel) => panel.getBoundingClientRect().width),
      actionHeight: transfer
        .querySelector<HTMLElement>('.el-transfer__button')!
        .getBoundingClientRect().height,
    }
  })

  expect(geometry.documentOverflow).toBeLessThanOrEqual(0)
  expect(geometry.panelWidths[0]).toBeCloseTo(geometry.transferWidth, 0)
  expect(geometry.panelWidths[1]).toBeCloseTo(geometry.transferWidth, 0)
  expect(geometry.actionHeight).toBeGreaterThanOrEqual(60)
})
