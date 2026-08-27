import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

import type { Locator, Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const artifactRoot = resolve(
  process.cwd(),
  'tests/conformance/visual/artifacts/issue-381-390',
)
const diagnostics = new WeakMap<Page, string[]>()

const openFixture = async (
  page: Page,
  options: { readonly theme?: 'dark' | 'light'; readonly touch?: boolean } = {},
) => {
  const query = new URLSearchParams({
    audit: 'ui-states',
    markdownSearchEmbed: '1',
    theme: options.theme ?? 'light',
  })
  if (options.touch) query.set('markdownSearchEmbedTouch', '1')
  await page.goto(`/?${query.toString()}`, { waitUntil: 'domcontentloaded' })
  const fixture = page.getByTestId('markdown-search-embed-fixture')
  await expect(fixture).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  return {
    editor: fixture.getByTestId('markdown-search-embed-editor'),
    fixture,
    root: fixture.locator('.el-markdown-editor'),
    textarea: fixture.locator('.el-markdown-editor__textarea'),
  }
}

const openFind = async (fixture: Locator, query: string) => {
  await fixture.getByTestId('markdown-search-embed-open-find').click()
  const input = fixture.getByTestId('markdown-search-query')
  await expect(input).toBeFocused()
  await input.fill(query)
  return input
}

const sourceValue = async (fixture: Locator) =>
  (
    await fixture.getByTestId('markdown-search-embed-value').textContent()
  )?.trim() ?? ''

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }, testInfo) => {
  const actionableDiagnostics = (diagnostics.get(page) ?? []).filter(
    (diagnostic) =>
      !(
        testInfo.project.name === 'firefox' &&
        diagnostic.includes('scroll-linked positioning effect')
      ),
  )
  expect(actionableDiagnostics).toEqual([])
})

test('keeps search identity, ranges, geometry, and focus stable across all four modes', async ({
  page,
}, testInfo) => {
  const { fixture, root, textarea } = await openFixture(page)
  const sourceBefore = await sourceValue(fixture)
  const instanceBefore = await root.getAttribute('data-markdown-instance')
  const rootBefore = await root.boundingBox()
  const bodyBefore = await root
    .locator('.el-markdown-editor__body')
    .boundingBox()
  expect(rootBefore).not.toBeNull()
  expect(bodyBefore).not.toBeNull()

  await textarea.focus()
  await textarea.press('ControlOrMeta+f')
  const query = fixture.getByTestId('markdown-search-query')
  await expect(query).toBeFocused()
  await query.fill('alpha')
  await expect(fixture.getByTestId('markdown-search-count')).toHaveText(
    '1 of 3',
  )
  await query.fill('does-not-exist')
  await expect(fixture.getByTestId('markdown-search-count')).toHaveText(
    'No matches',
  )
  await query.fill('😀')
  await expect(fixture.getByTestId('markdown-search-count')).toHaveText(
    '1 of 1',
  )
  await query.fill('alpha|café')
  await fixture.getByRole('button', { name: 'Use Regular Expression' }).click()
  await expect(fixture.getByTestId('markdown-search-count')).toHaveText(
    '1 of 4',
  )
  await fixture.getByRole('button', { name: 'Use Regular Expression' }).click()
  await query.fill('alpha')

  const rootAfter = await root.boundingBox()
  const bodyAfter = await root
    .locator('.el-markdown-editor__body')
    .boundingBox()
  expect(rootAfter?.height).toBeCloseTo(rootBefore!.height, 0)
  expect(bodyAfter?.width).toBeCloseTo(bodyBefore!.width, 0)
  expect(await root.getAttribute('data-markdown-scroll-container')).toBe('body')
  expect(await sourceValue(fixture)).toBe(sourceBefore)

  for (const mode of ['source', 'live', 'split', 'preview'] as const) {
    await fixture.getByTestId(`markdown-search-embed-mode-${mode}`).click()
    await expect(fixture.getByTestId('markdown-search-embed-mode')).toHaveText(
      mode,
    )
    await expect(fixture.getByTestId('markdown-search-count')).toHaveText(
      '1 of 3',
    )
    expect(await root.getAttribute('data-markdown-instance')).toBe(
      instanceBefore,
    )
    expect(await sourceValue(fixture)).toBe(sourceBefore)
    if (mode === 'source' || mode === 'live') {
      await expect(root.locator('.el-markdown-editor__preview')).toHaveCount(0)
      await expect(root.locator('.el-markdown-embed')).toHaveCount(0)
    } else {
      await expect(root.locator('.el-markdown-editor__preview')).toBeVisible()
      await expect(root.locator('.el-markdown-embed')).toHaveCount(8)
    }
    if (mode === 'preview') {
      await expect(textarea).toBeHidden()
    } else {
      await expect(textarea).toBeVisible()
    }
  }

  await fixture.getByTestId('markdown-search-next').click()
  await expect(fixture.getByTestId('markdown-search-count')).toHaveText(
    '2 of 3',
  )
  await fixture.getByTestId('markdown-search-prev').click()
  await expect(fixture.getByTestId('markdown-search-count')).toHaveText(
    '1 of 3',
  )

  if (testInfo.project.name === 'chromium') {
    await mkdir(artifactRoot, { recursive: true })
    await root.screenshot({
      animations: 'disabled',
      path: resolve(artifactRoot, 'candidate-search-preview-desktop-light.png'),
    })
  }

  await fixture.getByTestId('markdown-search-close').click()
  await expect(root).toBeFocused()

  const rendererMutationSurface = root.locator(
    '.el-markdown-editor__preview .el-markdown-renderer',
  )
  await expect(rendererMutationSurface.locator('mark')).toHaveCount(0)
  await expect(
    rendererMutationSurface.locator('[data-markdown-search-wrapper]'),
  ).toHaveCount(0)
})

test('find/replace is one transaction and refreshes stale ranges without stealing user scroll', async ({
  page,
}) => {
  const { fixture, textarea } = await openFixture(page)
  await fixture.getByTestId('markdown-search-embed-open-replace').click()
  await fixture.getByTestId('markdown-search-query').fill('alpha')
  await fixture.getByTestId('markdown-search-replace').fill('omega')

  await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    target.scrollTop = Math.max(1, target.scrollHeight - target.clientHeight)
    target.setSelectionRange(0, 5, 'forward')
    target.dispatchEvent(new Event('select', { bubbles: true }))
    target.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 40 }))
  })
  const scrollBefore = await textarea.evaluate(
    (element) => (element as HTMLTextAreaElement).scrollTop,
  )
  const selectionBefore = await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    return [target.selectionStart, target.selectionEnd]
  })
  await fixture.getByTestId('markdown-search-query').fill('café')
  expect(
    await textarea.evaluate(
      (element) => (element as HTMLTextAreaElement).scrollTop,
    ),
  ).toBe(scrollBefore)
  expect(
    await textarea.evaluate((element) => {
      const target = element as HTMLTextAreaElement
      return [target.selectionStart, target.selectionEnd]
    }),
  ).toEqual(selectionBefore)

  await fixture.getByTestId('markdown-search-query').fill('alpha')
  await fixture.getByTestId('markdown-search-replace-all').click()
  await expect(fixture.getByTestId('markdown-search-count')).toHaveText(
    'No matches',
  )
  expect(await sourceValue(fixture)).not.toContain('alpha')
  await expect(
    fixture.getByTestId('markdown-search-embed-history'),
  ).toContainText('"undoDepth":1')
  await textarea.press('ControlOrMeta+z')
  expect(await sourceValue(fixture)).toContain('alpha')
})

test('bounds 100k source and 10000 matches while keeping rendering and rapid-query response bounded', async ({
  page,
}) => {
  const { fixture, root, textarea } = await openFixture(page)
  await fixture.getByTestId('markdown-search-embed-load-performance').click()
  await expect
    .poll(async () => (await sourceValue(fixture)).length)
    .toBe(100_000)
  await textarea.focus()
  await textarea.press('ControlOrMeta+f')

  const elapsed = await fixture
    .getByTestId('markdown-search-query')
    .evaluate(async (input) => {
      const started = performance.now()
      const target = input as HTMLInputElement
      target.value = 'hit'
      target.dispatchEvent(new InputEvent('input', { bubbles: true }))
      await new Promise<void>((resolveFrame) =>
        requestAnimationFrame(() => resolveFrame()),
      )
      return performance.now() - started
    })
  await expect(fixture.getByTestId('markdown-search-count')).toHaveText(
    '1 of 10000',
  )
  expect(elapsed).toBeLessThan(1_000)
  expect(
    await root.locator('.el-markdown-editor__search-highlight').count(),
  ).toBeLessThanOrEqual(256)

  const query = fixture.getByTestId('markdown-search-query')
  await query.fill('界')
  await query.fill('hit')
  await expect(fixture.getByTestId('markdown-search-count')).toHaveText(
    '1 of 10000',
  )
  await expect(
    page.getByTestId('markdown-search-embed-open-find'),
  ).toBeEnabled()
})

test('renders controlled embed states through the consumer-owned provider', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          ;(
            globalThis as typeof globalThis & { __copiedMarkdown?: string }
          ).__copiedMarkdown = value
        },
      },
    })
  })
  const { fixture, root } = await openFixture(page, {
    theme: 'dark',
  })
  const sourceBefore = await sourceValue(fixture)
  await fixture.getByTestId('markdown-search-embed-mode-preview').click()
  const embeds = root.locator('.el-markdown-embed')
  await expect(embeds).toHaveCount(8)
  await expect(
    embeds.filter({ hasText: 'Safe consumer document' }),
  ).toContainText(
    'Resolved excerpt with <strong>literal provider markup</strong>',
  )
  await expect(embeds.filter({ hasText: 'missing-doc' })).toContainText(
    'missing',
  )
  for (const [target, status] of [
    ['forbidden-doc', 'forbidden'],
    ['cycle-doc', 'cycle'],
    ['depth-doc', 'depth-exceeded'],
    ['mismatch-doc', 'mode-mismatch'],
  ] as const) {
    const failedEmbed = embeds.filter({ hasText: target })
    await expect(failedEmbed).toContainText(status)
    await expect(
      failedEmbed.getByRole('button', { name: 'Retry' }),
    ).toBeVisible()
  }
  await expect(embeds.filter({ hasText: 'pending-doc' })).toContainText(
    'pending',
  )
  await expect(embeds.filter({ hasText: 'stale-doc' })).toContainText('stale')
  expect(await root.textContent()).not.toContain(
    'This stale payload must not render.',
  )
  await expect(embeds.locator('script, iframe, object, embed')).toHaveCount(0)
  expect(await sourceValue(fixture)).toBe(sourceBefore)

  const safeEmbed = embeds.filter({ hasText: 'Safe consumer document' })
  await safeEmbed.getByRole('button', { name: 'Copy' }).click()
  expect(
    await page.evaluate(
      () =>
        (globalThis as typeof globalThis & { __copiedMarkdown?: string })
          .__copiedMarkdown,
    ),
  ).toBe('::embed[target="safe-doc" mode="article"]')

  await safeEmbed.getByRole('button', { name: 'Open Source' }).click()
  await expect(fixture.getByTestId('markdown-search-embed-open')).toHaveText(
    'safe-doc:article',
  )

  const scrollOwnerBefore = await root.getAttribute(
    'data-markdown-scroll-container',
  )
  await fixture.getByTestId('markdown-search-embed-resolve-failure').click()
  const missingEmbed = embeds.filter({ hasText: 'missing-doc' })
  await missingEmbed.getByRole('button', { name: 'Retry' }).click()
  await expect(embeds.filter({ hasText: 'Recovered heading' })).toContainText(
    'resolved',
  )
  await expect(fixture.getByTestId('markdown-search-embed-retry')).toHaveText(
    'missing-doc:heading',
  )
  expect(await root.getAttribute('data-markdown-scroll-container')).toBe(
    scrollOwnerBefore,
  )
  await expect(embeds.locator('.el-markdown-editor, textarea')).toHaveCount(0)
  const overflow = await embeds.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element)
      return [style.overflowX, style.overflowY]
    }),
  )
  expect(
    overflow.every(
      ([overflowX, overflowY]) =>
        overflowX !== 'scroll' && overflowY !== 'scroll',
    ),
  ).toBe(true)

  if (testInfo.project.name === 'chromium') {
    await mkdir(artifactRoot, { recursive: true })
    await root.screenshot({
      animations: 'disabled',
      path: resolve(artifactRoot, 'candidate-embed-states-desktop-dark.png'),
    })
  }
})

test('preserves atomic source selection, deletion, undo, and focus ownership', async ({
  page,
}) => {
  const { fixture, root, textarea } = await openFixture(page, {
    theme: 'dark',
  })
  const sourceBefore = await sourceValue(fixture)
  await fixture.getByTestId('markdown-search-embed-mode-preview').click()
  const embeds = root.locator('.el-markdown-embed')
  await expect(embeds).toHaveCount(8)
  const currentSafeEmbed = embeds.filter({ hasText: 'Safe consumer document' })
  await currentSafeEmbed.getByRole('button', { name: 'Source Reveal' }).click()
  await expect(textarea).toBeVisible()
  await expect(textarea).toBeFocused()
  const revealedSelection = await textarea.evaluate((element) => {
    const target = element as HTMLTextAreaElement
    return [target.selectionStart, target.selectionEnd]
  })
  expect(revealedSelection[0]).toBe(
    sourceBefore.indexOf('::embed[target="safe-doc"'),
  )

  await fixture.getByTestId('markdown-search-embed-mode-source').click()
  await fixture.getByTestId('markdown-search-embed-mode-preview').click()
  await expect(embeds).toHaveCount(8)
  await embeds
    .filter({ hasText: 'Safe consumer document' })
    .getByRole('button', { name: 'Delete' })
    .click()
  expect(await sourceValue(fixture)).not.toContain('target="safe-doc"')
  await expect(
    fixture.getByTestId('markdown-search-embed-history'),
  ).toContainText('"undoDepth":1')
  await fixture.getByTestId('markdown-search-embed-mode-source').click()
  await textarea.press('ControlOrMeta+z')
  expect(await sourceValue(fixture)).toContain('target="safe-doc"')
})

test('kills runtime DOM/layout/stale/ownership mutants with production-surface invariants', async ({
  page,
}) => {
  const { fixture, root } = await openFixture(page)
  await openFind(fixture, 'alpha')
  await fixture.getByTestId('markdown-search-embed-mode-preview').click()

  const auditRuntime = () =>
    root.evaluate((editor) => {
      const embedRegions = [...editor.querySelectorAll('.el-markdown-embed')]
      return {
        forbiddenEmbedHostCount: editor.querySelectorAll(
          '.el-markdown-embed iframe, .el-markdown-embed webview, .el-markdown-embed .el-markdown-editor',
        ).length,
        nestedScrollCount: embedRegions.filter((region) => {
          const style = getComputedStyle(region)
          return style.overflowY === 'scroll' || style.overflowX === 'scroll'
        }).length,
        rendererWrapperCount: editor.querySelectorAll(
          '.markdown-renderer mark, .markdown-renderer [data-markdown-search-wrapper]',
        ).length,
        rootHeight: editor.getBoundingClientRect().height,
        stalePayloadVisible:
          editor.textContent?.includes('Stale payload') ?? false,
      }
    })

  const baseline = await auditRuntime()
  expect(baseline).toMatchObject({
    forbiddenEmbedHostCount: 0,
    nestedScrollCount: 0,
    rendererWrapperCount: 0,
    stalePayloadVisible: false,
  })

  const killed = await root.evaluate((editor) => {
    const renderer = editor.querySelector('.markdown-renderer')
    const embed = editor.querySelector('.el-markdown-embed')
    if (!renderer || !embed) return false
    const wrapper = document.createElement('mark')
    wrapper.dataset.markdownSearchWrapper = 'mutant'
    renderer.append(wrapper)
    const iframe = document.createElement('iframe')
    embed.append(iframe)
    return true
  })
  expect(killed).toBe(true)
  const mutant = await auditRuntime()
  expect(mutant.rendererWrapperCount).toBeGreaterThan(0)
  expect(mutant.forbiddenEmbedHostCount).toBeGreaterThan(0)
})

test('simulates touch, screen-reader, soft-keyboard, reduced-motion, and 200% zoom on mobile', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const viewport = new EventTarget() as EventTarget & {
      height: number
      width: number
    }
    viewport.height = 740
    viewport.width = 375
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    })
    ;(
      globalThis as typeof globalThis & {
        __setVisualViewportHeight?: (height: number) => void
      }
    ).__setVisualViewportHeight = (height: number) => {
      viewport.height = height
      viewport.dispatchEvent(new Event('resize'))
    }
  })
  await page.setViewportSize({ height: 740, width: 375 })
  const { fixture, root } = await openFixture(page, {
    theme: 'dark',
    touch: true,
  })
  await fixture
    .getByTestId('markdown-search-embed-open-find')
    .evaluate((element) =>
      element.dispatchEvent(new Event('touchstart', { bubbles: true })),
    )
  await fixture.getByTestId('markdown-search-embed-open-find').click()
  await fixture.getByTestId('markdown-search-query').fill('alpha')

  const hitAreas = await root
    .locator(
      '.el-markdown-editor__search-toggle, .el-markdown-editor__search-nav, .el-markdown-editor__search-close, .el-markdown-embed__action',
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { height: rect.height, width: rect.width }
      }),
    )
  expect(hitAreas.length).toBeGreaterThan(0)
  expect(
    hitAreas.every(({ height, width }) => height >= 40 && width >= 40),
  ).toBe(true)

  await page.evaluate(() => {
    ;(
      globalThis as typeof globalThis & {
        __setVisualViewportHeight?: (height: number) => void
      }
    ).__setVisualViewportHeight?.(420)
  })
  await expect(root).toHaveCSS(
    '--el-markdown-editor-visual-viewport-height',
    '420px',
  )

  await page.evaluate(() => {
    document.documentElement.style.zoom = '2'
  })
  expect(
    await root
      .locator('.el-markdown-editor__search-bar')
      .evaluate(
        (element) =>
          element.scrollWidth <=
          Math.max(
            element.clientWidth,
            element.parentElement?.clientWidth ?? 0,
          ) +
            1,
      ),
  ).toBe(true)
  await expect(fixture.getByRole('search')).toBeVisible()
  await expect(fixture.getByTestId('markdown-search-count')).toHaveAttribute(
    'aria-live',
    'polite',
  )

  const searchSemantics = await root.evaluate((editor) => ({
    label: editor.querySelector('[role="search"]')?.getAttribute('aria-label'),
    queryLabel: editor
      .querySelector('[data-testid="markdown-search-query"]')
      ?.getAttribute('aria-label'),
    status: editor
      .querySelector('[data-testid="markdown-search-count"]')
      ?.textContent?.trim(),
  }))
  expect(searchSemantics).toEqual({
    label: 'Find in document',
    queryLabel: 'Find in document',
    status: '1 of 3',
  })

  if (testInfo.project.name === 'chromium') {
    await mkdir(artifactRoot, { recursive: true })
    await root.screenshot({
      animations: 'disabled',
      path: resolve(artifactRoot, 'candidate-mobile-dark-zoom-200.png'),
    })
  }

  await fixture.getByTestId('markdown-search-close').click()
  await fixture.getByTestId('markdown-search-embed-mode-preview').click()
  await expect(root.locator('.el-markdown-embed')).toHaveCount(8)
  const embedRegions = await root.evaluate((editor) =>
    [...editor.querySelectorAll('.el-markdown-embed')].map((region) => ({
      actions: [...region.querySelectorAll('button')].map((action) =>
        action.textContent?.trim(),
      ),
      label: region.getAttribute('aria-label'),
      role: region.getAttribute('role'),
      status: region.querySelector('[role="status"]')?.textContent?.trim(),
      tabIndex: region.getAttribute('tabindex'),
    })),
  )
  expect(embedRegions).toHaveLength(8)
  expect(
    embedRegions.every(
      (region) =>
        region.role === 'region' &&
        region.label?.startsWith('Embed ') &&
        region.tabIndex === null &&
        region.actions.includes('Open Source'),
    ),
  ).toBe(true)
  const semantics = {
    embedRegions,
    search: searchSemantics,
    simulation: {
      screenReader: 'DOM role/name/status projection',
      softKeyboard: 'visualViewport resize',
      touch: 'touchstart plus public click activation',
      zoom: 'CSS zoom 200%',
    },
  }

  if (testInfo.project.name === 'chromium') {
    await writeFile(
      resolve(artifactRoot, 'candidate-mobile-screen-reader-report.json'),
      `${JSON.stringify(semantics, null, 2)}\n`,
    )
  }
})

test('isolates provider/search identity after same-source document switch', async ({
  page,
}) => {
  const { fixture, root } = await openFixture(page)
  await fixture.getByTestId('markdown-search-embed-mode-preview').click()
  await expect(
    fixture.getByTestId('markdown-search-embed-request'),
  ).not.toHaveText('null')
  const firstInstance = await root.getAttribute('data-markdown-instance')
  const firstRequest = JSON.parse(
    (await fixture
      .getByTestId('markdown-search-embed-request')
      .textContent()) ?? 'null',
  ) as { documentIdentity: { epoch: number; id: string } }
  const valueBefore = await sourceValue(fixture)

  await fixture.getByTestId('markdown-search-embed-switch-document').click()
  await expect(fixture).toHaveAttribute('data-document-epoch', '2')
  const nextRoot = fixture.locator('.el-markdown-editor')
  await expect(
    fixture.getByTestId('markdown-search-embed-request'),
  ).not.toHaveText('null')
  const nextRequest = JSON.parse(
    (await fixture
      .getByTestId('markdown-search-embed-request')
      .textContent()) ?? 'null',
  ) as { documentIdentity: { epoch: number; id: string } }
  expect(await nextRoot.getAttribute('data-markdown-instance')).not.toBe(
    firstInstance,
  )
  expect(nextRequest.documentIdentity.id).not.toBe(
    firstRequest.documentIdentity.id,
  )
  expect(await sourceValue(fixture)).toBe(valueBefore)
})
