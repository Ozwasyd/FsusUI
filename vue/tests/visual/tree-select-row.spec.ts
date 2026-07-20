import { expect, test } from '@playwright/test'

test('TreeSelect renders one coherent navigation row', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith('mobile'),
    'Hover state is desktop-only',
  )
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/?theme=light', { waitUntil: 'domcontentloaded' })

  const treeSelect = page.locator('[data-testid="unique-tree-select"]')
  await treeSelect.scrollIntoViewIfNeeded()
  await treeSelect.locator('input').click({ force: true })

  const popper = treeSelect.locator('.el-tree-select__popper.el-popper')
  await expect(popper).toBeVisible()

  const row = popper
    .locator('.el-tree-node__content', { hasText: 'Level one 1' })
    .first()
  await expect(row).toBeVisible()
  await row.hover()
  await expect
    .poll(() =>
      row.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe('rgba(0, 0, 0, 0)')

  const metrics = await row.evaluate((element) => {
    const rowStyle = getComputedStyle(element)
    const expandIcon = element.querySelector<HTMLElement>(
      '.el-tree-node__expand-icon:not(.is-leaf)',
    )
    const option = element.querySelector<HTMLElement>(
      '.el-select-dropdown__item',
    )

    if (!expandIcon || !option) {
      throw new Error('TreeSelect row controls are missing')
    }

    const expandStyle = getComputedStyle(expandIcon)
    const optionStyle = getComputedStyle(option)

    return {
      background: rowStyle.backgroundColor,
      display: rowStyle.display,
      expandOpacity: expandStyle.opacity,
      expandVisibility: expandStyle.visibility,
      expandWidth: expandIcon.getBoundingClientRect().width,
      height: rowStyle.height,
      optionRadius: optionStyle.borderRadius,
      radius: rowStyle.borderRadius,
    }
  })

  expect(metrics.display).toBe('grid')
  expect(metrics.height).toBe('44px')
  expect(metrics.radius).toBe('6px')
  expect(metrics.background).not.toBe('rgba(0, 0, 0, 0)')
  expect(metrics.expandOpacity).toBe('1')
  expect(metrics.expandVisibility).toBe('visible')
  expect(metrics.expandWidth).toBe(32)
  expect(metrics.optionRadius).toBe('0px')
})
