import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile, compileString } from 'sass'
import { describe, expect, test } from 'vitest'

const themeSourceDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src',
)

const compileThemeFile = (fileName: string) =>
  compile(path.resolve(themeSourceDir, fileName), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  }).css

const css = compileThemeFile('fsus.scss')
const varCss = compileThemeFile('var.scss')
const baseCss = compileThemeFile('base.scss')
const motionCss = compileThemeFile('motion.scss')
const fsusThemeCss = compileThemeFile('fsus-theme.scss')

const normalizeSelector = (selector: string) =>
  selector.replace(/["']/g, '').replace(/\s+/g, ' ').trim()

const extractRules = (source: string) => {
  const cleaned = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@charset\s+[^;]+;/gi, '')
  return [...cleaned.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(',').map(normalizeSelector),
    declarations: match[2],
  }))
}

const extractMediaBlock = (source: string, query: string) => {
  const marker = `@media ${query}`
  const start = source.indexOf(marker)
  if (start === -1) return ''
  const openBrace = source.indexOf('{', start)
  if (openBrace === -1) return ''
  let depth = 0
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    else if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(openBrace + 1, index)
    }
  }
  return ''
}

const getDeclarationValue = (declarations: string, property: string) => {
  const match = declarations.match(
    new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]*);`),
  )
  return match ? match[1].trim() : undefined
}

const rules = extractRules(css)
const varRules = extractRules(varCss)
const baseRules = extractRules(baseCss)
const motionRules = extractRules(motionCss)
const fsusThemeRules = extractRules(fsusThemeCss)

const darkColorTypes = [
  'primary',
  'success',
  'warning',
  'danger',
  'error',
  'info',
] as const
const darkScaleLevels = [
  'light-3',
  'light-5',
  'light-7',
  'light-8',
  'light-9',
  'dark-2',
] as const
const darkScaleVars = darkColorTypes.flatMap((type) =>
  darkScaleLevels.map((level) => `--el-color-${type}-${level}`),
)

const compatibilityRoot =
  ":where(html[data-theme-mode='system']:not(.light))[data-theme-resolved='dark']"
const componentRoot =
  "html:where([data-theme-mode='system']:not(.light))[data-theme-resolved='dark']"

const cases = [
  {
    name: 'compatibility palette',
    selectors: [
      '.dark',
      'html.dark',
      ":where(html:not(.light))[data-theme-resolved='dark']",
    ],
    tokens: [
      '--el-color-primary-light-9',
      '--el-color-danger-light-9',
      '--el-text-color-primary',
      '--el-text-color-placeholder',
      '--el-text-color-disabled',
      '--el-border-color-dark',
      '--el-border-color-darker',
    ],
  },
  {
    name: 'glass overlay',
    selectors: [
      'html.dark .is-glass',
      "html.dark [data-fsus-material='glass']",
      `${componentRoot} .is-glass`,
      `${componentRoot} [data-fsus-material='glass']`,
    ],
    tokens: ['--fsus-surface-overlay'],
  },
  {
    name: 'switch thumb',
    selectors: [
      'html.dark .el-switch__action',
      `${componentRoot} .el-switch__action`,
    ],
    tokens: [
      '--fsus-switch-action-bg',
      '--fsus-switch-action-border',
      '--fsus-switch-action-shadow',
    ],
  },
  {
    name: 'color picker checkerboard',
    selectors: [
      '.dark .el-color-picker',
      '.dark .el-color-picker__panel',
      `${compatibilityRoot} .el-color-picker`,
      `${compatibilityRoot} .el-color-picker__panel`,
    ],
    tokens: ['--el-color-picker-alpha-bg-a'],
  },
]

describe('system dark in the complete public theme', () => {
  test.each(cases)(
    'shares dark declarations for $name',
    ({ selectors, tokens }) => {
      for (const selector of selectors) {
        expect(
          rules.some(
            (rule) =>
              rule.selectors.includes(normalizeSelector(selector)) &&
              tokens.every((token) => rule.declarations.includes(`${token}:`)),
          ),
          `${selector} must receive all dark values`,
        ).toBe(true)
      }
    },
  )

  test('emits all 36 dark color scale vars as non-empty hex colors across dark selectors', () => {
    expect(darkScaleVars).toHaveLength(36)

    const rootRule = varRules.find((rule) => rule.selectors.includes(':root'))
    const explicitDarkRule = varRules.find(
      (rule) =>
        rule.selectors.includes('.dark') &&
        rule.selectors.includes('html.dark') &&
        rule.selectors.includes(
          normalizeSelector(
            ":where(html:not(.light))[data-theme-resolved='dark']",
          ),
        ),
    )
    const mediaDarkRules = extractRules(
      extractMediaBlock(varCss, '(prefers-color-scheme: dark)'),
    )
    const mediaDarkRule = mediaDarkRules.find((rule) =>
      rule.selectors.includes('html:not(.light)'),
    )

    expect(rootRule).toBeDefined()
    expect(explicitDarkRule).toBeDefined()
    expect(mediaDarkRule).toBeDefined()

    for (const token of darkScaleVars) {
      const lightValue = getDeclarationValue(rootRule!.declarations, token)
      const explicitDarkValue = getDeclarationValue(
        explicitDarkRule!.declarations,
        token,
      )
      const mediaDarkValue = getDeclarationValue(
        mediaDarkRule!.declarations,
        token,
      )

      expect(lightValue, `${token} in :root`).toMatch(/^#[0-9a-f]{6}$/i)
      expect(explicitDarkValue, `${token} in dark rule`).toMatch(
        /^#[0-9a-f]{6}$/i,
      )
      expect(mediaDarkValue, `${token} in prefers-color-scheme dark`).toBe(
        explicitDarkValue,
      )
      expect(explicitDarkValue, `${token} must differ from light`).not.toBe(
        lightValue,
      )
    }

    expect(varCss).not.toMatch(/--el-color-[a-z0-9-]+:\s*;/u)
  })

  test('sets color-scheme cascade cleanly without base.scss overriding dark mode', () => {
    const varRootRules = varRules.filter((rule) =>
      rule.selectors.includes(':root'),
    )
    expect(varRootRules).toHaveLength(1)
    expect(
      getDeclarationValue(varRootRules[0].declarations, 'color-scheme'),
    ).toBe('light dark')

    const baseColorSchemeRootRules = baseRules.filter(
      (rule) =>
        rule.selectors.includes(':root') &&
        getDeclarationValue(rule.declarations, 'color-scheme') !== undefined,
    )
    expect(baseColorSchemeRootRules).toHaveLength(1)

    const lightRule = varRules.find((rule) =>
      rule.selectors.includes('html.light'),
    )
    expect(lightRule).toBeDefined()
    expect(getDeclarationValue(lightRule!.declarations, 'color-scheme')).toBe(
      'light',
    )

    const darkRule = varRules.find((rule) =>
      rule.selectors.includes('html.dark'),
    )
    expect(darkRule).toBeDefined()
    expect(getDeclarationValue(darkRule!.declarations, 'color-scheme')).toBe(
      'dark',
    )

    const mediaDarkRules = extractRules(
      extractMediaBlock(varCss, '(prefers-color-scheme: dark)'),
    )
    const mediaDarkRule = mediaDarkRules.find((rule) =>
      rule.selectors.includes('html:not(.light)'),
    )
    expect(mediaDarkRule).toBeDefined()
    expect(
      getDeclarationValue(mediaDarkRule!.declarations, 'color-scheme'),
    ).toBe('dark')
  })

  test('keeps dark token activation selector parity across var.scss and fsus-theme.scss', () => {
    const resolvedDarkSelector = normalizeSelector(
      ":where(html:not(.light))[data-theme-resolved='dark']",
    )

    const fsusDarkRule = fsusThemeRules.find(
      (rule) =>
        rule.selectors.includes('html.dark') &&
        rule.selectors.includes(resolvedDarkSelector),
    )
    expect(fsusDarkRule).toBeDefined()
    expect(
      getDeclarationValue(
        fsusDarkRule!.declarations,
        '--fsus-color-surface-base',
      ),
    ).toBe('#121214')
    expect(
      getDeclarationValue(
        fsusDarkRule!.declarations,
        '--fsus-color-fill-darker',
      ),
    ).toBeDefined()

    const fsusMediaDarkRules = extractRules(
      extractMediaBlock(fsusThemeCss, '(prefers-color-scheme: dark)'),
    )
    const fsusMediaDarkRule = fsusMediaDarkRules.find((rule) =>
      rule.selectors.includes('html:not(.light)'),
    )
    expect(fsusMediaDarkRule).toBeDefined()
    expect(
      getDeclarationValue(
        fsusMediaDarkRule!.declarations,
        '--fsus-color-surface-base',
      ),
    ).toBe('#121214')
  })

  test('diff-emits dark component vars while preserving :root --fsus-* indirection and consumer Sass overrides', () => {
    const rootRule = varRules.find((rule) => rule.selectors.includes(':root'))!
    const darkRule = varRules.find((rule) =>
      rule.selectors.includes('html.dark'),
    )!

    // Shared var(--fsus-*) tokens live once on :root and adapt via fsus-theme.scss
    expect(getDeclarationValue(rootRule.declarations, '--el-bg-color')).toBe(
      'var(--fsus-paper)',
    )
    expect(
      getDeclarationValue(rootRule.declarations, '--el-fill-color-darker'),
    ).toBe('var(--fsus-color-fill-darker)')
    expect(
      getDeclarationValue(rootRule.declarations, '--el-overlay-color-lighter'),
    ).toBe('var(--fsus-component-overlay-scrim)')
    expect(
      getDeclarationValue(darkRule.declarations, '--el-fill-color-darker'),
    ).toBeUndefined()
    expect(
      getDeclarationValue(darkRule.declarations, '--el-overlay-color-lighter'),
    ).toBeUndefined()

    // Consumer overrides via @use/@forward with (...) still emit in dark mode
    const overriddenCss = compileString(
      `
        @use 'common/var' as common-var with (
          $colors-dark: (
            'primary': (
              'base': #123456,
              'light-9': #abcdef,
            ),
          ),
          $bg-color-dark: (
            '': #101012,
          ),
        );
        @use 'var';
      `,
      { loadPaths: [themeSourceDir], style: 'expanded' },
    ).css
    const overriddenDarkRule = extractRules(overriddenCss).find((rule) =>
      rule.selectors.includes('html.dark'),
    )
    expect(overriddenDarkRule).toBeDefined()
    expect(
      getDeclarationValue(
        overriddenDarkRule!.declarations,
        '--el-color-primary',
      ),
    ).toBe('#123456')
    expect(
      getDeclarationValue(
        overriddenDarkRule!.declarations,
        '--el-color-primary-light-9',
      ),
    ).toBe('#abcdef')
    expect(
      getDeclarationValue(
        overriddenDarkRule!.declarations,
        '--el-color-primary-light-3',
      ),
    ).toMatch(/^#[0-9a-f]{6}$/i)
    expect(
      getDeclarationValue(overriddenDarkRule!.declarations, '--el-bg-color'),
    ).toBe('#101012')
  })

  test('emits CSP-safe transition suppression rules for theme switching and view transition snapshotting', () => {
    const themeSwitchSelectors = [
      '[data-fsus-theme-switching]',
      '[data-fsus-theme-switching] *',
      '[data-fsus-theme-switching] *::before',
      '[data-fsus-theme-switching] *::after',
    ]
    const themeSwitchRule = baseRules.find(
      (rule) =>
        themeSwitchSelectors.every((selector) =>
          rule.selectors.includes(selector),
        ) &&
        getDeclarationValue(rule.declarations, 'transition') ===
          'none !important',
    )
    expect(themeSwitchRule).toBeDefined()

    const snapshotSelectors = [
      ':root[data-fsus-view-transition-snapshotting]',
      ':root[data-fsus-view-transition-snapshotting] *',
      ':root[data-fsus-view-transition-snapshotting] *::before',
      ':root[data-fsus-view-transition-snapshotting] *::after',
    ]
    const snapshotRule = motionRules.find(
      (rule) =>
        snapshotSelectors.every((selector) =>
          rule.selectors.includes(selector),
        ) &&
        getDeclarationValue(rule.declarations, 'transition') ===
          'none !important',
    )
    expect(snapshotRule).toBeDefined()
  })
})
