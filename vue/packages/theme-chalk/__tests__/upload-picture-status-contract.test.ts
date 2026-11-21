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

const extractAtRuleBodies = (css: string, headerPattern: RegExp) => {
  const bodies: string[] = []
  const pattern = new RegExp(
    headerPattern.source,
    `${headerPattern.flags.replace('g', '')}g`,
  )
  for (const match of css.matchAll(pattern)) {
    const openBrace = css.indexOf('{', match.index ?? 0)
    if (openBrace < 0) continue
    let depth = 0
    for (let index = openBrace; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1
      else if (css[index] === '}') {
        depth -= 1
        if (depth === 0) {
          bodies.push(css.slice(openBrace + 1, index))
          break
        }
      }
    }
  }
  return bodies
}

const stripAtRuleBlocks = (css: string, headerPattern: RegExp) => {
  let result = ''
  let cursor = 0
  const pattern = new RegExp(
    headerPattern.source,
    `${headerPattern.flags.replace('g', '')}g`,
  )
  for (const match of css.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start < cursor) continue
    const openBrace = css.indexOf('{', start)
    if (openBrace < 0) continue
    let depth = 0
    let end = -1
    for (let index = openBrace; index < css.length; index += 1) {
      if (css[index] === '{') depth += 1
      else if (css[index] === '}') {
        depth -= 1
        if (depth === 0) {
          end = index + 1
          break
        }
      }
    }
    if (end > start) {
      result += css.slice(cursor, start)
      cursor = end
    }
  }
  return result + css.slice(cursor)
}

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

const assertPictureCardStatusAndTouchContract = (css: string) => {
  const allRules = rules(css)

  // 1. picture-card supports .is-fail danger border + status styling.
  const failBorderRules = allRules.filter(
    ({ selector }) =>
      selector.includes('.el-upload-list--picture-card') &&
      selector.includes('.el-upload-list__item.is-fail') &&
      !selector.includes('.el-upload-list__item-status-label'),
  )
  expect(failBorderRules.length).toBeGreaterThan(0)
  expect(failBorderRules.map(({ body }) => body).join('\n')).toMatch(
    /border-color:\s*var\(--el-color-danger\)/,
  )

  const failStatusRules = allRules.filter(
    ({ selector }) =>
      selector.includes('.el-upload-list--picture-card') &&
      selector.includes('.el-upload-list__item.is-fail') &&
      selector.includes('.el-upload-list__item-status-label'),
  )
  expect(failStatusRules.length).toBeGreaterThan(0)
  const failStatusBody = failStatusRules.map(({ body }) => body).join('\n')
  expect(failStatusBody).toMatch(/display:\s*inline-flex/)
  expect(failStatusBody).toMatch(/opacity:\s*1/)
  expect(failStatusBody).toMatch(/var\(--el-color-danger\)/)

  // 2. picture-card retains status visibility on hover and focus-within.
  for (const state of ['is-success', 'is-fail']) {
    for (const pseudo of [':hover', ':focus-within']) {
      const matching = allRules.filter(
        ({ selector }) =>
          selector.includes('.el-upload-list--picture-card') &&
          selector.includes(`.el-upload-list__item.${state}${pseudo}`) &&
          selector.includes('.el-upload-list__item-status-label'),
      )
      expect(matching.length).toBeGreaterThan(0)
      const body = matching.map((rule) => rule.body).join('\n')
      expect(body).toMatch(/display:\s*inline-flex/)
      expect(body).toMatch(/opacity:\s*1/)
    }
  }

  // No hover/focus hide rule may match picture-card status labels.
  const hideStatusRules = allRules.filter(
    ({ selector, body }) =>
      selector.includes('.el-upload-list__item-status-label') &&
      (selector.includes(':hover') || selector.includes(':focus-within')) &&
      /display:\s*none/.test(body),
  )
  for (const { selector } of hideStatusRules) {
    expect(selector).toMatch(/:not\([^)]*\.el-upload-list--picture-card[^)]*\)/)
  }

  const cardStatusBase = allRules
    .filter(
      ({ selector }) =>
        selector ===
        '.el-upload-list--picture-card .el-upload-list__item-status-label',
    )
    .map(({ body }) => body)
    .join('\n')
  expect(cardStatusBase).toMatch(/transform:\s*none/)

  // 3. @media (pointer: coarse) bumps picture-card action targets to >=40px (44px)
  //    while desktop stays 32px.
  const coarsePattern = /@media\s*\(\s*pointer:\s*coarse\s*\)\s*\{/g
  const coarseCss = extractAtRuleBodies(css, coarsePattern).join('\n')
  const coarseCardButtons = rules(coarseCss).filter(
    ({ selector }) =>
      selector.includes('.el-upload-list--picture-card') &&
      selector.includes('.el-upload-list__item-actions') &&
      selector.includes('button'),
  )
  expect(coarseCardButtons.length).toBeGreaterThan(0)
  const coarseBody = coarseCardButtons.map(({ body }) => body).join('\n')
  const coarseWidth = Number(
    /(?:min-)?width:\s*(\d+)px/.exec(coarseBody)?.[1] ?? 0,
  )
  const coarseHeight = Number(
    /(?:min-)?height:\s*(\d+)px/.exec(coarseBody)?.[1] ?? 0,
  )
  expect(coarseWidth).toBeGreaterThanOrEqual(40)
  expect(coarseHeight).toBeGreaterThanOrEqual(40)
  expect(coarseWidth).toBeGreaterThanOrEqual(44)
  expect(coarseHeight).toBeGreaterThanOrEqual(44)

  const desktopCss = stripAtRuleBlocks(css, coarsePattern)
  const desktopCardButtons = rules(desktopCss).filter(
    ({ selector }) =>
      selector.includes('.el-upload-list--picture-card') &&
      selector.includes('.el-upload-list__item-actions') &&
      selector.includes('button'),
  )
  expect(desktopCardButtons.length).toBeGreaterThan(0)
  const desktopBody = desktopCardButtons.map(({ body }) => body).join('\n')
  expect(desktopBody).toMatch(/width:\s*32px/)
  expect(desktopBody).toMatch(/height:\s*32px/)

  // 4. Legacy dark hover-only .el-upload-cover__interact overlay is retired.
  const legacyCoverInteract = allRules.filter(({ selector }) =>
    /upload-cover__interact/.test(selector),
  )
  expect(legacyCoverInteract).toEqual([])
}

describe('picture success status production CSS (#300)', () => {
  test.each(['upload.scss', 'index.scss', 'fsus.scss'])(
    '%s ships no rotated success ribbon and meets picture-card status/touch contracts',
    (entry) => {
      const css = compile(path.join(themeDir, entry), {
        loadPaths: [themeDir],
        style: 'compressed',
      }).css
      assertNoRibbon(css)
      assertPictureCardStatusAndTouchContract(css)
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

  test.each([
    [
      'legacy dark hover-only cover interact overlay',
      '.el-upload-cover__interact { background-color: rgba(0, 0, 0, 0.5); }',
    ],
    [
      'unscoped hover hide on success status label',
      '.el-upload-list__item.is-success:hover .el-upload-list__item-status-label { display: none; }',
    ],
  ])('rejects reintroduced %s', (_name, mutation) => {
    const css = compileString(
      `${readFileSync(uploadPath, 'utf8')}\n${mutation}`,
      { url: pathToFileURL(uploadPath), loadPaths: [themeDir] },
    ).css
    expect(() => assertPictureCardStatusAndTouchContract(css)).toThrow()
  })
})
