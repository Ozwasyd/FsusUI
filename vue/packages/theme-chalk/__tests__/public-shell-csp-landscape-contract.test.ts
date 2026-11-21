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

const extractMediaBlocks = (css: string, mediaPattern: RegExp) => {
  const blocks: string[] = []
  for (const hit of css.matchAll(mediaPattern)) {
    const start = hit.index! + hit[0].length
    let depth = 1
    let index = start
    while (index < css.length && depth > 0) {
      if (css[index] === '{') depth += 1
      else if (css[index] === '}') depth -= 1
      index += 1
    }
    blocks.push(css.slice(start, index - 1))
  }
  return blocks.join('\n')
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

describe('public-shell CSP search and short-landscape CSS contract', () => {
  const fullCss = compileThemeFile('public-shell.scss')
  const criticalCss = compileThemeFile('public-shell-critical.scss')
  const siteHeaderCss = compileThemeFile('site-header.scss')

  test.each([
    ['public-shell.scss', fullCss],
    ['public-shell-critical.scss', criticalCss],
  ] as const)(
    'enforces no-underline trigger and .is-csp-hidden parity in %s',
    (_fileName, css) => {
      expectCssRule(css, '.el-public-shell__mobile-search-trigger', [
        'text-decoration: none;',
        'min-height: var(--fsus-public-shell-mobile-action-height, 44px);',
      ])
      expectCssRule(
        css,
        '.el-public-shell__mobile-search-trigger:hover, .el-public-shell__mobile-search-trigger:focus-visible',
        ['text-decoration: none;'],
      )
      expectCssRule(css, '.el-public-shell .is-csp-hidden', [
        'display: none !important;',
      ])
    },
  )

  test.each([
    ['public-shell.scss', fullCss],
    ['public-shell-critical.scss', criticalCss],
  ] as const)(
    'keeps mobile-search-host normal-flow outside short landscape and scopes top-layer popover overlay strictly to short landscape in %s',
    (_fileName, css) => {
      expectCssRule(css, '.el-public-shell__mobile-search-host', [
        'display: block;',
        'min-width: 0;',
        'margin: 0;',
        'padding: 0;',
        'border: 0;',
        'background: transparent;',
      ])
      expectCssRule(css, '.el-public-shell__mobile-search-host[hidden]', [
        'display: none;',
      ])

      const combinedPortraitLandscape = extractMediaBlocks(
        css,
        /@media\s*\(max-width:\s*767px\),\s*\(max-height:\s*520px\)\s*and\s*\(orientation:\s*landscape\)\s*\{/g,
      )
      expect(combinedPortraitLandscape).not.toContain(':popover-open')

      const shortLandscape = extractMediaBlocks(
        css,
        /@media\s*\(max-height:\s*520px\)\s*and\s*\(orientation:\s*landscape\)\s*\{/g,
      )
      expect(shortLandscape.length).toBeGreaterThan(0)

      expectCssRule(shortLandscape, '.el-public-shell__mobile-search-host', [
        'display: none;',
      ])
      expectCssRule(
        shortLandscape,
        '.el-public-shell__mobile-search-host:popover-open',
        [
          'position: fixed;',
          'inset: 0;',
          'z-index: 60;',
          'display: flex;',
          'align-items: flex-start;',
          'justify-content: flex-end;',
          'pointer-events: auto;',
          'padding-inline-end: max(var(--fsus-space-6, 24px), var(--fsus-safe-area-inset-right));',
        ],
      )
      // Dart Sass may simplify nested calc() inside max().
      expect(shortLandscape).toMatch(
        /padding-block-start:\s*max\(\s*(?:calc\(\s*)?var\(--fsus-public-shell-mobile-action-height,\s*44px\)\s*\+\s*var\(--fsus-space-4,\s*16px\)(?:\s*\))?\s*,\s*var\(--fsus-safe-area-inset-top\)\s*\)/,
      )
      expectCssRule(
        shortLandscape,
        '.el-public-shell__mobile-search-host:popover-open::backdrop',
        ['background: transparent;', 'pointer-events: none;'],
      )
      expectCssRule(
        shortLandscape,
        '.el-public-shell__mobile-search-host:popover-open .el-public-shell__mobile-search-row.is-expanded',
        [
          'position: static;',
          'inset: auto;',
          'display: block;',
          'inline-size: min(20rem, 100%);',
          'background: var(--fsus-paper, var(--el-bg-color-overlay, #ffffff));',
          'pointer-events: auto;',
        ],
      )
      expect(shortLandscape).not.toContain('.el-public-shell__mobile-search-content')
    },
  )

  test('compacts short-landscape header vertical padding while preserving 44px touch targets', () => {
    for (const css of [fullCss, criticalCss]) {
      expectCssRule(css, '.el-public-shell', [
        '--fsus-public-shell-mobile-action-height: 44px;',
      ])

      const shortLandscape = extractMediaBlocks(
        css,
        /@media\s*\(max-height:\s*520px\)\s*and\s*\(orientation:\s*landscape\)\s*\{/g,
      )
      expectCssRule(shortLandscape, '.el-public-shell__inner', [
        'padding-block: var(--fsus-space-1, 4px);',
      ])
      expect(shortLandscape).not.toContain(
        '--fsus-public-shell-mobile-action-height:',
      )
    }

    const siteHeaderShortLandscape = extractMediaBlocks(
      siteHeaderCss,
      /@media\s*\(max-height:\s*520px\)\s*and\s*\(orientation:\s*landscape\)\s*\{/g,
    )
    expectCssRule(siteHeaderShortLandscape, '.el-site-header__inner', [
      'padding-block: var(--fsus-space-1, 4px);',
    ])
  })
})
