import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorProjection,
  evaluateMarkdownProjectionMutations,
  markdownProjectionHasCompleteCoverage,
} from '../markdown-runtime'

describe('markdown editor projection mutation fixtures', () => {
  it('rejects HTML reverse, regex second parser, and missing coverage', () => {
    const raw =
      '# Title\n\n# Title\n\nNot \\[escaped](no) and `[code](no)` then [same](a) and [same](b)\n'
    const report = evaluateMarkdownProjectionMutations(raw)
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )

    expect(report.authority.identity.rawSource).toBe(raw)
    expect(markdownProjectionHasCompleteCoverage(report.authority)).toBe(true)
    expect(byKind['html-dom-reverse']?.equivalent).toBe(false)
    expect(byKind['html-dom-reverse']?.accepted).toBe(false)
    expect(byKind['html-innerhtml-reverse']?.equivalent).toBe(false)
    expect(byKind['html-innerhtml-reverse']?.accepted).toBe(false)
    expect(byKind['dom-path-reverse']?.equivalent).toBe(false)
    expect(byKind['dom-path-reverse']?.accepted).toBe(false)
    expect(byKind['second-parser-regex']?.equivalent).toBe(false)
    expect(byKind['second-parser-regex']?.accepted).toBe(false)
    expect(byKind['missing-syntax-coverage']?.accepted).toBe(false)
    expect(byKind['missing-syntax-coverage']?.equivalent).toBe(false)

    const links = report.authority.nodes.filter((node) => node.kind === 'link')
    expect(links).toHaveLength(2)
    expect(raw.slice(links[0]!.rawRange.start, links[0]!.rawRange.end)).toBe(
      '[same](a)',
    )
    expect(raw.slice(links[1]!.rawRange.start, links[1]!.rawRange.end)).toBe(
      '[same](b)',
    )
    expect(links[1]!.rawRange.start).not.toBe(raw.indexOf('same'))
    expect(
      report.authority.nodes.some(
        (node) =>
          node.kind === 'link' &&
          raw.slice(node.rawRange.start, node.rawRange.end).includes('escaped'),
      ),
    ).toBe(false)
  })

  it('does not accept an HTML-derived guess that snaps both headings to the first Title', () => {
    const raw = '\uFEFF# Title\r\n\n# Title\n'
    const report = evaluateMarkdownProjectionMutations(raw)
    const headings = report.authority.nodes.filter((node) => node.kind === 'heading')
    expect(headings).toHaveLength(2)
    expect(headings[0]!.rawRange.start).not.toBe(headings[1]!.rawRange.start)
    expect(raw.indexOf('Title')).toBeGreaterThanOrEqual(headings[0]!.rawRange.start)
    expect(headings[1]!.rawRange.start).not.toBe(raw.indexOf('Title'))
    expect(
      report.mutations.find((mutation) => mutation.kind === 'html-dom-reverse')
        ?.equivalent,
    ).toBe(false)
    expect(createMarkdownEditorProjection(raw).nodes.map((node) => node.kind)).toEqual(
      report.authority.nodes.map((node) => node.kind),
    )
  })

  it('rejects innerHTML offsets and DOM-path reverse engineering', () => {
    const raw = [
      '# Title',
      '',
      '- Title',
      '',
      '> Title',
      '',
      '| Title | Title |',
      '| ----- | ----- |',
      '| Title | Title |',
      '',
      '[same](a) and [same](b)',
      '',
      'Not \\[escaped](no)',
    ].join('\n')
    const report = evaluateMarkdownProjectionMutations(raw)
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    const headings = report.authority.nodes.filter((node) => node.kind === 'heading')
    const lists = report.authority.nodes.filter((node) => node.kind === 'list')
    const quotes = report.authority.nodes.filter((node) => node.kind === 'quote')
    const tables = report.authority.nodes.filter((node) => node.kind === 'table')
    const links = report.authority.nodes.filter((node) => node.kind === 'link')

    expect(headings.length).toBeGreaterThan(0)
    expect(lists.length).toBeGreaterThan(0)
    expect(quotes.length).toBeGreaterThan(0)
    expect(tables.length).toBeGreaterThan(0)
    expect(links).toHaveLength(2)
    expect(raw.slice(headings[0]!.rawRange.start, headings[0]!.rawRange.end)).toContain(
      '# Title',
    )
    expect(raw.slice(lists[0]!.rawRange.start, lists[0]!.rawRange.end)).toContain(
      '- Title',
    )
    expect(headings[0]!.rawRange.start).not.toBe(lists[0]!.rawRange.start)
    expect(links[0]!.rawRange.start).not.toBe(links[1]!.rawRange.start)
    expect(
      report.authority.nodes.some(
        (node) =>
          node.kind === 'link' &&
          raw.slice(node.rawRange.start, node.rawRange.end).includes('escaped'),
      ),
    ).toBe(false)

    expect(byKind['html-innerhtml-reverse']?.equivalent).toBe(false)
    expect(byKind['html-innerhtml-reverse']?.accepted).toBe(false)
    expect(byKind['dom-path-reverse']?.equivalent).toBe(false)
    expect(byKind['dom-path-reverse']?.accepted).toBe(false)
    expect(byKind['html-dom-reverse']?.accepted).toBe(false)
    expect(
      report.mutations.every(
        (mutation) =>
          mutation.kind === 'missing-syntax-coverage' ||
          mutation.equivalent === false,
      ),
    ).toBe(true)
  })
})
