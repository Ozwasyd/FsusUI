import { readFileSync } from 'node:fs'
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
const inputSource = readFileSync(
  path.resolve(dirname, '../src/input.scss'),
  'utf8',
)

describe('Fsus token source contracts', () => {
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
    expect(tokenSource).toContain('--fsus-scholarly-blue: #4b79cc;')
    expect(tokenSource).toContain('--fsus-accent-hover: #6f93d7;')
  })
})
