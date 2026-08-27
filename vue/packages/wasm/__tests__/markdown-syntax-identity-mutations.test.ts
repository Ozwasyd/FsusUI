import { describe, expect, it } from 'vitest'

import { evaluateMarkdownSyntaxIdentityMutations } from '../markdown-runtime'

const document = { id: 'doc-1', epoch: 4 }

describe('markdown syntax identity mutations', () => {
  it('rejects content-hash rematch after an offset insert of the same visible text', () => {
    const report = evaluateMarkdownSyntaxIdentityMutations({
      previousSource: '# Alpha\n',
      nextSource: 'Alpha\n\n# Alpha\n',
      documentIdentity: document,
    })
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )
    const heading = report.authority.nodes.find(
      (node) => node.kind === 'heading',
    )
    const paragraph = report.authority.nodes.find(
      (node) => node.kind === 'paragraph',
    )

    expect(heading?.id).toBe(report.previous.nodes[0]!.id)
    expect(paragraph?.id).not.toBe(report.previous.nodes[0]!.id)
    expect(byKind['content-hash-only']?.equivalent).toBe(false)
    expect(byKind['content-hash-only']?.accepted).toBe(false)
  })

  it('rejects kind+offset, full-document re-id, and cross-document reuse', () => {
    const report = evaluateMarkdownSyntaxIdentityMutations({
      previousSource: '# Alpha\n',
      nextSource: 'Alpha\n\n# Alpha\n',
      documentIdentity: document,
    })
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )

    expect(
      report.authority.nodes.find((node) => node.kind === 'heading')?.id,
    ).toBe(report.previous.nodes[0]!.id)
    expect(byKind['kind-offset']?.accepted).toBe(false)
    expect(byKind['full-document-reid']?.accepted).toBe(false)
    expect(byKind['cross-document-reuse']?.accepted).toBe(false)
    expect(report.mutations.map((mutation) => mutation.kind)).toEqual([
      'kind-offset',
      'content-hash-only',
      'full-document-reid',
      'cross-document-reuse',
    ])
    expect(
      report.mutations.every((mutation) => mutation.equivalent === false),
    ).toBe(true)
  })
})
