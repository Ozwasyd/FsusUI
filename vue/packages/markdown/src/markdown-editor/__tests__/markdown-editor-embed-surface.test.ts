import { describe, expect, it } from 'vitest'

import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
} from '../../../wasm/markdown-runtime'
import { MARKDOWN_ATOMIC_NODE_KINDS } from '../src/markdown-editor-live-selection'
import {
  planMarkdownEmbedSurface,
  resolveMarkdownEmbedAtomic,
  resolveMarkdownEmbedHeight,
  resolveMarkdownEmbedSurface,
} from '../src/markdown-editor-embed-surface'
import { MarkdownEditorTransactionStore } from '../src/markdown-editor-transaction'
import type { MarkdownEmbedResult } from '../../../wasm/markdown-runtime'

const IDENTITY: MarkdownDocumentIdentity = Object.freeze({
  epoch: 1,
  id: 'embed-surface-doc',
})

const DIRECTIVE = '::embed[target="local-note" mode="article"]'
const SOURCE = `intro\n\n${DIRECTIVE}\n\ntail\n`

const projectionOf = (source = SOURCE) =>
  stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    IDENTITY,
  )

const embedNodeOf = (source = SOURCE) => {
  const node = projectionOf(source).nodes.find(
    (item) => item.kind === 'embed',
  )
  if (!node) throw new Error('projection did not emit an embed node')
  return node
}

const selectionAt = (offset: number) =>
  ({ direction: 'none', end: offset, start: offset }) as const

const resolvedResult = (): MarkdownEmbedResult => ({
  requestId: `${IDENTITY.id}:1:${embedNodeOf().id}:1`,
  status: 'resolved',
  target: 'local-note',
  mode: 'article',
  version: 1,
  documentIdentity: IDENTITY,
  revision: 1,
  nodeId: embedNodeOf().id,
  title: 'local note',
  excerpt: 'Local note body.\n',
})

describe('markdown editor embed surface', () => {
  it('registers embed in the shared atomic registry and locates it via the projection', () => {
    expect(MARKDOWN_ATOMIC_NODE_KINDS).toContain('embed')
    const node = embedNodeOf()
    expect(node.rawRange.start).toBeGreaterThan(0)
    expect(node.rawRange.end).toBeGreaterThan(node.rawRange.start)
  })

  it('resolves atomic caret, source, copy and delete through the shared primitive', () => {
    const node = embedNodeOf()
    const before = resolveMarkdownEmbedAtomic({
      action: 'caret-before',
      documentIdentity: IDENTITY,
      nodeId: node.id,
      revision: 1,
      selection: selectionAt(node.rawRange.start),
      source: SOURCE,
    })
    expect(before.state).toBe('current')
    expect(before.selection.start).toBe(node.rawRange.start)
    expect(before.transaction).not.toBeNull()

    const after = resolveMarkdownEmbedAtomic({
      action: 'caret-after',
      documentIdentity: IDENTITY,
      nodeId: node.id,
      revision: 1,
      selection: selectionAt(node.rawRange.end),
      source: SOURCE,
    })
    expect(after.selection.start).toBe(node.rawRange.end)

    const enterSource = resolveMarkdownEmbedAtomic({
      action: 'enter-source',
      documentIdentity: IDENTITY,
      nodeId: node.id,
      revision: 1,
      selection: selectionAt(node.rawRange.start),
      source: SOURCE,
    })
    expect(enterSource.session?.phase).toBe('source')

    const copyVisible = resolveMarkdownEmbedAtomic({
      action: 'copy-visible',
      documentIdentity: IDENTITY,
      nodeId: node.id,
      revision: 1,
      selection: selectionAt(node.rawRange.start),
      source: SOURCE,
    })
    expect(copyVisible.copy).not.toBeNull()

    const copyExact = resolveMarkdownEmbedAtomic({
      action: 'copy-source',
      documentIdentity: IDENTITY,
      nodeId: node.id,
      revision: 1,
      selection: selectionAt(node.rawRange.start),
      source: SOURCE,
    })
    expect(copyExact.copy).not.toBeNull()

    const focusReturn = resolveMarkdownEmbedAtomic({
      action: 'focus-return',
      documentIdentity: IDENTITY,
      nodeId: node.id,
      revision: 1,
      selection: selectionAt(node.rawRange.end),
      source: SOURCE,
    })
    expect(focusReturn.focusReturn).toEqual(after.selection)
  })

  it('keeps delete and undo on the host transaction authority', () => {
    const node = embedNodeOf()
    const store = new MarkdownEditorTransactionStore(
      SOURCE,
      selectionAt(node.rawRange.start),
    )
    const deleted = resolveMarkdownEmbedAtomic({
      action: 'delete',
      documentIdentity: IDENTITY,
      nodeId: node.id,
      revision: store.revision,
      selection: store.selection,
      source: store.value,
    })
    expect(deleted.transaction).not.toBeNull()
    store.dispatch(deleted.transaction!)
    expect(store.value.includes(DIRECTIVE)).toBe(false)
    expect(store.value).toBe('intro\n\n\ntail\n')
    store.undo()
    expect(store.value).toBe(SOURCE)
  })

  it('rejects stale and cross-document atomic intents', () => {
    const node = embedNodeOf()
    const stale = resolveMarkdownEmbedAtomic({
      action: 'caret-after',
      documentIdentity: IDENTITY,
      expectedRevision: 1,
      nodeId: node.id,
      revision: 2,
      selection: selectionAt(node.rawRange.end),
      source: SOURCE,
    })
    expect(stale.state).toBe('stale')
    expect(stale.rejected).toBe('stale-document')

    const switched = resolveMarkdownEmbedAtomic({
      action: 'caret-after',
      currentIdentity: { epoch: 9, id: IDENTITY.id },
      documentIdentity: IDENTITY,
      nodeId: node.id,
      revision: 1,
      selection: selectionAt(node.rawRange.end),
      source: SOURCE,
    })
    expect(switched.state).toBe('stale')
  })

  it('keeps pending/result height changes anchored without caret or viewport jumps', () => {
    const selection = selectionAt(8)
    const pending = resolveMarkdownEmbedHeight({
      documentIdentity: IDENTITY,
      revision: 1,
      selection,
      source: SOURCE,
    })
    expect(pending.trigger).toBe('embed-result')
    expect(pending.action).toBe('restore')
    expect(pending.scrollIntoView).toBe(false)
    expect(pending.sourceUnchanged).toBe(true)

    const resolved = resolveMarkdownEmbedHeight({
      documentIdentity: IDENTITY,
      previousAnchor: pending.anchor,
      revision: 1,
      selection,
      source: SOURCE,
    })
    expect(resolved.anchor?.sourceOffset).toBe(pending.anchor?.sourceOffset)
    expect(resolved.caret.start).toBe(selection.start)

    const reduced = resolveMarkdownEmbedHeight({
      documentIdentity: IDENTITY,
      reducedMotion: true,
      revision: 1,
      selection,
      source: SOURCE,
    })
    expect(reduced.reducedMotion).toBe(true)
    expect(reduced.smooth).toBe(false)

    const gesture = resolveMarkdownEmbedHeight({
      documentIdentity: IDENTITY,
      gesture: 'wheel',
      revision: 1,
      selection,
      source: SOURCE,
    })
    expect(gesture.action).toBe('yield')
    expect(gesture.rejected).toBe('user-scroll')

    const stale = resolveMarkdownEmbedHeight({
      documentIdentity: IDENTITY,
      expectedRevision: 1,
      revision: 3,
      selection,
      source: SOURCE,
    })
    expect(stale.action).toBe('reject-stale')
  })

  it('shows the exact directive in source and controlled content elsewhere', () => {
    const node = embedNodeOf()
    for (const mode of ['source', 'live', 'split', 'preview'] as const) {
      const surface = resolveMarkdownEmbedSurface({
        mode,
        node,
        source: SOURCE,
      })
      expect(surface.presentation.directive).toBe(DIRECTIVE)
      if (mode === 'source') {
        expect(surface.directiveVisible).toBe(true)
        expect(surface.contentVisible).toBe(false)
      } else {
        expect(surface.directiveVisible).toBe(false)
        expect(surface.contentVisible).toBe(true)
      }
      expect(surface.presentation.content.html).toBe(null)
      expect(surface.presentation.content.editable).toBe(false)
    }
  })

  it('does not change visual state when a stale result arrives', () => {
    const node = embedNodeOf()
    const current = resolveMarkdownEmbedSurface({
      mode: 'live',
      node,
      result: resolvedResult(),
      source: SOURCE,
    })
    const stale = resolveMarkdownEmbedSurface({
      mode: 'live',
      node,
      result: { ...resolvedResult(), status: 'stale' },
      source: SOURCE,
    })
    expect(current.presentation.state).toBe('resolved')
    expect(stale.presentation.state).toBe('stale')
    expect(stale.presentation.content.title).toBe(null)
    expect(stale.presentation.content.excerpt).toBe(null)
    expect(stale.presentation.directive).toBe(current.presentation.directive)
  })

  it('composes surface and height into one plan per editor mode', () => {
    const node = embedNodeOf()
    for (const mode of ['source', 'live', 'split', 'preview'] as const) {
      const plan = planMarkdownEmbedSurface({
        documentIdentity: IDENTITY,
        mode,
        node,
        result: resolvedResult(),
        revision: 1,
        selection: selectionAt(8),
        source: SOURCE,
      })
      expect(plan.height.trigger).toBe('embed-result')
      expect(plan.surface.presentation.mode).toBe(mode)
      expect(plan.surface.presentation.state).toBe('resolved')
    }
  })
})
