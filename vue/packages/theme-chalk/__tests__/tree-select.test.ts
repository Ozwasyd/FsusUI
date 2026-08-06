import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const themeSourceDir = path.resolve(dirname, '../src')

const compileTreeSelect = () =>
  compile(path.resolve(themeSourceDir, 'tree-select.scss'), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  }).css

const ruleBody = (css: string, selector: string) => {
  const match = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(
    ([, selectors]) =>
      selectors.replace(/\s+/g, ' ').trim().split(', ').includes(selector),
  )

  expect(match, `No CSS rule found for "${selector}"`).toBeDefined()
  return match?.[2].replace(/\s+/g, ' ').trim() ?? ''
}

describe('TreeSelect row contract', () => {
  test('uses one flat tokenized grid row without card radius or gap (#296)', () => {
    const css = compileTreeSelect()
    const popper = ruleBody(css, '.el-tree-select__popper')
    const row = ruleBody(css, '.el-tree-select__popper .el-tree-node__content')

    expect(popper).toContain('--el-tree-select-row-height: 44px;')
    // Flat row: radius 0, not navigation panel chrome.
    expect(popper).toContain('--el-tree-select-row-radius: 0;')
    expect(row).toContain('display: grid;')
    expect(row).toContain(
      'grid-template-columns: var(--el-tree-select-row-expand-size) auto auto minmax(0, 1fr);',
    )
    expect(row).toContain('height: var(--el-tree-select-row-height);')
    expect(row).toContain('border-radius: var(--el-tree-select-row-radius);')
    expect(row).toContain('margin: 0;')
    expect(row).toContain('box-shadow: none;')
    // Mutation kill: card gap between rows and navigation radius.
    expect(css).not.toContain('margin: 2px 0')
    expect(css).not.toContain(
      '--el-tree-select-row-radius: var(--fsus-radius-navigation, 6px);',
    )
    expect(css).not.toContain('margin-left: -32px')
    expect(css).not.toContain('padding-left: 44px')
  })

  test('keeps expand hover current and keyboard focus ownership separate', () => {
    const css = compileTreeSelect()

    expect(
      ruleBody(css, '.el-tree-select__popper .el-tree-node__expand-icon'),
    ).toContain('opacity: 1;')
    expect(
      ruleBody(
        css,
        '.el-tree-select__popper .el-tree-node:not(.is-current) > .el-tree-node__content:hover',
      ),
    ).toContain('background: var(--fsus-state-hover-bg);')
    expect(
      ruleBody(
        css,
        '.el-tree-select__popper .el-tree .el-tree-node__content:has(> .el-select-dropdown__item.hover)',
      ),
    ).toContain('background: var(--fsus-state-hover-bg);')
    const current = ruleBody(
      css,
      '.el-tree-select__popper .el-tree .el-tree-node.is-current > .el-tree-node__content',
    )
    expect(current).toContain(
      'background: var(--fsus-tree-current-bg, var(--fsus-state-selected-bg));',
    )
    expect(current).toContain(
      'color: var(--fsus-tree-current-text, var(--fsus-scholarly-blue));',
    )
    expect(current).toContain(
      'box-shadow: inset 3px 0 0 var(--fsus-tree-current-marker, var(--fsus-scholarly-blue));',
    )
    const selected = ruleBody(
      css,
      '.el-tree-select__popper .el-tree .el-tree-node__content:has(> .el-select-dropdown__item.selected)',
    )
    expect(selected).toContain(
      'background: var(--fsus-tree-current-bg, var(--fsus-state-selected-bg));',
    )
    expect(selected).toContain(
      'box-shadow: inset 3px 0 0 var(--fsus-tree-current-marker, var(--fsus-scholarly-blue));',
    )

    const focus = ruleBody(
      css,
      '.el-tree-select__popper .el-tree-node:focus-visible > .el-tree-node__content',
    )
    expect(focus).toContain(
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
    )
    expect(focus).not.toContain('background:')

    // Current + focus-visible keeps both Scholarly Blue markers.
    const currentFocus = ruleBody(
      css,
      '.el-tree-select__popper .el-tree .el-tree-node.is-current:focus-visible > .el-tree-node__content',
    )
    expect(currentFocus).toContain(
      'inset 3px 0 0 var(--fsus-tree-current-marker, var(--fsus-scholarly-blue))',
    )
    expect(currentFocus).toContain(
      'inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight))',
    )

    const option = ruleBody(
      css,
      '.el-tree-select__popper .el-select-dropdown__item',
    )
    expect(option).toContain('background: transparent;')
    expect(option).toContain('border-radius: 0;')
  })
})
