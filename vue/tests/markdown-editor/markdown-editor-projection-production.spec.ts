import { expect, test } from '@playwright/test'

test('projects image and caption identically in the built demo window and Worker', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })

  await page.goto('/?audit=ui-states&markdownProjection=1', {
    waitUntil: 'domcontentloaded',
  })

  const fixture = page.getByTestId('markdown-projection-production-fixture')
  await expect(fixture).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await expect(page.getByTestId('markdown-projection-worker')).toContainText(
    '"equivalent":true',
  )

  await expect
    .poll(async () =>
      fixture
        .locator('[data-markdown-live-decorations] [data-kind]')
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('data-kind')),
        ),
    )
    .toEqual(expect.arrayContaining(['image', 'caption']))

  const main = JSON.parse(
    (await page.getByTestId('markdown-projection-main').textContent()) ??
      'null',
  )
  const worker = JSON.parse(
    (await page.getByTestId('markdown-projection-worker').textContent()) ??
      'null',
  )
  expect(worker.equivalent).toBe(true)
  expect(worker.identity).toEqual(main.identity)
  expect(worker.kinds).toEqual(main.kinds)
  expect(worker.nodes).toEqual(main.nodes)
  expect(main.nodes.map((node: { kind: string }) => node.kind)).toEqual([
    'image',
    'caption',
  ])
  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
