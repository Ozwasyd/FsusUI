import { describe, expect, it } from 'vitest'

import type { MarkdownStableProjection } from '../../../wasm/markdown-runtime'
import type { MarkdownEditorSelection } from '../src/markdown-editor-transaction'
import {
  commitMarkdownLanguageToolMutation,
  createMarkdownLanguageToolSession,
  resolveMarkdownLanguageToolCapability,
  resolveMarkdownLanguageToolContextCapability,
} from '../src/markdown-editor-language-tools'

interface FixtureRange {
  readonly end: number
  readonly start: number
}

interface FixtureNode {
  readonly id: string
  readonly kind: string
  readonly presentation:
    | 'live-decorated'
    | 'live-atomic'
    | 'source-only-with-reason'
    | 'unsupported-error'
  readonly rawContentRanges?: readonly FixtureRange[]
  readonly rawMarkerRanges?: readonly FixtureRange[]
  readonly rawRange: FixtureRange
}

const projectionFixture = (
  source: string,
  documentIdentity: { readonly epoch: number; readonly id: string },
  nodes: readonly FixtureNode[] = [],
): MarkdownStableProjection => {
  const stableNodes = nodes.map((node) =>
    Object.freeze({
      childNormalizedRanges: Object.freeze([]),
      childRawRanges: Object.freeze([]),
      id: node.id,
      kind: node.kind,
      normalizedContentRanges: node.rawContentRanges,
      normalizedMarkerRanges: node.rawMarkerRanges,
      normalizedRange: node.rawRange,
      parentNormalizedRange: null,
      parentRawRange: null,
      presentation: node.presentation,
      rawContentRanges: node.rawContentRanges,
      rawMarkerRanges: node.rawMarkerRanges,
      rawRange: node.rawRange,
    }),
  )
  return Object.freeze({
    documentIdentity: Object.freeze(documentIdentity),
    nodes: Object.freeze(stableNodes),
    normalizedSource: source,
    resolve(id: string) {
      const node = stableNodes.find((candidate) => candidate.id === id)
      return node
        ? Object.freeze({ node, status: 'current' as const })
        : Object.freeze({ status: 'invalid' as const })
    },
  }) as MarkdownStableProjection
}

const commitFixture = (options?: {
  readonly currentDocumentIdentity?: {
    readonly epoch: number
    readonly id: string
  }
  readonly currentRevision?: number
  readonly currentSelection?: MarkdownEditorSelection
  readonly documentIdentity?: { readonly epoch: number; readonly id: string }
  readonly from?: number
  readonly isComposing?: boolean
  readonly kind?: 'spellcheck' | 'dictation' | 'writing-tools'
  readonly projection?: MarkdownStableProjection
  readonly projectionRevision?: number
  readonly rawHtml?: string
  readonly revision?: number
  readonly sessionActive?: boolean
  readonly sessionKind?: 'spellcheck' | 'dictation' | 'writing-tools'
  readonly sessionSelection?: MarkdownEditorSelection
  readonly source?: string
  readonly to?: number
}) => {
  const source = options?.source ?? 'Hello wrld'
  const documentIdentity = options?.documentIdentity ?? {
    epoch: 1,
    id: 'commit-doc',
  }
  const from = options?.from ?? 6
  const to = options?.to ?? 10
  const selection = options?.sessionSelection ?? {
    direction: 'none' as const,
    end: to,
    start: from,
  }
  const revision = options?.revision ?? 3
  const session = createMarkdownLanguageToolSession({
    documentIdentity,
    kind: options?.sessionKind ?? 'spellcheck',
    revision,
    selection,
  })
  return commitMarkdownLanguageToolMutation({
    currentDocumentIdentity:
      options?.currentDocumentIdentity ?? documentIdentity,
    currentRevision: options?.currentRevision ?? revision,
    currentSelection: options?.currentSelection ?? selection,
    documentIdentity,
    from,
    insert: 'world',
    isComposing: options?.isComposing,
    kind: options?.kind ?? 'spellcheck',
    projection:
      options?.projection ?? projectionFixture(source, documentIdentity),
    projectionRevision: options?.projectionRevision ?? revision,
    rawHtml: options?.rawHtml,
    revision,
    session:
      options?.sessionActive === false
        ? Object.freeze({ ...session, active: false })
        : session,
    source,
    to,
  })
}

describe('markdown language tool adapter', () => {
  it('exposes the documented capability and configuration states', () => {
    expect(resolveMarkdownLanguageToolCapability()).toMatchObject({
      nativeWritingTools: 'auto',
      spellcheck: true,
      spellcheckMode: 'auto',
      status: 'supported',
    })
    expect(
      resolveMarkdownLanguageToolCapability({
        lang: 'en-US',
        nativeWritingTools: 'disabled',
        spellcheck: 'disabled',
      }),
    ).toEqual({
      autocorrect: false,
      dictation: false,
      lang: 'en-US',
      nativeWritingTools: 'disabled',
      reason: 'disabled',
      spellcheck: false,
      spellcheckMode: 'disabled',
      status: 'unavailable',
    })
  })

  it('requires the caller-owned canonical projection and consumes its ranges', () => {
    const source =
      '# Heading\nNormal prose\n```js\nconst wrld = 1\n```\n[site](https://fsusui.dev)\n$$x$$'
    const identity = { epoch: 1, id: 'context-doc' }
    const markerEnd = 2
    const codeStart = source.indexOf('```js')
    const codeEnd = source.indexOf('```', codeStart + 3) + 3
    const linkStart = source.indexOf('[site]')
    const linkEnd = source.indexOf(')', linkStart) + 1
    const labelStart = linkStart + 1
    const labelEnd = labelStart + 'site'.length
    const targetStart = source.indexOf('https://')
    const targetEnd = source.indexOf(')', targetStart)
    const mathStart = source.indexOf('$$x$$')
    const projection = projectionFixture(source, identity, [
      {
        id: 'heading',
        kind: 'heading',
        presentation: 'live-decorated',
        rawMarkerRanges: [{ end: markerEnd, start: 0 }],
        rawRange: { end: source.indexOf('\n'), start: 0 },
      },
      {
        id: 'code',
        kind: 'code',
        presentation: 'source-only-with-reason',
        rawContentRanges: [{ end: codeEnd - 3, start: codeStart + 6 }],
        rawMarkerRanges: [
          { end: codeStart + 6, start: codeStart },
          { end: codeEnd, start: codeEnd - 3 },
        ],
        rawRange: { end: codeEnd, start: codeStart },
      },
      {
        id: 'link',
        kind: 'link',
        presentation: 'live-decorated',
        rawContentRanges: [
          { end: labelEnd, start: labelStart },
          { end: targetEnd, start: targetStart },
        ],
        rawRange: { end: linkEnd, start: linkStart },
      },
      {
        id: 'math',
        kind: 'latex',
        presentation: 'live-atomic',
        rawContentRanges: [{ end: mathStart + 3, start: mathStart + 2 }],
        rawMarkerRanges: [
          { end: mathStart + 2, start: mathStart },
          { end: mathStart + 5, start: mathStart + 3 },
        ],
        rawRange: { end: mathStart + 5, start: mathStart },
      },
    ])

    expect(
      resolveMarkdownLanguageToolContextCapability({
        documentIdentity: identity,
        offset: source.indexOf('Normal'),
        projection,
        source,
      }),
    ).toMatchObject({ spellcheck: true, status: 'supported' })
    expect(
      resolveMarkdownLanguageToolContextCapability({
        documentIdentity: identity,
        offset: 0,
        projection,
        source,
      }).reason,
    ).toBe('hidden-marker')
    expect(
      resolveMarkdownLanguageToolContextCapability({
        documentIdentity: identity,
        offset: source.indexOf('wrld'),
        projection,
        source,
      }).reason,
    ).toBe('code-block')
    expect(
      resolveMarkdownLanguageToolContextCapability({
        documentIdentity: identity,
        offset: targetStart,
        projection,
        source,
      }).reason,
    ).toBe('url')
    expect(
      resolveMarkdownLanguageToolContextCapability({
        documentIdentity: identity,
        offset: mathStart + 2,
        projection,
        source,
      }).reason,
    ).toBe('atomic-node')
    expect(
      resolveMarkdownLanguageToolContextCapability({
        documentIdentity: identity,
        offset: source.indexOf('Normal'),
        source,
      }),
    ).toMatchObject({
      reason: 'projection-unavailable',
      spellcheck: false,
      status: 'degraded',
    })
  })

  it('binds sessions to the exact document, revision, kind, and selection', () => {
    const session = createMarkdownLanguageToolSession({
      documentIdentity: { epoch: 2, id: 'article' },
      kind: 'dictation',
      revision: 5,
      selection: { direction: 'forward', end: 20, start: 10 },
    })
    expect(session).toMatchObject({
      active: true,
      documentIdentity: { epoch: 2, id: 'article' },
      kind: 'dictation',
      revision: 5,
      selection: { direction: 'forward', end: 20, start: 10 },
    })
    expect(session.id).toContain('article:2:5:dictation')
  })

  it('commits one explicit raw-source transaction with deterministic history', () => {
    const result = commitFixture()
    expect(result.accepted).toBe(true)
    expect(result.transaction).toEqual({
      changes: [{ from: 6, insert: 'world', to: 10 }],
      expectedRevision: 3,
      history: 'separate',
      metadata: {
        kind: 'spellcheck',
        languageTool: true,
        sessionId: result.session?.id,
        sessionKind: 'spellcheck',
      },
      origin: 'input',
      selection: { direction: 'none', end: 11, start: 11 },
    })
  })

  it('rejects stale document, revision, selection, and session kind', () => {
    expect(
      commitFixture({
        currentDocumentIdentity: { epoch: 2, id: 'commit-doc' },
      }).reason,
    ).toBe('stale-document')
    expect(commitFixture({ currentRevision: 4 }).reason).toBe('stale-revision')
    expect(commitFixture({ projectionRevision: 2 }).reason).toBe(
      'stale-projection',
    )
    expect(
      commitFixture({
        currentSelection: { direction: 'none', end: 9, start: 6 },
      }).reason,
    ).toBe('stale-selection')
    expect(
      commitFixture({ kind: 'dictation', sessionKind: 'spellcheck' }).reason,
    ).toBe('session-kind-conflict')
    expect(commitFixture({ sessionActive: false }).reason).toBe('stale-session')
    expect(
      commitFixture({
        currentSelection: { direction: 'none', end: 8, start: 8 },
        sessionSelection: { direction: 'none', end: 8, start: 8 },
      }).accepted,
    ).toBe(true)
  })

  it('rejects IME interleaving, DOM authority, full-source, and split UTF-16 ranges', () => {
    expect(commitFixture({ isComposing: true }).reason).toBe(
      'composition-active',
    )
    expect(commitFixture({ rawHtml: '<span>world</span>' }).reason).toBe(
      'dom-authority-rejected',
    )
    const source = 'short'
    expect(
      commitFixture({
        currentSelection: { direction: 'none', end: source.length, start: 0 },
        from: 0,
        sessionSelection: {
          direction: 'none',
          end: source.length,
          start: 0,
        },
        source,
        to: source.length,
      }).reason,
    ).toBe('full-source-rejected')
    expect(
      commitFixture({
        currentSelection: {
          direction: 'forward',
          end: source.length,
          start: 0,
        },
        from: 0,
        kind: 'writing-tools',
        sessionKind: 'writing-tools',
        sessionSelection: {
          direction: 'forward',
          end: source.length,
          start: 0,
        },
        source,
        to: source.length,
      }).accepted,
    ).toBe(true)
    const emojiSource = 'A😀 wrld'
    expect(
      commitFixture({
        currentSelection: { direction: 'none', end: 2, start: 1 },
        from: 1,
        sessionSelection: { direction: 'none', end: 2, start: 1 },
        source: emojiSource,
        to: 2,
      }).reason,
    ).toBe('invalid-range')
  })

  it('rejects edits that overlap marker, URL, code, or atomic authority', () => {
    const source = '[wrld](https://example.dev) `wrld` $$x$$'
    const identity = { epoch: 1, id: 'commit-doc' }
    const projection = projectionFixture(source, identity, [
      {
        id: 'link',
        kind: 'link',
        presentation: 'live-decorated',
        rawContentRanges: [
          { end: 5, start: 1 },
          { end: 26, start: 7 },
        ],
        rawMarkerRanges: [
          { end: 1, start: 0 },
          { end: 7, start: 5 },
          { end: 27, start: 26 },
        ],
        rawRange: { end: 27, start: 0 },
      },
      {
        id: 'code',
        kind: 'code',
        presentation: 'source-only-with-reason',
        rawContentRanges: [{ end: 34, start: 30 }],
        rawMarkerRanges: [
          { end: 30, start: 29 },
          { end: 35, start: 34 },
        ],
        rawRange: { end: 35, start: 29 },
      },
      {
        id: 'math',
        kind: 'latex',
        presentation: 'live-atomic',
        rawContentRanges: [{ end: 39, start: 38 }],
        rawMarkerRanges: [
          { end: 38, start: 36 },
          { end: 41, start: 39 },
        ],
        rawRange: { end: 41, start: 36 },
      },
    ])

    expect(
      commitFixture({
        currentSelection: { direction: 'none', end: 1, start: 0 },
        from: 0,
        projection,
        sessionSelection: { direction: 'none', end: 1, start: 0 },
        source,
        to: 1,
      }).reason,
    ).toBe('hidden-marker')
    expect(
      commitFixture({
        currentSelection: { direction: 'none', end: 15, start: 7 },
        from: 7,
        projection,
        sessionSelection: { direction: 'none', end: 15, start: 7 },
        source,
        to: 15,
      }).reason,
    ).toBe('url')
    expect(
      commitFixture({
        currentSelection: { direction: 'none', end: 34, start: 30 },
        from: 30,
        projection,
        sessionSelection: { direction: 'none', end: 34, start: 30 },
        source,
        to: 34,
      }).reason,
    ).toBe('code-block')
    expect(
      commitFixture({
        currentSelection: { direction: 'none', end: 39, start: 38 },
        from: 38,
        projection,
        sessionSelection: { direction: 'none', end: 39, start: 38 },
        source,
        to: 39,
      }).reason,
    ).toBe('atomic-node')

    const nestedSource = 'abc def'
    const nestedProjection = projectionFixture(nestedSource, identity, [
      {
        id: 'left',
        kind: 'paragraph',
        presentation: 'live-decorated',
        rawRange: { end: 3, start: 0 },
      },
      {
        id: 'right',
        kind: 'paragraph',
        presentation: 'live-decorated',
        rawRange: { end: 7, start: 4 },
      },
    ])
    expect(
      commitFixture({
        currentSelection: { direction: 'forward', end: 5, start: 2 },
        from: 2,
        projection: nestedProjection,
        sessionSelection: { direction: 'forward', end: 5, start: 2 },
        source: nestedSource,
        to: 5,
      }).reason,
    ).toBe('nested-syntax')
  })
})
