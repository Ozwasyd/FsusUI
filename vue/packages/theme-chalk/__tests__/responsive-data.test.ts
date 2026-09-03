import { existsSync, readFileSync } from 'node:fs'
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

  test('Descriptions dist artifact preserves container queries and keeps stack hidden by default', () => {
    const distCssPath = path.resolve(dirname, '../dist/el-descriptions.css')
    if (existsSync(distCssPath)) {
      const distCss = readFileSync(distCssPath, 'utf8')
      expect(distCss).toContain('@container (max-width: 559px)')
      const withoutContainerQuery = distCss.replace(
        /@container[^{]+\{[\s\S]*?\}\}/g,
        '',
      )
      expect(withoutContainerQuery).not.toContain(
        '.el-descriptions--responsive-auto .el-descriptions__stack',
      )
    }
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

  test('Calendar uses a two-row mobile grid with aligned 40px controls', () => {
    const css = compileThemeFile('calendar.scss')

    expect(css).toContain('@container (max-width: 559px)')
    expect(css).toContain('grid-template-rows: auto auto;')
    expect(css).toContain('padding: 16px;')
    expect(css).toContain('font-size: 16px;')
    expect(css).toContain('font-weight: 700;')
    expect(css).toContain('gap: 8px;')
    expect(css).toContain('min-width: 40px;')
    expect(css).toContain('min-height: 40px;')
    expect(css).toContain(
      '.el-calendar .el-calendar-table thead th {\n    overflow-wrap: anywhere;',
    )
    expect(css).toContain('height: max(40px, var(--el-calendar-cell-width));')
  })
})
