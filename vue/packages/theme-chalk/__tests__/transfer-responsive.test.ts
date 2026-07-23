import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { describe, expect, test } from 'vitest'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const themeSourceDir = path.resolve(dirname, '../src')

const compileTransfer = () =>
  compile(path.resolve(themeSourceDir, 'transfer.scss'), {
    loadPaths: [themeSourceDir],
    style: 'expanded',
  }).css.replace(/\s+/g, ' ')

describe('Transfer responsive theme contract', () => {
  test('uses the component container for the auto breakpoint', () => {
    const css = compileTransfer()

    expect(css).toContain('.el-transfer {')
    expect(css).toContain('container-type: inline-size;')
    expect(css).toContain('@container (max-width: 639px)')
    expect(css).toContain(
      '.el-transfer.is-auto > .el-transfer__layout { display: flex; flex-direction: column;',
    )
  })

  test('keeps vertical panels full width and actions touch sized', () => {
    const css = compileTransfer()

    expect(css).toContain(
      '.el-transfer.is-vertical .el-transfer-panel { width: 100%; min-width: 0;',
    )
    expect(css).toContain(
      '.el-transfer__button { min-width: 40px; min-height: 40px;',
    )
    expect(css).toContain(
      '.el-transfer.is-vertical .el-transfer__direction-icon { transform: rotate(90deg);',
    )
  })

  test('keeps list items readable and exposes stable panel geometry', () => {
    const css = compileTransfer()

    expect(css).toContain(
      '.el-transfer-panel__item { height: var(--el-transfer-item-height); line-height: var(--el-transfer-item-height); min-height: 40px; padding: 0 12px;',
    )
    expect(css).toContain(
      'border-top-left-radius: var(--el-transfer-border-radius);',
    )
    expect(css).toContain(
      'border-bottom-left-radius: var(--el-transfer-border-radius);',
    )
  })
})
