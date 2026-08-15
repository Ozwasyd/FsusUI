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
  readonly normalizedSource: string
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

const sameDocument = (
  left: MarkdownDocumentIdentity,
  right: MarkdownDocumentIdentity,
) => left.id === right.id && left.epoch === right.epoch

const ordinalFromIdentity = (id: string) => {
  const parts = id.split(':')
  return Number(parts[parts.length - 1])
}

const sliceOf = (source: string, node: MarkdownEditorSyntaxNode) =>
  source.slice(node.normalizedRange.start, node.normalizedRange.end)

const alignEqualSequences = (previous: readonly string[], next: readonly string[]) => {
  const previousCount = previous.length
  const nextCount = next.length
  const table: number[][] = Array.from({ length: previousCount + 1 }, () =>
    Array.from({ length: nextCount + 1 }, () => 0),
  )
  for (let previousIndex = previousCount - 1; previousIndex >= 0; previousIndex -= 1) {
    for (let nextIndex = nextCount - 1; nextIndex >= 0; nextIndex -= 1) {
      table[previousIndex]![nextIndex] =
        previous[previousIndex] === next[nextIndex]
          ? (table[previousIndex + 1]![nextIndex + 1] as number) + 1
          : Math.max(
              table[previousIndex + 1]![nextIndex] as number,
              table[previousIndex]![nextIndex + 1] as number,
            )
    }
  }

  const nextToPrevious: Array<number | undefined> = Array.from(
    { length: nextCount },
    () => undefined,
  )
  let previousIndex = 0
  let nextIndex = 0
  while (previousIndex < previousCount && nextIndex < nextCount) {
    if (
      previous[previousIndex] === next[nextIndex] &&
      table[previousIndex]![nextIndex] ===
        (table[previousIndex + 1]![nextIndex + 1] as number) + 1
    ) {
      nextToPrevious[nextIndex] = previousIndex
      previousIndex += 1
      nextIndex += 1
    } else if (
      (table[previousIndex + 1]![nextIndex] as number) >=
      (table[previousIndex]![nextIndex + 1] as number)
    ) {
      previousIndex += 1
    } else {
      nextIndex += 1
    }
  }
  return nextToPrevious
}

const canMergeSlices = (left: string, right: string, merged: string) =>
  merged === `${left}${right}` ||
  merged === `${left.replace(/\n$/, '')}${right}` ||
  merged === `${left.replace(/\n$/, '')} ${right}` ||
  merged === `${left}\n${right}`

const unwrapOnce = (text: string) => {
  const trimmedEnd = text.replace(/\n+$/g, '')
  const lines = trimmedEnd.split('\n')
  if (
    lines.length > 0 &&
    lines.every((line) => line === '' || /^> ?/.test(line)) &&
    lines.some((line) => line.startsWith('>'))
  ) {
    return lines.map((line) => line.replace(/^> ?/, '')).join('\n')
  }

  const onlyLine = lines.length === 1 ? lines[0]! : undefined
  if (onlyLine) {
    const withoutList = onlyLine.replace(/^(?:[-*+]|\d+[.)]) /, '')
    if (withoutList !== onlyLine) return withoutList
    const withoutTask = onlyLine.replace(/^(?:[-*+]|\d+[.)]) \[[ xX]\] /, '')
    if (withoutTask !== onlyLine) return withoutTask
    const withoutHeading = onlyLine.replace(/^#{1,6} /, '')
    if (withoutHeading !== onlyLine) return withoutHeading
  }

  if (
    trimmedEnd.startsWith('::p\n') &&
    (trimmedEnd.endsWith('\n::') || trimmedEnd === '::p\n::')
  ) {
    return trimmedEnd.slice(4, trimmedEnd.endsWith('\n::') ? -3 : undefined)
  }

  return trimmedEnd
}

const payloadOf = (text: string) => {
  let current = text.replace(/\n+$/g, '')
  for (let step = 0; step < 8; step += 1) {
    const next = unwrapOnce(current)
    if (next === current) return current
    current = next
  }
  return current
}

const assignIdentities = (
  projection: MarkdownEditorProjectionResult,
  documentIdentity: MarkdownDocumentIdentity,
  previous: MarkdownStableProjection | undefined,
) => {
  if (!previous || !sameDocument(previous.documentIdentity, documentIdentity)) {
    const seen = new Map<string, number>()
    return projection.nodes.map((node) => {
      const ordinal = seen.get(node.kind) ?? 0
      seen.set(node.kind, ordinal + 1)
      return identityFor(documentIdentity, node.kind, ordinal)
    })
  }

  const nextSource = projection.identity.normalizedSource
  const previousSource = previous.normalizedSource
  const assigned: Array<string | undefined> = projection.nodes.map(() => undefined)
  const usedPrevious = new Set<number>()
  const usedOrdinals = new Map<string, Set<number>>()

  const claim = (nextIndex: number, previousIndex: number) => {
    const previousNode = previous.nodes[previousIndex]
    if (!previousNode || usedPrevious.has(previousIndex)) return
    if (assigned[nextIndex] !== undefined) return
    assigned[nextIndex] = previousNode.id
    usedPrevious.add(previousIndex)
    const ordinals = usedOrdinals.get(previousNode.kind) ?? new Set<number>()
    ordinals.add(ordinalFromIdentity(previousNode.id))
    usedOrdinals.set(previousNode.kind, ordinals)
  }

  const leftoverPreviousIndexes = () =>
    previous.nodes
      .map((_, index) => index)
      .filter((index) => !usedPrevious.has(index))
  const leftoverNextIndexes = () =>
    projection.nodes
      .map((_, index) => index)
      .filter((index) => assigned[index] === undefined)

  for (const nextIndex of leftoverNextIndexes()) {
    const nextNode = projection.nodes[nextIndex]
    if (!nextNode) continue
    const nextPayload = payloadOf(sliceOf(nextSource, nextNode))
    if (!nextPayload) continue

    let best: number | undefined
    let bestDistance = Number.POSITIVE_INFINITY
    for (const previousIndex of leftoverPreviousIndexes()) {
      const previousNode = previous.nodes[previousIndex]
      if (!previousNode || previousNode.kind === nextNode.kind) continue
      const previousPayload = payloadOf(sliceOf(previousSource, previousNode))
      if (previousPayload !== nextPayload) continue
      const distance = Math.abs(
        previousNode.normalizedRange.start - nextNode.normalizedRange.start,
      )
      if (distance < bestDistance) {
        bestDistance = distance
        best = previousIndex
      }
    }
    if (best !== undefined) claim(nextIndex, best)
  }

  const kinds = new Set([
    ...previous.nodes.map((node) => node.kind),
    ...projection.nodes.map((node) => node.kind),
  ])

  for (const kind of kinds) {
    const previousIndexes = previous.nodes
      .map((node, index) =>
        node.kind === kind && !usedPrevious.has(index) ? index : -1,
      )
      .filter((index) => index >= 0)
    const nextIndexes = projection.nodes
      .map((node, index) =>
        node.kind === kind && assigned[index] === undefined ? index : -1,
      )
      .filter((index) => index >= 0)
    const previousTexts = previousIndexes.map((index) =>
      sliceOf(previousSource, previous.nodes[index] as MarkdownEditorSyntaxNode),
    )
    const nextTexts = nextIndexes.map((index) =>
      sliceOf(nextSource, projection.nodes[index] as MarkdownEditorSyntaxNode),
    )

    const aligned = alignEqualSequences(previousTexts, nextTexts)
    aligned.forEach((previousLocal, nextLocal) => {
      if (previousLocal === undefined) return
      claim(nextIndexes[nextLocal] as number, previousIndexes[previousLocal] as number)
    })

    const leftoverPrevious = previousIndexes.filter((index) => !usedPrevious.has(index))
    const leftoverNext = nextIndexes.filter((index) => assigned[index] === undefined)

    for (const nextIndex of leftoverNext) {
      if (assigned[nextIndex] !== undefined) continue
      const nextText = sliceOf(nextSource, projection.nodes[nextIndex] as MarkdownEditorSyntaxNode)
      const moved = leftoverPrevious.find(
        (previousIndex) =>
          !usedPrevious.has(previousIndex) &&
          sliceOf(previousSource, previous.nodes[previousIndex] as MarkdownEditorSyntaxNode) ===
            nextText,
      )
      if (moved !== undefined) claim(nextIndex, moved)
    }

    for (const nextIndex of leftoverNext) {
      if (assigned[nextIndex] !== undefined) continue
      const nextText = sliceOf(nextSource, projection.nodes[nextIndex] as MarkdownEditorSyntaxNode)
      const split = leftoverPrevious.find((previousIndex) => {
        if (usedPrevious.has(previousIndex)) return false
        const previousText = sliceOf(
          previousSource,
          previous.nodes[previousIndex] as MarkdownEditorSyntaxNode,
        )
        return (
          previousText.startsWith(nextText) ||
          nextText.startsWith(previousText) ||
          previousText.startsWith(nextText.replace(/\n$/, '')) ||
          nextText.startsWith(previousText.replace(/\n$/, ''))
        )
      })
      if (split !== undefined) claim(nextIndex, split)
    }

    for (const nextIndex of leftoverNext) {
      if (assigned[nextIndex] !== undefined) continue
      const nextText = sliceOf(nextSource, projection.nodes[nextIndex] as MarkdownEditorSyntaxNode)
      let mergedLeft: number | undefined
      for (let index = 0; index < leftoverPrevious.length - 1; index += 1) {
        const left = leftoverPrevious[index] as number
        const right = leftoverPrevious[index + 1] as number
        if (usedPrevious.has(left) || usedPrevious.has(right)) continue
        if (
          canMergeSlices(
            sliceOf(previousSource, previous.nodes[left] as MarkdownEditorSyntaxNode),
            sliceOf(previousSource, previous.nodes[right] as MarkdownEditorSyntaxNode),
            nextText,
          )
        ) {
          mergedLeft = left
          usedPrevious.add(right)
          break
        }
      }
      if (mergedLeft !== undefined) claim(nextIndex, mergedLeft)
    }
  }

  return projection.nodes.map((node, index) => {
    const existing = assigned[index]
    if (existing) return existing
    const ordinals = usedOrdinals.get(node.kind) ?? new Set<number>()
    let ordinal = 0
    while (ordinals.has(ordinal)) ordinal += 1
    ordinals.add(ordinal)
    usedOrdinals.set(node.kind, ordinals)
    return identityFor(documentIdentity, node.kind, ordinal)
  })
}

export const stabilizeMarkdownEditorProjection = (
  projection: MarkdownEditorProjectionResult,
  documentIdentity: MarkdownDocumentIdentity,
  previous?: MarkdownStableProjection,
): MarkdownStableProjection => {
  if (!documentIdentity.id) {
    throw new Error('stable syntax identity requires a document id')
  }
  if (!Number.isInteger(documentIdentity.epoch)) {
    throw new Error('stable syntax identity requires a document epoch')
  }

  const identities = assignIdentities(projection, documentIdentity, previous)
  const nodes = projection.nodes.map((node, index) =>
    Object.freeze({
      ...node,
      id: identities[index] as string,
    }),
  )

  const byId = new Map(nodes.map((node) => [node.id, node]))

  return Object.freeze({
    documentIdentity,
    normalizedSource: projection.identity.normalizedSource,
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
