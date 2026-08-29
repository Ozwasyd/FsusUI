import { createMarkdownEditorProjection } from './markdown-editor-projection'
import {
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
  type MarkdownStableSyntaxNode,
} from './markdown-syntax-identity'
import type { MarkdownEditorSyntaxNode } from './markdown-editor-projection'

export type MarkdownSyntaxIdentityMutationKind =
  | 'kind-offset'
  | 'content-hash-only'
  | 'full-document-reid'
  | 'cross-document-reuse'

export interface MarkdownSyntaxIdentityMutationResult {
  readonly kind: MarkdownSyntaxIdentityMutationKind
  readonly equivalent: boolean
  readonly accepted: boolean
  readonly detail: string
}

export interface MarkdownSyntaxIdentityMutationReport {
  readonly previous: MarkdownStableProjection
  readonly authority: MarkdownStableProjection
  readonly mutations: readonly MarkdownSyntaxIdentityMutationResult[]
}

const visibleHash = (source: string, node: MarkdownEditorSyntaxNode) => {
  let text = source.slice(node.normalizedRange.start, node.normalizedRange.end)
  text = text.replace(/\n+$/g, '')
  text = text.replace(/^```[^\n]*\n([\s\S]*?)\n```$/, '$1')
  text = text.replace(/^>\s?/gm, '')
  text = text.replace(/^(?:[-*+]|\d+[.)]) \[[ xX]\] /gm, '')
  text = text.replace(/^(?:[-*+]|\d+[.)]) /gm, '')
  text = text.replace(/^#{1,6} /gm, '')
  text = text.replace(/^\[\^[^\]]+\]:\s?/, '')
  text = text.replace(/^::p\n/, '').replace(/\n::$/, '')
  if (/^\|/.test(text)) {
    text = text
      .split('\n')
      .filter((line) => /^\|/.test(line) && !/^\|[\s:|-]+\|$/.test(line.trim()))
      .flatMap((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim()),
      )
      .filter(Boolean)
      .join('\n')
  }
  return text.trim()
}

const fillRemainingIds = (
  nextNodes: readonly MarkdownEditorSyntaxNode[],
  documentIdentity: MarkdownDocumentIdentity,
  assigned: Array<string | undefined>,
) => {
  const used = new Set(
    assigned.flatMap((id) => {
      if (!id) return []
      const parts = id.split(':')
      return [`${parts[3]}:${parts[parts.length - 1]}`]
    }),
  )
  return nextNodes.map((node, index) => {
    const existing = assigned[index]
    if (existing) return existing
    let ordinal = 0
    while (used.has(`${node.kind}:${ordinal}`)) ordinal += 1
    used.add(`${node.kind}:${ordinal}`)
    return `syn:${documentIdentity.id}:${documentIdentity.epoch}:${node.kind}:${ordinal}`
  })
}

const rematchByContentHash = (
  previous: MarkdownStableProjection,
  nextSource: string,
  documentIdentity: MarkdownDocumentIdentity,
): readonly string[] => {
  const next = createMarkdownEditorProjection(nextSource)
  const assigned: Array<string | undefined> = next.nodes.map(() => undefined)
  const usedPrevious = new Set<number>()
  next.nodes.forEach((node, nextIndex) => {
    const hash = visibleHash(next.identity.normalizedSource, node)
    if (!hash) return
    const previousIndex = previous.nodes.findIndex(
      (candidate, index) =>
        !usedPrevious.has(index) &&
        visibleHash(previous.normalizedSource, candidate) === hash,
    )
    if (previousIndex < 0) return
    assigned[nextIndex] = previous.nodes[previousIndex]!.id
    usedPrevious.add(previousIndex)
  })
  return fillRemainingIds(next.nodes, documentIdentity, assigned)
}

const identifyByKindOffset = (
  nextSource: string,
  documentIdentity: MarkdownDocumentIdentity,
): readonly string[] => {
  const next = createMarkdownEditorProjection(nextSource)
  return next.nodes.map(
    (node) =>
      `syn:${documentIdentity.id}:${documentIdentity.epoch}:${node.kind}:${node.rawRange.start}`,
  )
}

const reidentifyWholeDocument = (
  nextSource: string,
  documentIdentity: MarkdownDocumentIdentity,
): readonly string[] => {
  const next = createMarkdownEditorProjection(nextSource)
  return next.nodes.map(
    (node, index) =>
      `syn:${documentIdentity.id}:${documentIdentity.epoch}:${node.kind}:${index + next.nodes.length}`,
  )
}

const sameIds = (
  left: readonly MarkdownStableSyntaxNode[],
  rightIds: readonly string[],
) =>
  left.length === rightIds.length &&
  left.every((node, index) => node.id === rightIds[index])

export const evaluateMarkdownSyntaxIdentityMutations = (input: {
  readonly previousSource: string
  readonly nextSource: string
  readonly documentIdentity: MarkdownDocumentIdentity
}): MarkdownSyntaxIdentityMutationReport => {
  const previous = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(input.previousSource),
    input.documentIdentity,
  )
  const authority = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(input.nextSource),
    input.documentIdentity,
    previous,
  )
  const hashIds = rematchByContentHash(
    previous,
    input.nextSource,
    input.documentIdentity,
  )
  const kindOffsetIds = identifyByKindOffset(
    input.nextSource,
    input.documentIdentity,
  )
  const fullDocumentIds = reidentifyWholeDocument(
    input.nextSource,
    input.documentIdentity,
  )
  const otherDocumentIdentity = Object.freeze({
    id: `${input.documentIdentity.id}-other`,
    epoch: input.documentIdentity.epoch,
  })
  const otherDocument = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(input.previousSource),
    otherDocumentIdentity,
    previous,
  )
  const hashEquivalent = sameIds(authority.nodes, hashIds)
  const kindOffsetEquivalent = sameIds(authority.nodes, kindOffsetIds)
  const fullDocumentEquivalent = sameIds(authority.nodes, fullDocumentIds)
  const crossDocumentEquivalent = sameIds(
    otherDocument.nodes,
    previous.nodes.map((node) => node.id),
  )

  return Object.freeze({
    previous,
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'kind-offset' as const,
        equivalent: kindOffsetEquivalent,
        accepted: kindOffsetEquivalent,
        detail: 'kind plus raw offset must not define syntax identity',
      }),
      Object.freeze({
        kind: 'content-hash-only' as const,
        equivalent: hashEquivalent,
        accepted: hashEquivalent,
        detail:
          'visible-text hash rematch must not steal an identity on insert',
      }),
      Object.freeze({
        kind: 'full-document-reid' as const,
        equivalent: fullDocumentEquivalent,
        accepted: fullDocumentEquivalent,
        detail: 'ordinary edits must not replace every current syntax identity',
      }),
      Object.freeze({
        kind: 'cross-document-reuse' as const,
        equivalent: crossDocumentEquivalent,
        accepted: crossDocumentEquivalent,
        detail: 'a different document identity must not reuse prior syntax ids',
      }),
    ]),
  })
}
