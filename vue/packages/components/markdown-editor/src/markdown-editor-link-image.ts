import {
  type MarkdownUrlIdentity,
  validateMarkdownUrl,
} from '../../../wasm/markdown-url'
import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableSyntaxNode,
} from '../../../wasm/markdown-runtime'
import type { MarkdownEditorTransaction } from './markdown-editor-transaction'
import {
  commitMarkdownAttachmentResult,
  createMarkdownAttachmentBatch,
  type MarkdownAttachmentBatchIntent,
  type MarkdownAttachmentInputFile,
} from './markdown-editor-attachment'

export interface DecomposedMarkdownImageSubrange {
  readonly start: number
  readonly end: number
}

export interface DecomposedMarkdownImageNode {
  readonly full: DecomposedMarkdownImageSubrange
  readonly marker: DecomposedMarkdownImageSubrange
  readonly alt: DecomposedMarkdownImageSubrange & {
    readonly value: string
    readonly raw: string
  }
  readonly destination: DecomposedMarkdownImageSubrange & {
    readonly value: string
  }
  readonly title:
    | (DecomposedMarkdownImageSubrange & {
        readonly value: string
        readonly quote: string
      })
    | null
}

const escapeAltText = (text: string) =>
  text.replace(/[\\]/g, '\\\\').replace(/\]/g, '\\]')

export const decomposeMarkdownImageNode = (
  source: string,
  range: { readonly start: number; readonly end: number },
): DecomposedMarkdownImageNode | null => {
  const { start, end } = range
  if (start < 0 || end > source.length || end - start < 4) return null
  if (source[start] !== '!' || source[start + 1] !== '[') return null

  let index = start + 2
  let altRaw = ''
  while (index < end) {
    const char = source[index]
    if (char === '\\' && index + 1 < end) {
      altRaw += source.slice(index, index + 2)
      index += 2
      continue
    }
    if (char === ']') {
      break
    }
    altRaw += char
    index += 1
  }

  if (index >= end || source[index] !== ']') return null
  const altEnd = index
  index += 1 // skip "]"

  // expect "("
  if (index >= end || source[index] !== '(') return null
  index += 1 // skip "("

  // skip whitespace before destination
  while (index < end && /\s/.test(source[index]!)) {
    index += 1
  }
  const destStart = index

  // find destination end (space, quote, or ")")
  while (index < end && !/\s/.test(source[index]!) && source[index] !== ')') {
    index += 1
  }
  const destEnd = index
  const destinationValue = source.slice(destStart, destEnd)

  // skip whitespace between destination and title
  while (index < end && /\s/.test(source[index]!)) {
    index += 1
  }

  let titleData:
    | (DecomposedMarkdownImageSubrange & {
        readonly value: string
        readonly quote: string
      })
    | null = null

  if (index < end && (source[index] === '"' || source[index] === "'")) {
    const quote = source[index]!
    const titleStart = index
    index += 1
    let titleVal = ''
    while (index < end && source[index] !== quote) {
      if (source[index] === '\\' && index + 1 < end) {
        titleVal += source[index + 1]
        index += 2
        continue
      }
      titleVal += source[index]
      index += 1
    }
    if (index < end && source[index] === quote) {
      index += 1
      titleData = Object.freeze({
        start: titleStart,
        end: index,
        value: titleVal,
        quote,
      })
    }
  }

  // skip whitespace before closing ")"
  while (index < end && /\s/.test(source[index]!)) {
    index += 1
  }

  return Object.freeze({
    full: Object.freeze({ start, end }),
    marker: Object.freeze({ start, end: start + 2 }),
    alt: Object.freeze({
      start: start + 2,
      end: altEnd,
      raw: altRaw,
      value: altRaw.replace(/\\([\]\\])/g, '$1'),
    }),
    destination: Object.freeze({
      start: destStart,
      end: destEnd,
      value: destinationValue,
    }),
    title: titleData ? Object.freeze(titleData) : null,
  })
}

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

interface MarkdownInlineDestination {
  readonly destination: { readonly start: number; readonly end: number }
  readonly title?: { readonly start: number; readonly end: number }
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
): MarkdownInlineDestination => {
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
    const title: { start: number; end: number } | undefined = target.title
    return {
      blockIdentity: node.blockIdentity,
      kind: 'inline',
      nodeId: node.id,
      text,
      labelText: textAt(source, label),
      url: textAt(source, target.destination),
      ...(title ? { title: textAt(source, title) } : {}),
      ranges: {
        full,
        label,
        destination: target.destination,
        ...(title ? { title } : {}),
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

export const planMarkdownImageAltEdit = (
  source: string,
  imageRange: { readonly start: number; readonly end: number },
  newAlt: string,
): MarkdownEditorTransaction => {
  const decomposed = decomposeMarkdownImageNode(source, imageRange)
  if (!decomposed) {
    return planMarkdownImageAltChange(
      source,
      imageRange.start,
      imageRange.end,
      newAlt,
    )
  }
  return Object.freeze({
    changes: Object.freeze([
      Object.freeze({
        from: decomposed.alt.start,
        to: decomposed.alt.end,
        insert: escapeAltText(newAlt),
      }),
    ]),
    history: 'separate',
    origin: 'command',
  })
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
  return Object.freeze({
    changes: Object.freeze([{ from: start, to: end, insert }]),
    history: 'separate',
    origin: 'command',
  })
}

export const planMarkdownImageDestinationEdit = (
  source: string,
  imageRange: { readonly start: number; readonly end: number },
  newDestination: string,
): MarkdownEditorTransaction => {
  const decomposed = decomposeMarkdownImageNode(source, imageRange)
  if (!decomposed) {
    return Object.freeze({
      changes: Object.freeze([]),
      history: 'separate',
      origin: 'command',
    })
  }
  return Object.freeze({
    changes: Object.freeze([
      Object.freeze({
        from: decomposed.destination.start,
        to: decomposed.destination.end,
        insert: newDestination,
      }),
    ]),
    history: 'separate',
    origin: 'command',
  })
}

export const planMarkdownImageTitleEdit = (
  source: string,
  imageRange: { readonly start: number; readonly end: number },
  newTitle: string | null,
): MarkdownEditorTransaction => {
  const decomposed = decomposeMarkdownImageNode(source, imageRange)
  if (!decomposed) {
    return Object.freeze({
      changes: Object.freeze([]),
      history: 'separate',
      origin: 'command',
    })
  }

  if (decomposed.title) {
    if (newTitle === null) {
      // remove title and preceding space
      let removeStart = decomposed.title.start
      while (
        removeStart > decomposed.destination.end &&
        /\s/.test(source[removeStart - 1]!)
      ) {
        removeStart -= 1
      }
      return Object.freeze({
        changes: Object.freeze([
          Object.freeze({
            from: removeStart,
            to: decomposed.title.end,
            insert: '',
          }),
        ]),
        history: 'separate',
        origin: 'command',
      })
    }
    return Object.freeze({
      changes: Object.freeze([
        Object.freeze({
          from: decomposed.title.start,
          to: decomposed.title.end,
          insert: `"${newTitle.replace(/"/g, '\\"')}"`,
        }),
      ]),
      history: 'separate',
      origin: 'command',
    })
  }

  if (newTitle !== null) {
    // insert title before ")"
    const insertPos = decomposed.full.end - 1
    return Object.freeze({
      changes: Object.freeze([
        Object.freeze({
          from: insertPos,
          to: insertPos,
          insert: ` "${newTitle.replace(/"/g, '\\"')}"`,
        }),
      ]),
      history: 'separate',
      origin: 'command',
    })
  }

  return Object.freeze({
    changes: Object.freeze([]),
    history: 'separate',
    origin: 'command',
  })
}

export const planMarkdownImageRemove = (
  source: string,
  imageRange: { readonly start: number; readonly end: number },
  options?: { readonly keepAltText?: boolean },
): MarkdownEditorTransaction => {
  const decomposed = decomposeMarkdownImageNode(source, imageRange)
  const insert = options?.keepAltText && decomposed ? decomposed.alt.value : ''
  return Object.freeze({
    changes: Object.freeze([
      Object.freeze({
        from: imageRange.start,
        to: imageRange.end,
        insert,
      }),
    ]),
    history: 'separate',
    origin: 'command',
  })
}

export const planMarkdownImageAttachmentReplace = (input: {
  readonly source: string
  readonly imageRange: { readonly start: number; readonly end: number }
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly revision: number
  readonly file: MarkdownAttachmentInputFile
}): MarkdownAttachmentBatchIntent => {
  return createMarkdownAttachmentBatch({
    sourceKind: 'pick',
    documentIdentity: input.documentIdentity,
    revision: input.revision,
    range: input.imageRange,
    items: [
      {
        mimeType: input.file.mimeType || input.file.type || 'image/png',
        name: input.file.name || 'replacement.png',
        byteLength: input.file.byteLength ?? input.file.size ?? 0,
        kind: 'image',
        signal: input.file.signal,
      },
    ],
  })
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

export type MarkdownImagePropertyMutationKind =
  | 'dom-attributes'
  | 'ai-alt'
  | 'unsafe-preview'
  | 'whole-node-rewrite'
  | 'attachment-resurrection'

export const evaluateMarkdownImagePropertyMutations = (
  source = '![initial alt](https://cdn.example/initial.png "initial title")',
) => {
  const range = { start: 0, end: source.length }
  const decomposed = decomposeMarkdownImageNode(source, range)
  if (!decomposed) {
    throw new Error('Image property mutation fixture is unavailable.')
  }
  const altEdit = planMarkdownImageAltEdit(source, range, 'new alt')
  const isWholeNodeRewrite =
    altEdit.changes.length === 1 &&
    altEdit.changes[0]!.from === range.start &&
    altEdit.changes[0]!.to === range.end

  const unsafeUrl = validateMarkdownPropertyUrl('javascript:alert(1)', {
    documentEpoch: 1,
    revision: 1,
    nodeId: 'node:1',
    value: 'javascript:alert(1)',
    version: 1,
  })

  // dom-attributes mutant: re-derive properties from rendered `<img>` attribute
  // values. HTML attributes carry the unescaped value, so the mutant loses the
  // raw source bytes that the projection authority preserves.
  const escapedSource = '![CJK \\] alt](https://cdn.example/pic.png "t")'
  const escaped = decomposeMarkdownImageNode(escapedSource, {
    start: 0,
    end: escapedSource.length,
  })
  if (!escaped) {
    throw new Error('Escaped image mutation fixture is unavailable.')
  }
  const renderedAttributes = `<img alt="${escaped.alt.value}" src="${escaped.destination.value}">`
  const domAttributeAlt = /alt="([^"]*)"/.exec(renderedAttributes)?.[1] ?? null

  // ai-alt mutant: backfill an empty alt from the title or destination file
  // name. The authority keeps alt independent and never backfills.
  const emptyAltSource = '![](/media/sunset.png "Sunset")'
  const emptyAlt = decomposeMarkdownImageNode(emptyAltSource, {
    start: 0,
    end: emptyAltSource.length,
  })
  if (!emptyAlt) {
    throw new Error('Empty-alt image mutation fixture is unavailable.')
  }
  const backfilledAlt =
    emptyAlt.alt.value ||
    emptyAlt.title?.value ||
    emptyAlt.destination.value.split('/').pop() ||
    ''

  // attachment-resurrection mutant: replay a late replace result after the
  // image node was deleted. The lifecycle guard must reject the commit.
  const replaceIdentity: MarkdownDocumentIdentity = {
    id: 'image-mutation',
    epoch: 2,
  }
  const replaceIntent = planMarkdownImageAttachmentReplace({
    source,
    imageRange: range,
    documentIdentity: replaceIdentity,
    revision: 6,
    file: { name: 'late.png', mimeType: 'image/png', byteLength: 10 },
  })
  const lateReplace = commitMarkdownAttachmentResult({
    documentIdentity: replaceIdentity,
    revision: 6,
    nodeStatus: 'deleted',
    result: {
      status: 'resolved',
      batchId: replaceIntent.batchId,
      itemId: replaceIntent.items[0]!.itemId,
      documentIdentity: replaceIdentity,
      revision: 6,
      payload: {
        markdownKind: 'image',
        href: '/media/late.png',
        mimeType: 'image/png',
      },
    },
  })

  return Object.freeze({
    decomposed,
    evidence: Object.freeze({
      domAttributes: Object.freeze({
        authorityAltRaw: escaped.alt.raw,
        mutantRenderedAlt: domAttributeAlt,
      }),
      aiAlt: Object.freeze({
        authorityAlt: emptyAlt.alt.value,
        mutantBackfill: backfilledAlt,
      }),
      unsafePreview: Object.freeze({
        dangerousState: unsafeUrl.state,
        dangerousOpenAllowed: unsafeUrl.open.allowed,
      }),
      wholeNodeRewrite: Object.freeze({
        altEditChangeCount: altEdit.changes.length,
        altEditFrom: altEdit.changes[0]!.from,
        altEditTo: altEdit.changes[0]!.to,
        nodeStart: range.start,
        nodeEnd: range.end,
      }),
      attachmentResurrection: Object.freeze({
        mutantCommitStatus: lateReplace.status,
        mutantCommitAccepted: lateReplace.accepted,
      }),
    }),
    mutations: Object.freeze([
      Object.freeze({
        kind: 'dom-attributes' as const,
        equivalent: domAttributeAlt === escaped.alt.raw,
        accepted: false,
      }),
      Object.freeze({
        kind: 'ai-alt' as const,
        equivalent: backfilledAlt === emptyAlt.alt.value,
        accepted: false,
      }),
      Object.freeze({
        kind: 'unsafe-preview' as const,
        equivalent: unsafeUrl.state === 'valid-external',
        accepted: false,
      }),
      Object.freeze({
        kind: 'whole-node-rewrite' as const,
        equivalent: isWholeNodeRewrite,
        accepted: false,
      }),
      Object.freeze({
        kind: 'attachment-resurrection' as const,
        equivalent: lateReplace.accepted === true,
        accepted: false,
      }),
    ]),
  })
}

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

  // regex-dom mutant: re-derive label/destination from the raw text with a
  // naive regex and re-read the href from the normalized DOM anchor. The
  // regex captures through the title boundary and the DOM normalizes the
  // href bytes, so neither reproduces the projection ranges.
  const titledSource = '[Docs](https://safe.test "Title")'
  const titledProjection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(titledSource),
    identity,
  )
  const titledNode = titledProjection.nodes.find(
    (candidate) => candidate.kind === 'link',
  )
  if (!titledNode) {
    throw new Error('Link destination mutation fixture is unavailable.')
  }
  const titledAuthority = parseMarkdownLinkNode(titledSource, titledNode)
  const regexMatch = /\[([^\]]*)\]\(([^)]*)\)/.exec(titledSource)
  const regexLabel = regexMatch?.[1] ?? null
  const regexUrl = regexMatch?.[2] ?? null
  const domHref = new URL(authority.url ?? '', 'https://surface.test').href

  // hover-only mutant: a pointer-only surface locates the source node by
  // searching for the hovered label text, which selects the wrong duplicate.
  const duplicateSource = '[Docs](https://one.test) then [Docs](https://two.test)'
  const duplicateProjection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(duplicateSource),
    identity,
  )
  const duplicateNodes = duplicateProjection.nodes.filter(
    (candidate) => candidate.kind === 'link',
  )
  const secondNode = duplicateNodes[1]
  if (!secondNode) {
    throw new Error('Duplicate link mutation fixture is unavailable.')
  }
  const hoveredAuthority = parseMarkdownLinkNode(duplicateSource, secondNode)
  const textSearchStart = duplicateSource.indexOf(hoveredAuthority.labelText)

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

  const deletedNodeStatus = deletedProjection.resolve(authority.nodeId).status

  return Object.freeze({
    authority,
    evidence: Object.freeze({
      regexDom: Object.freeze({
        authorityLabelText: titledAuthority.labelText,
        authorityUrl: titledAuthority.url,
        authorityTitle: titledAuthority.title,
        mutantRegexLabel: regexLabel,
        mutantRegexUrl: regexUrl,
        mutantDomHref: domHref,
      }),
      wholeNodeRewrite: Object.freeze({
        editChangeCount: propertyEdit.changes.length,
        editFrom: propertyEdit.changes[0]!.from,
        authorityFullStart: authority.ranges.full.start,
        authorityFullEnd: authority.ranges.full.end,
      }),
      hoverOnly: Object.freeze({
        hoveredLabelText: hoveredAuthority.labelText,
        authorityNodeStart: hoveredAuthority.ranges.full.start,
        mutantTextSearchStart: textSearchStart,
      }),
      unsafeUrl: Object.freeze({
        dangerousState: unsafe.state,
        dangerousOpenAllowed: unsafe.open.allowed,
      }),
      staleNodeCommit: Object.freeze({
        resolvedNodeStatus: deletedNodeStatus,
      }),
      staleProperty: Object.freeze({
        plannedExpectedRevision: propertyEdit.expectedRevision,
      }),
    }),
    mutations: Object.freeze([
      Object.freeze({
        kind: 'regex-dom' as const,
        equivalent:
          regexLabel === titledAuthority.labelText &&
          regexUrl === titledAuthority.url &&
          domHref === authority.url,
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
        equivalent: textSearchStart === hoveredAuthority.ranges.full.start,
        accepted: false,
      }),
      Object.freeze({
        kind: 'unsafe-url' as const,
        equivalent: unsafe.open.allowed,
        accepted: false,
      }),
      Object.freeze({
        kind: 'stale-node-commit' as const,
        equivalent: deletedNodeStatus === 'current',
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
