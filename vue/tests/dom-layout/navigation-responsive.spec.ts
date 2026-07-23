import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

const openNavigationFixture = async (page: Page) => {
  await page.goto('/?visual=navigation&theme=light', {
    waitUntil: 'networkidle',
  })
  await expect(page.getByTestId('section-navigation')).toBeVisible()
}

test.describe('responsive navigation fixtures', () => {
  test('breadcrumb preserves semantic order and indivisible separator units', async ({
    page,
  }) => {
    await openNavigationFixture(page)

    for (const width of [320, 375, 560, 768, 1440]) {
      await page.setViewportSize({ width, height: 1200 })

      const breadcrumb = page.getByTestId('breadcrumb-10').locator('nav')
      const navBox = await breadcrumb.boundingBox()
      expect(navBox).not.toBeNull()
      expect(navBox!.x + navBox!.width).toBeLessThanOrEqual(width)

      const semantics = await breadcrumb.evaluate((nav) => {
        const list = nav.querySelector(':scope > ol')
        const items = Array.from(
          list?.querySelectorAll<HTMLElement>(
            ':scope > .el-breadcrumb__item',
          ) ?? [],
        )
        const visibleItems = items.filter(
          (item) => getComputedStyle(item).display !== 'none',
        )
        const separators = visibleItems.flatMap((item) => {
          const separator = item.querySelector<HTMLElement>(
            ':scope > .el-breadcrumb__separator',
          )
          if (!separator || getComputedStyle(separator).display === 'none') {
            return []
          }
          const itemRect = item.getBoundingClientRect()
          const separatorRect = separator.getBoundingClientRect()
          return [
            {
              insideHorizontal:
                separatorRect.left >= itemRect.left - 0.5 &&
                separatorRect.right <= itemRect.right + 0.5,
              insideVertical:
                separatorRect.top >= itemRect.top - 0.5 &&
                separatorRect.bottom <= itemRect.bottom + 0.5,
            },
          ]
        })

        return {
          current:
            list?.querySelector('[aria-current="page"]')?.textContent?.trim() ??
            '',
          directItemCount: items.length,
          listTag: list?.tagName,
          navTag: nav.tagName,
          separators,
          visibleTexts: visibleItems.map((item) =>
            item.querySelector(':scope > .el-breadcrumb__collapse')
              ? '…'
              : item
                  .querySelector(':scope > .el-breadcrumb__inner')
                  ?.textContent?.trim(),
          ),
        }
      })

      expect(semantics.navTag).toBe('NAV')
      expect(semantics.listTag).toBe('OL')
      expect(semantics.current).toContain('超长当前层级')
      expect(
        semantics.separators.every((entry) => entry.insideHorizontal),
      ).toBe(true)
      expect(semantics.separators.every((entry) => entry.insideVertical)).toBe(
        true,
      )

      if (navBox!.width < 390) {
        expect(semantics.visibleTexts).toHaveLength(3)
        expect(semantics.visibleTexts[0]).toContain('…')
        expect(semantics.visibleTexts[1]).toContain('验收证据')
        expect(semantics.visibleTexts[2]).toContain('超长当前层级')
      } else if (navBox!.width < 560) {
        expect(semantics.visibleTexts).toHaveLength(4)
        expect(semantics.visibleTexts[0]).toContain('首页')
        expect(semantics.visibleTexts[1]).toContain('…')
        expect(semantics.visibleTexts[2]).toContain('验收证据')
        expect(semantics.visibleTexts[3]).toContain('超长当前层级')
      } else {
        expect(semantics.visibleTexts).toHaveLength(10)
      }
    }
  })

  test('breadcrumb collapse is keyboard reachable and exposes full-size path targets', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 1200 })
    await openNavigationFixture(page)

    const breadcrumb = page.getByTestId('breadcrumb-10').locator('nav')
    const trigger = breadcrumb.getByLabel('Show complete breadcrumb path')
    await trigger.focus()
    await expect(trigger).toBeFocused()
    await page.keyboard.press('Enter')

    const menu = breadcrumb.getByRole('list', {
      name: 'Complete breadcrumb path',
    })
    await expect(menu).toBeVisible()
    await expect(menu.locator(':scope > li')).toHaveCount(10)

    const triggerBox = await trigger.boundingBox()
    expect(triggerBox?.width).toBeGreaterThanOrEqual(40)
    expect(triggerBox?.height).toBeGreaterThanOrEqual(40)

    for (const target of await menu.getByRole('button').all()) {
      const box = await target.boundingBox()
      expect(box?.height).toBeGreaterThanOrEqual(44)
    }

    const current = breadcrumb.locator('[aria-current="page"]')
    await expect(current).toContainText('超长当前层级')
    const currentBox = await current.boundingBox()
    expect(currentBox?.height).toBeLessThanOrEqual(40)
    await expect(
      page.getByTestId('breadcrumb-2').locator('details'),
    ).toHaveCount(0)
  })
})
