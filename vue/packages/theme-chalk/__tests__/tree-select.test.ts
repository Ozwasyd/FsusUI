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
  test('uses one tokenized grid row without sibling compensation', () => {
    const css = compileTreeSelect()
    const popper = ruleBody(css, '.el-tree-select__popper')
    const row = ruleBody(css, '.el-tree-select__popper .el-tree-node__content')

    expect(popper).toContain('--el-tree-select-row-height: 44px;')
    expect(popper).toContain(
      '--el-tree-select-row-radius: var(--fsus-radius-navigation, 6px);',
    )
    expect(row).toContain('display: grid;')
    expect(row).toContain(
      'grid-template-columns: var(--el-tree-select-row-expand-size) auto auto minmax(0, 1fr);',
    )
    expect(row).toContain('height: var(--el-tree-select-row-height);')
    expect(row).toContain('border-radius: var(--el-tree-select-row-radius);')
    expect(css).not.toContain('margin-left: -32px')
    expect(css).not.toContain('padding-left: 44px')
    expect(css.match(/!important/g)).toHaveLength(2)
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
        '.el-tree-select__popper .el-tree .el-tree-node.is-current > .el-tree-node__content',
      ),
    ).toContain('background: var(--fsus-state-selected-bg);')

    const focus = ruleBody(
      css,
      '.el-tree-select__popper .el-tree-node:focus-visible > .el-tree-node__content',
    )
    expect(focus).toContain(
      'box-shadow: inset 0 0 0 2px var(--fsus-scholarly-blue, var(--el-a11y-focus-color, Highlight)) !important;',
    )
    expect(focus).not.toContain('background:')

    const option = ruleBody(
      css,
      '.el-tree-select__popper .el-select-dropdown__item',
    )
    expect(option).toContain('background: transparent;')
    expect(option).toContain('border-radius: 0;')
  })
})
