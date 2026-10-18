import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'

const orientations = ['vertical', 'horizontal'] as const
const cardSelector = '[data-audit-component="ElResizeSeparator"]'

const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )

const openFixture = async (
  page: Page,
  testInfo: TestInfo,
  boundary = false,
  compact = false,
) => {
  const theme = testInfo.project.name.endsWith('dark') ? 'dark' : 'light'
  await page.setViewportSize({
    width: testInfo.project.name.startsWith('mobile') ? 390 : 1280,
    height: 900,
  })
  await page.goto(
    `/?audit=${boundary ? 'ui-boundaries' : 'ui-states'}&state=focus&theme=${theme}${compact ? '&compact=1' : ''}`,
    { waitUntil: 'networkidle' },
  )
  await expect(page).toHaveTitle(/FsusUI/)
  await expect(page.locator('.audit-page__header')).toContainText('components')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  const card = page.locator(cardSelector)
  await card.scrollIntoViewIfNeeded()
  await settle(page)
  return card
}

// toBeVisible alone misses overflow:hidden and focus-induced internal scrolling.
// Inspect the complete real card, without scrolling individual descendants.
const readVisibility = (card: Locator) =>
  card.evaluate((element) => {
    const host = element.getBoundingClientRect()
    const targets = [
      element.querySelector('.audit-card__header')!,
      element.querySelector('.el-checkbox')!,
      ...element.querySelectorAll('[role="separator"]'),
      element.querySelector('output')!,
    ]
    return {
      scrollTop: element.scrollTop,
      targets: targets.map((target) => {
        const rect = target.getBoundingClientRect()
        const points = [
          [rect.left + rect.width / 2, rect.top + rect.height / 2],
          [rect.left + 1, rect.top + 1],
          [rect.right - 1, rect.bottom - 1],
        ]
        return {
          contained:
            rect.width > 0 &&
            rect.height > 0 &&
            rect.left >= host.left &&
            rect.right <= host.right &&
            rect.top >= host.top &&
            rect.bottom <= host.bottom,
          inViewport:
            rect.left >= 0 &&
            rect.right <= innerWidth &&
            rect.top >= 0 &&
            rect.bottom <= innerHeight,
          hit: points.every(([x, y]) =>
            target.contains(document.elementFromPoint(x, y)),
          ),
        }
      }),
    }
  })

const expectCompleteCard = async (card: Locator, soft = false) => {
  const check = soft ? expect.soft : expect
  check(await readVisibility(card)).toEqual({
    scrollTop: 0,
    targets: Array.from({ length: 5 }, () => ({
      contained: true,
      inViewport: true,
      hit: true,
    })),
  })
}

const screenshot = async (page: Page, testInfo: TestInfo, name: string) => {
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path })
  await testInfo.attach(name, {
    path,
    contentType: 'image/png',
  })
}

test('normal audit host keeps both orientations and values visible before and after focus', async ({
  page,
}, testInfo) => {
  const card = await openFixture(page, testInfo)
  await screenshot(page, testInfo, 'initial-viewport')
  await expectCompleteCard(card, true)
  await card.getByRole('checkbox', { name: 'Disabled' }).focus()
  for (const orientation of orientations) {
    await page.keyboard.press('Tab')
    await expect(
      card.getByRole('separator', {
        name: `Resize ${orientation} primary region`,
      }),
    ).toBeFocused()
    await settle(page)
    await screenshot(page, testInfo, `${orientation}-focused-viewport`)
    await expectCompleteCard(card, true)
  }
})

test('real keyboard, captured pointer, disabled state and page scroll retain the complete fixture', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const card = await openFixture(page, testInfo)
  const output = card.getByLabel('Accepted resize values')
  await expectCompleteCard(card)
  for (const orientation of orientations) {
    const handle = card.getByRole('separator', {
      name: `Resize ${orientation} primary region`,
    })
    await handle.focus()
    await handle.press(orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown')
    await expect(handle).toHaveAttribute('aria-valuenow', '0.55')
    await expect(output).toContainText(
      `${orientation === 'vertical' ? 'Vertical' : 'horizontal'} 0.55`,
    )
    await handle.press('Home')
    await expect(handle).toHaveAttribute('aria-valuenow', '0.2')
    await handle.press('End')
    await expect(handle).toHaveAttribute('aria-valuenow', '0.8')
    await expectCompleteCard(card)
    await handle.press('Home')

    // Move the page after measurement; the fixture must refresh client ranges.
    const beforeScroll = await page.evaluate(() => scrollY)
    await page.mouse.wheel(0, 60)
    await expect
      .poll(() => page.evaluate(() => scrollY))
      .toBeGreaterThan(beforeScroll)
    await settle(page)
    await expectCompleteCard(card)

    await handle.evaluate((element) => {
      element.addEventListener(
        'gotpointercapture',
        (event) => {
          element.setAttribute('data-test-capture', String(event.isTrusted))
        },
        { once: true },
      )
      element.addEventListener(
        'lostpointercapture',
        (event) => {
          element.setAttribute('data-test-release', String(event.isTrusted))
        },
        { once: true },
      )
    })
    const box = (await handle.boundingBox())!
    const frame = (await card
      .getByTestId(`resize-frame-${orientation}`)
      .boundingBox())!
    const distance =
      ((orientation === 'vertical' ? frame.width : frame.height) -
        (orientation === 'vertical' ? box.width : box.height)) *
      0.6
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await expect(handle).toHaveAttribute('aria-valuenow', '0.2')
    await page.mouse.move(
      x + (orientation === 'vertical' ? distance : 0),
      y + (orientation === 'horizontal' ? distance : 0),
      { steps: 4 },
    )
    await expect(handle).toHaveAttribute('aria-valuenow', '0.8')
    await expect(handle).toHaveAttribute('data-test-capture', 'true')
    await page.mouse.up()
    await expect(handle).toHaveAttribute('data-test-release', 'true')
    const accepted = await handle.getAttribute('aria-valuenow')
    await expect(output).toContainText(
      `${orientation === 'vertical' ? 'Vertical' : 'horizontal'} ${accepted}`,
    )
    await expectCompleteCard(card)
  }
  await card.locator('.el-checkbox').click()
  const accepted = await output.textContent()
  for (const orientation of orientations) {
    const handle = card.getByRole('separator', {
      name: `Resize ${orientation} primary region`,
    })
    await expect(handle).toHaveAttribute('aria-disabled', 'true')
    const box = (await handle.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await handle.focus()
    await handle.press('End')
  }
  await expect(output).toHaveText(accepted!)
  // Disabled keys keep native page scrolling. Revisit the whole host rather
  // than letting an individual descendant scroll an overflow-hidden card.
  await card.scrollIntoViewIfNeeded()
  await settle(page)
  await expectCompleteCard(card)
  await card.locator('.el-checkbox').click()
  for (const orientation of orientations) {
    await expect(
      card.getByRole('separator', {
        name: `Resize ${orientation} primary region`,
      }),
    ).toHaveAttribute('tabindex', '0')
  }
  await settle(page)
  await screenshot(page, testInfo, 'after-input-and-scroll-viewport')
  expect(errors).toEqual([])
})

test('boundary control and compact mobile widths preserve regions, output and focus', async ({
  page,
}, testInfo) => {
  for (const boundary of [false, true]) {
    const card = await openFixture(page, testInfo, boundary, true)
    for (const width of [320, 390, 559, 560, 767, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await card.scrollIntoViewIfNeeded()
      await settle(page)
      for (const orientation of orientations) {
        const handle = card.getByRole('separator', {
          name: `Resize ${orientation} primary region`,
        })
        await handle.focus()
        await handle.press('End')
        await expect(handle).toHaveAttribute('aria-valuenow', '0.8')
        await expectCompleteCard(card)
        await handle.press('Home')
        await expect(handle).toHaveAttribute('aria-valuenow', '0.2')
        await expectCompleteCard(card)
      }
    }
    await screenshot(
      page,
      testInfo,
      `${boundary ? 'boundary' : 'normal'}-compact-viewport`,
    )
  }
})
