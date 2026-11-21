import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { describe, expect, test } from 'vitest'

const css = compile(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/fsus.scss',
  ),
).css

const normalizeSelector = (selector: string) =>
  selector.replace(/["']/g, '').replace(/\s+/g, ' ').trim()

const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selectors: match[1].split(',').map(normalizeSelector),
  declarations: match[2],
}))

const compatibilityRoot =
  ":where(html[data-theme-mode='system']:not(.light))[data-theme-resolved='dark']"
const componentRoot =
  "html:where([data-theme-mode='system']:not(.light))[data-theme-resolved='dark']"

const cases = [
  {
    name: 'compatibility palette',
    selectors: [
      '.dark',
      ":where(html:not(.light))[data-theme-resolved='dark']",
    ],
    tokens: [
      '--el-color-primary-light-9',
      '--el-color-danger-light-9',
      '--el-fill-color-darker',
      '--el-overlay-color-lighter',
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
})
