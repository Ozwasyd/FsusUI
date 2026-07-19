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

describe('primary color semantics', () => {
  test('uses Scholarly Blue for interactions without recoloring primary buttons', () => {
    const variableCss = compileThemeFile('var.scss')
    const css = compileThemeFile('fsus.scss')

    expectCssRule(variableCss, ':root', ['--el-color-primary: #2a599c;'])
    expectCssRule(variableCss, '.dark', ['--el-color-primary: #4b79cc;'])
    expectCssRule(css, ':root', [
      '--el-color-primary: var(--fsus-scholarly-blue);',
      '--fsus-button-primary-bg: var(--fsus-ink);',
      '--fsus-button-primary-text: var(--fsus-paper);',
    ])
    expectCssRule(css, 'html.dark', [
      '--el-color-primary: var(--fsus-scholarly-blue);',
      '--fsus-ink: var(--fsus-color-text-primary);',
      '--fsus-paper: var(--fsus-color-surface-base);',
    ])
    expectCssRule(css, '.el-button--primary', [
      '--el-button-text-color: var(--fsus-button-primary-text);',
      '--el-button-bg-color: var(--fsus-button-primary-bg);',
      '--el-button-border-color: var(--fsus-button-primary-bg);',
      'color: var(--el-button-text-color);',
      'background-color: var(--el-button-bg-color);',
      'border-color: var(--el-button-border-color);',
    ])
    expectCssRule(css, '.el-button--primary:hover', [
      'background-color: var(--el-color-scholarly-blue);',
    ])
  })
})
