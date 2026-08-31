import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_HTML_CONVERSION_MAP,
  MARKDOWN_HTML_CONVERSION_VERSION,
  convertMarkdownHtmlImportSnapshot,
  evaluateMarkdownHtmlConversionMutations,
} from '../markdown-html-convert'
import { getMarkdownXssSourceUrl } from '../../../tests/support/markdown-xss-corpus'

const stableNow = () => 0

describe('markdown HTML import conversion', () => {
  it('maps headings, emphasis, lists, quotes, code, tables, and safe links deterministically', () => {
    const html =
      '<h1>Title</h1><p>Hello <strong>world</strong> and <em>you</em> and <s>old</s></p>' +
      '<ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>' +
      '<blockquote><p>quoted</p></blockquote><pre><code>line</code></pre>' +
      '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>' +
      '<p><a href="https://example.com">site</a></p>'
    const result = convertMarkdownHtmlImportSnapshot(
      { html, explicit: true },
      { now: stableNow },
    )
    expect(result.mappingVersion).toBe(MARKDOWN_HTML_CONVERSION_VERSION)
    expect(result.markdown).toContain('# Title')
    expect(result.markdown).toContain('**world**')
    expect(result.markdown).toContain('*you*')
    expect(result.markdown).toContain('~~old~~')
    expect(result.markdown).toContain('- one')
    expect(result.markdown).toContain('1. first')
    expect(result.markdown).toContain('> quoted')
    expect(result.markdown).toContain('```')
    expect(result.markdown).toContain('| A | B |')
    expect(result.markdown).toContain('[site](https://example.com)')
    expect(result.markdown).not.toMatch(/<[a-z]/i)
    expect(Object.keys(MARKDOWN_HTML_CONVERSION_MAP).length).toBeGreaterThan(10)
    const again = convertMarkdownHtmlImportSnapshot(
      { html, explicit: true },
      { now: stableNow },
    )
    expect(again.markdown).toBe(result.markdown)
  })

  it('converts Word, Google Docs, and browser fixtures and never emits data URLs', () => {
    const word = convertMarkdownHtmlImportSnapshot({
      html: '<html><body><div class="WordSection1"><p class="MsoNormal">Hello <b>world</b></p></div></body></html>',
      sourceApplication: 'MicrosoftWord',
      explicit: true,
    })
    expect(word.markdown).toContain('Hello **world**')
    expect(word.losses.some((item) => item.kind === 'flattened' || item.kind === 'removed')).toBe(
      true,
    )

    const gdocs = convertMarkdownHtmlImportSnapshot({
      html: '<b id="docs-internal-guid-abc"><p dir="ltr">Hi <span>there</span></p></b>',
      sourceApplication: 'GoogleDocs',
      explicit: true,
    })
    expect(gdocs.markdown).toContain('**Hi there**')

    const browser = convertMarkdownHtmlImportSnapshot({
      html: '<p>Note</p><img src="https://cdn.example/a.png" alt="diagram"><img src="data:image/png;base64,aaaa" alt="inline">',
      explicit: true,
    })
    expect(browser.markdown).toContain('![diagram](https://cdn.example/a.png)')
    expect(browser.markdown).not.toMatch(/data:image/)
    expect(browser.attachments.some((item) => item.href === 'https://cdn.example/a.png')).toBe(true)
    expect(browser.attachments.some((item) => item.alt === 'inline' && !item.href)).toBe(true)
    expect(browser.losses.some((item) => item.code === 'image-data-url')).toBe(true)
    expect(browser.losses.some((item) => item.kind === 'removed')).toBe(true)
  })

  it('uses the same URL authority and keeps wrapper compatibility loss codes', () => {
    const javascriptUrl = getMarkdownXssSourceUrl(
      'mxss-url-javascript-link',
    )
    const unsafe = convertMarkdownHtmlImportSnapshot({
      html: `<a href="${javascriptUrl}">click</a><a href="https://ok.example">ok</a>`,
      explicit: true,
    })
    expect(unsafe.markdown).toContain('[ok](https://ok.example)')
    expect(unsafe.markdown).toContain('click')
    expect(unsafe.markdown).not.toMatch(/javascript:/)
    expect(unsafe.losses.some((item) => item.code === 'unsafe-url')).toBe(true)
  })

  it('kills silent loss, unsafe URLs, HTML output, remote conversion, and consumer converters', () => {
    const report = evaluateMarkdownHtmlConversionMutations('<p>Keep</p>')
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'silent-loss',
      'unsafe-url',
      'html-output',
      'remote-conversion',
      'consumer-converter',
    ])
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
  })
})
