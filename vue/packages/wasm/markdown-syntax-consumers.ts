import { MarkdownRuntimeError } from './markdown-runtime-error'
import type {
  MarkdownStableProjection,
  MarkdownStableSyntaxNode,
  MarkdownSyntaxIdentityStatus,
} from './markdown-syntax-identity'

export interface MarkdownIdentityConsumerEntry {
  readonly id: string
  readonly kind: string
  readonly range: { readonly start: number; readonly end: number }
}

export interface MarkdownOutlineEntry extends MarkdownIdentityConsumerEntry {
  readonly kind: 'heading'
  readonly title: string
  readonly level: number
}

export interface MarkdownTableEntry extends MarkdownIdentityConsumerEntry {
  readonly kind: 'table'
}

export interface MarkdownSearchHit extends MarkdownIdentityConsumerEntry {
  readonly query: string
}

export interface MarkdownTechnicalEntry extends MarkdownIdentityConsumerEntry {
  readonly kind: 'code' | 'latex' | 'mermaid'
}

export interface MarkdownPropertyEntry extends MarkdownIdentityConsumerEntry {
  readonly kind: 'link' | 'image'
}

const headingTitleOf = (source: string, node: MarkdownStableSyntaxNode) => {
  const slice = source.slice(node.normalizedRange.start, node.normalizedRange.end)
  const match = /^(#{1,6})\s+(.*)$/m.exec(slice.trimEnd())
  return {
    level: match ? match[1].length : 1,
    title: (match?.[2] ?? slice).trim(),
  }
}

const requireStableProjection = (projection: MarkdownStableProjection) => {
  if (!projection?.documentIdentity?.id || !Array.isArray(projection.nodes)) {
    throw new MarkdownRuntimeError(
      'protocol',
      'outline/table/search require a stable projection',
    )
  }
  return projection
}

const resolveThrough = (
  projection: MarkdownStableProjection,
  id: string,
): {
  readonly status: MarkdownSyntaxIdentityStatus
  readonly node?: MarkdownStableSyntaxNode
} => projection.resolve(id)

export const createMarkdownOutlineEntries = (
  projection: MarkdownStableProjection,
): readonly MarkdownOutlineEntry[] => {
  const stable = requireStableProjection(projection)
  return Object.freeze(
    stable.nodes
      .filter((node) => node.kind === 'heading')
      .map((node) => {
        const heading = headingTitleOf(stable.normalizedSource, node)
        return Object.freeze({
          id: node.id,
          kind: 'heading' as const,
          range: Object.freeze({
            start: node.rawRange.start,
            end: node.rawRange.end,
          }),
          title: heading.title,
          level: heading.level,
        })
      }),
  )
}

export const createMarkdownTableEntries = (
  projection: MarkdownStableProjection,
): readonly MarkdownTableEntry[] => {
  const stable = requireStableProjection(projection)
  return Object.freeze(
    stable.nodes
      .filter((node) => node.kind === 'table')
      .map((node) =>
        Object.freeze({
          id: node.id,
          kind: 'table' as const,
          range: Object.freeze({
            start: node.rawRange.start,
            end: node.rawRange.end,
          }),
        }),
      ),
  )
}

export const searchMarkdownStableProjection = (
  projection: MarkdownStableProjection,
  query: string,
): readonly MarkdownSearchHit[] => {
  const stable = requireStableProjection(projection)
  if (typeof query !== 'string') {
    throw new MarkdownRuntimeError('protocol', 'search query must be a string')
  }
  if (!query) return Object.freeze([])

  return Object.freeze(
    stable.nodes
      .filter((node) =>
        stable.normalizedSource
          .slice(node.normalizedRange.start, node.normalizedRange.end)
          .includes(query),
      )
      .map((node) =>
        Object.freeze({
          id: node.id,
          kind: node.kind,
          range: Object.freeze({
            start: node.rawRange.start,
            end: node.rawRange.end,
          }),
          query,
        }),
      ),
  )
}

export const resolveMarkdownConsumerIdentity = (
  projection: MarkdownStableProjection,
  id: string,
) => resolveThrough(requireStableProjection(projection), id)

const entryFromNode = (
  node: MarkdownStableSyntaxNode,
): MarkdownIdentityConsumerEntry =>
  Object.freeze({
    id: node.id,
    kind: node.kind,
    range: Object.freeze({
      start: node.rawRange.start,
      end: node.rawRange.end,
    }),
  })

export const createMarkdownTechnicalEntries = (
  projection: MarkdownStableProjection,
): readonly MarkdownTechnicalEntry[] => {
  const stable = requireStableProjection(projection)
  return Object.freeze(
    stable.nodes
      .filter(
        (node): node is MarkdownStableSyntaxNode & {
          kind: MarkdownTechnicalEntry['kind']
        } =>
          node.kind === 'code' || node.kind === 'latex' || node.kind === 'mermaid',
      )
      .map((node) =>
        Object.freeze({
          ...entryFromNode(node),
          kind: node.kind,
        }),
      ),
  )
}

export const createMarkdownPropertyEntries = (
  projection: MarkdownStableProjection,
): readonly MarkdownPropertyEntry[] => {
  const stable = requireStableProjection(projection)
  return Object.freeze(
    stable.nodes
      .filter(
        (node): node is MarkdownStableSyntaxNode & {
          kind: MarkdownPropertyEntry['kind']
        } => node.kind === 'link' || node.kind === 'image',
      )
      .map((node) =>
        Object.freeze({
          ...entryFromNode(node),
          kind: node.kind,
        }),
      ),
  )
}
