import {
  createMarkdownAnchorMap,
  type MarkdownAnchorMap,
  type MarkdownAnchorSyntaxInput,
} from './markdown-anchor-map'
import type { MarkdownDocumentIdentity } from './markdown-syntax-identity'

export type MarkdownAnchorMutationKind =
  | 'bare-offset'
  | 'dom-path'
  | 'html-offset'
  | 'nearby-reveal'
  | 'bidi-visual-order'

export interface MarkdownAnchorMutationResult {
  readonly kind: MarkdownAnchorMutationKind
  readonly equivalent: boolean
  readonly accepted: boolean
  readonly detail: string
}

export interface MarkdownAnchorMutationReport {
  readonly authority: MarkdownAnchorMap
  readonly mutations: readonly MarkdownAnchorMutationResult[]
}

const evaluateReverseMutation = (
  authority: MarkdownAnchorMap,
  selection: ReturnType<MarkdownAnchorMap['sourceSelectionToVisual']>,
) => {
  try {
    const reversed = authority.visualAnchorToSourceSelection(selection)
    return Object.freeze({
      accepted: true,
      equivalent:
        reversed.anchor === selection.anchor.sourceOffset &&
        reversed.focus === selection.focus.sourceOffset,
    })
  } catch {
    return Object.freeze({ accepted: false, equivalent: false })
  }
}

export const evaluateMarkdownAnchorMutations = (input: {
  readonly source: string
  readonly identity: string | MarkdownDocumentIdentity
  readonly syntax?: readonly MarkdownAnchorSyntaxInput[]
}): MarkdownAnchorMutationReport => {
  const authority = createMarkdownAnchorMap({
    identity: input.identity,
    source: input.source,
    syntax: input.syntax ?? [{ id: 'doc', range: [0, input.source.length] }],
  })
  const selection = {
    anchor: 0,
    focus: Math.min(input.source.length, Math.max(1, input.source.length - 1)),
  }
  const authoritative = authority.sourceSelectionToVisual(selection)
  const wrongOffset =
    authoritative.focus.sourceOffset === 0 && input.source.length > 0 ? 1 : 0
  const mutateFocus = (
    patch: Partial<(typeof authoritative)['focus']>,
  ): typeof authoritative =>
    Object.freeze({
      ...authoritative,
      focus: Object.freeze({ ...authoritative.focus, ...patch }),
    })
  const bareOffset = evaluateReverseMutation(
    authority,
    mutateFocus({
      anchorId: 'missing-anchor',
      kind: 'text',
      localOffset: undefined,
      point: undefined,
    }),
  )
  const domPath = evaluateReverseMutation(
    authority,
    mutateFocus({ anchorId: 'dom:0/1' }),
  )
  const htmlOffset = evaluateReverseMutation(
    authority,
    mutateFocus({ sourceOffset: wrongOffset }),
  )
  const bidiVisualOrder = evaluateReverseMutation(
    authority,
    mutateFocus({ sourceOffset: wrongOffset }),
  )
  const nearbyAuthority = createMarkdownAnchorMap({
    identity: input.identity,
    source: 'same same',
    syntax: [
      { id: 'left-same', range: [0, 4] },
      { id: 'right-same', range: [5, 9] },
    ],
  })
  const exactReveal = nearbyAuthority.sourceRangeToReveal({
    start: 5,
    end: 9,
  })
  const nearbyReveal = Object.freeze({
    accepted: exactReveal.reveal.anchorId === 'left-same',
    equivalent: false,
  })

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'bare-offset' as const,
        ...bareOffset,
        detail: 'a naked source offset is not a current visual anchor',
      }),
      Object.freeze({
        kind: 'dom-path' as const,
        ...domPath,
        detail: 'a DOM path is not a projection anchor identity',
      }),
      Object.freeze({
        kind: 'html-offset' as const,
        ...htmlOffset,
        detail: 'stripped HTML offsets are not source anchors',
      }),
      Object.freeze({
        kind: 'bidi-visual-order' as const,
        ...bidiVisualOrder,
        detail: 'bidi display order is not a source offset',
      }),
      Object.freeze({
        kind: 'nearby-reveal' as const,
        ...nearbyReveal,
        detail: 'a nearby visual node is not an exact reveal target',
      }),
    ]),
  })
}
