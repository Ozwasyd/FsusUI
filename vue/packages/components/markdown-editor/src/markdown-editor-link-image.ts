import {
  validateMarkdownUrl,
  type MarkdownUrlIdentity,
} from '../../../wasm/markdown-url'
import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownStableSyntaxNode,
} from '../../../wasm/markdown-runtime'
import type { MarkdownEditorTransaction } from './markdown-editor-transaction'

export type MarkdownLinkKind =
  | 'inline'
  | 'reference'
  | 'autolink'
  | 'unsupported'

export interface MarkdownLinkSubranges {
  readonly full: { start: number; end: number }
  readonly label: { start: number; end: number }
  readonly destination?: { start: number; end: number }
  readonly title?: { start: number; end: number }
}

export interface MarkdownParsedLink {
  readonly blockIdentity: string
  readonly kind: MarkdownLinkKind
  readonly nodeId: string
  readonly text: string
  readonly labelText: string
  readonly url?: string
  readonly title?: string
  readonly ranges: MarkdownLinkSubranges
  readonly reason?: string
}

const textAt = (
  source: string,
  range: Readonly<{ start: number; end: number }>,
) => source.slice(range.start, range.end)

const isInlineWhitespace = (character: string) =>
  character === ' ' ||
  character === '\t' ||
  character === '\n' ||
  character === '\r' ||
  character === '\f'

const trimRange = (
  source: string,
  range: Readonly<{ start: number; end: number }>,
) => {
  let start = range.start
  let end = range.end
  while (start < end && isInlineWhitespace(source[start] ?? '')) start += 1
  while (end > start && isInlineWhitespace(source[end - 1] ?? '')) end -= 1
  return Object.freeze({ start, end })
}

const splitInlineDestination = (
  source: string,
  projected: Readonly<{ start: number; end: number }>,
) => {
  const range = trimRange(source, projected)
  let escaped = false
  let separator = range.end
  for (let offset = range.start; offset < range.end; offset += 1) {
    const character = source[offset] ?? ''
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
      continue
    }
    if (isInlineWhitespace(character)) {
      separator = offset
      break
    }
  }
  const destination = Object.freeze({
    start: range.start,
    end: separator,
  })
  const tail = trimRange(source, {
    start: separator,
    end: range.end,
  })
  if (tail.start === tail.end) {
    return Object.freeze({ destination })
  }
  const opener = source[tail.start]
  const closer = opener === '(' ? ')' : opener
  if (
    (opener !== '"' && opener !== "'" && opener !== '(') ||
    source[tail.end - 1] !== closer ||
    tail.end - tail.start < 2
  ) {
    return Object.freeze({ destination })
  }
  return Object.freeze({
    destination,
    title: Object.freeze({
      start: tail.start + 1,
      end: tail.end - 1,
    }),
  })
}

export const parseMarkdownLinkNode = (
  source: string,
  node: MarkdownStableSyntaxNode,
): MarkdownParsedLink => {
  const full = node.rawRange
  const text = textAt(source, full)
  const contents = node.rawContentRanges
  const markers = node.rawMarkerRanges.map((range) => textAt(source, range))
  const unsupported = (
    reason: string,
    label = contents[0] ?? full,
  ): MarkdownParsedLink => ({
    blockIdentity: node.blockIdentity,
    kind: 'unsupported',
    nodeId: node.id,
    text,
    labelText: textAt(source, label),
    ranges: {
      full,
      label,
    },
    reason,
  })
  if (node.kind !== 'link' || node.status !== 'valid') {
    return unsupported(node.diagnosticCode ?? 'source-only')
  }

  if (
    contents.length === 1 &&
    markers.length === 2 &&
    markers[0] === '<' &&
    markers[1] === '>'
  ) {
    const destination = contents[0]!
    const value = textAt(source, destination)
    return {
      blockIdentity: node.blockIdentity,
      kind: 'autolink',
      nodeId: node.id,
      text,
      labelText: value,
      url: value,
      ranges: {
        full,
        label: destination,
        destination,
      },
    }
  }

  if (
    contents.length === 2 &&
    markers.length === 3 &&
    markers[0] === '[' &&
    markers[1] === '](' &&
    markers[2] === ')'
  ) {
    const label = contents[0]!
    const target = splitInlineDestination(source, contents[1]!)
    return {
      blockIdentity: node.blockIdentity,
      kind: 'inline',
      nodeId: node.id,
      text,
      labelText: textAt(source, label),
      url: textAt(source, target.destination),
      ...(target.title ? { title: textAt(source, target.title) } : {}),
      ranges: {
        full,
        label,
        destination: target.destination,
        title: target.title,
      },
    }
  }

  if (
    contents.length === 2 &&
    markers.length === 3 &&
    markers[0] === '[' &&
    markers[1] === '][' &&
    markers[2] === ']'
  ) {
    const label = contents[0]!
    return {
      blockIdentity: node.blockIdentity,
      kind: 'reference',
      nodeId: node.id,
      text,
      labelText: textAt(source, label),
      ranges: {
        full,
        label,
      },
    }
  }

  return unsupported('source-only')
}

export const planMarkdownLinkPropertyEdit = (
  source: string,
  link: MarkdownParsedLink,
  properties: { label?: string; url?: string; title?: string },
  expectedRevision?: number,
): MarkdownEditorTransaction => {
  if (link.kind === 'unsupported') {
    throw new Error(
      `Cannot edit properties of unsupported link kind: ${link.reason}`,
    )
  }

  const changes: { from: number; to: number; insert: string }[] = []

  if (properties.title !== undefined && link.kind === 'inline') {
    if (link.ranges.title) {
      changes.push({
        from: link.ranges.title.start,
        to: link.ranges.title.end,
        insert: properties.title,
      })
    } else if (link.ranges.destination) {
      changes.push({
        from: link.ranges.destination.end,
        to: link.ranges.destination.end,
        insert: ` "${properties.title}"`,
      })
    }
  }

  if (properties.url !== undefined && link.ranges.destination) {
    changes.push({
      from: link.ranges.destination.start,
      to: link.ranges.destination.end,
      insert: properties.url,
    })
  }

  if (properties.label !== undefined) {
    changes.push({
      from: link.ranges.label.start,
      to: link.ranges.label.end,
      insert: properties.label,
    })
  }

  // Transactions use original source coordinates in ascending order.
  changes.sort((a, b) => a.from - b.from)

  return {
    changes,
    expectedRevision,
    history: 'separate',
    origin: 'command',
  }
}

export const planMarkdownLinkUnwrap = (
  source: string,
  link: MarkdownParsedLink,
): MarkdownEditorTransaction => {
  if (link.kind === 'unsupported') {
    throw new Error(`Cannot unwrap unsupported link kind: ${link.reason}`)
  }
  const insert = source.slice(link.ranges.label.start, link.ranges.label.end)

  return {
    changes: [
      {
        from: link.ranges.full.start,
        to: link.ranges.full.end,
        insert,
      },
    ],
    history: 'separate',
    origin: 'command',
  }
}

export const planMarkdownImageAltChange = (
  source: string,
  start: number,
  end: number,
  alt: string,
): MarkdownEditorTransaction => {
  const slice = source.slice(start, end)
  const match = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(slice)
  const insert = match ? `![${alt}](${match[2]})` : slice
  return {
    changes: [{ from: start, to: end, insert }],
    history: 'separate',
    origin: 'command',
  }
}

export const validateMarkdownPropertyUrl = (
  value: string,
  identity: MarkdownUrlIdentity,
) => validateMarkdownUrl(value, identity)

export type MarkdownPropertyMutationKind =
  | 'regex-dom'
  | 'whole-node-rewrite'
  | 'hover-only'
  | 'unsafe-url'
  | 'stale-node-commit'
  | 'stale-property'

export const evaluateMarkdownPropertyMutations = () => {
  const source = '[Docs](https://safe.test "Title")'
  const identity = Object.freeze({ id: 'property-mutation', epoch: 4 })
  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    identity,
  )
  const node = projection.nodes.find((candidate) => candidate.kind === 'link')
  if (!node) throw new Error('Link projection mutation fixture is unavailable.')
  const authority = parseMarkdownLinkNode(source, node)
  const propertyEdit = planMarkdownLinkPropertyEdit(
    source,
    authority,
    { url: 'https://next.test' },
    8,
  )
  const unsafe = validateMarkdownPropertyUrl('javascript:alert(1)', {
    documentEpoch: identity.epoch,
    nodeId: authority.nodeId,
    revision: 8,
    value: 'javascript:alert(1)',
    version: 1,
  })
  const deletedProjection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection('plain text'),
    identity,
    projection,
    { from: 0, to: source.length, insert: 'plain text' },
  )

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'regex-dom' as const,
        equivalent:
          authority.nodeId === '' ||
          authority.ranges.full.start === authority.ranges.label.start,
        accepted: false,
      }),
      Object.freeze({
        kind: 'whole-node-rewrite' as const,
        equivalent:
          propertyEdit.changes.length !== 1 ||
          propertyEdit.changes[0]?.from === authority.ranges.full.start,
        accepted: false,
      }),
      Object.freeze({
        kind: 'hover-only' as const,
        equivalent: authority.nodeId.length === 0,
        accepted: false,
      }),
      Object.freeze({
        kind: 'unsafe-url' as const,
        equivalent: unsafe.open.allowed,
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-node-commit' as const,
        equivalent:
          deletedProjection.resolve(authority.nodeId).status === 'current',
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-property' as const,
        equivalent: propertyEdit.expectedRevision !== 8,
        accepted: false,
      }),
    ]),
  })
}
