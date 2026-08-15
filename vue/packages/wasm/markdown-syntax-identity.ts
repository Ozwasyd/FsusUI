import type {
  MarkdownEditorProjectionResult,
  MarkdownEditorSyntaxNode,
} from './markdown-editor-projection'

export interface MarkdownDocumentIdentity {
  readonly id: string
  readonly epoch: number
}

export type MarkdownSyntaxIdentityStatus = 'current' | 'deleted' | 'invalid'

export interface MarkdownStableSyntaxNode extends MarkdownEditorSyntaxNode {
  readonly id: string
}

export interface MarkdownStableProjection {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly nodes: readonly MarkdownStableSyntaxNode[]
  resolve(id: string): {
    readonly status: MarkdownSyntaxIdentityStatus
    readonly node?: MarkdownStableSyntaxNode
  }
}

const identityFor = (
  documentIdentity: MarkdownDocumentIdentity,
  kind: string,
  ordinal: number,
) => `syn:${documentIdentity.id}:${documentIdentity.epoch}:${kind}:${ordinal}`

export const stabilizeMarkdownEditorProjection = (
  projection: MarkdownEditorProjectionResult,
  documentIdentity: MarkdownDocumentIdentity,
): MarkdownStableProjection => {
  if (!documentIdentity.id) {
    throw new Error('stable syntax identity requires a document id')
  }
  if (!Number.isInteger(documentIdentity.epoch)) {
    throw new Error('stable syntax identity requires a document epoch')
  }

  const seen = new Map<string, number>()
  const nodes = projection.nodes.map((node) => {
    const ordinal = seen.get(node.kind) ?? 0
    seen.set(node.kind, ordinal + 1)
    return Object.freeze({
      ...node,
      id: identityFor(documentIdentity, node.kind, ordinal),
    })
  })

  const byId = new Map(nodes.map((node) => [node.id, node]))

  return Object.freeze({
    documentIdentity,
    nodes: Object.freeze(nodes),
    resolve(id: string) {
      if (!id.startsWith('syn:')) {
        return { status: 'invalid' as const }
      }
      const parts = id.split(':')
      if (parts.length < 5 || parts[1] !== documentIdentity.id) {
        return { status: 'invalid' as const }
      }
      if (Number(parts[2]) !== documentIdentity.epoch) {
        return { status: 'deleted' as const }
      }
      const node = byId.get(id)
      if (!node) {
        return { status: 'deleted' as const }
      }
      return { status: 'current' as const, node }
    },
  })
}
