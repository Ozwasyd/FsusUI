import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { compile } from 'sass'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { resolveVisualVariant } from '../../../scripts/visual-variant.mjs'

const repoRoot = path.resolve(process.cwd())
const fixtureRoot = path.join(
  repoRoot,
  'tests/fixtures/segmented-visual-primitive',
)
const sourceRoot = path.join(repoRoot, 'vue/packages/theme-chalk/src')
const fixtureHtml = readFileSync(path.join(fixtureRoot, 'probe.html'), 'utf8')

const compileProbeCss = () =>
  compile(path.join(fixtureRoot, 'probe.scss'), {
    loadPaths: [sourceRoot],
    style: 'expanded',
  }).css

const resolveColor = async (
  page: Page,
  token: string,
  property: 'color' | 'backgroundColor' | 'borderColor',
) =>
  page.evaluate(
    ({ propertyName, tokenName }) => {
      const probe = document.createElement('span')
      probe.style[propertyName] = `var(${tokenName})`
      document.body.append(probe)
      const value = window.getComputedStyle(probe)[propertyName]
      probe.remove()
      return value
    },
    { propertyName: property, tokenName: token },
  )

const resolveLength = async (page: Page, token: string) =>
  page.evaluate((tokenName) => {
    const probe = document.createElement('span')
    probe.style.width = `var(${tokenName})`
    probe.style.display = 'block'
    document.body.append(probe)
    const value = Number.parseFloat(window.getComputedStyle(probe).width)
    probe.remove()
    return value
  }, token)

const boxCenterY = async (locator: Locator) => {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!.y + box!.height / 2
}

const attachEvidence = async (
  page: Page,
  testInfo: TestInfo,
  theme: 'light' | 'dark',
) => {
  const fileName = `segmented-visual-primitive-${theme}.png`
  await page.screenshot({
    path: testInfo.outputPath(fileName),
    animations: 'disabled',
    fullPage: true,
  })
  await testInfo.attach(`segmented-visual-primitive-${theme}`, {
    path: testInfo.outputPath(fileName),
    contentType: 'image/png',
  })
}

test('issue #459 probe renders canonical geometry, layered states, content and RTL', async ({
  page,
}, testInfo) => {
  const { theme } = resolveVisualVariant(testInfo.project.name)
  const css = compileProbeCss()

  await page.setContent(`
    <!doctype html>
    <html data-theme-resolved="${theme}">
      <head>
        <meta charset="utf-8">
        <style>
          ${css}
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 24px;
            background: var(--fsus-page);
            color: var(--fsus-ink);
            font: 14px/1.4 Arial, sans-serif;
          }
          [data-segmented-fixture] {
            display: grid;
            gap: 24px;
            max-width: 720px;
          }
          [data-segmented-fixture] h1,
          [data-segmented-fixture] h2 {
            margin: 0 0 8px;
            font-size: 16px;
          }
          [data-segmented-fixture] section {
            overflow-x: auto;
            padding-block-end: 4px;
          }
          [data-fsus-segment-icon] {
            fill: none;
            stroke: currentColor;
            stroke-width: 1.75;
          }
        </style>
      </head>
      <body>${fixtureHtml}</body>
    </html>
  `)

  const shell = page.locator('[data-semantic-fixture="form-radio"]')
  const items = shell.locator('[data-fsus-segment-item]')
  const selected = items.nth(0)
  const hover = items.nth(1)
  const disabled = items.nth(2)
  const shellRadius = await resolveLength(page, '--fsus-radius-control')
  const itemHeightMin = await resolveLength(
    page,
    '--fsus-control-height-action',
  )
  const itemHeightMax = await resolveLength(
    page,
    '--fsus-control-height-compact',
  )

  expect(
    Number.parseFloat(
      await shell.evaluate((node) => getComputedStyle(node).borderRadius),
    ),
  ).toBe(shellRadius)
  for (const item of await items.all()) {
    const box = await item.boundingBox()
    const computedHeight = await item.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).height),
    )
    expect(box).not.toBeNull()
    expect(computedHeight).toBeGreaterThanOrEqual(itemHeightMin)
    expect(computedHeight).toBeLessThanOrEqual(itemHeightMax)
    expect(box!.height).toBeGreaterThanOrEqual(itemHeightMin - 0.01)
    expect(box!.height).toBeLessThanOrEqual(itemHeightMax + 0.01)
    await expect(item).toHaveCSS('opacity', '1')
  }

  const selectedBackground = await resolveColor(
    page,
    '--fsus-state-selected-bg',
    'backgroundColor',
  )
  const selectedBorder = await resolveColor(
    page,
    '--fsus-state-focus-border',
    'borderColor',
  )
  const scholarlyBlue = await resolveColor(
    page,
    '--fsus-scholarly-blue',
    'color',
  )
  await expect(selected).toHaveCSS('background-color', selectedBackground)
  await expect(selected).toHaveCSS('border-color', selectedBorder)
  await expect(selected).toHaveCSS('color', scholarlyBlue)
  await expect(selected).toHaveCSS('box-shadow', 'none')

  await page.keyboard.press('Tab')
  await selected.focus()
  await expect(selected).toBeFocused()
  await expect
    .poll(() => selected.evaluate((node) => node.matches(':focus-visible')))
    .toBe(true)
  const focusWidth = await resolveLength(page, '--fsus-focus-ring-width')
  const selectedFocusShadow = await selected.evaluate(
    (node) => getComputedStyle(node).boxShadow,
  )
  expect(selectedFocusShadow).toContain('inset')
  expect(selectedFocusShadow).toContain(`${focusWidth}px`)
  await expect(selected).toHaveCSS('background-color', selectedBackground)

  const hoverBackground = await resolveColor(
    page,
    '--fsus-state-hover-bg',
    'backgroundColor',
  )
  await hover.hover()
  await expect(hover).toHaveCSS('background-color', hoverBackground)
  expect(
    await hover.evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe(selectedBackground)

  const disabledBackground = await resolveColor(
    page,
    '--el-disabled-bg-color',
    'backgroundColor',
  )
  const disabledText = await resolveColor(
    page,
    '--el-disabled-text-color',
    'color',
  )
  const disabledBorder = await resolveColor(
    page,
    '--el-disabled-border-color',
    'borderColor',
  )
  await expect(disabled).toHaveCSS('background-color', disabledBackground)
  await expect(disabled).toHaveCSS('color', disabledText)
  await expect(disabled).toHaveCSS('border-color', disabledBorder)
  await expect(disabled).toHaveCSS('opacity', '1')
  await expect(disabled).toHaveCSS('box-shadow', 'none')
  await disabled.hover({ force: true })
  await expect(disabled).toHaveCSS('background-color', disabledBackground)

  const boxes = await items.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return { left: box.left, right: box.right }
    }),
  )
  expect(Math.abs(boxes[0]!.right - boxes[1]!.left)).toBeLessThanOrEqual(1)
  expect(Math.abs(boxes[1]!.right - boxes[2]!.left)).toBeLessThanOrEqual(1)

  const icon = selected.locator('[data-fsus-segment-icon]')
  const iconLabel = selected.locator('[data-fsus-segment-label]')
  expect(
    Math.abs((await boxCenterY(icon)) - (await boxCenterY(iconLabel))),
  ).toBeLessThanOrEqual(1)
  const longLabel = hover.locator('[data-fsus-segment-label]')
  expect(
    await longLabel.evaluate((node) => node.scrollWidth === node.clientWidth),
  ).toBe(true)
  await expect(longLabel).toHaveCSS('overflow', 'visible')

  const rtl = page.locator('[data-semantic-fixture="rtl"]')
  const rtlItems = rtl.locator('[data-fsus-segment-item]')
  const rtlFirst = await rtlItems.nth(0).boundingBox()
  const rtlSecond = await rtlItems.nth(1).boundingBox()
  expect(rtlFirst).not.toBeNull()
  expect(rtlSecond).not.toBeNull()
  expect(rtlFirst!.x).toBeGreaterThan(rtlSecond!.x)
  await expect(rtlItems.nth(0)).toHaveCSS('text-align', 'start')

  await expect(shell).toHaveAttribute('role', 'radiogroup')
  await expect(
    page.locator('[data-semantic-fixture="form-checkbox"]'),
  ).toHaveAttribute('role', 'group')
  await expect(
    page.locator('[data-semantic-fixture="navigation-toggle"]'),
  ).toHaveAttribute('role', 'toolbar')
  await expect(
    page
      .locator('[data-semantic-fixture="navigation-toggle"]')
      .locator('[data-fsus-segment-item]')
      .first(),
  ).toHaveAttribute('aria-pressed', 'true')

  await attachEvidence(page, testInfo, theme)
})
