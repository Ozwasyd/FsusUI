import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compile, compileString } from 'sass'
import { describe, expect, test } from 'vitest'

const themeDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src',
)
const uploadPath = path.join(themeDir, 'upload.scss')

const rules = (css: string) =>
  Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), ([, selector, body]) => ({
    selector: selector.trim(),
    body,
  }))

const assertNoRibbon = (css: string) => {
  const statusRules = rules(css).filter(
    ({ selector }) =>
      /upload/.test(selector) &&
      /item-status-label|upload-cover__label|upload-success/.test(selector),
  )
  expect(statusRules.length).toBeGreaterThan(0)
  for (const { body } of statusRules) {
    expect(body).not.toMatch(/(?:rotate|skew|matrix)\(/)
    expect(body).not.toMatch(/(?:right|left|top|bottom|inset(?:-\w+)*):\s*-\d/)
  }
  const pictureRules = statusRules.filter(
    ({ selector }) =>
      selector.includes('.el-upload-list--picture ') &&
      selector.endsWith('.el-upload-list__item-status-label'),
  )
  expect(pictureRules.length).toBeGreaterThan(0)
  const picture = pictureRules.map(({ body }) => body).join('\n')
  expect(picture).toMatch(/position:\s*static/)
  expect(picture).toMatch(
    /background:\s*(?:transparent|rgba\(0,\s*0,\s*0,\s*0\))/,
  )
  expect(picture).toMatch(/width:\s*auto/)
  expect(picture).toMatch(/height:\s*auto/)
}

describe('picture success status production CSS (#300)', () => {
  test.each(['upload.scss', 'index.scss', 'fsus.scss'])(
    '%s ships no rotated success ribbon',
    (entry) => {
      assertNoRibbon(
        compile(path.join(themeDir, entry), {
          loadPaths: [themeDir],
          style: 'compressed',
        }).css,
      )
    },
  )

  test.each([
    [
      'picture rotation',
      '.el-upload-list--picture .el-upload-list__item-status-label { transform: rotate(45deg); }',
    ],
    [
      'picture offscreen corner',
      '.el-upload-list--picture .el-upload-list__item-status-label { right: -17px; top: -7px; width: 46px; height: 26px; }',
    ],
    ['cover ribbon', '.el-upload-cover__label { transform: rotate(45deg); }'],
  ])('rejects reintroduced %s', (_name, mutation) => {
    const css = compileString(
      `${readFileSync(uploadPath, 'utf8')}\n${mutation}`,
      { url: pathToFileURL(uploadPath), loadPaths: [themeDir] },
    ).css
    expect(() => assertNoRibbon(css)).toThrow()
  })
})
