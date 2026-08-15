import { describe, expect, it } from 'vitest'

import {
  compareMarkdownEditorProjectionThreads,
  createMarkdownEditorProjection,
  createMarkdownEditorWorkerProjection,
  markdownEditorProjectionsEquivalent,
} from '../markdown-runtime'

const fixtures = [
  '\uFEFF# Title\r\nworker',
  '\uFEFF# Title\r\n\nA paragraph.\r\n\n- one\r\n- two\r\n\n| h |\r\n| --- |\r\n| c |\n',
  '\uFEFF```mermaid\r\nflowchart LR\r\n```\n\n$$\na^2\n$$',
  '\uFEFFSee [docs](https://x.test) and ![alt](img.png) and a note.[^n]\r\n\n[^n]: footnote body\n\n[broken](http://x\n',
  '> quoted line\n\n::p\nexplicit\n::\n',
] as const

describe('markdown editor projection worker semantic matrix', () => {
  it('keeps main-thread and Worker projections semantically equivalent after transfer', () => {
    for (const raw of fixtures) {
      const compared = compareMarkdownEditorProjectionThreads(raw)
      expect(compared.equivalent).toBe(true)
      expect(
        markdownEditorProjectionsEquivalent(compared.main, compared.worker),
      ).toBe(true)
      expect(compared.worker.identity).toEqual(compared.main.identity)
      expect(compared.worker.nodes.map((node) => node.kind)).toEqual(
        compared.main.nodes.map((node) => node.kind),
      )
      expect(compared.worker.nodes.map((node) => node.rawRange)).toEqual(
        compared.main.nodes.map((node) => node.rawRange),
      )
      expect(compared.worker.syntaxCoverage).toEqual(compared.main.syntaxCoverage)
    }
  })

  it('does not treat a different source or HTML-only clone as equivalent', () => {
    const raw = '# Title\n\nA paragraph.\n'
    const main = createMarkdownEditorProjection(raw)
    const worker = createMarkdownEditorWorkerProjection(raw)
    const other = createMarkdownEditorWorkerProjection('# Other\n')

    expect(markdownEditorProjectionsEquivalent(main, worker)).toBe(true)
    expect(markdownEditorProjectionsEquivalent(main, other)).toBe(false)
    expect(
      markdownEditorProjectionsEquivalent(main, {
        ...worker,
        identity: { ...worker.identity, rawSource: '<h1>Title</h1>' },
      }),
    ).toBe(false)
  })
})
