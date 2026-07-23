import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(
  new URL(
    '../vue/packages/theme-chalk/src/common/fsus-tokens.scss',
    import.meta.url,
  ),
  'utf8',
)
const themeSource = readFileSync(
  new URL('../vue/packages/theme-chalk/src/fsus-theme.scss', import.meta.url),
  'utf8',
)

const color = (name) => {
  const darkBlock = source.slice(source.indexOf('@mixin fsus-dark-tokens'))
  const match = new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, 'i').exec(darkBlock)
  assert.ok(match, `missing dark form token ${name}`)
  return match[1]
}

const luminance = (hex) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort(
    (left, right) => right - left,
  )
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test('dark form readable and state text meet AA on their actual fills', () => {
  const readable = color('--fsus-form-readable-text')
  const state = color('--fsus-form-state-text')
  const paper = '#121214'
  const disabledFill = '#1a1a1e'

  assert.ok(contrast(readable, paper) >= 4.5)
  assert.ok(contrast(state, paper) >= 4.5)
  assert.ok(contrast(state, disabledFill) >= 4.5)
})

test('dark form grayscale roles remain ordered and distinct', () => {
  const readable = luminance(color('--fsus-form-readable-text'))
  const state = luminance(color('--fsus-form-state-text'))
  const decorative = luminance(color('--fsus-form-decorative'))
  const border = luminance('#27272a')

  assert.ok(readable > state)
  assert.ok(state > decorative)
  assert.ok(decorative > border)
  assert.ok(readable - state > 0.05)
  assert.ok(state - border > 0.1)
})

test('dark form controls use the measured Paper fill, not a lighter fill assumption', () => {
  assert.match(
    themeSource,
    /\.#\{\$namespace\}-color-picker__trigger\s*\{\s*@include fsus-control\(control\);\s*background: var\(--el-bg-color\);/u,
  )
  assert.match(
    themeSource,
    /\.#\{\$namespace\}-upload-dragger\s*\{\s*@include fsus-control\(panel\);\s*background: var\(--el-bg-color\);/u,
  )
  assert.match(
    themeSource,
    /\.#\{\$namespace\}-input-number\s*\{\s*@include fsus-control\(control\);\s*background: var\(--el-bg-color\);/u,
  )
  assert.match(
    themeSource,
    /\.#\{\$namespace\}-input-number\.is-disabled,\s*\.#\{\$namespace\}-upload\.is-disabled/u,
  )
})
