import type { MarkdownEditorDocumentIdentity } from './markdown-editor-transaction'

export type MarkdownEditorMode = 'source' | 'live' | 'split' | 'preview'
export const markdownEditorModes = ['source', 'live', 'split', 'preview'] as const

export type MarkdownLiveCapability =
  | 'supported'
  | 'unsupported-platform'
  | 'runtime-unavailable'
  | 'projection-failed'
  | 'feature-degraded'
  | 'fatal'
export const markdownLiveCapabilities = [
  'supported',
  'unsupported-platform',
  'runtime-unavailable',
  'projection-failed',
  'feature-degraded',
  'fatal',
] as const

export interface MarkdownLiveCapabilityResult {
  readonly capability: MarkdownLiveCapability
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly revision: number
  readonly reason?: string
  readonly affectedRange?: Readonly<{ end: number; start: number }>
  readonly nodeId?: string
  readonly stale?: boolean
  readonly aborted?: boolean
}

const markdownLiveCapabilitySet = new Set<string>(markdownLiveCapabilities)

export const resolveMarkdownLiveCapability = (
  token: string,
  context: {
    readonly documentIdentity: MarkdownEditorDocumentIdentity
    readonly revision: number
    readonly reason?: string
    readonly affectedRange?: Readonly<{ end: number; start: number }>
    readonly nodeId?: string
    readonly stale?: boolean
    readonly aborted?: boolean
  },
): MarkdownLiveCapabilityResult => {
  if (!markdownLiveCapabilitySet.has(token)) {
    throw new Error(`unknown markdown live capability token: ${token}`)
  }
  if (!context.documentIdentity?.id || typeof context.revision !== 'number') {
    throw new Error('markdown live capability result is missing identity')
  }
  return Object.freeze({
    capability: token as MarkdownLiveCapability,
    documentIdentity: context.documentIdentity,
    revision: context.revision,
    ...(context.reason === undefined ? {} : { reason: context.reason }),
    ...(context.affectedRange === undefined
      ? {}
      : { affectedRange: context.affectedRange }),
    ...(context.nodeId === undefined ? {} : { nodeId: context.nodeId }),
    ...(context.stale === undefined ? {} : { stale: context.stale }),
    ...(context.aborted === undefined ? {} : { aborted: context.aborted }),
  })
}
