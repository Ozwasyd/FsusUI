import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const themeSourceRoot = path.join(root, 'vue/packages/theme-chalk/src')

const forbiddenDuration =
  /\b(?:(?:90|120|160|180|240|250|280|320|400|500)ms|0\.(?:05|15|2)s)\b/g
const nonScaleRadius =
  /border(?:-[a-z]+)?-radius:\s*(?:0\s+)*(?:1|2|3|5|7|8|9|11|13|14|15|16|18|20|22|32)px(?:\s|;|!)/g
const weakFocusRing =
  /(?:a11y-focus-ring\(\s*1px\b|box-shadow:[^;{}]*1\.5px[^;{}]*var\(--fsus-scholarly-blue\))/gs

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '')

const walkScss = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) return walkScss(entryPath)
    return entry.isFile() && entry.name.endsWith('.scss') ? [entryPath] : []
  })

const lineForIndex = (source, index) =>
  source.slice(0, index).split('\n').length

export const findThemeScaleViolations = () => {
  const violations = []

  for (const file of walkScss(themeSourceRoot)) {
    const source = stripComments(fs.readFileSync(file, 'utf8'))
    const relativePath = path.relative(root, file).replaceAll(path.sep, '/')

    for (const [kind, pattern] of [
      ['non-scale radius', nonScaleRadius],
      ['non-scale duration fallback', forbiddenDuration],
      ['weak focus ring', weakFocusRing],
    ]) {
      pattern.lastIndex = 0
      for (const match of source.matchAll(pattern)) {
        violations.push(
          `${relativePath}:${lineForIndex(source, match.index)} ${kind}: ${match[0].replace(/\s+/gu, ' ').trim()}`,
        )
      }
    }
  }

  return violations
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const violations = findThemeScaleViolations()

  if (violations.length > 0) {
    console.error(
      ['theme scale contract violations:', ...violations].join('\n'),
    )
    process.exitCode = 1
  } else {
    console.log('theme-scale-contract check passed')
  }
}
