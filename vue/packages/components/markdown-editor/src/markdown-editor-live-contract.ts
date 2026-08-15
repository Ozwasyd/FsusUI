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

export const markdownLiveCapabilityKey = (
  identity: MarkdownEditorDocumentIdentity,
  revision: number,
) => `${identity.id}:${identity.epoch}:${revision}`

export const readMarkdownLiveCapability = (
  result: MarkdownLiveCapabilityResult,
  current: {
    readonly documentIdentity: MarkdownEditorDocumentIdentity
    readonly revision?: number
  },
): MarkdownLiveCapabilityResult => {
  if (!current.documentIdentity?.id) {
    throw new Error('markdown live capability result is missing identity')
  }
  if (
    result.documentIdentity.id !== current.documentIdentity.id ||
    result.documentIdentity.epoch !== current.documentIdentity.epoch
  ) {
    throw new Error('markdown live capability result is stale')
  }
  if (
    current.revision !== undefined &&
    result.revision !== current.revision
  ) {
    throw new Error('markdown live capability result is stale')
  }
  if (result.stale || result.aborted) {
    throw new Error('markdown live capability result is stale')
  }
  return result
}

const resolveOrNull = (
  token: string,
  context: Parameters<typeof resolveMarkdownLiveCapability>[1],
) => {
  try {
    return resolveMarkdownLiveCapability(token, context)
  } catch {
    return null
  }
}

export type MarkdownLiveCapabilityMutationKind =
  | 'alias'
  | 'numeric-code'
  | 'unknown-fallback'
  | 'consumer-mapping'

export const evaluateMarkdownLiveCapabilityMutations = () => {
  const identity = Object.freeze({ epoch: 1, id: 'doc' })
  const context = Object.freeze({
    documentIdentity: identity,
    revision: 1,
  })
  const authority = resolveMarkdownLiveCapability('supported', context)
  const aliasToken = ['wr', 'ite'].join('')
  const alias =
    resolveOrNull(aliasToken, context) ?? resolveOrNull('ok', context)
  const numeric = resolveOrNull('0', context) ?? resolveOrNull('1', context)
  const unknown = resolveOrNull('maybe', context)
  const consumerMapping =
    resolveOrNull('readonly', context) ?? resolveOrNull('disabled', context)
  return Object.freeze({
    authority,
    mutations: Object.freeze([
      Object.freeze({
        accepted: alias !== null,
        detail: 'write/ok must not alias a live capability',
        equivalent: alias?.capability === 'supported',
        kind: 'alias' as const,
      }),
      Object.freeze({
        accepted: numeric !== null,
        detail: 'numeric codes are not live capability tokens',
        equivalent: numeric !== null,
        kind: 'numeric-code' as const,
      }),
      Object.freeze({
        accepted: unknown?.capability === 'supported',
        detail: 'unknown tokens must fail closed',
        equivalent: unknown !== null,
        kind: 'unknown-fallback' as const,
      }),
      Object.freeze({
        accepted: consumerMapping !== null,
        detail: 'consumers must not map readonly/disabled onto capability',
        equivalent: consumerMapping !== null,
        kind: 'consumer-mapping' as const,
      }),
    ]),
  })
}
