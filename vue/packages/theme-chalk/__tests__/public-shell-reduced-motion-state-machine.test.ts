import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { afterEach, describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const themeSourceDir = path.resolve(dirname, '../src')

const compileThemeFile = (fileName: string) =>
  compile(path.resolve(themeSourceDir, fileName), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  }).css

const PUBLIC_SHELL_ACTIVE_CLASSES = [
  'el-public-shell-mobile-nav-menu-enter-active',
  'el-public-shell-mobile-nav-menu-leave-active',
  'el-public-shell-mobile-search-enter-active',
  'el-public-shell-mobile-search-leave-active',
  'el-public-shell-desktop-search-enter-active',
  'el-public-shell-desktop-search-leave-active',
] as const

const PUBLIC_SHELL_FROM_TO_CLASSES = [
  'el-public-shell-mobile-nav-menu-enter-from',
  'el-public-shell-mobile-nav-menu-leave-to',
  'el-public-shell-mobile-search-enter-from',
  'el-public-shell-mobile-search-leave-to',
  'el-public-shell-desktop-search-enter-from',
  'el-public-shell-desktop-search-leave-to',
] as const

const extractReducedMotionBlocks = (css: string) => {
  const blocks: string[] = []
  const pattern = /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{/g
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

const injected: HTMLStyleElement[] = []

const injectCss = (css: string) => {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  injected.push(style)
  return style
}

afterEach(() => {
  for (const style of injected.splice(0)) style.remove()
})

describe('public-shell reduced-motion Vue state machine (shipped CSS)', () => {
  test.each([
    ['public-shell.scss', 'full'],
    ['public-shell-critical.scss', 'critical'],
  ] as const)(
    'CSSOM exposes 1ms duration / 0ms delay on every disclosure active class (%s)',
    (fileName, _variant) => {
      const css = compileThemeFile(fileName)
      const style = injectCss(css)
      const sheet = style.sheet
      expect(sheet).not.toBeNull()

      const reducedRules: CSSStyleRule[] = []
      for (const rule of Array.from(sheet!.cssRules)) {
        if (
          rule instanceof CSSMediaRule &&
          /prefers-reduced-motion:\s*reduce/.test(rule.conditionText)
        ) {
          for (const nested of Array.from(rule.cssRules)) {
            if (nested instanceof CSSStyleRule) reducedRules.push(nested)
          }
        }
      }
      expect(reducedRules.length).toBeGreaterThan(0)

      for (const className of PUBLIC_SHELL_ACTIVE_CLASSES) {
        const matches = reducedRules.filter((rule) =>
          rule.selectorText
            .split(',')
            .some((part) => part.trim() === `.${className}`),
        )
        expect(
          matches.length,
          `${className} must appear under prefers-reduced-motion`,
        ).toBeGreaterThan(0)

        const withDuration = matches.find((rule) =>
          /1ms/i.test(rule.style.transitionDuration),
        )
        expect(
          withDuration,
          `${className} must set transition-duration: 1ms under reduced motion (found: ${matches
            .map((r) => r.cssText)
            .join(' | ')})`,
        ).toBeTruthy()
        expect(withDuration!.style.transitionDuration).toMatch(/1ms/i)
        expect(withDuration!.style.transitionDelay || '0ms').toMatch(/^0ms$/i)
        expect(withDuration!.style.transition).not.toMatch(/^\s*none\s*$/i)
      }

      for (const className of PUBLIC_SHELL_FROM_TO_CLASSES) {
        const matches = reducedRules.filter((rule) =>
          rule.selectorText
            .split(',')
            .some((part) => part.trim() === `.${className}`),
        )
        expect(
          matches.length,
          `${className} must appear under prefers-reduced-motion`,
        ).toBeGreaterThan(0)
        expect(
          matches.some((rule) => rule.style.transform === 'none'),
          `${className} must zero transform under reduced motion`,
        ).toBe(true)
      }
    },
  )

  test('compiled source forbids transition:none / 0ms / 0.01ms on Vue active classes', () => {
    for (const fileName of [
      'public-shell.scss',
      'public-shell-critical.scss',
    ] as const) {
      const css = compileThemeFile(fileName)
      const reduced = extractReducedMotionBlocks(css)
      expect(reduced.length).toBeGreaterThan(0)

      for (const className of PUBLIC_SHELL_ACTIVE_CLASSES) {
        expect(reduced).toContain(className)
        const rulePattern = new RegExp(
          `${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{([^}]*)\\}`,
          'g',
        )
        let matched = false
        for (const match of reduced.matchAll(rulePattern)) {
          matched = true
          const body = match[1]
          expect(body).toMatch(/transition-duration:\s*1ms\s*!important/)
          expect(body).toMatch(/transition-delay:\s*0ms\s*!important/)
          expect(body).not.toMatch(/transition\s*:\s*none/)
          expect(body).not.toMatch(/transition-duration\s*:\s*0(?:\.0+)?ms/)
          expect(body).not.toMatch(/transition-duration\s*:\s*0\.01ms/)
        }
        expect(matched, `${className} missing from reduced-motion CSS`).toBe(
          true,
        )
      }

      for (const className of PUBLIC_SHELL_FROM_TO_CLASSES) {
        expect(reduced).toContain(className)
        expect(reduced).toMatch(
          new RegExp(
            `${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{[^}]*transform:\\s*none`,
          ),
        )
      }
    }
  })
})
