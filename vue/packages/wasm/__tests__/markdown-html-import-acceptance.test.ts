import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  MARKDOWN_HTML_CONVERSION_BUDGET,
  convertMarkdownHtmlImportSnapshot,
  convertMarkdownHtmlImportTree,
} from '../markdown-html-convert'
import {
  MARKDOWN_HTML_IMPORT_BUDGET,
  importMarkdownClipboardSnapshot,
} from '../markdown-html-import'

const lossCodes = (
  result: ReturnType<typeof convertMarkdownHtmlImportSnapshot>,
) => result.losses.map((item) => item.code)

const assertImportOwnership = (sources: {
  manifest: string
  importer: string
  converter: string
  adapter: string
}) => {
  expect(sources.manifest).not.toMatch(
    /turndown|html-to-markdown|unified.*rehype/i,
  )
  expect(sources.importer + sources.converter).not.toMatch(
    /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|innerHTML\s*=/,
  )
  expect(sources.adapter.match(/markdown-html-convert/g)).toHaveLength(1)
  expect(sources.adapter).toMatch(/convertMarkdownHtmlImportSnapshot/)
}

describe('markdown HTML import aggregate acceptance corpus', () => {
  it.each([
    {
      name: 'Microsoft Word',
      sourceApplication: 'Microsoft Word',
      html: [
        '<html><body><div class="WordSection1">',
        '<h1>Quarterly brief</h1>',
        '<p class="MsoNormal">Alpha <b>bold</b><br>line</p>',
        '<ol start="3"><li>Third</li></ol>',
        '<table><tr><th>Key</th><th>Value</th></tr><tr><td>A</td><td>1</td></tr></table>',
        '</div></body></html>',
      ].join(''),
      expectedMarkdown:
        '# Quarterly brief\n\nAlpha **bold**\nline\n\n3. Third\n\n| Key | Value |\n| --- | --- |\n| A | 1 |\n',
      expectedLosses: [
        'tag:html',
        'tag:body',
        'attr:class',
        'attr:class',
        'wrapper:div',
      ],
    },
    {
      name: 'Google Docs',
      sourceApplication: 'Google Docs',
      html: [
        '<b id="docs-internal-guid-1">',
        '<p dir="ltr">Heading <span style="font-weight:700">text</span></p></b>',
        '<ul><li>One</li><li>Two</li></ul>',
        '<blockquote><p>Quoted</p></blockquote>',
      ].join(''),
      expectedMarkdown: '**Heading text**\n\n- One\n- Two\n\n> Quoted\n',
      expectedLosses: ['attr:id', 'attr:dir', 'attr:style', 'wrapper:span'],
    },
    {
      name: 'browser rich selection',
      sourceApplication: 'Chromium',
      html: [
        '<h2>Browser</h2>',
        '<p><a href="https://example.com/path">safe link</a> and <code>x()</code></p>',
        '<pre><code>const y = 1\n</code></pre>',
        '<figure><img src="https://cdn.example/image.png" alt="diagram"><figcaption>Caption</figcaption></figure>',
      ].join(''),
      expectedMarkdown:
        '## Browser\n\n[safe link](https://example.com/path) and `x()`\n\n```\nconst y = 1\n```\n\n![diagram](https://cdn.example/image.png)Caption\n',
      expectedLosses: ['wrapper:figure'],
    },
  ])('converts $name with exact Markdown and loss reporting', (fixture) => {
    const result = convertMarkdownHtmlImportSnapshot({
      explicit: true,
      html: fixture.html,
      sourceApplication: fixture.sourceApplication,
    })

    expect(result.markdown).toBe(fixture.expectedMarkdown)
    expect(lossCodes(result)).toEqual(fixture.expectedLosses)
  })

  it('keeps malformed and whitespace-heavy input deterministic without rewriting outside bytes', () => {
    const html =
      '<p>alpha&nbsp;&nbsp; beta</p><div>tail  \n</div><unknown><b>kept</b></unknown><p unclosed="yes">end'
    const first = convertMarkdownHtmlImportSnapshot({ explicit: true, html })
    const second = convertMarkdownHtmlImportSnapshot({ explicit: true, html })

    expect(second).toEqual(first)
    expect(first.markdown).toBe('alpha beta\n\ntail \n**kept**end\n')
    expect(lossCodes(first)).toEqual([
      'tag:unknown',
      'attr:unclosed',
      'wrapper:div',
    ])
  })

  it('does not execute or request active content, encoded schemes, CSS URLs, or repeated forbidden tags', () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network must not run'))
    const outcome = importMarkdownClipboardSnapshot({
      explicit: true,
      html: [
        '<script>globalThis.__executed = true</script>',
        '<script src="https://evil.example/a.js">again()</script>',
        '<svg><a xlink:href="javascript:alert(1)">svg</a></svg>',
        '<iframe srcdoc="<script>top.x=1</script>" src="https://evil.example/frame"></iframe>',
        '<p style="background:url(https://evil.example/pixel)">safe text</p>',
        '<a href="jav&#x61;script&#58;alert(1)">encoded</a>',
        '<a href="java&NewLine;script:alert(1)">newline</a>',
        '<img src="data:image/svg+xml,&lt;svg onload=alert(1)&gt;" alt="blocked">',
      ].join(''),
    })

    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const serialized = JSON.stringify(outcome.tree)
    expect(serialized).not.toMatch(
      /script|svg|iframe|srcdoc|javascript:|data:image|url\s*\(/i,
    )
    expect(outcome.findings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'tag:script',
        'tag:svg',
        'tag:iframe',
        'css-url',
        'dangerous-scheme',
      ]),
    )
    expect(fetch).not.toHaveBeenCalled()
    fetch.mockRestore()
  })

  it('enforces UTF-8 byte, node, depth, table-cell, image, time, and cancellation budgets', () => {
    const exactTenMegabytes = 'x'.repeat(MARKDOWN_HTML_IMPORT_BUDGET.maxBytes)
    const exact = importMarkdownClipboardSnapshot(
      { explicit: true, html: exactTenMegabytes },
      { now: () => 0 },
    )
    expect(exact.ok).toBe(true)
    expect(exact.stats.bytes).toBe(MARKDOWN_HTML_IMPORT_BUDGET.maxBytes)

    const utf8Overflow = importMarkdownClipboardSnapshot({
      explicit: true,
      html: '界'.repeat(
        Math.ceil(MARKDOWN_HTML_IMPORT_BUDGET.maxBytes / 3) + 1,
      ),
    })
    expect(utf8Overflow).toMatchObject({ ok: false, code: 'budget-bytes' })

    const baseBudget = {
      ...MARKDOWN_HTML_IMPORT_BUDGET,
      maxMs: Number.MAX_SAFE_INTEGER,
    }
    expect(
      importMarkdownClipboardSnapshot(
        { explicit: true, html: '<p>a</p><p>b</p>' },
        { budget: { ...baseBudget, maxNodes: 3 } },
      ),
    ).toMatchObject({ ok: false, code: 'budget-nodes' })
    expect(
      importMarkdownClipboardSnapshot(
        {
          explicit: true,
          html: '<table><tr><td>a</td><td>b</td></tr></table>',
        },
        { budget: { ...baseBudget, maxTableCells: 1 } },
      ),
    ).toMatchObject({ ok: false, code: 'budget-table-cells' })
    expect(
      importMarkdownClipboardSnapshot(
        { explicit: true, html: '<img alt="a"><img alt="b">' },
        { budget: { ...baseBudget, maxImages: 1 } },
      ),
    ).toMatchObject({ ok: false, code: 'budget-images' })

    let deep = 'text'
    for (
      let index = 0;
      index <= MARKDOWN_HTML_IMPORT_BUDGET.maxDepth;
      index += 1
    ) {
      deep = `<div>${deep}</div>`
    }
    expect(
      importMarkdownClipboardSnapshot({ explicit: true, html: deep }),
    ).toMatchObject({
      ok: false,
      code: 'budget-depth',
    })

    const timed = importMarkdownClipboardSnapshot(
      { explicit: true, html: '<p>a</p><p>b</p>' },
      {
        now: (() => {
          let tick = 0
          return () => tick++ * (MARKDOWN_HTML_IMPORT_BUDGET.maxMs + 1)
        })(),
      },
    )
    expect(timed).toMatchObject({ ok: false, code: 'budget-time' })

    const task = { cancelled: false }
    const cancelled = importMarkdownClipboardSnapshot(
      { explicit: true, html: '<p>a</p><p>b</p><p>c</p>' },
      {
        task,
        now: (() => {
          let tick = 0
          return () => {
            tick += 1
            if (tick === 4) task.cancelled = true
            return 0
          }
        })(),
      },
    )
    expect(cancelled).toMatchObject({ ok: false, code: 'cancelled' })
  })

  it('fails conversion closed on cancellation and numeric node/time budgets', () => {
    const imported = importMarkdownClipboardSnapshot({
      explicit: true,
      html: '<p>one</p><p>two</p><p>three</p>',
    })
    expect(imported.ok).toBe(true)
    if (!imported.ok) return

    const task = { cancelled: true }
    const cancelled = convertMarkdownHtmlImportTree(imported.tree, { task })
    expect(cancelled.markdown).toBe('')
    expect(lossCodes(cancelled)).toContain('cancelled')

    const nodeLimited = convertMarkdownHtmlImportTree(imported.tree, {
      budget: { ...MARKDOWN_HTML_CONVERSION_BUDGET, maxNodes: 1 },
    })
    expect(lossCodes(nodeLimited)).toContain('budget-nodes')

    const timed = convertMarkdownHtmlImportTree(imported.tree, {
      now: (() => {
        let tick = 0
        return () => tick++ * (MARKDOWN_HTML_CONVERSION_BUDGET.maxMs + 1)
      })(),
    })
    expect(lossCodes(timed)).toContain('budget-time')
  })

  it('kills remote-conversion and consumer-local-importer mutations at the owner boundary', () => {
    const sources = {
      manifest: readFileSync(resolve('package.json'), 'utf8'),
      importer: readFileSync(
        resolve('vue/packages/wasm/markdown-html-import.ts'),
        'utf8',
      ),
      converter: readFileSync(
        resolve('vue/packages/wasm/markdown-html-convert.ts'),
        'utf8',
      ),
      adapter: readFileSync(
        resolve(
          'vue/packages/components/markdown-editor/src/markdown-editor-paste-markdown.ts',
        ),
        'utf8',
      ),
    }

    expect(() => assertImportOwnership(sources)).not.toThrow()
    expect(() =>
      assertImportOwnership({
        ...sources,
        converter: `${sources.converter}\nfetch('https://converter.example')`,
      }),
    ).toThrow()
    expect(() =>
      assertImportOwnership({
        ...sources,
        manifest: `${sources.manifest}\n"turndown": "latest"`,
      }),
    ).toThrow()
    expect(() =>
      assertImportOwnership({
        ...sources,
        adapter: sources.adapter.replace(
          /convertMarkdownHtmlImportSnapshot/g,
          'consumerLocalHtmlConverter',
        ),
      }),
    ).toThrow()
  })
})
