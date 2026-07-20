import { expect, test } from '@playwright/test'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'

const requiredStates = [
  'loading',
  'ready',
  'verifying',
  'retryable',
  'reissue',
  'expired',
  'unavailable',
  'disabled',
] as const

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
})

test('covers all states, alternatives, labels, focus order, and responsive raster', async ({
  page,
}, testInfo) => {
  const variant = resolveVisualVariant(testInfo.project.name)
  await page.goto(
    buildVisualUrl('character-challenge-conformance', testInfo.project.name),
    { waitUntil: 'networkidle' },
  )

  const fixtures = page.locator('.character-conformance__fixture')
  await expect(fixtures).toHaveCount(requiredStates.length)
  for (const state of requiredStates) {
    await expect(page.locator(`[data-state="${state}"]`)).toBeVisible()
  }

  const ready = page.locator('[data-state="ready"]')
  const input = ready.getByLabel('Character response')
  const image = ready.getByRole('img', { name: 'Characters to transcribe' })
  await expect(image).toBeVisible()
  await expect(input).toBeVisible()
  await expect(input).toHaveAttribute('aria-describedby', /-status/)
  await ready.getByRole('button', { name: 'Use audio instead' }).click()
  const audio = ready.locator('audio')
  await expect(audio).toBeVisible()
  await expect(audio).not.toHaveAttribute('autoplay', /.*/)
  expect(await audio.evaluate((element) => element.paused)).toBe(true)

  const retryable = page.locator('[data-state="retryable"]')
  const retryInput = retryable.getByLabel('Character response')
  await expect(retryInput).toHaveAttribute('aria-invalid', 'true')
  await expect(retryInput).toHaveAttribute('aria-describedby', /-error/)
  await retryInput.focus()
  await expect(retryInput).toBeFocused()

  const order = await retryable
    .locator('button, input, audio')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-test')).filter(Boolean),
    )
  expect(order).toEqual([
    'perception-character-alternative',
    'perception-character-refresh',
    'perception-character-input',
    'perception-character-submit',
    'perception-character-retry',
  ])

  await testInfo.attach(
    `character-conformance-${variant.viewportClass}-${variant.theme}`,
    {
      body: await page
        .locator('[data-testid="character-conformance"]')
        .screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    },
  )
})

test('reduced motion preserves availability and DOM order', async ({
  page,
}, testInfo) => {
  await page.goto(
    buildVisualUrl('character-challenge-conformance', testInfo.project.name),
    { waitUntil: 'networkidle' },
  )
  const ready = page.locator('[data-state="ready"]')
  const snapshot = () =>
    ready.locator('button, input, audio').evaluateAll((nodes) =>
      nodes.map((node) => ({
        test: node.getAttribute('data-test'),
        disabled: (node as HTMLButtonElement | HTMLInputElement).disabled,
      })),
    )

  const fullMotion = await snapshot()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedMotion = await snapshot()
  expect(reducedMotion).toEqual(fullMotion)
  await expect(ready.getByLabel('Character response')).toBeEnabled()
})

test('forced colors retains boundaries, focus, controls, and error state', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' })
  await page.goto(
    buildVisualUrl('character-challenge-conformance', testInfo.project.name),
    { waitUntil: 'networkidle' },
  )
  const retryable = page.locator('[data-state="retryable"]')
  const input = retryable.getByLabel('Character response')
  await input.focus()
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(
    await retryable.evaluate((node) => getComputedStyle(node).borderStyle),
  ).not.toBe('none')
  await expect(
    retryable.getByRole('button', { name: 'Retry response' }),
  ).toBeVisible()
})
