import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_LIVE_LAYOUT_BUDGET,
  MARKDOWN_LIVE_LAYOUT_TRIGGERS,
  commitMarkdownLiveFeatureResult,
  evaluateMarkdownLiveLayoutMutations,
  resolveMarkdownLiveLayoutStability,
  resolveMarkdownLiveVirtualWindow,
  retainMarkdownLiveLayoutAcrossModes,
} from '../src/markdown-editor-live-layout'
import { MarkdownEditorTransactionStore } from '../src/markdown-editor-transaction'

const identity = { epoch: 1, id: 'layout' }

const largeSource = () =>
  Array.from(
    { length: 40 },
    (_, index) => `# Heading ${index}\n\nparagraph ${index} 👩‍💻 עברית\n`,
  ).join('\n')

describe('markdown live layout stability', () => {
  it('restores every height trigger from a #325 source anchor without writing source', () => {
    const source = '前 ![alt](img.png) 后 ***x***'
    const store = new MarkdownEditorTransactionStore(source, {
      direction: 'none',
      end: source.indexOf('x'),
      start: source.indexOf('x'),
    })
    for (const trigger of MARKDOWN_LIVE_LAYOUT_TRIGGERS) {
      const plan = resolveMarkdownLiveLayoutStability({
        documentIdentity: identity,
        revision: store.revision,
        selection: store.selection,
        source: store.value,
        trigger,
      })
      expect(plan.action).toBe('restore')
      expect(plan.sourceUnchanged).toBe(true)
      expect(plan.scrollIntoView).toBe(false)
      expect(plan.anchor?.visual.anchorId.startsWith('dom:')).toBe(false)
      expect(plan.anchor?.sourceOffset).toBe(source.indexOf('x'))
    }
    expect(store.value).toBe(source)
    expect(store.history.canUndo).toBe(false)
  })

  it('yields to user wheel, touch, scrollbar, and selection-drag', () => {
    const source = '# Title\n\nbody'
    const selection = { direction: 'none' as const, end: 2, start: 2 }
    for (const gesture of ['wheel', 'trackpad', 'touch', 'scrollbar', 'selection-drag'] as const) {
      const plan = resolveMarkdownLiveLayoutStability({
        documentIdentity: identity,
        gesture,
        revision: 0,
        selection,
        source,
        trigger: 'visual-viewport',
      })
      expect(plan.action).toBe('yield')
      expect(plan.rejected).toBe('user-scroll')
      expect(plan.scrollIntoView).toBe(false)
    }
  })

  it('keeps restore under reduced motion and rejects stale or composing updates', () => {
    const source = 'alpha'
    const selection = { direction: 'none' as const, end: 2, start: 2 }
    const reduced = resolveMarkdownLiveLayoutStability({
      documentIdentity: identity,
      reducedMotion: true,
      revision: 1,
      selection,
      source,
      trigger: 'theme',
    })
    expect(reduced.action).toBe('restore')
    expect(reduced.smooth).toBe(false)
    expect(reduced.reducedMotion).toBe(true)

    expect(
      resolveMarkdownLiveLayoutStability({
        composing: true,
        documentIdentity: identity,
        revision: 1,
        selection,
        source,
        trigger: 'font-load',
      }).action,
    ).toBe('noop')
    expect(
      resolveMarkdownLiveLayoutStability({
        currentIdentity: { epoch: 2, id: 'layout' },
        documentIdentity: identity,
        revision: 1,
        selection,
        source,
        trigger: 'projection-worker-commit',
      }).action,
    ).toBe('reject-stale')
  })

  it('rejects stale feature and projection results without changing visual state', () => {
    const current = {
      documentIdentity: identity,
      nodeId: 'syn:mermaid:1',
      revision: 4,
    }
    expect(
      commitMarkdownLiveFeatureResult({
        expected: current,
        incoming: current,
      }).accepted,
    ).toBe(true)
    expect(
      commitMarkdownLiveFeatureResult({
        expected: current,
        incoming: { ...current, revision: 5 },
      }),
    ).toMatchObject({ accepted: false, reason: 'stale-revision', visualUnchanged: true })
    expect(
      commitMarkdownLiveFeatureResult({
        expected: current,
        incoming: { ...current, documentIdentity: { epoch: 9, id: 'layout' } },
      }).reason,
    ).toBe('stale-document')
    expect(
      commitMarkdownLiveFeatureResult({
        expected: current,
        incoming: { ...current, nodeId: 'syn:other' },
      }).reason,
    ).toBe('stale-node')
  })

  it('does not accumulate caret error across repeated source/live switches', () => {
    const source = 'keep 中文 range'
    const retained = retainMarkdownLiveLayoutAcrossModes({
      documentIdentity: identity,
      from: 'live',
      revision: 1,
      selection: { direction: 'forward', end: 7, start: 0 },
      source,
      to: 'source',
    })
    expect(retained.drifted).toBe(false)
    expect(retained.first.anchor?.sourceOffset).toBe(7)
    expect(retained.second.anchor?.sourceOffset).toBe(7)
  })

  it('keeps ordinary input inside the numeric virtual-mount budget', () => {
    const source = largeSource()
    const initial = resolveMarkdownLiveVirtualWindow({
      documentIdentity: identity,
      origin: 'initial',
      selection: { direction: 'none', end: 2, start: 2 },
      source,
    })
    expect(initial.mountedNodeIds.length).toBeLessThanOrEqual(
      MARKDOWN_LIVE_LAYOUT_BUDGET.maxMountedNodes,
    )
    const next = resolveMarkdownLiveVirtualWindow({
      change: { from: 2, insert: '!', to: 2 },
      documentIdentity: identity,
      origin: 'input',
      previousMountedNodeIds: initial.mountedNodeIds,
      previousSource: source,
      revision: 1,
      selection: { direction: 'none', end: 3, start: 3 },
      source: `${source.slice(0, 2)}!${source.slice(2)}`,
    })
    expect(next.fullRemount).toBe(false)
    expect(next.remountedNodeIds.length).toBeLessThanOrEqual(
      MARKDOWN_LIVE_LAYOUT_BUDGET.maxRemountOnInput,
    )
    expect(next.mountedNodeIds.length).toBeLessThanOrEqual(
      MARKDOWN_LIVE_LAYOUT_BUDGET.maxMountedNodes,
    )
    expect(next.retainedNodeIds.length).toBeGreaterThan(0)
  })

  it('kills DOM anchors, unconditional scrollIntoView, stale commits, and full remounts', () => {
    const report = evaluateMarkdownLiveLayoutMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority.scrollIntoView).toBe(false)
    expect(byKind['dom-anchor']?.accepted).toBe(false)
    expect(byKind['scroll-into-view']?.accepted).toBe(false)
    expect(byKind['stale-commit']?.accepted).toBe(false)
    expect(byKind['full-mount-input']?.accepted).toBe(false)
  })
})
