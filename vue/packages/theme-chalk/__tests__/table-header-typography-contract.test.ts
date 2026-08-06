import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compile, compileString } from 'sass'
import { describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const themeSourceDir = path.resolve(dirname, '../src')
const fsusThemePath = path.join(themeSourceDir, 'fsus-theme.scss')
const tablePath = path.join(themeSourceDir, 'table.scss')
const tableV2Path = path.join(themeSourceDir, 'table-v2.scss')

const compileThemeFile = (fileName: string) =>
  compile(path.resolve(themeSourceDir, fileName), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  }).css

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

/**
 * Assert Table/TableV2 header typography contract for issue #304.
 * Default: 14px / 500 / letter-spacing 0 / text-transform none.
 * Small: 12px. No dashboard uppercase, tracking, or 11px collapse.
 */
const assertHeaderTypographyContract = (css: string, label: string) => {
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

  // Mutation kill surface: dashboard header chrome must not reappear.
  const headerRules = [
    ...cssRules(css, '.el-table th.el-table__cell'),
    ...cssRules(css, '.el-table-v2__header-cell'),
  ]
  expect(headerRules.length, `${label}: expected header rules`).toBeGreaterThan(
    0,
  )
  for (const rule of headerRules) {
    expect(rule, `${label}: no 11px header`).not.toMatch(/font-size:\s*11px/)
    expect(rule, `${label}: no 0.08em tracking`).not.toMatch(
      /letter-spacing:\s*0\.08em/,
    )
    expect(rule, `${label}: no 0.06em tracking`).not.toMatch(
      /letter-spacing:\s*0\.06em/,
    )
    expect(rule, `${label}: no forced uppercase`).not.toMatch(
      /text-transform:\s*uppercase/,
    )
  }

  // Broad 700 must not win on the default Table/TableV2 header cell pair.
  const defaultHeaderBlock = headerRules.find(
    (rule) =>
      rule.includes('font-size: 14px') && rule.includes('font-weight: 500'),
  )
  expect(
    defaultHeaderBlock,
    `${label}: default header must ship 14px/500`,
  ).toBeTruthy()
  expect(defaultHeaderBlock).not.toMatch(/font-weight:\s*700/)

  // No viewport-specific 11px/tracking collapse for table headers.
  expect(css, `${label}: no max-width 11px table header collapse`).not.toMatch(
    /@media\s*\(\s*max-width:\s*760px\s*\)[\s\S]{0,800}?\.el-table th\.el-table__cell[\s\S]{0,120}?font-size:\s*11px/,
  )
  expect(css, `${label}: no max-width tracking table header`).not.toMatch(
    /@media\s*\(\s*max-width:\s*760px\s*\)[\s\S]{0,800}?\.el-table-v2__header-cell[\s\S]{0,120}?letter-spacing:\s*0\.0[68]em/,
  )
}

/**
 * Source mutations that reintroduce the #304 dashboard-header regressions.
 * Each must fail assertHeaderTypographyContract when compiled.
 */
const fsusThemeMutations = [
  {
    id: 'reintroduce-uppercase-tracking-12-700',
    from: `font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;`,
    to: `font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;`,
  },
  {
    id: 'reintroduce-11px-mobile-collapse',
    from: `.#{$namespace}-dialog__footer .dialog-footer {
    flex-wrap: nowrap;
  }

  .#{$namespace}-tree {
    padding: 10px;
  }`,
    to: `.#{$namespace}-dialog__footer .dialog-footer {
    flex-wrap: nowrap;
  }

  .#{$namespace}-table th.#{$namespace}-table__cell,
  .#{$namespace}-table-v2__header-cell {
    font-size: 11px;
    letter-spacing: 0.06em;
  }

  .#{$namespace}-tree {
    padding: 10px;
  }`,
  },
  {
    id: 'broad-700-without-semantic-exception',
    from: `font-weight: 500;
  letter-spacing: 0;
  text-transform: none;`,
    to: `font-weight: 700;
  letter-spacing: 0;
  text-transform: none;`,
  },
] as const

describe('issue #304 Table/TableV2 header typography contract', () => {
  test('fsus-theme ships 14px/500/no-tracking headers and 12px small density', () => {
    const themeCss = compileThemeFile('fsus-theme.scss')
    const shippedCss = compileThemeFile('fsus.scss')
    const tableCss = compileThemeFile('table.scss')
    const tableV2Css = compileThemeFile('table-v2.scss')

    assertHeaderTypographyContract(themeCss, 'fsus-theme')
    assertHeaderTypographyContract(shippedCss, 'fsus.scss bundle')

    // Base component styles reinforce readable headers (no uppercase chrome).
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
    // Small density cascade remains 12px at the table root.
    expectCssRule(tableCss, '.el-table--small', ['font-size: 12px;'])
    expectCssRule(tableCss, '.el-table--default', ['font-size: 14px;'])

    // Hover/current row feedback stays on background tokens, not weight.
    expect(themeCss).not.toMatch(
      /\.el-table__row:hover[\s\S]{0,120}?font-weight:\s*700/,
    )
    expect(themeCss).not.toMatch(
      /\.current-row[\s\S]{0,120}?font-weight:\s*700/,
    )
  })

  test.each(fsusThemeMutations)(
    'mutation $id fails the header typography contract',
    ({ from, to, id }) => {
      const shipped = readFileSync(fsusThemePath, 'utf8')
      expect(shipped, `${id}: mutation target must exist in source`).toContain(
        from,
      )
      const mutated = shipped.replace(from, to)
      expect(mutated, `${id}: mutation must change source`).not.toBe(shipped)

      const css = compileString(mutated, {
        loadPaths: [themeSourceDir],
        style: 'expanded',
        url: pathToFileURL(fsusThemePath),
      }).css

      expect(
        () => assertHeaderTypographyContract(css, id),
        `${id} must fail the header typography contract`,
      ).toThrow()
    },
  )

  test('base table/table-v2 sources do not force uppercase or tracking', () => {
    const tableSource = readFileSync(tablePath, 'utf8')
    const tableV2Source = readFileSync(tableV2Path, 'utf8')

    expect(tableSource).toMatch(/thead[\s\S]*?letter-spacing:\s*0/)
    expect(tableSource).toMatch(/thead[\s\S]*?text-transform:\s*none/)
    expect(tableSource).not.toMatch(
      /thead[\s\S]{0,400}?text-transform:\s*uppercase/,
    )
    expect(tableV2Source).toMatch(
      /e\('header-cell'\)[\s\S]{0,400}?letter-spacing:\s*0/,
    )
    expect(tableV2Source).toMatch(
      /e\('header-cell'\)[\s\S]{0,400}?text-transform:\s*none/,
    )
    expect(tableV2Source).not.toMatch(
      /e\('header-cell'\)[\s\S]{0,400}?text-transform:\s*uppercase/,
    )
    expect(tableV2Source).not.toMatch(
      /e\('header-cell'\)[\s\S]{0,400}?letter-spacing:\s*0\.0[68]em/,
    )
  })
})
