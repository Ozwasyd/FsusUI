import { expect, test } from '@playwright/test'

import type { Page } from '@playwright/test'

const openNavigationFixture = async (
  page: Page,
  theme: 'dark' | 'light' = 'light',
) => {
  await page.goto(`/?visual=navigation&theme=${theme}`, {
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

test.describe('responsive steps fixtures', () => {
  test('auto direction follows container width for 2, 3, and 6 steps', async ({
    page,
  }) => {
    await openNavigationFixture(page)

    for (const width of [320, 375, 640, 768, 1440]) {
      await page.setViewportSize({ width, height: 1600 })

      const described = page
        .getByTestId('steps-description')
        .locator('ol.el-steps')
      const compact = page.getByTestId('steps-compact').locator('ol.el-steps')
      const six = page.getByTestId('steps-six').locator('ol.el-steps')

      const describedBox = await described.boundingBox()
      expect(describedBox).not.toBeNull()
      const expectsNarrowProjection = describedBox!.width < 640

      await expect(described).toHaveAttribute(
        'data-direction',
        expectsNarrowProjection ? 'vertical' : 'horizontal',
      )
      await expect(six).toHaveAttribute(
        'data-direction',
        expectsNarrowProjection ? 'vertical' : 'horizontal',
      )
      await expect(compact).toHaveAttribute('data-direction', 'horizontal')

      if (expectsNarrowProjection) {
        await expect(compact).toHaveClass(/is-compact/)
      } else {
        await expect(compact).not.toHaveClass(/is-compact/)
      }

      for (const root of [described, compact, six]) {
        const rootBox = await root.boundingBox()
        expect(rootBox).not.toBeNull()

        for (const title of await root.locator('.el-step__title').all()) {
          await expect(title).toBeVisible()
          const box = await title.boundingBox()
          expect(box).not.toBeNull()
          expect(box!.x).toBeGreaterThanOrEqual(rootBox!.x - 1)
          expect(box!.x + box!.width).toBeLessThanOrEqual(
            rootBox!.x + rootBox!.width + 1,
          )
          const overflow = await title.evaluate((element) => ({
            horizontal: element.scrollWidth - element.clientWidth,
            vertical: element.scrollHeight - element.clientHeight,
          }))
          expect(overflow.horizontal).toBeLessThanOrEqual(1)
          expect(overflow.vertical).toBeLessThanOrEqual(1)
        }

        for (const description of await root
          .locator('.el-step__description')
          .all()) {
          const box = await description.boundingBox()
          expect(box).not.toBeNull()
          expect(box!.x + box!.width).toBeLessThanOrEqual(
            rootBox!.x + rootBox!.width + 1,
          )
          const overflow = await description.evaluate((element) => ({
            horizontal: element.scrollWidth - element.clientWidth,
            vertical: element.scrollHeight - element.clientHeight,
          }))
          expect(overflow.horizontal).toBeLessThanOrEqual(1)
          expect(overflow.vertical).toBeLessThanOrEqual(1)
        }
      }

      const describedGeometry = await described.evaluate((root) => {
        const direction = root.getAttribute('data-direction')
        const steps = Array.from(
          root.querySelectorAll<HTMLElement>(':scope > .el-step'),
        )
        const alignments = steps.slice(0, -1).map((step) => {
          const line = step.querySelector<HTMLElement>('.el-step__line')!
          const icon = step.querySelector<HTMLElement>('.el-step__icon')!
          const lineRect = line.getBoundingClientRect()
          const iconRect = icon.getBoundingClientRect()
          return direction === 'vertical'
            ? Math.abs(
                lineRect.left +
                  lineRect.width / 2 -
                  (iconRect.left + iconRect.width / 2),
              )
            : Math.abs(
                lineRect.top +
                  lineRect.height / 2 -
                  (iconRect.top + iconRect.height / 2),
              )
        })
        const gaps = steps.slice(1).map((step, index) => {
          const previous = steps[index].getBoundingClientRect()
          const current = step.getBoundingClientRect()
          return current.top - previous.bottom
        })
        return { alignments, direction, gaps }
      })

      expect(
        describedGeometry.alignments.every((distance) => distance <= 1),
      ).toBe(true)
      if (describedGeometry.direction === 'vertical') {
        expect(
          describedGeometry.gaps.every((gap) => Math.abs(gap - 16) <= 1),
        ).toBe(true)
      }
    }
  })

  test('steps retain list semantics, keyboard targets, and grayscale state cues', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 1600 })

    for (const theme of ['light', 'dark'] as const) {
      await openNavigationFixture(page, theme)

      const root = page.getByTestId('steps-description').locator('ol.el-steps')
      await expect(root).toHaveAttribute('data-direction', 'vertical')
      await expect(root.locator(':scope > li')).toHaveCount(3)
      await expect(root.locator('[aria-current="step"]')).toContainText('复核')

      const target = root.getByRole('button', { name: /复核/ })
      const targetBox = await target.boundingBox()
      expect(targetBox?.width).toBeGreaterThanOrEqual(40)
      expect(targetBox?.height).toBeGreaterThanOrEqual(40)
      await target.focus()
      await expect(target).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('step-click-count')).toHaveText('1')

      const signatures = await root
        .locator(':scope > .el-step')
        .evaluateAll((steps) =>
          steps.map((step) => {
            const head = step.querySelector<HTMLElement>('.el-step__head')!
            const icon = step.querySelector<HTMLElement>('.el-step__icon')!
            const style = getComputedStyle(icon)
            return {
              background: style.backgroundColor,
              borderStyle: style.borderStyle,
              current: step.getAttribute('aria-current'),
              status: step.getAttribute('data-status'),
              text: getComputedStyle(head).color,
            }
          }),
        )

      expect(signatures.map((entry) => entry.status)).toEqual([
        'finish',
        'process',
        'wait',
      ])
      expect(signatures[1].current).toBe('step')
      expect(signatures[2].borderStyle).toBe('dashed')
      expect(
        new Set(signatures.map((entry) => JSON.stringify(entry))).size,
      ).toBe(3)
    }
  })

  test('200 percent zoom projects described steps vertically', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1600 })
    await openNavigationFixture(page)

    const root = page.getByTestId('steps-description').locator('ol.el-steps')
    await expect(root).toHaveAttribute('data-direction', 'horizontal')

    await page.evaluate(() => {
      document.documentElement.style.zoom = '2'
    })
    await expect(root).toHaveAttribute('data-direction', 'vertical')

    const layoutWidth = await root.evaluate(
      (element) => (element as HTMLElement).offsetWidth,
    )
    expect(layoutWidth).toBeLessThan(640)
  })
})
