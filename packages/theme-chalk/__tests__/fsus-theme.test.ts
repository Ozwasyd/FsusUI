import { readFileSync } from 'node:fs'
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

  test('aligns markdown editor focus states with the shared 2px contract', () => {
    const css = compileThemeFile('markdown-editor.scss')

    for (const selector of [
      '.el-markdown-editor__command:focus-visible',
      '.el-markdown-editor__mode:focus-visible',
      '.el-markdown-editor__action:focus-visible',
      '.el-markdown-editor__textarea:focus-visible',
    ]) {
      expectCssRule(css, selector, [
        'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
      ])
    }

    expectCssRule(css, '.el-markdown-editor__command:hover', [
      'background: var(--fsus-state-hover-bg);',
      'border-color: var(--fsus-state-focus-border);',
      'color: var(--el-text-color-primary);',
    ])
    expectCssRule(css, '.el-markdown-editor__mode.is-active', [
      'background: var(--fsus-state-selected-bg);',
      'color: var(--el-text-color-primary);',
      'box-shadow: inset 0 0 0 1px var(--fsus-state-focus-border);',
    ])
    expect(css).not.toMatch(
      /\.el-markdown-editor__(?:command|mode|action)(?::hover|:focus-visible)[^{]*\{[^}]*var\(--el-color-primary\)/s,
    )
    expect(css).not.toMatch(
      /\.el-markdown-editor__mode\.is-active\s*\{[^}]*(?:var\(--el-color-primary\)|var\(--el-color-white\))/s,
    )
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

  test('supports theme mode menu-button as restrained paper menu', () => {
    const css = compileThemeFile('theme-mode-toggle.scss')

    expectCssRule(css, '.el-theme-mode-toggle__menu-button', [
      'min-height: 40px;',
      'border: 1px solid var(--el-border-color-lighter);',
      'border-radius: var(--el-border-radius-small);',
    ])
    expectCssRule(css, '.el-theme-mode-toggle__menu', [
      'position: absolute;',
      'min-width: 132px;',
      'border: 1px solid var(--el-border-color-lighter);',
      'border-radius: 8px;',
      'background: var(--el-bg-color);',
      'box-shadow: var(--el-box-shadow-light);',
    ])
    expectCssRule(css, '.el-theme-mode-toggle__menu-item', [
      'min-height: 36px;',
      'background: transparent;',
      'text-align: left;',
    ])
    expectCssRule(css, '.el-theme-mode-toggle__menu-item[aria-checked=true]', [
      'background: var(--el-fill-color-light);',
      'color: var(--el-text-color-primary);',
    ])
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

  test('keeps default loading primitives neutral and non-looping', () => {
    const loadingCss = compileThemeFile('loading.scss')
    const spinnerCss = compileThemeFile('spinner.scss')
    const skeletonCss = compileThemeFile('skeleton.scss')
    const markdownCss = compileThemeFile('markdown-renderer.scss')
    const themeCss = compileThemeFile('fsus-theme.scss')

    expectCssRule(loadingCss, '.el-loading-spinner .circular', [
      'background: var(--el-fill-color-light);',
      'animation: none;',
    ])
    expectCssRule(loadingCss, '.el-loading-spinner .path', [
      'animation: none;',
      'stroke: var(--el-border-color);',
    ])
    expectCssRule(loadingCss, '.el-loading-spinner.is-animated .circular', [
      'animation: loading-rotate 2s linear infinite;',
    ])
    expectCssRule(
      loadingCss,
      '[data-fsus-loading-motion=spinner] .el-loading-spinner .path',
      ['animation: loading-dash 1.5s ease-in-out infinite;'],
    )
    expectCssRule(spinnerCss, '.el-spinner-inner', [
      'background-color: var(--el-fill-color-light, #f4f4f5);',
      'animation: none;',
    ])
    expect(skeletonCss).not.toContain('linear-gradient')
    expect(skeletonCss).not.toContain('el-skeleton-loading')
    expectCssRule(skeletonCss, '.el-skeleton.is-animated .el-skeleton__item', [
      'animation: skeleton-zinc-pulse 1.5s ease-in-out infinite;',
    ])
    expectCssRule(markdownCss, '.markdown-renderer__loading-spinner', [
      'background: var(--el-fill-color-light);',
      'animation: none;',
    ])
    expect(markdownCss).not.toContain('markdown-renderer-spin')
    expectCssRule(themeCss, '.el-loading-spinner .circular', [
      'background: var(--el-fill-color-light);',
      'animation: none;',
    ])
    expect(themeCss).not.toContain('punctuation-zinc-pulse 1.2s')
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
    expectCssRule(dialogCss, '.dialog-fade-enter-active', [
      'animation: modal-fade-in var(--fsus-motion-overlay, 300ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expectCssRule(dialogCss, '.dialog-fade-enter-active .el-overlay-dialog', [
      'animation: dialog-fade-in var(--fsus-motion-panel, 420ms) var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1));',
    ])
    expectCssRule(dialogCss, '.dialog-fade-leave-active .el-overlay-dialog', [
      'animation: dialog-fade-out var(--fsus-motion-panel, 420ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expect(dialogCss).toContain('@keyframes dialog-scale-fade-in')
    expect(dialogCss).toContain('@keyframes dialog-scale-fade-out')
  })

  test('keeps overlay panels border-first by default', () => {
    const drawerCss = compileThemeFile('drawer.scss')
    const selectDropdownCss = compileThemeFile('select-dropdown.scss')

    expectCssRule(drawerCss, '.el-drawer', [
      'box-shadow: var(--fsus-shadow-panel, none);',
    ])
    expect(selectDropdownCss).toContain(
      '--el-select-dropdown-padding: 8px 0;',
    )
    expect(selectDropdownCss).toContain(
      '--el-select-dropdown-shadow: var(--fsus-shadow-panel, none);',
    )
    expectCssRule(selectDropdownCss, '.el-select-dropdown', [
      'box-shadow: var(--el-select-dropdown-shadow);',
    ])
    expect(drawerCss).not.toContain('box-shadow: var(--el-box-shadow-dark);')
    expect(selectDropdownCss).not.toContain('--el-select-dropdown-padding: 6px 0;')
    expect(selectDropdownCss).not.toContain(
      '--el-select-dropdown-shadow: var(--el-box-shadow-light);',
    )
  })

  test('keeps rate hover within the control motion budget', () => {
    const css = compileThemeFile('rate.scss')

    expectCssRule(css, '.el-rate:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
    ])
    expectCssRule(css, '.el-rate .el-rate__icon', [
      'transition: transform var(--fsus-motion-control-fast) var(--fsus-motion-standard), color var(--fsus-motion-control-fast) var(--fsus-motion-standard);',
    ])
    expectCssRule(css, '.el-rate .el-rate__icon.hover', [
      'transform: translateY(var(--fsus-rate-icon-hover-y, -1px));',
    ])
    expect(css).not.toContain('transition: var(--el-transition-duration);')
    expect(css).not.toContain('transform: scale(1.15);')
  })

  test('keeps backtop aligned with floating focus tokens', () => {
    const css = compileThemeFile('backtop.scss')

    expectCssRule(css, '.el-backtop', [
      'width: var(--fsus-floating-control-size, 40px);',
      'height: var(--fsus-floating-control-size, 40px);',
      'border-radius: var(--fsus-floating-control-radius, var(--fsus-radius-pill));',
      'box-shadow: var(--fsus-floating-control-shadow, var(--fsus-shadow-floating));',
      'z-index: var(--fsus-z-floating-control, 5);',
    ])
    expectCssRule(css, '.el-backtop:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
    ])
    expect(css).not.toContain('border-radius: 50%;')
    expect(css).not.toContain('box-shadow: var(--el-box-shadow-lighter);')
  })

  test('keeps collapse header focus and motion tokenized', () => {
    const css = compileThemeFile('collapse.scss')

    expectCssRule(css, '.el-collapse-item__header', [
      'transition: border-bottom-color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(css, '.el-collapse-item__arrow', [
      'transition: transform var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(css, '.el-collapse-item__header:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
    ])
    expect(css).not.toContain(
      '.el-collapse-item__header.focusing:focus:not(:hover) {\n  color:',
    )
    expect(css).not.toContain('var(--el-color-primary)')
  })

  test('keeps carousel motion focus and contrast tokenized', () => {
    const css = compileThemeFile('carousel.scss')

    expectCssRule(css, '.el-carousel.is-dragging .el-carousel__item', [
      'filter: var(--fsus-carousel-drag-filter, none);',
      'will-change: transform;',
    ])
    expectCssRule(css, '.el-carousel__arrow', [
      'color: var(--fsus-carousel-control-color, var(--fsus-color-surface-base));',
      'transition: background-color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), box-shadow var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(css, '.el-carousel__arrow:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
    ])
    expectCssRule(css, '.el-carousel__indicators--labels .el-carousel__button', [
      'color: var(--fsus-carousel-label-color, var(--fsus-ink));',
    ])
    expectCssRule(css, '.el-carousel__button', [
      'background-color: var(--fsus-carousel-indicator-bg, var(--fsus-color-surface-base));',
      'transition: background-color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), box-shadow var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), opacity var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(css, '.el-carousel__button:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
    ])
    expectCssRule(css, '.el-carousel__indicator.is-active button', [
      'opacity: var(--fsus-carousel-indicator-active-opacity, 1);',
      'background-color: var(--fsus-carousel-indicator-active-bg, var(--fsus-color-surface-base));',
      'box-shadow: inset 0 0 0 1px var(--fsus-carousel-indicator-active-border, var(--fsus-scholarly-blue));',
    ])
    expect(css).not.toContain('filter: blur(')
    expect(css).not.toContain('color: #fff;')
    expect(css).not.toContain('color: #000;')
    expect(css).not.toContain('background-color: #fff;')
  })

  test('keeps steps state and motion tokenized', () => {
    const css = compileThemeFile('step.scss')

    expectCssRule(css, '.el-step__head.is-finish', [
      'color: var(--fsus-step-finish-color, var(--fsus-scholarly-blue));',
      'border-color: var(--fsus-step-finish-color, var(--fsus-scholarly-blue));',
    ])
    expectCssRule(css, '.el-step__title.is-finish', [
      'color: var(--fsus-step-finish-color, var(--fsus-scholarly-blue));',
    ])
    expectCssRule(css, '.el-step__description.is-finish', [
      'color: var(--fsus-step-finish-color, var(--fsus-scholarly-blue));',
    ])
    expectCssRule(css, '.el-step__icon', [
      'transition: border-color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), background-color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(css, '.el-step__line-inner', [
      'transition: width var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), height var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), border-color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(css, '.el-step.is-simple .el-step__icon-inner.is-status', [
      'transform: translateY(1px);',
    ])
    expect(css).not.toContain('var(--el-color-primary)')
    expect(css).not.toContain('transition: 0.15s ease-out;')
    expect(css).not.toContain('scale(0.8)')
  })

  test('keeps progress radius motion and contrast tokenized', () => {
    const css = compileThemeFile('progress.scss')

    expectCssRule(css, '.el-progress-bar__outer', [
      'border-radius: var(--fsus-progress-radius, var(--fsus-radius-pill));',
    ])
    expectCssRule(css, '.el-progress-bar__inner', [
      'background-color: var(--fsus-progress-bar-color, var(--fsus-scholarly-blue));',
      'border-radius: var(--fsus-progress-radius, var(--fsus-radius-pill));',
      'transition: width var(--fsus-progress-width-motion, var(--fsus-motion-control, 260ms)) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(css, '.el-progress-bar__inner--indeterminate', [
      'animation: indeterminate var(--fsus-progress-animation-duration, 3s) var(--fsus-progress-animation-easing, linear) infinite;',
    ])
    expectCssRule(
      css,
      '.el-progress-bar__inner--striped.el-progress-bar__inner--striped-flow',
      [
        'animation: striped-flow var(--fsus-progress-animation-duration, 3s) var(--fsus-progress-animation-easing, linear) infinite;',
      ],
    )
    expectCssRule(css, '.el-progress-bar__innerText', [
      'color: var(--fsus-progress-inner-text-color, var(--fsus-color-surface-base));',
    ])
    expectCssRule(
      css,
      '.el-progress-bar__inner--indeterminate, .el-progress-bar__inner--striped-flow',
      [
        'animation-duration: 1ms !important;',
        'animation-iteration-count: 1 !important;',
      ],
    )
    expect(css).not.toContain('border-radius: 100px;')
    expect(css).not.toContain('transition: width 0.6s ease;')
    expect(css).not.toContain('animation: indeterminate 3s infinite;')
    expect(css).not.toContain('animation: striped-flow 3s linear infinite;')
    expect(css).not.toContain('var(--el-color-primary)')
    expect(css).not.toContain('color: #fff;')
  })

  test('keeps tree drag current and expand feedback tokenized', () => {
    const css = compileThemeFile('tree.scss')

    expectCssRule(css, '.el-tree__drop-indicator', [
      'background-color: var(--fsus-tree-drop-indicator-color, var(--fsus-state-focus-border));',
    ])
    expectCssRule(
      css,
      '.el-tree-node.is-drop-inner > .el-tree-node__content .el-tree-node__label',
      [
        'background-color: var(--fsus-tree-drop-inner-bg, var(--fsus-state-emphasis-bg));',
        'color: var(--fsus-tree-drop-inner-text, var(--fsus-ink));',
      ],
    )
    expectCssRule(css, '.el-tree-node__expand-icon', [
      'transition: transform var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(
      css,
      '.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content',
      [
        'background-color: var(--fsus-tree-current-bg, var(--fsus-state-selected-bg));',
      ],
    )
    expect(css).not.toContain('color: #fff;')
    expect(css).not.toContain('var(--el-color-primary)')
    expect(css).not.toContain('var(--el-color-primary-light-9)')
    expect(css).not.toContain(
      'transition: transform var(--el-transition-duration) var(--el-transition-function-ease-in-out-bezier);',
    )
  })

  test('keeps select v2 focus dropdown and selected states tokenized', () => {
    const selectCss = compileThemeFile('select-v2.scss')
    const dropdownCss = compileThemeFile('select-dropdown-v2.scss')
    const optionCss = compileThemeFile('option-item.scss')

    expectCssRule(selectCss, '.el-select-v2__wrapper', [
      'border-radius: var(--fsus-radius-control-small, var(--el-border-radius-small));',
      'transition: border-color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), box-shadow var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(selectCss, '.el-select-v2__wrapper.is-focused', [
      'border-color: var(--fsus-select-v2-focus-border, var(--fsus-state-focus-border));',
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
    ])
    expectCssRule(
      selectCss,
      '.el-select-v2 .el-select-v2__selection .el-tag .el-icon-close',
      [
        'background-color: var(--fsus-select-v2-tag-close-bg, var(--fsus-text-placeholder));',
        'color: var(--fsus-select-v2-tag-close-icon, var(--fsus-color-surface-base));',
      ],
    )
    expectCssRule(dropdownCss, '.el-select-dropdown', [
      '--el-select-dropdown-border-radius: var(--fsus-radius-popover, 10px);',
      '--el-select-dropdown-shadow: var(--fsus-shadow-panel, none);',
      'border-radius: var(--el-select-dropdown-border-radius);',
      'box-shadow: var(--el-select-dropdown-shadow);',
      'overflow: hidden;',
    ])
    expectCssRule(optionCss, '.el-select-dropdown__option-item.is-selected', [
      'background-color: var(--fsus-select-option-selected-bg, var(--fsus-state-selected-bg));',
      'font-weight: 500;',
    ])
    expectCssRule(
      optionCss,
      '.el-select-dropdown__option-item.is-selected:not(.is-multiple)',
      [
        'color: var(--fsus-select-option-selected-text, var(--fsus-scholarly-blue));',
      ],
    )
    expect(optionCss).not.toContain('font-weight: 700;')
    expect(selectCss).not.toContain('var(--el-color-primary)')
    expect(selectCss).not.toContain('var(--el-color-white)')
    expect(dropdownCss).not.toContain('border-radius: var(--el-border-radius-small);')
  })

  test('keeps autocomplete suggestion popper on the shared dropdown material', () => {
    const css = compileThemeFile('autocomplete.scss')

    expectCssRule(css, '.el-autocomplete__popper.el-popper', [
      'background: var(--fsus-autocomplete-popper-bg, var(--fsus-surface-overlay));',
      'border: 1px solid var(--fsus-autocomplete-popper-border, var(--fsus-border-lighter));',
      'box-shadow: var(--fsus-autocomplete-popper-shadow, var(--fsus-shadow-panel, none));',
    ])
    expectCssRule(css, '.el-autocomplete-suggestion', [
      'border-radius: var(--fsus-autocomplete-radius, var(--fsus-radius-popover, 10px));',
      'background: var(--fsus-autocomplete-popper-bg, var(--fsus-surface-overlay));',
      'overflow: hidden;',
    ])
    expectCssRule(css, '.el-autocomplete-suggestion__wrap', [
      'padding: 8px 0;',
    ])
    expectCssRule(css, '.el-autocomplete-suggestion li:hover', [
      'background-color: var(--fsus-autocomplete-option-hover-bg, var(--fsus-select-option-hover-bg, var(--fsus-state-hover-bg)));',
    ])
    expectCssRule(css, '.el-autocomplete-suggestion li.highlighted', [
      'background-color: var(--fsus-autocomplete-option-hover-bg, var(--fsus-select-option-hover-bg, var(--fsus-state-hover-bg)));',
    ])
    expectCssRule(css, '.el-autocomplete-suggestion li.divider', [
      'border-top: 1px solid var(--fsus-autocomplete-divider-border, var(--fsus-border-lighter));',
    ])
    expect(css).not.toContain('var(--el-box-shadow-light)')
    expect(css).not.toContain('var(--el-color-black)')
    expect(css).not.toContain('border-radius: var(--el-border-radius-base);')
  })

  test('keeps tooltip v2 radius and surfaces tokenized', () => {
    const css = compileThemeFile('tooltip-v2.scss')

    expectCssRule(css, '.el-tooltip-v2__content', [
      '--el-tooltip-v2-border-radius: var(--el-popover-border-radius);',
      '--fsus-tooltip-v2-arrow-bg: var(--fsus-tooltip-v2-light-bg, var(--fsus-color-surface-base));',
      '--fsus-tooltip-v2-arrow-border: var(--fsus-tooltip-v2-light-border, var(--fsus-border));',
      'border-radius: var(--el-tooltip-v2-border-radius);',
      'color: var(--fsus-tooltip-v2-light-text, var(--fsus-ink));',
      'background-color: var(--fsus-tooltip-v2-light-bg, var(--fsus-color-surface-base));',
      'border: 1px solid var(--fsus-tooltip-v2-light-border, var(--fsus-border));',
    ])
    expectCssRule(css, '.el-tooltip-v2__arrow', [
      'color: var(--fsus-tooltip-v2-arrow-bg);',
    ])
    expectCssRule(
      css,
      '.el-tooltip-v2__content[data-side^=top] .el-tooltip-v2__arrow::before',
      ['border-top-color: var(--fsus-tooltip-v2-arrow-bg);'],
    )
    expectCssRule(
      css,
      '.el-tooltip-v2__content[data-side^=top] .el-tooltip-v2__arrow::after',
      ['border-top-color: var(--fsus-tooltip-v2-arrow-border);'],
    )
    expectCssRule(css, '.el-tooltip-v2__content.is-dark', [
      '--fsus-tooltip-v2-arrow-bg: var(--fsus-tooltip-v2-dark-bg, var(--fsus-ink));',
      '--fsus-tooltip-v2-arrow-border: var(--fsus-tooltip-v2-dark-border, transparent);',
      'background-color: var(--fsus-tooltip-v2-dark-bg, var(--fsus-ink));',
      'color: var(--fsus-tooltip-v2-dark-text, var(--fsus-color-surface-base));',
      'border-color: var(--fsus-tooltip-v2-dark-border, transparent);',
    ])
    expect(css).not.toContain('var(--el-border-radius-base)')
    expect(css).not.toContain('var(--el-color-white)')
    expect(css).not.toContain('var(--el-color-black)')
  })

  test('keeps color picker interaction chrome tokenized while preserving color-space gradients', () => {
    const css = compileThemeFile('color-picker.scss')
    const docs = readFileSync(
      path.resolve(dirname, '../../../docs/components/color-picker.md'),
      'utf8',
    )

    expectCssRule(css, '.el-color-hue-slider__thumb', [
      'background: var(--fsus-color-picker-thumb-bg, var(--fsus-color-surface-base));',
      'border: 1px solid var(--fsus-color-picker-thumb-border, var(--fsus-border));',
      'box-shadow: var(--fsus-color-picker-thumb-shadow, var(--fsus-shadow-panel-lighter));',
      'will-change: left, top;',
    ])
    expectCssRule(css, '.el-color-svpanel__cursor > div', [
      'background-color: var(--fsus-color-picker-thumb-bg, var(--fsus-color-surface-base));',
      'border: 1px solid var(--fsus-color-picker-thumb-border, var(--fsus-border));',
      'box-shadow: var(--fsus-color-picker-thumb-shadow, var(--fsus-shadow-panel-lighter));',
    ])

    for (const selector of [
      '.el-color-hue-slider:active .el-color-hue-slider__thumb',
      '.el-color-alpha-slider:active .el-color-alpha-slider__thumb',
      '.el-color-svpanel:active .el-color-svpanel__cursor > div',
      '.el-color-svpanel.is-dragging .el-color-svpanel__cursor > div',
    ]) {
      expectCssRule(css, selector, [
        'box-shadow: 0 0 0 2px var(--fsus-color-picker-active-ring, var(--fsus-state-focus-border));',
        'filter: none;',
      ])
    }

    expectCssRule(css, '.el-color-predefine__color-selector.selected', [
      'box-shadow: inset 0 0 0 2px var(--fsus-color-picker-selected-ring, var(--fsus-state-focus-border));',
    ])
    expectCssRule(css, '.el-color-picker.is-focused .el-color-picker__trigger', [
      'border-color: var(--fsus-color-picker-focus-border, var(--fsus-state-focus-border));',
    ])
    expectCssRule(css, '.el-color-dropdown__value', [
      'color: var(--fsus-color-picker-value-text, var(--fsus-ink));',
    ])
    expectCssRule(css, '.el-color-picker__icon', [
      'color: var(--fsus-color-picker-icon-contrast, var(--fsus-color-surface-base));',
    ])
    expectCssRule(css, '.el-color-picker__mask', [
      'background-color: var(--fsus-color-picker-mask-bg, var(--fsus-overlay-color));',
    ])

    expect(css).toContain(
      'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
    )
    expect(css).not.toContain('filter: blur(')
    expect(css).not.toContain('--fsus-interactive-motion-glow')
    expect(css).not.toContain('--fsus-motion-slider-trail')
    expect(css).not.toMatch(
      /\.el-color-predefine__color-selector\.selected\s*\{[^}]*var\(--el-color-primary\)/s,
    )

    expect(docs).toContain('color-space gradients')
    expect(docs).toContain('ColorPicker chrome')
  })

  test('keeps slider handle focus and active motion tokenized', () => {
    const css = compileThemeFile('slider.scss')

    expectCssRule(css, '.el-slider__button-wrapper:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
      'border-radius: var(--fsus-radius-pill);',
    ])
    expectCssRule(css, '.el-slider__button', [
      'transition: transform var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), border-color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), box-shadow var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), background-color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(css, '.el-slider__button:hover', [
      'transform: translateY(var(--fsus-slider-handle-hover-y, -1px));',
    ])
    expectCssRule(css, '.el-slider__button.dragging', [
      'transform: translateY(var(--fsus-slider-handle-active-y, 1px)) scale(var(--fsus-slider-handle-active-scale, 1.04));',
    ])
    expect(css).not.toContain('transform: scale(1.2);')
    expect(css).not.toContain('transition: var(--el-transition-duration-fast);')
  })

  test('keeps image viewer overlay controls motion and focus tokenized', () => {
    const css = compileThemeFile('image-viewer.scss')

    expectCssRule(css, '.el-image-viewer__mask', [
      'opacity: 1;',
      'background: var(--fsus-image-viewer-overlay-bg, rgba(0, 0, 0, 0.72));',
    ])
    expectCssRule(css, '.el-image-viewer__btn', [
      'opacity: var(--fsus-image-viewer-control-opacity, 0.88);',
      'color: var(--fsus-image-viewer-control-fg, var(--fsus-color-surface-base));',
      'background-color: var(--fsus-image-viewer-control-bg, rgba(15, 15, 17, 0.72));',
      'border: 1px solid var(--fsus-image-viewer-control-border, rgba(255, 255, 255, 0.64));',
      'transition: opacity var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), background-color var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1)), box-shadow var(--fsus-motion-control-fast, 160ms) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(css, '.el-image-viewer__wrapper:hover .el-image-viewer__btn', [
      'opacity: var(--fsus-image-viewer-control-hover-opacity, 1);',
    ])

    for (const selector of [
      '.el-image-viewer__btn:focus-visible',
      '.el-image-viewer__action:focus-visible',
    ]) {
      expectCssRule(css, selector, [
        'outline: none !important;',
        'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
        'opacity: var(--fsus-image-viewer-control-hover-opacity, 1);',
      ])
    }

    expectCssRule(css, '.viewer-fade-enter-active', [
      'animation: viewer-fade-in var(--fsus-image-viewer-motion, var(--fsus-motion-overlay, 300ms)) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expectCssRule(css, '.viewer-fade-leave-active', [
      'animation: viewer-fade-out var(--fsus-image-viewer-motion, var(--fsus-motion-overlay, 300ms)) var(--fsus-motion-standard, cubic-bezier(0.2, 0.8, 0.2, 1));',
    ])
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expectCssRule(
      css,
      '.viewer-fade-enter-active, .viewer-fade-leave-active',
      [
        'animation-duration: 1ms !important;',
        'animation-iteration-count: 1 !important;',
      ],
    )
    expect(css).not.toContain('color: #fff;')
    expect(css).not.toContain('border-color: #fff;')
    expect(css).not.toContain('background: #000;')
    expect(css).not.toContain('var(--el-transition-duration)')
  })

  test('keeps tag typography overrides opt-in for mixed-language labels', () => {
    const css = compileThemeFile('tag.scss')
    const docs = readFileSync(
      path.resolve(dirname, '../../../docs/components/tag.md'),
      'utf8',
    )

    expectCssRule(css, '.el-tag', [
      'font-size: var(--fsus-tag-font-size, var(--el-font-size-extra-small));',
      'letter-spacing: var(--fsus-tag-letter-spacing, 0);',
      'text-transform: var(--fsus-tag-text-transform, none);',
    ])
    for (const selector of [
      '.el-tag.is-uppercase',
      '.el-tag[data-fsus-tag-uppercase=true]',
    ]) {
      expectCssRule(css, selector, [
        'letter-spacing: var(--fsus-tag-uppercase-letter-spacing, 0.05em);',
        'text-transform: uppercase;',
      ])
    }
    expect(css).not.toMatch(/\.el-tag\s*\{[^}]*text-transform:\s*uppercase;/s)
    expect(css).not.toMatch(/\.el-tag\s*\{[^}]*letter-spacing:\s*0\.05em;/s)
    expect(docs).toContain('混合语言')
    expect(docs).toContain('code-like')
    expect(docs).toContain('状态 APIv2')
    expect(docs).toContain('sha-1:AbC123')
  })

  test('keeps calendar header controls border-first', () => {
    const css = compileThemeFile('calendar.scss')

    expectCssRule(css, '.el-calendar__button-group .el-button-group', [
      'border: 1px solid var(--el-border-color-lighter);',
      'background: transparent;',
    ])
    expect(css).not.toContain('linear-gradient')
    expect(css).not.toContain('inset 0 1px 0')
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

  test('separates public shell mobile primary actions from the mobile nav row', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    for (const css of [publicShellCss, criticalCss]) {
      expectCssRule(css, '.el-public-shell__primary-row', [
        'display: grid;',
        'grid-template-columns: minmax(0, 1fr) auto;',
        'align-items: center;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-primary-actions', [
        'display: none;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-toolbar', [
        'display: none;',
        'margin-top: 18px;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-actions', [
        'display: flex;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-nav-scrollbar', [
        'width: 100%;',
      ])
      expectCssRule(
        css,
        '.el-public-shell__mobile-nav-scrollbar .el-public-shell__mobile-nav-wrap',
        [
          'overflow-y: hidden;',
          'touch-action: pan-x pan-y;',
          'overscroll-behavior-x: contain;',
          'overscroll-behavior-y: auto;',
        ],
      )
      expectCssRule(css, '.el-public-shell__desktop-nav', ['display: none;'])
      expectCssRule(css, '.el-public-shell__actions', ['display: none;'])
      expect(css).toContain('.el-public-shell__mobile-primary-actions')
      expect(css).toContain('display: inline-flex;')
      expect(css).toContain('.el-public-shell__mobile-toolbar')
      expect(css).toContain('display: block;')
    }
  })

  test('supports public shell trigger-based mobile search motion', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    for (const css of [publicShellCss, criticalCss]) {
      expectCssRule(css, '.el-public-shell__mobile-search-trigger', [
        'min-height: 40px;',
        'border: 1px solid var(--el-border-color-lighter);',
      ])
      expectCssRule(css, '.el-public-shell__mobile-search-row', [
        'display: none;',
        'margin-top: 12px;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-search-row.is-expanded', [
        'display: block;',
      ])
      expectCssRule(
        css,
        '.el-public-shell-mobile-search-enter-active, .el-public-shell-mobile-search-leave-active',
        [
          'transition: opacity var(--el-transition-duration-fast), transform var(--el-transition-duration-fast);',
        ],
      )
      expectCssRule(
        css,
        '.el-public-shell-mobile-search-enter-from, .el-public-shell-mobile-search-leave-to',
        [
          'opacity: 0;',
          'transform: translateY(-4px);',
        ],
      )
      expect(css).toContain('@media (prefers-reduced-motion: reduce)')
      expectCssRule(
        css,
        '.el-public-shell-mobile-search-enter-active, .el-public-shell-mobile-search-leave-active',
        ['transition: none;'],
      )
    }
  })

  test('keeps public shell desktop utilities compact while giving search room', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    for (const css of [publicShellCss, criticalCss]) {
      expectCssRule(css, '.el-public-shell__search--desktop', [
        'width: 11rem;',
      ])
      expectCssRule(css, '.el-public-shell__actions', [
        'gap: 12px;',
        'min-width: max-content;',
      ])
    }

    expectCssRule(publicShellCss, '.el-public-shell__action-link', [
      'white-space: nowrap;',
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
    expectCssRule(
      tableCss,
      '.el-table__header-wrapper tr td.el-table__fixed-right-patch',
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
    expectCssRule(css, '.el-section-nav__link:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
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
    expect(css).not.toMatch(
      /\.el-section-nav__link:hover,\s*\.el-section-nav__link:focus-visible\s*\{[^}]*outline: none;/s,
    )
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
    expectCssRule(css, '.el-distribution-bar-row__bar-fill', [
      'background: var(--fsus-metric-accent, var(--fsus-scholarly-blue));',
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
    expect(css).not.toMatch(
      /\.el-distribution-bar-row__bar-fill\s*\{[^}]*var\(--el-color-primary\)/s,
    )
    expect(css).not.toMatch(/gradient|backdrop-filter|blur\(/)
  })

  test('keeps card surfaces flat by default', () => {
    const css = compileThemeFile('card.scss')

    expectCssRule(css, '.el-card', ['box-shadow: none;'])
    expectCssRule(css, '.el-card:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, #2a599c) !important;',
    ])
    expectCssRule(css, '.el-card.is-always-shadow', [
      'box-shadow: var(--fsus-card-elevated-shadow, var(--fsus-shadow-panel-lighter));',
    ])
    expectCssRule(css, '.el-card.is-hover-shadow:hover', [
      'box-shadow: var(--fsus-card-elevated-shadow, var(--fsus-shadow-panel-lighter));',
      'transform: translateY(-1px);',
    ])
    expect(css).not.toContain('.el-card__header::before')
    expect(css).not.toMatch(
      /\.el-card\.is-hover-shadow:hover,\s*\.el-card\.is-hover-shadow:focus\s*\{/s,
    )
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
    expectCssRule(css, '.el-conversation-list-item__unread', [
      'background: var(--fsus-badge-emphasis-bg, var(--fsus-scholarly-blue));',
      'color: var(--fsus-badge-emphasis-text, var(--fsus-color-surface-base));',
    ])
    expect(css).toContain(
      '.el-inbox-layout.el-inbox-layout--mobile-list .el-inbox-layout__detail',
    )
    expect(css).not.toMatch(
      /\.el-conversation-list-item__unread\s*\{[^}]*color: #fff;/s,
    )
    expect(css).not.toMatch(
      /\.el-(?:inbox-layout|split-pane|message-bubble)[^{]*\{[^}]*(?:linear-gradient|backdrop-filter|filter:\s*blur)/s,
    )
  })
})
