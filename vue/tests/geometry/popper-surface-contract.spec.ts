import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'

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
  await page.goto(`/?visual=${visual}&theme=light`, {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.locator('#app > *').first()).toBeVisible({ timeout: 15_000 })
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

test('popper shared surface and arrow geometry contract (#475)', async ({
  page,
}, testInfo) => {
  // ============================================================
  // 1. Feedback section — Tooltip (hover trigger), Popover (click trigger)
  // ============================================================
  await open(page, 'feedback')

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme)

    // Tooltip: hover to trigger
    const tooltipBtn = page.locator('.el-tooltip__trigger').first()
    await tooltipBtn.scrollIntoViewIfNeeded()
    await tooltipBtn.hover()
    await page.waitForTimeout(500)

    const tooltipPopper = page.locator('.el-popper.is-light').first()
    if (await tooltipPopper.isVisible().catch(() => false)) {
      const tooltipRadius = await tooltipPopper.evaluate((el) =>
        getComputedStyle(el).borderRadius,
      )
      expect(tooltipRadius).toBe('10px')

      await attach(page, testInfo, `tooltip-${theme}`, tooltipPopper)
    }

    // Popover: click to trigger (ElPopover renders through ElTooltipTrigger,
    // so the trigger carries the tooltip trigger class; locate by role instead)
    const popoverBtn = page.getByRole('button', {
      exact: true,
      name: 'Popover',
    })
    await popoverBtn.scrollIntoViewIfNeeded()
    await popoverBtn.click()
    await page.waitForTimeout(500)

    const popoverPopper = page.locator('.el-popover').first()
    if (await popoverPopper.isVisible().catch(() => false)) {
      const popoverRadius = await popoverPopper.evaluate((el) =>
        getComputedStyle(el).borderRadius,
      )
      expect(popoverRadius).toBe('10px')

      // Find the arrow element within the popover popper
      const arrow = popoverPopper.locator('.el-popper__arrow')
      if (await arrow.isVisible().catch(() => false)) {
        const arrowSize = await arrow.evaluate((el) => {
          const style = getComputedStyle(el)
          return { width: style.width, height: style.height }
        })
        expect(arrowSize.width).toBe('10px')
        expect(arrowSize.height).toBe('10px')
      }

      await attach(page, testInfo, `popover-${theme}`, popoverPopper)
    }

    // Dismiss the popover
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  // ============================================================
  // 2. Navigation section — Dropdown (click trigger)
  // ============================================================
  await open(page, 'navigation')

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme)

    const dropdownBtn = page.locator('.el-dropdown').first()
    await dropdownBtn.scrollIntoViewIfNeeded()
    await dropdownBtn.click()
    await page.waitForTimeout(500)

    const dropdownPopper = page.locator('.el-popper.is-light').first()
    if (await dropdownPopper.isVisible().catch(() => false)) {
      const dropdownRadius = await dropdownPopper.evaluate((el) =>
        getComputedStyle(el).borderRadius,
      )
      expect(dropdownRadius).toBe('10px')

      await attach(page, testInfo, `dropdown-${theme}`, dropdownPopper)
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  // ============================================================
  // 3. Form section — Select (click trigger), DatePicker, Cascader
  // ============================================================
  await open(page, 'form')

  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme)

    // Select: click the first one to open dropdown
    const selectTrigger = page.locator('.el-select').first()
    await selectTrigger.scrollIntoViewIfNeeded()
    await selectTrigger.click()
    await page.waitForTimeout(500)

    let selectPopper = page.locator('.el-select__popper').first()
    if (!(await selectPopper.isVisible().catch(() => false))) {
      selectPopper = page.locator('.el-popper.is-light').first()
    }
    if (await selectPopper.isVisible().catch(() => false)) {
      const selectRadius = await selectPopper.evaluate((el) =>
        getComputedStyle(el).borderRadius,
      )
      expect(selectRadius).toBe('10px')

      await attach(page, testInfo, `select-${theme}`, selectPopper)
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Cascader
    const cascaderTrigger = page.locator('.el-cascader').first()
    await cascaderTrigger.scrollIntoViewIfNeeded()
    await cascaderTrigger.click()
    await page.waitForTimeout(500)

    const cascaderPopper = page.locator('.el-cascader__popper').first()
    if (await cascaderPopper.isVisible().catch(() => false)) {
      const cascaderRadius = await cascaderPopper.evaluate((el) =>
        getComputedStyle(el).borderRadius,
      )
      expect(cascaderRadius).toBe('10px')

      await attach(page, testInfo, `cascader-${theme}`, cascaderPopper)
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // ColorPicker
    const colorPickerTrigger = page.locator('.el-color-picker').first()
    await colorPickerTrigger.scrollIntoViewIfNeeded()
    await colorPickerTrigger.click()
    await page.waitForTimeout(500)

    const colorPickerPopper = page.locator('.el-color-dropdown').first()
    if (await colorPickerPopper.isVisible().catch(() => false)) {
      const cpRadius = await colorPickerPopper.evaluate((el) =>
        getComputedStyle(el).borderRadius,
      )
      // Registered exception (#475): the ColorPicker panel is a floating
      // surface and uses --fsus-radius-floating (radius.surface.md = 12px),
      // not the shared 10px popper surface radius.
      expect(cpRadius).toBe('12px')

      await attach(page, testInfo, `colorpicker-${theme}`, colorPickerPopper)
    }

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }

  // ============================================================
  // 4. Cross-cutting: verify no magic 2/5/11px values exist
  // on any visible popper element
  // ============================================================
  await open(page, 'feedback')
  await setTheme(page, 'light')

  const magicCheck = await page.evaluate(() => {
    const poppers = document.querySelectorAll('.el-popper, .el-popover, .el-dropdown__popper, .el-select__popper, .el-cascader__popper')
    const violations: string[] = []
    for (const popper of poppers) {
      if ((popper as HTMLElement).offsetParent === null) continue
      const style = getComputedStyle(popper)
      const radius = style.borderRadius
      if (radius === '2px' || radius === '5px' || radius === '11px') {
        violations.push(`${(popper as HTMLElement).className}: border-radius=${radius}`)
      }
      const padding = style.padding
      const parts = padding.split(' ').filter(Boolean)
      for (const part of parts) {
        if (part === '2px' || part === '5px' || part === '11px') {
          violations.push(`${(popper as HTMLElement).className}: padding=${padding}`)
          break
        }
      }
    }
    // Also check arrow elements
    const arrows = document.querySelectorAll('.el-popper__arrow')
    for (const arrow of arrows) {
      if ((arrow as HTMLElement).offsetParent === null) continue
      const style = getComputedStyle(arrow)
      const radius = style.borderRadius
      if (radius === '2px' || radius === '5px' || radius === '11px') {
        violations.push(`arrow: border-radius=${radius}`)
      }
    }
    return violations
  })
  expect(magicCheck).toEqual([])
})
