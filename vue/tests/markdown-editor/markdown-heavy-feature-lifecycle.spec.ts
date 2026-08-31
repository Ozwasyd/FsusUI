import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type LifecycleMetrics = {
  aborts: number
  active: number
  activations: number
  cacheBytes: number
  cacheEntries: number
  evictions: number
  identity: {
    config: string
    documentEpoch: number | string
    documentKey: string
    revision: number | string
    theme: string
  } | null
  identities: Partial<
    Record<
      'code-highlight' | 'latex' | 'mermaid',
      {
        config: string
        documentEpoch: number | string
        documentKey: string
        revision: number | string
        theme: string
      }
    >
  >
  retainedResources: number
  retainedListeners: number
  retainedObservers: number
  retainedRuntimes: number
  retainedTasks: number
  reuses: number
  stale: number
  static: number
  teardowns: number
  unmounted: number
}

type HeavyLifecycleTransition = (input: {
  codeHighlight: boolean
  documentEpoch: number
  documentKey: string
  theme: 'dark' | 'light'
}) => Promise<void>

const readMetrics = async (page: Page) =>
  page.locator('[data-markdown-renderer="wasm"]').evaluate((element) => {
    const encoded = (element as HTMLElement).dataset.markdownHeavyLifecycle
    return encoded ? (JSON.parse(encoded) as LifecycleMetrics) : null
  })

const transition = async (
  page: Page,
  input: Parameters<HeavyLifecycleTransition>[0],
) => {
  await page.evaluate(async (next) => {
    const fixture = window.__FSUSUI_PERFORMANCE_FIXTURE__ as
      | { markdownHeavyLifecycleTransition?: HeavyLifecycleTransition }
      | undefined
    if (!fixture?.markdownHeavyLifecycleTransition) {
      throw new Error('markdown_heavy_lifecycle_transition_unavailable')
    }
    await fixture.markdownHeavyLifecycleTransition(next)
  }, input)
  const renderer = page.locator('[data-markdown-renderer="wasm"]')
  await renderer.evaluate((element) => {
    element.scrollTop = Math.min(
      element.scrollHeight - element.clientHeight,
      element.scrollTop + element.clientHeight,
    )
    element.dispatchEvent(new Event('scroll'))
  })
}

test('bounds mixed heavy feature lifecycle across virtual remounts', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(
    '/?visual=basic&theme=light&performance=markdown-heavy-feature-lifecycle&size=100000',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.locator(
    '[data-performance-scenario="markdown-heavy-feature-lifecycle"]',
  )
  const renderer = page.locator('[data-markdown-renderer="wasm"]')
  await expect(fixture).toHaveAttribute('data-performance-ready', 'true')
  await expect(renderer).toBeVisible()
  await expect
    .poll(async () => (await readMetrics(page))?.cacheEntries ?? 0)
    .toBeGreaterThan(0)

  const initial = await readMetrics(page)
  expect(initial).toMatchObject({
    active: 0,
    retainedListeners: 0,
    retainedObservers: 0,
    retainedResources: 0,
    retainedRuntimes: 0,
    retainedTasks: 0,
  })
  expect(initial!.cacheEntries).toBeLessThanOrEqual(128)
  expect(initial!.cacheBytes).toBeLessThanOrEqual(4 * 1024 * 1024)
  expect(initial!.identities['code-highlight']).toMatchObject({
    config: '{}',
    theme: 'light',
  })
  expect(initial!.identities.latex).toMatchObject({
    theme: 'token-bound',
  })
  expect(initial!.identities.mermaid?.config).toContain('"tokens"')
  const initialMountedUnits = await renderer
    .locator('[data-fsus-render-unit]')
    .count()
  expect(initialMountedUnits).toBeLessThan(3000)

  await renderer.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event('scroll'))
  })
  await expect
    .poll(async () => (await readMetrics(page))?.unmounted ?? 0)
    .toBeGreaterThan(0)
  await expect.poll(async () => (await readMetrics(page))?.active ?? -1).toBe(0)
  const afterBottom = await readMetrics(page)
  expect(afterBottom!.cacheEntries).toBeLessThanOrEqual(128)
  expect(afterBottom!.cacheBytes).toBeLessThanOrEqual(4 * 1024 * 1024)
  expect(afterBottom).toMatchObject({
    retainedListeners: 0,
    retainedObservers: 0,
    retainedResources: 0,
    retainedRuntimes: 0,
    retainedTasks: 0,
  })

  await renderer.evaluate((element) => {
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll'))
  })
  await expect
    .poll(async () => (await readMetrics(page))?.reuses ?? 0)
    .toBeGreaterThan(0)
  await expect.poll(async () => (await readMetrics(page))?.active ?? -1).toBe(0)

  const beforeIdentitySwitches = (await readMetrics(page))!
  await transition(page, {
    codeHighlight: true,
    documentEpoch: 2,
    documentKey: 'heavy-document-b',
    theme: 'light',
  })
  await expect
    .poll(async () => (await readMetrics(page))?.identity?.documentKey)
    .toBe('heavy-document-b')
  const afterDocumentSwitch = (await readMetrics(page))!
  expect(afterDocumentSwitch.reuses).toBe(beforeIdentitySwitches.reuses)
  expect(afterDocumentSwitch.identity).toMatchObject({
    documentEpoch: 2,
    revision: 'heavy-lifecycle-1',
  })

  await transition(page, {
    codeHighlight: true,
    documentEpoch: 2,
    documentKey: 'heavy-document-b',
    theme: 'dark',
  })
  await expect
    .poll(
      async () =>
        (await readMetrics(page))?.identities['code-highlight']?.theme,
    )
    .toBe('dark')
  const afterThemeSwitch = (await readMetrics(page))!
  expect(afterThemeSwitch.identities.mermaid?.theme).toBe('dark')
  expect(afterThemeSwitch.identities.latex?.theme).toBe('token-bound')

  const beforeCodeDisable = afterThemeSwitch.reuses
  await transition(page, {
    codeHighlight: false,
    documentEpoch: 2,
    documentKey: 'heavy-document-b',
    theme: 'dark',
  })
  await expect
    .poll(
      async () =>
        (await readMetrics(page))?.identities['code-highlight'] ?? null,
    )
    .toBeNull()
  const afterCodeDisable = (await readMetrics(page))!
  expect(afterCodeDisable.reuses).toBeGreaterThan(beforeCodeDisable)
  expect(afterCodeDisable.identities.latex?.theme).toBe('token-bound')
  expect(afterCodeDisable.identities.mermaid?.theme).toBe('dark')

  const beforeCodeRestore = afterCodeDisable.reuses
  await transition(page, {
    codeHighlight: true,
    documentEpoch: 2,
    documentKey: 'heavy-document-b',
    theme: 'dark',
  })
  await expect
    .poll(
      async () =>
        (await readMetrics(page))?.identities['code-highlight']?.config,
    )
    .toBe('{}')
  await expect.poll(async () => (await readMetrics(page))?.active ?? -1).toBe(0)
  await expect
    .poll(async () => (await readMetrics(page))?.retainedResources ?? -1)
    .toBe(0)
  const afterConfigRestore = (await readMetrics(page))!
  expect(afterConfigRestore.reuses).toBeGreaterThan(beforeCodeRestore)
  expect(afterConfigRestore.active).toBe(0)
  expect(afterConfigRestore.retainedResources).toBe(0)

  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ height: 900, width })
    for (const zoom of [1, 1.5, 2]) {
      await page.evaluate((nextZoom) => {
        document.documentElement.style.zoom = String(nextZoom)
      }, zoom)
      await expect(renderer).toBeVisible()
      expect((await readMetrics(page))?.retainedResources).toBe(0)
    }
  }

  await testInfo.attach(`heavy-feature-lifecycle-${testInfo.project.name}`, {
    body: await renderer.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})
