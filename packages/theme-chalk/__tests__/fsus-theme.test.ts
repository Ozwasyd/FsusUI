import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const themeSourceDir = path.resolve(dirname, '../src')

const compiledCss = new Map<string, string>()

const compileThemeFile = (fileName: string) => {
  const cached = compiledCss.get(fileName)

  if (cached) return cached

  const result = compile(path.resolve(themeSourceDir, fileName), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  })

  compiledCss.set(fileName, result.css)
  return result.css
}

const cssRules = (css: string, selector: string) => {
  const rules: string[] = []
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g

  for (const match of css.matchAll(rulePattern)) {
    const selectorList = match[1].replace(/\s+/g, ' ').trim()

    if (selectorList.includes(selector)) {
      rules.push(match[2].replace(/\s+/g, ' ').trim())
    }
  }

  return rules
}

const expectCssRule = (
  css: string,
  selector: string,
  declarations: string[],
) => {
  const rules = cssRules(css, selector)

  expect(rules, `No CSS rule found for "${selector}"`).not.toHaveLength(0)
  expect(
    rules.some((rule) =>
      declarations.every((declaration) => rule.includes(declaration)),
    ),
    `No CSS rule for "${selector}" contains ${declarations.join(', ')}`,
  ).toBe(true)
}

describe('Fsus theme visual baseline', () => {
  test('renders card tabs as quiet segmented navigation', () => {
    const css = compileThemeFile('fsus-theme.scss')

    expect(css).toContain('@keyframes fsus-tabs-indicator-in')
    expectCssRule(css, '.el-tabs--card > .el-tabs__header', [
      'height: auto;',
      'border-bottom: 0;',
    ])
    expectCssRule(css, '.el-tabs--card > .el-tabs__header .el-tabs__nav', [
      'gap: 8px;',
      'border: 0;',
      'border-radius: 0;',
      'overflow: visible;',
    ])
    expectCssRule(css, '.el-tabs--card > .el-tabs__header .el-tabs__item', [
      'height: 36px;',
      'margin: 0;',
      'border: 1px solid var(--el-border-color-lighter);',
      'border-radius: var(--fsus-radius-control-small);',
      'background: transparent;',
      'transform: translateZ(0);',
      'will-change: transform;',
    ])
    expectCssRule(
      css,
      '.el-tabs--card > .el-tabs__header .el-tabs__item:not(.is-disabled):hover',
      [
        'box-shadow: 0 6px 14px rgba(15, 15, 17, 0.04);',
        'transform: translate3d(0, -1px, 0);',
      ],
    )
    expectCssRule(
      css,
      '.el-tabs--card > .el-tabs__header .el-tabs__item:not(.is-disabled):active',
      [
        'background: var(--fsus-state-emphasis-bg);',
        'border-color: var(--fsus-state-focus-border);',
        'color: var(--fsus-scholarly-blue);',
        'box-shadow: inset 0 0 0 1px var(--fsus-state-focus-border);',
        'transform: translate3d(0, 1px, 0) scale(0.985);',
      ],
    )
    expectCssRule(
      css,
      '.el-tabs--card > .el-tabs__header .el-tabs__item.is-active',
      [
        'background: var(--fsus-state-selected-bg);',
        'border-color: var(--el-border-color-light);',
        'color: var(--el-text-color-primary);',
        'transform: translateZ(0);',
      ],
    )
    expectCssRule(
      css,
      '.el-tabs--card > .el-tabs__header .el-tabs__item.is-top.is-active::after',
      [
        'bottom: 5px;',
        'height: 2px;',
        'background: var(--fsus-scholarly-blue);',
        'transform-origin: center;',
        'animation: fsus-tabs-indicator-in var(--fsus-motion-control-fast) var(--fsus-motion-emphasized);',
      ],
    )
  })

  test('keeps border-card tabs on the same quiet baseline', () => {
    const css = compileThemeFile('fsus-theme.scss')

    expectCssRule(css, '.el-tabs--border-card > .el-tabs__header', [
      'height: auto;',
      'border-bottom: 0;',
    ])
    expectCssRule(
      css,
      '.el-tabs--border-card > .el-tabs__header .el-tabs__item',
      [
        'height: 36px;',
        'margin: 0;',
        'border: 1px solid var(--el-border-color-lighter);',
        'background: transparent;',
      ],
    )
    expectCssRule(css, '.el-tabs--border-card', [
      'border-color: var(--el-border-color-lighter);',
      'border-radius: var(--fsus-radius-control);',
      'box-shadow: none;',
    ])
  })

  test('does not force empty states into panel cards', () => {
    const css = compileThemeFile('fsus-theme.scss')

    expectCssRule(css, '.el-empty', [
      'background: transparent;',
      'border: 0;',
      'border-radius: 0;',
      'box-shadow: none;',
    ])
    expectCssRule(css, '.el-empty__bottom .el-button', [
      'background: transparent;',
      'border-color: transparent;',
      'box-shadow: none;',
      'font-weight: 700;',
    ])
  })

  test('keeps empty descriptions readable in narrow states', () => {
    const css = compileThemeFile('empty.scss')

    expect(css).toContain('--el-empty-description-max-width: 18rem;')
    expect(css).toContain('--el-empty-description-padding-inline: 12px;')
    expect(css).toContain('--el-empty-description-line-height: 1.7;')
    expectCssRule(css, '.el-empty__description', [
      'box-sizing: border-box;',
      'width: 100%;',
      'margin-inline: auto;',
      'max-width: var(--el-empty-description-max-width);',
      'padding-inline: var(--el-empty-description-padding-inline);',
      'font-weight: 400;',
      'line-height: var(--el-empty-description-line-height);',
      'letter-spacing: 0;',
      'overflow-wrap: anywhere;',
      'text-wrap: balance;',
    ])
    expectCssRule(css, '.el-empty__description--narrow', [
      '--el-empty-description-max-width: 14rem;',
    ])
    expectCssRule(css, '.el-empty__description--wide', [
      '--el-empty-description-max-width: 24rem;',
    ])
  })

  test('keeps bordered descriptions corners continuous', () => {
    const descriptionsCss = compileThemeFile('descriptions.scss')
    const fsusCss = compileThemeFile('fsus-theme.scss')

    expectCssRule(descriptionsCss, '.el-descriptions__body', [
      'box-sizing: border-box;',
      'border-radius: var(--el-border-radius-base);',
      'overflow: hidden;',
    ])
    expectCssRule(descriptionsCss, '.el-descriptions__body.is-bordered', [
      'border: var(--el-descriptions-table-border);',
    ])
    expectCssRule(
      descriptionsCss,
      '.el-descriptions__body .el-descriptions__table.is-bordered .el-descriptions__cell',
      [
        'border-right: var(--el-descriptions-table-border);',
        'border-bottom: var(--el-descriptions-table-border);',
      ],
    )
    expectCssRule(
      descriptionsCss,
      '.el-descriptions__body .el-descriptions__table.is-bordered tr .el-descriptions__cell:last-child',
      ['border-right: 0;'],
    )
    expectCssRule(
      descriptionsCss,
      '.el-descriptions__body .el-descriptions__table.is-bordered tr:last-child .el-descriptions__cell',
      ['border-bottom: 0;'],
    )
    expect(fsusCss).not.toMatch(
      /\.el-descriptions\s*\{[^}]*padding:\s*14px 16px;/s,
    )
    expect(fsusCss).not.toMatch(
      /\.el-descriptions(?:,|\s)[^{]*\{[^}]*box-shadow:[^;}]*var\(--el-box-shadow-light\)/s,
    )
  })

  test('keeps theme mode toggle controls visually lightweight', () => {
    const css = compileThemeFile('fsus-theme.scss')

    expectCssRule(css, '.el-theme-mode-toggle .el-radio-group', [
      'background: transparent;',
      'border: 1px solid var(--el-border-color-lighter);',
      'border-radius: 8px;',
      'padding: 2px;',
    ])
    expectCssRule(
      css,
      '.el-theme-mode-toggle .el-radio-button.is-active .el-radio-button__inner',
      [
        'background: var(--el-fill-color-light);',
        'box-shadow: none !important;',
      ],
    )
  })

  test('animates generic entry surfaces without requiring app-specific CSS', () => {
    const css = compileThemeFile('fsus-theme.scss')

    expectCssRule(css, '.fsus-entry', [
      'position: relative;',
      'box-sizing: border-box;',
      'cursor: pointer;',
      'transform: translateZ(0);',
      'will-change: transform;',
    ])
    expectCssRule(css, '[data-fsus-entry]', [
      'position: relative;',
      'box-sizing: border-box;',
      'cursor: pointer;',
      'transform: translateZ(0);',
    ])
    expectCssRule(css, '.el-card.is-interactive', [
      'position: relative;',
      'box-sizing: border-box;',
      'cursor: pointer;',
      'transform: translateZ(0);',
    ])
    expectCssRule(css, '.fsus-entry:hover', [
      'background: var(--el-bg-color);',
      'box-shadow: 0 10px 28px rgba(15, 15, 17, 0.06);',
      'transform: translate3d(0, -2px, 0);',
    ])
    expectCssRule(css, '[data-fsus-entry-control]:active', [
      'background: var(--fsus-state-emphasis-bg);',
      'border-color: var(--fsus-state-focus-border);',
      'box-shadow: inset 0 0 0 1px var(--fsus-state-focus-border);',
      'transform: translate3d(0, 1px, 0) scale(0.99);',
    ])
    expectCssRule(css, '.fsus-entry[aria-current=page]', [
      'background: var(--el-bg-color);',
      'color: var(--el-text-color-primary);',
      'box-shadow: inset 0 0 0 1px rgba(15, 15, 17, 0.04);',
    ])
  })

  test('isolates button loading indicators from button content', () => {
    const css = compileThemeFile('button.scss')

    expectCssRule(css, '.el-button__loading', [
      'position: relative;',
      'z-index: 2;',
      'display: inline-flex;',
      'align-items: center;',
      'justify-content: center;',
      'min-width: 0;',
    ])
    expectCssRule(css, '.el-button__loading', [
      'flex: 0 0 1em;',
      'width: 1em;',
      'height: 1em;',
      'overflow: hidden;',
      'line-height: 1;',
    ])
    expectCssRule(css, '.el-button__loading > *', [
      'flex: 0 0 1em;',
      'width: 1em;',
      'height: 1em;',
      'max-width: 1em;',
      'max-height: 1em;',
    ])
    expectCssRule(css, '.el-button .el-button__loading + .el-button__content', [
      'margin-left: 6px;',
    ])
    expectCssRule(
      css,
      '.el-button--large .el-button__loading + .el-button__content',
      ['margin-left: 8px;'],
    )
    expectCssRule(
      css,
      '.el-button--small .el-button__loading + .el-button__content',
      ['margin-left: 4px;'],
    )
  })

  test('keeps inline action buttons from wrapping into neighboring content', () => {
    const css = compileThemeFile('button.scss')

    expectCssRule(css, '.el-button.is-inline-action', [
      'white-space: nowrap;',
      'vertical-align: middle;',
    ])
    expectCssRule(css, '.el-button.is-inline-action > span', [
      'overflow-wrap: normal;',
      'white-space: nowrap;',
    ])
  })

  test('uses square table surfaces unless callers opt into another radius', () => {
    const tableCss = compileThemeFile('table.scss')
    const tableV2Css = compileThemeFile('table-v2.scss')

    expect(tableCss).toContain('--el-table-border-radius: 0;')
    expect(tableV2Css).toContain('--el-table-border-radius: 0;')
    expectCssRule(tableCss, '.el-table', [
      'border-radius: var(--el-table-border-radius);',
      'overflow: hidden;',
    ])
    expectCssRule(tableV2Css, '.el-table-v2__root', [
      'border-radius: var(--el-table-border-radius);',
      'overflow: hidden;',
    ])
  })

  test('prevents table interaction motion from overlapping fixed columns', () => {
    const themeCss = compileThemeFile('fsus-theme.scss')
    const tableCss = compileThemeFile('table.scss')

    expectCssRule(themeCss, '.el-table__row', ['transform: none;'])
    expectCssRule(themeCss, '.el-table .el-button:hover', ['transform: none;'])
    expectCssRule(themeCss, '.el-table .el-tag:active', ['transform: none;'])
    expectCssRule(themeCss, '.el-table .el-button', [
      'flex-shrink: 0;',
      'max-width: 100%;',
      'overflow-wrap: normal;',
      'white-space: nowrap;',
    ])
    expectCssRule(themeCss, '.el-table .el-button > span', [
      'overflow-wrap: normal;',
      'white-space: nowrap;',
    ])
    expectCssRule(themeCss, '.el-table .el-button.is-inline-action', [
      'min-height: 32px;',
      'height: 32px;',
      'padding-block: 0;',
      'padding-inline: 6px;',
      'vertical-align: middle;',
    ])
    expectCssRule(
      themeCss,
      '.el-table .el-table-fixed-column--right.el-table__cell',
      ['background: var(--el-bg-color);', 'background-clip: padding-box;'],
    )
    expectCssRule(
      themeCss,
      '.el-table .el-table__row:hover > .el-table-fixed-column--right.el-table__cell',
      [
        'background: var(--el-fill-color-light);',
        'background-clip: padding-box;',
      ],
    )
    expectCssRule(themeCss, '.el-table-v2__right', [
      'background: var(--el-bg-color);',
    ])
    expectCssRule(
      tableCss,
      '.el-table__header-wrapper tr td.el-table-fixed-column--right',
      ['background: var(--el-table-tr-bg-color);'],
    )
  })

  test('keeps card surfaces flat by default', () => {
    const css = compileThemeFile('card.scss')

    expectCssRule(css, '.el-card', ['box-shadow: none;'])
    expectCssRule(css, '.el-card.is-always-shadow', [
      'box-shadow: var(--el-box-shadow-lighter);',
    ])
    expectCssRule(css, '.el-card.is-hover-shadow:hover', [
      'box-shadow: var(--el-box-shadow-lighter);',
      'transform: translateY(-1px);',
    ])
  })
})
