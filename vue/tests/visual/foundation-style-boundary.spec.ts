import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { buildVisualUrl } from '../../../scripts/visual-variant.mjs'

const diagnostics = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }, testInfo) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.goto(
    buildVisualUrl('foundation-boundary', testInfo.project.name),
    {
      waitUntil: 'domcontentloaded',
    },
  )
  await expect(page.getByTestId('foundation-boundary-fixture')).toBeVisible()
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

test('keeps native and renderer-owned content outside product styling', async ({
  page,
}) => {
  await expect(page.getByTestId('foundation-boundary-fixture')).toBeVisible()

  const nativeStyles = await page.evaluate(() => {
    const h1 = document.querySelector<HTMLElement>('[data-testid="native-h1"]')!
    const h2 = document.querySelector<HTMLElement>('[data-testid="native-h2"]')!
    const list = document.querySelector<HTMLElement>(
      '[data-testid="native-list"]',
    )!
    const item = list.querySelector('li')!
    const markdownHeading = document.querySelector<HTMLElement>(
      '[data-testid="markdown-heading"]',
    )!
    return {
      h1After: getComputedStyle(h1, '::after').content,
      h1Tracking: getComputedStyle(h1).letterSpacing,
      h2Tracking: getComputedStyle(h2).letterSpacing,
      itemBefore: getComputedStyle(item, '::before').content,
      listMarker: getComputedStyle(list).listStyleType,
      markdownAfter: getComputedStyle(markdownHeading, '::after').content,
      markdownTracking: getComputedStyle(markdownHeading).letterSpacing,
    }
  })

  expect(nativeStyles).toEqual({
    h1After: 'none',
    h1Tracking: 'normal',
    h2Tracking: 'normal',
    itemBefore: 'none',
    listMarker: 'disc',
    markdownAfter: 'none',
    markdownTracking: 'normal',
  })
  await expect(page.getByTestId('native-form').locator('input')).toBeVisible()
  await expect(page.getByTestId('native-form').locator('select')).toBeVisible()
  await expect(page.getByTestId('native-form').locator('button')).toBeVisible()
})

test('preserves external SVG paint while keeping the explicit line-icon recipe', async ({
  page,
}) => {
  const styles = await page.evaluate(() => {
    const style = (selector: string) =>
      getComputedStyle(document.querySelector<SVGElement>(selector)!)
    const logo = style('[data-testid="external-logo"] rect')
    const chart = style('[data-testid="external-chart"] path')
    const thirdParty = style('[data-testid="third-party-icon"] path')
    const katex = style('[data-testid="katex-fixture"] path')
    const mermaid = style('[data-testid="mermaid-fixture"] path')
    const fsusLine = style('[data-testid="fsus-linear-icon"] path')
    return {
      chartJoin: chart.strokeLinejoin,
      chartLinecap: chart.strokeLinecap,
      chartWidth: chart.strokeWidth,
      fsusJoin: fsusLine.strokeLinejoin,
      fsusLinecap: fsusLine.strokeLinecap,
      fsusPaintOrder: fsusLine.paintOrder,
      fsusWidth: fsusLine.strokeWidth,
      katexFill: katex.fill,
      logoFill: logo.fill,
      mermaidLinecap: mermaid.strokeLinecap,
      mermaidWidth: mermaid.strokeWidth,
      thirdPartyFill: thirdParty.fill,
    }
  })

  expect(styles).toEqual({
    chartJoin: 'bevel',
    chartLinecap: 'square',
    chartWidth: '7px',
    fsusJoin: 'round',
    fsusLinecap: 'round',
    // Chromium serializes `paint-order: stroke fill` to its equivalent
    // canonical computed value because fill is the remaining default phase.
    fsusPaintOrder: 'stroke',
    fsusWidth: '3px',
    katexFill: 'rgb(17, 24, 39)',
    logoFill: 'rgb(124, 58, 237)',
    mermaidLinecap: 'butt',
    mermaidWidth: '5px',
    thirdPartyFill: 'rgb(220, 38, 38)',
  })
})

test('applies editorial decoration only after fsus-prose opt-in', async ({
  page,
}) => {
  const proseStyles = await page.evaluate(() => {
    const h1 = document.querySelector<HTMLElement>('[data-testid="prose-h1"]')!
    const list = document.querySelector<HTMLElement>(
      '[data-testid="prose-list"]',
    )!
    const item = list.querySelector('li')!
    return {
      after: getComputedStyle(h1, '::after').content,
      itemBefore: getComputedStyle(item, '::before').content,
      listMarker: getComputedStyle(list).listStyleType,
      tracking: Number.parseFloat(getComputedStyle(h1).letterSpacing),
    }
  })

  expect(proseStyles.after).toBe('"."')
  expect(proseStyles.itemBefore).toBe('""')
  expect(proseStyles.listMarker).toBe('none')
  expect(proseStyles.tracking).toBeLessThan(0)
})
