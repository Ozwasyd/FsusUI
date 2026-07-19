import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const tokenSource = readFileSync(
  path.resolve(dirname, '../src/common/fsus-tokens.scss'),
  'utf8',
)
const sassVarSource = readFileSync(
  path.resolve(dirname, '../src/common/var.scss'),
  'utf8',
)
const generatedTokenSource = readFileSync(
  path.resolve(dirname, '../src/generated/tokens.scss'),
  'utf8',
)
const generatedCssSource = readFileSync(
  path.resolve(dirname, '../src/generated/tokens.css'),
  'utf8',
)
const generatedJson = JSON.parse(
  readFileSync(path.resolve(dirname, '../src/generated/tokens.json'), 'utf8'),
)
const generatedAvaloniaSource = readFileSync(
  path.resolve(
    dirname,
    '../../../../dotnet/FsusUI.Avalonia.Themes/Generated/FsusTokens.axaml',
  ),
  'utf8',
)
const generatedCsharpSource = readFileSync(
  path.resolve(
    dirname,
    '../../../../dotnet/FsusUI.Avalonia/Generated/FsusTokens.g.cs',
  ),
  'utf8',
)
const inputSource = readFileSync(
  path.resolve(dirname, '../src/input.scss'),
  'utf8',
)
const buttonSource = readFileSync(
  path.resolve(dirname, '../src/button.scss'),
  'utf8',
)
const baseSource = readFileSync(
  path.resolve(dirname, '../src/base.scss'),
  'utf8',
)
const motionDocs = readFileSync(
  path.resolve(dirname, '../../../../docs/theme/motion.md'),
  'utf8',
)
const readScssSources = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) return readScssSources(entryPath)
    if (entry.name.endsWith('.scss')) return [readFileSync(entryPath, 'utf8')]

    return []
  })
const themeScssSource = readScssSources(path.resolve(dirname, '../src')).join(
  '\n',
)
const darkTokenMixin = tokenSource.match(
  /@mixin fsus-dark-tokens \{([\s\S]*?)\n\}/,
)?.[1]

describe('Fsus token source contracts', () => {
  test('keeps public motion tiers and fallbacks on the canonical contract', () => {
    expect(sassVarSource).toMatch(
      /\$transition-duration:[\s\S]*?'': 0\.22s,[\s\S]*?'fast': 0\.14s,[\s\S]*?'slow': 0\.36s,/,
    )
    expect(tokenSource).toContain(
      '--fsus-motion-overlay: #{generated.$fsus-motion-duration-overlay};',
    )
    expect(motionDocs).toContain('| `--fsus-motion-overlay`      | `300ms`')

    for (const [name, value, alias] of [
      ['motion.duration.control.fast', '140ms', '--fsus-motion-control-fast'],
      ['motion.duration.control', '220ms', '--fsus-motion-control'],
      ['motion.duration.overlay', '300ms', '--fsus-motion-overlay'],
      ['motion.duration.panel', '360ms', '--fsus-motion-panel'],
    ]) {
      expect(generatedJson.tokens[name]).toMatchObject({
        value,
        aliases: [alias],
        modeValues: { motionReduced: '1ms', motionDisabled: '1ms' },
      })
    }

    expect(baseSource).not.toContain('--fsus-motion-control-fast: 1ms;')
    expect(baseSource).not.toContain('--fsus-motion-panel: 1ms;')
    expect(themeScssSource).not.toContain('fsus-motion-control-fast, 160ms')
    expect(themeScssSource).not.toContain('cubic-bezier(0.2, 0.8, 0.2, 1)')
  })

  test('keeps input counters on the field surface instead of blank fill patches', () => {
    expect(
      inputSource.match(
        /& \.#\{\$namespace\}-input__count \{[\s\S]*?background: transparent;/g,
      ),
    ).toHaveLength(2)
    expect(inputSource).not.toContain(
      "background: getCssVar('fill-color', 'blank');",
    )
    expect(tokenSource).not.toContain(
      '--el-fill-color-blank: var(--fsus-paper);',
    )
  })

  test('wraps generated SCSS font-family map values as lists', () => {
    expect(generatedTokenSource).toContain(
      "'typography.family.body': (Google Sans, Inter",
    )
    expect(generatedTokenSource).toContain(
      "'typography.family.monospace': (ui-monospace, SFMono-Regular",
    )
  })

  test('keeps Scholarly Blue and accent aliases as the interaction color system', () => {
    expect(sassVarSource).toContain(
      '$color-scholarly-blue-dark: #4b79cc !default;',
    )
    expect(sassVarSource).not.toContain(
      '$color-scholarly-blue-dark: #3b6fc2 !default;',
    )
    expect(tokenSource).toContain(
      '--fsus-scholarly-blue: var(--fsus-color-action-primary);',
    )
    expect(tokenSource).toContain('--fsus-accent: var(--fsus-scholarly-blue);')
    expect(tokenSource).toContain(
      '--fsus-accent-hover: var(--fsus-color-action-primary-hover);',
    )
    expect(tokenSource).toContain(
      '--fsus-accent-subtle: var(--fsus-state-hover-bg);',
    )
    expect(tokenSource).toContain(
      '--fsus-accent-border: var(--fsus-state-focus-border);',
    )
    expect(darkTokenMixin).toContain(
      '--fsus-scholarly-blue: var(--fsus-color-action-primary);',
    )
    expect(darkTokenMixin).toContain(
      '--fsus-accent-hover: var(--fsus-color-action-primary-hover);',
    )
  })

  test('separates the compatibility interaction color from primary button ink', () => {
    expect(sassVarSource).toMatch(
      /\$colors:[\s\S]*?'primary': \(\s*'base': #2a599c,/,
    )
    expect(sassVarSource).toMatch(
      /\$colors-dark:[\s\S]*?'primary': \(\s*'base': #4b79cc,/,
    )
    expect(tokenSource).toContain(
      '--el-color-primary: var(--fsus-scholarly-blue);',
    )
    expect(tokenSource).not.toContain('--el-color-primary: var(--fsus-ink);')
    expect(tokenSource).toContain('--fsus-button-primary-bg: var(--fsus-ink);')
    expect(tokenSource).toContain(
      '--fsus-button-primary-text: var(--fsus-paper);',
    )
    expect(buttonSource).toContain(
      "('button', 'bg-color'),\n          var(--fsus-button-primary-bg)",
    )
    expect(buttonSource).toContain(
      "('button', 'text-color'),\n          var(--fsus-button-primary-text)",
    )
    expect(buttonSource).toContain(
      "background-color: getCssVar('button', 'bg-color');",
    )
    expect(buttonSource).toContain("color: getCssVar('button', 'text-color');")
  })

  test('maps every public dark foundation token from generated mode values', () => {
    for (const declaration of [
      '--fsus-color-action-primary: #{generated.$fsus-color-action-primary-dark};',
      '--fsus-color-action-primary-hover: #{generated.$fsus-color-action-primary-hover-dark};',
      '--fsus-color-text-primary: #{generated.$fsus-color-text-primary-dark};',
      '--fsus-color-surface-base: #{generated.$fsus-color-surface-base-dark};',
      '--fsus-component-state-button-primary-background-default: #{generated.$fsus-component-state-button-primary-background-default-dark};',
      '--fsus-component-state-button-primary-background-hover: #{generated.$fsus-component-state-button-primary-background-hover-dark};',
    ]) {
      expect(darkTokenMixin).toContain(declaration)
    }
    expect(darkTokenMixin).toContain(
      '--fsus-ink: var(--fsus-color-text-primary);',
    )
    expect(darkTokenMixin).toContain(
      '--fsus-paper: var(--fsus-color-surface-base);',
    )
  })

  test('exposes quiet, decorative, and raised semantics from the two canonical modes', () => {
    expect(tokenSource).toContain(
      '--fsus-color-text-quiet: #{generated.$fsus-color-text-quiet};',
    )
    expect(tokenSource).toContain(
      '--fsus-color-text-decorative: #{generated.$fsus-color-text-decorative};',
    )
    expect(tokenSource).toContain(
      '--fsus-dot-gray: var(--fsus-color-text-decorative);',
    )
    expect(tokenSource).toContain(
      '--fsus-color-surface-raised: #{generated.$fsus-color-surface-raised-dark};',
    )
    expect(generatedTokenSource).toContain('$fsus-color-text-quiet: #71717A;')
    expect(generatedTokenSource).toContain(
      '$fsus-color-text-quiet-dark: #A1A1AA;',
    )
    expect(generatedTokenSource).toContain(
      '$fsus-color-text-decorative-dark: #71717A;',
    )
    expect(generatedTokenSource).toContain(
      '$fsus-color-surface-raised-dark: #1A1A1E;',
    )
    expect(generatedCssSource).not.toContain(
      '[data-fsus-theme="high-contrast"]',
    )
    expect(generatedJson.tokens['color.text.decorative'].modeValues).toEqual({
      dark: '#71717A',
    })
    expect(generatedJson.tokens['color.text.quiet']).toMatchObject({
      type: 'color',
      value: '#71717A',
      modeValues: {
        dark: '#A1A1AA',
      },
    })
    expect(sassVarSource).toMatch(
      /\$text-color:[\s\S]*?'regular': var\(--fsus-color-text-quiet\),[\s\S]*?'secondary': var\(--fsus-color-text-muted\),[\s\S]*?'placeholder': var\(--fsus-color-text-muted\),[\s\S]*?'disabled': var\(--fsus-color-text-muted\),/,
    )
    expect(sassVarSource).toMatch(
      /\$text-color-dark:[\s\S]*?'primary': #f0f0f4,[\s\S]*?'regular': var\(--fsus-color-text-quiet\),[\s\S]*?'secondary': var\(--fsus-color-text-muted\),/,
    )
    expect(generatedAvaloniaSource).toContain(
      '<Color x:Key="FsusColorTextQuietDark">#A1A1AA</Color>',
    )
    expect(generatedCsharpSource).toContain(
      'public const string ColorSurfaceRaisedDarkValue = "#1A1A1E";',
    )
  })

  test('registers adapter aliases before component and Sass map use', () => {
    for (const declaration of [
      '--fsus-border-light: var(--fsus-color-border-light);',
      '--fsus-border-lighter: var(--fsus-color-border-lighter);',
      '--fsus-border-extra-light: var(--fsus-color-border-extra-light);',
      '--fsus-surface-overlay: var(--fsus-color-surface-overlay);',
      '--fsus-shadow-panel-light: #{generated.$fsus-shadow-panel-light};',
      '--fsus-motion-distance-sm: var(--fsus-motion-distance-small);',
      '--fsus-motion-distance-md: var(--fsus-motion-distance-medium);',
      '--fsus-motion-distance-lg: var(--fsus-motion-distance-large);',
      '--fsus-motion-intensity-standard: #{generated.$fsus-motion-intensity-standard};',
      '--fsus-motion-intensity-subtle: #{generated.$fsus-motion-intensity-subtle};',
      '--fsus-color-picker-thumb-bg: var(--fsus-color-surface-base);',
      '--fsus-color-picker-thumb-border: var(--fsus-border);',
      '--fsus-color-picker-thumb-shadow: var(--fsus-shadow-panel-lighter);',
    ]) {
      expect(tokenSource).toContain(declaration)
    }

    expect(sassVarSource).toMatch(
      /\$border-color:[\s\S]*?'light': var\(--fsus-border-light\),[\s\S]*?'lighter': var\(--fsus-border-lighter\),[\s\S]*?'extra-light': var\(--fsus-border-extra-light\),/,
    )
    expect(sassVarSource).toMatch(
      /\$bg-color:[\s\S]*?'page': var\(--fsus-page\),[\s\S]*?'overlay': var\(--fsus-surface-overlay\),/,
    )
    expect(sassVarSource).toMatch(
      /\$message:[\s\S]*?'shadow': var\(--fsus-shadow-panel-light\),/,
    )
    expect(generatedJson.tokens['color.border.light']).toMatchObject({
      value: '#ECECF0',
      aliases: ['--fsus-border-light'],
      modeValues: { dark: '#3F3F46' },
    })
    expect(generatedJson.tokens['motion.distance.medium']).toMatchObject({
      value: '14px',
      aliases: ['--fsus-motion-distance-md'],
    })
  })
})
