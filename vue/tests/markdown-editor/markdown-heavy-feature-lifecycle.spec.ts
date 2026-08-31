import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  scheduler: {
    authority: string
    mutateCommits: number
    postPaintCommits: number
  }
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
  page.evaluate(() => {
    const encoded = document.querySelector<HTMLElement>(
      '[data-markdown-renderer="wasm"]',
    )?.dataset.markdownHeavyLifecycle
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
  phase: 'pending' | 'started' = 'started',
) =>
  page.evaluate(
    async ({ action: nextAction, phase: targetPhase, start: startInput }) => {
      const fixture = window.__FSUSUI_PERFORMANCE_FIXTURE__ as
        | { markdownHeavyLifecycleTransition?: HeavyLifecycleTransition }
        | undefined
      if (!fixture?.markdownHeavyLifecycleTransition) {
        throw new Error('markdown_heavy_lifecycle_transition_unavailable')
      }
      const selector =
        targetPhase === 'pending'
          ? 'iframe[data-fsus-markdown-heavy-pending="code-highlight"]'
          : 'iframe[data-fsus-markdown-heavy-work="code-highlight"]'
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
    { action, phase, start },
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
  expect(initial!.scheduler).toMatchObject({
    authority: 'markdown-editor-frame-scheduler@1',
  })
  expect(initial!.scheduler.mutateCommits).toBeGreaterThan(0)
  expect(initial!.scheduler.postPaintCommits).toBe(
    initial!.scheduler.mutateCommits,
  )
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

  const settledCycles: Array<{ cacheBytes: number; cacheEntries: number }> = []
  for (let cycle = 0; cycle < 3; cycle += 1) {
    for (const position of ['bottom', 'top'] as const) {
      await renderer.evaluate((element, nextPosition) => {
        element.scrollTop = nextPosition === 'bottom' ? element.scrollHeight : 0
        element.dispatchEvent(new Event('scroll'))
      }, position)
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let frames = 0
            const next = () => {
              frames += 1
              if (frames >= 4) resolve()
              else requestAnimationFrame(next)
            }
            requestAnimationFrame(next)
          }),
      )
      await expect
        .poll(async () => (await readMetrics(page))?.active ?? -1, {
          timeout: 60_000,
        })
        .toBe(0)
      await expect
        .poll(async () => (await readMetrics(page))?.retainedResources ?? -1)
        .toBe(0)
      const settled = (await readMetrics(page))!
      settledCycles.push({
        cacheBytes: settled.cacheBytes,
        cacheEntries: settled.cacheEntries,
      })
    }
  }
  expect(
    settledCycles.every(
      ({ cacheBytes, cacheEntries }) =>
        cacheEntries <= 128 && cacheBytes <= 4 * 1024 * 1024,
    ),
  ).toBe(true)
  expect(
    settledCycles.some(
      (entry, index) =>
        index > 0 &&
        entry.cacheEntries <= settledCycles[index - 1]!.cacheEntries &&
        entry.cacheBytes <= settledCycles[index - 1]!.cacheBytes,
    ),
  ).toBe(true)

  const beforeIdle = (await readMetrics(page))!
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let frames = 0
        const next = () => {
          frames += 1
          if (frames >= 30) resolve()
          else requestAnimationFrame(next)
        }
        requestAnimationFrame(next)
      }),
  )
  const afterIdle = (await readMetrics(page))!
  expect(afterIdle).toMatchObject({
    activations: beforeIdle.activations,
    retainedListeners: 0,
    retainedObservers: 0,
    retainedResources: 0,
    retainedRuntimes: 0,
    retainedTasks: 0,
    reuses: beforeIdle.reuses,
  })
  expect(
    await page.locator('iframe[data-fsus-markdown-heavy-work]').count(),
  ).toBe(0)

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

test('renders the static heavy feature matrix across themes, widths, and zoom', async ({
  page,
}, testInfo) => {
  const artifactRoot =
    process.env.FSUS_HEAVY_LIFECYCLE_EVIDENCE === '1' &&
    testInfo.project.name === 'chromium'
      ? resolve(
          'tests/conformance/visual/artifacts/screenshots/web/issue-641-heavy-lifecycle',
        )
      : null
  const renderedStates: Array<{
    active: number
    codeScrollLeft: number
    codeScrollMax: number
    documentOverflow: number
    retainedResources: number
    rendererOverflow: number
    screenshot: string | null
    screenshotScrollLeft: number | null
    theme: 'dark' | 'light'
    viewportWidth: number
    zoomPercent: number
  }> = []
  if (artifactRoot) mkdirSync(artifactRoot, { recursive: true })
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
  await expect
    .poll(async () => (await readMetrics(page))?.cacheEntries ?? 0, {
      timeout: 60_000,
    })
    .toBeGreaterThan(0)

  for (const theme of ['light', 'dark'] as const) {
    await transition(page, { theme })
    await expect
      .poll(async () => (await readMetrics(page))?.active ?? -1)
      .toBe(0)
    await expect
      .poll(async () => (await readMetrics(page))?.retainedResources ?? -1)
      .toBe(0)
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ height: 900, width })
      for (const zoom of [1, 1.5, 2]) {
        await renderer.evaluate((element, nextZoom) => {
          element.style.zoom = String(nextZoom)
        }, zoom)
        await expect(renderer).toBeVisible()
        await expect
          .poll(async () => (await readMetrics(page))?.active ?? -1)
          .toBe(0)
        await expect
          .poll(async () => (await readMetrics(page))?.retainedResources ?? -1)
          .toBe(0)
        const geometry = await renderer.evaluate((element) => {
          const code = element.querySelector<HTMLElement>('pre')
          if (code) code.scrollLeft = code.scrollWidth
          const codeScrollLeft = code?.scrollLeft ?? 0
          const codeScrollMax = code
            ? Math.max(0, code.scrollWidth - code.clientWidth)
            : 0
          if (code) code.scrollLeft = 0
          return {
            codeScrollLeft,
            codeScrollMax,
            documentOverflow:
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
            rendererOverflow: element.scrollWidth - element.clientWidth,
          }
        })
        expect(geometry.documentOverflow).toBeLessThanOrEqual(1)
        expect(geometry.rendererOverflow).toBeGreaterThanOrEqual(0)
        expect(geometry.codeScrollLeft).toBeGreaterThanOrEqual(
          geometry.codeScrollMax - 1,
        )
        const metrics = await readMetrics(page)
        const screenshotName =
          zoom > 1
            ? `${theme}-${width}-zoom-${Math.round(zoom * 100)}.png`
            : null
        const screenshotScrollLeft =
          zoom > 1
            ? await renderer.locator('pre').evaluate(
                (element) =>
                  new Promise<number>((resolveScrollLeft) => {
                    element.scrollLeft = 0
                    requestAnimationFrame(() =>
                      resolveScrollLeft(element.scrollLeft),
                    )
                  }),
              )
            : null
        if (screenshotScrollLeft !== null) {
          expect(screenshotScrollLeft).toBeLessThanOrEqual(1)
        }
        renderedStates.push({
          active: metrics?.active ?? -1,
          codeScrollLeft: geometry.codeScrollLeft,
          codeScrollMax: geometry.codeScrollMax,
          documentOverflow: geometry.documentOverflow,
          retainedResources: metrics?.retainedResources ?? -1,
          rendererOverflow: geometry.rendererOverflow,
          screenshot: screenshotName,
          screenshotScrollLeft,
          theme,
          viewportWidth: width,
          zoomPercent: Math.round(zoom * 100),
        })
        if (zoom > 1) {
          if (artifactRoot && screenshotName) {
            await renderer.screenshot({
              animations: 'disabled',
              path: resolve(artifactRoot, screenshotName),
            })
          } else {
            await testInfo.attach(
              `heavy-feature-${theme}-${width}-zoom-${Math.round(zoom * 100)}-${testInfo.project.name}`,
              {
                body: await renderer.screenshot({ animations: 'disabled' }),
                contentType: 'image/png',
              },
            )
          }
        }
      }
    }
  }
  if (artifactRoot) {
    writeFileSync(
      resolve(artifactRoot, 'render-manifest.json'),
      `${JSON.stringify(
        {
          browser: testInfo.project.name,
          productionFixture: true,
          reducedMotion: 'reduce',
          states: renderedStates,
        },
        null,
        2,
      )}\n`,
    )
  }
})

test('preserves heavy atomic source entry, Escape, and focus return in the real editor', async ({
  page,
}, testInfo) => {
  const artifactRoot =
    process.env.FSUS_HEAVY_LIFECYCLE_EVIDENCE === '1' &&
    testInfo.project.name === 'chromium'
      ? resolve(
          'tests/conformance/visual/artifacts/screenshots/web/issue-641-heavy-lifecycle',
        )
      : null
  const interactionStates: Array<{
    escapedSelectionEnd: number
    escapedSelectionStart: number
    focusedAfterEscape: boolean
    focusedInSource: boolean
    kind: 'code' | 'latex' | 'mermaid'
    sourceLength: number
    sourceUnchanged: boolean
    sourceSelectionEnd: number
    sourceSelectionStart: number
  }> = []
  if (artifactRoot) mkdirSync(artifactRoot, { recursive: true })
  await page.goto(
    '/?audit=ui-states&markdownEditorTransaction=1&markdownLanguageTools=1',
    { waitUntil: 'domcontentloaded' },
  )
  const fixture = page.getByTestId('markdown-editor-transaction-fixture')
  const textarea = fixture.locator('.el-markdown-editor textarea')
  const sections = [
    Object.freeze({
      kind: 'code',
      source: '```typescript\nconst value: number = 1\n```',
    }),
    Object.freeze({
      kind: 'mermaid',
      source: '```mermaid\ngraph TD\nA-->B\n```',
    }),
    Object.freeze({ kind: 'latex', source: '$$x^2 = 4$$' }),
  ] as const
  await expect(fixture).toBeVisible()
  const sourceTab = fixture.getByRole('tab', { name: '源码' })
  const liveTab = fixture.getByRole('tab', { name: '实时' })
  const body = fixture.locator('.el-markdown-editor__body')

  for (const section of sections) {
    await sourceTab.click()
    await expect(sourceTab).toHaveAttribute('aria-selected', 'true')
    await textarea.fill(section.source)
    await liveTab.click()
    await expect(liveTab).toHaveAttribute('aria-selected', 'true')
    await expect(fixture.locator('[data-markdown-atomic-actions]')).toHaveCount(
      1,
    )
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await fixture
      .getByRole('button', {
        includeHidden: true,
        name: `${section.kind} edit source`,
      })
      .click({ force: true })
    await expect(body).toHaveAttribute(
      'data-markdown-atomic-kind',
      section.kind,
    )
    await expect(body).toHaveAttribute('data-markdown-atomic-status', 'current')
    await expect(textarea).toBeFocused()
    await expect(textarea).toHaveJSProperty('selectionStart', 0)
    await expect(textarea).toHaveJSProperty('selectionEnd', 0)
    const sourceEntryState = await textarea.evaluate((element) => {
      const input = element as HTMLTextAreaElement
      return {
        focusedInSource: document.activeElement === input,
        sourceSelectionEnd: input.selectionEnd,
        sourceSelectionStart: input.selectionStart,
      }
    })

    await textarea.dispatchEvent('keydown', {
      bubbles: true,
      code: 'Escape',
      key: 'Escape',
    })
    await expect(textarea).toBeFocused()
    await expect(textarea).toHaveJSProperty(
      'selectionStart',
      section.source.length,
    )
    await expect(textarea).toHaveJSProperty(
      'selectionEnd',
      section.source.length,
    )
    await expect(textarea).toHaveValue(section.source)
    const escapedState = await textarea.evaluate((element, expectedSource) => {
      const input = element as HTMLTextAreaElement
      return {
        escapedSelectionEnd: input.selectionEnd,
        escapedSelectionStart: input.selectionStart,
        focusedAfterEscape: document.activeElement === input,
        sourceLength: expectedSource.length,
        sourceUnchanged: input.value === expectedSource,
      }
    }, section.source)
    interactionStates.push({
      kind: section.kind,
      ...sourceEntryState,
      ...escapedState,
    })
  }
  if (artifactRoot) {
    writeFileSync(
      resolve(artifactRoot, 'atomic-interaction-report.json'),
      `${JSON.stringify(
        {
          browser: testInfo.project.name,
          productionFixture: true,
          states: interactionStates,
        },
        null,
        2,
      )}\n`,
    )
  }
})

test('aborts real pending adapter work on interaction exits', async ({
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

  const documentSwitchSnapshot = await runAtCodeAdapterStarted(
    page,
    pendingInput,
    {
      input: {
        ...pendingInput,
        documentEpoch: 2,
        documentKey: 'heavy-document-b',
        revision: 3,
      },
      kind: 'transition',
    },
  )
  expect(documentSwitchSnapshot.count).toBeGreaterThan(0)
  expect(documentSwitchSnapshot.metrics?.retainedTasks).toBeGreaterThan(0)
  await expect
    .poll(async () => (await readMetrics(page))?.identity?.documentKey)
    .toBe('heavy-document-b')
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
          documentSwitchSnapshot.nodeKeys,
        ),
      { timeout: 60_000 },
    )
    .toBe(0)
  await expect
    .poll(async () => (await readMetrics(page))?.aborts ?? 0)
    .toBeGreaterThan(afterInteractionExit.aborts)
  await transition(page, {
    codeHighlight: false,
    documentEpoch: 2,
    documentKey: 'heavy-document-b',
    latex: false,
    mermaid: false,
    revision: 3,
    theme: 'dark',
  })
  await expect
    .poll(async () => (await readMetrics(page))?.retainedResources ?? -1)
    .toBe(0)
  await expect(activeFrame).toHaveCount(0)
})

test('aborts real pending adapter work on virtual unmount', async ({
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

  const restoredPendingInput = {
    codeHighlight: true,
    documentEpoch: 1,
    documentKey: 'heavy-document-a',
    latex: false,
    mermaid: false,
    revision: 4,
    sourcePrefix: [
      '```csharp',
      ...Array.from(
        { length: 20_000 },
        (_, index) => `int staleLifecycleMarker_${index} = ${index};`,
      ),
      '```',
      '',
    ].join('\n'),
  } as const
  const restoredPendingSnapshot = await runAtCodeAdapterStarted(
    page,
    restoredPendingInput,
    { kind: 'scroll-bottom' },
    'pending',
  )
  expect(restoredPendingSnapshot.count).toBeGreaterThan(0)
  expect(restoredPendingSnapshot.fullVirtualIndexReady).toBe(true)
  expect(restoredPendingSnapshot.sourceUnitConnected).toBe(true)
  expect(restoredPendingSnapshot.sourceUnitIndex).not.toBe('')
  expect(restoredPendingSnapshot.sourceUnitKey).not.toBe('')
  expect(restoredPendingSnapshot.metrics?.retainedTasks).toBeGreaterThan(0)
  expect(restoredPendingSnapshot.metrics!.activations).toBeGreaterThan(
    baseline.activations,
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
  const afterVirtualUnmount = (await readMetrics(page))!
  expect(afterVirtualUnmount.unmounted).toBeGreaterThan(
    restoredPendingSnapshot.metrics!.unmounted,
  )
  expect(afterVirtualUnmount.aborts).toBeGreaterThan(baseline.aborts)
  expect(afterVirtualUnmount.active).toBe(0)
  expect(afterVirtualUnmount.retainedListeners).toBe(0)
  expect(afterVirtualUnmount.retainedObservers).toBe(0)
  expect(afterVirtualUnmount.retainedResources).toBe(0)
  expect(afterVirtualUnmount.retainedRuntimes).toBe(0)
  expect(afterVirtualUnmount.retainedTasks).toBe(0)
  expect(afterVirtualUnmount.identity?.documentKey).toBe(
    restoredPendingInput.documentKey,
  )
  expect(afterVirtualUnmount.identity?.revision).toBe(
    `heavy-lifecycle-${restoredPendingInput.revision}`,
  )

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
