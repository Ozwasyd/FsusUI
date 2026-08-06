import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const sizes = ['default', 'small', 'large'] as const
const positions = ['sides', 'right'] as const

type Rect = {
  height: number
  width: number
  x: number
  y: number
}

const openFormSection = async (page: Page) => {
  await page.goto('/?visual=form', { waitUntil: 'domcontentloaded' })
  const fixture = page.getByTestId('input-number-hit-fixtures')
  await expect(fixture).toBeVisible()
  return fixture
}

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

const readRect = (locator: Locator) =>
  locator.evaluate((element): Rect => {
    const rect = element.getBoundingClientRect()
    return {
      height: rect.height,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    }
  })

const readActionMetrics = (root: Locator) =>
  root.evaluate((element) => {
    const increase = element.querySelector(
      '.el-input-number__increase',
    ) as HTMLElement | null
    const decrease = element.querySelector(
      '.el-input-number__decrease',
    ) as HTMLElement | null
    const icon = element.querySelector(
      '.el-input-number__increase .el-icon, .el-input-number__increase [class*="el-icon"]',
    ) as HTMLElement | null

    const measure = (node: HTMLElement | null) => {
      if (!node) return null
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return {
        height: rect.height,
        width: rect.width,
        opacity: style.opacity,
        transform: style.transform,
        boxShadow: style.boxShadow,
        actionSize: style
          .getPropertyValue('--fsus-input-number-action-size')
          .trim(),
        minWidth: style.minWidth,
        widthCss: style.width,
      }
    }

    const iconRect = icon?.getBoundingClientRect()
    const iconStyle = icon ? getComputedStyle(icon) : null

    return {
      root: (() => {
        const rect = element.getBoundingClientRect()
        return { height: rect.height, width: rect.width }
      })(),
      actionToken: getComputedStyle(element)
        .getPropertyValue('--fsus-input-number-action-size')
        .trim(),
      increase: measure(increase),
      decrease: measure(decrease),
      icon: icon
        ? {
            height: iconRect!.height,
            width: iconRect!.width,
            fontSize: iconStyle!.fontSize,
            transform: iconStyle!.transform,
          }
        : null,
    }
  })

test('InputNumber increase/decrease hit targets are ≥40px via real DOMRect', async ({
  page,
}) => {
  const fixture = await openFormSection(page)

  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1200 })
    await settle(page)

    for (const size of sizes) {
      for (const position of positions) {
        const caseId = `${size}-${position}`
        const control = fixture.locator(
          `[data-input-number-case="${caseId}"]`,
        )
        await expect(control).toBeVisible()

        const metrics = await readActionMetrics(control)
        expect(metrics.increase, caseId).not.toBeNull()
        expect(metrics.decrease, caseId).not.toBeNull()

        // Shared action-size token resolves to the control ladder (no 38px).
        expect(metrics.actionToken, caseId).not.toBe('')
        expect(metrics.actionToken, caseId).not.toContain('38')

        for (const role of ['increase', 'decrease'] as const) {
          const box = metrics[role]!
          // Real layout hit box — not a CSS string match.
          expect(box.width, `${caseId} ${role} width`).toBeGreaterThanOrEqual(
            40,
          )
          if (position === 'sides') {
            // Side-by-side actions fill the control height (≥40 on the ladder).
            expect(
              box.height,
              `${caseId} ${role} height`,
            ).toBeGreaterThanOrEqual(40)
          } else {
            // Stacked right controls: width still ≥40; height is half strip.
            // Outer control remains on the 40/44/48 ladder.
            expect(
              metrics.root.height,
              `${caseId} root height`,
            ).toBeGreaterThanOrEqual(40)
            expect(box.width, `${caseId} ${role} stacked width`).toBe(
              metrics.increase!.width,
            )
          }

          expect(box.opacity, `${caseId} ${role} opacity`).toBe('1')
          expect(box.transform, `${caseId} ${role} transform`).toBe('none')
          expect(
            box.boxShadow === 'none' || box.boxShadow === '',
            `${caseId} ${role} box-shadow`,
          ).toBe(true)
        }

        // Both modes consume the same resolved action-size token value.
        expect(metrics.increase!.widthCss).toBe(metrics.decrease!.widthCss)

        if (metrics.icon) {
          // Icon remains ~16px and is not scaled off-center.
          expect(metrics.icon.width).toBeGreaterThanOrEqual(12)
          expect(metrics.icon.width).toBeLessThanOrEqual(20)
          expect(metrics.icon.height).toBeGreaterThanOrEqual(12)
          expect(metrics.icon.height).toBeLessThanOrEqual(20)
          expect(metrics.icon.transform).toBe('none')
        }
      }
    }
  }

  // 200% zoom must not shrink the measured hit target below 40 CSS px.
  await page.setViewportSize({ width: 768, height: 1200 })
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })
  await settle(page)

  const zoomed = fixture.locator('[data-input-number-case="default-sides"]')
  const zoomMetrics = await readActionMetrics(zoomed)
  expect(zoomMetrics.increase!.width).toBeGreaterThanOrEqual(40)
  expect(zoomMetrics.increase!.height).toBeGreaterThanOrEqual(40)
  expect(zoomMetrics.decrease!.width).toBeGreaterThanOrEqual(40)
  expect(zoomMetrics.decrease!.height).toBeGreaterThanOrEqual(40)

  await page.evaluate(() => {
    document.documentElement.style.zoom = '1'
  })

  // Disabled keeps opacity 1 with independent disabled tokens.
  const disabled = fixture.locator(
    '[data-input-number-case="disabled-sides"]',
  )
  const disabledMetrics = await readActionMetrics(disabled)
  expect(disabledMetrics.increase!.opacity).toBe('1')
  expect(disabledMetrics.decrease!.opacity).toBe('1')
  expect(disabledMetrics.increase!.width).toBeGreaterThanOrEqual(40)
  expect(disabledMetrics.decrease!.width).toBeGreaterThanOrEqual(40)

  // Hover must not translate or add shadow (layout-stable states).
  const hoverControl = fixture.locator(
    '[data-input-number-case="default-sides"]',
  )
  await hoverControl.scrollIntoViewIfNeeded()
  await settle(page)
  const hoverTarget = hoverControl.locator('.el-input-number__increase').first()
  const before = await readRect(hoverTarget)
  await hoverTarget.hover({ force: true })
  const afterHover = await hoverTarget.evaluate((node) => {
    const style = getComputedStyle(node)
    const rect = node.getBoundingClientRect()
    return {
      height: rect.height,
      width: rect.width,
      transform: style.transform,
      boxShadow: style.boxShadow,
    }
  })
  // Size stays stable; no translate/shadow affordance on hover.
  expect(Math.abs(before.width - afterHover.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(before.height - afterHover.height)).toBeLessThanOrEqual(1)
  expect(afterHover.transform).toBe('none')
  expect(
    afterHover.boxShadow === 'none' || afterHover.boxShadow === '',
  ).toBe(true)
})
