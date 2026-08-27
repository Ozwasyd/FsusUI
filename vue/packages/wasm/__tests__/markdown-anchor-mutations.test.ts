import { describe, expect, it } from 'vitest'

import {
  createMarkdownAnchorMap,
  evaluateMarkdownAnchorMutations,
} from '../markdown-runtime'

describe('markdown anchor mutations', () => {
  it('rejects DOM paths, HTML offsets, naked offsets, nearby reveals, and bidi order', () => {
    const source = '\uFEFF# Title\r\n\nHello \u05e9\u05dc\u05d5\u05dd Title'
    const report = evaluateMarkdownAnchorMutations({
      identity: 'rtl-doc',
      source,
      syntax: [
        { id: 'title', range: [1, source.indexOf('\n')] },
        {
          id: 'hebrew',
          range: [source.indexOf('\u05e9'), source.indexOf('\u05e9') + 4],
        },
      ],
    })
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    const map = createMarkdownAnchorMap({
      identity: 'rtl-doc',
      source,
      syntax: [
        { id: 'title', range: [1, source.indexOf('\n')] },
        {
          id: 'hebrew',
          range: [source.indexOf('\u05e9'), source.indexOf('\u05e9') + 4],
        },
      ],
    })
    const hebrew = source.indexOf('\u05e9')
    const visual = map.sourceSelectionToVisual({
      anchor: hebrew,
      focus: hebrew + 4,
    })

    expect(map.visualAnchorToSourceSelection(visual)).toEqual({
      anchor: hebrew,
      focus: hebrew + 4,
    })
    expect(visual.anchor.sourceOffset).not.toBe(
      source.replace(/^\uFEFF/, '').indexOf('Title'),
    )
    expect(byKind['html-offset']?.equivalent).toBe(false)
    expect(byKind['html-offset']?.accepted).toBe(false)
    expect(byKind['bidi-visual-order']?.equivalent).toBe(false)
    expect(byKind['bidi-visual-order']?.accepted).toBe(false)
    expect(byKind['bare-offset']?.accepted).toBe(false)
    expect(byKind['dom-path']?.accepted).toBe(false)
    expect(byKind['nearby-reveal']?.accepted).toBe(false)
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'bare-offset',
      'dom-path',
      'html-offset',
      'bidi-visual-order',
      'nearby-reveal',
    ])
    expect(
      report.mutations.every((mutation) => mutation.equivalent === false),
    ).toBe(true)
  })
})
