import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'
import { validateCheckTagFocusBounds } from '../scripts/conformance-v2-evidence.mjs'

test('Web puts CheckTag bounds in the visual observation read by comparison', () => {
  const source = readFileSync(
    new URL('../scripts/native-screen-reader-harness.mjs', import.meta.url),
    'utf8',
  )
  const artifact = source.split("artifact: 'check-tag-browser.png',")[1]
  const observation = artifact?.match(/observation: \{([^{}]*)\}/u)?.[1]
  assert.match(observation ?? '', /\bfocusBounds: checkTagFocusBounds,/u)
})

// Validator controls only, never execution evidence or review receipts.
for (const [platform, coordinateSpace, unit] of [
  ['web', 'document', 'css-px'],
  ['avalonia', 'window', 'dip'],
]) {
  const bounds = () => ({
    coordinateSpace,
    unit,
    before: { focused: false, x: 24.5, y: 112.25, width: 81.75, height: 32 },
    afterFocus: { focused: true, x: 24.5, y: 112.25, width: 81.75, height: 32 },
    afterToggle: {
      focused: true,
      x: 24.5,
      y: 112.25,
      width: 81.75,
      height: 32,
    },
  })
  test(`${platform}: preserves all settled coordinates without rounding`, () => {
    assert.doesNotThrow(() => validateCheckTagFocusBounds(bounds(), platform))
  })
  for (const phase of ['afterFocus', 'afterToggle']) {
    for (const field of ['x', 'y', 'width', 'height']) {
      test(`${platform}: rejects ${phase} shifted ${field}`, () => {
        const changed = bounds()
        changed[phase][field] += 0.25
        assert.throws(() => validateCheckTagFocusBounds(changed, platform))
      })
    }
  }
  test(`${platform}: rejects missing/nonfinite bounds and mismatched units`, () => {
    for (const mutate of [
      (value) => delete value.before,
      (value) => {
        value.before.focused = true
      },
      (value) => {
        value.afterToggle.focused = false
      },
      (value) => delete value.afterFocus.y,
      (value) => {
        value.afterToggle.x = Infinity
      },
      (value) => {
        value.before.width = 0
      },
      (value) => {
        value.unit = 'screenshot-px'
      },
      (value) => {
        value.coordinateSpace = 'screen'
      },
    ]) {
      const changed = bounds()
      mutate(changed)
      assert.throws(() => validateCheckTagFocusBounds(changed, platform))
    }
  })
}
