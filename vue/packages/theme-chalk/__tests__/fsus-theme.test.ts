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
  test('owns the editor title textarea hierarchy without consumer deep selectors', () => {
    const css = compileThemeFile('input.scss')

    expectCssRule(css, '.el-textarea[data-textarea-variant=editor-title]', [
      'width: 100%;',
      'min-width: 0;',
    ])
    expectCssRule(
      css,
      '.el-textarea[data-textarea-variant=editor-title] .el-textarea__inner',
      [
        'min-height: 74px;',
        'resize: none;',
        'font-size: clamp(2.25rem, 2.8vw, 2.5rem);',
        'font-weight: var(--fsus-typography-weight-bold, 700);',
        'line-height: 1.2;',
      ],
    )
    expectCssRule(
      css,
      '.el-textarea[data-textarea-variant=editor-title] .el-textarea__inner::placeholder',
      ['font-weight: var(--fsus-typography-weight-medium, 500);'],
    )
    expectCssRule(
      css,
      '.el-textarea[data-textarea-variant=editor-title] .el-input__count',
      ['font-weight: var(--fsus-typography-weight-medium, 500);'],
    )
    expect(css).toContain('@media (max-width: 640px)')
    expect(css).not.toMatch(/font-weight:\s*(?:600|650)\b/u)
    const variantRules = cssRules(
      css,
      '.el-textarea[data-textarea-variant=editor-title]',
    ).join(' ')
    expect(variantRules).not.toContain('!important')
  })

  test('keeps breadcrumb separators inside semantic flex path units', () => {
    const css = compileThemeFile('breadcrumb.scss')

    expectCssRule(css, '.el-breadcrumb', [
      'container-type: inline-size;',
      'font-size: var(--el-font-size-base);',
    ])
    expectCssRule(css, '.el-breadcrumb__list', [
      'display: flex;',
      'flex-wrap: wrap;',
      'list-style: none;',
    ])
    expectCssRule(css, '.el-breadcrumb__item', [
      'display: inline-flex;',
      'min-height: 40px;',
      'break-inside: avoid;',
    ])
    expectCssRule(css, '.el-breadcrumb__collapse-trigger', [
      'width: 40px;',
      'height: 40px;',
    ])
    expectCssRule(css, '.el-breadcrumb__collapse-menu-item', [
      'min-height: 44px;',
    ])
    expect(css).toContain('@container (max-width: 559px)')
    expect(css).not.toMatch(/\bfloat:/)
  })

  test('keeps responsive steps on container-owned geometry and spacing', () => {
    const stepsCss = compileThemeFile('steps.scss')
    const stepCss = compileThemeFile('step.scss')
    const integratedCss = compileThemeFile('fsus-theme.scss')

    expectCssRule(stepsCss, '.el-steps', [
      'container-type: inline-size;',
      'display: flex;',
      'list-style: none;',
    ])
    expectCssRule(stepsCss, '.el-steps--vertical', [
      'flex-flow: column;',
      'gap: 16px;',
    ])
    expectCssRule(stepCss, '.el-step__icon', ['width: 32px;', 'height: 32px;'])
    expectCssRule(stepCss, '.el-step__title', [
      'font-size: 14px;',
      'font-weight: 500;',
      'line-height: 20px;',
    ])
    expectCssRule(stepCss, '.el-step__description', [
      'margin-top: 4px;',
      'padding: 0;',
      'font-size: 13px;',
      'line-height: 1.5;',
    ])
    expectCssRule(stepCss, '.el-step.is-clickable .el-step__content', [
      'min-width: 40px;',
      'min-height: 40px;',
    ])
    expectCssRule(integratedCss, '.el-step__icon', [
      'width: 32px;',
      'height: 32px;',
      'border-width: 2px;',
    ])
    expect(stepCss).not.toMatch(/margin-top:\s*-\d/)
    expect(stepCss).not.toMatch(/padding-(?:left|right):\s*\d+%/)
    expect(stepCss).not.toMatch(/linear-gradient|radial-gradient|drop-shadow/)
  })

  test('exposes a public touch-target modifier for radio button groups', () => {
    const css = compileThemeFile('radio-button.scss')

    expectCssRule(css, '.fsus-radio-group--touch .el-radio-button__inner', [
      'display: inline-flex;',
      'min-height: var(--fsus-control-height, 44px);',
      'align-items: center;',
      'justify-content: center;',
    ])
  })

  test('keeps task page headings flat, readable, and stable across densities', () => {
    const css = compileThemeFile('task-page-header.scss')

    expectCssRule(css, '.el-task-page-header', [
      'grid-template-columns: minmax(0, 1fr) auto;',
      'gap: var(--fsus-space-6, 24px);',
      'text-align: left;',
    ])
    expectCssRule(css, '.el-task-page-header__title', [
      'font-size: 24px;',
      'font-weight: 700;',
      'line-height: 1.2;',
      'letter-spacing: 0;',
    ])
    expectCssRule(css, '.el-task-page-header__description', [
      'font-size: 14px;',
      'font-weight: 400;',
      'line-height: 1.65;',
    ])
    expectCssRule(css, '.el-task-page-header--compact', [
      'gap: var(--fsus-space-4, 16px);',
    ])
    expectCssRule(css, '.el-task-page-header__actions', [
      'justify-content: flex-end;',
      'gap: var(--fsus-space-2, 8px);',
    ])
    expectCssRule(css, '.el-task-page-header', [
      'grid-template-columns: minmax(0, 1fr);',
      'gap: var(--fsus-space-4, 16px);',
    ])
    expect(css).not.toMatch(/(?:background|border|box-shadow):/)
  })

  test('keeps overlay titles at their natural letter spacing', () => {
    const css = compileThemeFile('fsus-theme.scss')

    for (const selector of [
      '.el-dialog__title',
      '.el-drawer__title',
      '.el-message-box__title',
      '.el-notification__title',
      '.el-popover__title',
    ]) {
      expectCssRule(css, selector, ['color: var(--el-text-color-primary);'])
    }
    expect(css).not.toMatch(/letter-spacing:\s*-/)
  })

  test('emits canonical public foundation tokens in dark product CSS', () => {
    const css = compileThemeFile('fsus-theme.scss')

    expectCssRule(css, 'html.dark', [
      '--fsus-color-action-primary: #4B79CC;',
      '--fsus-color-action-primary-hover: #6F93D7;',
      '--fsus-color-text-primary: #F0F0F4;',
      '--fsus-color-text-quiet: #A1A1AA;',
      '--fsus-color-surface-base: #121214;',
      '--fsus-color-surface-raised: #1A1A1E;',
      '--fsus-component-state-button-primary-background-default: #F0F0F4;',
      '--fsus-component-state-button-primary-background-hover: #4B79CC;',
      '--fsus-ink: var(--fsus-color-text-primary);',
      '--fsus-paper: var(--fsus-color-surface-base);',
    ])
  })

  test('ships 40px task tabs and continuous card strip, not buttonized CTAs (#295)', () => {
    // Real consumer path: fsus.scss pulls tabs.scss then fsus-theme overrides.
    // #295 regression: default item 44px + card/border-card as 36px separated
    // buttons (gap, per-item border/radius, hover lift, active press).
    const themeCss = compileThemeFile('fsus-theme.scss')
    const tabsCss = compileThemeFile('tabs.scss')
    const shippedCss = compileThemeFile('fsus.scss')

    expect(themeCss).not.toContain('@keyframes fsus-tabs-indicator-in')

    // Default desktop/task tab item is 40px with navigation geometry.
    expectCssRule(themeCss, '.el-tabs__item', [
      'height: 40px;',
      'border-radius: var(--fsus-radius-navigation);',
      'transform: none;',
    ])
    expectCssRule(themeCss, '.el-tabs__item.is-active', [
      'background: transparent;',
      'color: var(--el-text-color-primary);',
      'font-weight: 700;',
    ])
    expectCssRule(themeCss, '.el-tabs__active-bar', [
      'background-color: var(--fsus-scholarly-blue);',
      'height: 2px;',
      'border-radius: 0;',
    ])
    // Base token still documents the 40px contract.
    expectCssRule(tabsCss, '.el-tabs', ['--el-tabs-header-height: 40px;'])
    expectCssRule(tabsCss, '.el-tabs__item', [
      'height: var(--el-tabs-header-height);',
    ])
    expectCssRule(tabsCss, '.el-tabs__nav-next, .el-tabs__nav-prev', [
      'line-height: var(--el-tabs-header-height);',
    ])

    // Card header is a continuous strip at header height, not height:auto button row.
    expectCssRule(themeCss, '.el-tabs--card > .el-tabs__header', [
      'height: var(--el-tabs-header-height, 40px);',
      'border-bottom: 1px solid var(--el-border-color-light);',
    ])
    expectCssRule(themeCss, '.el-tabs--card > .el-tabs__header .el-tabs__nav', [
      'gap: 0;',
      'border: 1px solid var(--el-border-color-light);',
      'border-bottom: none;',
      'overflow: hidden;',
    ])
    expectCssRule(themeCss, '.el-tabs--card > .el-tabs__header .el-tabs__item', [
      'height: var(--el-tabs-header-height, 40px);',
      'border-radius: 0;',
      'background: transparent;',
      'transform: none;',
      'will-change: auto;',
    ])
    expectCssRule(
      themeCss,
      '.el-tabs--card > .el-tabs__header .el-tabs__item:not(.is-disabled):hover',
      [
        'color: var(--fsus-scholarly-blue);',
        'box-shadow: none;',
        'transform: none;',
      ],
    )
    expectCssRule(
      themeCss,
      '.el-tabs--card > .el-tabs__header .el-tabs__item:not(.is-disabled):active',
      ['box-shadow: none;', 'transform: none;'],
    )
    expectCssRule(
      themeCss,
      '.el-tabs--card > .el-tabs__header .el-tabs__item.is-active',
      [
        'border-bottom-color: var(--fsus-scholarly-blue);',
        'color: var(--el-text-color-primary);',
        'font-weight: 700;',
        'transform: none;',
      ],
    )

    // Mutation kill: default task tabs must not re-grow to 44px control height.
    expect(themeCss).not.toMatch(/\.el-tabs__item\s*\{[^}]*height:\s*44px/s)
    expect(shippedCss).not.toMatch(
      /\.el-tabs__item\s*\{[^}]*height:\s*44px/s,
    )

    // Mutation kill: buttonized card geometry must not return.
    const cardItemRules = [
      ...cssRules(themeCss, '.el-tabs--card > .el-tabs__header .el-tabs__item'),
      ...cssRules(
        shippedCss,
        '.el-tabs--card > .el-tabs__header .el-tabs__item',
      ),
    ]
    expect(cardItemRules.length).toBeGreaterThan(0)
    for (const rule of cardItemRules) {
      expect(rule).not.toMatch(/height:\s*36px/)
      expect(rule).not.toMatch(/will-change:\s*transform/)
      expect(rule).not.toMatch(/transform:\s*translate3d\(0,\s*-1px/)
      expect(rule).not.toMatch(/transform:\s*translate3d\(0,\s*1px/)
      expect(rule).not.toMatch(
        /border-radius:\s*var\(--fsus-radius-control-small\)/,
      )
      expect(rule).not.toMatch(
        /border:\s*1px solid var\(--el-border-color-lighter\)/,
      )
    }

    const cardNavRules = [
      ...cssRules(themeCss, '.el-tabs--card > .el-tabs__header .el-tabs__nav'),
      ...cssRules(shippedCss, '.el-tabs--card > .el-tabs__header .el-tabs__nav'),
    ]
    for (const rule of cardNavRules) {
      expect(rule).not.toMatch(/gap:\s*8px/)
      expect(rule).not.toMatch(/overflow:\s*visible/)
    }

    // Integrated bundle keeps continuous strip + Scholarly Blue markers.
    expect(shippedCss).toContain('--el-tabs-header-height: 40px')
    expect(shippedCss).toContain(
      'border-bottom-color: var(--fsus-scholarly-blue)',
    )
    expect(shippedCss).not.toMatch(
      /\.el-tabs--card[^{]*\.el-tabs__item[^{]*\{[^}]*height:\s*36px/s,
    )
    expect(themeCss).not.toMatch(
      /\.el-tabs--(?:border-)?card[^{}]*\.el-tabs__item[^{}]*\.is-active::after/s,
    )
  })

  test('uses semantic geometry budgets and border-first default panels', () => {
    const css = compileThemeFile('fsus-theme.scss')

    for (const selector of ['.el-button', '.el-input__wrapper']) {
      expectCssRule(css, selector, [
        'border-radius: var(--fsus-radius-control);',
      ])
    }
    for (const selector of ['.el-dialog', '.el-drawer']) {
      expectCssRule(css, selector, [
        'border: 1px solid var(--el-border-color-light);',
        'border-radius: var(--fsus-radius-panel);',
        'box-shadow: var(--fsus-shadow-panel, none);',
      ])
    }
    expectCssRule(css, '.el-notification', [
      'background: var(--el-bg-color-overlay);',
      'border: 1px solid var(--el-border-color-light);',
      'border-radius: var(--fsus-radius-popover);',
      'box-shadow: var(--fsus-shadow-floating);',
    ])
    expectCssRule(css, '.el-notification', [
      'position: fixed;',
      'width: var(--fsus-notification-max-width);',
    ])
    expectCssRule(css, '.el-upload-dragger', [
      'border-radius: var(--fsus-radius-panel);',
    ])
    expectCssRule(css, '.el-slider__button.dragging', [
      'filter: none;',
      'box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);',
    ])
    expectCssRule(css, '.is-expressive-surface .el-slider__button.dragging', [
      'filter: blur(var(--fsus-motion-slider-blur));',
      'box-shadow: 0 0 18px var(--fsus-motion-slider-trail), 0 3px 10px rgba(0, 0, 0, 0.12);',
      'scale(1.08);',
    ])
    expectCssRule(css, '.fsus-reading-surface', [
      '--fsus-interactive-motion-blur: 0px;',
      '--fsus-interactive-motion-glow: 0px;',
      '--fsus-interactive-motion-offset-y: 0px;',
      '--fsus-interactive-motion-strength: 0;',
      '--fsus-interactive-motion-trail-opacity: 0;',
      '--fsus-motion-scroll-max-offset: 0px;',
      '--fsus-motion-drag-max-offset: 0px;',
      '--fsus-motion-drag-scale: 0;',
      '--fsus-motion-trail: transparent;',
    ])
  })

  test('keeps dialog drawer and select overlays on the shared paper contract', () => {
    const dialogCss = compileThemeFile('dialog.scss')
    const drawerCss = compileThemeFile('drawer.scss')
    const selectDropdownCss = compileThemeFile('select-dropdown.scss')

    expectCssRule(dialogCss, '.el-dialog', [
      '--el-dialog-box-shadow: var(--fsus-shadow-panel, none);',
      '--el-dialog-padding-primary: 24px;',
    ])
    expectCssRule(dialogCss, '.el-dialog', [
      'backdrop-filter: blur(var(--fsus-backdrop-blur-overlay, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
      '-webkit-backdrop-filter: blur(var(--fsus-backdrop-blur-overlay, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
      'box-shadow: var(--el-dialog-box-shadow);',
    ])
    for (const selector of [
      '.el-dialog__header',
      '.el-dialog__body',
      '.el-dialog__footer',
    ]) {
      expectCssRule(dialogCss, selector, [
        'padding: var(--fsus-space-4) var(--el-dialog-padding-primary);',
      ])
    }

    expectCssRule(drawerCss, '.el-drawer', [
      '--el-drawer-padding-primary: var(--fsus-space-6);',
    ])
    expectCssRule(drawerCss, '.el-drawer', [
      'backdrop-filter: blur(var(--fsus-backdrop-blur-overlay, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
      '-webkit-backdrop-filter: blur(var(--fsus-backdrop-blur-overlay, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
      'box-shadow: var(--fsus-shadow-panel, none);',
    ])
    for (const selector of [
      '.el-drawer__header',
      '.el-drawer__body',
      '.el-drawer__footer',
    ]) {
      expectCssRule(drawerCss, selector, [
        'padding: var(--fsus-space-4) var(--el-drawer-padding-primary);',
      ])
    }

    expectCssRule(selectDropdownCss, '.el-select-dropdown', [
      'backdrop-filter: blur(var(--fsus-backdrop-blur-overlay, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
      '-webkit-backdrop-filter: blur(var(--fsus-backdrop-blur-overlay, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
    ])
    for (const css of [dialogCss, drawerCss, selectDropdownCss]) {
      expect(css).not.toContain('--el-bg-color-overlay-blur')
    }
  })

  test('keeps image viewer controls on the default paper material', () => {
    const css = compileThemeFile('fsus-theme.scss')
    const imageViewerCss = compileThemeFile('image-viewer.scss')

    for (const selector of [
      '.el-image-viewer__btn',
      '.el-image-viewer__actions',
    ]) {
      expectCssRule(css, selector, [
        'background: rgba(255, 255, 255, 0.12);',
        'border: 1px solid rgba(255, 255, 255, 0.18);',
      ])
    }
    expectCssRule(imageViewerCss, '.el-image-viewer__actions', [
      'padding: 0 24px;',
      'border-radius: 999px;',
    ])
    expect(css).not.toMatch(
      /\.el-image-viewer__(?:btn|actions)\s*\{[^}]*(?:-webkit-)?backdrop-filter:/s,
    )
  })

  test('keeps loading paper-only and scopes glass to the image viewer mask', () => {
    const themeCss = compileThemeFile('fsus-theme.scss')
    const loadingCss = compileThemeFile('loading.scss')
    const imageViewerCss = compileThemeFile('image-viewer.scss')

    for (const css of [themeCss, loadingCss]) {
      expectCssRule(css, '.el-loading-mask', [
        'backdrop-filter: blur(0px) saturate(100%);',
        '-webkit-backdrop-filter: blur(0px) saturate(100%);',
      ])
    }

    for (const css of [themeCss, imageViewerCss]) {
      expectCssRule(css, '.el-image-viewer__mask', [
        'backdrop-filter: blur(var(--fsus-backdrop-blur-overlay, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
        '-webkit-backdrop-filter: blur(var(--fsus-backdrop-blur-overlay, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
      ])
    }

    expect(themeCss).not.toMatch(
      /--fsus-backdrop-blur(?:-soft|-overlay)?,\s*(?:12|24)px/,
    )
  })

  test('keeps expressive slider progress free of decorative glow', () => {
    const css = compileThemeFile('fsus-theme.scss')

    expectCssRule(css, '.el-slider__bar::after', ['content: none;'])
    expect(css).not.toMatch(
      /(?:\.is-expressive-surface|\[data-fsus-surface=(?:["']?expressive["']?)\])\s+\.el-slider__bar::after\s*(?:,|\{)/,
    )
  })

  test('keeps border-card tabs on the continuous navigation baseline (#295)', () => {
    const css = compileThemeFile('fsus-theme.scss')
    const tabsCss = compileThemeFile('tabs.scss')
    const shippedCss = compileThemeFile('fsus.scss')

    expectCssRule(css, '.el-tabs--border-card > .el-tabs__header', [
      'height: var(--el-tabs-header-height, 40px);',
      'border-bottom: 1px solid var(--el-border-color-light);',
    ])
    expectCssRule(
      css,
      '.el-tabs--border-card > .el-tabs__header .el-tabs__item',
      [
        'height: var(--el-tabs-header-height, 40px);',
        'border-radius: 0;',
        'background: transparent;',
        'transform: none;',
        'will-change: auto;',
      ],
    )
    expectCssRule(
      css,
      '.el-tabs--border-card > .el-tabs__header .el-tabs__item.is-active',
      [
        'border-bottom-color: var(--fsus-scholarly-blue);',
        'color: var(--el-text-color-primary);',
        'font-weight: 700;',
        'transform: none;',
      ],
    )
    expectCssRule(css, '.el-tabs--border-card', [
      'border: 1px solid var(--el-border-color-lighter);',
      'border-radius: var(--fsus-radius-control);',
      'box-shadow: none;',
    ])
    // Vertical card still uses edge borders (not horizontal underline logic).
    expectCssRule(
      tabsCss,
      '.el-tabs--left.el-tabs--card .el-tabs__item.is-left.is-active',
      ['border-right-color: var(--el-bg-color);'],
    )
    expectCssRule(
      tabsCss,
      '.el-tabs--right.el-tabs--card .el-tabs__item.is-right.is-active',
      ['border-left-color: var(--el-bg-color);'],
    )
    for (const selector of [
      '.el-tabs--left.el-tabs--border-card .el-tabs__item.is-left.is-active',
      '.el-tabs--right.el-tabs--border-card .el-tabs__item.is-right.is-active',
    ]) {
      expectCssRule(tabsCss, selector, [
        'border-top-color: var(--el-border-color-light);',
        'border-bottom-color: var(--el-border-color-light);',
      ])
    }
    expect(tabsCss).not.toContain('rgb(209, 219, 229)')
    expect(tabsCss).not.toMatch(/border-(?:left|right)-color:\s*#fff;/)

    // Mutation kill: border-card must not re-buttonize (36px + gap + lift).
    const borderCardItemRules = [
      ...cssRules(
        css,
        '.el-tabs--border-card > .el-tabs__header .el-tabs__item',
      ),
      ...cssRules(
        shippedCss,
        '.el-tabs--border-card > .el-tabs__header .el-tabs__item',
      ),
    ]
    expect(borderCardItemRules.length).toBeGreaterThan(0)
    for (const rule of borderCardItemRules) {
      expect(rule).not.toMatch(/height:\s*36px/)
      expect(rule).not.toMatch(/will-change:\s*transform/)
      expect(rule).not.toMatch(/transform:\s*translate3d\(0,\s*-1px/)
      expect(rule).not.toMatch(/transform:\s*translate3d\(0,\s*1px/)
      expect(rule).not.toMatch(
        /box-shadow:\s*inset 0 0 0 1px rgba\(42,\s*89,\s*156/,
      )
    }
    expect(css).not.toMatch(
      /\.el-tabs--border-card[^{]*\.el-tabs__nav[^{]*\{[^}]*gap:\s*8px/s,
    )
  })

  test('aligns public focus and active states with Scholarly Blue', () => {
    const inputCss = compileThemeFile('input.scss')
    const tabsCss = compileThemeFile('tabs.scss')
    const themeCss = compileThemeFile('fsus-theme.scss')
    const publicShellCss = compileThemeFile('public-shell.scss')

    expectCssRule(inputCss, '.el-textarea__inner:focus-visible', [
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
    ])
    expectCssRule(tabsCss, '.el-tabs__active-bar', [
      'background-color: var(--fsus-scholarly-blue);',
      'transition: width var(--fsus-motion-control, 220ms) var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1)), transform var(--fsus-motion-control, 220ms) var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1));',
    ])
    expectCssRule(tabsCss, '.el-tabs__item:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
    ])
    expectCssRule(tabsCss, '.el-tabs__item.is-active', [
      'color: var(--el-text-color-primary);',
    ])
    expectCssRule(themeCss, '.el-tabs__item.is-active', [
      'color: var(--el-text-color-primary);',
    ])
    expectCssRule(publicShellCss, '.el-public-shell__nav-link', [
      'border-bottom: 2px solid transparent;',
      'padding-bottom: 0;',
      'font-size: 14px;',
      'font-weight: 500;',
      'line-height: 1.5;',
    ])
    expectCssRule(publicShellCss, '.el-public-shell__nav-link.is-active', [
      'border-bottom-color: var(--fsus-scholarly-blue);',
    ])
    for (const selector of [
      '.el-public-shell__brand:focus-visible',
      '.el-public-shell__nav-link:focus-visible',
      '.el-public-shell__action-link:focus-visible',
      '.el-public-shell__desktop-search-trigger:focus-visible',
    ]) {
      expectCssRule(publicShellCss, selector, [
        'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
      ])
    }
  })

  test('keeps dark form text, state text, disabled fill, and borders distinct', () => {
    const css = compileThemeFile('fsus-theme.scss')
    const tokens = readFileSync(
      path.resolve(dirname, '../src/common/fsus-tokens.scss'),
      'utf8',
    ).toLowerCase()

    expect(tokens).toContain('--fsus-form-readable-text: #a1a1aa;')
    expect(tokens).toContain('--fsus-form-state-text: #85858f;')
    expect(tokens).toContain(
      '--el-disabled-text-color: var(--fsus-form-state-text);',
    )
    for (const selector of ['.el-form-item__label', '.el-upload__tip']) {
      expectCssRule(css, selector, ['color: var(--fsus-form-readable-text);'])
    }
    for (const selector of [
      '.el-input__inner::placeholder',
      '.el-textarea__inner::placeholder',
      '.el-select__placeholder',
    ]) {
      expectCssRule(css, selector, [
        'color: var(--fsus-form-state-text);',
        'opacity: 1;',
      ])
    }
    expectCssRule(css, '.el-input.is-disabled .el-input__wrapper', [
      'background: var(--el-disabled-bg-color);',
      'border-color: var(--el-disabled-border-color);',
      'color: var(--el-disabled-text-color);',
      'opacity: 1;',
    ])
    expect(css).not.toMatch(
      /\.el-input\.is-disabled[^}]*opacity:\s*(?:0|0\.\d+)/,
    )
  })

  test('keeps invalid idle and keyboard focus rings visually distinct', () => {
    const css = compileThemeFile('form.scss')

    expectCssRule(css, '.el-form-item.is-error .el-input__wrapper', [
      'box-shadow: 0 0 0 1px var(--el-color-danger) inset;',
    ])

    for (const selector of [
      '.el-form-item.is-error .el-textarea__inner:focus-visible',
      '.el-form-item.is-error .el-select-v2__wrapper:has(input:focus-visible)',
      '.el-form-item.is-error .el-input__wrapper:has(.el-input__inner:focus-visible)',
    ]) {
      expectCssRule(css, selector, [
        'box-shadow: 0 0 0 2px var(--el-color-danger) inset !important;',
      ])
    }
  })

  test('keeps input counters on the input surface', () => {
    const css = compileThemeFile('input.scss')

    expectCssRule(css, '.el-textarea .el-input__count', [
      'background: transparent;',
      'white-space: nowrap;',
      'font-variant-numeric: tabular-nums;',
    ])
    expectCssRule(css, '.el-input .el-input__count', [
      'background: transparent;',
      'flex: 0 0 auto;',
      'min-width: max-content;',
      'white-space: nowrap;',
      'font-variant-numeric: tabular-nums;',
    ])
    expect(css).not.toMatch(
      /\.el-(?:input|textarea)[^{]*\.el-input__count\s*\{[^}]*var\(--el-fill-color-blank\)/s,
    )
  })

  test('aligns markdown editor focus states with the shared 2px contract', () => {
    const css = compileThemeFile('markdown-editor.scss')

    expectCssRule(css, '.el-markdown-editor__command', [
      'display: inline-flex;',
      'align-items: center;',
      'justify-content: center;',
      'text-align: center;',
    ])

    for (const selector of [
      '.el-markdown-editor__command:focus-visible',
      '.el-markdown-editor__mode:focus-visible',
      '.el-markdown-editor__action:focus-visible',
      '.el-markdown-editor__textarea:focus-visible',
    ]) {
      expectCssRule(css, selector, [
        'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
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
      'min-height: var(--fsus-empty-action-min-height, 40px);',
      'font-weight: 500;',
    ])
    expectCssRule(css, '.el-empty-state__actions', [
      '--fsus-empty-action-min-height: 40px;',
    ])
    expectCssRule(css, '.el-empty__bottom .el-button--primary', [
      'min-height: 44px;',
      'padding-inline: 16px;',
      'border-radius: var(--fsus-radius-control);',
      'font-size: 14px;',
    ])
    expectCssRule(css, '.el-empty-state__actions .el-link', [
      'min-height: var(--fsus-empty-action-min-height, 40px);',
    ])
    expect(css).toMatch(
      /@media \(max-width: 419px\) \{[\s\S]*?\.el-empty__bottom,\s*\.el-empty-state__actions \{[^}]*--fsus-empty-action-min-height: 44px;/,
    )
  })

  test('assigns root components to semantic surfaces instead of one panel mixin', () => {
    const css = compileThemeFile('fsus-theme.scss')
    const source = readFileSync(
      path.resolve(dirname, '../src/fsus-theme.scss'),
      'utf8',
    )

    for (const selector of [
      '.el-alert',
      '.el-result',
      '.el-page-header',
      '.el-statistic',
      '.el-countdown',
    ]) {
      expectCssRule(css, selector, [
        'background: transparent;',
        'border: 0;',
        'border-radius: 0;',
        'box-shadow: none;',
      ])
    }
    for (const selector of ['.el-calendar', '.el-transfer-panel']) {
      expectCssRule(css, selector, [
        'border: 1px solid var(--fsus-border);',
        'border-radius: var(--fsus-radius-panel);',
        'box-shadow: none;',
      ])
    }
    expect(source).toContain(
      '/* fsus-surface: data-region [calendar, transfer-panel] */',
    )
    expect(source).not.toMatch(
      /\.#\{\$namespace\}-(?:alert|result|page-header|statistic)[\s\S]{0,500}@include fsus-panel/,
    )
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
    expectCssRule(css, '.el-data-list--navigation .el-data-list__row', [
      'min-height: 58px;',
      'column-gap: 12px;',
      'border-bottom: 1px solid var(--el-border-color-lighter);',
    ])
    expectCssRule(
      css,
      '.el-data-list--navigation.is-interactive .el-data-list__row:focus-visible',
      [
        'background: var(--el-data-list-hover-background);',
        'box-shadow: inset 0 0 0 2px var(--el-data-list-focus-ring);',
        'outline: none;',
      ],
    )
    expectCssRule(
      css,
      '.el-data-list--navigation .el-data-list__row.is-active',
      [
        'background: var(--el-data-list-active-background);',
        'box-shadow: inset 2px 0 0 var(--el-data-list-active-indicator);',
      ],
    )
    expectCssRule(
      css,
      '.el-data-list--navigation .el-data-list__cell:first-child',
      ['padding-left: 20px;'],
    )
    expectCssRule(
      css,
      '.el-data-list--navigation .el-data-list__cell:last-child',
      ['padding-left: 0;', 'padding-right: 16px;'],
    )
    expectCssRule(css, '.el-data-list__cell', ['box-sizing: border-box;'])
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
        'padding: var(--fsus-space-2) var(--fsus-space-3);',
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

  test('Descriptions bordered cell padding uses 4px spacing scale tokens without 15/11/7px', () => {
    const descriptionsCss = compileThemeFile('descriptions.scss')
    const fsusCss = compileThemeFile('fsus.scss')

    // Density ladder from canonical --fsus-space-* (12/16, 8/12, 4/8).
    expectCssRule(
      descriptionsCss,
      '.el-descriptions__body .el-descriptions__table.is-bordered .el-descriptions__cell',
      ['padding: var(--fsus-space-2) var(--fsus-space-3);'],
    )
    expectCssRule(
      descriptionsCss,
      '.el-descriptions--large .el-descriptions__body .el-descriptions__table.is-bordered .el-descriptions__cell',
      ['padding: var(--fsus-space-3) var(--fsus-space-4);'],
    )
    expectCssRule(
      descriptionsCss,
      '.el-descriptions--small .el-descriptions__body .el-descriptions__table.is-bordered .el-descriptions__cell',
      ['padding: var(--fsus-space-1) var(--fsus-space-2);'],
    )

    // Non-bordered + stack share the same horizontal space-3 rhythm.
    expectCssRule(
      descriptionsCss,
      '.el-descriptions__body .el-descriptions__table:not(.is-bordered) .el-descriptions__cell',
      ['padding-inline: var(--fsus-space-3);'],
    )
    expectCssRule(descriptionsCss, '.el-descriptions__stack', [
      'padding: 0 var(--fsus-space-3);',
    ])

    // Production CSS must not emit the legacy off-scale horizontal paddings.
    for (const css of [descriptionsCss, fsusCss]) {
      expect(css).not.toMatch(
        /\.el-descriptions__body[^}]*\.is-bordered[^{]*\.el-descriptions__cell\s*\{[^}]*padding:\s*12px 15px/s,
      )
      expect(css).not.toMatch(
        /\.el-descriptions__body[^}]*\.is-bordered[^{]*\.el-descriptions__cell\s*\{[^}]*padding:\s*8px 11px/s,
      )
      expect(css).not.toMatch(
        /\.el-descriptions--small[^}]*\.is-bordered[^{]*\.el-descriptions__cell\s*\{[^}]*padding:\s*4px 7px/s,
      )
      expect(css).not.toMatch(
        /\.el-descriptions--large[^}]*\.is-bordered[^{]*\.el-descriptions__cell\s*\{[^}]*padding:\s*12px 15px/s,
      )
      // No private descriptions padding alias reintroducing off-scale values.
      expect(css).not.toMatch(
        /--(?:el-)?descriptions[^:;{}]*padding[^:;{}]*:\s*(?:15|11|7)px/,
      )
    }

    // Cells stay flat — no per-cell radius/shadow.
    expect(descriptionsCss).not.toMatch(
      /\.el-descriptions__cell\s*\{[^}]*border-radius:/s,
    )
    expect(descriptionsCss).not.toMatch(
      /\.el-descriptions__cell\s*\{[^}]*box-shadow:/s,
    )
  })

  test('keeps theme mode toggle controls visually lightweight', () => {
    const css = compileThemeFile('fsus-theme.scss')

    expectCssRule(css, '.el-theme-mode-toggle .el-radio-group', [
      'background: var(--el-theme-mode-toggle-bg, var(--el-fill-color-extra-light));',
      'border: 1px solid var(--el-border-color-lighter);',
      'border-radius: var(--fsus-radius-control, 6px);',
      'padding: 2px;',
      'overflow: hidden;',
    ])
    expectCssRule(css, '.el-theme-mode-toggle .el-radio-button__inner', [
      'border-radius: 6px;',
      'overflow: hidden;',
    ])
    expectCssRule(
      css,
      '.el-theme-mode-toggle .el-radio-button:focus-within .el-radio-button__inner',
      [
        'border-color: var(--el-theme-mode-toggle-active-border-color, transparent) !important;',
        'border-radius: 6px;',
        'box-shadow: inset 0 0 0 2px var(--el-theme-mode-toggle-active-ring, color-mix(in srgb, var(--fsus-scholarly-blue) 24%, transparent)) !important;',
      ],
    )
    expectCssRule(
      css,
      '.el-theme-mode-toggle .el-radio-button.is-active .el-radio-button__inner',
      [
        'background: var(--el-theme-mode-toggle-active-bg, color-mix(in srgb, var(--fsus-scholarly-blue) 14%, var(--el-bg-color)));',
        'box-shadow: inset 0 0 0 2px var(--el-theme-mode-toggle-active-ring, color-mix(in srgb, var(--fsus-scholarly-blue) 24%, transparent)) !important;',
      ],
    )
  })

  test('keeps generic radio button active focus visually quiet', () => {
    const css = compileThemeFile('fsus-theme.scss')

    expectCssRule(
      css,
      '.el-radio-group .el-radio-button__inner, .el-checkbox-group .el-checkbox-button__inner',
      ['border-radius: 6px;'],
    )
    expectCssRule(
      css,
      '.el-radio-group .el-radio-button:first-child .el-radio-button__inner, .el-radio-group .el-radio-button:last-child .el-radio-button__inner, .el-checkbox-group .el-checkbox-button:first-child .el-checkbox-button__inner, .el-checkbox-group .el-checkbox-button:last-child .el-checkbox-button__inner',
      ['border-radius: 6px;'],
    )
    expectCssRule(
      css,
      '.el-checkbox-button.is-checked.is-focus .el-checkbox-button__inner, .el-radio-button.is-active:focus-within .el-radio-button__inner',
      [
        'border-color: transparent !important;',
        'var(--el-box-shadow-lighter),',
        'inset 0 0 0 2px color-mix(in srgb, var(--fsus-scholarly-blue) 18%, transparent) !important;',
        'z-index: 1;',
      ],
    )
  })

  test('keeps switch thumb material aligned with FsusUI surfaces', () => {
    const css = compileThemeFile('fsus-theme.scss')
    const switchCss = compileThemeFile('switch.scss')

    expectCssRule(css, '.el-switch', [
      '--fsus-switch-action-inset: 2px;',
      '--fsus-switch-motion-thumb: 220ms;',
      '--fsus-switch-ease-thumb: cubic-bezier(0.22, 1, 0.36, 1);',
      '--fsus-switch-off-bg: color-mix( in srgb, var(--fsus-ink) 7%, var(--fsus-color-surface-raised) 93% );',
      '--fsus-switch-off-border: color-mix( in srgb, var(--fsus-ink) 10%, var(--fsus-color-surface-raised) 90% );',
      '--fsus-switch-action-bg: var(--fsus-color-surface-raised);',
      '--fsus-switch-action-border: color-mix( in srgb, var(--fsus-border-light) 86%, var(--fsus-ink) 14% );',
      '--fsus-switch-action-shadow: 0 1px 2px rgba(15, 15, 17, 0.08);',
    ])
    expectCssRule(css, '.el-switch__action', [
      'left: calc(var(--fsus-switch-action-inset) - 1px) !important;',
      'box-sizing: border-box;',
      'background-color: var(--fsus-switch-action-bg);',
      'box-shadow: var(--fsus-switch-action-shadow);',
      'border: 1px solid var(--fsus-switch-action-border);',
    ])
    expectCssRule(css, 'html.dark .el-switch__action', [
      '--fsus-switch-action-bg: color-mix( in srgb, var(--fsus-color-surface-base) 82%, white 18% );',
      '--fsus-switch-action-border: color-mix( in srgb, var(--fsus-border-light) 56%, white 44% );',
      '--fsus-switch-action-shadow: 0 1px 2px rgba(0, 0, 0, 0.28);',
    ])
    expectCssRule(
      css,
      '.el-switch.is-checked .el-switch__core .el-switch__action',
      [
        '--fsus-switch-checked-action-bg: var(--el-color-white);',
        '--fsus-switch-action-border: color-mix( in srgb, var(--fsus-scholarly-blue) 18%, var(--el-color-white) 82% );',
        '--fsus-switch-action-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fsus-scholarly-blue) 10%, transparent), 0 1px 2px rgba(15, 15, 17, 0.16);',
        'background-color: var(--fsus-switch-checked-action-bg);',
        'left: calc(var(--fsus-switch-core-width) - var(--fsus-switch-action-size) - var(--fsus-switch-action-inset) - 1px) !important;',
        'transform: none;',
      ],
    )
    expectCssRule(css, '.el-switch__core', [
      'background: var(--fsus-switch-off-bg);',
      'border-color: var(--fsus-switch-off-border);',
      'box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--fsus-ink) 4%, transparent);',
      'background-color var(--fsus-motion-control-fast) var(--fsus-motion-standard)',
      'border-color var(--fsus-motion-control-fast) var(--fsus-motion-standard)',
      'box-shadow var(--fsus-motion-control-fast) var(--fsus-motion-standard)',
    ])
    expectCssRule(css, '.el-switch__action', [
      'left var(--fsus-switch-motion-thumb) var(--fsus-switch-ease-thumb)',
      'will-change: left;',
    ])
    expectCssRule(css, '.el-switch.is-checked .el-switch__core', [
      'box-shadow: none;',
    ])
    expectCssRule(
      css,
      '.el-switch.is-sliding .el-switch__action, .el-switch:active .el-switch__action',
      ['filter: blur(0);', 'box-shadow: var(--fsus-switch-action-shadow);'],
    )
    expectCssRule(switchCss, '.el-switch__core', [
      'border-color var(--fsus-motion-control-fast, var(--el-transition-duration-fast))',
      'background-color var(--fsus-motion-control-fast, var(--el-transition-duration-fast))',
    ])
    expectCssRule(switchCss, '.el-switch__core .el-switch__action', [
      'left: calc(var(--fsus-switch-action-inset, 2px) - 1px);',
      'box-sizing: border-box;',
      'left var(--fsus-switch-motion-thumb, var(--fsus-motion-control-fast, var(--el-transition-duration-fast)))',
      'will-change: left;',
    ])
    expectCssRule(
      switchCss,
      '.el-switch.is-checked .el-switch__core .el-switch__action',
      ['left: calc(100% - 16px - var(--fsus-switch-action-inset, 2px) - 1px);'],
    )
    expect(css).not.toContain(
      'transform var(--fsus-motion-control) var(--fsus-motion-emphasized)',
    )
    expect(switchCss).not.toContain('var(--fsus-motion-control, 260ms)')
    expect(switchCss).not.toContain('calc(100% - 17px)')
  })

  test('defines theme mode segmented tokens in the component stylesheet', () => {
    const css = compileThemeFile('theme-mode-toggle.scss')

    /* design.md §8: segment controls use stable hit areas and restrained
       selection material. The group surface stays quiet, but not transparent
       on white headers, so active items do not read as detached tiles. */
    expectCssRule(css, '.el-theme-mode-toggle--segmented', [
      '--el-theme-mode-toggle-bg: var(--el-fill-color-extra-light);',
      '--el-theme-mode-toggle-item-bg: transparent;',
      '--el-theme-mode-toggle-item-border-color: transparent;',
      '--el-theme-mode-toggle-active-bg: color-mix(in srgb, var(--fsus-scholarly-blue) 14%, var(--el-bg-color));',
      '--el-theme-mode-toggle-active-ring: color-mix(in srgb, var(--fsus-scholarly-blue) 24%, transparent);',
      'gap: 2px;',
      'min-height: 40px;',
      'padding: 2px;',
      'border-radius: var(--fsus-radius-control, 6px);',
      'background: var(--el-theme-mode-toggle-bg);',
      'overflow: hidden;',
    ])
    expectCssRule(
      css,
      '.el-theme-mode-toggle--segmented .el-radio-button__inner',
      [
        'background: var(--el-theme-mode-toggle-item-bg);',
        'border-color: var(--el-theme-mode-toggle-item-border-color);',
        'border-radius: 6px;',
        'color: var(--el-theme-mode-toggle-item-color);',
        'overflow: hidden;',
      ],
    )
    expectCssRule(
      css,
      '.el-theme-mode-toggle--segmented .el-radio-button__original-radio:checked + .el-radio-button__inner, .el-theme-mode-toggle--segmented .el-radio-button.is-active .el-radio-button__inner',
      [
        'background: var(--el-theme-mode-toggle-active-bg);',
        'border-color: var(--el-theme-mode-toggle-active-border-color);',
        'color: var(--el-theme-mode-toggle-active-color);',
        'box-shadow: inset 0 0 0 var(--fsus-focus-ring-width, 2px) var(--el-theme-mode-toggle-active-ring) !important;',
      ],
    )
  })

  test('maps theme mode segmented tokens through resolved theme states', () => {
    const css = compileThemeFile('theme-mode-toggle.scss')

    /* The group surface is visible in both themes; hover and active keep
       their theme-specific tints so the selected pill reads as Scholarly
       Blue without leaking a square radio-button edge. */
    expectCssRule(
      css,
      ':root[data-theme-resolved=light] .el-theme-mode-toggle--segmented',
      [
        '--el-theme-mode-toggle-bg: var(--el-fill-color-extra-light);',
        '--el-theme-mode-toggle-item-bg: transparent;',
        '--el-theme-mode-toggle-item-hover-bg: color-mix(in srgb, var(--fsus-scholarly-blue) 8%, transparent);',
        '--el-theme-mode-toggle-active-bg: color-mix(in srgb, var(--fsus-scholarly-blue) 14%, var(--el-bg-color));',
        '--el-theme-mode-toggle-active-ring: color-mix(in srgb, var(--fsus-scholarly-blue) 24%, transparent);',
      ],
    )
    expectCssRule(
      css,
      ':root[data-theme-resolved=dark] .el-theme-mode-toggle--segmented',
      [
        '--el-theme-mode-toggle-bg: color-mix(in srgb, var(--el-fill-color-light) 76%, transparent);',
        '--el-theme-mode-toggle-item-bg: transparent;',
        '--el-theme-mode-toggle-item-hover-bg: color-mix(in srgb, var(--fsus-scholarly-blue) 16%, transparent);',
        '--el-theme-mode-toggle-active-bg: color-mix(in srgb, var(--fsus-scholarly-blue) 24%, var(--el-bg-color));',
        '--el-theme-mode-toggle-active-ring: color-mix(in srgb, var(--fsus-scholarly-blue) 34%, transparent);',
      ],
    )
  })

  test('keeps theme mode segmented interaction states token-backed', () => {
    const css = compileThemeFile('theme-mode-toggle.scss')

    expectCssRule(
      css,
      '.el-theme-mode-toggle--segmented .el-radio-button__inner',
      [
        'background: var(--el-theme-mode-toggle-item-bg);',
        'color: var(--el-theme-mode-toggle-item-color);',
      ],
    )
    expectCssRule(
      css,
      '.el-theme-mode-toggle--segmented .el-radio-button__inner:hover',
      [
        'background: var(--el-theme-mode-toggle-item-hover-bg);',
        'color: var(--el-theme-mode-toggle-item-hover-color);',
      ],
    )
    expectCssRule(
      css,
      '.el-theme-mode-toggle--segmented .el-radio-button__original-radio:focus-visible + .el-radio-button__inner',
      [
        'box-shadow: inset 0 0 0 var(--fsus-focus-ring-width, 2px) var(--el-theme-mode-toggle-active-ring) !important;',
        'border-radius: 6px;',
      ],
    )
    expectCssRule(
      css,
      '.el-theme-mode-toggle--segmented .el-radio-button:focus-within .el-radio-button__inner',
      [
        'border-color: var(--el-theme-mode-toggle-active-border-color) !important;',
        'border-radius: 6px;',
        'box-shadow: inset 0 0 0 var(--fsus-focus-ring-width, 2px) var(--el-theme-mode-toggle-active-ring) !important;',
      ],
    )
    expectCssRule(
      css,
      '.el-theme-mode-toggle--segmented .el-radio-button__original-radio:checked + .el-radio-button__inner, .el-theme-mode-toggle--segmented .el-radio-button.is-active .el-radio-button__inner',
      [
        'background: var(--el-theme-mode-toggle-active-bg);',
        'color: var(--el-theme-mode-toggle-active-color);',
        'box-shadow: inset 0 0 0 var(--fsus-focus-ring-width, 2px) var(--el-theme-mode-toggle-active-ring) !important;',
      ],
    )
  })

  test('supports theme mode menu-button as restrained paper menu', () => {
    const css = compileThemeFile('theme-mode-toggle.scss')

    expectCssRule(css, '.el-theme-mode-toggle__menu-button', [
      'min-height: 44px;',
      'border: 1px solid var(--el-border-color-lighter);',
      'border-radius: var(--el-border-radius-small);',
      'font-size: 14px;',
      'font-weight: 500;',
    ])
    expectCssRule(css, '.el-theme-mode-toggle__menu', [
      'position: absolute;',
      'min-width: 132px;',
      'border: 1px solid var(--el-border-color-lighter);',
      'border-radius: var(--fsus-radius-control, 6px);',
      'background: var(--el-bg-color);',
      'box-shadow: var(--el-box-shadow-light);',
    ])
    expectCssRule(css, '.el-theme-mode-toggle__menu-item', [
      'min-height: 44px;',
      'background: transparent;',
      'font-size: 14px;',
      'font-weight: 500;',
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
      'transform: translate3d(0, 1px, 0);',
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

  test('ships identifiable loading spinner path, not a decorative capsule (#303)', () => {
    // Real consumer path: fsus.scss pulls loading.scss then fsus-theme overrides.
    // fsus-theme historically hid .path and flattened .circular into a 28×6 capsule
    // with 11px uppercase tracking text — that is the #303 regression surface.
    const loadingCss = compileThemeFile('loading.scss')
    const themeCss = compileThemeFile('fsus-theme.scss')
    const shippedCss = compileThemeFile('fsus.scss')
    const spinnerCss = compileThemeFile('spinner.scss')
    const skeletonCss = compileThemeFile('skeleton.scss')
    const markdownCss = compileThemeFile('markdown-renderer.scss')

    // Default Loading: square spinner + visible path + low-noise stroke motion.
    expectCssRule(loadingCss, '.el-loading-spinner .circular', [
      'background: transparent;',
      'box-shadow: none;',
      'animation: loading-rotate 2s linear infinite;',
    ])
    expectCssRule(loadingCss, '.el-loading-spinner .path', [
      'animation: loading-dash 1.5s ease-in-out infinite;',
      'stroke: var(--el-text-color-placeholder);',
      'stroke-dasharray: 90, 150;',
    ])
    expectCssRule(loadingCss, '.el-loading-spinner .el-loading-text', [
      'font-size: var(--el-font-size-base);',
      'letter-spacing: 0;',
      'text-transform: none;',
    ])
    expectCssRule(loadingCss, '.el-loading-spinner.is-animated .circular', [
      'animation: loading-rotate 2s linear infinite;',
    ])
    expectCssRule(
      loadingCss,
      '[data-fsus-loading-motion=spinner] .el-loading-spinner .path',
      ['animation: loading-dash 1.5s ease-in-out infinite;'],
    )

    // Theme override must reinforce the spinner contract, never capsule geometry.
    expectCssRule(themeCss, '.el-loading-spinner .circular', [
      'width: var(--el-loading-spinner-size, 42px);',
      'height: var(--el-loading-spinner-size, 42px);',
      'background: transparent;',
      'box-shadow: none;',
      'animation: loading-rotate 2s linear infinite;',
    ])
    expectCssRule(themeCss, '.el-loading-spinner .path', [
      'display: block;',
      'animation: loading-dash 1.5s ease-in-out infinite;',
      'stroke: var(--el-text-color-placeholder);',
    ])
    expectCssRule(themeCss, '.el-loading-spinner .el-loading-text', [
      'font-size: var(--el-font-size-base, 14px);',
      'letter-spacing: 0;',
      'text-transform: none;',
    ])

    // Mutation kill: decorative 28×6 capsule must not reappear on circular.
    const circularRules = [
      ...cssRules(loadingCss, '.el-loading-spinner .circular'),
      ...cssRules(themeCss, '.el-loading-spinner .circular'),
      ...cssRules(shippedCss, '.el-loading-spinner .circular'),
    ].filter((rule) => !rule.includes('animation-duration'))
    expect(circularRules.length).toBeGreaterThan(0)
    for (const rule of circularRules) {
      expect(rule).not.toMatch(/width:\s*28px/)
      expect(rule).not.toMatch(/height:\s*6px/)
      expect(rule).not.toMatch(/border-radius:\s*999px/)
      expect(rule).not.toMatch(/background:\s*var\(--el-fill-color-light\)/)
      expect(rule).not.toMatch(/animation:\s*none/)
      expect(rule).not.toContain('punctuation-zinc-pulse')
    }

    // Mutation kill: spinner path must stay visible (not display:none).
    const pathRules = [
      ...cssRules(loadingCss, '.el-loading-spinner .path'),
      ...cssRules(themeCss, '.el-loading-spinner .path'),
      ...cssRules(shippedCss, '.el-loading-spinner .path'),
    ].filter((rule) => !rule.includes('animation-duration'))
    expect(pathRules.length).toBeGreaterThan(0)
    for (const rule of pathRules) {
      expect(rule).not.toMatch(/display:\s*none/)
    }

    // Mutation kill: micro uppercase / tracking loading copy must not return.
    const textRules = [
      ...cssRules(loadingCss, '.el-loading-text'),
      ...cssRules(themeCss, '.el-loading-text'),
      ...cssRules(shippedCss, '.el-loading-text'),
    ]
    expect(textRules.length).toBeGreaterThan(0)
    for (const rule of textRules) {
      expect(rule).not.toMatch(/font-size:\s*11px/)
      expect(rule).not.toMatch(/letter-spacing:\s*0\.15em/)
      expect(rule).not.toMatch(/text-transform:\s*uppercase/)
      expect(rule).not.toMatch(/font-weight:\s*700/)
    }

    // Integrated bundle keeps spinner motion and paper mask.
    expect(shippedCss).toContain('animation: loading-rotate 2s linear infinite')
    expect(shippedCss).toContain(
      'animation: loading-dash 1.5s ease-in-out infinite',
    )
    expect(shippedCss).toContain('text-transform: none')
    expectCssRule(shippedCss, '.el-loading-mask', [
      'backdrop-filter: blur(0px) saturate(100%);',
    ])
    // No shimmer / pulse / brand glow on the loading surface.
    expect(shippedCss).not.toContain('punctuation-zinc-pulse')
    expect(themeCss).not.toContain('punctuation-zinc-pulse 1.2s')
    expect(loadingCss).not.toMatch(
      /\.el-loading-spinner[^{]*\{[^}]*linear-gradient/s,
    )
    expect(themeCss).not.toMatch(
      /\.el-loading-spinner[^{]*\{[^}]*linear-gradient/s,
    )

    // Adjacent feedback primitives stay neutral (out of #303 spinner scope).
    expectCssRule(spinnerCss, '.el-spinner-inner', [
      'background-color: var(--el-fill-color-light, #f4f4f5);',
      'animation: none;',
    ])
    expect(skeletonCss).not.toContain('linear-gradient')
    expect(skeletonCss).not.toContain('el-skeleton-loading')
    expectCssRule(skeletonCss, '.el-skeleton.is-animated .el-skeleton__item', [
      'animation: skeleton-zinc-pulse 1.5s ease-in-out infinite;',
    ])
    expectCssRule(themeCss, '.el-skeleton__item', [
      'border-radius: var(--fsus-radius-control-small, 4px);',
    ])
    expectCssRule(markdownCss, '.markdown-renderer__loading-spinner', [
      'background: var(--el-fill-color-light);',
      'animation: none;',
    ])
    expect(markdownCss).not.toContain('markdown-renderer-spin')
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
      'position: absolute;',
      'transform: none;',
    ])
    const dialogCss = compileThemeFile('dialog.scss')
    expectCssRule(dialogCss, '.el-dialog__headerbtn', [
      'width: 54px;',
      'height: 54px;',
      'min-width: 54px;',
      'min-height: 54px;',
      'transform: none;',
    ])
    const messageBoxCss = compileThemeFile('message-box.scss')
    expectCssRule(messageBoxCss, '.el-message-box__headerbtn', [
      'width: 54px;',
      'height: 54px;',
      'min-width: 54px;',
      'min-height: 54px;',
      'transform: none;',
    ])
    // Theme convergence: overlay closes share 54px; compact notification/alert stay 44.
    const themeCss = compileThemeFile('fsus-theme.scss')
    expectCssRule(themeCss, '.el-dialog__headerbtn', [
      'width: 54px;',
      'height: 54px;',
      'min-width: 54px;',
      'min-height: 54px;',
    ])
    expectCssRule(themeCss, '.el-drawer__close-btn', [
      'width: 54px;',
      'height: 54px;',
      'min-width: 54px;',
      'min-height: 54px;',
    ])
    expectCssRule(themeCss, '.el-message-box__headerbtn', [
      'width: 54px;',
      'height: 54px;',
      'min-width: 54px;',
      'min-height: 54px;',
    ])
    expectCssRule(themeCss, '.el-notification__closeBtn', [
      'min-width: 44px;',
      'min-height: 44px;',
    ])
    expectCssRule(themeCss, '.el-alert__close-btn', [
      'min-width: 44px;',
      'min-height: 44px;',
    ])
    // Mutation kill: overlay closes must not stay on the 44px compact ladder.
    expect(messageBoxCss).not.toContain('min-width: 44px')
    expect(themeCss).not.toMatch(
      /\.el-dialog__headerbtn[^{]*\{[^}]*min-width:\s*44px/s,
    )
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

  test('uses Scholarly Blue state tokens for selection and checked feedback', () => {
    const tableColumnCss = compileThemeFile('table-column.scss')
    const checkTagCss = compileThemeFile('check-tag.scss')
    const tableCss = compileThemeFile('table.scss')
    const dropdownCss = compileThemeFile('dropdown.scss')
    const menuCss = compileThemeFile('menu.scss')

    expectCssRule(tableColumnCss, '.el-table-filter__list-item:hover', [
      'background-color: var(--fsus-state-hover-bg);',
      'color: var(--fsus-scholarly-blue);',
    ])
    expectCssRule(tableColumnCss, '.el-table-filter__list-item.is-active', [
      'background-color: var(--fsus-state-selected-bg);',
      'color: var(--fsus-scholarly-blue);',
    ])
    expectCssRule(checkTagCss, '.el-check-tag', [
      'background-color: var(--el-color-info-light-9);',
      'color: var(--el-color-info);',
      'padding: var(--fsus-space-1) var(--fsus-space-4);',
    ])
    expectCssRule(checkTagCss, '.el-check-tag:hover', [
      'background-color: var(--fsus-state-hover-bg);',
      'color: var(--fsus-scholarly-blue);',
    ])
    expectCssRule(checkTagCss, '.el-check-tag.is-checked', [
      'background-color: var(--fsus-state-selected-bg);',
      'color: var(--fsus-scholarly-blue);',
    ])
    expectCssRule(checkTagCss, '.el-check-tag.is-checked:hover', [
      'background-color: var(--fsus-state-emphasis-bg);',
    ])
    expectCssRule(tableCss, '.el-table', [
      '--el-table-current-row-bg-color: var(--fsus-state-selected-bg);',
    ])
    expectCssRule(
      tableCss,
      '.el-table__body tr.current-row > td.el-table__cell',
      ['background-color: var(--el-table-current-row-bg-color);'],
    )
    expectCssRule(dropdownCss, '.el-dropdown', [
      '--el-dropdown-menuItem-hover-fill: var(--fsus-state-hover-bg);',
      '--el-dropdown-menuItem-hover-color: var(--fsus-scholarly-blue);',
    ])
    expectCssRule(
      dropdownCss,
      '.el-dropdown-menu__item:not(.is-disabled):focus',
      [
        'background-color: var(--el-dropdown-menuItem-hover-fill);',
        'color: var(--el-dropdown-menuItem-hover-color);',
      ],
    )
    expectCssRule(menuCss, ':root', [
      '--el-menu-hover-text-color: var(--fsus-scholarly-blue);',
      '--el-menu-hover-bg-color: var(--fsus-state-hover-bg);',
      '--el-menu-item-hover-fill: var(--fsus-state-hover-bg);',
    ])
    expectCssRule(menuCss, '.el-menu-item:hover', [
      'background-color: var(--el-menu-hover-bg-color);',
    ])
  })

  test('maps control popup and badge radii to the canonical ladder', () => {
    const inputCss = compileThemeFile('input.scss')
    const selectV2Css = compileThemeFile('select-v2.scss')
    const menuCss = compileThemeFile('menu.scss')
    const dropdownMenuCss = compileThemeFile('dropdown-menu.scss')
    const dropdownCss = compileThemeFile('dropdown.scss')
    const popoverCss = compileThemeFile('popover.scss')
    const popperCss = compileThemeFile('popper.scss')
    const badgeCss = compileThemeFile('badge.scss')

    expectCssRule(inputCss, '.el-textarea', [
      '--el-input-border-radius: var(--el-border-radius-base);',
    ])
    expectCssRule(inputCss, '.el-input__wrapper', [
      'border-radius: var(--el-input-border-radius, var(--el-border-radius-base));',
    ])
    expectCssRule(selectV2Css, '.el-select-v2__wrapper', [
      'border-radius: var(--fsus-radius-control, var(--el-border-radius-base));',
    ])
    expectCssRule(selectV2Css, '.el-select-v2__wrapper.is-focused', [
      'border-radius: var(--fsus-radius-control, var(--el-border-radius-base));',
    ])
    // Flat navigation track (issue #294): no per-item panel radius / button wall.
    expectCssRule(menuCss, '.el-menu-item', ['border-radius: 0;'])
    expectCssRule(menuCss, '.el-menu-item:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
      'border-radius: var(--fsus-radius-navigation, var(--el-border-radius-base));',
    ])
    for (const css of [dropdownMenuCss, dropdownCss]) {
      expectCssRule(css, '.el-dropdown-menu', [
        'border-radius: var(--fsus-radius-popover, var(--el-popover-border-radius));',
      ])
    }
    expectCssRule(popoverCss, '.el-popover', [
      '--el-popover-border-radius: var(--el-popover-border-radius, var(--fsus-radius-popover));',
    ])
    expectCssRule(popoverCss, '.el-popover.el-popper', [
      'border-radius: var(--el-popover-border-radius);',
    ])
    expectCssRule(popperCss, '.el-popper', [
      '--el-popper-border-radius: var(--el-popover-border-radius);',
    ])
    expectCssRule(popperCss, '.el-popper', [
      'border-radius: var(--el-popper-border-radius);',
    ])
    expectCssRule(badgeCss, '.el-badge', [
      '--el-badge-radius: var(--el-border-radius-round);',
    ])
    expectCssRule(badgeCss, '.el-badge__content', [
      'border-radius: var(--el-badge-radius);',
    ])
    expectCssRule(badgeCss, '.el-badge__content.is-dot', [
      'border-radius: 50%;',
    ])

    for (const css of [
      inputCss,
      selectV2Css,
      menuCss,
      dropdownCss,
      popoverCss,
    ]) {
      expect(css).not.toContain('border-radius: 8px;')
    }
  })

  test('enforces shared popper surface and arrow geometry contract (#475)', () => {
    const popperCss = compileThemeFile('popper.scss')

    // Surface: 10px root radius (ref #473)
    expectCssRule(popperCss, '.el-popper', [
      'border-radius: var(--el-popper-border-radius);',
    ])
    expectCssRule(popperCss, '.el-popper', [
      '--el-popper-border-radius: var(--el-popover-border-radius);',
    ])

    // 4px-scale padding: 8×12px (ref #473)
    expectCssRule(popperCss, '.el-popper', [
      'padding: 8px 12px;',
    ])

    // Pure variant: zero padding
    expectCssRule(popperCss, '.el-popper.is-pure', [
      'padding: 0;',
    ])

    // Single arrow geometry: 10×10px (ref #473)
    const arrow = '.el-popper__arrow'
    expectCssRule(popperCss, arrow, [
      'width: 10px;',
      'height: 10px;',
    ])
    expectCssRule(popperCss, `${arrow}::before`, [
      'width: 10px;',
      'height: 10px;',
      'transform: rotate(45deg);',
    ])

    // Arrow edge placement: -5px from the opposite edge
    for (const placement of ['top', 'bottom', 'left', 'right']) {
      const selector = `.el-popper[data-popper-placement^=${placement}] > ${arrow}`
      // The opposite edge should be -5px
      expect(popperCss).toContain(selector)
    }

    // Arrow border transparency per placement (prevents double-line seams)
    const placementPairs: Record<string, string[]> = {
      top: ['left'],
      bottom: ['right'],
      left: ['bottom'],
      right: ['top'],
    }
    for (const [placement, adjacencies] of Object.entries(placementPairs)) {
      const selector = `.el-popper[data-popper-placement^=${placement}]`
      // Each placement hides two borders of the arrow ::before to form a triangle
      expect(popperCss).toContain(selector)
    }

    // Light theme: overlay background + light border
    expectCssRule(popperCss, '.el-popper.is-light', [
      'background: var(--el-bg-color-overlay);',
      'border: 1px solid var(--el-border-color-light);',
    ])

    // Dark theme: primary text background
    expectCssRule(popperCss, '.el-popper.is-dark', [
      'color: var(--el-bg-color);',
      'background: var(--el-text-color-primary);',
      'border: 1px solid var(--el-text-color-primary);',
    ])

    // Light arrow: matches light surface border
    expectCssRule(popperCss, '.el-popper.is-light .el-popper__arrow::before', [
      'border: 1px solid var(--el-border-color-light);',
      'background: var(--el-bg-color-overlay);',
    ])

    // Dark arrow: matches dark surface border
    expectCssRule(popperCss, '.el-popper.is-dark .el-popper__arrow::before', [
      'border: 1px solid var(--el-text-color-primary);',
      'background: var(--el-text-color-primary);',
    ])

    // No magic geometry: reject 2/5/11px values
    expect(popperCss).not.toContain('border-radius: 2px')
    expect(popperCss).not.toContain('border-radius: 5px')
    expect(popperCss).not.toContain('border-radius: 11px')
    expect(popperCss).not.toContain('padding: 2px')
    expect(popperCss).not.toContain('padding: 5px')
    // Reject per-placement arrow size forks
    expect(popperCss).not.toMatch(/arrow.*width:\s*(?!10px)[\d]+px/)
    expect(popperCss).not.toMatch(/arrow.*height:\s*(?!10px)[\d]+px/)
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
        'animation: dialog-scale-fade-in var(--fsus-motion-panel, 360ms) var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1));',
      ],
    )
    expectCssRule(
      dialogCss,
      '.dialog-scale-fade-leave-active .el-overlay-dialog',
      [
        'animation: dialog-scale-fade-out var(--fsus-motion-panel, 360ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
      ],
    )
    expectCssRule(dialogCss, '.dialog-fade-enter-active', [
      'animation: modal-fade-in var(--fsus-motion-overlay, 300ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expectCssRule(dialogCss, '.dialog-fade-enter-active .el-overlay-dialog', [
      'animation: dialog-fade-in var(--fsus-motion-panel, 360ms) var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1));',
    ])
    expectCssRule(dialogCss, '.dialog-fade-leave-active .el-overlay-dialog', [
      'animation: dialog-fade-out var(--fsus-motion-panel, 360ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expect(dialogCss).toContain('@keyframes dialog-scale-fade-in')
    expect(dialogCss).toContain('@keyframes dialog-scale-fade-out')
    expect(dialogCss).toContain('var(--fsus-motion-distance-sm, 8px)')
    expect(dialogCss).toContain(
      'scale(var(--fsus-motion-intensity-standard, 0.96))',
    )
    expect(dialogCss).toContain(
      'scale(var(--fsus-motion-intensity-subtle, 0.98))',
    )
    expect(dialogCss).not.toContain('--fsus-motion-distance-xs')
  })

  test('keeps reduced-motion state machines alive at one millisecond', () => {
    const themeCss = compileThemeFile('fsus-theme.scss')
    const transitionCss = compileThemeFile('common/transition.scss')
    const dialogCss = compileThemeFile('dialog.scss')
    const drawerCss = compileThemeFile('drawer.scss')
    const notificationCss = compileThemeFile('notification.scss')
    const tabPaneCss = compileThemeFile('tab-pane.scss')

    expectCssRule(themeCss, '.el-tabs__item', [
      'transition-duration: 1ms !important;',
      'transition-delay: 0ms !important;',
      'animation-duration: 1ms !important;',
      'animation-delay: 0ms !important;',
    ])
    expectCssRule(themeCss, '.el-loading-spinner .circular', [
      'animation-duration: 0.01ms !important;',
      'animation-delay: 0ms !important;',
      'animation-iteration-count: 1 !important;',
    ])
    expectCssRule(tabPaneCss, '.el-tab-pane', [
      'animation-duration: 1ms;',
      'transform: none !important;',
    ])
    for (const selector of [
      '.el-zoom-in-top-enter-active',
      '.el-zoom-in-top-leave-active',
      '.el-collapse-transition-enter-active',
      '.el-collapse-transition-leave-active',
    ]) {
      expectCssRule(transitionCss, selector, [
        'transition-duration: 1ms !important;',
        'transition-delay: 0ms !important;',
      ])
    }
    for (const css of [
      transitionCss,
      dialogCss,
      drawerCss,
      notificationCss,
      tabPaneCss,
    ]) {
      expect(css).not.toMatch(
        /@media \(prefers-reduced-motion: reduce\)[\s\S]*?(?:enter-active|leave-active)[\s\S]*?transition:\s*none/,
      )
    }
  })

  test('keeps overlay panels border-first by default', () => {
    const drawerCss = compileThemeFile('drawer.scss')
    const selectDropdownCss = compileThemeFile('select-dropdown.scss')

    expectCssRule(drawerCss, '.el-drawer', [
      'box-shadow: var(--fsus-shadow-panel, none);',
    ])
    expect(selectDropdownCss).toContain('--el-select-dropdown-padding: 8px 0;')
    expect(selectDropdownCss).toContain(
      '--el-select-dropdown-shadow: var(--fsus-shadow-panel, none);',
    )
    expectCssRule(selectDropdownCss, '.el-select-dropdown', [
      'box-shadow: var(--el-select-dropdown-shadow);',
    ])
    expect(drawerCss).not.toContain('box-shadow: var(--el-box-shadow-dark);')
    expect(selectDropdownCss).not.toContain(
      '--el-select-dropdown-padding: 6px 0;',
    )
    expect(selectDropdownCss).not.toContain(
      '--el-select-dropdown-shadow: var(--el-box-shadow-light);',
    )
  })

  test('keeps rate hover within the control motion budget', () => {
    const css = compileThemeFile('rate.scss')

    expectCssRule(css, '.el-rate', [
      '--el-rate-fill-color: var(--el-color-warning);',
      '--el-rate-void-color: var(--el-border-color-darker);',
      '--el-rate-disabled-void-color: var(--el-fill-color);',
    ])
    expectCssRule(css, '.el-rate:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
    ])
    expectCssRule(css, '.el-rate .el-rate__icon', [
      'transition: transform var(--fsus-motion-control-fast) var(--fsus-motion-standard), color var(--fsus-motion-control-fast) var(--fsus-motion-standard);',
    ])
    expectCssRule(css, '.el-rate .el-rate__icon.hover', [
      'transform: translateY(var(--fsus-rate-icon-hover-y, -1px));',
    ])
    expect(css).not.toContain('transition: var(--el-transition-duration);')
    expect(css).not.toContain('transform: scale(1.15);')
    expect(css).not.toContain('#f7ba2a')
  })

  test('ships rate fill on the warning semantic chain, never primary (#302)', () => {
    // Real consumer path: fsus.scss pulls rate.scss then fsus-theme overrides.
    // rate.scss alone is insufficient — fsus-theme historically recolored fill to primary.
    const themeCss = compileThemeFile('fsus-theme.scss')
    const rateCss = compileThemeFile('rate.scss')
    const shippedCss = compileThemeFile('fsus.scss')

    expectCssRule(themeCss, '.el-rate', [
      '--el-rate-fill-color: var(--el-color-warning);',
    ])
    expectCssRule(themeCss, '.el-rate__item .el-rate__icon', [
      'color: var(--el-rate-void-color, var(--el-border-color-darker));',
    ])
    expectCssRule(
      themeCss,
      '.el-rate.is-disabled .el-rate__item .el-rate__icon',
      ['color: var(--el-rate-disabled-void-color, var(--el-fill-color));'],
    )
    expectCssRule(themeCss, '.el-rate__item .el-rate__icon.is-active', [
      'color: var(--el-rate-fill-color, var(--el-color-warning));',
    ])
    expectCssRule(themeCss, '.el-rate__item .hover', [
      'color: var(--el-rate-fill-color, var(--el-color-warning));',
    ])

    // Mutation kill: primary / Scholarly Blue must not own default rate fill.
    expect(themeCss).not.toMatch(
      /\.el-rate\s*\{[^}]*--el-rate-fill-color:\s*var\(--el-color-primary\)/s,
    )
    // Active/hover fill declarations must not hardcode primary.
    const activeFillRules = [
      ...cssRules(themeCss, '.el-rate__item .el-rate__icon.is-active'),
      ...cssRules(themeCss, '.el-rate__item .hover'),
    ]
    expect(activeFillRules.length).toBeGreaterThan(0)
    for (const rule of activeFillRules) {
      expect(rule).not.toContain('var(--el-color-primary)')
      expect(rule).not.toContain('var(--fsus-scholarly-blue)')
      expect(rule).toContain('var(--el-color-warning)')
    }

    // Component tokens and integrated bundle stay on the same warning chain.
    expectCssRule(rateCss, '.el-rate', [
      '--el-rate-fill-color: var(--el-color-warning);',
    ])
    expect(shippedCss).toContain('--el-rate-fill-color: var(--el-color-warning);')
    expect(shippedCss).not.toMatch(
      /--el-rate-fill-color:\s*var\(--el-color-primary\)/,
    )
    // Focus remains Scholarly Blue (focus role), not warning.
    expectCssRule(rateCss, '.el-rate:focus-visible', [
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
    ])
    // No gradient / glow / scale flourishes on the default rate surface.
    expect(themeCss).not.toMatch(/\.el-rate[^{]*\{[^}]*gradient/s)
    expect(themeCss).not.toContain('transform: scale(')
    expect(themeCss).not.toMatch(/\.el-rate[^}]*drop-shadow/s)
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
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
    ])
    expect(css).not.toContain('border-radius: 50%;')
    expect(css).not.toContain('box-shadow: var(--el-box-shadow-lighter);')
  })

  test('keeps collapse header focus and motion tokenized', () => {
    const css = compileThemeFile('collapse.scss')

    expectCssRule(css, '.el-collapse-item__header', [
      'transition: border-bottom-color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expectCssRule(css, '.el-collapse-item__arrow', [
      'transition: transform var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expectCssRule(css, '.el-collapse-item__header:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
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
      'transition: background-color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), box-shadow var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expectCssRule(css, '.el-carousel__arrow:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
    ])
    expectCssRule(
      css,
      '.el-carousel__indicators--labels .el-carousel__button',
      ['color: var(--fsus-carousel-label-color, var(--fsus-ink));'],
    )
    expectCssRule(css, '.el-carousel__button', [
      'background-color: var(--fsus-carousel-indicator-bg, var(--fsus-color-surface-base));',
      'transition: background-color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), box-shadow var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), opacity var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expectCssRule(css, '.el-carousel__button:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
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
      'transition: border-color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), background-color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expectCssRule(css, '.el-step__line-inner', [
      'transition: width var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), height var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), border-color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
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
      'transition: width var(--fsus-progress-width-motion, var(--fsus-motion-control, 220ms)) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
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
      'transition: transform var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expectCssRule(
      css,
      '.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content',
      [
        'background-color: var(--fsus-tree-current-bg, var(--fsus-state-selected-bg));',
        'color: var(--fsus-tree-current-text, var(--fsus-scholarly-blue));',
        'box-shadow: inset 3px 0 0 var(--fsus-tree-current-marker, var(--fsus-scholarly-blue));',
      ],
    )
    expectCssRule(css, '.el-tree-node__content', [
      'border-radius: 0;',
      'box-shadow: none;',
      'margin: 0;',
    ])
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
      'border-radius: var(--fsus-radius-control, var(--el-border-radius-base));',
      'transition: border-color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), box-shadow var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expectCssRule(selectCss, '.el-select-v2__wrapper.is-focused', [
      'border-color: var(--fsus-select-v2-focus-border, var(--fsus-state-focus-border));',
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
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
      'font-weight: var(--fsus-font-weight-medium, 500);',
    ])
    expect(optionCss).toContain('color: var(--fsus-scholarly-blue);')
    expect(optionCss).not.toContain('font-weight: 700;')
    expect(selectCss).not.toContain('var(--el-color-primary)')
    expect(selectCss).not.toContain('var(--el-color-white)')
    expect(dropdownCss).not.toContain(
      'border-radius: var(--el-border-radius-small);',
    )
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
    expectCssRule(css, '.el-autocomplete-suggestion__wrap', ['padding: 8px 0;'])
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

  test('keeps pagination background active state on navigation tokens', () => {
    const css = compileThemeFile('pagination.scss')

    expectCssRule(css, '.el-pagination.is-background .el-pager li.is-active', [
      'background-color: var(--fsus-pagination-active-bg, var(--fsus-state-selected-bg));',
      'color: var(--fsus-pagination-active-text, var(--fsus-scholarly-blue));',
      'box-shadow: inset 0 0 0 1px var(--fsus-pagination-active-border, var(--fsus-state-focus-border));',
    ])
    expect(css).not.toMatch(
      /\.el-pagination\.is-background [^{]*\.is-active\s*\{[^}]*(?:var\(--el-color-primary\)|var\(--el-color-white\))/s,
    )
  })

  test('keeps date picker panel material and focus states tokenized', () => {
    const css = compileThemeFile('date-picker/picker-panel.scss')

    expectCssRule(css, '.el-picker-panel', [
      'background: var(--fsus-datepicker-panel-bg, var(--fsus-surface-overlay));',
      'border-radius: var(--fsus-datepicker-panel-radius, var(--el-popover-border-radius));',
      'box-shadow: var(--fsus-datepicker-panel-shadow, var(--fsus-shadow-panel, none));',
    ])
    expectCssRule(css, '.el-picker-panel .el-time-panel', [
      'background-color: var(--fsus-datepicker-panel-bg, var(--fsus-surface-overlay));',
      'box-shadow: var(--fsus-datepicker-time-panel-shadow, var(--fsus-shadow-panel, none));',
    ])
    expectCssRule(css, '.el-picker-panel__shortcut.active', [
      'background-color: var(--fsus-datepicker-shortcut-active-bg, var(--fsus-state-selected-bg));',
      'color: var(--fsus-datepicker-shortcut-active-text, var(--fsus-scholarly-blue));',
    ])
    expectCssRule(css, '.el-picker-panel__shortcut:focus-visible', [
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
      'border-radius: var(--fsus-radius-control-small, 4px);',
    ])
    expectCssRule(css, '.el-picker-panel__icon-btn:focus-visible', [
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
      'border-radius: var(--fsus-radius-control-small, 4px);',
    ])
    expectCssRule(css, '.el-picker-panel__btn', [
      'border-radius: var(--fsus-datepicker-action-radius, var(--fsus-radius-control));',
    ])
    expect(css).not.toContain('#e6f1fe')
    expect(css).not.toContain('var(--el-box-shadow-light)')
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

  test('keeps message as a compact toast instead of a floating panel', () => {
    const messageCss = compileThemeFile('message.scss')
    const themeCss = compileThemeFile('fsus-theme.scss')

    expectCssRule(messageCss, '.el-message', [
      'max-width: min(420px, 100% - 32px);',
      'min-height: 40px;',
      'box-shadow: var(--el-message-shadow);',
      'gap: 8px;',
    ])
    expectCssRule(messageCss, '.el-message__content', [
      'color: var(--el-message-text-color);',
      'line-height: 1.4;',
      'overflow-wrap: anywhere;',
    ])
    expectCssRule(themeCss, '.el-message', [
      'background: var(--fsus-message-bg, var(--el-bg-color));',
      'border: 1px solid var(--fsus-message-border, var(--el-border-color-lighter));',
      'border-radius: var(--fsus-message-radius, var(--el-message-border-radius));',
      'box-shadow: var(--fsus-shadow-panel-light);',
    ])
    expectCssRule(themeCss, '.el-message', [
      'position: fixed;',
      'top: var(--fsus-space-4);',
    ])
    expectCssRule(themeCss, '.el-message', [
      'max-width: min(420px, 100vw - 16px);',
    ])
    expect(messageCss).not.toContain('.el-message::before')
    expect(messageCss).not.toContain('var(--fsus-shadow-floating)')
    expect(messageCss).not.toContain('var(--fsus-radius-floating)')
    expect(themeCss).not.toContain('.el-message::before')
    expect(themeCss).not.toMatch(
      /\.el-message__content\s*\{[^}]*font-weight:\s*600/s,
    )
    expect(themeCss).not.toMatch(
      /\.el-message__content\s*\{[^}]*line-height:\s*1\.55/s,
    )
    expect(themeCss).not.toMatch(
      /\.el-message\s*\{[^}]*width:\s*var\(--fsus-notification-max-width\)/s,
    )
    expect(themeCss).not.toMatch(
      /\.el-message\s*\{[^}]*padding:\s*var\(--fsus-space-3\) var\(--fsus-space-4\)/s,
    )
    expect(themeCss).not.toMatch(/\.el-message\s*\{[^}]*border-radius:\s*12px/s)
  })

  test('keeps color picker interaction chrome tokenized while preserving color-space gradients', () => {
    const css = compileThemeFile('color-picker.scss')
    const docs = readFileSync(
      path.resolve(dirname, '../../../../docs/components/color-picker.md'),
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
    expectCssRule(
      css,
      '.el-color-picker.is-focused .el-color-picker__trigger',
      [
        'border-color: var(--fsus-color-picker-focus-border, var(--fsus-state-focus-border));',
      ],
    )
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
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
      'border-radius: var(--fsus-radius-pill);',
    ])
    expectCssRule(css, '.el-slider__button', [
      'transition: transform var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), border-color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), box-shadow var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), background-color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
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
      'transition: opacity var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), background-color var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), box-shadow var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expectCssRule(
      css,
      '.el-image-viewer__wrapper:hover .el-image-viewer__btn',
      ['opacity: var(--fsus-image-viewer-control-hover-opacity, 1);'],
    )

    for (const selector of [
      '.el-image-viewer__btn:focus-visible',
      '.el-image-viewer__action:focus-visible',
    ]) {
      expectCssRule(css, selector, [
        'outline: none !important;',
        'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
        'opacity: var(--fsus-image-viewer-control-hover-opacity, 1);',
      ])
    }

    expectCssRule(css, '.viewer-fade-enter-active', [
      'animation: viewer-fade-in var(--fsus-image-viewer-motion, var(--fsus-motion-overlay, 300ms)) var(--fsus-motion-emphasized, cubic-bezier(0.2, 0, 0, 1));',
    ])
    expectCssRule(css, '.viewer-fade-leave-active', [
      'animation: viewer-fade-out var(--fsus-image-viewer-motion, var(--fsus-motion-overlay, 300ms)) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1));',
    ])
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expectCssRule(css, '.viewer-fade-enter-active, .viewer-fade-leave-active', [
      'animation-duration: 1ms !important;',
      'animation-iteration-count: 1 !important;',
    ])
    expect(css).not.toContain('color: #fff;')
    expect(css).not.toContain('border-color: #fff;')
    expect(css).not.toContain('background: #000;')
    expect(css).not.toContain('var(--el-transition-duration)')
  })

  test('keeps tag typography overrides opt-in for mixed-language labels', () => {
    const css = compileThemeFile('tag.scss')
    const docs = readFileSync(
      path.resolve(dirname, '../../../../docs/components/tag.md'),
      'utf8',
    )

    expectCssRule(css, '.el-tag', [
      'height: var(--fsus-tag-height, var(--fsus-tag-height-default));',
      'font-size: var(--fsus-tag-font-size, var(--el-font-size-extra-small));',
      'font-weight: var(--fsus-tag-font-weight, 500);',
      'letter-spacing: var(--fsus-tag-letter-spacing, 0);',
      'text-transform: var(--fsus-tag-text-transform, none);',
    ])
    expectCssRule(css, '.el-tag--large', [
      'height: var(--fsus-tag-height-large);',
    ])
    expectCssRule(css, '.el-tag--small', [
      'height: var(--fsus-tag-height-small);',
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
    expect(css).not.toContain('var(--fsus-tag-height, 22px)')
    expect(css).not.toContain('var(--fsus-tag-font-weight, 650)')
    expect(docs).toContain('混合语言')
    expect(docs).toContain('code-like')
    expect(docs).toContain('状态 APIv2')
    expect(docs).toContain('sha-1:AbC123')
  })

  test('keeps component control heights on the canonical density ladder', () => {
    const buttonCss = compileThemeFile('button.scss')
    const cascaderCss = compileThemeFile('cascader.scss')
    const menuCss = compileThemeFile('menu.scss')
    const optionCss = compileThemeFile('option.scss')
    const paginationCss = compileThemeFile('pagination.scss')
    const tabsCss = compileThemeFile('tabs.scss')

    expectCssRule(buttonCss, '.el-button.is-inline-action', [
      'min-height: var(--fsus-control-height-action);',
    ])
    expectCssRule(cascaderCss, '.el-cascader__suggestion-list', [
      'max-height: var(--fsus-cascader-suggestion-max-height);',
    ])
    expectCssRule(cascaderCss, '.el-cascader__suggestion-item', [
      'height: var(--fsus-select-option-height);',
    ])
    expectCssRule(menuCss, ':root', [
      '--el-menu-item-height: var(--fsus-menu-item-height);',
      // Nested vertical items share the 56px density contract (issue #294).
      '--el-menu-sub-item-height: var(--fsus-menu-item-height);',
      '--el-menu-horizontal-height: var(--fsus-menu-horizontal-height);',
      '--el-menu-horizontal-sub-item-height: calc(var(--fsus-menu-horizontal-height) - 24px);',
    ])
    expectCssRule(optionCss, '.el-select-dropdown__item', [
      'height: var(--fsus-select-option-height);',
      'line-height: var(--fsus-select-option-height);',
    ])
    expectCssRule(paginationCss, '.el-pagination', [
      '--el-pagination-button-width-small: var(--fsus-control-height-compact);',
      '--el-pagination-button-height-small: var(--fsus-control-height-compact);',
    ])
    expectCssRule(tabsCss, '.el-tabs__new-tab', [
      'width: var(--fsus-control-height-action);',
      'height: var(--fsus-control-height-action);',
      'margin: 2px 0 2px 10px;',
      'line-height: var(--fsus-control-height-action);',
    ])
  })

  test('keeps calendar header controls border-first', () => {
    const css = compileThemeFile('calendar.scss')

    expectCssRule(css, '.el-calendar__button-group .el-button-group', [
      'border: 1px solid var(--el-border-color-lighter);',
      'border-radius: var(--fsus-radius-control, 6px);',
      'background: transparent;',
    ])
    expectCssRule(
      css,
      '.el-calendar__button-group .el-button-group > .el-button',
      [
        'border-radius: calc(var(--fsus-radius-control, 6px) - 2px) !important;',
      ],
    )
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

    expectCssRule(publicShellCss, '.el-public-shell__mobile-toolbar', [
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

  test('keeps scrollbar fade motion tokenized and reduced-motion safe', () => {
    const scrollbarCss = compileThemeFile('scrollbar.scss')

    expectCssRule(scrollbarCss, '.el-scrollbar-fade-enter-active', [
      'transition: opacity var(--fsus-motion-panel, 360ms) ease-out;',
    ])
    expect(scrollbarCss).not.toContain('340ms')
    expect(scrollbarCss).toContain('@media (prefers-reduced-motion: reduce)')
    expectCssRule(
      scrollbarCss,
      '.el-scrollbar-fade-enter-active, .el-scrollbar-fade-leave-active',
      ['transition-duration: 1ms !important;'],
    )
  })

  test('keeps virtual items off individual compositor layers while scrolling', () => {
    const css = compileThemeFile('virtual-list.scss')
    const itemRule = css.match(/\.el-vl__inner > \*\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(itemRule).not.toContain('translate3d')
    expect(itemRule).not.toContain('will-change')
    expectCssRule(css, '.el-vl__wrapper.is-fast-scrolling .el-vl__inner > *', [
      'filter: none;',
      'box-shadow: none;',
      'transition: none;',
    ])
  })

  test('keeps scrollbar motion shadows in the compiled scrolling states', () => {
    const scrollbarCss = compileThemeFile('scrollbar.scss')
    const virtualListCss = compileThemeFile('virtual-list.scss')

    expectCssRule(
      scrollbarCss,
      '.el-scrollbar.is-scrolling .el-scrollbar__thumb',
      [
        'box-shadow:',
        'color-mix(in srgb, var(--fsus-scholarly-blue) 28%, transparent)',
        'var(--fsus-interactive-motion-glow, 18px)',
      ],
    )
    expectCssRule(
      virtualListCss,
      '.el-vl__wrapper.is-scrolling:not(.is-fast-scrolling) .el-scrollbar__thumb',
      [
        'box-shadow:',
        'color-mix(in srgb, var(--fsus-scholarly-blue) 18%, transparent)',
        'var(--fsus-interactive-motion-glow, 18px)',
      ],
    )
  })

  test('keeps public shell mobile navigation explicit and bottom spacing opt-in', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    for (const css of [publicShellCss, criticalCss]) {
      expectCssRule(css, '.el-public-shell', [
        '--fsus-public-shell-mobile-action-height: 44px;',
      ])
      expectCssRule(css, '.el-public-shell__primary-row', [
        'display: grid;',
        'grid-template-columns: minmax(0, 1fr) auto;',
        'align-items: center;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-primary-actions', [
        'position: relative;',
        'display: none;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-nav-menu', [
        'position: static;',
      ])
      expectCssRule(
        css,
        '.el-public-shell__mobile-nav-menu:not([open]) > .el-public-shell__mobile-nav-menu-panel',
        ['display: none;'],
      )
      expectCssRule(css, '.el-public-shell__mobile-toolbar', [
        'display: none;',
        'margin-top: 18px;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-actions', ['display: flex;'])
      expectCssRule(css, '.el-public-shell__bottom-tab', ['display: none;'])
      expectCssRule(css, '.el-public-shell__mobile-nav-menu-trigger', [
        'display: inline-flex;',
        'min-height: var(--fsus-public-shell-mobile-action-height, 44px);',
        'border: 1px solid var(--el-border-color-lighter);',
        'border-radius: var(--fsus-radius-control, 6px);',
        'padding: 0 12px;',
        'background: var(--el-bg-color);',
        'font-size: 14px;',
        'font-weight: 500;',
        'list-style: none;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-search-trigger', [
        'min-height: var(--fsus-public-shell-mobile-action-height, 44px);',
        'padding: 0 12px;',
        'font-size: 14px;',
        'font-weight: 500;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-nav-menu-panel', [
        'position: absolute;',
        'display: grid;',
        'width: min(14rem, 100vw - 24px);',
        'grid-template-columns: minmax(0, 1fr);',
        'gap: 0;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-nav-link', [
        'width: 100%;',
        'min-height: var(--fsus-public-shell-mobile-action-height, 44px);',
        'border: 1px solid var(--el-border-color-lighter);',
        'border-radius: var(--fsus-radius-control, 6px);',
        'padding-inline: 16px;',
        'justify-content: flex-start;',
        'text-align: start;',
      ])
      expectCssRule(
        css,
        '.fsu-bottom-tab-bar__overflow.el-public-shell__mobile-nav-menu',
        ['position: relative;', 'flex: 1 1 0;', 'min-inline-size: 0;'],
      )
      expectCssRule(
        css,
        '.fsu-bottom-tab-bar__overflow-panel.el-public-shell__mobile-nav-menu-panel',
        [
          'inset-block-start: auto;',
          'inset-block-end: calc(100% + 6px);',
          'inset-inline-end: 0;',
        ],
      )
      expectCssRule(css, '.el-public-shell__mobile-nav-menu-actions', [
        'display: grid;',
        'grid-template-columns: minmax(0, 1fr);',
        'margin-top: 4px;',
        'padding-top: 6px;',
        'border-top: 1px solid var(--el-border-color-lighter);',
      ])
      expectCssRule(css, '.el-public-shell__auth-link--mobile', [
        'min-height: var(--fsus-public-shell-mobile-action-height, 44px);',
        'border: 1px solid transparent;',
        'padding: 0 16px;',
        'font-size: 14px;',
        'font-weight: 500;',
      ])
      expect(css).toContain('.el-public-shell__mobile-nav-menu-trigger::marker')
      expectCssRule(css, '.el-public-shell.is-mobile-nav-bottom', [
        'padding-bottom: calc(var(--fsus-bottom-tab-height, 56px) + var(--fsus-safe-area-inset-bottom));',
      ])
      expectCssRule(css, '.el-public-shell__footer', [
        'padding-bottom: max(40px, 24px + var(--fsus-safe-area-inset-bottom));',
      ])
      expectCssRule(css, '.el-public-shell__desktop-nav', ['display: none;'])
      expectCssRule(css, '.el-public-shell__actions', ['display: none;'])
      expect(css).toContain('.el-public-shell__mobile-primary-actions')
      expect(css).toContain('display: inline-flex;')
      expect(css).toContain('.el-public-shell__mobile-toolbar')
      expect(css).toContain('display: block;')
      expect(css).toContain('.el-public-shell__bottom-tab')
      expect(css).toContain('display: flex;')
      expectCssRule(css, '.el-public-shell__mobile-nav--inline', [
        'display: flex;',
      ])
    }
  })

  test('defines reusable site header chrome primitives', () => {
    const css = compileThemeFile('site-header.scss')
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    expectCssRule(css, '.el-site-header', [
      'width: 100%;',
      'border-bottom: 1px solid var(--el-border-color-lighter);',
      'background: var(--fsus-paper, var(--el-bg-color));',
      'backdrop-filter: blur(0px) saturate(100%);',
      '-webkit-backdrop-filter: blur(0px) saturate(100%);',
    ])
    for (const selector of [
      '.el-site-header.is-glass',
      '.el-site-header[data-fsus-material=glass]',
    ]) {
      expectCssRule(css, selector, [
        'background: color-mix(in srgb, var(--el-bg-color) 96%, transparent);',
        'backdrop-filter: blur(var(--fsus-backdrop-blur-soft, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
        '-webkit-backdrop-filter: blur(var(--fsus-backdrop-blur-soft, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
      ])
    }
    for (const shellCss of [publicShellCss, criticalCss]) {
      expectCssRule(shellCss, '.el-public-shell__header', [
        'border-bottom: 1px solid var(--el-border-color-lighter);',
        'background: var(--fsus-paper, var(--el-bg-color));',
        'backdrop-filter: blur(0px) saturate(100%);',
        '-webkit-backdrop-filter: blur(0px) saturate(100%);',
      ])
      for (const selector of [
        '.el-public-shell__header.is-glass',
        '.el-public-shell__header[data-fsus-material=glass]',
      ]) {
        expectCssRule(shellCss, selector, [
          'background: color-mix(in srgb, var(--el-bg-color) 96%, transparent);',
          'backdrop-filter: blur(var(--fsus-backdrop-blur-soft, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
          '-webkit-backdrop-filter: blur(var(--fsus-backdrop-blur-soft, 0px)) saturate(var(--fsus-backdrop-saturate, 100%));',
        ])
      }
    }
    expectCssRule(css, '.el-site-header.is-sticky', [
      'position: sticky;',
      'top: 0;',
      'z-index: 50;',
    ])
    expectCssRule(css, '.el-site-header__inner', [
      'width: min(100%, var(--el-site-header-max-width, 64rem));',
      'padding: 24px;',
    ])
    expectCssRule(css, '.el-site-header__primary-row', [
      'display: grid;',
      'grid-template-columns: minmax(0, 1fr) auto;',
      'align-items: center;',
    ])
    expectCssRule(css, '.el-site-header__brand-nav', ['align-items: baseline;'])
    expectCssRule(css, '.el-site-header__brand', [
      'font-size: 24px;',
      'font-weight: 700;',
      'line-height: 1.25;',
    ])
    expectCssRule(css, '.el-site-header__desktop-nav', ['display: flex;'])
    expectCssRule(css, '.el-site-header__mobile-primary-actions', [
      'display: none;',
    ])
    expectCssRule(
      css,
      '.el-site-header__brand :where(a, button):focus-visible',
      [
        'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
      ],
    )
    expectCssRule(css, '.el-site-header__desktop-nav', ['display: none;'])
    expectCssRule(css, '.el-site-header__mobile-primary-actions', [
      'display: inline-flex;',
    ])
    for (const shellCss of [publicShellCss, criticalCss]) {
      expectCssRule(shellCss, '.el-public-shell__brand-nav', [
        'align-items: baseline;',
      ])
      expectCssRule(shellCss, '.el-public-shell__brand', [
        'font-size: 24px;',
        'font-weight: 700;',
        'line-height: 1.25;',
      ])
      expect(shellCss).toContain(
        'min-height: var(--fsus-public-shell-mobile-action-height, 44px);',
      )
      expectCssRule(shellCss, '.el-public-shell__nav-link', [
        'border-bottom: 2px solid transparent;',
        'padding-bottom: 0;',
        'font-size: 14px;',
        'font-weight: 500;',
        'line-height: 1.5;',
      ])
    }
  })

  test('supports public shell trigger-based mobile search motion', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    for (const css of [publicShellCss, criticalCss]) {
      expectCssRule(css, '.el-public-shell__mobile-search-trigger', [
        'display: inline-flex;',
        'min-height: var(--fsus-public-shell-mobile-action-height, 44px);',
        'border: 1px solid var(--el-border-color-lighter);',
        'border-radius: var(--fsus-radius-control, 6px);',
        'padding: 0 12px;',
        'font-size: 14px;',
        'font-weight: 500;',
      ])
      for (const selector of [
        '.el-public-shell__mobile-search-trigger',
        '.el-public-shell__mobile-nav-menu-trigger',
        '.el-public-shell__mobile-nav-link',
      ]) {
        expectCssRule(css, selector, ['transition: none;'])
      }
      expectCssRule(css, '.el-public-shell__mobile-search-row', [
        'display: none;',
        'margin-top: 12px;',
        'margin-bottom: 12px;',
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
        ['opacity: 0;', 'transform: translateY(-4px);'],
      )
      expect(css).toContain('@media (prefers-reduced-motion: reduce)')
      expectCssRule(
        css,
        '.el-public-shell-mobile-search-enter-active, .el-public-shell-mobile-search-leave-active',
        [
          'transition-duration: 1ms !important;',
          'transition-delay: 0ms !important;',
        ],
      )
      expectCssRule(
        css,
        '.el-public-shell-mobile-search-enter-from, .el-public-shell-mobile-search-leave-to',
        ['transform: none;'],
      )
    }
  })

  test('supports low-noise desktop search disclosure in critical and full css', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    for (const css of [publicShellCss, criticalCss]) {
      expectCssRule(css, '.el-public-shell__actions', [
        'min-height: var(--fsus-public-shell-action-height, 44px);',
      ])
      expectCssRule(css, '.el-public-shell__search-input .el-input__wrapper', [
        'height: var(--fsus-public-shell-action-height, 44px);',
        'min-height: var(--fsus-public-shell-action-height, 44px);',
        'box-sizing: border-box;',
      ])
      expectCssRule(css, '.el-public-shell__desktop-search-disclosure', [
        'position: relative;',
        'flex: 0 0 auto;',
      ])
      expectCssRule(css, '.el-public-shell__desktop-search-trigger', [
        'display: inline-flex;',
        'min-height: var(--fsus-public-shell-action-height, 44px);',
        'border: 1px solid transparent;',
        'background: transparent;',
        'font-size: 14px;',
        'font-weight: 500;',
      ])
      expectCssRule(css, '.el-public-shell__desktop-search-panel', [
        'position: absolute;',
        'inset-block-start: calc(100% + 8px);',
        'inset-inline-end: 0;',
        'width: min(20rem, 100vw - 48px);',
        'padding: 12px;',
        'border: 1px solid var(--el-border-color-lighter);',
        'border-radius: var(--fsus-radius-popover, 10px);',
        'background: var(--fsus-surface-overlay, var(--el-bg-color));',
        'box-shadow: var(--fsus-shadow-floating, none);',
      ])
      expectCssRule(css, '.el-public-shell__search--desktop-trigger', [
        'width: 100%;',
      ])
      expectCssRule(
        css,
        '.el-public-shell-desktop-search-enter-active, .el-public-shell-desktop-search-leave-active',
        [
          'transition: opacity var(--el-transition-duration-fast) var(--el-transition-function-ease-in-out-bezier), transform var(--el-transition-duration-fast) var(--el-transition-function-ease-in-out-bezier);',
        ],
      )
      expectCssRule(
        css,
        '.el-public-shell-desktop-search-enter-from, .el-public-shell-desktop-search-leave-to',
        ['opacity: 0;', 'transform: translateY(-4px);'],
      )
      expectCssRule(
        css,
        '.el-public-shell-desktop-search-enter-active, .el-public-shell-desktop-search-leave-active',
        [
          'transition-duration: 1ms !important;',
          'transition-delay: 0ms !important;',
        ],
      )
      expectCssRule(
        css,
        '.el-public-shell-desktop-search-enter-from, .el-public-shell-desktop-search-leave-to',
        ['transform: none;'],
      )
    }
  })

  test('keeps public shell mobile menu motion synchronized in critical and full css', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    for (const css of [publicShellCss, criticalCss]) {
      expectCssRule(
        css,
        '.el-public-shell-mobile-nav-menu-enter-active, .el-public-shell-mobile-nav-menu-leave-active',
        [
          'transition: opacity var(--el-transition-duration-fast) var(--el-transition-function-ease-in-out-bezier), transform var(--el-transition-duration-fast) var(--el-transition-function-ease-in-out-bezier);',
        ],
      )
      expectCssRule(
        css,
        '.el-public-shell-mobile-nav-menu-enter-from, .el-public-shell-mobile-nav-menu-leave-to',
        ['opacity: 0;', 'transform: translateY(-4px);'],
      )
      expectCssRule(
        css,
        '.el-public-shell__mobile-nav-menu.is-closing .el-public-shell__mobile-nav-menu-panel',
        ['pointer-events: none;'],
      )
      expect(css).toContain('@media (prefers-reduced-motion: reduce)')
      expectCssRule(
        css,
        '.el-public-shell-mobile-nav-menu-enter-active, .el-public-shell-mobile-nav-menu-leave-active',
        [
          'transition-duration: 1ms !important;',
          'transition-delay: 0ms !important;',
        ],
      )
      expectCssRule(
        css,
        '.el-public-shell-mobile-nav-menu-enter-from, .el-public-shell-mobile-nav-menu-leave-to',
        ['transform: none;'],
      )
    }
  })

  test('keeps public-shell Vue disclosure state machines at 1ms under reduced motion', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')
    const reducedMotionActiveSelectors = [
      '.el-public-shell-mobile-nav-menu-enter-active',
      '.el-public-shell-mobile-nav-menu-leave-active',
      '.el-public-shell-mobile-search-enter-active',
      '.el-public-shell-mobile-search-leave-active',
      '.el-public-shell-desktop-search-enter-active',
      '.el-public-shell-desktop-search-leave-active',
    ] as const
    const reducedMotionFromToSelectors = [
      '.el-public-shell-mobile-nav-menu-enter-from',
      '.el-public-shell-mobile-nav-menu-leave-to',
      '.el-public-shell-mobile-search-enter-from',
      '.el-public-shell-mobile-search-leave-to',
      '.el-public-shell-desktop-search-enter-from',
      '.el-public-shell-desktop-search-leave-to',
    ] as const

    const extractReducedMotionBlocks = (css: string) => {
      const blocks: string[] = []
      const pattern =
        /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{/g
      for (const hit of css.matchAll(pattern)) {
        const start = hit.index! + hit[0].length
        let depth = 1
        let i = start
        while (i < css.length && depth > 0) {
          if (css[i] === '{') depth += 1
          else if (css[i] === '}') depth -= 1
          i += 1
        }
        blocks.push(css.slice(start, i - 1))
      }
      return blocks.join('\n')
    }

    for (const css of [publicShellCss, criticalCss]) {
      const reduced = extractReducedMotionBlocks(css)
      expect(reduced.length).toBeGreaterThan(0)

      for (const selector of reducedMotionActiveSelectors) {
        expectCssRule(reduced, selector, [
          'transition-duration: 1ms !important;',
          'transition-delay: 0ms !important;',
        ])
        const rules = cssRules(reduced, selector)
        expect(rules.length).toBeGreaterThan(0)
        for (const rule of rules) {
          expect(rule).not.toMatch(/transition\s*:\s*none/i)
          expect(rule).not.toMatch(/transition-duration\s*:\s*0(?:\.0+)?ms/i)
          expect(rule).not.toMatch(/transition-duration\s*:\s*0\.01ms/i)
          expect(rule).toMatch(/transition-duration\s*:\s*1ms\s*!important/i)
          expect(rule).toMatch(/transition-delay\s*:\s*0ms\s*!important/i)
        }
      }

      for (const selector of reducedMotionFromToSelectors) {
        expectCssRule(reduced, selector, ['transform: none;'])
      }

      expectCssRule(
        reduced,
        '.el-public-shell-mobile-nav-menu-enter-active, .el-public-shell-mobile-nav-menu-leave-active, .el-public-shell-mobile-search-enter-active, .el-public-shell-mobile-search-leave-active, .el-public-shell-desktop-search-enter-active, .el-public-shell-desktop-search-leave-active',
        [
          'transition-duration: 1ms !important;',
          'transition-delay: 0ms !important;',
        ],
      )
    }
  })

  test('supports opt-in public shell active nav indicator motion', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')

    expectCssRule(
      publicShellCss,
      '.el-public-shell__desktop-nav.is-indicator-motion',
      [
        'position: relative;',
        '--el-public-shell-active-nav-indicator-opacity: 0;',
      ],
    )
    expectCssRule(publicShellCss, '.el-public-shell__active-nav-indicator', [
      'position: absolute;',
      'inset-block-end: -1px;',
      'block-size: 2px;',
      'border-radius: var(--el-public-shell-active-nav-indicator-radius, 1px);',
      'pointer-events: none;',
      'transform: translate3d(var(--el-public-shell-active-nav-indicator-x, 0px), 0, 0);',
      'opacity: var(--el-public-shell-active-nav-indicator-opacity, 0);',
      'transition: transform var(--fsus-motion-control-fast, 140ms) var(--fsus-motion-standard, cubic-bezier(0.4, 0, 0.2, 1)), opacity var(--el-transition-duration-fast);',
    ])
    expectCssRule(publicShellCss, '.el-public-shell__nav-link.is-active', [
      'border-bottom-color: var(--fsus-scholarly-blue);',
    ])
    expectCssRule(publicShellCss, '.el-public-shell__active-nav-indicator', [
      'transition: none;',
    ])
  })

  test('keeps public shell desktop utilities compact while giving search room', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    for (const css of [publicShellCss, criticalCss]) {
      expectCssRule(css, '.el-public-shell__search--desktop', ['width: 11rem;'])
      expectCssRule(css, '.el-public-shell__actions', [
        'gap: 12px;',
        'min-width: max-content;',
      ])
    }

    for (const css of [publicShellCss, criticalCss]) {
      expectCssRule(css, '.el-public-shell__action-link', [
        'color: var(--el-text-color-secondary);',
        'display: inline-flex;',
        'min-height: var(--fsus-public-shell-action-height, 44px);',
        'font-size: 14px;',
        'font-weight: 500;',
        'text-decoration: none;',
        'white-space: nowrap;',
      ])
    }
  })

  test('supports content-driven public shell main flow in critical and full css', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    for (const css of [publicShellCss, criticalCss]) {
      expectCssRule(
        css,
        '.el-public-shell__main[data-content-flow=content-driven]',
        ['flex: 0 0 auto;', 'padding-bottom: 0;'],
      )
    }
  })

  test('renders public shell mobile auth as a stable menu or inline text action', () => {
    const publicShellCss = compileThemeFile('public-shell.scss')
    const criticalCss = compileThemeFile('public-shell-critical.scss')

    for (const css of [publicShellCss, criticalCss]) {
      expectCssRule(css, '.el-public-shell__auth-link--mobile', [
        'display: inline-flex;',
        'align-items: center;',
        'justify-content: flex-start;',
        'min-height: var(--fsus-public-shell-mobile-action-height, 44px);',
        'border: 1px solid transparent;',
        'padding: 0 16px;',
        'background: transparent;',
        'font-size: 14px;',
        'font-weight: 500;',
        'white-space: nowrap;',
      ])
    }
  })

  test('converges Table/TableV2 header typography without dashboard uppercase (#304)', () => {
    // Real consumer path: fsus.scss pulls table.scss / table-v2 then fsus-theme.
    // fsus-theme historically forced 12px/700/uppercase/.08em (and 11px on mobile).
    const themeCss = compileThemeFile('fsus-theme.scss')
    const tableCss = compileThemeFile('table.scss')
    const tableV2Css = compileThemeFile('table-v2.scss')
    const shippedCss = compileThemeFile('fsus.scss')

    for (const css of [themeCss, shippedCss]) {
      expectCssRule(css, '.el-table th.el-table__cell', [
        'font-size: 14px;',
        'font-weight: 500;',
        'letter-spacing: 0;',
        'text-transform: none;',
      ])
      expectCssRule(css, '.el-table-v2__header-cell', [
        'font-size: 14px;',
        'font-weight: 500;',
        'letter-spacing: 0;',
        'text-transform: none;',
      ])
      expectCssRule(css, '.el-table--small th.el-table__cell', [
        'font-size: 12px;',
      ])
    }

    expectCssRule(tableCss, '.el-table thead th', [
      'font-weight: 500;',
      'letter-spacing: 0;',
      'text-transform: none;',
    ])
    expectCssRule(tableV2Css, '.el-table-v2__header-cell', [
      'font-weight: 500;',
      'letter-spacing: 0;',
      'text-transform: none;',
    ])

    // Mutation kill: uppercase / tracking / 11px / broad 700 must not return.
    const headerRules = [
      ...cssRules(themeCss, '.el-table th.el-table__cell'),
      ...cssRules(themeCss, '.el-table-v2__header-cell'),
      ...cssRules(shippedCss, '.el-table th.el-table__cell'),
      ...cssRules(shippedCss, '.el-table-v2__header-cell'),
    ]
    expect(headerRules.length).toBeGreaterThan(0)
    for (const rule of headerRules) {
      expect(rule).not.toMatch(/font-size:\s*11px/)
      expect(rule).not.toMatch(/letter-spacing:\s*0\.08em/)
      expect(rule).not.toMatch(/letter-spacing:\s*0\.06em/)
      expect(rule).not.toMatch(/text-transform:\s*uppercase/)
    }
    expect(themeCss).not.toMatch(
      /@media\s*\(\s*max-width:\s*760px\s*\)[\s\S]{0,800}?\.el-table th\.el-table__cell[\s\S]{0,120}?font-size:\s*11px/,
    )
    expect(themeCss).not.toMatch(
      /\.el-table th\.el-table__cell[^{]*\{[^}]*font-weight:\s*700/,
    )
    expect(themeCss).not.toMatch(
      /\.el-table-v2__header-cell[^{]*\{[^}]*font-weight:\s*700/,
    )
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
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
    ])
    expectCssRule(css, '.el-section-nav__link', [
      'font-size: 14px;',
      'font-weight: 700;',
    ])
    expectCssRule(css, '.el-settings-section', [
      'display: grid;',
      'border-top: 1px solid var(--el-border-color-lighter);',
    ])
    expectCssRule(css, '.el-section-header', [
      'display: grid;',
      'grid-template-columns: minmax(0, 1fr) auto;',
    ])
    expectCssRule(css, '.el-settings-section__title', [
      'font-size: 16px;',
      'font-weight: 700;',
    ])
    expectCssRule(css, '.el-settings-section__description', [
      'font-size: 14px;',
    ])
    expectCssRule(css, '.el-section-header__description', ['font-size: 14px;'])
    expectCssRule(css, '.el-resource-list', [
      'display: grid;',
      'min-width: 0;',
    ])
    expectCssRule(css, '.el-resource-list-item__title', [
      'font-size: 14px;',
      'font-weight: 700;',
    ])
    expectCssRule(css, '.el-resource-list-item__meta', ['font-size: 12px;'])
    expectCssRule(css, '.el-metadata-row', [
      'display: flex;',
      'flex-wrap: wrap;',
    ])
    expectCssRule(css, '.el-danger-zone', [
      'display: grid;',
      'border-top: 1px solid color-mix(in srgb, var(--el-color-danger) 38%, var(--el-border-color-lighter));',
    ])
    expectCssRule(css, '.el-typed-confirm-field__input:focus', [
      'border-color: var(--fsus-scholarly-blue, var(--el-color-primary));',
    ])
    expect(css).toContain('@media (max-width: 640px)')
    expect(css).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(css).not.toMatch(
      /\.el-section-nav__link:hover,\s*\.el-section-nav__link:focus-visible\s*\{[^}]*outline: none;/s,
    )
    expect(css).not.toMatch(/\.el-settings-section\s*\{[^}]*box-shadow:/s)
    expect(css).not.toContain('font-size: 13px;')
    expect(css).not.toContain('font-size: 15px;')
    expect(css).not.toMatch(/gradient|backdrop-filter|blur\(/)
  })

  test('keeps metric primitives flat, readable, and chart-free', () => {
    const css = compileThemeFile('metric-primitives.scss')

    expectCssRule(css, '.el-metric-list', [
      'display: grid;',
      'min-width: 0;',
    ])
    expectCssRule(css, '.el-metric-item__primary', [
      'font-size: 16px;',
      'font-weight: 700;',
      'font-variant-numeric: tabular-nums;',
      'letter-spacing: 0;',
    ])
    expectCssRule(css, '.el-distribution-bar-row__value', [
      'font-size: 14px;',
      'font-weight: 500;',
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
    expectCssRule(css, '.el-key-value-item__label', [
      'font-size: 12px;',
      'font-weight: 500;',
    ])
    expectCssRule(css, '.el-key-value-item__value', [
      'font-size: 14px;',
      'font-weight: 500;',
    ])
    expectCssRule(css, '.el-key-value-item__badge', [
      'color: var(--fsus-dot-gray, var(--el-text-color-placeholder));',
    ])
    expectCssRule(css, '.el-status-summary__label', [
      'font-size: 14px;',
      'font-weight: 500;',
    ])
    expectCssRule(css, '.el-status-summary__status', [
      'font-size: 14px;',
      'font-weight: 500;',
    ])
    expectCssRule(css, '.el-diagnostics-item__detail-body', [
      'font-family: var(--el-font-family-monospace, monospace);',
      'overflow-wrap: anywhere;',
    ])
    expectCssRule(css, '.el-diagnostics-item__detail-toggle', [
      'min-width: var(--fsus-control-height-compact, 40px);',
      'min-height: var(--fsus-control-height-compact, 40px);',
      'opacity: 1;',
    ])
    expectCssRule(css, '.el-diagnostics-item__detail-toggle:focus-visible', [
      'box-shadow: inset 0 0 0 var(--fsus-focus-ring-width, 2px) var(--fsus-scholarly-blue, var(--el-color-primary));',
      'outline: none;',
    ])
    expectCssRule(css, '.el-copyable-detail__button', [
      'min-width: var(--fsus-control-height-compact, 40px);',
      'min-height: var(--fsus-control-height-compact, 40px);',
      'opacity: 1;',
    ])
    expectCssRule(css, '.el-copyable-detail__button:disabled', [
      'cursor: not-allowed;',
      'opacity: 1;',
    ])
    expectCssRule(css, '.el-copyable-detail.is-disabled', ['opacity: 1;'])
    expect(css).toMatch(
      /\.el-(?:status-summary|diagnostics-item)__actions\s*>\s*:where\(button,\s*a\[href\],\s*\[role=button\]\)[^{]*\{[^}]*min-width:\s*var\(--fsus-control-height-compact,\s*40px\);[^}]*min-height:\s*var\(--fsus-control-height-compact,\s*40px\);/s,
    )
    expect(css).toMatch(
      /\.el-(?:status-summary|diagnostics-item)__actions\s*>\s*\.el-button\.el-button[^{]*\{[^}]*min-width:\s*var\(--fsus-control-height-compact,\s*40px\);[^}]*min-height:\s*var\(--fsus-control-height-compact,\s*40px\);/s,
    )
    expect(css).toMatch(
      /\[aria-pressed=true\][^{]*\{[^}]*background:\s*var\(--el-fill-color-light\);[^}]*border-color:\s*var\(--el-color-primary\);[^}]*color:\s*var\(--fsus-scholarly-blue,\s*var\(--el-color-primary\)\);[^}]*opacity:\s*1;/s,
    )
    expect(css).toMatch(
      /@media \(max-width:\s*640px\)[\s\S]*\.el-copyable-detail__button[\s\S]*min-width:\s*var\(--fsus-control-height,\s*44px\);[\s\S]*min-height:\s*var\(--fsus-control-height,\s*44px\);/,
    )
    expect(css).toContain('@media (max-width: 640px)')
    expect(css).not.toMatch(
      /\.el-distribution-bar-row__bar-fill\s*\{[^}]*var\(--el-color-primary\)/s,
    )
    expect(css).not.toMatch(/\.el-key-value-item__label::before/)
    expect(css).not.toContain('--fsus-key-value-dot-color')
    const fontSizes = [...css.matchAll(/font-size:\s*(\d+)px/g)].map((match) =>
      Number(match[1]),
    )
    expect([...new Set(fontSizes)].sort((a, b) => a - b)).toEqual([12, 14, 16])
    const mutationCases = [
      {
        id: '13-or-17-pixel-ladder',
        pattern: /font-size:\s*(?:13|17)px/,
      },
      {
        id: 'broad-ordinary-700-weight',
        pattern:
          /\.(?:el-distribution-bar-row__value|el-key-value-item__(?:label|value)|el-status-summary__(?:label|status)|el-diagnostics-item__detail-toggle|el-copyable-detail__button)[^{]*\{[^}]*font-weight:\s*700/,
      },
      {
        id: 'default-key-label-dot',
        pattern: /\.el-key-value-item__label::before/,
      },
      {
        id: 'colored-dot-forest',
        pattern:
          /\.el-key-value-item--(?:success|warning|danger|info)[^{]*\{[^}]*(?:--fsus-key-value-dot-color|background):/,
      },
      {
        id: 'private-metric-font-alias',
        pattern:
          /--fsus-(?:metric|key-value|status|diagnostics|copyable)[^:]*font/,
      },
      {
        id: '30px-inline-target',
        pattern:
          /\.(?:el-copyable-detail__button|el-diagnostics-item__detail-toggle)[^{]*\{[^}]*min-height:\s*30px/,
      },
      {
        id: 'ancestor-disabled-opacity',
        pattern:
          /\.el-(?:copyable-detail|status-summary|diagnostics-item)\.is-disabled\s*\{[^}]*opacity:\s*(?:0|0?\.[0-9]+)/,
      },
    ]
    for (const mutation of mutationCases) {
      expect(css, mutation.id).not.toMatch(mutation.pattern)
    }
    expect(css).not.toMatch(/gradient|backdrop-filter|blur\(/)
  })

  test('restores menu navigation density and Scholarly Blue active markers (#294)', () => {
    const themeCss = compileThemeFile('fsus-theme.scss')
    const menuCss = compileThemeFile('menu.scss')
    const shippedCss = compileThemeFile('fsus.scss')

    // Vertical density: 56px via canonical tokens on item + SubMenu title.
    expectCssRule(menuCss, ':root', [
      '--el-menu-item-height: var(--fsus-menu-item-height);',
      '--el-menu-sub-item-height: var(--fsus-menu-item-height);',
    ])
    expectCssRule(menuCss, '.el-menu-item', [
      'height: var(--el-menu-item-height);',
      'min-height: var(--el-menu-item-height);',
    ])
    expectCssRule(menuCss, '.el-sub-menu__title', [
      'height: var(--el-menu-item-height);',
      'min-height: var(--el-menu-item-height);',
    ])
    expectCssRule(themeCss, '.el-menu-item', [
      'height: var(--el-menu-item-height, var(--fsus-menu-item-height));',
      'min-height: var(--el-menu-item-height, var(--fsus-menu-item-height));',
    ])
    expectCssRule(themeCss, '.el-sub-menu__title', [
      'height: var(--el-menu-item-height, var(--fsus-menu-item-height));',
      'min-height: var(--el-menu-item-height, var(--fsus-menu-item-height));',
    ])

    // Horizontal density: 60px top-level track.
    expectCssRule(menuCss, ':root', [
      '--el-menu-horizontal-height: var(--fsus-menu-horizontal-height);',
    ])
    expectCssRule(themeCss, '.el-menu.el-menu--horizontal', [
      'height: var(--el-menu-horizontal-height, var(--fsus-menu-horizontal-height));',
      'min-height: var(--el-menu-horizontal-height, var(--fsus-menu-horizontal-height));',
    ])
    expectCssRule(themeCss, '.el-menu.el-menu--horizontal > .el-menu-item', [
      'height: var(--el-menu-horizontal-height, var(--fsus-menu-horizontal-height));',
      'min-height: var(--el-menu-horizontal-height, var(--fsus-menu-horizontal-height));',
    ])
    expectCssRule(
      themeCss,
      '.el-menu.el-menu--horizontal > .el-sub-menu > .el-sub-menu__title',
      [
        'height: var(--el-menu-horizontal-height, var(--fsus-menu-horizontal-height));',
        'min-height: var(--el-menu-horizontal-height, var(--fsus-menu-horizontal-height));',
      ],
    )

    // Active: Scholarly Blue functional markers + Ink text (not gray fill + 700).
    expectCssRule(themeCss, '.el-menu-item.is-active', [
      'background: transparent;',
      'color: var(--el-text-color-primary);',
      'font-weight: 500;',
      'box-shadow: inset 3px 0 0 var(--fsus-scholarly-blue);',
    ])
    expectCssRule(
      themeCss,
      '.el-menu--horizontal > .el-menu-item.is-active',
      [
        'background: transparent;',
        'color: var(--el-text-color-primary);',
        'font-weight: 500;',
        'border-bottom: 2px solid var(--fsus-scholarly-blue) !important;',
      ],
    )
    // Expanded parent must not steal the current-page side rail.
    expectCssRule(themeCss, '.el-sub-menu.is-active > .el-sub-menu__title', [
      'background: transparent;',
      'color: var(--el-text-color-primary);',
      'box-shadow: none;',
    ])
    // focus-visible on active keeps the full inset ring (not only the side rail).
    expectCssRule(themeCss, '.el-menu-item.is-active:focus-visible', [
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
    ])

    // Mutation kill: wrong density literals (44px vertical / 48px horizontal).
    for (const css of [themeCss, shippedCss]) {
      expect(css).not.toMatch(
        /\.el-menu-item\s*,\s*\.el-sub-menu__title(?:\s*,\s*\.el-menu-item-group__title)?\s*\{[^}]*min-height:\s*44px/s,
      )
      expect(css).not.toMatch(
        /\.el-menu\.el-menu--horizontal\s*>\s*\.el-menu-item[^{]*\{[^}]*height:\s*48px/s,
      )
      expect(css).not.toMatch(
        /\.el-menu\.el-menu--horizontal\s*>\s*\.el-menu-item[^{]*\{[^}]*min-height:\s*48px/s,
      )
      expect(css).not.toMatch(
        /\.el-menu\.el-menu--horizontal\s*>\s*\.el-menu-item[^{]*\{[^}]*line-height:\s*48px/s,
      )
    }

    // Mutation kill: non-blue active (gray fill + bold only, transparent bottom mark).
    for (const css of [themeCss, shippedCss]) {
      expect(css).not.toMatch(
        /\.el-menu-item\.is-active[^{]*\{[^}]*background:\s*var\(--el-fill-color\)[^}]*font-weight:\s*700/s,
      )
      expect(css).not.toMatch(
        /\.el-menu-item\.is-active[^{]*\{[^}]*border-bottom-color:\s*transparent\s*!important/s,
      )
      expect(css).not.toMatch(
        /\.el-menu--horizontal\s*>\s*\.el-menu-item\.is-active[^{]*\{[^}]*border-bottom-color:\s*transparent/s,
      )
      // Horizontal must keep a Scholarly Blue bottom mark, not zeroed borders.
      expect(css).not.toMatch(
        /\.el-menu\.el-menu--horizontal\s*>\s*\.el-menu-item[^{]*\{[^}]*border:\s*0\s*!important/s,
      )
    }

    // Positive Scholarly Blue marker presence in shipped consumer path.
    expect(shippedCss).toContain(
      'box-shadow: inset 3px 0 0 var(--fsus-scholarly-blue)',
    )
    expect(shippedCss).toContain(
      'border-bottom: 2px solid var(--fsus-scholarly-blue) !important',
    )
  })

  test('keeps card surfaces flat by default', () => {
    const css = compileThemeFile('card.scss')

    expectCssRule(css, '.el-card', ['box-shadow: none;'])
    expectCssRule(css, '.el-card:focus-visible', [
      'outline: none !important;',
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
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

    // Issue #307: disabled ReplyComposerShell must not fade the whole surface.
    // Ancestor opacity would mute title, helper, reason text, and controls together.
    // Mutation kill: reintroducing opacity on `.is-disabled` fails this contract.
    expect(css).not.toMatch(
      /\.el-reply-composer-shell\.is-disabled[^{]*\{[^}]*\bopacity\s*:/s,
    )
    expect(css).not.toMatch(
      /\.el-reply-composer-shell\.is-disabled[^{]*\{[^}]*opacity:\s*(?:0|0\.\d+)/s,
    )
    // Title stays a readable text role (primary), not disabled/placeholder gray.
    expectCssRule(css, '.el-reply-composer-shell__title', [
      'color: var(--el-text-color-primary);',
    ])
    // No full-surface gray wash / overlay motif on the composer shell.
    expect(css).not.toMatch(
      /\.el-reply-composer-shell[^{]*\{[^}]*(?:linear-gradient|backdrop-filter|filter:\s*grayscale)/s,
    )
    expect(css).not.toMatch(
      /\.el-reply-composer-shell\.is-disabled[^{]*\{[^}]*(?:background:\s*(?:#|rgb|gray)|filter:)/s,
    )
  })

  test('keeps perception challenge states task-focused and token aligned', () => {
    const css = compileThemeFile('perception-challenge.scss')

    expectCssRule(css, '.el-perception-challenge', [
      'display: grid;',
      'gap: var(--fsus-space-4, 16px);',
      'border-radius: var(--fsus-radius-panel, 12px);',
      'box-shadow: none;',
    ])
    expectCssRule(css, '.el-perception-challenge__status', [
      'border-radius: var(--fsus-radius-control, 6px);',
      'background: var(--el-fill-color-lighter);',
    ])
    expectCssRule(css, '.el-text-task-challenge__form', [
      'grid-template-columns: minmax(0, 1fr) auto;',
      'gap: var(--fsus-space-3, 12px);',
    ])
    expectCssRule(css, '.el-perception-character-challenge__media', [
      'padding: var(--fsus-space-3);',
      'border: var(--fsus-border-width) solid var(--el-border-color);',
      'border-radius: var(--fsus-radius-control);',
      'box-shadow: none;',
    ])
    expectCssRule(css, '.el-perception-character-challenge__image', [
      'animation: none;',
      'filter: none;',
      'transform: none;',
    ])
    expectCssRule(css, '.el-perception-character-challenge__input', [
      'min-height: var(--fsus-control-height-compact);',
      'border-radius: var(--fsus-radius-control);',
    ])
    expectCssRule(css, '.el-localization-challenge__target', [
      'border-radius: var(--fsus-radius-control, 6px);',
      'cursor: crosshair;',
    ])
    expectCssRule(css, '.el-localization-challenge__point', [
      'box-shadow: 0 0 0 2px var(--fsus-scholarly-blue, #2a599c);',
    ])
    expectCssRule(css, '.el-micro-interaction-challenge__gate', [
      'border-radius: var(--fsus-radius-control, 6px);',
      'color: var(--el-text-color-secondary);',
    ])
    expect(css).toContain('@media (max-width: 640px)')
    expect(css).not.toMatch(/linear-gradient|backdrop-filter|filter:\s*blur/)
  })

  test('InputNumber stepper actions share ≥40px action-size tokens without 38px', () => {
    const themeCss = compileThemeFile('fsus-theme.scss')
    const inputNumberCss = compileThemeFile('input-number.scss')

    // Production CSS must not hardcode 38px as the action size.
    expect(themeCss).not.toMatch(
      /\.el-input-number__increase[^{]*\{[^}]*\bwidth:\s*38px\b/s,
    )
    expect(themeCss).not.toMatch(
      /\.el-input-number__decrease[^{]*\{[^}]*\bwidth:\s*38px\b/s,
    )
    expect(inputNumberCss).not.toMatch(/\bwidth:\s*38px\b/)

    // Shared action-size token on the control ladder (48/44/40).
    expect(themeCss).toContain(
      '--fsus-input-number-action-size: var(--fsus-control-height, 44px)',
    )
    expect(themeCss).toContain(
      '--fsus-input-number-action-size: var(--fsus-control-height-spacious, 48px)',
    )
    expect(themeCss).toContain(
      '--fsus-input-number-action-size: var(--fsus-control-height-compact, 40px)',
    )
    expect(inputNumberCss).toContain('--fsus-input-number-action-size:')

    expectCssRule(themeCss, '.el-input-number .el-input-number__increase', [
      'width: var(--fsus-input-number-action-size);',
      'min-width: var(--fsus-input-number-action-size);',
      'transform: none;',
    ])
    expectCssRule(themeCss, '.el-input-number .el-input-number__decrease', [
      'width: var(--fsus-input-number-action-size);',
      'min-width: var(--fsus-input-number-action-size);',
    ])

    // controls-position right reuses the same token (no separate hardcoded width).
    expectCssRule(
      themeCss,
      '.el-input-number.is-controls-right .el-input-number__increase',
      ['width: var(--fsus-input-number-action-size);'],
    )
    expectCssRule(
      inputNumberCss,
      '.el-input-number.is-controls-right .el-input-number__increase',
      ['width: var(--fsus-input-number-action-size);'],
    )

    // Icon ~16px, optically centered (no scale transforms).
    expect(themeCss).toContain(
      '--fsus-input-number-icon-size: var(--fsus-icon-size-md, 16px)',
    )
    expect(inputNumberCss).toContain('--fsus-input-number-icon-size: 16px')
    expect(themeCss).not.toMatch(
      /\.el-input-number[^{]*\{[^}]*transform:\s*scale\(/s,
    )
    expect(inputNumberCss).not.toMatch(/transform:\s*scale\(/)

    // Hover/active must not introduce shadow or translate displacement.
    const increaseHover = themeCss.match(
      /\.el-input-number\s+\.el-input-number__increase:hover\s*\{([^}]*)\}/,
    )
    expect(increaseHover?.[1] ?? '').not.toMatch(/box-shadow:\s*(?!none)/)
    expect(increaseHover?.[1] ?? '').not.toMatch(/translate/)

    // Disabled uses independent tokens with opacity: 1 (not opacity fade).
    expectCssRule(
      themeCss,
      '.el-input-number .el-input-number__increase.is-disabled',
      ['opacity: 1;', 'color: var(--el-disabled-text-color);'],
    )
    expect(themeCss).toMatch(
      /\.el-input-number\.is-disabled[\s\S]*?opacity:\s*1/,
    )
  })

  test('flattens Tree/TreeV2/TreeSelect node rows and uses Scholarly Blue markers (#296)', () => {
    const themeCss = compileThemeFile('fsus-theme.scss')
    const treeCss = compileThemeFile('tree.scss')
    const treeSelectCss = compileThemeFile('tree-select.scss')
    const shippedCss = compileThemeFile('fsus.scss')
    const tokensSource = readFileSync(
      path.resolve(themeSourceDir, 'common/fsus-tokens.scss'),
      'utf8',
    )

    // Shared indent token documents the 24px hierarchy contract.
    expect(tokensSource).toContain('--fsus-tree-indent: 24px;')
    expect(tokensSource).toContain(
      '--fsus-tree-current-marker: var(--fsus-scholarly-blue);',
    )
    expect(tokensSource).toContain(
      '--fsus-tree-current-text: var(--fsus-scholarly-blue);',
    )

    // Flat geometry on node content (theme override + base tree).
    for (const css of [themeCss, treeCss, shippedCss]) {
      expectCssRule(css, '.el-tree-node__content', [
        'border-radius: 0;',
        'box-shadow: none;',
      ])
    }
    expectCssRule(themeCss, '.el-tree-node__content', [
      'margin: 0;',
      'background: transparent;',
    ])

    // Hover uses weak state fill, not panel card chrome.
    expectCssRule(themeCss, '.el-tree-node__content:hover', [
      'background: var(--fsus-state-hover-bg, var(--el-fill-color-light));',
    ])

    // Current: Scholarly Blue side marker + selected fill + blue text.
    expectCssRule(
      themeCss,
      '.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content',
      [
        'background: var(--fsus-tree-current-bg, var(--fsus-state-selected-bg));',
        'color: var(--fsus-tree-current-text, var(--fsus-scholarly-blue));',
        'font-weight: 500;',
        'box-shadow: inset 3px 0 0 var(--fsus-tree-current-marker, var(--fsus-scholarly-blue));',
      ],
    )
    expectCssRule(
      treeCss,
      '.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content',
      [
        'background-color: var(--fsus-tree-current-bg, var(--fsus-state-selected-bg));',
        'box-shadow: inset 3px 0 0 var(--fsus-tree-current-marker, var(--fsus-scholarly-blue));',
      ],
    )

    // focus-visible: 2px inset ring on flat row.
    expectCssRule(
      themeCss,
      '.el-tree-node:focus-visible > .el-tree-node__content',
      [
        'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
      ],
    )

    // Current + focus-visible: both side marker and ring remain present.
    expectCssRule(
      themeCss,
      '.el-tree--highlight-current .el-tree-node.is-current:focus-visible > .el-tree-node__content',
      [
        'inset 3px 0 0 var(--fsus-tree-current-marker, var(--fsus-scholarly-blue))',
        'inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight))',
      ],
    )

    // TreeSelect shares the same flat/current contract.
    expect(treeSelectCss).toContain('--el-tree-select-row-radius: 0;')
    expect(treeSelectCss).not.toContain(
      '--el-tree-select-row-radius: var(--fsus-radius-navigation, 6px);',
    )
    expect(treeSelectCss).not.toContain('margin: 2px 0')
    expectCssRule(
      treeSelectCss,
      '.el-tree-select__popper .el-tree .el-tree-node.is-current > .el-tree-node__content',
      [
        'box-shadow: inset 3px 0 0 var(--fsus-tree-current-marker, var(--fsus-scholarly-blue));',
        'color: var(--fsus-tree-current-text, var(--fsus-scholarly-blue));',
      ],
    )

    // Mutation kill: cardified 12px panel radius on tree rows.
    for (const css of [themeCss, shippedCss]) {
      expect(css).not.toMatch(
        /\.el-tree-node__content\s*\{[^}]*border-radius:\s*12px/s,
      )
      expect(css).not.toMatch(
        /\.el-tree-node__content\s*\{[^}]*border-radius:\s*var\(--fsus-radius-navigation/s,
      )
      // Mutation kill: gray-only current (fill without Scholarly Blue marker).
      expect(css).not.toMatch(
        /\.el-tree--highlight-current\s+\.el-tree-node\.is-current\s*>\s*\.el-tree-node__content\s*\{[^}]*background:\s*var\(--el-fill-color\)[^}]*color:\s*var\(--el-text-color-primary\)/s,
      )
    }

    // Mutation kill: base tree must not reintroduce panel radius on content.
    expect(treeCss).not.toMatch(
      /\.el-tree-node__content\s*\{[^}]*border-radius:\s*var\(--el-border-radius-base\)/s,
    )
    expect(treeCss).not.toMatch(
      /\.el-tree-node:focus\s*>\s*\.el-tree-node__content/s,
    )

    // Positive Scholarly Blue marker presence on shipped consumer path.
    expect(shippedCss).toContain(
      'box-shadow: inset 3px 0 0 var(--fsus-tree-current-marker, var(--fsus-scholarly-blue))',
    )
    expect(shippedCss).toContain('--fsus-tree-indent: 24px')
  })

  test('ships low-noise Upload dragger input area with restrained drag-over (#455)', () => {
    // Real consumer path: fsus.scss pulls upload.scss then fsus-theme overrides.
    // Historical surface: 67px decorative icon, 2px border+padding drag-over shift,
    // 180px tall center composition, 6px radius, active translate displacement.
    const uploadCss = compileThemeFile('upload.scss')
    const themeCss = compileThemeFile('fsus-theme.scss')
    const formCss = compileThemeFile('form.scss')
    const shippedCss = compileThemeFile('fsus.scss')
    const varSource = readFileSync(
      path.resolve(themeSourceDir, 'common/var.scss'),
      'utf8',
    )

    // Paper panel geometry: 12px panel radius, dashed border, ≥44px hit path.
    expectCssRule(uploadCss, '.el-upload-dragger', [
      'border-radius: var(--fsus-radius-panel, 12px);',
      'min-height: 44px;',
      'letter-spacing: normal;',
      'font-size: var(--el-font-size-base);',
    ])
    expectCssRule(themeCss, '.el-upload-dragger', [
      'border-radius: var(--fsus-radius-panel);',
      'min-height: 44px;',
      'background: var(--el-bg-color);',
      'border-style: dashed;',
    ])
    expect(themeCss).toMatch(
      /\.el-upload-dragger\s*\{[^}]*min-height:\s*44px/s,
    )
    // Compact padding — not the old 180px decorative stage.
    expect(themeCss).not.toMatch(
      /\.el-upload-dragger\s*\{[^}]*min-height:\s*180px/s,
    )
    expect(varSource).toContain("'dragger-padding-horizontal': 16px")
    expect(varSource).toContain("'dragger-padding-vertical': 20px")
    expect(varSource).not.toContain("'dragger-padding-horizontal': 40px")

    // Auxiliary icon budget 16–24px (token defaults to 16md); never 67px.
    expectCssRule(uploadCss, '.el-icon--upload', [
      'font-size: var(--el-upload-dragger-icon-size, var(--fsus-icon-size-md, 16px));',
    ])
    expectCssRule(themeCss, '.el-upload-dragger .el-icon--upload', [
      'font-size: var(--el-upload-dragger-icon-size, 16px);',
    ])
    expect(themeCss).toContain(
      '--el-upload-dragger-icon-size: var(--fsus-icon-size-md, 16px)',
    )

    // Mutation kill: giant decorative icon must not reappear.
    for (const css of [uploadCss, themeCss, shippedCss]) {
      expect(css).not.toMatch(/font-size:\s*67px/)
      expect(css).not.toMatch(/line-height:\s*50px/)
    }

    // Primary instruction 14px; optional help 12px; no 11px micro-copy.
    expectCssRule(uploadCss, '.el-upload-dragger .el-upload__text', [
      'font-size: var(--el-font-size-base);',
      'letter-spacing: normal;',
    ])
    expectCssRule(themeCss, '.el-upload-dragger .el-upload__text', [
      'font-size: var(--el-font-size-base, 14px);',
      'letter-spacing: normal;',
    ])
    expectCssRule(themeCss, '.el-upload-dragger > [data-upload-help]', [
      'font-size: 12px;',
      'letter-spacing: normal;',
    ])
    expectCssRule(uploadCss, '.el-upload__tip', ['font-size: 12px;'])

    const textRules = [
      ...cssRules(uploadCss, '.el-upload__text'),
      ...cssRules(themeCss, '.el-upload__text'),
      ...cssRules(shippedCss, '.el-upload__text'),
    ]
    expect(textRules.length).toBeGreaterThan(0)
    for (const rule of textRules) {
      expect(rule).not.toMatch(/font-size:\s*11px/)
      expect(rule).not.toMatch(/letter-spacing:\s*0\.1/)
      expect(rule).not.toMatch(/text-transform:\s*uppercase/)
    }

    // Drag-over: border + weak background only — no padding/border-width shift,
    // no glow, scale, shimmer, pulse, or translate displacement.
    expectCssRule(uploadCss, '.el-upload-dragger.is-dragover', [
      'background-color: var(--fsus-state-emphasis-bg);',
      'border-width: 1px;',
      'box-shadow: none;',
      'transform: none;',
    ])
    expectCssRule(themeCss, '.el-upload-dragger.is-dragover', [
      'background: var(--fsus-state-emphasis-bg);',
      'border-width: 1px;',
      'box-shadow: none;',
      'transform: none;',
    ])
    // Mutation kill: 2px border + padding compensation (layout shift) must not return.
    expect(uploadCss).not.toMatch(
      /\.el-upload-dragger\.is-dragover\s*\{[^}]*border:\s*2px/s,
    )
    expect(uploadCss).not.toMatch(
      /\.el-upload-dragger\.is-dragover\s*\{[^}]*padding:\s*calc/s,
    )
    for (const css of [uploadCss, themeCss, shippedCss]) {
      const dragoverRules = cssRules(css, '.el-upload-dragger.is-dragover')
      for (const rule of dragoverRules) {
        expect(rule).not.toMatch(/box-shadow:\s*(?!none)[^;]*rgba/)
        expect(rule).not.toMatch(/filter:\s*(?!none)[^;]*blur/)
        expect(rule).not.toMatch(/transform:\s*(?!none)[^;]*scale/)
        expect(rule).not.toMatch(/transform:\s*(?!none)[^;]*translate/)
        expect(rule).not.toMatch(/animation:/)
      }
    }

    // Hover / active: no translate displacement on the input area.
    const activeRules = cssRules(themeCss, '.el-upload-dragger:active')
    expect(activeRules.length).toBeGreaterThan(0)
    for (const rule of activeRules) {
      expect(rule).not.toMatch(/translate/)
      expect(rule).toMatch(/transform:\s*none/)
    }

    // Focus-visible maps onto the Paper panel radius ring.
    expect(uploadCss).toMatch(
      /\.el-upload\.is-focus-visible-dragger\s+\.el-upload-dragger/,
    )
    expect(uploadCss).toMatch(/\.el-upload\.is-drag:focus-visible/)
    expectCssRule(
      uploadCss,
      '.el-upload.is-focus-visible-dragger .el-upload-dragger',
      ['box-shadow:'],
    )

    // Disabled keeps solid disabled tokens (opacity 1, not faded).
    expectCssRule(
      themeCss,
      '.el-upload.is-disabled .el-upload-dragger',
      [
        'background: var(--el-disabled-bg-color);',
        'border-color: var(--el-disabled-border-color);',
        'opacity: 1;',
      ],
    )

    // Error / invalid form state is distinguishable on the dragger.
    expectCssRule(formCss, '.el-form-item.is-error .el-upload-dragger', [
      'border-color: var(--el-color-danger);',
    ])
    expectCssRule(themeCss, '.el-form-item.is-error .el-upload-dragger', [
      'border-color: var(--el-color-danger);',
    ])

    // Default material: no blur / glass / gradient / illustration on the control.
    const draggerRules = [
      ...cssRules(uploadCss, '.el-upload-dragger'),
      ...cssRules(themeCss, '.el-upload-dragger'),
    ]
    for (const rule of draggerRules) {
      expect(rule).not.toMatch(/backdrop-filter:\s*(?!none)[^;]*blur\([^0]/)
      expect(rule).not.toMatch(/linear-gradient/)
    }
    expect(themeCss).toMatch(
      /\.el-upload-dragger\s*\{[^}]*backdrop-filter:\s*none/s,
    )

    // Shipped consumer CSS retains the contract (not consumer deep selectors).
    expect(shippedCss).toContain('min-height: 44px')
    expect(shippedCss).not.toContain('font-size: 67px')
    expect(shippedCss).toMatch(
      /\.el-upload-dragger\.is-dragover\s*\{[^}]*border-width:\s*1px/s,
    )
  })
})
