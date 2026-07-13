import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'sass'
import { describe, expect, it } from 'vitest'
import { findFoundationStyleBoundaryViolations } from '../../../../scripts/foundation-style-boundary.mjs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const themeRoot = path.resolve(dirname, '../src')

const compileThemeEntry = (entry: string) =>
  compile(path.join(themeRoot, entry), {
    loadPaths: [themeRoot],
    style: 'expanded',
  }).css

describe('foundation style boundary', () => {
  it.each(['fsus.scss', 'reset.scss'])(
    '%s keeps native content isolated',
    (entry) => {
      expect(
        findFoundationStyleBoundaryViolations(compileThemeEntry(entry), entry),
      ).toEqual([])
    },
  )

  it('rejects global editorial decoration and SVG paint overrides', () => {
    const unsafe = `
      h1 { letter-spacing: -0.06em; }
      h1::after { content: '.'; }
      ul { list-style: none; }
      ul li::before { content: ''; }
      svg { stroke-width: 1.2px; fill: currentColor; }
    `

    expect(
      findFoundationStyleBoundaryViolations(unsafe, 'fixture.css'),
    ).toEqual([
      'fixture.css: global selector "h1" must not set negative letter-spacing',
      'fixture.css: global selector "h1::after" must not inject pseudo-element content',
      'fixture.css: global selector "ul" must not replace native list markers',
      'fixture.css: global selector "ul li::before" must not inject pseudo-element content',
      'fixture.css: global selector "svg" must not override SVG stroke, fill, or paint order',
    ])
  })

  it('allows explicit prose and component icon scopes', () => {
    const scoped = `
      .fsus-prose h1 { letter-spacing: -0.06em; }
      .fsus-prose h1::after { content: '.'; }
      .fsus-prose ul { list-style: none; }
      .el-icon.is-linear > svg { stroke-linecap: round; }
    `

    expect(
      findFoundationStyleBoundaryViolations(scoped, 'fixture.css'),
    ).toEqual([])
  })
})
