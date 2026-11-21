import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const themeSourceDir = path.resolve(dirname, '../src')

const compileThemeFile = (fileName: string) =>
  compile(path.resolve(themeSourceDir, fileName), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  }).css

type ParsedRule = {
  body: string
  index: number
  selectors: string[]
}

const parseRules = (css: string): ParsedRule[] => {
  const withoutComments = css.replaceAll(/\/\*[\s\S]*?\*\//gu, '')
  const rules: ParsedRule[] = []
  const rulePattern = /([^{}]+)\{([^{}]*)\}/gu

  for (const match of withoutComments.matchAll(rulePattern)) {
    const selectors = match[1]
      .split(',')
      .map((selector) => selector.replaceAll(/\s+/gu, ' ').trim())
      .filter(Boolean)
    rules.push({
      body: match[2].replaceAll(/\s+/gu, ' ').trim(),
      index: match.index ?? 0,
      selectors,
    })
  }

  return rules
}

const exactRules = (css: string, selector: string) =>
  parseRules(css).filter((rule) => rule.selectors.includes(selector))

const expectExactRule = (
  css: string,
  selector: string,
  declarations: string[],
  label: string,
) => {
  const rules = exactRules(css, selector)
  expect(
    rules,
    `${label}: no CSS rule found for exact selector "${selector}"`,
  ).not.toHaveLength(0)
  expect(
    rules.some((rule) =>
      declarations.every((declaration) => rule.body.includes(declaration)),
    ),
    `${label}: no rule for "${selector}" contains ${declarations.join(', ')}`,
  ).toBe(true)
}

describe('issue #1096 drawer header alignment, focus-visible icon, and edge geometry contract', () => {
  const bundles = [
    ['drawer.scss', compileThemeFile('drawer.scss')],
    ['fsus.scss', compileThemeFile('fsus.scss')],
  ] as const

  test.each(bundles)(
    '%s reserves a 54px header content track whenever close button is present',
    (label, css) => {
      expectExactRule(
        css,
        '.el-drawer__header:has(.el-drawer__close-btn)::after',
        ['content: "";', 'flex: 0 0 0;', 'min-height: 54px;'],
        label,
      )
    },
  )

  test.each(bundles)(
    '%s aligns btt close button top inset to base block padding without top safe-area',
    (label, css) => {
      // Top-attached directions keep safe-area top inset on the base close button.
      expectExactRule(
        css,
        '.el-drawer__close-btn',
        ['top: max(var(--fsus-space-4), var(--fsus-safe-area-inset-top));'],
        label,
      )

      const bttCloseRules = exactRules(css, '.el-drawer.btt .el-drawer__close-btn')
      expect(
        bttCloseRules.some((rule) => rule.body.includes('top: var(--fsus-space-4);')),
        `${label}: .el-drawer.btt .el-drawer__close-btn must set top: var(--fsus-space-4)`,
      ).toBe(true)

      for (const rule of bttCloseRules) {
        expect(
          rule.body,
          `${label}: .el-drawer.btt .el-drawer__close-btn must not consume top safe-area inset`,
        ).not.toMatch(/top:[^;]*--fsus-safe-area-inset-top/u)
      }

      // btt still preserves right safe-area clearance shared with ttb.
      expect(
        bttCloseRules.some((rule) =>
          rule.body.includes(
            'right: max(var(--el-drawer-padding-primary), var(--fsus-safe-area-inset-right));',
          ),
        ),
        `${label}: .el-drawer.btt .el-drawer__close-btn must preserve right safe-area inset`,
      ).toBe(true)
    },
  )

  test.each(bundles)(
    '%s scopes close-icon primary tint to :focus-visible and :hover without bare :focus',
    (label, css) => {
      expectExactRule(
        css,
        '.el-drawer__close-btn:focus-visible i',
        ['color: var(--el-color-primary);'],
        label,
      )
      expectExactRule(
        css,
        '.el-drawer__close-btn:hover i',
        ['color: var(--el-color-primary);'],
        label,
      )
      expectExactRule(
        css,
        '.el-drawer__close-btn:focus-visible',
        ['border-radius: 999px;'],
        label,
      )

      expect(
        exactRules(css, '.el-drawer__close-btn:focus i'),
        `${label}: bare .el-drawer__close-btn:focus i must not exist`,
      ).toHaveLength(0)
      expect(
        css,
        `${label}: must not declare bare .el-drawer__close-btn:focus targeting icon`,
      ).not.toMatch(/\.el-drawer__close-btn:focus(?!-visible)\b[^{]*\{/u)
    },
  )

  test.each(bundles)(
    '%s renders edge-attached drawers flush with 0 radius and inner separating 1px border only',
    (label, css) => {
      const directions = [
        {
          dir: 'ltr',
          inner: 'border-right: 1px solid var(--el-border-color-light);',
          forbidden: ['border-left:', 'border-top:', 'border-bottom:'],
        },
        {
          dir: 'rtl',
          inner: 'border-left: 1px solid var(--el-border-color-light);',
          forbidden: ['border-right:', 'border-top:', 'border-bottom:'],
        },
        {
          dir: 'ttb',
          inner: 'border-bottom: 1px solid var(--el-border-color-light);',
          forbidden: ['border-top:', 'border-left:', 'border-right:'],
        },
        {
          dir: 'btt',
          inner: 'border-top: 1px solid var(--el-border-color-light);',
          forbidden: ['border-bottom:', 'border-left:', 'border-right:'],
        },
      ] as const

      for (const { dir, inner, forbidden } of directions) {
        const selector = `.el-drawer.${dir}`
        const rules = exactRules(css, selector)
        const resetRule = rules.find(
          (rule) =>
            rule.body.includes('border: 0;') &&
            rule.body.includes('border-radius: 0;'),
        )
        const innerRule = rules.find((rule) => rule.body.includes(inner))

        expect(
          resetRule,
          `${label}: ${selector} must reset border: 0 and border-radius: 0`,
        ).toBeDefined()
        expect(
          innerRule,
          `${label}: ${selector} must declare ${inner}`,
        ).toBeDefined()
        expect(
          innerRule!.index,
          `${label}: ${selector} inner border must follow border: 0 reset in source order`,
        ).toBeGreaterThan(resetRule!.index)

        for (const rule of rules) {
          for (const side of forbidden) {
            expect(
              rule.body,
              `${label}: ${selector} must not declare flush-edge ${side}`,
            ).not.toContain(side)
          }
        }
      }
    },
  )

  test('fsus.scss preserves 4-side border and panel radius on centered ElDialog', () => {
    const shippedCss = compileThemeFile('fsus.scss')

    expectExactRule(
      shippedCss,
      '.el-dialog',
      [
        'border: 1px solid var(--el-border-color-light);',
        'border-radius: var(--fsus-radius-panel);',
        'box-shadow: var(--fsus-shadow-panel, none);',
      ],
      'fsus.scss',
    )
  })
})
