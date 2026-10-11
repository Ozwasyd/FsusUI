import type {
  MarkdownEditorDocumentIdentity,
  MarkdownEditorSelection,
} from './markdown-editor-transaction'
import type { MarkdownLiveLayoutAnchor } from './markdown-editor-live-layout'

const choices = Object.freeze({
  fontFamily: Object.freeze([
    'system-sans',
    'reading-serif',
    'cjk-sans',
  ] as const),
  fontSize: Object.freeze(['compact', 'standard', 'large'] as const),
  lineHeight: Object.freeze(['compact', 'standard', 'relaxed'] as const),
  canvasWidth: Object.freeze(['narrow', 'standard', 'wide'] as const),
  paragraphSpacing: Object.freeze(['compact', 'standard', 'relaxed'] as const),
})

export type MarkdownEditorTypographyDimension = keyof typeof choices
export type MarkdownEditorTypographyProfile = Readonly<
  { schemaVersion: 1 } & {
    [D in MarkdownEditorTypographyDimension]: (typeof choices)[D][number]
  }
>

const dimensions = Object.freeze(
  Object.keys(choices) as MarkdownEditorTypographyDimension[],
)

/** Capability facts, not a persisted preference or a consumer default policy. */
export const MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG = Object.freeze({
  schemaVersion: 1 as const,
  mappingVersion: 'markdown-editor-typography.v1' as const,
  choices,
  supported: Object.freeze({
    fontFamily: Object.freeze(['system-sans'] as const),
    fontSize: Object.freeze(['standard'] as const),
    lineHeight: Object.freeze(['standard'] as const),
    canvasWidth: Object.freeze(['standard'] as const),
    paragraphSpacing: Object.freeze(['standard'] as const),
  }),
  baseline: Object.freeze({
    contractId: 'markdown-editor.prose.source-lines.v1' as const,
    styleAuthority:
      'theme-chalk/markdown-editor.scss: prose typography' as const,
    fontIdentity: 'system-sans.v1' as const,
    fontKind: 'system' as const,
    networkPolicy: 'no-font-loader' as const,
    paragraphSpacing: 'source-blank-lines' as const,
  }),
})

export type MarkdownEditorTypographyResolution =
  | Readonly<{ status: 'invalid'; reason: 'invalid-profile' }>
  | Readonly<{
      status: 'unsupported'
      profile: MarkdownEditorTypographyProfile
      unsupportedDimensions: readonly MarkdownEditorTypographyDimension[]
    }>
  | Readonly<{
      status: 'supported'
      profile: MarkdownEditorTypographyProfile
      contractId: typeof MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG.baseline.contractId
    }>

/** Reject accessors, symbols, missing/extra keys and non-record input without executing getters. */
const closedRecord = (input: unknown, keys: readonly string[]) => {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null
    const prototype = Object.getPrototypeOf(input)
    if (prototype !== null && prototype !== Object.prototype) return null
    const ownKeys = Reflect.ownKeys(input)
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))
    )
      return null
    const values: Record<string, unknown> = Object.create(null)
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key)
      if (!descriptor || !('value' in descriptor)) return null
      values[key] = descriptor.value
    }
    return values
  } catch {
    return null
  }
}

export const resolveMarkdownEditorTypography = (
  input: unknown,
): MarkdownEditorTypographyResolution => {
  const record = closedRecord(input, ['schemaVersion', ...dimensions])
  if (
    !record ||
    record.schemaVersion !== 1 ||
    dimensions.some((dimension) => {
      const allowed: readonly unknown[] = choices[dimension]
      return !allowed.includes(record[dimension])
    })
  )
    return Object.freeze({ status: 'invalid', reason: 'invalid-profile' })

  // All members were checked against their closed choices above; no CSS/numeric coercion.
  const profile = Object.freeze({
    ...record,
  }) as MarkdownEditorTypographyProfile
  const unsupportedDimensions = dimensions.filter((dimension) => {
    const supported: readonly unknown[] =
      MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG.supported[dimension]
    return !supported.includes(profile[dimension])
  })
  if (unsupportedDimensions.length)
    return Object.freeze({
      status: 'unsupported',
      profile,
      unsupportedDimensions: Object.freeze(unsupportedDimensions),
    })
  return Object.freeze({
    status: 'supported',
    profile,
    contractId: MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG.baseline.contractId,
  })
}

export interface MarkdownEditorTypographyRequest {
  readonly profile: MarkdownEditorTypographyProfile
  readonly expectedDocumentIdentity: MarkdownEditorDocumentIdentity
  readonly expectedRevision: number
  readonly requestId: string
}

export const readMarkdownEditorTypographyRequest = (
  input: unknown,
): MarkdownEditorTypographyRequest | null => {
  const record = closedRecord(input, [
    'profile',
    'expectedDocumentIdentity',
    'expectedRevision',
    'requestId',
  ])
  if (!record) return null
  const identity = closedRecord(record.expectedDocumentIdentity, [
    'id',
    'epoch',
  ])
  if (
    !identity ||
    typeof identity.id !== 'string' ||
    !identity.id.length ||
    typeof identity.epoch !== 'number' ||
    !Number.isSafeInteger(identity.epoch) ||
    identity.epoch < 0 ||
    typeof record.expectedRevision !== 'number' ||
    !Number.isSafeInteger(record.expectedRevision) ||
    record.expectedRevision < 0 ||
    typeof record.requestId !== 'string' ||
    !record.requestId.length ||
    record.requestId.length > 128
  )
    return null
  const resolution = resolveMarkdownEditorTypography(record.profile)
  if (resolution.status === 'invalid') return null
  return Object.freeze({
    profile: resolution.profile,
    expectedDocumentIdentity: Object.freeze({
      id: identity.id,
      epoch: identity.epoch,
    }),
    expectedRevision: record.expectedRevision,
    requestId: record.requestId,
  })
}

export interface MarkdownEditorTypographyEffective {
  readonly mappingVersion: typeof MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG.mappingVersion
  readonly profile: MarkdownEditorTypographyProfile
  readonly contractId: typeof MARKDOWN_EDITOR_TYPOGRAPHY_CATALOG.baseline.contractId
  /** Observed DOM values, never copied from a consumer or a second numeric catalog. */
  readonly fontSizePx: number
  readonly lineHeightPx: number
  readonly canvasWidthPx: number
  readonly paragraphSpacing: 'source-blank-lines'
  readonly font: Readonly<{
    identity: 'system-sans.v1'
    kind: 'system'
    state: 'current'
    computedFamily: string
    faceEvidence: 'not-collected'
    networkPolicy: 'no-font-loader'
  }>
}

export type MarkdownEditorTypographyRejection =
  | 'invalid-request'
  | 'unsupported-profile'
  | 'stale-document'
  | 'stale-revision'
  | 'composition-active'
  | 'user-scroll'
  | 'selection-changed'
  | 'surface-unavailable'
  | 'geometry-unavailable'
  | 'font-loading'
  | 'superseded'
  | 'disposed'
  | 'layout-superseded'

export type MarkdownEditorTypographyResult =
  | Readonly<{
      status: 'applied'
      requestId: string
      documentIdentity: MarkdownEditorDocumentIdentity
      revision: number
      selection: MarkdownEditorSelection
      anchor: MarkdownLiveLayoutAnchor
      effective: MarkdownEditorTypographyEffective
      settle: 'restored-after-frame'
      viewportOffsetBefore: number
      viewportOffsetAfter: number
    }>
  | Readonly<{
      status: 'rejected' | 'interrupted'
      requestId: string | null
      reason: MarkdownEditorTypographyRejection
      visualCommitted: boolean
      settle: 'not-applied' | 'incomplete'
      effective: MarkdownEditorTypographyEffective | null
    }>
