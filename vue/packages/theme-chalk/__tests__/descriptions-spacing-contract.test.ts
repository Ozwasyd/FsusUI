import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compile, compileString } from 'sass'
import { describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const themeSourceDir = path.resolve(dirname, '../src')
const descriptionsSourcePath = path.join(themeSourceDir, 'descriptions.scss')

const compileThemeFile = (fileName: string) =>
  compile(path.resolve(themeSourceDir, fileName), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  }).css

const stripScssComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

/**
 * Mutation fixtures that reintroduce the regressions #313 kills.
 * Each must fail the same contract assertions as the shipped source.
 */
const mutations = [
  {
    id: 'legacy-bordered-15-11-7',
    from: `'large': var(--fsus-space-3) var(--fsus-space-4), // 12 16
    'default': var(--fsus-space-2) var(--fsus-space-3), // 8 12
    'small': var(--fsus-space-1) var(--fsus-space-2), // 4 8`,
    to: `'large': 12px 15px,
    'default': 8px 11px,
    'small': 4px 7px`,
  },
  {
    id: 'private-padding-x-alias',
    from: `'default': var(--fsus-space-2) var(--fsus-space-3), // 8 12`,
    to: `'default': var(--descriptions-padding-y, 8px) var(--descriptions-padding-x, 11px),`,
  },
  {
    id: 'hardcoded-default-only',
    from: `'default': var(--fsus-space-2) var(--fsus-space-3), // 8 12`,
    to: `'default': 8px 11px,`,
  },
] as const

const assertSpacingContract = (css: string, label: string) => {
  expect(
    css,
    `${label}: default bordered padding must use space-2/space-3`,
  ).toMatch(
    /\.el-descriptions__body[\s\S]*?\.is-bordered[\s\S]*?\.el-descriptions__cell\s*\{[^}]*padding:\s*var\(--fsus-space-2\)\s+var\(--fsus-space-3\)/s,
  )
  expect(
    css,
    `${label}: large bordered padding must use space-3/space-4`,
  ).toMatch(
    /\.el-descriptions--large[\s\S]*?\.is-bordered[\s\S]*?\.el-descriptions__cell\s*\{[^}]*padding:\s*var\(--fsus-space-3\)\s+var\(--fsus-space-4\)/s,
  )
  expect(
    css,
    `${label}: small bordered padding must use space-1/space-2`,
  ).toMatch(
    /\.el-descriptions--small[\s\S]*?\.is-bordered[\s\S]*?\.el-descriptions__cell\s*\{[^}]*padding:\s*var\(--fsus-space-1\)\s+var\(--fsus-space-2\)/s,
  )

  expect(css, `${label}: no 12px 15px`).not.toMatch(/padding:\s*12px 15px/)
  expect(css, `${label}: no 8px 11px`).not.toMatch(/padding:\s*8px 11px/)
  expect(css, `${label}: no 4px 7px`).not.toMatch(/padding:\s*4px 7px/)
  expect(css, `${label}: no private descriptions padding alias`).not.toMatch(
    /--descriptions-padding-x|--descriptions-padding-y/,
  )
}

describe('issue #313 Descriptions bordered spacing contract', () => {
  test('source map and compiled CSS derive padding from --fsus-space-* only', () => {
    const source = stripScssComments(readFileSync(descriptionsSourcePath, 'utf8'))
    expect(source).toContain('var(--fsus-space-3) var(--fsus-space-4)')
    expect(source).toContain('var(--fsus-space-2) var(--fsus-space-3)')
    expect(source).toContain('var(--fsus-space-1) var(--fsus-space-2)')
    expect(source).not.toMatch(/12px\s+15px|8px\s+11px|4px\s+7px/)
    expect(source).not.toMatch(/--descriptions-padding/)

    const css = compileThemeFile('descriptions.scss')
    assertSpacingContract(css, 'shipped')

    // Non-bordered / stack keep the same horizontal rhythm token.
    expect(css).toContain('padding-inline: var(--fsus-space-3);')
    expect(css).toContain('padding: 0 var(--fsus-space-3);')
  })

  test.each(mutations)(
    'mutation $id fails the spacing contract (kills 15/11/7 and private aliases)',
    ({ from, to, id }) => {
      const shipped = readFileSync(descriptionsSourcePath, 'utf8')
      expect(shipped, `${id}: mutation target must exist in source`).toContain(
        from,
      )
      const mutated = shipped.replace(from, to)
      expect(mutated).not.toBe(shipped)

      const css = compileString(mutated, {
        loadPaths: [themeSourceDir],
        style: 'expanded',
        url: pathToFileURL(descriptionsSourcePath),
      }).css

      expect(
        () => assertSpacingContract(css, id),
        `${id} must fail the contract`,
      ).toThrow()
    },
  )
})
