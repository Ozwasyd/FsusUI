import type {
  MarkdownEditorProjectionResult,
  MarkdownEditorSyntaxNode,
} from './markdown-editor-projection'

export interface MarkdownDocumentIdentity {
  readonly id: string
  readonly epoch: number
}

export interface MarkdownSyntaxIdentityChange {
  readonly from: number
  readonly to: number
  readonly insert: string
}

export interface MarkdownSyntaxIdentityState {
  readonly nextOrdinalByKind: Readonly<Record<string, number>>
}

export type MarkdownSyntaxIdentityStatus = 'current' | 'deleted' | 'invalid'

export interface MarkdownStableSyntaxNode extends MarkdownEditorSyntaxNode {
  readonly id: string
}

export interface MarkdownStableProjection {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly identityState: MarkdownSyntaxIdentityState
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

const kindFromIdentity = (id: string) => {
  const parts = id.split(':')
  return parts[parts.length - 2]
}

const identityStateFrom = (
  previous: MarkdownStableProjection | undefined,
): Map<string, number> => {
  const nextOrdinalByKind = new Map<string, number>()
  for (const [kind, ordinal] of Object.entries(
    previous?.identityState?.nextOrdinalByKind ?? {},
  )) {
    if (Number.isInteger(ordinal) && ordinal >= 0) {
      nextOrdinalByKind.set(kind, ordinal)
    }
  }
  for (const node of previous?.nodes ?? []) {
    const kind = kindFromIdentity(node.id)
    const ordinal = ordinalFromIdentity(node.id)
    if (!kind || !Number.isInteger(ordinal) || ordinal < 0) continue
    nextOrdinalByKind.set(
      kind,
      Math.max(nextOrdinalByKind.get(kind) ?? 0, ordinal + 1),
    )
  }
  return nextOrdinalByKind
}

const freezeIdentityState = (
  nextOrdinalByKind: ReadonlyMap<string, number>,
): MarkdownSyntaxIdentityState =>
  Object.freeze({
    nextOrdinalByKind: Object.freeze(Object.fromEntries(nextOrdinalByKind)),
  })

const sliceOf = (source: string, node: MarkdownEditorSyntaxNode) =>
  source.slice(node.normalizedRange.start, node.normalizedRange.end)

const alignEqualSequences = (
  previous: readonly string[],
  next: readonly string[],
) => {
  const previousCount = previous.length
  const nextCount = next.length
  const table: number[][] = Array.from({ length: previousCount + 1 }, () =>
    Array.from({ length: nextCount + 1 }, () => 0),
  )
  for (
    let previousIndex = previousCount - 1;
    previousIndex >= 0;
    previousIndex -= 1
  ) {
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

  const fence = /^```[^\n]*\n([\s\S]*?)\n```$/.exec(trimmedEnd)
  if (fence) return fence[1] ?? ''
  const fenceLoose = /^```[^\n]*\n([\s\S]*?)```$/.exec(trimmedEnd)
  if (fenceLoose) return (fenceLoose[1] ?? '').replace(/\n$/, '')

  if (
    lines.length > 0 &&
    lines.every((line) => line === '' || /^\|/.test(line)) &&
    lines.some((line) => /^\|/.test(line))
  ) {
    const cells = lines
      .filter((line) => /^\|/.test(line) && !/^\|[\s:|-]+\|$/.test(line.trim()))
      .flatMap((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim()),
      )
      .filter((cell) => cell.length > 0)
    const joined = cells.join('\n')
    if (joined && joined !== trimmedEnd) return joined
  }

  const onlyLine = lines.length === 1 ? lines[0]! : undefined
  if (onlyLine) {
    const withoutTask = onlyLine.replace(/^(?:[-*+]|\d+[.)]) \[[ xX]\] /, '')
    if (withoutTask !== onlyLine) return withoutTask
    const withoutList = onlyLine.replace(/^(?:[-*+]|\d+[.)]) /, '')
    if (withoutList !== onlyLine) return withoutList
    const withoutHeading = onlyLine.replace(/^#{1,6} /, '')
    if (withoutHeading !== onlyLine) return withoutHeading
    const withoutFootnote = onlyLine.replace(/^\[\^[^\]]+\]:\s?/, '')
    if (withoutFootnote !== onlyLine) return withoutFootnote
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

const remapUnchangedRange = (
  range: MarkdownEditorSyntaxNode['rawRange'],
  change: MarkdownSyntaxIdentityChange,
) => {
  if (range.end <= change.from) return range
  if (range.start >= change.to) {
    const delta = change.insert.length - (change.to - change.from)
    return Object.freeze({
      start: range.start + delta,
      end: range.end + delta,
    })
  }
  return undefined
}

const assignIdentities = (
  projection: MarkdownEditorProjectionResult,
  documentIdentity: MarkdownDocumentIdentity,
  previous: MarkdownStableProjection | undefined,
  change: MarkdownSyntaxIdentityChange | undefined,
) => {
  const nextOrdinalByKind = sameDocument(
    previous?.documentIdentity ?? documentIdentity,
    documentIdentity,
  )
    ? identityStateFrom(previous)
    : new Map<string, number>()
  const allocate = (kind: string) => {
    const ordinal = nextOrdinalByKind.get(kind) ?? 0
    nextOrdinalByKind.set(kind, ordinal + 1)
    return identityFor(documentIdentity, kind, ordinal)
  }

  if (!previous || !sameDocument(previous.documentIdentity, documentIdentity)) {
    return {
      identities: projection.nodes.map((node) => allocate(node.kind)),
      identityState: freezeIdentityState(nextOrdinalByKind),
    }
  }

  const nextSource = projection.identity.normalizedSource
  const previousSource = previous.normalizedSource
  const assigned: Array<string | undefined> = projection.nodes.map(
    () => undefined,
  )
  const usedPrevious = new Set<number>()

  const claim = (nextIndex: number, previousIndex: number) => {
    const previousNode = previous.nodes[previousIndex]
    if (!previousNode || usedPrevious.has(previousIndex)) return
    if (assigned[nextIndex] !== undefined) return
    assigned[nextIndex] = previousNode.id
    usedPrevious.add(previousIndex)
  }

  const leftoverPreviousIndexes = () =>
    previous.nodes
      .map((_, index) => index)
      .filter((index) => !usedPrevious.has(index))
  const leftoverNextIndexes = () =>
    projection.nodes
      .map((_, index) => index)
      .filter((index) => assigned[index] === undefined)

  if (change) {
    previous.nodes.forEach((previousNode, previousIndex) => {
      const mapped = remapUnchangedRange(previousNode.rawRange, change)
      if (!mapped) return
      const nextIndex = projection.nodes.findIndex(
        (nextNode, index) =>
          assigned[index] === undefined &&
          nextNode.kind === previousNode.kind &&
          nextNode.rawRange.start === mapped.start &&
          nextNode.rawRange.end === mapped.end,
      )
      if (nextIndex >= 0) claim(nextIndex, previousIndex)
    })
  }

  const kindTextKey = (kind: string, text: string) => `${kind}\0${text}`
  const previousKindTextCount = new Map<string, number>()
  const nextKindTextCount = new Map<string, number>()
  for (const node of previous.nodes) {
    const key = kindTextKey(node.kind, sliceOf(previousSource, node))
    previousKindTextCount.set(key, (previousKindTextCount.get(key) ?? 0) + 1)
  }
  for (const node of projection.nodes) {
    const key = kindTextKey(node.kind, sliceOf(nextSource, node))
    nextKindTextCount.set(key, (nextKindTextCount.get(key) ?? 0) + 1)
  }
  const surplusKindText = new Map<string, number>()
  for (const [key, count] of previousKindTextCount) {
    const extra = count - (nextKindTextCount.get(key) ?? 0)
    if (extra > 0) surplusKindText.set(key, extra)
  }

  const consumeSurplus = (previousIndex: number) => {
    const node = previous.nodes[previousIndex]
    if (!node) return
    const key = kindTextKey(node.kind, sliceOf(previousSource, node))
    const remaining = surplusKindText.get(key) ?? 0
    if (remaining > 0) surplusKindText.set(key, remaining - 1)
  }

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
      const previousKey = kindTextKey(
        previousNode.kind,
        sliceOf(previousSource, previousNode),
      )
      if ((surplusKindText.get(previousKey) ?? 0) <= 0) continue
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
    if (best !== undefined) {
      consumeSurplus(best)
      claim(nextIndex, best)
    }
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
      sliceOf(
        previousSource,
        previous.nodes[index] as MarkdownEditorSyntaxNode,
      ),
    )
    const nextTexts = nextIndexes.map((index) =>
      sliceOf(nextSource, projection.nodes[index] as MarkdownEditorSyntaxNode),
    )

    const aligned = alignEqualSequences(previousTexts, nextTexts)
    aligned.forEach((previousLocal, nextLocal) => {
      if (previousLocal === undefined) return
      claim(
        nextIndexes[nextLocal] as number,
        previousIndexes[previousLocal] as number,
      )
    })

    const leftoverPrevious = previousIndexes.filter(
      (index) => !usedPrevious.has(index),
    )
    const leftoverNext = nextIndexes.filter(
      (index) => assigned[index] === undefined,
    )

    for (const nextIndex of leftoverNext) {
      if (assigned[nextIndex] !== undefined) continue
      const nextText = sliceOf(
        nextSource,
        projection.nodes[nextIndex] as MarkdownEditorSyntaxNode,
      )
      const moved = leftoverPrevious.find(
        (previousIndex) =>
          !usedPrevious.has(previousIndex) &&
          sliceOf(
            previousSource,
            previous.nodes[previousIndex] as MarkdownEditorSyntaxNode,
          ) === nextText,
      )
      if (moved !== undefined) claim(nextIndex, moved)
    }

    for (const nextIndex of leftoverNext) {
      if (assigned[nextIndex] !== undefined) continue
      const nextText = sliceOf(
        nextSource,
        projection.nodes[nextIndex] as MarkdownEditorSyntaxNode,
      )
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
      const nextText = sliceOf(
        nextSource,
        projection.nodes[nextIndex] as MarkdownEditorSyntaxNode,
      )
      let mergedLeft: number | undefined
      for (let index = 0; index < leftoverPrevious.length - 1; index += 1) {
        const left = leftoverPrevious[index] as number
        const right = leftoverPrevious[index + 1] as number
        if (usedPrevious.has(left) || usedPrevious.has(right)) continue
        if (
          canMergeSlices(
            sliceOf(
              previousSource,
              previous.nodes[left] as MarkdownEditorSyntaxNode,
            ),
            sliceOf(
              previousSource,
              previous.nodes[right] as MarkdownEditorSyntaxNode,
            ),
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

  const identities = projection.nodes.map((node, index) => {
    const existing = assigned[index]
    if (existing) return existing
    return allocate(node.kind)
  })
  return {
    identities,
    identityState: freezeIdentityState(nextOrdinalByKind),
  }
}

export const stabilizeMarkdownEditorProjection = (
  projection: MarkdownEditorProjectionResult,
  documentIdentity: MarkdownDocumentIdentity,
  previous?: MarkdownStableProjection,
  change?: MarkdownSyntaxIdentityChange,
): MarkdownStableProjection => {
  if (!documentIdentity.id) {
    throw new Error('stable syntax identity requires a document id')
  }
  if (!Number.isInteger(documentIdentity.epoch)) {
    throw new Error('stable syntax identity requires a document epoch')
  }

  const { identities, identityState } = assignIdentities(
    projection,
    documentIdentity,
    previous,
    change,
  )
  const nodes = projection.nodes.map((node, index) =>
    Object.freeze({
      ...node,
      id: identities[index] as string,
    }),
  )

  const byId = new Map(nodes.map((node) => [node.id, node]))

  return Object.freeze({
    documentIdentity: Object.freeze({
      id: documentIdentity.id,
      epoch: documentIdentity.epoch,
    }),
    identityState,
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
