import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const css = compile(
  path.resolve(dirname, '../src/collection-primitives.scss'),
  {
    style: 'expanded',
  },
).css
const selector =
  '.el-data-list--navigation.is-interactive .el-data-list__row:focus-visible'

const declarations = (source: string) => {
  const start = source.indexOf(`${selector} {`)
  expect(start, 'navigation keyboard focus rule must exist').toBeGreaterThan(-1)
  const block = source.slice(start + selector.length + 2).split('}')[0]
  const style = document.createElement('div').style
  style.cssText = block
  return style
}

describe('navigation DataList focus contract', () => {
  test('bounds the outline and retains the visible inset ring', () => {
    const focus = declarations(css)

    // A bare `outline: none` resets width to medium. A consumer focus style
    // can then expose a 3px outline even though the inset ring is only 2px.
    expect(focus.outlineWidth).toBe('2px')
    expect(focus.outline).toBe('none')
    expect(focus.outlineOffset).toBe('-2px')
    expect(focus.boxShadow).toBe(
      'inset 0 0 0 2px var(--el-data-list-focus-ring)',
    )
  })

  test('keeps a system-color focus indicator when shadows are suppressed', () => {
    const forcedColors = css.split('@media (forced-colors: active)')[1]
    expect(forcedColors).toBeDefined()
    const focus = declarations(forcedColors!)

    expect(focus.outlineStyle).toBe('solid')
    expect(focus.outlineColor.toLowerCase()).toBe('highlight')
    expect(focus.getPropertyValue('forced-color-adjust')).not.toBe('none')
  })
})
