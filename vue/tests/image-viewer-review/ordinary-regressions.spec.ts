import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const open = async (page: Page, query = '') => {
  await page.goto(`/${query}`)
  await page.getByRole('button', { name: 'Open viewer', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'Review viewer' }),
  ).toBeVisible()
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: 'Large source image', exact: true })
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(2400)
}

test('an appended Dialog above the viewer remains interactive and restores ownership', async ({
  page,
}) => {
  await open(page)
  await page
    .getByRole('button', { name: 'Open nested dialog', exact: true })
    .click()
  const action = page.getByText('Nested action', { exact: true })
  await expect(action).toBeVisible()
  expect(
    await action.evaluate((element) => Boolean(element.closest('[inert]'))),
  ).toBe(false)
  await action.focus()
  await expect(action).toBeFocused()
  await action.click()
  await expect(page.getByRole('dialog', { name: 'Nested dialog' })).toBeHidden()
  await expect(
    page.getByRole('button', { name: 'Open nested dialog', exact: true }),
  ).toBeFocused()
  expect(
    await page
      .getByRole('button', { name: 'Background action', includeHidden: true })
      .evaluate((element) => Boolean(element.closest('[inert]'))),
  ).toBe(true)
  await page.getByRole('button', { name: 'Close viewer', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Open viewer', exact: true }),
  ).toBeFocused()
})

test('ordinary wheel input scrolls the long caption without zooming the image', async ({
  page,
}) => {
  await open(page)
  const caption = page.getByRole('region', { name: 'Long caption' })
  const scroll = () =>
    caption.evaluate((element) => {
      const port = element.parentElement!
      return {
        top: port.scrollTop,
        content: port.scrollHeight,
        viewport: port.clientHeight,
      }
    })
  const before = await scroll()
  expect(before.content).toBeGreaterThan(before.viewport)
  const transform = await page
    .getByRole('img', { name: 'Large source image', exact: true })
    .evaluate((element) => getComputedStyle(element).transform)
  const port = await caption.evaluate((element) => {
    const bounds = element.parentElement!.getBoundingClientRect()
    return { x: bounds.x, y: bounds.y, height: bounds.height }
  })
  await page.mouse.move(port.x + 40, port.y + Math.min(70, port.height - 5))
  await page.mouse.wheel(0, 240)
  await expect
    .poll(async () => (await scroll()).top)
    .toBeGreaterThan(before.top)
  expect(
    await page
      .getByRole('img', { name: 'Large source image', exact: true })
      .evaluate((element) => getComputedStyle(element).transform),
  ).toBe(transform)
})

for (const csp of ['0', '1']) {
  test(`original size restores intrinsic dimensions and can return to contain (csp=${csp})`, async ({
    page,
  }) => {
    await open(page, `?caption=0&csp=${csp}`)
    const image = page.getByRole('img', {
      name: 'Large source image',
      exact: true,
    })
    const width = () =>
      image.evaluate((element) => element.getBoundingClientRect().width)
    const contained = await width()
    expect(contained).toBeLessThan(2400)
    await page
      .getByRole('button', { name: 'Toggle original size', exact: true })
      .click()
    await expect.poll(width).toBeCloseTo(2400, 0)
    await page
      .getByRole('button', { name: 'Toggle original size', exact: true })
      .click()
    await expect.poll(width).toBeCloseTo(contained, 0)
  })
}
