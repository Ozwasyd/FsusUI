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

describe('responsive data component contracts', () => {
  test('Descriptions exposes flat stack and keyboard-scroll projections', () => {
    const css = compileThemeFile('descriptions.scss')

    expect(css).toContain('container-type: inline-size;')
    expect(css).toContain(
      '.el-descriptions--responsive-stack .el-descriptions__stack',
    )
    expect(css).toContain(
      '.el-descriptions--responsive-scroll .el-descriptions__body',
    )
    expect(css).toContain('overflow-x: auto;')
    expect(css).toContain('@container (max-width: 559px)')
    expect(css).toContain('overflow-wrap: anywhere;')
    expect(css).toContain('width: 22px;')
  })

  test('Table preserves hidden columns in flat row details or explicit scroll', () => {
    const css = compileThemeFile('table.scss')

    expect(css).toContain('@container (max-width: 639px)')
    expect(css).toContain('col[data-responsive-priority=secondary]')
    expect(css).toContain('.el-table__responsive-detail-row.is-expanded')
    expect(css).toContain('min-width: 40px;')
    expect(css).toContain('min-height: 40px;')
    expect(css).toContain('.el-table--responsive-scroll')
    expect(css).toContain('width: 22px;')
  })

  test('Pagination converges by container width without shrinking hit targets', () => {
    const css = compileThemeFile('pagination.scss')

    expect(css).toContain('.el-pagination--responsive-auto')
    expect(css).toContain('@container (max-width: 359px)')
    expect(css).toContain(
      '@container (min-width: 360px) and (max-width: 559px)',
    )
    expect(css).toContain(
      '@container (min-width: 560px) and (max-width: 767px)',
    )
    expect(css).toContain('@container (min-width: 768px)')
    expect(css).toContain('min-width: 40px;')
    expect(css).toContain('height: 40px;')
    expect(css).toContain('width: 60px;')
  })
})
