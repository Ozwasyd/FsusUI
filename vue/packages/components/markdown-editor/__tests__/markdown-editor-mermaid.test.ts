import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_MERMAID_BUDGET,
  classifyMarkdownMermaidBody,
  commitMarkdownMermaidPreview,
  evaluateMarkdownMermaidMutations,
  planMarkdownMermaidPreview,
} from '../src/markdown-editor-mermaid'
import { getMarkdownXssFeatureOutput } from '../../../../tests/support/markdown-xss-corpus'

const identity = { epoch: 1, id: 'mermaid' }

const validSource = '```mermaid\ngraph TD\nA-->B\n```\n'
const invalidSource = '```mermaid\nnot a diagram\n```\n'

describe('markdown mermaid preview', () => {
  it('binds request identity and previews valid mermaid through the gateway', () => {
    const plan = planMarkdownMermaidPreview({
      config: { theme: 'dark' },
      documentIdentity: identity,
      intent: 'pending',
      mode: 'live',
      revision: 4,
      source: validSource,
      theme: 'dark',
    })
    expect(plan.node?.kind).toBe('mermaid')
    expect(plan.node?.nodeId.startsWith('syn:')).toBe(true)
    expect(plan.request?.id).toBe(
      `tech:${identity.id}:${identity.epoch}:4:${plan.node!.nodeId}`,
    )
    expect(plan.request?.featureKind).toBe('mermaid')
    expect(plan.classification.verdict).toBe('valid')
    expect(plan.chrome).toEqual({ card: false, terminal: false, toolbar: false })
    expect(plan.accessibility.tabStop).toBe(false)
    const committed = commitMarkdownMermaidPreview({
      output: {
        kind: 'mermaid',
        payload: '<svg id="fsus-markdown-mermaid-ok" class="flowchart"></svg>',
        rootId: 'fsus-markdown-mermaid-ok',
      },
      plan,
      source: validSource,
    })
    expect(committed).toMatchObject({
      accepted: true,
      rewrite: false,
      sourceUnchanged: true,
      state: 'resolved',
    })
  })

  it('keeps invalid, large, abort, stale, and deleted results local', () => {
    const invalid = planMarkdownMermaidPreview({
      documentIdentity: identity,
      source: invalidSource,
    })
    expect(invalid.classification.verdict).toBe('invalid')
    expect(invalid.presentation).toBe('source-only')
    expect(invalid.diagnostic?.reveal.state).toBe('diagnostic-reveal')
    expect(invalid.editorCapability).toBe('supported')
    expect(invalid.sourceUnchanged).toBe(true)
    expect(invalid.classification.rewrite).toBe(false)

    const largeBody = `${'A-->B\n'.repeat(MARKDOWN_MERMAID_BUDGET.maxBodyLines + 4)}`
    const large = classifyMarkdownMermaidBody({
      body: `graph TD\n${largeBody}`,
      range: { end: 20, start: 0 },
    })
    expect(large.verdict).toBe('large')

    const plan = planMarkdownMermaidPreview({
      documentIdentity: identity,
      revision: 1,
      source: validSource,
    })
    const aborted = commitMarkdownMermaidPreview({
      aborted: true,
      plan,
      source: validSource,
    })
    expect(aborted.state).toBe('error')
    expect(aborted.sourceUnchanged).toBe(true)
    const stale = commitMarkdownMermaidPreview({
      currentRevision: 9,
      output: {
        kind: 'mermaid',
        payload: '<svg id="ok" class="flowchart"></svg>',
        rootId: 'ok',
      },
      plan,
      source: validSource,
    })
    expect(stale.accepted).toBe(false)
    expect(stale.state).toBe('stale')
    const deleted = commitMarkdownMermaidPreview({
      plan,
      source: 'plain paragraph\n',
    })
    expect(deleted.state).toBe('deleted')
  })

  it('rejects XSS mermaid payloads and does not rewrite source', () => {
    const plan = planMarkdownMermaidPreview({
      documentIdentity: identity,
      revision: 1,
      source: validSource,
    })
    for (const id of [
      'mxss-feature-mermaid-script',
      'mxss-feature-mermaid-foreignobject',
      'mxss-feature-mermaid-external-use',
    ] as const) {
      const committed = commitMarkdownMermaidPreview({
        output: getMarkdownXssFeatureOutput(id),
        plan,
        source: validSource,
      })
      expect(committed.accepted).toBe(false)
      expect(committed.rewrite).toBe(false)
      expect(committed.editorCapability).toBe('supported')
    }
  })

  it('restores height from the source anchor and shares identity across modes', () => {
    const modes = (['source', 'live', 'split', 'preview'] as const).map((mode) =>
      planMarkdownMermaidPreview({
        documentIdentity: identity,
        mode,
        revision: 2,
        source: validSource,
      }),
    )
    expect(new Set(modes.map((plan) => plan.node?.nodeId)).size).toBe(1)
    expect(modes[0]?.height.scrollIntoView).toBe(false)
    expect(modes[0]?.height.trigger).toBe('mermaid-result')
    expect(modes[0]?.height.sourceUnchanged).toBe(true)
    const reveal = planMarkdownMermaidPreview({
      documentIdentity: identity,
      intent: 'source-reveal',
      source: invalidSource,
    })
    expect(reveal.action).toBe('source-reveal')
    expect(reveal.diagnostic?.range.end).toBeGreaterThan(reveal.diagnostic!.range.start)
  })

  it('kills innerHTML, stale commits, whole-editor failure, and auto-rewrite', () => {
    const report = evaluateMarkdownMermaidMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority.classification.verdict).toBe('valid')
    expect(byKind.innerHTML?.accepted).toBe(false)
    expect(byKind['stale-commit']?.accepted).toBe(false)
    expect(byKind['whole-editor-failure']?.accepted).toBe(false)
    expect(byKind['auto-rewrite']?.accepted).toBe(false)
  })
})
