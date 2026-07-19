import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const sourceRoot = path.resolve(dirname, '../src')
const readSource = (relativePath: string) =>
  readFileSync(path.join(sourceRoot, relativePath), 'utf8')
const stripScssComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const readScssSources = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) return readScssSources(entryPath)
    if (entry.name.endsWith('.scss')) {
      return [stripScssComments(readFileSync(entryPath, 'utf8'))]
    }

    return []
  })

const allThemeSources = readScssSources(sourceRoot).join('\n')

describe('theme geometry focus and motion scale contract', () => {
  test('maps component geometry to the public radius ladder', () => {
    expect(readSource('date-picker/time-picker.scss')).toContain(
      'border-radius: var(--fsus-radius-popover, 10px);',
    )
    expect(readSource('date-picker/time-range-picker.scss')).toContain(
      'border-radius: var(--fsus-radius-control, 6px);',
    )
    expect(readSource('empty-state.scss')).toContain(
      'border-radius: var(--fsus-radius-control-small, 4px);',
    )
    expect(readSource('mixins/mixins.scss')).toContain(
      'border-radius: var(--fsus-radius-pill, 999px);',
    )
    expect(readSource('slider.scss')).toContain(
      "border-radius: 0 0 getCssVar('slider-border-radius')\n        getCssVar('slider-border-radius');",
    )
    expect(allThemeSources).not.toMatch(
      /border(?:-[a-z]+)?-radius:\s*(?:0\s+)*(?:1|2|3|5|7|8|9|11|13|14|15|16|18|20|22|32)px(?:\s|;|!)/,
    )
  })

  test('defaults every shared keyboard focus ring to two pixels', () => {
    const mixins = readSource('mixins/mixins.scss')

    expect(mixins).toContain('$offset: var(--fsus-focus-ring-width, 2px)')
    expect(readSource('common/fsus-tokens.scss')).toContain(
      '--fsus-focus-ring-width: #{generated.$fsus-thickness-focus-md};',
    )
    expect(allThemeSources).not.toMatch(/a11y-focus-ring\(\s*1px\b/)
    expect(allThemeSources).not.toMatch(
      /box-shadow:[^;{}]*1\.5px[^;{}]*var\(--fsus-scholarly-blue\)/s,
    )
  })

  test('uses only registered duration tiers as component fallbacks', () => {
    const forbiddenDuration =
      /\b(?:(?:90|120|160|180|240|250|280|320|400|500)ms|0\.(?:05|15|2)s)\b/

    expect(allThemeSources).not.toMatch(forbiddenDuration)
    expect(readSource('common/fsus-tokens.scss')).toContain(
      '--fsus-motion-scroll-settle: #{generated.$fsus-motion-duration-control-fast};',
    )
  })
})
