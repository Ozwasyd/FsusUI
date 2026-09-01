import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_ATOMIC_NODE_KINDS,
  MARKDOWN_LIVE_SELECTION_MOTIONS,
  evaluateMarkdownLiveSelectionMutations,
  resolveMarkdownAtomicNodeIntent,
  resolveMarkdownLiveSelectionMotion,
  retainMarkdownLiveSelection,
  roundTripMarkdownLiveSelection,
} from '../src/markdown-editor-live-selection'
import { MarkdownEditorTransactionStore } from '../src/markdown-editor-transaction'
import {
  applyMarkdownEditorChanges,
} from '../src/markdown-editor-transaction'

const identity = { epoch: 1, id: 'sel' }

describe('markdown live selection and atomic primitive', () => {
  it('round-trips source selection through #325 for CJK, emoji, ZWJ, combining, and RTL', () => {
    const source = '前 é 👩‍💻 עברית **x**'
    const selections = [
      { direction: 'none' as const, end: 0, start: 0 },
      { direction: 'forward' as const, end: 2, start: 0 },
      { direction: 'backward' as const, end: source.length, start: 2 },
      { direction: 'forward' as const, end: source.indexOf('x') + 1, start: source.indexOf('*') },
    ]
    for (const selection of selections) {
      const trip = roundTripMarkdownLiveSelection({
        documentIdentity: identity,
        selection,
        source,
      })
      expect(trip.equivalent).toBe(true)
      expect(trip.selection.start).toBe(selection.start)
      expect(trip.selection.end).toBe(selection.end)
    }
  })

  it('moves by grapheme, word, line, and page, and extends with shift', () => {
    const source = 'alpha 中文\nnext line\n\nmore'
    const start = { direction: 'none' as const, end: 5, start: 5 }
    const right = resolveMarkdownLiveSelectionMotion({
      documentIdentity: identity,
      motion: 'right',
      selection: start,
      source,
    })
    expect(right.action).toBe('move')
    expect(right.selection.start).toBeGreaterThan(5)

    const word = resolveMarkdownLiveSelectionMotion({
      documentIdentity: identity,
      motion: 'word-right',
      selection: { direction: 'none', end: 0, start: 0 },
      source,
    })
    expect(source.slice(0, word.selection.start)).toBe('alpha')

    const home = resolveMarkdownLiveSelectionMotion({
      documentIdentity: identity,
      motion: 'home',
      selection: { direction: 'none', end: 8, start: 8 },
      source,
    })
    expect(home.selection.start).toBe(0)

    const end = resolveMarkdownLiveSelectionMotion({
      documentIdentity: identity,
      motion: 'end',
      selection: { direction: 'none', end: 0, start: 0 },
      source,
    })
    expect(end.selection.start).toBe(source.indexOf('\n'))

    const extend = resolveMarkdownLiveSelectionMotion({
      documentIdentity: identity,
      motion: 'right',
      selection: start,
      shift: true,
      source,
    })
    expect(extend.action).toBe('extend')
    expect(extend.selection.direction).toBe('forward')

    const page = resolveMarkdownLiveSelectionMotion({
      documentIdentity: identity,
      motion: 'page-down',
      selection: { direction: 'none', end: 0, start: 0 },
      source,
    })
    expect(page.selection.start).toBeGreaterThan(0)

    const drag = resolveMarkdownLiveSelectionMotion({
      documentIdentity: identity,
      dragOffset: source.indexOf('line'),
      motion: 'pointer-drag',
      selection: { direction: 'none', end: 0, start: 0 },
      source,
    })
    expect(drag.action).toBe('extend')
    expect(drag.selection.end).toBeGreaterThan(drag.selection.start)
    expect(MARKDOWN_LIVE_SELECTION_MOTIONS).toContain('pointer-drag')

    const empty = resolveMarkdownLiveSelectionMotion({
      documentIdentity: identity,
      motion: 'right',
      selection: { direction: 'none', end: 0, start: 0 },
      source: '',
    })
    expect(empty.selection.start).toBe(0)

    const eof = resolveMarkdownLiveSelectionMotion({
      documentIdentity: identity,
      motion: 'right',
      selection: { direction: 'none', end: source.length, start: source.length },
      source,
    })
    expect(eof.selection.start).toBe(source.length)
  })

  it('snaps over atomic interiors and keeps pointer/virtual targets on the map', () => {
    const source = 'before ![alt](img.png) after'
    const imageAt = source.indexOf('!')
    const inside = resolveMarkdownLiveSelectionMotion({
      documentIdentity: identity,
      motion: 'right',
      selection: { direction: 'none', end: imageAt, start: imageAt },
      source,
    })
    expect(inside.selection.start).toBe(source.indexOf(' after'))
    expect(inside.atomic?.kind).toBe('image')

    const click = resolveMarkdownLiveSelectionMotion({
      documentIdentity: identity,
      motion: 'pointer-click',
      pointerOffset: imageAt + 3,
      selection: { direction: 'none', end: 0, start: 0 },
      source,
    })
    expect(click.selection.start === imageAt || click.selection.start === source.indexOf(' after')).toBe(
      true,
    )
  })

  it('keeps one before/after/source/copy/delete/focus primitive for every registered atomic kind', () => {
    const fixtures: Record<string, string> = {
      attachment: '![file](pending://a)',
      code: '```\ncode\n```\n',
      embed: '::embed[target="doc" mode="article"]\n',
      footnote: 'See [^1]\n',
      image: '![alt](img.png)\n',
      latex: '$$\nx\n$$\n',
      mermaid: '```mermaid\ngraph TD\n```\n',
      table: '| h |\n| --- |\n| c |\n',
      embed: '::embed[target="note" mode="article"]\n',
    }
    for (const kind of MARKDOWN_ATOMIC_NODE_KINDS) {
      const source = fixtures[kind]!
      const before = resolveMarkdownAtomicNodeIntent({
        action: 'caret-before',
        documentIdentity: identity,
        kind,
        revision: 0,
        selection: { direction: 'none', end: 0, start: 0 },
        source,
      })
      expect(before.kind).toBe(kind)
      expect(before.accessibility.tabStop).toBe(false)
      expect(before.session?.phase).toBe('idle')

      const after = resolveMarkdownAtomicNodeIntent({
        action: 'caret-after',
        documentIdentity: identity,
        kind,
        nodeId: before.nodeId!,
        revision: 0,
        selection: before.selection,
        source,
      })
      expect(after.selection.start).toBeGreaterThan(before.selection.start)

      const enter = resolveMarkdownAtomicNodeIntent({
        action: 'enter-source',
        documentIdentity: identity,
        kind,
        nodeId: before.nodeId!,
        revision: 0,
        selection: before.selection,
        source,
      })
      expect(enter.session?.phase).toBe('source')

      const copy = resolveMarkdownAtomicNodeIntent({
        action: 'copy-source',
        documentIdentity: identity,
        kind,
        nodeId: before.nodeId!,
        revision: 0,
        selection: before.selection,
        source,
      })
      expect(copy.transaction).toBeNull()
      expect(copy.copy && 'payload' in copy.copy && copy.copy.payload['text/markdown']).toBeTruthy()

      const visible = resolveMarkdownAtomicNodeIntent({
        action: 'copy-visible',
        documentIdentity: identity,
        kind,
        nodeId: before.nodeId!,
        revision: 0,
        selection: before.selection,
        source,
      })
      expect(visible.copy).toBeTruthy()

      const deleted = resolveMarkdownAtomicNodeIntent({
        action: 'delete',
        documentIdentity: identity,
        kind,
        nodeId: before.nodeId!,
        revision: 0,
        selection: before.selection,
        source,
      })
      const next = applyMarkdownEditorChanges(source, deleted.transaction!.changes)!.value
      expect(deleted.transaction?.changes[0]?.insert).toBe('')
      expect(next.length).toBeLessThan(source.length)

      const escaped = resolveMarkdownAtomicNodeIntent({
        action: 'escape',
        documentIdentity: identity,
        kind,
        nodeId: before.nodeId!,
        revision: 0,
        selection: enter.selection,
        source,
      })
      expect(escaped.focusReturn?.start).toBe(after.selection.start)
      expect(escaped.session).toBeNull()
    }
  })

  it('retains selection direction and history across source/live/split/preview', () => {
    const source = '![alt](img.png)\n# Title'
    const store = new MarkdownEditorTransactionStore(source, {
      direction: 'backward',
      end: 15,
      start: 0,
    })
    const results = (['source', 'live', 'split', 'preview'] as const).map((mode) =>
      retainMarkdownLiveSelection({
        documentIdentity: identity,
        mode,
        selection: store.selection,
        source: store.value,
      }),
    )
    expect(results.every((result) => result.equivalent)).toBe(true)
    expect(new Set(results.map((result) => result.selection.direction)).size).toBe(1)
    expect(results[0]?.selection.direction).toBe('backward')
    store.dispatch({
      changes: [{ from: 15, insert: '!', to: 15 }],
      history: 'separate',
      origin: 'input',
      selection: { direction: 'none', end: 16, start: 16 },
    })
    expect(store.history.canUndo).toBe(true)
    const after = retainMarkdownLiveSelection({
      documentIdentity: identity,
      mode: 'live',
      selection: store.selection,
      source: store.value,
    })
    expect(after.equivalent).toBe(true)
    expect(store.history.canUndo).toBe(true)
  })

  it('reports composition, preview, stale, pending, error, and unsupported atomic states', () => {
    const source = '![alt](img.png)'
    expect(
      resolveMarkdownAtomicNodeIntent({
        action: 'delete',
        composing: true,
        documentIdentity: identity,
        selection: { direction: 'none', end: 0, start: 0 },
        source,
      }).rejected,
    ).toBe('composition-active')
    expect(
      resolveMarkdownAtomicNodeIntent({
        action: 'delete',
        documentIdentity: identity,
        mode: 'preview',
        selection: { direction: 'none', end: 0, start: 0 },
        source,
      }).rejected,
    ).toBe('preview')
    expect(
      resolveMarkdownAtomicNodeIntent({
        action: 'delete',
        documentIdentity: identity,
        expectedRevision: 1,
        revision: 2,
        selection: { direction: 'none', end: 0, start: 0 },
        source,
      }).rejected,
    ).toBe('stale-document')
    expect(
      resolveMarkdownAtomicNodeIntent({
        action: 'caret-before',
        documentIdentity: identity,
        pending: true,
        selection: { direction: 'none', end: 0, start: 0 },
        source,
      }).state,
    ).toBe('pending')
    expect(
      resolveMarkdownAtomicNodeIntent({
        action: 'caret-before',
        documentIdentity: identity,
        error: true,
        selection: { direction: 'none', end: 0, start: 0 },
        source,
      }).state,
    ).toBe('error')
    expect(
      resolveMarkdownAtomicNodeIntent({
        action: 'delete',
        documentIdentity: identity,
        selection: { direction: 'none', end: 0, start: 0 },
        source: 'plain paragraph',
      }).rejected,
    ).toBe('unsupported')
  })

  it('kills DOM mapping, per-kind carets, Tab traps, and nearby-offset guesses', () => {
    const report = evaluateMarkdownLiveSelectionMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority.accessibility.tabStop).toBe(false)
    expect(byKind['dom-mapping']?.accepted).toBe(false)
    expect(byKind['per-kind-caret']?.accepted).toBe(false)
    expect(byKind['tab-trap']?.accepted).toBe(false)
    expect(byKind['nearby-guess']?.accepted).toBe(false)
  })
})
