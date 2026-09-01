import {
  parseMarkdownEmbedLine,
  resolveMarkdownEmbedPresentation,
  type MarkdownEmbedPresentation,
  type MarkdownEmbedPresentationMode,
  type MarkdownEmbedResult,
  type MarkdownStableSyntaxNode,
} from '../../../wasm/markdown-runtime'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import {
  resolveMarkdownAtomicNodeIntent,
  type MarkdownAtomicNodeAction,
  type MarkdownAtomicNodePlan,
} from './markdown-editor-live-selection'
import {
  resolveMarkdownLiveLayoutStability,
  type MarkdownLiveLayoutPlan,
} from './markdown-editor-live-layout'
import type {
  MarkdownEditorSelection,
} from './markdown-editor-transaction'

const toPresentationMode = (mode: MarkdownEditorMode): MarkdownEmbedPresentationMode =>
  mode

/**
 * Embed interaction reuses the shared #335 atomic primitive; no per-kind
 * caret, delete, or copy path is implemented here.
 */
export const resolveMarkdownEmbedAtomic = (input: {
  readonly action: MarkdownAtomicNodeAction
  readonly composing?: boolean
  readonly currentIdentity?: Parameters<typeof resolveMarkdownAtomicNodeIntent>[0]['currentIdentity']
  readonly documentIdentity?: Parameters<typeof resolveMarkdownAtomicNodeIntent>[0]['documentIdentity']
  readonly expectedRevision?: number
  readonly mode?: MarkdownEditorMode
  readonly nodeId?: string
  readonly pending?: boolean
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
}): MarkdownAtomicNodePlan =>
  resolveMarkdownAtomicNodeIntent({
    ...input,
    kind: 'embed',
  })

/**
 * Pending/result height changes reuse the shared #336 source-anchored
 * stability mechanism with the embed-result trigger.
 */
export const resolveMarkdownEmbedHeight = (input: {
  readonly composing?: boolean
  readonly currentIdentity?: Parameters<typeof resolveMarkdownLiveLayoutStability>[0]['currentIdentity']
  readonly documentIdentity?: Parameters<typeof resolveMarkdownLiveLayoutStability>[0]['documentIdentity']
  readonly expectedRevision?: number
  readonly gesture?: Parameters<typeof resolveMarkdownLiveLayoutStability>[0]['gesture']
  readonly previousAnchor?: Parameters<typeof resolveMarkdownLiveLayoutStability>[0]['previousAnchor']
  readonly reducedMotion?: boolean
  readonly revision?: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
}): MarkdownLiveLayoutPlan =>
  resolveMarkdownLiveLayoutStability({
    ...input,
    trigger: 'embed-result',
  })

export interface MarkdownEmbedSurface {
  readonly contentVisible: boolean
  readonly directiveVisible: boolean
  readonly presentation: MarkdownEmbedPresentation
}

export const resolveMarkdownEmbedSurface = (input: {
  readonly mode: MarkdownEditorMode
  readonly node: MarkdownStableSyntaxNode
  readonly result?: MarkdownEmbedResult | null
  readonly source: string
}): MarkdownEmbedSurface => {
  const mode = toPresentationMode(input.mode)
  const raw = input.source
    .slice(input.node.rawRange.start, input.node.rawRange.end)
    .replace(/\r?\n$/, '')
  const parsed = parseMarkdownEmbedLine(raw, input.node.rawRange.start)
  const presentation = parsed && parsed.ok
    ? resolveMarkdownEmbedPresentation(
        { kind: 'valid', node: parsed, result: input.result },
        mode,
      )
    : resolveMarkdownEmbedPresentation(
        {
          kind: 'local-failure',
          failure: 'invalid-directive',
          target: '',
          embedMode: 'block',
          directive: raw,
        },
        mode,
      )
  return Object.freeze({
    contentVisible: mode !== 'source' && presentation.state !== 'unsupported',
    directiveVisible: mode === 'source' || presentation.state === 'unsupported',
    presentation,
  })
}

export interface MarkdownEmbedSurfacePlan {
  readonly height: MarkdownLiveLayoutPlan
  readonly surface: MarkdownEmbedSurface
}

export const planMarkdownEmbedSurface = (input: {
  readonly documentIdentity: Parameters<typeof resolveMarkdownLiveLayoutStability>[0]['documentIdentity']
  readonly mode: MarkdownEditorMode
  readonly node: MarkdownStableSyntaxNode
  readonly reducedMotion?: boolean
  readonly result?: MarkdownEmbedResult | null
  readonly revision: number
  readonly selection: MarkdownEditorSelection
  readonly source: string
}): MarkdownEmbedSurfacePlan =>
  Object.freeze({
    height: resolveMarkdownEmbedHeight({
      documentIdentity: input.documentIdentity,
      revision: input.revision,
      selection: input.selection,
      source: input.source,
    }),
    surface: resolveMarkdownEmbedSurface({
      mode: input.mode,
      node: input.node,
      result: input.result,
      source: input.source,
    }),
  })
