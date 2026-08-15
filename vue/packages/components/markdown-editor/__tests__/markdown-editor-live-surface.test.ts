import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_LIVE_SURFACE_OWNER,
  createMarkdownLiveSurface,
  evaluateMarkdownLiveSurfaceMutations,
  resolveMarkdownLiveSurface,
} from '../src/markdown-editor-live-surface'
import { MarkdownEditorTransactionStore } from '../src/markdown-editor-transaction'

const identity = { epoch: 1, id: 'live-doc' }

describe('markdown live surface', () => {
  it('gives live a single textarea owner and no second renderer pane', () => {
    const live = createMarkdownLiveSurface({
      documentIdentity: identity,
      mode: 'live',
      revision: 3,
      source: '# Title\n\n```\ncode\n```\n',
    })
    expect(live.inputOwner).toBe(MARKDOWN_LIVE_SURFACE_OWNER)
    expect(live.selectionOwner).toBe(live.inputOwner)
    expect(live.compositionHost).toBe(live.inputOwner)
    expect(live.inputVisible).toBe(true)
    expect(live.rendererVisible).toBe(false)
    expect(live.keepSource).toBe(true)
    expect(live.source).toBe('# Title\n\n```\ncode\n```\n')
    expect(live.capability.capability).toBe('supported')
    expect(live.decorations.every((decoration) => decoration.editable === false)).toBe(
      true,
    )
    expect(live.decorations.some((decoration) => decoration.nodeId.startsWith('syn:'))).toBe(
      true,
    )
    expect(
      live.decorations.some(
        (decoration) =>
          decoration.kind === 'code' && decoration.role === 'source-fallback',
      ),
    ).toBe(true)
  })

  it('keeps the same owner across source/live/split/preview and only split/preview show the renderer', () => {
    const modes = ['source', 'live', 'split', 'preview'] as const
    const plans = modes.map((mode) =>
      createMarkdownLiveSurface({
        documentIdentity: identity,
        mode,
        revision: 1,
        source: 'Hello.',
      }),
    )
    expect(new Set(plans.map((plan) => plan.inputOwner)).size).toBe(1)
    expect(plans.map((plan) => plan.inputVisible)).toEqual([true, true, true, false])
    expect(plans.map((plan) => plan.rendererVisible)).toEqual([
      false,
      false,
      true,
      true,
    ])
  })

  it('keeps full source and falls back to source when projection fails', () => {
    const failed = resolveMarkdownLiveSurface({
      documentIdentity: identity,
      mode: 'live',
      projectionError: true,
      revision: 8,
      source: '# Still here',
    })
    expect(failed.capability.capability).toBe('projection-failed')
    expect(failed.fallbackMode).toBe('source')
    expect(failed.source).toBe('# Still here')
    expect(failed.inputVisible).toBe(true)
    expect(failed.rendererVisible).toBe(false)
    expect(failed.decorations).toEqual([])
    expect(failed.capability.documentIdentity).toEqual(identity)
  })

  it('routes ordinary live input through the same transaction store', () => {
    const store = new MarkdownEditorTransactionStore('# Title', {
      start: 7,
      end: 7,
    })
    const before = createMarkdownLiveSurface({
      documentIdentity: identity,
      mode: 'live',
      revision: store.revision,
      source: store.value,
    })
    store.dispatch({
      changes: [{ from: 7, insert: '!', to: 7 }],
      history: 'separate',
      origin: 'input',
      selection: { start: 8, end: 8 },
    })
    const after = createMarkdownLiveSurface({
      documentIdentity: identity,
      mode: 'live',
      revision: store.revision,
      source: store.value,
    })
    expect(before.inputOwner).toBe(after.inputOwner)
    expect(store.value).toBe('# Title!')
    expect(after.source).toBe(store.value)
    store.undo()
    expect(store.value).toBe('# Title')
  })

  it('kills dual selection owners, per-block editors, DOM serialization, and a live-only parser', () => {
    const report = evaluateMarkdownLiveSurfaceMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority.selectionOwner).toBe(MARKDOWN_LIVE_SURFACE_OWNER)
    expect(byKind['dual-selection-owner']?.accepted).toBe(false)
    expect(byKind['per-block-editor']?.accepted).toBe(false)
    expect(byKind['dom-serialization']?.accepted).toBe(false)
    expect(byKind['live-only-parser']?.accepted).toBe(false)
  })
})
