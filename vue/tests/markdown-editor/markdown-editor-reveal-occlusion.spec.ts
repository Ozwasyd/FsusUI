import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const fixture = `/@fs${resolve('vue/tests/markdown-editor/reveal-occlusion.fixture.html')}`

test('refuses the independently reported opaque strip between the old three points', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(fixture)
  await page.evaluate(() => document.fonts.ready)
  await page.getByTestId('run').click()
  await expect(page.locator('#partial-occlusion')).toBeVisible()
  const rect = await page.locator('#partial-occlusion').boundingBox()
  expect(rect!.width).toBe(5)
  expect(rect!.height).toBe(18)
  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x + 2, y + 2)?.id,
      rect!,
    ),
  ).toBe('partial-occlusion')
  await expect(page.getByTestId('outcome')).toContainText(
    'markdown-editor-reveal-timeout',
  )
  await expect(page.getByTestId('outcome')).not.toContainText('"completion"')
  await expect(page.locator('textarea')).toBeFocused()
  expect(
    await page
      .locator('textarea')
      .evaluate((input: HTMLTextAreaElement) => [
        input.selectionStart,
        input.selectionEnd,
        input.selectionDirection,
      ]),
  ).toEqual([3830, 3842, 'backward'])
  await page.screenshot({ path: testInfo.outputPath('partial-occlusion.png') })
})

for (const [kind, range] of [
  ['pointer-none', 'single'],
  ['middle-fragment', 'multiline'],
  ['last-fragment', 'multiline'],
] as const) {
  test(`refuses ${kind} coverage of the ${range} selection`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`${fixture}?kind=${kind}&range=${range}`)
    await page.evaluate(() => document.fonts.ready)
    await page.getByTestId('run').click()
    await expect(page.locator('#partial-occlusion')).toBeVisible()
    await expect(page.getByTestId('outcome')).toContainText(
      'markdown-editor-reveal-timeout',
    )
    const outcome = JSON.parse(
      (await page.getByTestId('outcome').textContent())!,
    )
    expect(outcome.completion).toBeUndefined()
    expect(outcome.trace.at(-1).overlayPresent).toBe(true)
    if (range === 'multiline')
      expect(outcome.trace[0].fragments.length).toBeGreaterThan(2)
    if (kind === 'pointer-none')
      expect(outcome.trace[0].hit).not.toBe('partial-occlusion')
    expectReleased(outcome)
  })
}

const expectReleased = (outcome: {
  trace: Array<{
    resources?: {
      participants: Array<{
        ownerRef: string
        usage: { observers: number; timers: number }
      }>
    }
  }>
}) => {
  const layout = outcome.trace
    .at(-1)!
    .resources!.participants.find(
      (participant) => participant.ownerRef === 'editor-layout-callbacks',
    )!
  expect(layout.usage.observers).toBe(0)
  expect(layout.usage.timers).toBe(0)
}

test('acknowledges every fragment of an unobstructed multiline selection', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${fixture}?kind=clear&range=multiline&timeout=1500`)
  await page.evaluate(() => document.fonts.ready)
  await page.getByTestId('run').click()
  await expect(page.getByTestId('outcome')).toContainText(
    'full-selection-visible',
  )
  const outcome = JSON.parse((await page.getByTestId('outcome').textContent())!)
  expect(outcome.trace[0].fragments.length).toBeGreaterThan(2)
  const input = page.locator('textarea')
  await expect(input).toBeFocused()
  expect(
    await input.evaluate((element: HTMLTextAreaElement) => ({
      start: element.selectionStart,
      end: element.selectionEnd,
      direction: element.selectionDirection,
    })),
  ).toEqual(outcome.completion.selection)
  const bounds = await input.boundingBox()
  for (const fragment of outcome.trace[0].fragments) {
    expect(fragment.top).toBeGreaterThanOrEqual(bounds!.y)
    expect(fragment.bottom).toBeLessThanOrEqual(bounds!.y + bounds!.height)
  }
  expectReleased(outcome)
})

test('waits for real overlay removal and a fresh unobstructed native observation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`${fixture}?timeout=1500`)
  await page.evaluate(() => document.fonts.ready)
  await page.getByTestId('run').click()
  await expect(page.locator('#partial-occlusion')).toBeVisible()
  await page.waitForTimeout(200)
  await expect(page.getByTestId('outcome')).toHaveText('pending')
  const removedAt = await page.evaluate(() => {
    document.getElementById('partial-occlusion')!.remove()
    return performance.now()
  })
  await expect(page.getByTestId('outcome')).toContainText(
    'full-selection-visible',
  )
  const outcome = JSON.parse((await page.getByTestId('outcome').textContent())!)
  expect(outcome.trace.at(-1).overlayPresent).toBe(false)
  expect(outcome.trace.at(-1).time).toBeGreaterThan(removedAt)
  expectReleased(outcome)
})

test('does not acknowledge continuously moving source geometry', async ({
  page,
}) => {
  await page.goto(`${fixture}?kind=moving`)
  await page.evaluate(() => document.fonts.ready)
  await page.getByTestId('run').click()
  await expect(page.getByTestId('outcome')).toContainText(
    'markdown-editor-reveal-timeout',
  )
  const outcome = JSON.parse((await page.getByTestId('outcome').textContent())!)
  expect(outcome.completion).toBeUndefined()
  expectReleased(outcome)
})

test('aborts while a real overlay still covers the selected source', async ({
  page,
}) => {
  await page.goto(`${fixture}?kind=abort`)
  await page.evaluate(() => document.fonts.ready)
  await page.getByTestId('run').click()
  await expect(page.getByTestId('outcome')).toContainText(
    'markdown-editor-reveal-aborted',
  )
  const outcome = JSON.parse((await page.getByTestId('outcome').textContent())!)
  expect(outcome.trace.at(-1).overlayPresent).toBe(true)
  expect(outcome.completion).toBeUndefined()
  expectReleased(outcome)
})
