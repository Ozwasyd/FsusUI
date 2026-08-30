import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_EMBED_PRESENTATION_MODES,
  evaluateMarkdownEmbedPresentationMutations,
  resolveMarkdownEmbedPresentation,
} from '../markdown-embed-presentation'
import { collectMarkdownEmbedNodes } from '../markdown-embed-directive'
import type { MarkdownEmbedResult } from '../markdown-embed-provider'

const directiveOf = (target: string, mode: string) =>
  `::embed[target="${target}" mode="${mode}"]`

const resolvedResult = (
  target: string,
  mode: 'article' | 'heading' | 'block',
): MarkdownEmbedResult => ({
  requestId: `${target}:1:n1:1`,
  status: 'resolved',
  target,
  mode,
  version: 1,
  documentIdentity: { id: 'doc', epoch: 1 },
  revision: 1,
  nodeId: 'n1',
  title: `${target} title`,
  excerpt: `# ${target}\n\nBody with [link](https://x.test).\n`,
})

const nodeOf = (source: string) => {
  const nodes = collectMarkdownEmbedNodes(source)
  const node = nodes[0]!
  if (!node.ok) throw new Error('expected valid embed node')
  return node
}

describe('markdown embed presentation contract', () => {
  it('keeps every mode a semantic label, not a visual variant', () => {
    const source = directiveOf('note', 'article')
    const node = nodeOf(source)
    const signatures = (['article', 'heading', 'block'] as const).map(
      (mode) => {
        const presentation = resolveMarkdownEmbedPresentation(
          {
            kind: 'valid',
            node: { ...node, mode },
            result: resolvedResult('note', mode),
          },
          'live',
        )
        return JSON.stringify({
          actions: presentation.actions,
          content: presentation.content,
          layout: presentation.layout,
        })
      },
    )
    expect(new Set(signatures).size).toBe(1)
    const presentation = resolveMarkdownEmbedPresentation(
      { kind: 'valid', node, result: resolvedResult('note', 'article') },
      'live',
    )
    expect(presentation.layout).toEqual({
      columns: 1,
      modeAsVisualVariant: false,
      nestedScroll: 'none',
      surface: 'controlled-markdown',
    })
  })

  it('never carries provider HTML and always routes content through the runtime', () => {
    const node = nodeOf(directiveOf('note', 'article'))
    const hostile = resolvedResult('note', 'article')
    const presentation = resolveMarkdownEmbedPresentation(
      {
        kind: 'valid',
        node,
        result: {
          ...hostile,
          excerpt: '<img src=x onerror=alert(1)><script>alert(2)</script>',
          title: '<style>body{}</style>',
        },
      },
      'live',
    )
    expect(presentation.content.html).toBe(null)
    expect(presentation.content.renderVia).toBe('markdown-runtime')
    expect(presentation.content.editable).toBe(false)
    expect(presentation.content.excerpt).toBe(
      '<img src=x onerror=alert(1)><script>alert(2)</script>',
    )
  })

  it('maps provider and local failure states to actionable presentations', () => {
    const node = nodeOf(directiveOf('note', 'article'))
    const pending = resolveMarkdownEmbedPresentation(
      { kind: 'valid', node },
      'live',
    )
    expect(pending.state).toBe('pending')
    expect(pending.actions.retry).toBe(false)
    expect(pending.actions.openSource).toBe(true)

    const stale = resolveMarkdownEmbedPresentation(
      {
        kind: 'valid',
        node,
        result: { ...resolvedResult('note', 'article'), status: 'stale' },
      },
      'live',
    )
    expect(stale.state).toBe('stale')
    expect(stale.actions.retry).toBe(true)

    const forbidden = resolveMarkdownEmbedPresentation(
      {
        kind: 'valid',
        node,
        result: { ...resolvedResult('note', 'article'), status: 'forbidden' },
      },
      'live',
    )
    expect(forbidden.state).toBe('forbidden')
    expect(forbidden.actions.retry).toBe(true)
    expect(forbidden.accessibility.statusDescription).toContain('forbidden')

    const missing = resolveMarkdownEmbedPresentation(
      {
        kind: 'valid',
        node,
        result: { ...resolvedResult('note', 'article'), status: 'rejected' },
      },
      'live',
    )
    expect(missing.state).toBe('error')
    expect(missing.actions.retry).toBe(true)
    expect(missing.accessibility.statusDescription).toContain('missing')

    const cycle = resolveMarkdownEmbedPresentation(
      {
        kind: 'local-failure',
        failure: 'cycle',
        target: 'note',
        embedMode: 'article',
        directive: directiveOf('note', 'article'),
      },
      'live',
    )
    expect(cycle.state).toBe('error')
    expect(cycle.actions.retry).toBe(true)
    expect(cycle.accessibility.statusDescription).toContain('cycle')

    const mismatch = resolveMarkdownEmbedPresentation(
      {
        kind: 'local-failure',
        failure: 'mode-mismatch',
        target: 'note',
        embedMode: 'article',
        directive: directiveOf('note', 'article'),
      },
      'live',
    )
    expect(mismatch.state).toBe('unsupported')
    expect(mismatch.actions.openSource).toBe(true)
  })

  it('reads target mode, source, status and open-source to screen readers without a tab stop', () => {
    const node = nodeOf(directiveOf('note', 'heading'))
    const presentation = resolveMarkdownEmbedPresentation(
      { kind: 'valid', node, result: resolvedResult('note', 'heading') },
      'split',
    )
    expect(presentation.accessibility.name).toBe('embedded heading note')
    expect(presentation.accessibility.role).toBe('figure')
    expect(presentation.accessibility.status).toBe('resolved')
    expect(presentation.accessibility.tabStop).toBe(false)
    expect(presentation.accessibility.openSourceOperation).toBe('enter-source')
    expect(presentation.directive).toBe(directiveOf('note', 'heading'))
  })

  it('supports exactly the documented presentation modes', () => {
    expect([...MARKDOWN_EMBED_PRESENTATION_MODES]).toEqual([
      'source',
      'live',
      'split',
      'preview',
    ])
  })

  it('kills iframe, second-editor, innerHTML, mode-card and source-expansion mutations', () => {
    const report = evaluateMarkdownEmbedPresentationMutations()
    for (const mutation of report.mutations) {
      expect(mutation.accepted).toBe(false)
      expect(mutation.equivalent).toBe(false)
    }
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'iframe',
      'second-editor',
      'innerHTML',
      'mode-card',
      'source-expansion',
    ])
  })
})
