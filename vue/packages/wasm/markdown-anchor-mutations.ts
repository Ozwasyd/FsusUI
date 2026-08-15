import {
  createMarkdownAnchorMap,
  type MarkdownAnchorMap,
  type MarkdownAnchorSyntaxInput,
} from './markdown-anchor-map'
import type { MarkdownDocumentIdentity } from './markdown-syntax-identity'

export type MarkdownAnchorMutationKind =
  | 'html-offset'
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

const isRtl = (value: string) => /[\u0590-\u08FF]/.test(value)

const visibleHtml = (source: string) =>
  source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*/g, '')

const reverseRtlRuns = (source: string) =>
  source.replace(/[\u0590-\u08FF]+/g, (run) => [...run].reverse().join(''))

export const evaluateMarkdownAnchorMutations = (input: {
  readonly source: string
  readonly identity: string | MarkdownDocumentIdentity
  readonly syntax?: readonly MarkdownAnchorSyntaxInput[]
}): MarkdownAnchorMutationReport => {
  const authority = createMarkdownAnchorMap({
    identity: input.identity,
    source: input.source,
    syntax: input.syntax ?? [
      { id: 'doc', range: [0, input.source.length] },
    ],
  })
  const selection = {
    anchor: 0,
    focus: Math.min(input.source.length, Math.max(1, input.source.length - 1)),
  }
  const authoritative = authority.sourceSelectionToVisual(selection)
  const authoritativeBack = authority.visualAnchorToSourceSelection(authoritative)

  const html = visibleHtml(input.source)
  const htmlFocus = Math.min(selection.focus, html.length)
  const htmlEquivalent =
    html === input.source && htmlFocus === authoritativeBack.focus

  const visualOrder = reverseRtlRuns(input.source)
  const visualEquivalent =
    !isRtl(input.source) && visualOrder === input.source
      ? authoritativeBack.focus === selection.focus
      : visualOrder.indexOf(input.source.slice(0, 1)) === selection.anchor &&
        visualOrder === input.source

  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'html-offset' as const,
        equivalent: htmlEquivalent,
        accepted: htmlEquivalent,
        detail: 'stripped HTML offsets are not source anchors',
      }),
      Object.freeze({
        kind: 'bidi-visual-order' as const,
        equivalent: visualEquivalent,
        accepted: visualEquivalent,
        detail: 'bidi display order is not a source offset',
      }),
    ]),
  })
}
