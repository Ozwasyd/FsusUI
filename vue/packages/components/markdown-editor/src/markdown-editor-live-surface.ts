import {
  createMarkdownEditorProjection,
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
} from '../../../wasm/markdown-runtime'

import {
  readMarkdownLiveCapability,
  resolveMarkdownLiveCapability,
  type MarkdownEditorMode,
  type MarkdownLiveCapabilityResult,
} from './markdown-editor-live-contract'

export const MARKDOWN_LIVE_SURFACE_OWNER = 'source-textarea' as const

export type MarkdownLiveSurfaceOwner = typeof MARKDOWN_LIVE_SURFACE_OWNER

export type MarkdownLiveDecorationRole = 'decoration' | 'source-fallback'

export interface MarkdownLiveDecoration {
  readonly editable: false
  readonly kind: string
  readonly nodeId: string
  readonly presentation: string
  readonly rawRange: Readonly<{ end: number; start: number }>
  readonly role: MarkdownLiveDecorationRole
}

export interface MarkdownLiveSurfacePlan {
  readonly capability: MarkdownLiveCapabilityResult
  readonly compositionHost: MarkdownLiveSurfaceOwner
  readonly decorations: readonly MarkdownLiveDecoration[]
  readonly fallbackMode: MarkdownEditorMode
  readonly identity: MarkdownDocumentIdentity
  readonly inputOwner: MarkdownLiveSurfaceOwner
  readonly inputVisible: boolean
  readonly keepSource: true
  readonly mode: MarkdownEditorMode
  readonly rendererVisible: boolean
  readonly revision: number
  readonly selectionOwner: MarkdownLiveSurfaceOwner
  readonly source: string
}

export type MarkdownLiveSurfaceMutationKind =
  | 'dual-selection-owner'
  | 'per-block-editor'
  | 'dom-serialization'
  | 'live-only-parser'

const SOURCE_ONLY_PRESENTATIONS = new Set([
  'source-only-with-reason',
  'unsupported-error',
])

const roleFor = (presentation: string): MarkdownLiveDecorationRole =>
  SOURCE_ONLY_PRESENTATIONS.has(presentation) ? 'source-fallback' : 'decoration'

const decorationsFrom = (
  projection: MarkdownStableProjection | undefined,
  mode: MarkdownEditorMode,
): readonly MarkdownLiveDecoration[] => {
  if (mode !== 'live' || !projection) return Object.freeze([])
  return Object.freeze(
    projection.nodes.map((node) =>
      Object.freeze({
        editable: false as const,
        kind: node.kind,
        nodeId: node.id,
        presentation: node.presentation,
        rawRange: Object.freeze({
          end: node.rawRange.end,
          start: node.rawRange.start,
        }),
        role: roleFor(node.presentation),
      }),
    ),
  )
}

export const resolveMarkdownLiveSurface = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly mode: MarkdownEditorMode
  readonly projection?: MarkdownStableProjection
  readonly projectionError?: boolean
  readonly revision: number
  readonly source: string
}): MarkdownLiveSurfacePlan => {
  const failed = Boolean(input.projectionError) || !input.projection
  const capability = resolveMarkdownLiveCapability(
    failed && input.mode === 'live' ? 'projection-failed' : 'supported',
    {
      documentIdentity: input.documentIdentity,
      revision: input.revision,
      ...(failed && input.mode === 'live'
        ? { reason: 'editor projection unavailable' }
        : {}),
    },
  )
  const fallbackMode =
    capability.capability === 'projection-failed' ? 'source' : input.mode
  const surfaceMode = fallbackMode
  return Object.freeze({
    capability: readMarkdownLiveCapability(capability, {
      documentIdentity: input.documentIdentity,
      revision: input.revision,
    }),
    compositionHost: MARKDOWN_LIVE_SURFACE_OWNER,
    decorations: decorationsFrom(
      failed ? undefined : input.projection,
      input.mode === 'live' && !failed ? 'live' : surfaceMode,
    ),
    fallbackMode,
    identity: input.documentIdentity,
    inputOwner: MARKDOWN_LIVE_SURFACE_OWNER,
    inputVisible: surfaceMode !== 'preview',
    keepSource: true,
    mode: input.mode,
    rendererVisible: surfaceMode === 'split' || surfaceMode === 'preview',
    revision: input.revision,
    selectionOwner: MARKDOWN_LIVE_SURFACE_OWNER,
    source: input.source,
  })
}

export const createMarkdownLiveSurface = (input: {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly mode: MarkdownEditorMode
  readonly revision: number
  readonly source: string
}): MarkdownLiveSurfacePlan => {
  if (input.mode !== 'live') {
    return resolveMarkdownLiveSurface(input)
  }
  try {
    const projection = stabilizeMarkdownEditorProjection(
      createMarkdownEditorProjection(input.source),
      input.documentIdentity,
    )
    return resolveMarkdownLiveSurface({
      ...input,
      projection,
    })
  } catch {
    return resolveMarkdownLiveSurface({
      ...input,
      projectionError: true,
    })
  }
}

export const evaluateMarkdownLiveSurfaceMutations = () => {
  const identity = Object.freeze({ epoch: 1, id: 'live-doc' })
  const authority = createMarkdownLiveSurface({
    documentIdentity: identity,
    mode: 'live',
    revision: 2,
    source: '# Title\n\n```\ncode\n```\n\n<raw>',
  })
  const dual = {
    compositionHost: 'html-overlay',
    inputOwner: MARKDOWN_LIVE_SURFACE_OWNER,
    selectionOwner: 'html-overlay',
  }
  const perBlock = authority.decorations.map((decoration) => ({
    ...decoration,
    editable: true,
    host: 'textarea',
  }))
  const serialized = '<h1>Title</h1>'
  const regexIds = (authority.source.match(/^#.+$/gm) ?? []).map(
    (_, index) => `regex:heading:${index}`,
  )
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        accepted:
          authority.selectionOwner !== authority.inputOwner ||
          authority.compositionHost !== authority.inputOwner ||
          dual.selectionOwner === authority.selectionOwner,
        detail: 'live may not have a second HTML selection owner',
        equivalent: dual.selectionOwner === 'html-overlay',
        kind: 'dual-selection-owner' as const,
      }),
      Object.freeze({
        accepted: authority.decorations.some((decoration) => decoration.editable),
        detail: 'decorations must not be per-block editors',
        equivalent: perBlock.every((decoration) => decoration.editable),
        kind: 'per-block-editor' as const,
      }),
      Object.freeze({
        accepted: authority.source === serialized || authority.source.includes('<h1>'),
        detail: 'live must not serialize DOM/HTML into source',
        equivalent: serialized.includes('<h1>'),
        kind: 'dom-serialization' as const,
      }),
      Object.freeze({
        accepted: authority.decorations.some((decoration) =>
          regexIds.includes(decoration.nodeId),
        ),
        detail: 'live must not invent a second parser or regex identity',
        equivalent: regexIds[0] === 'regex:heading:0',
        kind: 'live-only-parser' as const,
      }),
    ]),
  })
}
