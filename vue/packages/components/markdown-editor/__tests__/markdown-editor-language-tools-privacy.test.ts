import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createMarkdownAnchorMap,
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownAnchorMap,
  type MarkdownStableProjection,
} from '../../../wasm/markdown-runtime'
import {
  commitMarkdownLanguageToolMutation,
  createMarkdownLanguageToolSession,
  type MarkdownLanguageToolSessionKind,
} from '../src/markdown-editor-language-tools'
import { bindMarkdownWebLanguageTools } from '../src/markdown-editor-language-web'

const projectionFixture = (
  source: string,
  documentIdentity: { readonly epoch: number; readonly id: string },
): MarkdownStableProjection =>
  stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    documentIdentity,
  )

const anchorMapFixture = (
  source: string,
  documentIdentity: { readonly epoch: number; readonly id: string },
  projection: MarkdownStableProjection,
): MarkdownAnchorMap =>
  createMarkdownAnchorMap({
    identity: documentIdentity,
    projection,
    source,
  })

// Representative body, suggestion, and dictation content that must never reach
// telemetry, logs, or transaction metadata as body-content payloads.
const BODY = 'Quarterly revenue grew wrld across every region'
const SUGGESTION = 'world'
const DICTATION = 'confidential dictation transcript 内部听写内容'

const consoleMethods = ['log', 'info', 'warn', 'error', 'debug'] as const

describe('markdown language tool privacy and observer boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const spyOnConsole = () => {
    const spies: Record<string, ReturnType<typeof vi.spyOn>> = {}
    for (const method of consoleMethods) {
      spies[method] = vi.spyOn(console, method).mockImplementation(() => {})
    }
    return spies
  }

  const assertNoBodyLeak = (value: unknown) => {
    const serialized = JSON.stringify(value ?? null)
    for (const forbidden of [BODY, SUGGESTION, DICTATION, '内部听写内容']) {
      expect(serialized).not.toContain(forbidden)
    }
  }

  it.each([
    'spellcheck',
    'autocorrect',
    'dictation',
    'writing-tools',
    'context-menu',
  ] satisfies readonly MarkdownLanguageToolSessionKind[])(
    'never logs or embeds body, suggestion, or dictation content for a %s commit',
    (kind) => {
      const spies = spyOnConsole()
      const source = BODY
      const documentIdentity = { epoch: 1, id: 'privacy-doc' }
      const from = source.indexOf('wrld')
      const to = from + 'wrld'.length
      const selection = { direction: 'none' as const, end: to, start: from }
      const projection = projectionFixture(source, documentIdentity)
      const session = createMarkdownLanguageToolSession({
        documentIdentity,
        kind,
        revision: 2,
        selection,
      })

      const result = commitMarkdownLanguageToolMutation({
        anchorMap: anchorMapFixture(source, documentIdentity, projection),
        currentDocumentIdentity: documentIdentity,
        currentRevision: 2,
        currentSelection: selection,
        documentIdentity,
        from,
        insert: kind === 'dictation' ? DICTATION : SUGGESTION,
        kind,
        projection,
        projectionRevision: 2,
        revision: 2,
        session,
        source,
        to,
      })

      expect(result.accepted).toBe(true)
      // The adapter must be silent: no console channel receives any content.
      for (const method of consoleMethods) {
        expect(spies[method]).not.toHaveBeenCalled()
      }
      // Transaction metadata is structural only; it must not carry body,
      // suggestion, or dictation payloads into history/telemetry surfaces.
      expect(result.transaction?.metadata).toEqual({
        kind,
        languageTool: true,
        sessionId: session.id,
        sessionKind: kind,
      })
      assertNoBodyLeak(result.transaction?.metadata)
      // Session identity binds document/revision/kind, never body content.
      assertNoBodyLeak({ id: session.id, kind: session.kind })
    },
  )

  it('keeps the web replacement boundary silent and free of body-content telemetry', () => {
    const spies = spyOnConsole()
    const source = BODY
    const documentIdentity = { epoch: 1, id: 'privacy-web' }
    const from = source.indexOf('wrld')
    const to = from + 'wrld'.length
    const textarea = {
      selectionDirection: 'none' as const,
      selectionEnd: to,
      selectionStart: from,
      spellcheck: true,
      value: source,
    }
    const projection = projectionFixture(source, documentIdentity)
    const controller = bindMarkdownWebLanguageTools(textarea, {
      anchorMap: anchorMapFixture(source, documentIdentity, projection),
      documentIdentity,
      projection,
      projectionRevision: 1,
      revision: 1,
      source,
    })

    controller.createSession('context-menu')
    const handled = controller.handleBeforeInput({
      data: SUGGESTION,
      inputType: 'insertReplacementText',
    })

    expect(handled.handled).toBe(true)
    for (const method of consoleMethods) {
      expect(spies[method]).not.toHaveBeenCalled()
    }
    assertNoBodyLeak(handled.transaction?.metadata)
    // The handled-result reason channel is a stable code, not body content.
    expect(handled.reason).toBeUndefined()
  })

  it('attaches no document observer while binding or updating a large source', () => {
    const observers: string[] = []
    const stub = (name: string) =>
      class {
        constructor() {
          observers.push(name)
        }
        disconnect() {}
        observe() {}
        takeRecords() {
          return []
        }
      }
    const previous = {
      IntersectionObserver: globalThis.IntersectionObserver,
      MutationObserver: globalThis.MutationObserver,
      ResizeObserver: globalThis.ResizeObserver,
    }
    globalThis.MutationObserver = stub('MutationObserver') as never
    globalThis.ResizeObserver = stub('ResizeObserver') as never
    globalThis.IntersectionObserver = stub('IntersectionObserver') as never

    try {
      // A multi-block source exercises context resolution across many nodes.
      const source = Array.from(
        { length: 2000 },
        (_, index) => `paragraph ${index} with prose wrld`,
      ).join('\n\n')
      const documentIdentity = { epoch: 1, id: 'observer-doc' }
      const projection = projectionFixture(source, documentIdentity)
      const textarea = {
        selectionEnd: 0,
        selectionStart: 0,
        spellcheck: true,
        value: source,
      }
      const controller = bindMarkdownWebLanguageTools(textarea, {
        anchorMap: anchorMapFixture(source, documentIdentity, projection),
        config: { nativeWritingTools: 'disabled', spellcheck: 'disabled' },
        documentIdentity,
        projection,
        projectionRevision: 0,
        revision: 0,
        source,
      })

      // Default disabled/unsupported path plus context and mode churn must not
      // attach any full-document observer.
      controller.updateContext({ offset: source.indexOf('wrld') })
      controller.switchMode('live')
      controller.updateState({ revision: 1, source })

      expect(observers).toEqual([])
      expect(previous.MutationObserver).toBeDefined()
    } finally {
      globalThis.MutationObserver = previous.MutationObserver
      globalThis.ResizeObserver = previous.ResizeObserver
      globalThis.IntersectionObserver = previous.IntersectionObserver
    }
  })
})
