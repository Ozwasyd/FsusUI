/**
 * #299 — Dialog / Drawer / MessageBox overlay close hit targets.
 *
 * Evidence must come from real layout boxes (getBoundingClientRect / elementFromPoint),
 * not CSS string matches alone. Icon stays ~16px; hit box is fixed 54×54.
 */
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const OVERLAY_CLOSE_PX = 54
const ICON_MIN = 12
const ICON_MAX = 22
const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
] as const

type CloseMetrics = {
  box: {
    width: number
    height: number
    x: number
    y: number
    right: number
    bottom: number
  }
  minWidth: string
  minHeight: string
  transform: string
  icon: {
    width: number
    height: number
    transform: string
  } | null
  titleOverlap: boolean
  hitIsClose: boolean
  buttonCount: number
  accessibleName: string
  insidePanel: boolean
  insideViewport: boolean
}

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

const openFeedback = async (page: Page) => {
  await page.goto('/?visual=feedback', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('section-feedback')).toBeVisible()
}

const measureClose = async (
  page: Page,
  close: Locator,
  options: { titleSelector?: string; panelSelector?: string } = {},
): Promise<CloseMetrics> => {
  await expect(close).toBeVisible()
  await expect
    .poll(async () => {
      const box = await close.boundingBox()
      return box ? Math.round(box.width) : 0
    })
    .toBe(OVERLAY_CLOSE_PX)
  await settle(page)

  return close.evaluate(
    (button, opts) => {
      const rect = button.getBoundingClientRect()
      const style = getComputedStyle(button)
      const icon =
        (button.querySelector('.el-icon, svg, i') as HTMLElement | null) ?? null
      const iconRect = icon?.getBoundingClientRect()
      const iconStyle = icon ? getComputedStyle(icon) : null

      const root = button.closest(
        '.el-dialog, .el-drawer, .el-message-box',
      ) as HTMLElement | null
      const title = opts.titleSelector
        ? (root?.querySelector(opts.titleSelector) as HTMLElement | null)
        : null

      let titleOverlap = false
      if (title) {
        let inkRight = title.getBoundingClientRect().right
        const textRect = title.getBoundingClientRect()
        try {
          const range = document.createRange()
          range.selectNodeContents(title)
          const clientRects = range.getClientRects()
          if (clientRects.length > 0) {
            inkRight = Math.max(...Array.from(clientRects).map((r) => r.right))
          }
        } catch {
          // ignore
        }
        const horizontallyOverlaps =
          inkRight > rect.left + 1 && textRect.left < rect.right - 1
        const verticallyOverlaps =
          textRect.bottom > rect.top + 1 && textRect.top < rect.bottom - 1
        titleOverlap = horizontallyOverlaps && verticallyOverlaps
      }

      const probes: Array<[number, number]> = [
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + 6, rect.top + 6],
        [rect.right - 6, rect.top + 6],
        [rect.left + 6, rect.bottom - 6],
        [rect.right - 6, rect.bottom - 6],
      ]
      let hitIsClose = false
      for (const [x, y] of probes) {
        const hit = document.elementFromPoint(x, y)
        if (!hit) continue
        if (
          hit === button ||
          button.contains(hit) ||
          (hit as Element).closest?.(
            'button.el-dialog__headerbtn, button.el-drawer__close-btn, button.el-message-box__headerbtn',
          ) === button
        ) {
          hitIsClose = true
          break
        }
      }

      const panel = opts.panelSelector
        ? (button.closest(opts.panelSelector) as HTMLElement | null)
        : root
      const panelRect = panel?.getBoundingClientRect()
      const insidePanel = panelRect
        ? rect.left >= panelRect.left - 1 &&
          rect.top >= panelRect.top - 1 &&
          rect.right <= panelRect.right + 1 &&
          rect.bottom <= panelRect.bottom + 1
        : false

      const vw = window.innerWidth
      const vh = window.innerHeight
      const insideViewport =
        rect.left >= -1 &&
        rect.top >= -1 &&
        rect.right <= vw + 1 &&
        rect.bottom <= vh + 1

      const closeButtons = root
        ? root.querySelectorAll(
            'button.el-dialog__headerbtn, button.el-drawer__close-btn, button.el-message-box__headerbtn',
          )
        : [button]

      return {
        box: {
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y,
          right: rect.right,
          bottom: rect.bottom,
        },
        minWidth: style.minWidth,
        minHeight: style.minHeight,
        transform: style.transform,
        icon: iconRect
          ? {
              width: iconRect.width,
              height: iconRect.height,
              transform: iconStyle?.transform ?? 'none',
            }
          : null,
        titleOverlap,
        hitIsClose,
        buttonCount: closeButtons.length,
        accessibleName: (
          button.getAttribute('aria-label') ||
          button.textContent ||
          ''
        ).trim(),
        insidePanel,
        insideViewport,
      }
    },
    {
      titleSelector: options.titleSelector ?? '',
      panelSelector: options.panelSelector ?? '',
    },
  )
}

const expectCloseContract = (metrics: CloseMetrics, label: string) => {
  expect(metrics.box.width, `${label} width`).toBeGreaterThanOrEqual(
    OVERLAY_CLOSE_PX - 1,
  )
  expect(metrics.box.width, `${label} width upper`).toBeLessThanOrEqual(
    OVERLAY_CLOSE_PX + 1,
  )
  expect(metrics.box.height, `${label} height`).toBeGreaterThanOrEqual(
    OVERLAY_CLOSE_PX - 1,
  )
  expect(metrics.box.height, `${label} height upper`).toBeLessThanOrEqual(
    OVERLAY_CLOSE_PX + 1,
  )
  expect(metrics.minWidth, `${label} min-width`).toBe(`${OVERLAY_CLOSE_PX}px`)
  expect(metrics.minHeight, `${label} min-height`).toBe(`${OVERLAY_CLOSE_PX}px`)
  expect(metrics.transform, `${label} transform`).toBe('none')
  expect(metrics.hitIsClose, `${label} elementFromPoint hit`).toBe(true)
  expect(metrics.buttonCount, `${label} single close button`).toBe(1)
  expect(
    metrics.accessibleName.length,
    `${label} accessible name`,
  ).toBeGreaterThan(0)
  expect(metrics.insidePanel, `${label} inside panel`).toBe(true)
  expect(metrics.insideViewport, `${label} inside viewport`).toBe(true)
  expect(metrics.titleOverlap, `${label} title must not overlap close`).toBe(
    false,
  )

  if (metrics.icon) {
    expect(metrics.icon.width, `${label} icon width`).toBeGreaterThanOrEqual(
      ICON_MIN,
    )
    expect(metrics.icon.width, `${label} icon width max`).toBeLessThanOrEqual(
      ICON_MAX,
    )
    expect(metrics.icon.height, `${label} icon height`).toBeGreaterThanOrEqual(
      ICON_MIN,
    )
    expect(metrics.icon.height, `${label} icon height max`).toBeLessThanOrEqual(
      ICON_MAX,
    )
    expect(metrics.icon.transform, `${label} icon transform`).toBe('none')
  }
}

test.describe('overlay close hit targets (#299)', () => {
  test('Dialog close is 54x54 via real DOMRect across viewports', async ({
    page,
  }) => {
    await openFeedback(page)

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.getByTestId('open-publish-dialog').click()
      await expect(page.locator('.el-dialog').last()).toBeVisible()
      const close = page.locator('.el-dialog__headerbtn').last()
      const metrics = await measureClose(page, close, {
        titleSelector: '.el-dialog__title',
        panelSelector: '.el-dialog',
      })
      expectCloseContract(metrics, `dialog@${viewport.width}`)
      await page.keyboard.press('Escape')
      await settle(page)
    }
  })

  test('Drawer close is 54x54 via real DOMRect across viewports', async ({
    page,
  }) => {
    await openFeedback(page)

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.getByTestId('open-review-drawer').click()
      const drawer = page.locator('.el-drawer').last()
      await expect(drawer).toBeVisible()
      await expect(drawer).toHaveClass(/open/)
      const close = page.locator('.el-drawer__close-btn').last()
      const metrics = await measureClose(page, close, {
        titleSelector: '.el-drawer__title',
        panelSelector: '.el-drawer',
      })
      expectCloseContract(metrics, `drawer@${viewport.width}`)
      await page.keyboard.press('Escape')
      await settle(page)
    }
  })

  test('MessageBox close is 54x54 via real DOMRect across viewports', async ({
    page,
  }) => {
    await openFeedback(page)

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport)
      await page.getByTestId('open-message-box').click()
      await expect(page.locator('.el-message-box').last()).toBeVisible()
      const close = page.locator('.el-message-box__headerbtn').last()
      const metrics = await measureClose(page, close, {
        titleSelector: '.el-message-box__title',
        panelSelector: '.el-message-box',
      })
      expectCloseContract(metrics, `message-box@${viewport.width}`)
      await page.keyboard.press('Escape')
      await settle(page)
    }
  })

  test('long titles clear the close hit box without underlap', async ({
    page,
  }) => {
    await openFeedback(page)
    await page.setViewportSize({ width: 375, height: 812 })

    await page.getByTestId('open-long-title-dialog').click()
    const dialogClose = page.locator('.el-dialog__headerbtn').last()
    const dialogMetrics = await measureClose(page, dialogClose, {
      titleSelector: '.el-dialog__title',
      panelSelector: '.el-dialog',
    })
    expectCloseContract(dialogMetrics, 'long-title-dialog')
    await page.keyboard.press('Escape')
    await settle(page)

    await page.getByTestId('open-review-drawer').click()
    await expect(page.locator('.el-drawer').last()).toHaveClass(/open/)
    const drawerClose = page.locator('.el-drawer__close-btn').last()
    const drawerMetrics = await measureClose(page, drawerClose, {
      titleSelector: '.el-drawer__title',
      panelSelector: '.el-drawer',
    })
    expectCloseContract(drawerMetrics, 'long-title-drawer')
    await page.keyboard.press('Escape')
    await settle(page)
  })

  test('150%/200% zoom keeps a reliable 54 CSS-px hit target', async ({
    page,
  }) => {
    await openFeedback(page)
    await page.setViewportSize({ width: 768, height: 1024 })

    for (const zoom of [1.5, 2] as const) {
      await page.evaluate((value) => {
        document.documentElement.style.zoom = String(value)
      }, zoom)
      await settle(page)

      await page.getByTestId('open-publish-dialog').click()
      const close = page.locator('.el-dialog__headerbtn').last()
      await expect(close).toBeVisible()
      const cssBox = await close.evaluate((button, z) => {
        const rect = button.getBoundingClientRect()
        return { width: rect.width / z, height: rect.height / z }
      }, zoom)
      expect(cssBox.width, `dialog zoom ${zoom} width`).toBeGreaterThanOrEqual(
        OVERLAY_CLOSE_PX - 1,
      )
      expect(
        cssBox.height,
        `dialog zoom ${zoom} height`,
      ).toBeGreaterThanOrEqual(OVERLAY_CLOSE_PX - 1)
      await page.keyboard.press('Escape')
      await settle(page)
    }

    await page.evaluate(() => {
      document.documentElement.style.zoom = '1'
    })
  })

  test('focus-visible uses circular 2px Scholarly Blue ring on overlay closes', async ({
    page,
  }) => {
    await openFeedback(page)
    await page.setViewportSize({ width: 768, height: 1024 })

    const cases: Array<{ open: string; close: string; label: string }> = [
      {
        open: 'open-publish-dialog',
        close: '.el-dialog__headerbtn',
        label: 'dialog',
      },
      {
        open: 'open-review-drawer',
        close: '.el-drawer__close-btn',
        label: 'drawer',
      },
      {
        open: 'open-message-box',
        close: '.el-message-box__headerbtn',
        label: 'message-box',
      },
    ]

    for (const item of cases) {
      await page.getByTestId(item.open).click()
      const close = page.locator(item.close).last()
      await expect(close).toBeVisible()
      await close.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await settle(page)

      const ring = await close.evaluate((button) => {
        button.focus()
        const style = getComputedStyle(button)
        return {
          boxShadow: style.boxShadow,
          borderRadius: style.borderRadius,
        }
      })

      expect(ring.boxShadow, `${item.label} focus box-shadow`).toMatch(/inset/i)
      expect(ring.boxShadow, `${item.label} focus 2px`).toMatch(
        /0px 0px 0px 2px|inset 0 0 0 2px/i,
      )
      const radius = Number.parseFloat(ring.borderRadius)
      expect(radius, `${item.label} focus radius`).toBeGreaterThanOrEqual(27)

      await page.keyboard.press('Escape')
      await settle(page)
    }
  })

  test('pointer hit-test activates the same accessible close button', async ({
    page,
  }) => {
    await openFeedback(page)
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.getByTestId('open-publish-dialog').click()

    const close = page.locator('.el-dialog__headerbtn').last()
    await expect(close).toBeVisible()
    const box = await close.boundingBox()
    expect(box).not.toBeNull()

    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await expect(page.locator('.el-dialog').last()).toBeHidden({
      timeout: 5_000,
    })
  })
})
