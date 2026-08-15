import { describe, expect, it } from 'vitest'

import {
  evaluateMarkdownSyntaxIdentityMutations,
  stabilizeMarkdownEditorProjection,
  createMarkdownEditorProjection,
} from '../markdown-runtime'

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
    const heading = report.authority.nodes.find((node) => node.kind === 'heading')
    const paragraph = report.authority.nodes.find((node) => node.kind === 'paragraph')

    expect(heading?.id).toBe(report.previous.nodes[0]!.id)
    expect(paragraph?.id).not.toBe(report.previous.nodes[0]!.id)
    expect(byKind['content-hash-only']?.equivalent).toBe(false)
    expect(byKind['content-hash-only']?.accepted).toBe(false)
  })

  it('rejects offset-only rematch after a kind and content change', () => {
    const report = evaluateMarkdownSyntaxIdentityMutations({
      previousSource: '# Alpha\n',
      nextSource: 'Totally different paragraph.\n',
      documentIdentity: document,
    })
    const byKind = Object.fromEntries(
      report.mutations.map((mutation) => [mutation.kind, mutation]),
    )

    expect(report.authority.nodes[0]?.kind).toBe('paragraph')
    expect(report.authority.nodes[0]?.id).not.toBe(report.previous.nodes[0]!.id)
    expect(report.authority.resolve(report.previous.nodes[0]!.id).status).toBe(
      'deleted',
    )
    expect(byKind['offset-only-kind-change']?.equivalent).toBe(false)
    expect(byKind['offset-only-kind-change']?.accepted).toBe(false)
    expect(
      stabilizeMarkdownEditorProjection(
        createMarkdownEditorProjection('Totally different paragraph.\n'),
        document,
        report.previous,
      ).nodes[0]?.id,
    ).toBe(report.authority.nodes[0]?.id)
  })
})
