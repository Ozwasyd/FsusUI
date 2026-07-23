import { expect, test } from '@playwright/test'

import type { Locator, Page } from '@playwright/test'

const widths = [320, 375, 560, 768, 1440] as const
const zooms = [1, 2] as const

const paths = [
  {
    depth: 2,
    labels: ['首页', '当前文章'],
    testId: 'breadcrumb-2',
  },
  {
    depth: 5,
    labels: [
      '首页',
      '内容工作区',
      '文章管理',
      '待复核草稿',
      '响应式导航契约与 Long Latin title verification',
    ],
    testId: 'breadcrumb-5',
  },
  {
    depth: 10,
    labels: [
      '首页',
      '知识库',
      '设计系统',
      '组件规范',
      '导航组件',
      '移动端',
      '布局',
      '换行规则',
      '验收证据',
      '超长当前层级 Long current breadcrumb destination',
    ],
    testId: 'breadcrumb-10',
  },
] as const

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

const openFixture = async (page: Page) => {
  await page.goto('/?visual=navigation&theme=light', {
    waitUntil: 'networkidle',
  })
  await expect(page.getByTestId('section-navigation')).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
}

const visibleDirectItems = (breadcrumb: Locator) =>
  breadcrumb.locator(':scope > ol > .el-breadcrumb__item:visible')

test('breadcrumb covers depth, copy, viewport, zoom, DOM, geometry, and keyboard access', async ({
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

  await openFixture(page)
  expect(page.url()).toContain('/?visual=navigation&theme=light')
  expect(await page.title()).not.toBe('')

  for (const zoom of zooms) {
    for (const width of widths) {
      await page.setViewportSize({
        width: Math.round(width * zoom),
        height: Math.round(1800 * zoom),
      })
      await page.evaluate((factor) => {
        document.documentElement.style.zoom = String(factor)
      }, zoom)
      await settle(page)

      for (const path of paths) {
        const breadcrumb = page.getByTestId(path.testId).locator('nav')
        await breadcrumb.scrollIntoViewIfNeeded()
        await settle(page)

        const directLabels = await breadcrumb
          .locator(':scope > ol > .el-breadcrumb__item > .el-breadcrumb__inner')
          .allTextContents()
        expect(
          directLabels.map((label) => label.trim()),
          `${path.depth} levels preserve DOM and reader order`,
        ).toEqual([...path.labels])

        const current = breadcrumb.locator('[aria-current="page"]')
        await expect(current).toContainText(path.labels.at(-1)!)
        await expect(current.locator('.el-breadcrumb__inner')).toHaveAttribute(
          'title',
          path.labels.at(-1)!,
        )

        const visibleItems = visibleDirectItems(breadcrumb)
        const visibleLabels = await visibleItems.evaluateAll((items) =>
          items.map((item) => {
            const collapse = item.querySelector<HTMLElement>(
              ':scope > .el-breadcrumb__collapse',
            )
            if (collapse && getComputedStyle(collapse).display !== 'none') {
              return '…'
            }
            const inner = item.querySelector<HTMLElement>(
              ':scope > .el-breadcrumb__inner',
            )
            return inner && getComputedStyle(inner).display !== 'none'
              ? (inner.textContent?.trim() ?? '')
              : ''
          }),
        )
        const visiblePathLabels = visibleLabels.filter((label) => label !== '…')
        expect(
          visiblePathLabels.at(-1),
          `${path.depth} levels keep the current page visible`,
        ).toBe(path.labels.at(-1))
        expect(
          visiblePathLabels.at(-2),
          `${path.depth} levels keep the parent visible`,
        ).toBe(path.labels.at(-2))

        const separatorGeometry = await visibleItems.evaluateAll((items) =>
          items.flatMap((item) => {
            const inner = item.querySelector<HTMLElement>(
              ':scope > .el-breadcrumb__inner',
            )
            const collapse = item.querySelector<HTMLElement>(
              ':scope > .el-breadcrumb__collapse',
            )
            const separator = item.querySelector<HTMLElement>(
              ':scope > .el-breadcrumb__separator',
            )
            const content =
              collapse && getComputedStyle(collapse).display !== 'none'
                ? collapse
                : inner
            if (
              !content ||
              !separator ||
              getComputedStyle(separator).display === 'none'
            ) {
              return []
            }
            const itemRect = item.getBoundingClientRect()
            const contentRect = content.getBoundingClientRect()
            const separatorRect = separator.getBoundingClientRect()
            return [
              {
                contentBeforeSeparator:
                  contentRect.left <= separatorRect.left &&
                  contentRect.right <= separatorRect.right,
                sameLine:
                  Math.min(contentRect.bottom, separatorRect.bottom) -
                    Math.max(contentRect.top, separatorRect.top) >
                  0,
                separatorInsideItem:
                  separatorRect.left >= itemRect.left - 0.5 &&
                  separatorRect.right <= itemRect.right + 0.5 &&
                  separatorRect.top >= itemRect.top - 0.5 &&
                  separatorRect.bottom <= itemRect.bottom + 0.5,
              },
            ]
          }),
        )
        expect(
          separatorGeometry.length,
          `${path.depth} levels expose separators for every non-current visible item`,
        ).toBe(Math.max(0, visibleLabels.length - 1))
        expect(
          separatorGeometry.every(
            (entry) =>
              entry.contentBeforeSeparator &&
              entry.sameLine &&
              entry.separatorInsideItem,
          ),
          `${path.depth} levels never isolate a separator at ${width}px / ${zoom * 100}%`,
        ).toBe(true)

        for (const target of await breadcrumb
          .locator(
            ':scope > ol > .el-breadcrumb__item:visible > .el-breadcrumb__inner[tabindex="0"]',
          )
          .all()) {
          if (!(await target.isVisible())) continue
          const box = await target.boundingBox()
          expect(box, 'visible breadcrumb target has geometry').not.toBeNull()
          expect(
            box!.width,
            'visible breadcrumb target width',
          ).toBeGreaterThanOrEqual(40)
          expect(
            box!.height,
            'visible breadcrumb target height',
          ).toBeGreaterThanOrEqual(40)
        }

        const collapse = breadcrumb.locator('details')
        if (path.depth <= 4) {
          await expect(collapse).toHaveCount(0)
          continue
        }

        await expect(collapse).toHaveCount(1)
        const trigger = collapse.getByLabel('Show complete breadcrumb path')
        const triggerVisible = await trigger.isVisible()
        if (triggerVisible) {
          expect(
            triggerVisible,
            'narrow path exposes the collapse trigger',
          ).toBe(true)
          const triggerBox = await trigger.boundingBox()
          expect(triggerBox?.width).toBeGreaterThanOrEqual(40)
          expect(triggerBox?.height).toBeGreaterThanOrEqual(40)

          await trigger.focus()
          await expect(trigger).toBeFocused()
          await page.keyboard.press('Enter')

          const menu = collapse.getByRole('list', {
            name: 'Complete breadcrumb path',
          })
          await expect(menu).toBeVisible()
          expect(
            (
              await menu
                .locator(':scope > .el-breadcrumb__collapse-menu-item')
                .allTextContents()
            ).map((label) => label.trim()),
            `${path.depth} levels expose the complete ordered path`,
          ).toEqual([...path.labels])

          await page.keyboard.press('Tab')
          await expect(menu.getByRole('button').first()).toBeFocused()

          for (const item of await menu
            .locator(':scope > .el-breadcrumb__collapse-menu-item')
            .all()) {
            const [box, targetBox] = await Promise.all([
              item.boundingBox(),
              item
                .locator(':scope > .el-breadcrumb__collapse-menu-target')
                .boundingBox(),
            ])
            expect(
              box?.height,
              'collapse menu item height',
            ).toBeGreaterThanOrEqual(44)
            expect(
              targetBox?.width,
              'collapse menu target width',
            ).toBeGreaterThanOrEqual(40)
            expect(
              targetBox?.height,
              'collapse menu target height',
            ).toBeGreaterThanOrEqual(44)
          }

          await trigger.focus()
          await page.keyboard.press('Enter')
          await expect(menu).not.toBeVisible()
        } else {
          expect(
            triggerVisible,
            'wide path keeps the collapse control out of the visual order',
          ).toBe(false)
          expect(
            visibleLabels,
            `${path.depth} levels are fully visible`,
          ).toEqual([...path.labels])
        }

        if (
          path.depth === 10 &&
          zoom === 2 &&
          (width === 320 || width === 1440)
        ) {
          await testInfo.attach(`breadcrumb-10-${width}px-zoom-200.png`, {
            body: await breadcrumb.screenshot({ animations: 'disabled' }),
            contentType: 'image/png',
          })
        }
      }
    }
  }

  expect(diagnostics, 'breadcrumb console health').toEqual([])
})
