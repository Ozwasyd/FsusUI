import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { attachPageDiagnostics } from '../support/page-diagnostics'
import { collectCssRules } from '../support/css-scan'
import {
  buildVisualUrl,
  resolveVisualVariant,
} from '../../../scripts/visual-variant.mjs'

const diagnostics = new WeakMap<Page, string[]>()
const issue468EvidenceRoot = resolve(
  process.cwd(),
  'tests/conformance/visual/artifacts',
)

const stabilizePage = async (page: Page) => {
  await page.addStyleTag({
    content: `*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important;animation-delay:0s!important;scroll-behavior:auto!important}`,
  })
}

test.beforeEach(async ({ page }) => {
  diagnostics.set(page, attachPageDiagnostics(page))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page) ?? []).toEqual([])
})

// CSS gate: no card surfaces on metric primitives
test('production CSS has no card surfaces on metric primitives', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
  await expect(page.getByTestId('metric-visual-fixtures')).toBeVisible()

  // Selector-scoped gate: a card surface only counts when a rule that targets
  // the primitive itself carries the card pattern (joined whole-sheet text
  // would match unrelated rules in the same stylesheet).
  const rules = await collectCssRules(page, [
    'metric-list',
    'key-value-grid',
    'diagnostics-item',
  ])
  const banned: string[] = []
  for (const rule of rules) {
    const css = rule.cssText
    if (
      rule.selectorText.includes('metric-list') &&
      /border:\s*1px\s+solid/.test(css) &&
      /\b12px\b/.test(css)
    )
      banned.push('MetricList has card surface')
    if (
      rule.selectorText.includes('key-value-grid') &&
      /border:\s*1px\s+solid/.test(css)
    )
      banned.push('KeyValueGrid has card surface')
    if (
      rule.selectorText.includes('diagnostics-item') &&
      /padding:\s*12px/.test(css) &&
      /border:\s*1px/.test(css)
    )
      banned.push('DiagnosticsItem has card surface')
  }
  expect(banned).toEqual([])
})

// Typography: 12/14/16px ladder
test('KPI primary value uses 16px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
  const primary = page
    .locator('[data-metric-variant="metric-default"] .el-metric-item__primary')
    .first()
  const fontSize = await primary.evaluate((el) => getComputedStyle(el).fontSize)
  expect(parseFloat(fontSize)).toBe(16)
})

test('KeyValue label uses 12px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
  const label = page
    .locator('[data-metric-variant="kv-default"] .el-key-value-item__label')
    .first()
  const fontSize = await label.evaluate((el) => getComputedStyle(el).fontSize)
  expect(parseFloat(fontSize)).toBe(12)
})

test('ordinary metric labels and values stay within the approved typography budget', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)

  const selectors = [
    '.el-distribution-bar-row__value',
    '.el-key-value-item__label',
    '.el-key-value-item__value',
    '.el-status-summary__label',
    '.el-status-summary__status',
    '.el-diagnostics-item__detail-toggle',
    '.el-copyable-detail__button',
  ]
  for (const selector of selectors) {
    await expect(page.locator(selector).first(), selector).toBeVisible()
  }
  const computed = await page
    .locator(selectors.join(','))
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element)
        return {
          className: element.className,
          fontSize: Number.parseFloat(style.fontSize),
          fontWeight: Number.parseInt(style.fontWeight, 10),
        }
      }),
    )

  expect(computed.length).toBeGreaterThan(0)
  for (const entry of computed) {
    expect([12, 14, 16], entry.className).toContain(entry.fontSize)
    expect(entry.fontWeight, entry.className).toBeLessThanOrEqual(500)
  }
})

test('single production composition contains twenty-plus realistic entries across all seven primitives and required states', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)

  const root = page.getByTestId('metric-visual-fixtures')
  const requiredPrimitives = [
    '.el-metric-list',
    '.el-kpi-group',
    '.el-distribution-list',
    '.el-key-value-grid',
    '.el-status-summary',
    '.el-diagnostics-list',
    '.el-copyable-detail',
  ]
  for (const selector of requiredPrimitives) {
    await expect(root.locator(selector).first(), selector).toBeVisible()
  }

  const aggregate = await root.evaluate((element) => {
    const entrySelector = [
      '.el-metric-item',
      '.el-distribution-bar-row',
      '.el-key-value-item',
      '.el-status-summary',
      '.el-diagnostics-item',
      '.el-copyable-detail',
    ].join(',')
    const visibleText = element.textContent ?? ''
    return {
      entryCount: element.querySelectorAll(entrySelector).length,
      hasPlaceholder: /\b(?:Metric\s+\d+|Item\s+\d+|Option\s+[A-Z])\b/u.test(
        visibleText,
      ),
      toneClasses: [...element.querySelectorAll<HTMLElement>('[class]')]
        .flatMap((node) => [...node.classList])
        .filter((name) => /(?:success|warning|danger|info)/u.test(name)),
    }
  })
  expect(aggregate.entryCount).toBeGreaterThanOrEqual(20)
  expect(aggregate.hasPlaceholder).toBe(false)
  for (const tone of ['success', 'warning', 'danger', 'info']) {
    expect(aggregate.toneClasses.some((name) => name.includes(tone))).toBe(true)
  }

  await expect(
    root.locator('[data-metric-variant="diag-loading"]'),
  ).toHaveAttribute('aria-busy', 'true')
  await expect(
    root.locator('[data-metric-variant="diag-empty"] .el-empty-state'),
  ).toBeVisible()
  await expect(root.locator('[data-metric-typography="long"]')).toBeVisible()
  await expect(
    root.locator('details[open] .el-diagnostics-item__detail-body').first(),
  ).toBeVisible()
})

test('default key labels omit punctuation and the explicit motif remains decorative gray', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)

  const labels = page.locator('.el-key-value-item__label')
  const pseudoContent = await labels.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element, '::before').content),
  )
  expect(
    pseudoContent.every(
      (content) => content === 'none' || content === 'normal',
    ),
  ).toBe(true)

  const motif = page.locator(
    '.el-key-value-item__badge [aria-label="Highlighted metric"]',
  )
  await expect(motif).toHaveText('·')
  const colors = await motif.evaluate((element) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--fsus-dot-gray)'
    document.body.append(probe)
    const expected = getComputedStyle(probe).color
    probe.remove()
    return {
      actual: getComputedStyle(element.parentElement as Element).color,
      expected,
    }
  })
  expect(colors.actual).toBe(colors.expected)
})

test('CJK and RTL metric content preserve hierarchy and direction', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)

  const cjk = page.locator('[data-metric-typography="cjk"]')
  const rtl = page.locator('[data-metric-typography="rtl"]')
  await expect(cjk.getByText('请求延迟')).toBeVisible()
  await expect(rtl.getByText('زمن الاستجابة')).toBeVisible()
  await expect(rtl).toHaveAttribute('dir', 'rtl')

  for (const item of [cjk, rtl]) {
    const geometry = await item.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  }
})

test('long and RTL metric content reflows at 200 percent zoom', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
  await page.evaluate(() => {
    document.documentElement.style.zoom = '200%'
  })

  for (const selector of [
    '[data-metric-typography="long"]',
    '[data-metric-typography="rtl"]',
  ]) {
    const item = page.locator(selector)
    await expect(item).toBeVisible()
    const geometry = await item.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
  }
})

// MetricList flat
test('MetricList has no card surface', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
  const list = page.locator(
    '[data-metric-variant="metric-default"] .el-metric-list',
  )
  const borderRadius = await list.evaluate(
    (el) => getComputedStyle(el).borderRadius,
  )
  expect(borderRadius).toBe('0px')
})

// KeyValueGrid flat
test('KeyValueGrid has no card surface', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
  const grid = page.locator(
    '[data-metric-variant="kv-default"] .el-key-value-grid',
  )
  const borderRadius = await grid.evaluate(
    (el) => getComputedStyle(el).borderRadius,
  )
  expect(borderRadius).toBe('0px')
})

// Diagnostics: 3px logical inline-start border
test('DiagnosticsItem warning uses 3px left border', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
  const item = page.locator(
    '[data-metric-variant="diag-mixed"] .el-diagnostics-item.is-warning',
  )
  const borderInlineStart = await item.evaluate(
    (el) => getComputedStyle(el).borderInlineStartWidth,
  )
  expect(parseFloat(borderInlineStart)).toBe(3)
})

// CopyableDetail: 40px button
test('CopyableDetail button min-height >= 40px', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
  const btn = page.locator(
    '[data-metric-variant="copy-default"] .el-copyable-detail__button',
  )
  const minH = await btn.evaluate((el) => getComputedStyle(el).minHeight)
  expect(parseFloat(minH)).toBeGreaterThanOrEqual(40)
})

test('CopyableDetail focus uses inset ring', async ({ page }, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
  const btn = page.locator(
    '[data-metric-variant="copy-default"] .el-copyable-detail__button',
  )
  await btn.focus()
  const boxShadow = await btn.evaluate((el) => getComputedStyle(el).boxShadow)
  expect(boxShadow).toContain('inset')
})

test('inline action focus, hover, selected and disabled states use standard tokens without ancestor fading', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)

  for (const selector of [
    '[data-metric-variant="copy-default"] .el-copyable-detail__button',
    '[data-metric-variant="diag-mixed"] .el-diagnostics-item__detail-toggle',
    '[data-metric-variant="summary-success"] .el-status-summary__actions > button',
    '[data-metric-variant="diag-mixed"] .el-diagnostics-item__actions > button',
    '[data-metric-variant="diag-mixed"] .el-diagnostics-item__actions > a[href]',
  ]) {
    const action = page.locator(selector).first()
    await expect(action, selector).toBeVisible()
    await action.focus()
    const focusState = await action.evaluate((element) => ({
      boxShadow: getComputedStyle(element).boxShadow,
      outlineStyle: getComputedStyle(element).outlineStyle,
    }))
    expect(focusState.boxShadow, selector).toContain('inset')
    expect(focusState.outlineStyle, selector).toBe('none')
  }

  for (const selector of [
    '[data-metric-variant="diag-mixed"] .el-diagnostics-item__detail-toggle',
    '[data-metric-variant="diag-mixed"] .el-diagnostics-item__actions > button',
    '[data-metric-variant="diag-mixed"] .el-diagnostics-item__actions > a[href]',
  ]) {
    const action = page.locator(selector).first()
    await action.hover()
    const hoverState = await action.evaluate((element) => {
      const probe = document.createElement('span')
      probe.style.color = 'var(--fsus-scholarly-blue, var(--el-color-primary))'
      document.body.append(probe)
      const state = {
        color: getComputedStyle(element).color,
        expectedColor: getComputedStyle(probe).color,
      }
      probe.remove()
      return state
    })
    expect(hoverState.color, selector).toBe(hoverState.expectedColor)
  }

  const selectedAction = page.locator(
    '[data-metric-variant="summary-success"] .el-status-summary__actions > [aria-pressed="true"]',
  )
  await expect(selectedAction).toBeVisible()
  const selectedState = await selectedAction.evaluate((element) => {
    const probe = document.createElement('button')
    probe.style.backgroundColor = 'var(--el-fill-color-light)'
    probe.style.borderColor = 'var(--el-color-primary)'
    probe.style.color = 'var(--fsus-scholarly-blue, var(--el-color-primary))'
    document.body.append(probe)
    const probeStyle = getComputedStyle(probe)
    const state = {
      opacity: getComputedStyle(element).opacity,
      backgroundColor: getComputedStyle(element).backgroundColor,
      expectedBackgroundColor: probeStyle.backgroundColor,
      borderColor: getComputedStyle(element).borderColor,
      expectedBorderColor: probeStyle.borderColor,
      color: getComputedStyle(element).color,
      expectedColor: probeStyle.color,
    }
    probe.remove()
    return state
  })
  expect(selectedState.opacity).toBe('1')
  expect(selectedState.backgroundColor).toBe(
    selectedState.expectedBackgroundColor,
  )
  expect(selectedState.borderColor).toBe(selectedState.expectedBorderColor)
  expect(selectedState.color).toBe(selectedState.expectedColor)

  const disabled = page.locator(
    '[data-metric-variant="copy-disabled"] .el-copyable-detail',
  )
  const disabledButton = disabled.locator('button')
  await expect(disabledButton).toBeDisabled()
  const disabledState = await disabled.evaluate((element) => {
    const button = element.querySelector('button') as HTMLButtonElement
    const style = getComputedStyle(button)
    const probe = document.createElement('button')
    probe.style.backgroundColor = 'var(--el-fill-color-light)'
    probe.style.borderColor = 'var(--el-border-color-light)'
    probe.style.color = 'var(--el-text-color-disabled)'
    document.body.append(probe)
    const probeStyle = getComputedStyle(probe)
    const state = {
      ancestorOpacity: getComputedStyle(element).opacity,
      controlOpacity: style.opacity,
      backgroundColor: style.backgroundColor,
      expectedBackgroundColor: probeStyle.backgroundColor,
      borderColor: style.borderColor,
      expectedBorderColor: probeStyle.borderColor,
      color: style.color,
      expectedColor: probeStyle.color,
    }
    probe.remove()
    return state
  })
  expect(disabledState.ancestorOpacity).toBe('1')
  expect(disabledState.controlOpacity).toBe('1')
  expect(disabledState.backgroundColor).toBe(
    disabledState.expectedBackgroundColor,
  )
  expect(disabledState.borderColor).toBe(disabledState.expectedBorderColor)
  expect(disabledState.color).toBe(disabledState.expectedColor)
})

test('nested, mixed, empty, loading, long, RTL and zoom states remain stable', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)

  const mixed = page.locator(
    '[data-metric-variant="diag-mixed"] > .el-diagnostics-list',
  )
  await expect(mixed.locator(':scope > .el-diagnostics-item')).toHaveCount(4)
  const nested = page
    .getByTestId('nested-diagnostics')
    .locator(':scope > .el-diagnostics-list')
  await expect(nested).toBeVisible()
  await expect(nested.locator(':scope > .el-diagnostics-item')).toHaveCount(2)
  await expect(
    mixed.locator(':scope > .el-diagnostics-item details[open]'),
  ).toBeVisible()
  await expect(
    page.locator('[data-metric-variant="diag-empty"] .el-empty-state'),
  ).toBeVisible()
  await expect(
    page.locator('[data-metric-variant="diag-loading"]'),
  ).toHaveAttribute('aria-busy', 'true')
  await expect(
    page.locator('[data-metric-variant="diag-rtl"] > div'),
  ).toHaveAttribute('dir', 'rtl')

  await page.evaluate(() => {
    document.documentElement.style.zoom = '200%'
  })

  for (const selector of [
    '[data-metric-variant="diag-mixed"]',
    '[data-testid="nested-diagnostics"]',
    '[data-metric-variant="diag-rtl"]',
    '[data-metric-typography="long"]',
  ]) {
    const node = page.locator(selector).first()
    await expect(node, selector).toBeVisible()
    const geometry = await node.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(geometry.scrollWidth, selector).toBeLessThanOrEqual(
      geometry.clientWidth + 1,
    )
  }
})

test('keyboard, touch and screen-reader semantics keep status text and actions reachable', async ({
  page,
}, testInfo) => {
  await openMetricFixtures(page, testInfo.project.name)
  const { compact, theme } = resolveVisualVariant(testInfo.project.name)
  const root = page.getByTestId('metric-visual-fixtures')
  const copyButton = root.locator('.el-copyable-detail__button').first()

  await copyButton.focus()
  await expect(copyButton).toBeFocused()
  await expect(copyButton).toHaveAccessibleName(/copy/iu)
  await expect(
    root.locator('[data-metric-variant="diag-loading"]'),
  ).toHaveAttribute('aria-busy', 'true')
  for (const status of ['Healthy', 'Over limit', 'In progress']) {
    await expect(root.getByText(status, { exact: true })).toBeVisible()
  }

  if (compact) {
    const closedDetails = root
      .locator(
        '[data-metric-variant="diag-mixed"] > .el-diagnostics-list > .el-diagnostics-item details',
      )
      .first()
    await expect(closedDetails).not.toHaveAttribute('open', '')
    const summary = closedDetails.locator('summary')
    await summary.tap()
    await expect(closedDetails).toHaveAttribute('open', '')
  }

  const ariaSnapshot = await root.ariaSnapshot()
  expect(ariaSnapshot).toContain('Healthy')
  expect(ariaSnapshot).toContain('Over limit')
  expect(ariaSnapshot).toContain('Copy detail')
  expect(ariaSnapshot).toContain('No diagnostics')
  await mkdir(issue468EvidenceRoot, { recursive: true })
  await writeFile(
    resolve(
      issue468EvidenceRoot,
      `issue-468-metric-${theme}-${compact ? 'mobile' : 'desktop'}-aria.txt`,
    ),
    `${ariaSnapshot}\n`,
  )
})

test('required responsive and zoom cells retain production rendered evidence', async ({
  page,
}, testInfo) => {
  const { compact, theme } = resolveVisualVariant(testInfo.project.name)
  const widths = compact ? [320, 375] : [768, 1366]
  const cells = [
    ...widths.map((width) => ({ width, zoom: 100 })),
    { width: compact ? 375 : 1366, zoom: 150 },
    { width: compact ? 375 : 1366, zoom: 200 },
  ]
  const screenshotRoot = resolve(issue468EvidenceRoot, 'screenshots/web')
  await mkdir(screenshotRoot, { recursive: true })

  for (const cell of cells) {
    await page.setViewportSize({
      width: cell.width,
      height: compact ? 900 : 1200,
    })
    await openMetricFixtures(page, testInfo.project.name)
    await page.evaluate((zoom) => {
      document.documentElement.style.zoom = `${zoom}%`
    }, cell.zoom)
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise<void>((resolveFrame) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))
      })
    })

    const root = page.getByTestId('metric-visual-fixtures')
    await expect(root).toBeVisible()
    const geometry = await root.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(
      geometry.scrollWidth,
      `${theme} ${cell.width}px at ${cell.zoom}% zoom`,
    ).toBeLessThanOrEqual(geometry.clientWidth + 1)

    const issues = await collectMetricSurfaceIssues(page, compact ? 44 : 40)
    expect(issues.panelRows).toEqual([])
    expect(issues.lowTargets).toEqual([])
    expect(issues.fadedElements).toEqual([])
    expect(issues.colorOnlyToneRows).toEqual([])

    await page.screenshot({
      path: resolve(
        screenshotRoot,
        `issue-468-metric-${theme}-${cell.width}-zoom-${cell.zoom}.png`,
      ),
      fullPage: true,
      animations: 'disabled',
    })
    await page.evaluate(() => {
      document.documentElement.style.zoom = ''
    })
  }
})

// Full-page screenshot
test('metric variants render without visual break', async ({
  page,
}, testInfo) => {
  await page.goto(buildVisualUrl('metric-visual', testInfo.project.name), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
  for (const v of [
    'metric-default',
    'kpi-default',
    'distribution-default',
    'kv-default',
    'status-default',
    'summary-success',
    'summary-danger',
    'summary-info',
    'diag-mixed',
    'diag-empty',
    'diag-loading',
    'diag-rtl',
    'copy-default',
    'copy-disabled',
  ]) {
    await expect(page.locator(`[data-metric-variant="${v}"]`)).toBeVisible()
  }
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.screenshot({
    path: testInfo.outputPath('metric-all-variants.png'),
    fullPage: true,
  })
})

// Shared in-page collectors for the rendered surface gates below.
type MetricSurfaceIssues = {
  panelRows: string[]
  lowTargets: string[]
  fadedElements: string[]
  colorOnlyToneRows: string[]
  typographyViolations: string[]
  defaultOrColorDots: string[]
  decorativePiles: string[]
  consumerOverrides: string[]
}

const collectMetricSurfaceIssues = async (
  page: Page,
  minTargetSide: number,
): Promise<MetricSurfaceIssues> =>
  page.evaluate((min) => {
    const root = document.querySelector(
      '[data-testid="metric-visual-fixtures"]',
    )
    if (!root) throw new Error('metric fixtures not rendered')
    const px = (value: string) => Number.parseFloat(value) || 0
    const visible = (node: Element) => {
      const style = getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) > 0 &&
        rect.width > 1 &&
        rect.height > 1
      )
    }
    const describe = (node: Element, extra = '') =>
      `${node.tagName.toLowerCase()}.${[...node.classList].join('.')}${extra}`

    const panelRows: string[] = []
    for (const row of root.querySelectorAll<HTMLElement>(
      '.el-metric-item, .el-key-value-item, .el-diagnostics-item',
    )) {
      if (!visible(row)) continue
      const style = getComputedStyle(row)
      const sides = [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ].filter((width) => px(width) > 0)
      const hasBackground =
        style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        style.backgroundColor !== 'transparent'
      const radius = px(style.borderRadius)
      if (radius > 0 || hasBackground || sides.length === 4) {
        panelRows.push(describe(row))
      }
    }

    const lowTargets: string[] = []
    const targetNodes = root.querySelectorAll<HTMLElement>(
      [
        '.el-copyable-detail__button',
        '.el-diagnostics-item__detail-toggle',
        '.el-status-summary__actions > button',
        '.el-status-summary__actions > a[href]',
        '.el-status-summary__actions > [role="button"]',
        '.el-diagnostics-item__actions > button',
        '.el-diagnostics-item__actions > a[href]',
        '.el-diagnostics-item__actions > [role="button"]',
      ].join(','),
    )
    for (const target of targetNodes) {
      if (!visible(target)) continue
      const rect = target.getBoundingClientRect()
      // Same fixed floor as the shared geometry contract: browser zoom may
      // scale rendered pixels but never lowers the usable target size.
      if (rect.width + 1 < min || rect.height + 1 < min) {
        lowTargets.push(
          `${describe(target)} ${Math.round(rect.width)}x${Math.round(rect.height)} < ${min}`,
        )
      }
    }

    const fadedElements: string[] = []
    for (const node of root.querySelectorAll<HTMLElement>(
      [
        '.el-metric-item',
        '.el-key-value-item',
        '.el-status-summary',
        '.el-diagnostics-item',
        '.el-copyable-detail',
        '.el-copyable-detail__button',
        '.el-diagnostics-item__detail-toggle',
        '.el-status-summary__actions > button',
        '.el-status-summary__actions > a[href]',
        '.el-status-summary__actions > [role="button"]',
        '.el-diagnostics-item__actions > button',
        '.el-diagnostics-item__actions > a[href]',
        '.el-diagnostics-item__actions > [role="button"]',
      ].join(','),
    )) {
      if (!visible(node)) continue
      if (Number(getComputedStyle(node).opacity) !== 1) {
        fadedElements.push(describe(node))
      }
    }

    const colorOnlyToneRows: string[] = []
    const toneRowSelector =
      '.is-warning, .is-danger, .is-success, [class*="--success"], [class*="--warning"], [class*="--danger"]'
    for (const row of root.querySelectorAll<HTMLElement>(toneRowSelector)) {
      if (!visible(row)) continue
      if (
        !['ARTICLE', 'DIV'].includes(row.tagName) ||
        row.classList.contains('el-tag') ||
        row.classList.contains('el-button')
      ) {
        continue
      }
      const style = getComputedStyle(row)
      const markerWidth = Math.max(
        px(style.borderInlineStartWidth),
        px(style.borderInlineEndWidth),
      )
      const structuralCue = markerWidth >= 3
      let textualSignal = false
      for (const candidate of [
        row,
        ...row.querySelectorAll<HTMLElement>(
          'span, strong, p, code, button, a, dt, dd',
        ),
      ]) {
        if (!visible(candidate)) continue
        const ownText = [...candidate.childNodes]
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent?.trim() ?? '')
          .join(' ')
          .trim()
        if (ownText) {
          textualSignal = true
          break
        }
      }
      if (!structuralCue && !textualSignal) {
        colorOnlyToneRows.push(describe(row))
      }
    }

    const typographyViolations: string[] = []
    for (const node of root.querySelectorAll<HTMLElement>(
      [
        '.el-distribution-bar-row__value',
        '.el-key-value-item__label',
        '.el-key-value-item__value',
        '.el-status-summary__label',
        '.el-status-summary__status',
        '.el-diagnostics-item__detail-toggle',
        '.el-copyable-detail__button',
      ].join(','),
    )) {
      if (!visible(node)) continue
      const style = getComputedStyle(node)
      const fontSize = px(style.fontSize)
      const fontWeight = Number.parseInt(style.fontWeight, 10)
      if (![12, 14, 16].includes(fontSize) || fontWeight > 500) {
        typographyViolations.push(
          `${describe(node)} ${fontSize}px/${fontWeight}`,
        )
      }
    }

    const defaultOrColorDots: string[] = []
    for (const label of root.querySelectorAll<HTMLElement>(
      '.el-key-value-item__label',
    )) {
      if (!visible(label)) continue
      const pseudo = getComputedStyle(label, '::before')
      if (pseudo.content !== 'none' && pseudo.content !== 'normal') {
        defaultOrColorDots.push(
          `${describe(label)} content=${pseudo.content} color=${pseudo.color}`,
        )
      }
    }

    const decorativePiles = [
      ...root.querySelectorAll<HTMLElement>(
        '.el-badge, [data-metric-sparkline], .el-card .el-card, [data-metric-card-stack]',
      ),
    ]
      .filter(visible)
      .map((node) => describe(node))

    const consumerOverrides = [
      ...root.querySelectorAll<HTMLElement>(
        'style[data-issue-468-consumer-override], [data-metric-consumer-override]',
      ),
    ].map((node) => describe(node))

    return {
      panelRows,
      lowTargets,
      fadedElements,
      colorOnlyToneRows,
      typographyViolations,
      defaultOrColorDots,
      decorativePiles,
      consumerOverrides,
    }
  }, minTargetSide)

const openMetricFixtures = async (page: Page, projectName: string) => {
  await page.goto(buildVisualUrl('metric-visual', projectName), {
    waitUntil: 'domcontentloaded',
  })
  await stabilizePage(page)
}

// Row flatness: internal item rows stay transparent, square, and divider-only.
// Kills "per-item panel" and "diagnostic card" regressions at rendered level.
test('item rows stay flat without per-item panels', async ({
  page,
}, testInfo) => {
  await openMetricFixtures(page, testInfo.project.name)
  const issues = await collectMetricSurfaceIssues(page, 40)
  expect(issues.panelRows).toEqual([])
})

// Tone semantics: narrow inline-start markers only (no large tinted border),
// plus a non-color signal (visible status text) on every toned row.
test('tone markers stay narrow and toned rows keep textual signals', async ({
  page,
}, testInfo) => {
  await openMetricFixtures(page, testInfo.project.name)
  const issues = await collectMetricSurfaceIssues(page, 40)
  expect(issues.colorOnlyToneRows).toEqual([])

  const ltrItem = page.locator(
    '[data-metric-variant="diag-mixed"] > .el-diagnostics-list > .el-diagnostics-item.is-warning',
  )
  const markerSides = await ltrItem.evaluate((node) => {
    const style = getComputedStyle(node)
    return {
      top: Number.parseFloat(style.borderTopWidth),
      inlineStart: Number.parseFloat(style.borderInlineStartWidth),
      inlineEnd: Number.parseFloat(style.borderInlineEndWidth),
      bottom: Number.parseFloat(style.borderBottomWidth),
    }
  })
  expect(markerSides.top).toBe(0)
  expect(markerSides.inlineStart).toBe(3)
  expect(markerSides.inlineEnd).toBe(0)
  expect(markerSides.bottom).toBe(0)
  const successSummary = page.locator(
    '[data-metric-variant="summary-success"] .el-status-summary',
  )
  // The aggregate keeps its single neutral panel; only the left edge carries
  // the tone marker.
  const summaryBorders = await successSummary.evaluate((node) => {
    const style = getComputedStyle(node)
    return {
      neutral: Number.parseFloat(style.borderTopWidth),
      inlineStart: Number.parseFloat(style.borderInlineStartWidth),
      inlineEnd: Number.parseFloat(style.borderInlineEndWidth),
      bottom: Number.parseFloat(style.borderBottomWidth),
    }
  })
  // One neutral 1px panel outline; only the inline-start edge widens to the
  // 3px tone marker (ratio-based so device-pixel rounding stays irrelevant).
  expect(summaryBorders.neutral).toBeGreaterThan(0)
  expect(summaryBorders.inlineStart / summaryBorders.neutral).toBeCloseTo(3, 5)
  expect(summaryBorders.inlineEnd).toBeCloseTo(summaryBorders.neutral, 5)
  expect(summaryBorders.bottom).toBeCloseTo(summaryBorders.neutral, 5)
})

// Hit-area contract: desktop >= 40px, mobile >= 44px, stable under zoom.
test('inline actions meet DOMRect hit targets across zoom', async ({
  page,
}, testInfo) => {
  const { compact } = resolveVisualVariant(testInfo.project.name)
  const minSide = compact ? 44 : 40
  await openMetricFixtures(page, testInfo.project.name)

  const measureTargets = () =>
    page.evaluate((min) => {
      const nodes = document.querySelectorAll<HTMLElement>(
        [
          '.el-copyable-detail__button',
          '.el-diagnostics-item__detail-toggle',
          '.el-status-summary__actions > button',
          '.el-status-summary__actions > a[href]',
          '.el-status-summary__actions > [role="button"]',
          '.el-diagnostics-item__actions > button',
          '.el-diagnostics-item__actions > a[href]',
          '.el-diagnostics-item__actions > [role="button"]',
        ].join(','),
      )
      return [...nodes]
        .filter(
          (node) =>
            getComputedStyle(node).display !== 'none' &&
            node.getBoundingClientRect().width > 0,
        )
        .map((node) => {
          const rect = node.getBoundingClientRect()
          return {
            label:
              node.getAttribute('aria-label') ?? node.textContent?.trim() ?? '',
            width: Math.round(rect.width * 10) / 10,
            height: Math.round(rect.height * 10) / 10,
          }
        })
        .filter((box) => box.width + 1 < min || box.height + 1 < min)
    }, minSide)

  expect(
    await page.locator('.el-copyable-detail__button').count(),
  ).toBeGreaterThanOrEqual(3)
  expect(
    await page.locator('.el-diagnostics-item__detail-toggle').count(),
  ).toBeGreaterThanOrEqual(2)
  expect(
    await page
      .locator(
        '.el-status-summary__actions > button, .el-diagnostics-item__actions > button, .el-diagnostics-item__actions > a[href]',
      )
      .count(),
  ).toBeGreaterThanOrEqual(3)
  expect(await measureTargets()).toEqual([])

  // Browser-zoom surrogate: apply zoom to the document, then re-run the same
  // fixed-floor assertion at 150%.
  await page.evaluate(() => {
    document.documentElement.style.zoom = '1.5'
  })
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
  })
  const zoomedFailures = await measureTargets()
  await page.evaluate(() => {
    document.documentElement.style.zoom = ''
  })
  expect(zoomedFailures).toEqual([])
})

// RTL: the inline-start marker flips to the physical right edge and the long
// monospace detail stays wrapped inside the row.
test('RTL diagnostics keep narrow markers and contained detail', async ({
  page,
}, testInfo) => {
  await openMetricFixtures(page, testInfo.project.name)

  const rtlBlock = page.locator('[data-metric-variant="diag-rtl"] > div')
  await expect(rtlBlock).toHaveAttribute('dir', 'rtl')

  const itemState = await rtlBlock
    .locator('.el-diagnostics-item.is-warning')
    .evaluate((node) => {
      const style = getComputedStyle(node)
      return {
        leftWidth: style.borderLeftWidth,
        rightWidth: style.borderRightWidth,
        paddingInlineStart: style.paddingInlineStart,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
      }
    })
  expect(itemState.leftWidth).toBe('0px')
  expect(itemState.rightWidth).toBe('3px')
  expect(itemState.scrollWidth).toBeLessThanOrEqual(itemState.clientWidth + 1)

  const rtlRow = page.locator(
    '[data-metric-variant="diag-rtl"] .el-diagnostics-list',
  )
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await testInfo.attach(`metric-diag-rtl-${testInfo.project.name}`, {
    body: await rtlRow.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  })
})

// Mutation probes: each documented regression from issue #467 must be caught
// by one of the rendered gates above.
test('surface gates kill documented regressions', async ({
  page,
}, testInfo) => {
  await openMetricFixtures(page, testInfo.project.name)
  const { compact } = resolveVisualVariant(testInfo.project.name)
  const minSide = compact ? 44 : 40

  const findings: {
    id: string
    expected: keyof MetricSurfaceIssues
    issues: string[]
  }[] = []
  const mutations: Array<{
    id: string
    expected: keyof MetricSurfaceIssues
    css?: string
    html?: string
  }> = [
    {
      id: 'thirteen-px-typography',
      expected: 'typographyViolations',
      css: '.el-status-summary__label{font-size:13px!important;}',
    },
    {
      id: 'seventeen-px-typography',
      expected: 'typographyViolations',
      css: '.el-key-value-item__value{font-size:17px!important;}',
    },
    {
      id: 'broad-ordinary-700-weight',
      expected: 'typographyViolations',
      css: '.el-distribution-bar-row__value,.el-key-value-item__label,.el-key-value-item__value,.el-status-summary__label,.el-status-summary__status,.el-diagnostics-item__detail-toggle,.el-copyable-detail__button{font-weight:700!important;}',
    },
    {
      id: 'default-dot-forest',
      expected: 'defaultOrColorDots',
      css: '.el-key-value-item__label::before{content:"\u2022"!important;color:var(--fsus-dot-gray)!important;}',
    },
    {
      id: 'colored-dot-forest',
      expected: 'defaultOrColorDots',
      css: '.el-key-value-item--success .el-key-value-item__label::before{content:"\u2022"!important;color:var(--el-color-success)!important;}',
    },
    {
      id: 'diagnostic-card',
      expected: 'panelRows' as const,
      css: '.el-diagnostics-item{padding:12px;border:1px solid var(--el-border-color-lighter);border-radius:12px;background:var(--el-bg-color);}',
    },
    {
      id: 'per-item-panel',
      expected: 'panelRows' as const,
      css: '.el-metric-item{border:1px solid var(--el-border-color-lighter);border-radius:12px;background:var(--el-bg-color);}',
    },
    {
      id: 'thirty-px-target',
      expected: 'lowTargets' as const,
      css: `
        .el-copyable-detail__button,
        .el-diagnostics-item__detail-toggle,
        .el-status-summary__actions > :is(button, a[href], [role="button"]),
        .el-diagnostics-item__actions > :is(button, a[href], [role="button"]) {
          min-width: 30px !important;
          width: 30px !important;
          min-height: 30px !important;
          height: 30px !important;
        }
      `,
    },
    {
      id: 'color-only-status',
      expected: 'colorOnlyToneRows' as const,
      css: `
        .el-diagnostics-item.is-warning > *, .el-key-value-item--success > *, .el-status-summary--success > * { visibility: hidden !important; }
        .el-diagnostics-item.is-warning, .el-status-summary--success { border-inline-start-width: 0 !important; }
        [class*="--danger"] { border-inline-start-width: 0 !important; }
      `,
    },
    {
      id: 'ancestor-opacity',
      expected: 'fadedElements' as const,
      css: '.el-copyable-detail.is-disabled { opacity: 0.55 !important; }',
    },
    {
      id: 'badge-pile',
      expected: 'decorativePiles',
      html: '<span class="el-badge">Repeated status badge</span>',
    },
    {
      id: 'sparkline-pile',
      expected: 'decorativePiles',
      html: '<svg data-metric-sparkline width="80" height="24" aria-label="Decorative sparkline"><path d="M0 20 L40 4 L80 16" stroke="currentColor" fill="none" /></svg>',
    },
    {
      id: 'card-stacking',
      expected: 'decorativePiles',
      html: '<div class="el-card" data-metric-card-stack><div class="el-card">Nested metric card</div></div>',
    },
    {
      id: 'consumer-private-override',
      expected: 'consumerOverrides',
      html: '<style data-issue-468-consumer-override>.consumer-dashboard .el-metric-item{font-size:17px!important}</style><div data-metric-consumer-override>Private override marker</div>',
    },
  ]

  for (const mutation of mutations) {
    const handle = mutation.css
      ? await page.addStyleTag({ content: mutation.css })
      : undefined
    if (mutation.html) {
      await page.evaluate(
        ({ id, html }) => {
          const root = document.querySelector(
            '[data-testid="metric-visual-fixtures"]',
          )
          if (!root) throw new Error('metric fixtures not rendered')
          const host = document.createElement('div')
          host.dataset.issue468Mutation = id
          host.innerHTML = html
          root.append(host)
        },
        { id: mutation.id, html: mutation.html },
      )
    }
    try {
      const issues = await collectMetricSurfaceIssues(page, minSide)
      findings.push({
        id: mutation.id,
        expected: mutation.expected,
        issues: issues[mutation.expected],
      })
      // A live regression of this category must never pass silently.
      expect(
        issues[mutation.expected].length,
        `${mutation.id} went undetected`,
      ).toBeGreaterThan(0)
    } finally {
      if (handle) await handle.evaluate((style) => style.remove())
      await page.evaluate((id) => {
        document.querySelector(`[data-issue468-mutation="${id}"]`)?.remove()
      }, mutation.id)
    }
  }

  // Restored state must be clean again across every gate.
  const restored = await collectMetricSurfaceIssues(page, minSide)
  expect(restored.panelRows).toEqual([])
  expect(restored.lowTargets).toEqual([])
  expect(restored.fadedElements).toEqual([])
  expect(restored.colorOnlyToneRows).toEqual([])
  expect(restored.typographyViolations).toEqual([])
  expect(restored.defaultOrColorDots).toEqual([])
  expect(restored.decorativePiles).toEqual([])
  expect(restored.consumerOverrides).toEqual([])

  await testInfo.attach('mutation-probe-findings', {
    body: Buffer.from(`${JSON.stringify(findings, null, 2)}\n`),
    contentType: 'application/json',
  })
})
