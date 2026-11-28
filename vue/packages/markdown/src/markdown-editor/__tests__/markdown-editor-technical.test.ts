import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_TECHNICAL_NODE_KINDS,
  commitMarkdownTechnicalFeatureResult,
  createMarkdownTechnicalFeatureRequest,
  evaluateMarkdownTechnicalMutations,
  resolveMarkdownTechnicalAtomic,
  resolveMarkdownTechnicalDiagnostic,
  resolveMarkdownTechnicalHeight,
  resolveMarkdownTechnicalNode,
} from '../src/markdown-editor-technical'
import { applyMarkdownEditorChanges } from '../src/markdown-editor-transaction'
import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
} from '../../../wasm/markdown-runtime'

const identity = { epoch: 1, id: 'tech' }

const fixtures: Record<(typeof MARKDOWN_TECHNICAL_NODE_KINDS)[number], string> = {
  code: '```js\nconst x = 1\n```\n',
  latex: '$$\nx^2\n$$\n',
  mermaid: '```mermaid\ngraph TD\n```\n',
}

describe('markdown technical node contract', () => {
  it('shares opening/info/body/closing ranges and request identity for code, latex, and mermaid', () => {
    const nodeIds = new Set<string>()
    for (const kind of MARKDOWN_TECHNICAL_NODE_KINDS) {
      const source = fixtures[kind]
      const node = resolveMarkdownTechnicalNode({
        documentIdentity: identity,
        kind,
        revision: 3,
        source,
      })
      expect(node?.kind).toBe(kind)
      expect(node?.nodeId.startsWith('syn:')).toBe(true)
      expect(node?.ranges.closed).toBe(true)
      expect(node?.ranges.opening.raw.end).toBeGreaterThan(node!.ranges.opening.raw.start)
      expect(node?.ranges.body.raw.end).toBeGreaterThan(node!.ranges.body.raw.start)
      expect(node?.ranges.closing.raw.end).toBeGreaterThan(node!.ranges.closing.raw.start)
      expect(source.slice(node!.ranges.body.raw.start, node!.ranges.body.raw.end)).not.toMatch(
        /^```|^\$\$/,
      )
      nodeIds.add(node!.nodeId)

      const request = createMarkdownTechnicalFeatureRequest({
        config: { theme: 'dark' },
        documentIdentity: identity,
        kind,
        locale: 'zh-CN',
        mode: 'live',
        revision: 3,
        source,
        theme: 'dark',
      })
      expect(request?.id).toBe(`tech:${identity.id}:${identity.epoch}:3:${node!.nodeId}`)
      expect(request?.state).toBe('pending')
      expect(request?.featureKind).toBe(kind === 'code' ? 'code-highlight' : kind)

      const modes = (['source', 'live', 'split', 'preview'] as const).map((mode) =>
        createMarkdownTechnicalFeatureRequest({
          documentIdentity: identity,
          kind,
          mode,
          revision: 3,
          source,
        }),
      )
      expect(new Set(modes.map((item) => item?.nodeId)).size).toBe(1)
    }
    expect(nodeIds.size).toBe(3)
  })

  it('maps CRLF, BOM, CJK, and emoji ranges through the source coordinate map', () => {
    const source = '\uFEFF```js\r\n中文 👩‍💻\r\n```\r\n'
    const node = resolveMarkdownTechnicalNode({
      documentIdentity: identity,
      kind: 'code',
      source,
    })
    expect(node).toBeTruthy()
    expect(source.slice(node!.ranges.info.raw.start, node!.ranges.info.raw.end).trim()).toBe(
      'js',
    )
    expect(source.slice(node!.ranges.body.raw.start, node!.ranges.body.raw.end)).toContain('中文')
    expect(node!.ranges.body.normalized.start).toBeGreaterThanOrEqual(0)
    expect(node!.ranges.body.normalized.end).toBeGreaterThan(node!.ranges.body.normalized.start)
  })

  it('rejects stale, deleted, and document-switched feature results without writing source', () => {
    const source = fixtures.code
    const request = createMarkdownTechnicalFeatureRequest({
      documentIdentity: identity,
      kind: 'code',
      revision: 1,
      source,
    })
    expect(request).toBeTruthy()
    const stale = commitMarkdownTechnicalFeatureResult({
      currentRevision: 2,
      request: request!,
      source,
    })
    expect(stale).toMatchObject({
      accepted: false,
      sourceUnchanged: true,
      state: 'stale',
      editorCapability: 'supported',
    })
    const switched = commitMarkdownTechnicalFeatureResult({
      currentIdentity: { epoch: 9, id: identity.id },
      request: request!,
      source,
    })
    expect(switched.state).toBe('document-switched')
    const deleted = commitMarkdownTechnicalFeatureResult({
      request: request!,
      source: 'plain paragraph\n',
    })
    expect(deleted.state).toBe('deleted')
    const resolved = commitMarkdownTechnicalFeatureResult({
      output: { kind: 'code-highlight', payload: '<pre><code></code></pre>' },
      request: request!,
      source,
    })
    expect(resolved.state).toBe('resolved')
    expect(resolved.sourceUnchanged).toBe(true)
  })

  it('reveals an exact source range for unclosed and failed technical nodes', () => {
    const source = '```js\nconst x = 1\n'
    const projection = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(source),
      identity,
    )
    expect(projection.nodes).toContainEqual(
      expect.objectContaining({
        diagnosticCode: 'unclosed-code-fence',
        kind: 'malformed',
        status: 'malformed',
      }),
    )
    const diagnostic = resolveMarkdownTechnicalDiagnostic({
      documentIdentity: identity,
      kind: 'code',
      projection,
      source,
    })
    expect(diagnostic?.code).toBe('unclosed-fence')
    expect(diagnostic?.reveal.state).toBe('diagnostic-reveal')
    expect(diagnostic?.range.end).toBeGreaterThan(diagnostic!.range.start)
    expect(source.slice(diagnostic!.range.start, diagnostic!.range.end)).toContain('```')
  })

  it('reuses the #335 atomic primitive and #336 height restore', () => {
    for (const kind of MARKDOWN_TECHNICAL_NODE_KINDS) {
      const source = fixtures[kind]
      const before = resolveMarkdownTechnicalAtomic({
        action: 'caret-before',
        documentIdentity: identity,
        kind,
        revision: 0,
        selection: { direction: 'none', end: 0, start: 0 },
        source,
      })
      expect(before.kind).toBe(kind)
      expect(before.accessibility.tabStop).toBe(false)
      const deleted = resolveMarkdownTechnicalAtomic({
        action: 'delete',
        documentIdentity: identity,
        kind,
        nodeId: before.nodeId ?? undefined,
        revision: 0,
        selection: before.selection,
        source,
      })
      const next = applyMarkdownEditorChanges(source, deleted.transaction!.changes)!.value
      expect(next.length).toBeLessThan(source.length)
      const height = resolveMarkdownTechnicalHeight({
        documentIdentity: identity,
        kind,
        revision: 1,
        selection: { direction: 'none', end: 0, start: 0 },
        source,
      })
      expect(height.scrollIntoView).toBe(false)
      expect(height.sourceUnchanged).toBe(true)
      expect(['shiki-result', 'latex-result', 'mermaid-result']).toContain(height.trigger)
    }
  })

  it('kills regex nodes, consumer innerHTML, body-hash reuse, and toast-only errors', () => {
    const report = evaluateMarkdownTechnicalMutations()
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    expect(report.authority?.nodeId.startsWith('syn:')).toBe(true)
    expect(byKind['regex-node']?.accepted).toBe(false)
    expect(byKind.innerHTML?.accepted).toBe(false)
    expect(byKind['body-hash-reuse']?.accepted).toBe(false)
    expect(byKind['toast-only-error']?.accepted).toBe(false)
  })
})
