import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_LIVE_REVEAL_STATES,
  evaluateMarkdownLiveRevealMutations,
  resolveMarkdownLiveSyntaxReveal,
} from '../src/markdown-editor-live-reveal'
import { MarkdownEditorTransactionStore } from '../src/markdown-editor-transaction'

const reveal = (
  source: string,
  start: number,
  extras: Partial<Parameters<typeof resolveMarkdownLiveSyntaxReveal>[0]> = {},
  end = start,
) =>
  resolveMarkdownLiveSyntaxReveal({
    documentIdentity: { epoch: 1, id: 'reveal' },
    selection: { direction: 'none', end, start },
    source,
    ...extras,
  })

const markerRoles = (plan: ReturnType<typeof reveal>) =>
  plan.target?.revealedRanges.map((range) => [
    range.role,
    plan.sourceUnchanged ? undefined : 'mutated',
    range.start,
    range.end,
  ])

describe('markdown live syntax reveal', () => {
  it('registers every frozen state', () => {
    expect([...MARKDOWN_LIVE_REVEAL_STATES]).toEqual([
      'inactive',
      'caret-inside',
      'selection-intersects',
      'pointer-requested',
      'property-editor-open',
      'diagnostic-reveal',
      'composition-active',
    ])
  })

  it('reveals nested *** and ___ markers without exposing the whole block', () => {
    const stars = 'intro ***nested*** tail\n'
    const inner = stars.indexOf('nested')
    const plan = reveal(stars, inner)
    expect(plan.state).toBe('caret-inside')
    expect(plan.target?.markerKind).toBe('strong-emphasis')
    const open = plan.target?.revealedRanges.find((range) => range.role === 'open')
    expect(stars.slice(open!.start, open!.end)).toBe('***')
    expect(
      plan.target?.revealedRanges.some(
        (range) => range.start === 0 && range.end === stars.length,
      ),
    ).toBe(false)

    const under = 'intro ___nested___ tail\n'
    const underPlan = reveal(under, under.indexOf('nested'))
    expect(underPlan.target?.revealedRanges.some((range) => range.role === 'open')).toBe(
      true,
    )
    expect(under.slice(
      underPlan.target!.revealedRanges[0]!.start,
      underPlan.target!.revealedRanges[0]!.end,
    )).toBe('___')
  })

  it('prefers innermost emphasis inside a link and skips escaped markers', () => {
    const source = 'See [**docs**](https://x.test) and \\*plain\\*\n'
    const inner = source.indexOf('d')
    const nested = reveal(source, inner)
    expect(nested.state).toBe('caret-inside')
    expect(nested.target?.markerKind).toBe('strong')
    expect(source.slice(
      nested.target!.revealedRanges.find((range) => range.role === 'open')!.start,
      nested.target!.revealedRanges.find((range) => range.role === 'open')!.end,
    )).toBe('**')

    const escaped = reveal(source, source.indexOf('plain'))
    expect(escaped.state).toBe('inactive')
    expect(escaped.target).toBeNull()
  })

  it('reveals malformed links as source-escape and does not auto-repair', () => {
    const source = '[broken](http://x\n'
    const plan = reveal(source, source.indexOf('h'), { intent: 'diagnostic' })
    expect(plan.state).toBe('diagnostic-reveal')
    expect(plan.target?.revealedRanges.some((range) => range.role === 'source-escape')).toBe(
      true,
    )
    expect(plan.sourceUnchanged).toBe(true)
  })

  it('handles inline code of different backtick lengths, empty headings, footnotes, unclosed fences, and ::p', () => {
    const code = 'say ``a`b`` done\n'
    const codePlan = reveal(code, code.indexOf('a`b'))
    expect(codePlan.target?.markerKind).toBe('code')
    expect(code.slice(
      codePlan.target!.revealedRanges.find((range) => range.role === 'open')!.start,
      codePlan.target!.revealedRanges.find((range) => range.role === 'open')!.end,
    )).toBe('``')

    const heading = '# \n'
    const headingPlan = reveal(heading, 2)
    expect(headingPlan.target?.markerKind).toBe('heading')
    expect(heading.slice(0, headingPlan.target!.revealedRanges[0]!.end)).toBe('# ')

    const note = 'See [^1] there\n'
    const notePlan = reveal(note, note.indexOf('1'), { field: 'label' })
    expect(notePlan.target?.markerKind).toBe('footnote')

    const fence = '```js\nconst x\n'
    const fencePlan = reveal(fence, 4, { intent: 'property-editor', field: 'language' })
    expect(fencePlan.state).toBe('property-editor-open')
    expect(fencePlan.target?.revealedRanges.some((range) => range.role === 'language' || range.role === 'source-escape')).toBe(
      true,
    )

    const group = '::p\nhello\n::\n'
    const groupPlan = reveal(group, 5)
    expect(groupPlan.target?.markerKind).toBe('explicit-paragraph')
    expect(groupPlan.target?.revealedRanges.some((range) => range.role === 'open')).toBe(
      true,
    )
  })

  it('uses pointer, selection, Esc/focus-return, and freezes during composition', () => {
    const source = 'See [docs](https://x.test) end\n'
    const dest = source.indexOf('https')
    const pointer = reveal(source, dest, {
      intent: 'pointer',
      pointerOffset: dest,
    })
    expect(pointer.state).toBe('pointer-requested')
    expect(pointer.target?.revealedRanges.some((range) => range.role === 'destination')).toBe(
      true,
    )

    const selected = reveal(source, source.indexOf('d'), {}, source.indexOf('s') + 1)
    expect(selected.state).toBe('selection-intersects')

    const escaped = reveal(source, dest, { intent: 'escape', previous: pointer })
    expect(escaped.state).toBe('inactive')
    expect(escaped.focusReturn).toEqual({ start: dest, end: dest })

    const composing = reveal(source, dest, {
      composing: true,
      previous: pointer,
    })
    expect(composing.state).toBe('composition-active')
    expect(composing.frozen).toBe(true)
    expect(composing.target?.nodeId).toBe(pointer.target?.nodeId)
  })

  it('does not change source, selection, or history when revealing', () => {
    const source = '**bold**'
    const store = new MarkdownEditorTransactionStore(source, { start: 3, end: 3 })
    const before = { value: store.value, selection: store.selection, history: store.history }
    const plan = reveal(store.value, 3)
    expect(plan.state).toBe('caret-inside')
    expect(store.value).toBe(before.value)
    expect(store.selection).toEqual(before.selection)
    expect(store.history).toEqual(before.history)
    expect(plan.sourceUnchanged).toBe(true)
    expect(markerRoles(plan)?.some((entry) => entry[1] === 'mutated')).toBe(false)
  })

  it('kills block-wide reveal, DOM ranges, plain-text markers, and composition switching', () => {
    const report = evaluateMarkdownLiveRevealMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority.state).toBe('caret-inside')
    expect(byKind['block-wide-reveal']?.accepted).toBe(false)
    expect(byKind['dom-range']?.accepted).toBe(false)
    expect(byKind['plain-text-marker']?.accepted).toBe(false)
    expect(byKind['composition-switch']?.accepted).toBe(false)
  })
})
