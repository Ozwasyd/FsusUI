import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { describe, expect, test } from 'vitest'

const theme = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src',
)
const panel = '.el-public-shell__mobile-nav-menu-panel'
const navLink = '.el-public-shell__mobile-nav-link'

const declarations = (rules: CSSRule[], selector: string, property: string) =>
  rules
    .filter(
      (rule): rule is CSSStyleRule =>
        rule instanceof CSSStyleRule &&
        rule.selectorText.split(',').some((part) => part.trim() === selector),
    )
    .map((rule) => rule.style.getPropertyValue(property))
    .filter(Boolean)

describe('public-shell mobile menu appearance', () => {
  test.each(['public-shell.scss', 'public-shell-critical.scss'])(
    'ships a nested popover with flat 14px menu rows in %s',
    (filename) => {
      const { css } = compile(path.join(theme, filename), {
        loadPaths: [theme],
      })
      const sheet = document.createElement('style')
      sheet.textContent = css
      document.head.appendChild(sheet)
      try {
        const rules = Array.from(sheet.sheet!.cssRules)
        const menuLink = `:where(${panel}) ${navLink}`
        expect(declarations(rules, panel, 'border-radius').at(-1)).toBe(
          'var(--fsus-radius-popover, 10px)',
        )
        expect(declarations(rules, menuLink, 'border-color')).toEqual([
          'transparent',
        ])
        expect(declarations(rules, menuLink, 'font-size')).toEqual(['14px'])
        expect(declarations(rules, navLink, 'font-size').at(-1)).toBe('13px')
        expect(declarations(rules, navLink, 'min-height').at(-1)).toBe(
          'var(--fsus-public-shell-mobile-action-height, 44px)',
        )
        for (const state of [':hover', ':focus-visible', '.is-active']) {
          expect(
            declarations(rules, `${navLink}${state}`, 'border-color'),
          ).toContain('var(--fsus-scholarly-blue)')
        }
      } finally {
        sheet.remove()
      }
    },
  )
})
