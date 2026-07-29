import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { SMOKE_MARKDOWN_FEATURE_TEST_TITLE } from '../../../scripts/visual-profiles.mjs'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'
import { attachPageDiagnostics } from '../support/page-diagnostics'

const diagnostics = new WeakMap<Page, string[]>()

type MarkdownActivationSnapshot = {
  activationRevision: number
  activatedKinds: string[]
  code: { classes: string[]; text: string } | null
  forbiddenHostClassTokens: string[]
  katex: { classes: string[]; mathmlCount: number } | null
  mermaid: {
    classes: string[]
    eventAttributeCount: number
    foreignObjectCount: number
    id: string | null
    scriptCount: number
    text: string
  } | null
}

const readActivationSnapshot = (page: Page) =>
  page.evaluate((): MarkdownActivationSnapshot => {
    const renderer = document.querySelector<HTMLElement>(
      '[data-markdown-renderer="wasm"]',
    )
    const fixture = window.__FSUSUI_PERFORMANCE_FIXTURE__
    const phase = fixture?.markdownPhaseProbe()
    const code = renderer?.querySelector<HTMLElement>('pre.shiki')
    const katex = renderer?.querySelector<HTMLElement>('span.katex')
    const mermaid = renderer?.querySelector<SVGSVGElement>(
      'svg[id^="fsus-markdown-mermaid-"]',
    )
    const activated = renderer
      ? [...renderer.querySelectorAll<HTMLElement>('[data-markdown-feature-activated]')]
      : []
    const outputRoots = activated.flatMap((element) => {
      switch (element.dataset.markdownFeatureActivated) {
        case 'mermaid':
          return [...element.querySelectorAll<HTMLElement>('svg')]
        case 'latex':
          return [...element.querySelectorAll<HTMLElement>('.katex')]
        case 'code-highlight':
          return [element]
        default:
          return []
      }
    })
    const forbiddenHostClassTokens = outputRoots.flatMap((root) =>
      [root, ...root.querySelectorAll<HTMLElement>('[class]')].flatMap(
        (element) =>
          [...element.classList].filter((token) =>
            /^(?:el-|is-|fsus-|markdown-renderer)/iu.test(token),
          ),
      ),
    )

    return {
      activationRevision: phase?.activationRevision ?? -1,
      activatedKinds: activated
        .map((element) => element.dataset.markdownFeatureActivated ?? '')
        .filter(Boolean)
        .sort(),
      code: code
        ? { classes: [...code.classList], text: code.textContent ?? '' }
        : null,
      katex: katex
        ? {
            classes: [...katex.classList],
            mathmlCount: katex.querySelectorAll('math').length,
          }
        : null,
      mermaid: mermaid
        ? {
            classes: [...mermaid.classList],
            eventAttributeCount: [...mermaid.querySelectorAll('*')].reduce(
              (count, element) =>
                count +
                [...element.attributes].filter((attribute) =>
                  /^on/i.test(attribute.name),
                ).length,
              [...mermaid.attributes].filter((attribute) =>
                /^on/i.test(attribute.name),
              ).length,
            ),
            foreignObjectCount: mermaid.querySelectorAll('foreignObject').length,
            id: mermaid.id || null,
            scriptCount: mermaid.querySelectorAll('script').length,
            text: mermaid.textContent ?? '',
          }
        : null,
      forbiddenHostClassTokens,
    }
  })

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

test(SMOKE_MARKDOWN_FEATURE_TEST_TITLE, async ({ page }, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  await page.goto(
    buildVisualUrl('basic', testInfo.project.name, {
      motion: 'reduced',
      performance: 'markdown-feature-activation',
      size: 4096,
    }),
    { waitUntil: 'domcontentloaded' },
  )

  const fixture = page.locator('[data-performance-scenario="markdown-feature-activation"]')
  await expect(fixture).toHaveAttribute('data-performance-ready', 'true')
  await expect(page.locator('[data-markdown-renderer="wasm"]')).toBeVisible()

  const initial = await readActivationSnapshot(page)
  await page.evaluate(async () => {
    const fixture = window.__FSUSUI_PERFORMANCE_FIXTURE__
    if (!fixture) throw new Error('performance fixture API is unavailable')
    await fixture.act(1)
  })
  await expect
    .poll(async () => (await readActivationSnapshot(page)).activationRevision)
    .toBeGreaterThan(initial.activationRevision)

  const activated = await readActivationSnapshot(page)
  expect(activated.activationRevision).toBe(1)
  expect(activated.activatedKinds).toEqual([
    'code-highlight',
    'latex',
    'mermaid',
  ])
  expect(activated.code?.text).toContain('activationRevision: number = 1')
  expect(activated.code?.classes).toEqual(
    expect.arrayContaining(['shiki', `github-${theme}`]),
  )
  expect(activated.katex?.classes).toEqual(['katex'])
  expect(activated.katex?.mathmlCount).toBeGreaterThan(0)
  expect(activated.mermaid?.text).toContain('revision 1')
  expect(activated.mermaid?.id).toMatch(/^fsus-markdown-mermaid-[A-Za-z0-9_-]+$/u)
  expect(activated.forbiddenHostClassTokens).toEqual([])
  expect(activated.mermaid?.scriptCount).toBe(0)
  expect(activated.mermaid?.foreignObjectCount).toBe(0)
  expect(activated.mermaid?.eventAttributeCount).toBe(0)

  await testInfo.attach(`markdown-feature-activation-${theme}`, {
    body: await fixture.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})
