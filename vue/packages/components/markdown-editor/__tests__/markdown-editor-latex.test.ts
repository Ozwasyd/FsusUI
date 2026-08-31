import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_LATEX_BUDGET,
  classifyMarkdownLatexBody,
  commitMarkdownLatexPreview,
  evaluateMarkdownLatexMutations,
  planMarkdownLatexPreview,
} from '../src/markdown-editor-latex'
import { getMarkdownXssFeatureOutput } from '../../../../tests/support/markdown-xss-corpus'

const identity = { epoch: 1, id: 'latex' }

const blockSource = '$$\nx^2\n$$\n'
const inlineSource = '前 \\(x^2\\) עברית'

describe('markdown latex preview', () => {
  it('plans inline and block nodes from the projection with marker/body ranges', () => {
    const block = planMarkdownLatexPreview({
      documentIdentity: identity,
      intent: 'pending',
      mode: 'live',
      revision: 3,
      source: blockSource,
    })
    expect(block.node?.kind).toBe('latex')
    expect(block.node?.nodeId.startsWith('syn:')).toBe(true)
    expect(block.display).toBe('block')
    expect(block.wraps).toBe(false)
    expect(
      blockSource.slice(
        block.node!.ranges.body.raw.start,
        block.node!.ranges.body.raw.end,
      ),
    ).toContain('x^2')
    expect(block.request?.id).toBe(
      `tech:${identity.id}:${identity.epoch}:3:${block.node!.nodeId}`,
    )

    const caret = inlineSource.indexOf('x')
    const inline = planMarkdownLatexPreview({
      documentIdentity: identity,
      revision: 3,
      selection: { direction: 'none', end: caret, start: caret },
      source: inlineSource,
    })
    expect(inline.node?.kind).toBe('latex')
    expect(inline.display).toBe('inline')
    expect(inline.wraps).toBe(true)
    expect(inline.classification.verdict).toBe('valid')
    expect(
      inlineSource.slice(
        inline.node!.rawRange.start,
        inline.node!.rawRange.end,
      ),
    ).toBe('\\(x^2\\)')
  })

  it('maps CRLF, BOM, CJK, and RTL around math without rewriting source', () => {
    const source = '\uFEFF前\r\n$$\r\n中文\r\n$$\r\nעברית\n'
    const plan = planMarkdownLatexPreview({
      documentIdentity: identity,
      source,
    })
    expect(plan.node?.kind).toBe('latex')
    expect(
      source.slice(
        plan.node!.ranges.body.raw.start,
        plan.node!.ranges.body.raw.end,
      ),
    ).toContain('中文')
    expect(plan.sourceUnchanged).toBe(true)
    expect(plan.classification.rewrite).toBe(false)
  })

  it('keeps invalid, large, abort, stale, and deleted results local', () => {
    const invalid = planMarkdownLatexPreview({
      documentIdentity: identity,
      source: '$$\n{\n$$\n',
    })
    expect(invalid.classification.verdict).toBe('invalid')
    expect(invalid.presentation).toBe('source-only')
    expect(invalid.diagnostic?.reveal.state).toBe('diagnostic-reveal')
    expect(invalid.editorCapability).toBe('supported')

    expect(
      classifyMarkdownLatexBody({
        body: `x + ${'a'.repeat(MARKDOWN_LATEX_BUDGET.maxBodyBytes)}`,
        display: 'block',
        range: { end: 20, start: 0 },
      }).verdict,
    ).toBe('large')

    const plan = planMarkdownLatexPreview({
      documentIdentity: identity,
      revision: 1,
      source: blockSource,
    })
    const committed = commitMarkdownLatexPreview({
      output: {
        kind: 'latex',
        payload: '<span class="katex"><math></math></span>',
      },
      plan,
      source: blockSource,
    })
    expect(committed).toMatchObject({
      accepted: true,
      rewrite: false,
      state: 'resolved',
    })
    expect(
      commitMarkdownLatexPreview({
        aborted: true,
        plan,
        source: blockSource,
      }).state,
    ).toBe('error')
    expect(
      commitMarkdownLatexPreview({
        currentRevision: 9,
        output: { kind: 'latex', payload: '<span class="katex"></span>' },
        plan,
        source: blockSource,
      }).state,
    ).toBe('stale')
    expect(
      commitMarkdownLatexPreview({
        plan,
        source: 'plain paragraph\n',
      }).state,
    ).toBe('deleted')

    const retry = planMarkdownLatexPreview({
      documentIdentity: identity,
      intent: 'retry',
      source: blockSource,
    })
    expect(retry).toMatchObject({
      action: 'pending',
      sourceUnchanged: true,
    })
    expect(retry.request).not.toBeNull()
    const cancel = planMarkdownLatexPreview({
      documentIdentity: identity,
      intent: 'cancel',
      source: blockSource,
    })
    expect(cancel).toMatchObject({
      action: 'cancel',
      sourceUnchanged: true,
    })
    expect(cancel.request).toBeNull()
  })

  it('rejects XSS latex payloads and keeps inline selection plus block scroll stable', () => {
    const plan = planMarkdownLatexPreview({
      documentIdentity: identity,
      revision: 1,
      source: blockSource,
    })
    for (const id of [
      'mxss-feature-latex-event',
      'mxss-feature-latex-annotation',
    ] as const) {
      const committed = commitMarkdownLatexPreview({
        output: getMarkdownXssFeatureOutput(id),
        plan,
        source: blockSource,
      })
      expect(committed.accepted).toBe(false)
      expect(committed.rewrite).toBe(false)
      expect(committed.editorCapability).toBe('supported')
    }
    const modes = (['source', 'live', 'split', 'preview'] as const).map(
      (mode) =>
        planMarkdownLatexPreview({
          documentIdentity: identity,
          mode,
          revision: 2,
          source: blockSource,
        }),
    )
    expect(new Set(modes.map((item) => item.node?.nodeId)).size).toBe(1)
    expect(modes[0]?.height.scrollIntoView).toBe(false)
    expect(modes[0]?.height.trigger).toBe('latex-result')
  })

  it('kills innerHTML, regex parse, auto-rewrite, and whole-editor failure', () => {
    const report = evaluateMarkdownLatexMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority.node?.kind).toBe('latex')
    expect(byKind.innerHTML?.accepted).toBe(false)
    expect(byKind['regex-parse']?.accepted).toBe(false)
    expect(byKind['auto-rewrite']?.accepted).toBe(false)
    expect(byKind['whole-editor-failure']?.accepted).toBe(false)
  })
})
