import {
  MARKDOWN_ANCHOR_ID,
  collectMarkdownAnchorNodes,
  type MarkdownAnchorValidNode,
} from '../../../wasm/markdown-anchor-grammar'
import {
  createMarkdownAnchorMap,
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownAnchorMap,
  type MarkdownStableProjection,
} from '../../../wasm/markdown-runtime'
import type { MarkdownEditorTransaction } from './markdown-editor-transaction'

export interface MarkdownProjectedAnchor extends MarkdownAnchorValidNode {
  readonly projectionId: string
}

const projectionForAnchors = (
  source: string,
  projection?: MarkdownStableProjection,
) =>
  projection ??
  stabilizeMarkdownEditorProjection(createMarkdownEditorProjection(source), {
    id: 'anchor-command',
    epoch: 0,
  })

export const currentMarkdownAnchors = (
  source: string,
  projection?: MarkdownStableProjection,
): readonly MarkdownProjectedAnchor[] => {
  const stable = projectionForAnchors(source, projection)
  return collectMarkdownAnchorNodes(source)
    .filter((node): node is MarkdownAnchorValidNode => node.ok)
    .flatMap((node) => {
      const projected = stable.nodes.find(
        (candidate) =>
          candidate.kind === 'anchor' &&
          candidate.status === 'valid' &&
          candidate.rawRange.start === node.ranges.full.start &&
          candidate.rawRange.end === node.ranges.full.end,
      )
      return projected
        ? [Object.freeze({ ...node, projectionId: projected.id })]
        : []
    })
}

export const planMarkdownAnchorInsert = (
  source: string,
  offset: number,
  id: string,
  options?: {
    placement?: 'line-end' | 'following-line'
    projection?: MarkdownStableProjection
  },
): MarkdownEditorTransaction => {
  if (!MARKDOWN_ANCHOR_ID.test(id)) {
    throw new Error(
      `Invalid anchor id "${id}": must match [a-z][a-z0-9-]{0,63}`,
    )
  }

  const stable = projectionForAnchors(source, options?.projection)
  const existing = currentMarkdownAnchors(source, stable)
  if (existing.some((node) => node.id === id)) {
    throw new Error(`Duplicate anchor id "${id}" is not permitted`)
  }

  const newline = source.includes('\r\n') ? '\r\n' : '\n'
  const isFollowingLine = options?.placement === 'following-line'
  const insertText = isFollowingLine ? `${newline}^${id}` : ` ^${id}`
  // A paragraph's full range includes its terminal newline. Keep line-end
  // markers at the canonical raw content endpoint, before those source bytes.
  const insertionOffset = isFollowingLine
    ? offset
    : stable.nodes.find(
        (node) =>
          node.kind === 'paragraph' &&
          node.status === 'valid' &&
          node.rawRange.end === offset,
      )?.rawContentRanges.at(-1)?.end ?? offset

  return {
    changes: [{ from: insertionOffset, to: insertionOffset, insert: insertText }],
    history: 'separate',
    origin: 'command',
  }
}

export const planMarkdownAnchorEdit = (
  source: string,
  node: MarkdownProjectedAnchor,
  newId: string,
  projection?: MarkdownStableProjection,
): MarkdownEditorTransaction => {
  if (!MARKDOWN_ANCHOR_ID.test(newId)) {
    throw new Error(
      `Invalid anchor id "${newId}": must match [a-z][a-z0-9-]{0,63}`,
    )
  }

  const stable = projectionForAnchors(source, projection)
  if (stable.resolve(node.projectionId).status !== 'current') {
    throw new Error(`Anchor "${node.id}" is stale or deleted.`)
  }
  const existing = currentMarkdownAnchors(source, stable)
  if (
    existing.some(
      (existingNode) =>
        existingNode.id === newId &&
        existingNode.ranges.full.start !== node.ranges.full.start,
    )
  ) {
    throw new Error(`Duplicate anchor id "${newId}" is not permitted`)
  }

  return {
    changes: [
      {
        from: node.ranges.id.start,
        to: node.ranges.id.end,
        insert: newId,
      },
    ],
    history: 'separate',
    origin: 'command',
  }
}

export const planMarkdownAnchorRemove = (
  node: MarkdownProjectedAnchor,
  source?: string,
  projection?: MarkdownStableProjection,
): MarkdownEditorTransaction => {
  if (
    source &&
    projectionForAnchors(source, projection).resolve(node.projectionId)
      .status !== 'current'
  ) {
    throw new Error(`Anchor "${node.id}" is stale or deleted.`)
  }
  let from = node.ranges.full.start
  const to = node.ranges.full.end

  if (
    source &&
    from > 0 &&
    source[from - 1] === ' ' &&
    node.placement === 'line-end'
  ) {
    from -= 1
  }

  return {
    changes: [{ from, to, insert: '' }],
    history: 'separate',
    origin: 'command',
  }
}

export const planMarkdownAnchorCopy = (
  node: MarkdownProjectedAnchor,
  mode: 'exact' | 'visible',
): string => {
  if (mode === 'exact') {
    return `^${node.id}`
  }
  return ''
}

export const planMarkdownBlockMove = (
  source: string,
  blockRange: { start: number; end: number },
  targetOffset: number,
  anchorMap?: MarkdownAnchorMap,
): MarkdownEditorTransaction => {
  anchorMap?.sourceRangeToReveal(blockRange)
  const blockText = source.slice(blockRange.start, blockRange.end)
  if (targetOffset >= blockRange.start && targetOffset <= blockRange.end) {
    return { changes: [], history: 'separate', origin: 'command' }
  }

  if (targetOffset < blockRange.start) {
    return {
      changes: [
        { from: blockRange.start, to: blockRange.end, insert: '' },
        { from: targetOffset, to: targetOffset, insert: blockText },
      ],
      history: 'separate',
      origin: 'command',
    }
  }

  return {
    changes: [
      { from: targetOffset, to: targetOffset, insert: blockText },
      { from: blockRange.start, to: blockRange.end, insert: '' },
    ],
    history: 'separate',
    origin: 'command',
  }
}

export const planMarkdownBlockSplit = (
  source: string,
  offset: number,
  _anchor?: MarkdownProjectedAnchor,
  anchorMap?: MarkdownAnchorMap,
): MarkdownEditorTransaction => {
  anchorMap?.sourcePositionToVisual({ offset, affinity: 'after' })
  const newline = source.includes('\r\n') ? '\r\n\r\n' : '\n\n'
  return {
    changes: [{ from: offset, to: offset, insert: newline }],
    history: 'separate',
    origin: 'command',
  }
}

export const planMarkdownBlockMerge = (
  source: string,
  firstBlock: { start: number; end: number; anchor?: MarkdownProjectedAnchor },
  secondBlock: { start: number; end: number; anchor?: MarkdownProjectedAnchor },
  resolution?: 'keep-first' | 'keep-second' | 'reject',
  anchorMap?: MarkdownAnchorMap,
): MarkdownEditorTransaction => {
  anchorMap?.sourceRangeToReveal({
    start: Math.min(firstBlock.start, secondBlock.start),
    end: Math.max(firstBlock.end, secondBlock.end),
  })
  if (firstBlock.anchor && secondBlock.anchor) {
    if (!resolution || resolution === 'reject') {
      throw new Error(
        'Cannot merge blocks with multiple anchors without explicit resolution.',
      )
    }
    const anchorToRemove =
      resolution === 'keep-first' ? secondBlock.anchor : firstBlock.anchor
    const removeTx = planMarkdownAnchorRemove(anchorToRemove, source)
    const betweenFrom = Math.min(firstBlock.end, secondBlock.start)
    const betweenTo = Math.max(firstBlock.end, secondBlock.start)
    return {
      changes: [
        ...removeTx.changes,
        { from: betweenFrom, to: betweenTo, insert: ' ' },
      ],
      history: 'separate',
      origin: 'command',
    }
  }

  const betweenFrom = Math.min(firstBlock.end, secondBlock.start)
  const betweenTo = Math.max(firstBlock.end, secondBlock.start)
  return {
    changes: [{ from: betweenFrom, to: betweenTo, insert: ' ' }],
    history: 'separate',
    origin: 'command',
  }
}

export type MarkdownAnchorTransactionMutationKind =
  | 'auto-id'
  | 'direct-splice'
  | 'split-duplicate'
  | 'merge-silent-drop'
  | 'sidecar-state'

export const evaluateMarkdownAnchorTransactionMutations = () => {
  const source = 'First ^first\n\nSecond ^second'
  const identity = Object.freeze({ id: 'anchor-mutation', epoch: 2 })
  const projection = stabilizeMarkdownEditorProjection(
    createMarkdownEditorProjection(source),
    identity,
  )
  const anchors = currentMarkdownAnchors(source, projection)
  const first = anchors.find((anchor) => anchor.id === 'first')
  const second = anchors.find((anchor) => anchor.id === 'second')
  if (!first || !second) {
    throw new Error('Anchor transaction mutation fixture is unavailable.')
  }
  const anchorMap = createMarkdownAnchorMap({
    identity,
    projection,
    source,
  })
  const explicitInsert = planMarkdownAnchorInsert(
    source,
    source.length,
    'third',
    { projection },
  )
  const split = planMarkdownBlockSplit(
    source,
    source.indexOf(' ^first'),
    first,
    anchorMap,
  )
  let mergeRejected = false
  try {
    planMarkdownBlockMerge(
      source,
      { start: 0, end: source.indexOf('\n\n'), anchor: first },
      {
        start: source.indexOf('Second'),
        end: source.length,
        anchor: second,
      },
      undefined,
      anchorMap,
    )
  } catch {
    mergeRejected = true
  }

  return Object.freeze({
    authority: Object.freeze({ anchors, explicitInsert, split }),
    mutations: Object.freeze([
      Object.freeze({
        kind: 'auto-id' as const,
        equivalent:
          explicitInsert.changes[0]?.insert.includes('third') !== true,
        accepted: false,
      }),
      Object.freeze({
        kind: 'direct-splice' as const,
        equivalent: explicitInsert.origin !== 'command',
        accepted: false,
      }),
      Object.freeze({
        kind: 'split-duplicate' as const,
        equivalent: split.changes.some((change) =>
          change.insert.includes('^first'),
        ),
        accepted: false,
      }),
      Object.freeze({
        kind: 'merge-silent-drop' as const,
        equivalent: !mergeRejected,
        accepted: false,
      }),
      Object.freeze({
        kind: 'sidecar-state' as const,
        equivalent: anchors.some(
          (anchor) =>
            projection.resolve(anchor.projectionId).status !== 'current',
        ),
        accepted: false,
      }),
    ]),
  })
}
