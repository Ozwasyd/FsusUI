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
    nodeId: string
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
        nodeId: string
        revision: number | string
        theme: string
      }
    >
  >
  identitySequences: Partial<
    Record<
      'code-highlight' | 'latex' | 'mermaid',
      readonly {
        config: string
        documentEpoch: number | string
        documentKey: string
        nodeId: string
        revision: number | string
        theme: string
      }[]
    >
  >
  projectionNodeIds: Partial<
    Record<'code-highlight' | 'latex' | 'mermaid', readonly string[]>
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
  latex?: boolean
  mermaid?: boolean
  revision?: number
  sourcePrefix?: string
  theme: 'dark' | 'light'
}) => Promise<void>

type HeavyLifecycleAbortProbe = () => Promise<{
  after: Record<'listeners' | 'observers' | 'runtimes' | 'tasks', number>
  before: Record<'listeners' | 'observers' | 'runtimes' | 'tasks', number>
  remainingFrames: number
  started: boolean
}>

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
}

test('renders heavy features with strict Trusted Types CSP', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(
    '**/?visual=basic&theme=light&performance=markdown-heavy-feature-lifecycle&size=100000&trusted-types=1',
    async (route) => {
      const response = await route.fetch()
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          'content-security-policy': [
            "default-src 'self'",
            "script-src 'self' 'wasm-unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "worker-src 'self' blob: data:",
            "frame-src 'self'",
            'trusted-types vue fsus-markdown-heavy-feature-fixture fsusui-markdown-feature',
            "require-trusted-types-for 'script'",
          ].join('; '),
        },
      })
    },
  )
  const response = await page.goto(
    '/?visual=basic&theme=light&performance=markdown-heavy-feature-lifecycle&size=100000&trusted-types=1',
    { waitUntil: 'domcontentloaded' },
  )
  expect(response?.headers()['content-security-policy']).toContain(
    "require-trusted-types-for 'script'",
  )
  await expect
    .poll(() => page.evaluate(() => typeof window.trustedTypes))
    .toBe('object')
  const fixture = page.locator(
    '[data-performance-scenario="markdown-heavy-feature-lifecycle"]',
  )
  await expect(fixture).toHaveAttribute('data-performance-ready', 'true', {
    timeout: 60_000,
  })
  await expect
    .poll(async () => (await readMetrics(page))?.cacheEntries ?? 0, {
      timeout: 60_000,
    })
    .toBeGreaterThan(0)
  await expect
    .poll(async () => (await readMetrics(page))?.retainedResources ?? -1)
    .toBe(0)
  expect(
    errors.filter((message) =>
      /trusted|content security policy|csp/iu.test(message),
    ),
  ).toEqual([])
})

type CodeAdapterStartedAction =
  | { kind: 'scroll-bottom' }
  | {
      input: Parameters<HeavyLifecycleTransition>[0]
      kind: 'transition'
    }

const runAtCodeAdapterStarted = (
  page: Page,
  start: Parameters<HeavyLifecycleTransition>[0],
  action: CodeAdapterStartedAction,
) =>
  page.evaluate(
    async ({ action: nextAction, start: startInput }) => {
      const fixture = window.__FSUSUI_PERFORMANCE_FIXTURE__ as
        | { markdownHeavyLifecycleTransition?: HeavyLifecycleTransition }
        | undefined
      if (!fixture?.markdownHeavyLifecycleTransition) {
        throw new Error('markdown_heavy_lifecycle_transition_unavailable')
      }
      const selector = 'iframe[data-fsus-markdown-heavy-work="code-highlight"]'
      const readFrameCount = () => document.querySelectorAll(selector).length
      const readStartedSnapshot = (count: number) => {
        const renderer = document.querySelector<HTMLElement>(
          '[data-markdown-renderer="wasm"]',
        )
        const marker = Array.from(
          renderer?.querySelectorAll<HTMLElement>('code') ?? [],
        ).find((element) =>
          element.textContent?.includes('staleLifecycleMarker_0'),
        )
        const sourceUnit = marker?.closest<HTMLElement>(
          '[data-fsus-render-unit-key]',
        )
        const bottomSpacer = renderer?.querySelector<HTMLElement>(
          '[data-fsus-render-spacer="bottom"]',
        )
        const encoded = renderer?.dataset.markdownHeavyLifecycle
        return {
          count,
          fullVirtualIndexReady:
            Boolean(
              renderer && renderer.scrollHeight > renderer.clientHeight,
            ) && Number.parseFloat(bottomSpacer?.style.height ?? '0') > 0,
          metrics: encoded ? (JSON.parse(encoded) as LifecycleMetrics) : null,
          nodeKeys: Array.from(
            document.querySelectorAll<HTMLIFrameElement>(selector),
            (frame) => frame.dataset.fsusMarkdownHeavyNode ?? '',
          ).filter(Boolean),
          sourceUnitConnected: sourceUnit?.isConnected ?? false,
          sourceUnitIndex: sourceUnit?.dataset.fsusRenderUnitIndex ?? '',
          sourceUnitKey: sourceUnit?.dataset.fsusRenderUnitKey ?? '',
        }
      }
      const started = new Promise<{
        count: number
        fullVirtualIndexReady: boolean
        metrics: LifecycleMetrics | null
        nodeKeys: string[]
        sourceUnitConnected: boolean
        sourceUnitIndex: string
        sourceUnitKey: string
      }>((resolve) => {
        const initial = readFrameCount()
        if (initial > 0) {
          resolve(readStartedSnapshot(initial))
          return
        }
        const observer = new MutationObserver(() => {
          const count = readFrameCount()
          if (count === 0) return
          observer.disconnect()
          clearTimeout(timeout)
          resolve(readStartedSnapshot(count))
        })
        const timeout = setTimeout(() => {
          observer.disconnect()
          resolve(readStartedSnapshot(0))
        }, 60_000)
        observer.observe(document.body, {
          attributes: true,
          childList: true,
          subtree: true,
        })
      })
      await fixture.markdownHeavyLifecycleTransition(startInput)
      let snapshot = await started
      if (snapshot.count === 0) return snapshot
      if (nextAction.kind === 'transition') {
        await fixture.markdownHeavyLifecycleTransition(nextAction.input)
      } else {
        for (let frame = 0; frame < 120; frame += 1) {
          snapshot = readStartedSnapshot(readFrameCount())
          if (snapshot.fullVirtualIndexReady || snapshot.count === 0) break
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          )
        }
        const renderer = document.querySelector<HTMLElement>(
          '[data-markdown-renderer="wasm"]',
        )
        if (!renderer) {
          throw new Error('markdown_heavy_lifecycle_renderer_unavailable')
        }
        renderer.scrollTop = renderer.scrollHeight
        renderer.dispatchEvent(new Event('scroll'))
      }
      return snapshot
    },
    { action, start },
  )

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
    .poll(async () => (await readMetrics(page))?.cacheEntries ?? 0, {
      timeout: 60_000,
    })
    .toBeGreaterThan(0)
  await expect
    .poll(async () =>
      Object.keys((await readMetrics(page))?.identities ?? {}).sort(),
    )
    .toEqual(['code-highlight', 'latex', 'mermaid'])

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
  const initialCodeNodeId = initial!.identities['code-highlight']!.nodeId
  const initialMountedUnits = await renderer
    .locator('[data-fsus-render-unit]')
    .count()
  expect(initialMountedUnits).toBeLessThan(3000)

  await renderer.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event('scroll'))
  })
  await expect
    .poll(async () => (await readMetrics(page))?.unmounted ?? 0, {
      timeout: 60_000,
    })
    .toBeGreaterThan(0)
  await expect
    .poll(async () => (await readMetrics(page))?.active ?? -1, {
      timeout: 60_000,
    })
    .toBe(0)
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

  const repeatedCodePrefix = [
    '```typescript',
    'const repeatedHeavyNode: number = 1',
    '```',
    '',
    '```typescript',
    'const repeatedHeavyNode: number = 1',
    '```',
    '',
  ].join('\n')
  await transition(page, {
    codeHighlight: true,
    documentEpoch: 1,
    documentKey: 'heavy-document-a',
    revision: 2,
    sourcePrefix: repeatedCodePrefix,
    theme: 'light',
  })
  await expect
    .poll(async () => (await readMetrics(page))?.identity?.revision)
    .toBe('heavy-lifecycle-2')
  await expect
    .poll(
      async () =>
        (await readMetrics(page))?.projectionNodeIds['code-highlight']
          ?.length ?? 0,
    )
    .toBeGreaterThanOrEqual(3)
  const repeatedCodeNodeIds = (await readMetrics(page))!.projectionNodeIds[
    'code-highlight'
  ]!
  expect(repeatedCodeNodeIds[0]).not.toBe(repeatedCodeNodeIds[1])
  expect(repeatedCodeNodeIds).toContain(initialCodeNodeId)

  await transition(page, {
    codeHighlight: true,
    documentEpoch: 1,
    documentKey: 'heavy-document-a',
    revision: 3,
    sourcePrefix: `Stable prefix inserted before repeated technical nodes.\n\n${repeatedCodePrefix}`,
    theme: 'light',
  })
  await expect
    .poll(async () => (await readMetrics(page))?.identity?.revision)
    .toBe('heavy-lifecycle-3')
  const afterSourceRevision = (await readMetrics(page))!
  expect(
    afterSourceRevision.projectionNodeIds['code-highlight']!.slice(0, 2),
  ).toEqual(repeatedCodeNodeIds.slice(0, 2))
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
    revision: 'heavy-lifecycle-3',
  })
  expect(afterDocumentSwitch.identity!.nodeId).not.toBe(
    afterSourceRevision.identity!.nodeId,
  )

  await transition(page, {
    codeHighlight: true,
    documentEpoch: 2,
    documentKey: 'heavy-document-b',
    revision: 4,
    sourcePrefix: '',
    theme: 'light',
  })
  await expect
    .poll(async () =>
      Object.keys((await readMetrics(page))?.identities ?? {}).sort(),
    )
    .toEqual(['code-highlight', 'latex', 'mermaid'])
  await expect
    .poll(async () => (await readMetrics(page))?.identity?.revision)
    .toBe('heavy-lifecycle-4')
  await expect.poll(async () => (await readMetrics(page))?.active ?? -1).toBe(0)

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
  await expect.poll(async () => (await readMetrics(page))?.active ?? -1).toBe(0)
  await expect
    .poll(async () => (await readMetrics(page))?.retainedResources ?? -1)
    .toBe(0)

  const beforeCodeDisable = (await readMetrics(page))!
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
  await expect
    .poll(async () => (await readMetrics(page))?.identities.latex?.theme)
    .toBe('token-bound')
  await expect
    .poll(async () => (await readMetrics(page))?.identities.mermaid?.theme)
    .toBe('dark')
  const afterCodeDisable = (await readMetrics(page))!
  expect(afterCodeDisable.activations).toBe(beforeCodeDisable.activations)
  expect(afterCodeDisable.cacheEntries).toBe(beforeCodeDisable.cacheEntries)
  expect(afterCodeDisable.identities.latex?.theme).toBe('token-bound')
  expect(afterCodeDisable.identities.mermaid?.theme).toBe('dark')

  const beforeCodeRestore = afterCodeDisable
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
  expect(afterConfigRestore.activations).toBe(beforeCodeRestore.activations)
  expect(afterConfigRestore.cacheEntries).toBe(beforeCodeRestore.cacheEntries)
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

  const abortProbe = await page.evaluate(async () => {
    const fixture = window.__FSUSUI_PERFORMANCE_FIXTURE__ as
      | { markdownHeavyLifecycleAbortProbe?: HeavyLifecycleAbortProbe }
      | undefined
    if (!fixture?.markdownHeavyLifecycleAbortProbe) {
      throw new Error('markdown_heavy_lifecycle_abort_probe_unavailable')
    }
    return fixture.markdownHeavyLifecycleAbortProbe()
  })
  expect(abortProbe).toEqual({
    after: { listeners: 0, observers: 0, runtimes: 0, tasks: 0 },
    before: { listeners: 2, observers: 0, runtimes: 1, tasks: 1 },
    remainingFrames: 0,
    started: true,
  })
})

test('aborts real pending adapter work on interaction exit and virtual unmount', async ({
  page,
}) => {
  await page.goto(
    '/?visual=basic&theme=light&performance=markdown-heavy-feature-lifecycle&size=100000',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.locator(
    '[data-performance-scenario="markdown-heavy-feature-lifecycle"]',
  )
  const renderer = page.locator('[data-markdown-renderer="wasm"]')
  const activeFrame = page.locator(
    'iframe[data-fsus-markdown-heavy-work="code-highlight"]',
  )
  await expect(fixture).toHaveAttribute('data-performance-ready', 'true')
  await expect
    .poll(async () => (await readMetrics(page))?.cacheEntries ?? 0, {
      timeout: 60_000,
    })
    .toBeGreaterThan(0)
  await expect.poll(async () => (await readMetrics(page))?.active ?? -1).toBe(0)
  const baseline = (await readMetrics(page))!
  const pendingSourcePrefix = [
    '```typescript',
    ...Array.from(
      { length: 20_000 },
      (_, index) => `const staleLifecycleMarker_${index}: number = ${index}`,
    ),
    '```',
    '',
  ].join('\n')
  const pendingInput = {
    codeHighlight: true,
    documentEpoch: 1,
    documentKey: 'heavy-document-a',
    latex: false,
    mermaid: false,
    revision: 2,
    sourcePrefix: pendingSourcePrefix,
    theme: 'dark',
  } as const
  const firstPendingSnapshot = await runAtCodeAdapterStarted(
    page,
    pendingInput,
    {
      input: {
        ...pendingInput,
        codeHighlight: false,
      },
      kind: 'transition',
    },
  )
  expect(firstPendingSnapshot.count).toBeGreaterThan(0)
  expect(firstPendingSnapshot.metrics?.retainedTasks).toBeGreaterThan(0)
  const firstPending = firstPendingSnapshot.metrics!
  expect(firstPending.retainedRuntimes).toBeGreaterThan(0)

  await expect(activeFrame).toHaveCount(0)
  await expect.poll(async () => (await readMetrics(page))?.active ?? -1).toBe(0)
  await expect
    .poll(async () => (await readMetrics(page))?.retainedResources ?? -1)
    .toBe(0)
  await expect
    .poll(async () => (await readMetrics(page))?.aborts ?? baseline.aborts)
    .toBeGreaterThan(baseline.aborts)
  await expect
    .poll(async () => (await readMetrics(page))?.stale ?? baseline.stale)
    .toBeGreaterThan(baseline.stale)
  const afterInteractionExit = (await readMetrics(page))!
  expect(afterInteractionExit.cacheEntries).toBe(baseline.cacheEntries)

  const restoredPendingSnapshot = await runAtCodeAdapterStarted(
    page,
    pendingInput,
    { kind: 'scroll-bottom' },
  )
  expect(restoredPendingSnapshot.count).toBeGreaterThan(0)
  expect(restoredPendingSnapshot.fullVirtualIndexReady).toBe(true)
  expect(restoredPendingSnapshot.sourceUnitConnected).toBe(true)
  expect(restoredPendingSnapshot.sourceUnitIndex).not.toBe('')
  expect(restoredPendingSnapshot.sourceUnitKey).not.toBe('')
  expect(restoredPendingSnapshot.metrics?.retainedTasks).toBeGreaterThan(0)
  expect(restoredPendingSnapshot.metrics!.activations).toBeGreaterThan(
    afterInteractionExit.activations,
  )
  expect(restoredPendingSnapshot.nodeKeys.length).toBeGreaterThan(0)

  await expect
    .poll(
      () =>
        renderer.evaluate((element, sourceUnitKey) => {
          const units = Array.from(
            element.querySelectorAll<HTMLElement>(
              '[data-fsus-render-unit-key]',
            ),
          )
          return {
            bottomSpacer: Number.parseFloat(
              element.querySelector<HTMLElement>(
                '[data-fsus-render-spacer="bottom"]',
              )?.style.height ?? '0',
            ),
            clientHeight: element.clientHeight,
            markerCount: Array.from(element.querySelectorAll('code')).filter(
              (code) => code.textContent?.includes('staleLifecycleMarker_0'),
            ).length,
            scrollHeight: element.scrollHeight,
            scrollTop: element.scrollTop,
            sourceUnitCount: units.filter(
              (unit) => unit.dataset.fsusRenderUnitKey === sourceUnitKey,
            ).length,
            topSpacer: Number.parseFloat(
              element.querySelector<HTMLElement>(
                '[data-fsus-render-spacer="top"]',
              )?.style.height ?? '0',
            ),
            visibleIndexes: units.map(
              (unit) => unit.dataset.fsusRenderUnitIndex ?? '',
            ),
          }
        }, restoredPendingSnapshot.sourceUnitKey),
      { timeout: 60_000 },
    )
    .toMatchObject({ markerCount: 0, sourceUnitCount: 0 })

  await expect
    .poll(
      () =>
        page.evaluate(
          (nodeKeys) =>
            Array.from(
              document.querySelectorAll<HTMLIFrameElement>(
                'iframe[data-fsus-markdown-heavy-node]',
              ),
              (frame) => frame.dataset.fsusMarkdownHeavyNode ?? '',
            ).filter((key) => nodeKeys.includes(key)).length,
          restoredPendingSnapshot.nodeKeys,
        ),
      { timeout: 60_000 },
    )
    .toBe(0)
  await expect
    .poll(
      async () =>
        (await readMetrics(page))?.unmounted ??
        restoredPendingSnapshot.metrics!.unmounted,
    )
    .toBeGreaterThan(restoredPendingSnapshot.metrics!.unmounted)
  await expect
    .poll(
      async () =>
        (await readMetrics(page))?.aborts ?? afterInteractionExit.aborts,
    )
    .toBeGreaterThan(afterInteractionExit.aborts)
  await expect
    .poll(async () => (await readMetrics(page))?.retainedResources ?? -1)
    .toBe(0)
  expect((await readMetrics(page))?.identity?.documentKey).toBe(
    pendingInput.documentKey,
  )
  expect((await readMetrics(page))?.identity?.revision).toBe(
    `heavy-lifecycle-${pendingInput.revision}`,
  )
  await expect(renderer).not.toContainText('staleLifecycleMarker_0')

  await transition(page, {
    codeHighlight: true,
    documentEpoch: 1,
    documentKey: 'heavy-document-a',
    revision: 3,
    sourcePrefix:
      '```typescript\nconst currentLifecycleMarker: number = 2\n```\n\n',
    latex: false,
    mermaid: false,
    theme: 'dark',
  })
  await renderer.evaluate((element) => {
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll'))
  })
  await expect
    .poll(async () => (await readMetrics(page))?.identity?.revision, {
      timeout: 60_000,
    })
    .toBe('heavy-lifecycle-3')
  await expect(renderer).toContainText('currentLifecycleMarker')
  await expect(renderer).not.toContainText('staleLifecycleMarker_0')
  await expect(activeFrame).toHaveCount(0, { timeout: 60_000 })
  await expect
    .poll(async () => (await readMetrics(page))?.retainedResources ?? -1)
    .toBe(0)
})
