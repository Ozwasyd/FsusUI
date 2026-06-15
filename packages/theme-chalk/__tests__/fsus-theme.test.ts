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

  test('aligns public focus and active states with Scholarly Blue', () => {
    const inputCss = compileThemeFile('input.scss')
    const tabsCss = compileThemeFile('tabs.scss')
    const themeCss = compileThemeFile('fsus-theme.scss')
    const publicShellCss = compileThemeFile('public-shell.scss')

    expectCssRule(inputCss, '.el-textarea__inner:focus-visible', [
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
    ])
    expectCssRule(tabsCss, '.el-tabs__active-bar', [
      'background-color: var(--fsus-scholarly-blue);',
    ])
    expectCssRule(tabsCss, '.el-tabs__item:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
    ])
    expectCssRule(tabsCss, '.el-tabs__item.is-active', [
      'color: var(--el-text-color-primary);',
    ])
    expectCssRule(themeCss, '.el-tabs__item.is-active', [
      'color: var(--el-text-color-primary);',
    ])
    expectCssRule(publicShellCss, '.el-public-shell__nav-link', [
      'border-bottom: 2px solid transparent;',
      'padding-bottom: 2px;',
    ])
    expectCssRule(publicShellCss, '.el-public-shell__nav-link.is-active', [
      'border-bottom-color: var(--fsus-scholarly-blue);',
    ])
    for (const selector of [
      '.el-public-shell__brand:focus-visible',
      '.el-public-shell__nav-link:focus-visible',
      '.el-public-shell__action-link:focus-visible',
    ]) {
      expectCssRule(publicShellCss, selector, [
        'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
      ])
    }
  })

  test('keeps closable card tabs hit areas stable', () => {
    const css = compileThemeFile('tabs.scss')

    expectCssRule(
      css,
      '.el-tabs--card > .el-tabs__header .el-tabs__item .is-icon-close',
      [
        'flex: 0 0 14px;',
        'width: 14px;',
        'opacity: 0;',
        'pointer-events: none;',
      ],
    )
    expectCssRule(
      css,
      '.el-tabs--card > .el-tabs__header .el-tabs__item.is-closable:hover .is-icon-close',
      ['opacity: 1;', 'pointer-events: auto;'],
    )
    expectCssRule(
      css,
      '.el-tabs--card > .el-tabs__header .el-tabs__item.is-active.is-closable .is-icon-close',
      ['opacity: 1;', 'pointer-events: auto;'],
    )
    expect(css).not.toContain('padding-left: 13px;')
    expect(css).not.toContain('padding-right: 13px;')
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

  test('keeps empty-state primitives flat and density-aware', () => {
    const css = compileThemeFile('empty-state.scss')

    expectCssRule(css, '.el-empty-state', [
      'box-sizing: border-box;',
      'display: flex;',
      'width: 100%;',
      'max-width: 100%;',
      'flex-direction: column;',
      'align-items: flex-start;',
      'text-align: left;',
      'letter-spacing: 0;',
    ])
    expectCssRule(css, '.el-empty-state--inline', [
      '--el-empty-state-description-width: 28rem;',
      '--el-empty-state-illustration-size: 24px;',
      'padding: 8px 0;',
    ])
    expectCssRule(css, '.el-empty-state--compact', [
      '--el-empty-state-description-width: 30rem;',
      '--el-empty-state-illustration-size: 32px;',
      'padding: 20px 0;',
    ])
    expectCssRule(css, '.el-empty-state--page', [
      '--el-empty-state-title-size: 20px;',
      '--el-empty-state-illustration-size: 64px;',
      'align-items: center;',
      'max-width: 36rem;',
      'margin-inline: auto;',
      'padding: 56px 16px;',
      'text-align: center;',
    ])
    expect(css).not.toMatch(/\.el-empty-state\s*\{[^}]*box-shadow:/s)
  })

  test('keeps collection primitives flat and responsive', () => {
    const css = compileThemeFile('collection-primitives.scss')

    expectCssRule(css, '.el-collection-toolbar', [
      'display: grid;',
      'grid-template-columns: minmax(14rem, 1fr) minmax(0, auto) auto;',
      'gap: 12px;',
      'padding: 0;',
    ])
    expectCssRule(css, '.el-filter-group', [
      'margin: 0;',
      'padding: 0;',
      'border: 0;',
    ])
    expectCssRule(css, '.el-segmented-control', [
      'display: inline-flex;',
      'border: 1px solid var(--el-border-color-lighter);',
      'background: transparent;',
    ])
    expectCssRule(css, '.el-collection-summary', [
      'display: flex;',
      'align-items: baseline;',
      'justify-content: space-between;',
    ])
    expectCssRule(css, '.el-pagination-bar', [
      'display: flex;',
      'align-items: center;',
      'justify-content: space-between;',
    ])
    expect(css).not.toMatch(/\.el-collection-toolbar\s*\{[^}]*box-shadow:/s)
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
      'box-shadow: none;',
      'transform: translate3d(0, -1px, 0);',
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

  test('keeps high-frequency component states aligned with design details', () => {
    const buttonCss = compileThemeFile('button.scss')
    const drawerCss = compileThemeFile('drawer.scss')
    const dropdownCss = compileThemeFile('dropdown.scss')
    const tableCss = compileThemeFile('table.scss')

    expect(buttonCss).not.toMatch(
      /\.el-button:hover\s*\{[^}]*opacity:\s*0\.85;/s,
    )
    expectCssRule(buttonCss, '.el-button:hover', [
      'color: var(--el-button-hover-text-color);',
      'border-color: var(--el-button-hover-border-color);',
      'background-color: var(--el-button-hover-bg-color);',
    ])
    expectCssRule(drawerCss, '.el-drawer__title', ['letter-spacing: 0;'])
    expectCssRule(drawerCss, '.el-drawer__close-btn', [
      'width: 54px;',
      'height: 54px;',
      'min-width: 54px;',
      'min-height: 54px;',
      'padding: 0;',
    ])
    expectCssRule(dropdownCss, '.el-dropdown-menu', ['padding: 8px 0;'])
    expectCssRule(tableCss, '.el-table .cell', ['padding: 0 16px;'])
    expectCssRule(
      tableCss,
      '.el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell',
      [
        'background-color: var(--el-table-row-hover-bg-color);',
        'color: var(--el-table-text-color);',
      ],
    )
  })

  test('supports component-level motion disablement and dialog scale fade', () => {
    const themeCss = compileThemeFile('fsus-theme.scss')
    const dialogCss = compileThemeFile('dialog.scss')

    expectCssRule(themeCss, '[data-fsus-motion-disabled=true]', [
      'transition-duration: 1ms !important;',
      'animation-duration: 1ms !important;',
      'animation-iteration-count: 1 !important;',
    ])
    expectCssRule(themeCss, '[data-fsus-motion-disabled=true]:hover', [
      'transform: none !important;',
      'filter: none !important;',
    ])
    expectCssRule(dialogCss, '.dialog-scale-fade-enter-active', [
      'animation: modal-fade-in var(--fsus-motion-overlay, 300ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expectCssRule(
      dialogCss,
      '.dialog-scale-fade-enter-active .el-overlay-dialog',
      [
        'animation: dialog-scale-fade-in var(--fsus-motion-panel, 420ms) var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1));',
      ],
    )
    expectCssRule(
      dialogCss,
      '.dialog-scale-fade-leave-active .el-overlay-dialog',
      [
        'animation: dialog-scale-fade-out var(--fsus-motion-panel, 420ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
      ],
    )
    expect(dialogCss).toContain('@keyframes dialog-scale-fade-in')
    expect(dialogCss).toContain('@keyframes dialog-scale-fade-out')
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

  test('keeps scrollbar touch panning native with opt-in containment', () => {
    const scrollbarCss = compileThemeFile('scrollbar.scss')
    const publicShellCss = compileThemeFile('public-shell.scss')
    const virtualListCss = compileThemeFile('virtual-list.scss')

    expectCssRule(scrollbarCss, '.el-scrollbar__wrap', [
      'touch-action: pan-x pan-y;',
      'overscroll-behavior: auto;',
    ])
    expectCssRule(scrollbarCss, '.el-scrollbar--contain-overscroll', [
      'overscroll-behavior: contain;',
    ])
    expectCssRule(scrollbarCss, '[data-fsus-overscroll=contain]', [
      'overscroll-behavior: contain;',
    ])
    expectCssRule(scrollbarCss, '.el-scrollbar__bar', [
      'touch-action: none;',
      'user-select: none;',
    ])
    expectCssRule(scrollbarCss, '.el-scrollbar__thumb', ['touch-action: none;'])

    expectCssRule(publicShellCss, '.el-public-shell__mobile-nav-wrap', [
      'touch-action: pan-x pan-y;',
      'overscroll-behavior-x: contain;',
      'overscroll-behavior-y: auto;',
    ])

    expectCssRule(virtualListCss, '.el-vl__window', [
      'touch-action: pan-x pan-y;',
      'overscroll-behavior: auto;',
    ])
    expectCssRule(virtualListCss, '.el-vl__wrapper[data-fsus-overscroll', [
      'overscroll-behavior: contain;',
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

  test('keeps dense action rows motion-safe and non-overlapping', () => {
    const css = compileThemeFile('fsus-theme.scss')

    expectCssRule(css, '.fsus-action-row', [
      'display: inline-flex;',
      'align-items: center;',
      'justify-content: flex-end;',
      'gap: var(--fsus-space-2);',
      'overflow: hidden;',
      'isolation: isolate;',
      'transform: none;',
    ])
    expectCssRule(css, '[data-fsus-table-actions]', [
      'display: inline-flex;',
      'max-width: 100%;',
      'overflow: hidden;',
      'transform: none;',
    ])
    expectCssRule(css, '.fsus-action-row > *', [
      'flex: 0 0 auto;',
      'transform: none;',
    ])
    expectCssRule(css, '.fsus-action-row .el-tag', [
      'max-width: 100%;',
      'overflow: hidden;',
      'text-overflow: ellipsis;',
    ])
    expectCssRule(css, '.fsus-action-row .el-button:hover', [
      'transform: none;',
    ])
  })

  test('keeps settings primitives flat, responsive, and risk-aware', () => {
    const css = compileThemeFile('settings-primitives.scss')

    expectCssRule(css, '.el-section-nav', [
      'display: flex;',
      'flex-wrap: wrap;',
      'gap: 6px;',
    ])
    expectCssRule(css, '.el-settings-section', [
      'display: grid;',
      'border-top: 1px solid var(--el-border-color-lighter);',
    ])
    expectCssRule(css, '.el-section-header', [
      'display: grid;',
      'grid-template-columns: minmax(0, 1fr) auto;',
    ])
    expectCssRule(css, '.el-resource-list', [
      'border: 1px solid var(--el-border-color-lighter);',
      'border-radius: var(--fsus-radius-panel, 8px);',
      'box-shadow: none;',
    ])
    expectCssRule(css, '.el-metadata-row', [
      'display: flex;',
      'flex-wrap: wrap;',
    ])
    expectCssRule(css, '.el-danger-zone', [
      'display: grid;',
      'border-top: 1px solid color-mix(in srgb, var(--el-color-danger) 38%, var(--el-border-color-lighter));',
    ])
    expectCssRule(css, '.el-typed-confirm-field__input:focus', [
      'border-color: var(--el-color-primary);',
    ])
    expect(css).toContain('@media (max-width: 640px)')
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(css).not.toMatch(/\.el-settings-section\s*\{[^}]*box-shadow:/s)
    expect(css).not.toMatch(/gradient|backdrop-filter|blur\(/)
  })

  test('keeps metric primitives flat, readable, and chart-free', () => {
    const css = compileThemeFile('metric-primitives.scss')

    expectCssRule(css, '.el-metric-list', [
      'display: grid;',
      'box-shadow: none;',
    ])
    expectCssRule(css, '.el-metric-item__primary', [
      'font-variant-numeric: tabular-nums;',
      'letter-spacing: 0;',
    ])
    expectCssRule(css, '.el-distribution-bar-row__bar', [
      'grid-column: 2/-1;',
      'height: 6px;',
    ])
    expectCssRule(css, '.el-key-value-grid', [
      'display: grid;',
      'grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));',
    ])
    expectCssRule(css, '.el-diagnostics-item__detail-body', [
      'font-family: var(--el-font-family-monospace, monospace);',
      'overflow-wrap: anywhere;',
    ])
    expect(css).toContain('@media (max-width: 640px)')
    expect(css).not.toMatch(/gradient|backdrop-filter|blur\(/)
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

  test('keeps inbox primitives flat and scroll-owned', () => {
    const css = compileThemeFile('inbox-primitives.scss')

    expectCssRule(css, '.el-inbox-layout', [
      'grid-template-columns: minmax(16rem, 0.38fr) minmax(0, 1fr);',
      'min-height: 32rem;',
      'overflow: hidden;',
      'box-shadow: none;',
    ])
    expectCssRule(css, '.el-inbox-layout__list', [
      'min-height: 0;',
      'overflow: auto;',
      'overscroll-behavior: contain;',
    ])
    expectCssRule(css, '.el-inbox-layout__detail', [
      'min-height: 0;',
      'overflow: auto;',
      'overscroll-behavior: contain;',
    ])
    expectCssRule(css, '.el-thread-panel', [
      'grid-template-rows: auto auto minmax(0, 1fr) auto;',
      'min-height: 100%;',
    ])
    expectCssRule(css, '.el-thread-panel__messages', [
      'min-height: 0;',
      'overflow: auto;',
      'overscroll-behavior: contain;',
    ])
    expectCssRule(css, '.el-message-bubble__body', [
      'white-space: pre-wrap;',
      'overflow-wrap: anywhere;',
    ])
    expect(css).toContain(
      '.el-inbox-layout.el-inbox-layout--mobile-list .el-inbox-layout__detail',
    )
    expect(css).not.toMatch(
      /\.el-(?:inbox-layout|split-pane|message-bubble)[^{]*\{[^}]*(?:linear-gradient|backdrop-filter|filter:\s*blur)/s,
    )
  })
})
