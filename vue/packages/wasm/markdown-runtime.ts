import {
  MarkdownRuntimeError,
  type MarkdownRuntimeErrorCode,
} from './markdown-runtime-error'
import { loadEmscriptenModule } from './runtime/emscripten'
import { resolveMarkdownAsset, type MarkdownAssetKind } from './runtime/assets'
import { decodeUtf8, encodeUtf8 } from './runtime/utf8'
import {
  MARKDOWN_RENDER_PARSER,
  MARKDOWN_RENDERER_VERSION,
  detectMarkdownFeatures,
  detectMarkdownPlaceholders,
  escapeMarkdownHtml,
  normalizeMarkdownSource,
  resolveMarkdownSourceIdentity,
  type MarkdownRenderChunk,
  type MarkdownRenderFeature,
  type MarkdownRenderMetadata,
  type MarkdownRenderPlaceholder,
  type MarkdownRenderRequest,
  type MarkdownSafeHtml,
  type MarkdownSafeRenderAuthority,
  type MarkdownSafeRenderResult,
  type MarkdownRenderTimings,
} from './markdown'
import type {
  FeatureRenderOutput,
  MarkdownFeatureOutputCommitOptions,
  MarkdownFeatureOutputKind,
} from './markdown-feature-output-gateway'
import {
  assertMarkdownHeavyFeatureAdapterResourceBridge,
  createMarkdownHeavyFeatureAdapterResourceBridge,
  type MarkdownHeavyFeatureIsolatedRenderFactory,
  type MarkdownHeavyFeatureIsolatedRenderRequest,
} from './markdown-heavy-feature-resource'
import type {
  FsusErrorCode,
  FsusErrorDetail,
  FsusResult,
} from '@element-plus/utils'

export { MarkdownRuntimeError, type MarkdownRuntimeErrorCode }
export {
  MARKDOWN_EMBED_DIAGNOSTIC_CODES,
  MARKDOWN_EMBED_MODES,
  collectMarkdownEmbedNodes,
  evaluateMarkdownEmbedMutations,
  formatMarkdownEmbedDirective,
  parseMarkdownEmbedLine,
  planMarkdownEmbedEdit,
  planMarkdownEmbedInsert,
  planMarkdownEmbedRemove,
  type MarkdownEmbedCommandPlan,
  type MarkdownEmbedDiagnosticCode,
  type MarkdownEmbedInvalidNode,
  type MarkdownEmbedMode,
  type MarkdownEmbedMutationKind,
  type MarkdownEmbedMutationReport,
  type MarkdownEmbedMutationResult,
  type MarkdownEmbedNode,
  type MarkdownEmbedRanges,
  type MarkdownEmbedSourceRange,
  type MarkdownEmbedValidNode,
} from './markdown-embed-directive'
export {
  MARKDOWN_CAPTION_DIAGNOSTIC_CODES,
  collectMarkdownCaptionNodes,
  evaluateMarkdownCaptionMutations,
  parseMarkdownCaptionLine,
  type MarkdownCaptionDiagnosticCode,
  type MarkdownCaptionInvalidNode,
  type MarkdownCaptionNode,
  type MarkdownCaptionValidNode,
} from './markdown-caption-directive'
export {
  evaluateMarkdownCaptionRendererMutations,
  renderMarkdownCaptionFigure,
  type MarkdownCaptionFigureRender,
  type MarkdownCaptionLabelRender,
  type MarkdownCaptionMediaRender,
  type MarkdownCaptionRendererMutationKind,
} from './markdown-caption-renderer'
export {
  MARKDOWN_ANCHOR_DIAGNOSTIC_CODES,
  MARKDOWN_ANCHOR_ID,
  collectMarkdownAnchorNodes,
  evaluateMarkdownBlockAnchorMutations,
  parseMarkdownAnchorMarker,
  type MarkdownAnchorDiagnosticCode,
  type MarkdownAnchorInvalidNode,
  type MarkdownAnchorNode,
  type MarkdownAnchorValidNode,
} from './markdown-anchor-grammar'
export {
  MARKDOWN_URL_AUTHORITY_VERSION,
  MARKDOWN_URL_STATES,
  applyMarkdownUrlValidation,
  classifyMarkdownUrl,
  evaluateMarkdownUrlMutations,
  isMarkdownUrlResultCurrent,
  validateMarkdownUrl,
  type MarkdownUrlIdentity,
  type MarkdownUrlMutationKind,
  type MarkdownUrlState,
  type MarkdownUrlValidation,
} from './markdown-url'
export {
  commitMarkdownEmbedResult,
  createMarkdownEmbedRequest,
  evaluateMarkdownEmbedProviderMutations,
  isMarkdownEmbedResultCurrent,
  type MarkdownEmbedProvider,
  type MarkdownEmbedProviderMutationKind,
  type MarkdownEmbedProviderStatus,
  type MarkdownEmbedRequest,
  type MarkdownEmbedResult,
} from './markdown-embed-provider'
export {
  MARKDOWN_HTML_IMPORT_BUDGET,
  MARKDOWN_HTML_IMPORT_IMPORTER_VERSION,
  MARKDOWN_HTML_IMPORT_SCHEMA_VERSION,
  evaluateMarkdownHtmlImportMutations,
  importMarkdownClipboardSnapshot,
  sanitizeMarkdownHtmlImport,
  type MarkdownHtmlImportBudget,
  type MarkdownHtmlImportFinding,
  type MarkdownHtmlImportMutationKind,
  type MarkdownHtmlImportNode,
  type MarkdownHtmlImportOutcome,
  type MarkdownHtmlImportReject,
  type MarkdownHtmlImportResult,
  type MarkdownHtmlImportSnapshot,
  type MarkdownHtmlImportStats,
  type MarkdownHtmlImportTask,
  type MarkdownHtmlImportTree,
} from './markdown-html-import'
export {
  MARKDOWN_HTML_CONVERSION_BUDGET,
  MARKDOWN_HTML_CONVERSION_MAP,
  MARKDOWN_HTML_CONVERSION_VERSION,
  convertMarkdownHtmlImportSnapshot,
  convertMarkdownHtmlImportTree,
  evaluateMarkdownHtmlConversionMutations,
  type MarkdownHtmlAttachmentDescriptor,
  type MarkdownHtmlConversionMutationKind,
  type MarkdownHtmlConversionResult,
  type MarkdownHtmlLoss,
  type MarkdownHtmlLossKind,
} from './markdown-html-convert'
export {
  MARKDOWN_EMBED_BUDGET,
  commitMarkdownEmbedWalk,
  createMarkdownEmbedBudgetSession,
  detectMarkdownEmbedCycle,
  evaluateMarkdownEmbedBudget,
  evaluateMarkdownEmbedBudgetMutations,
  markdownEmbedCacheKey,
  markdownEmbedTargetIdentityKey,
  pathContainsMarkdownEmbedCycle,
  type MarkdownEmbedBudget,
  type MarkdownEmbedBudgetFailure,
  type MarkdownEmbedBudgetMutationKind,
  type MarkdownEmbedBudgetSession,
  type MarkdownEmbedBudgetTask,
  type MarkdownEmbedCacheKey,
  type MarkdownEmbedTargetIdentity,
  type MarkdownEmbedWalkFailure,
  type MarkdownEmbedWalkNode,
  type MarkdownEmbedWalkResult,
  type MarkdownEmbedWalkSuccess,
} from './markdown-embed-budget'
export {
  MARKDOWN_EMBED_PRESENTATION_MODES,
  MARKDOWN_EMBED_PRESENTATION_VERSION,
  evaluateMarkdownEmbedPresentationMutations,
  resolveMarkdownEmbedPresentation,
  type MarkdownEmbedLocalFailure,
  type MarkdownEmbedPresentation,
  type MarkdownEmbedPresentationAccessibility,
  type MarkdownEmbedPresentationActions,
  type MarkdownEmbedPresentationContent,
  type MarkdownEmbedPresentationInput,
  type MarkdownEmbedPresentationLayout,
  type MarkdownEmbedPresentationMode,
  type MarkdownEmbedPresentationMutationKind,
  type MarkdownEmbedPresentationMutationResult,
  type MarkdownEmbedPresentationState,
} from './markdown-embed-presentation'
export {
  MARKDOWN_EMBED_ACCEPTANCE_VERSION,
  evaluateMarkdownEmbedAcceptance,
  MARKDOWN_EMBED_SECURITY_CORPUS,
  type MarkdownEmbedAcceptanceReport,
  type MarkdownEmbedSecurityCorpusEntry,
} from './markdown-embed-acceptance'
export {
  assertMarkdownInteractionTrace,
  createMarkdownInteractionTrace,
  evaluateMarkdownInteractionTraceMutations,
  validateMarkdownInteractionTrace,
  type MarkdownInteractionAction,
  type MarkdownInteractionBrowser,
  type MarkdownInteractionBrowserIdentity,
  type MarkdownInteractionContractRegistry,
  type MarkdownInteractionRuntime,
  type MarkdownInteractionStep,
  type MarkdownInteractionTrace,
  type MarkdownInteractionTraceInput,
  type MarkdownInteractionTraceMutationKind,
  type MarkdownInteractionTraceValidation,
} from './markdown-interaction-trace'
export {
  MARKDOWN_EDITOR_PROJECTION_PARSER,
  MARKDOWN_EDITOR_REQUIRED_SYNTAX_KINDS,
  compareMarkdownEditorProjectionThreads,
  createMarkdownEditorProjection,
  createMarkdownEditorWorkerProjection,
  markdownEditorProjectionsEquivalent,
  markdownRenderIdentitiesEqual,
  presentationForSyntaxKind,
  validateMarkdownEditorSyntaxCoverage,
  readMarkdownRenderIdentity,
  transferMarkdownEditorProjection,
  type MarkdownEditorPresentation,
  type MarkdownEditorSyntaxStatus,
  type MarkdownEditorProjectionDiagnostic,
  type MarkdownEditorProjectionIdentity,
  type MarkdownEditorProjectionResult,
  type MarkdownEditorRequiredSyntaxKind,
  type MarkdownEditorSourceRange,
  type MarkdownEditorSyntaxCoverage,
  type MarkdownEditorSyntaxNode,
} from './markdown-editor-projection'
export {
  MARKDOWN_PROJECTION_ACCEPTANCE_SCALE,
  MARKDOWN_PROJECTION_ACCEPTANCE_VERSION,
  createMarkdownProjectionAcceptanceScaleSource,
  evaluateMarkdownProjectionAcceptance,
  recordMarkdownProjectionAcceptanceScale,
  type MarkdownProjectionAcceptanceBudgets,
  type MarkdownProjectionAcceptanceReport,
  type MarkdownProjectionAcceptanceScaleRecord,
} from './markdown-projection-acceptance'
export {
  evaluateMarkdownProjectionMutations,
  markdownProjectionHasCompleteCoverage,
  type MarkdownProjectionMutationKind,
  type MarkdownProjectionMutationReport,
  type MarkdownProjectionMutationResult,
} from './markdown-projection-mutations'
export {
  evaluateMarkdownProjectionKeystrokeMutations,
  markdownKeystrokeFullReparseRejected,
  markdownKeystrokePlanStaysBounded,
  type MarkdownKeystrokeMutationKind,
  type MarkdownKeystrokeMutationReport,
  type MarkdownKeystrokeMutationResult,
  type MarkdownKeystrokeStroke,
} from './markdown-projection-keystroke-mutations'
export {
  createMarkdownSourceCoordinateMap,
  type MarkdownSourceAffinity,
  type MarkdownSourceCoordinateMap,
  type MarkdownSourceGraphemeBoundary,
  type MarkdownSourceLineColumn,
  type MarkdownSourceOffset,
  type MarkdownSourceRange,
  type MarkdownSourceUtf8Offset,
} from './markdown-source-coordinate-map'
export {
  compareMarkdownSourceCoordinateMapThreads,
  createMarkdownSourceCoordinateMapOnWorker,
  evaluateMarkdownSourceCoordinateMutations,
  markdownSourceCoordinateSnapshotsEquivalent,
  snapshotMarkdownSourceCoordinateMap,
  transferMarkdownSourceCoordinateMap,
  type MarkdownSourceCoordinateMutationKind,
  type MarkdownSourceCoordinateMutationReport,
  type MarkdownSourceCoordinateMutationResult,
  type MarkdownSourceCoordinateSnapshot,
  type MarkdownSourceCoordinateThreadComparison,
} from './markdown-source-coordinate-threads'
export {
  stabilizeMarkdownEditorProjection,
  type MarkdownDocumentIdentity,
  type MarkdownStableProjection,
  type MarkdownStableSyntaxNode,
  type MarkdownSyntaxIdentityChange,
  type MarkdownSyntaxIdentityState,
  type MarkdownSyntaxIdentityStatus,
} from './markdown-syntax-identity'
export {
  evaluateMarkdownSyntaxIdentityMutations,
  type MarkdownSyntaxIdentityMutationKind,
  type MarkdownSyntaxIdentityMutationReport,
  type MarkdownSyntaxIdentityMutationResult,
} from './markdown-syntax-identity-mutations'
export {
  MARKDOWN_SEARCH_BUDGET,
  boundMarkdownSearchRegex,
  cancelMarkdownSearchTask,
  commitMarkdownSearchExecution,
  createMarkdownSearchTask,
  evaluateMarkdownSearchWorkerMutations,
  runMarkdownSearchTask,
  type MarkdownSearchBudget,
  type MarkdownSearchExecution,
  type MarkdownSearchExecutionStatus,
  type MarkdownSearchTask,
  type MarkdownSearchWorkerMutationKind,
} from './markdown-search-worker'
export {
  evaluateMarkdownSearchModelMutations,
  isMarkdownSearchMatchCurrent,
  searchMarkdownRawSource,
  MARKDOWN_SEARCH_MODES,
  type MarkdownSearchMatch,
  type MarkdownSearchMode,
  type MarkdownSearchQuery,
  type MarkdownSearchRejectCode,
  type MarkdownSearchResult,
} from './markdown-search-model'
export {
  applyMarkdownReplacePlan,
  evaluateMarkdownReplaceMutations,
  isMarkdownReplacePlan,
  planMarkdownReplaceAll,
  planMarkdownReplaceCurrent,
  planMarkdownReplaceCurrentInSet,
  type MarkdownReplaceChange,
  type MarkdownReplaceDocument,
  type MarkdownReplaceMutationKind,
  type MarkdownReplacePlan,
  type MarkdownReplaceRejection,
  type MarkdownReplaceResult,
} from './markdown-replace'
export {
  createMarkdownOutlineEntries,
  createMarkdownPropertyEntries,
  createMarkdownTableEntries,
  createMarkdownTechnicalEntries,
  resolveMarkdownConsumerIdentity,
  searchMarkdownStableProjection,
  evaluateMarkdownSearchMutations,
  type MarkdownIdentityConsumerEntry,
  type MarkdownOutlineEntry,
  type MarkdownPropertyEntry,
  type MarkdownSearchHit,
  type MarkdownTableEntry,
  type MarkdownTechnicalEntry,
} from './markdown-syntax-consumers'
export {
  MARKDOWN_PROJECTION_WORKER_REQUEST,
  MARKDOWN_PROJECTION_WORKER_RESULT,
  bindMarkdownProjectionWorkerScope,
  connectMarkdownProjectionWorker,
  createMarkdownProjectionWorkerHost,
  handleMarkdownProjectionWorkerMessage,
  isMarkdownProjectionWorkerRequest,
  isMarkdownProjectionWorkerResult,
  projectMarkdownOnWorker,
  reviveMarkdownStableProjection,
  snapshotMarkdownStableProjection,
  type MarkdownProjectionWorkerHost,
  type MarkdownProjectionWorkerPort,
  type MarkdownProjectionWorkerScope,
  type MarkdownProjectionWorkerRequest,
  type MarkdownProjectionWorkerResult,
  type MarkdownProjectionWorkerSnapshot,
  type MarkdownProjectionWorkerSnapshotNode,
} from './markdown-projection-worker'
export {
  MARKDOWN_PROJECTION_INVALIDATION_BUDGET,
  createMarkdownProjectionSession,
  createMarkdownProjectionTask,
  planMarkdownProjectionInvalidation,
  type MarkdownInvalidationReason,
  type MarkdownProjectionChange,
  type MarkdownProjectionInvalidationBudget,
  type MarkdownProjectionInvalidationInput,
  type MarkdownProjectionInvalidationPlan,
  type MarkdownProjectionSession,
  type MarkdownProjectionTask,
  type MarkdownProjectionTaskCommitErr,
  type MarkdownProjectionTaskCommitOk,
  type MarkdownProjectionTaskFailure,
  type MarkdownRetainedSyntaxNode,
} from './markdown-projection-invalidation'
export {
  evaluateMarkdownAnchorMutations,
  type MarkdownAnchorMutationKind,
  type MarkdownAnchorMutationReport,
  type MarkdownAnchorMutationResult,
} from './markdown-anchor-mutations'
export {
  MARKDOWN_POINTER_PLATFORMS,
  createMarkdownAnchorMap,
  type MarkdownAnchorAffinity,
  type MarkdownAnchorMap,
  type MarkdownAnchorMapInput,
  type MarkdownAnchorSyntaxInput,
  type MarkdownAnchorSyntaxNode,
  type MarkdownAnchorSyntaxRange,
  type MarkdownHiddenTraversal,
  type MarkdownHiddenTraversalDirection,
  type MarkdownHiddenTraversalQuery,
  type MarkdownPointerHit,
  type MarkdownPointerPlatform,
  type MarkdownPointerSourcePosition,
  type MarkdownRangeMutation,
  type MarkdownRemappedRange,
  type MarkdownRevealHighlight,
  type MarkdownRevealQuery,
  type MarkdownRevealTarget,
  type MarkdownSelectionDirection,
  type MarkdownSourcePosition,
  type MarkdownSourceReveal,
  type MarkdownSourceSelection,
  type MarkdownVisualKind,
  type MarkdownVisualPoint,
  type MarkdownVisualPointName,
  type MarkdownVisualPointQuery,
  type MarkdownVisualSelection,
  type SourceSelection,
} from './markdown-anchor-map'

const fsusErrorCategories = {
  aborted: 'runtime',
  conflict: 'conflict',
  forbidden: 'auth',
  infra: 'runtime',
  invariant: 'invariant',
  'not-found': 'not-found',
  protocol: 'runtime',
  timeout: 'runtime',
  unauthorized: 'auth',
  unknown: 'unknown',
  validation: 'validation',
} as const satisfies Record<FsusErrorCode, FsusErrorDetail['category']>

const createFsusRuntimeError = (
  code: FsusErrorCode,
  message: string,
  cause?: unknown,
): FsusErrorDetail => ({
  category: fsusErrorCategories[code],
  code,
  message,
  ...(cause === undefined ? {} : { cause }),
})

const fsusOk = <T>(value: T): FsusResult<T> => ({ ok: true, value })

const fsusErr = <T = never>(error: FsusErrorDetail): FsusResult<T> => ({
  ok: false,
  error,
})

const isFsusErr = <T>(
  result: FsusResult<T>,
): result is { ok: false; error: FsusErrorDetail } => result.ok === false

const markdownErrorToFsusError = (
  error: unknown,
  fallbackMessage: string,
): FsusErrorDetail => {
  if (error instanceof MarkdownRuntimeError) {
    return createFsusRuntimeError(error.code, error.message, error)
  }
  if (error instanceof Error) {
    return createFsusRuntimeError('infra', error.message, error)
  }
  return createFsusRuntimeError(
    'unknown',
    typeof error === 'string' ? error : fallbackMessage,
    error,
  )
}

function createMarkdownRuntimeError(
  code: MarkdownRuntimeErrorCode,
  message: string,
): MarkdownRuntimeError {
  return new MarkdownRuntimeError(code, message)
}

export type MarkdownRuntimeKind = 'SIMD-128' | 'SCALAR-BASIC' | 'UNKNOWN'
export type MarkdownRuntimeProfilePhase =
  | 'html-only'
  | 'summary'
  | 'full-result'
  | 'chunks'
export type MarkdownRuntimeRenderResult = MarkdownSafeRenderResult & {
  readonly engine: MarkdownRuntimeKind
  readonly timings: MarkdownRenderTimings
}

export interface MarkdownRuntimeHtmlResult extends MarkdownSafeRenderAuthority {
  readonly html: MarkdownSafeHtml
  readonly parser: string
  readonly rawSource: string
  readonly normalizedSource: string
  readonly sourceIdentity: string
  readonly engine: MarkdownRuntimeKind
  readonly rendererVersion: string
  readonly timings: MarkdownRenderTimings
}

export interface MarkdownRuntimeSummaryResult extends MarkdownSafeRenderAuthority {
  readonly html: MarkdownSafeHtml
  readonly parser: string
  readonly rawSource: string
  readonly normalizedSource: string
  readonly sourceIdentity: string
  readonly engine: MarkdownRuntimeKind
  readonly features: readonly MarkdownRenderFeature[]
  readonly metadata: MarkdownRenderMetadata
  readonly rendererVersion: string
  readonly timings: MarkdownRenderTimings
}

export type MarkdownRuntimeChunkResult = MarkdownRuntimeRenderResult & {
  readonly chunks: readonly MarkdownRenderChunk[]
}

const markdownRuntimeAuthority = new WeakSet<object>()

const deepSealMarkdownRuntimeValue = <T>(value: T): T => {
  if (Object(value) !== value || Object.isFrozen(value)) {
    return value
  }
  Object.values(value as Record<string, unknown>).forEach(
    deepSealMarkdownRuntimeValue,
  )
  return Object.freeze(value)
}

const authorizeMarkdownRuntimeResult = <TResult extends object>(
  result: TResult,
): TResult & MarkdownSafeRenderAuthority => {
  deepSealMarkdownRuntimeValue(result)
  markdownRuntimeAuthority.add(result)
  return result as TResult & MarkdownSafeRenderAuthority
}

export const isMarkdownRuntimeAuthorizedResult = (
  result: unknown,
): result is
  | MarkdownRuntimeChunkResult
  | MarkdownRuntimeHtmlResult
  | MarkdownRuntimeRenderResult
  | MarkdownRuntimeSummaryResult
  | MarkdownSafeRenderResult =>
  Object(result) === result &&
  Object.isFrozen(result) &&
  markdownRuntimeAuthority.has(result as object)

export const renderMarkdownFallbackWithRuntime = (
  request: MarkdownRenderRequest | string,
): MarkdownSafeRenderResult => {
  const payload = typeof request === 'string' ? { source: request } : request
  const normalizedSource = normalizeMarkdownSource(payload.source)
  return authorizeMarkdownRuntimeResult({
    html: `<div class="markdown-renderer__error"><p>Markdown 渲染失败，已回退为安全文本。</p><pre><code>${escapeMarkdownHtml(payload.source)}</code></pre></div>` as MarkdownSafeHtml,
    parser: MARKDOWN_RENDER_PARSER,
    rawSource: payload.source,
    normalizedSource,
    sourceIdentity: resolveMarkdownSourceIdentity(payload),
    features: detectMarkdownFeatures(normalizedSource),
    placeholders: detectMarkdownPlaceholders(normalizedSource),
    rendererVersion: MARKDOWN_RENDERER_VERSION,
  })
}

export interface MarkdownRuntimeProfile {
  engine: MarkdownRuntimeKind
  phase: MarkdownRuntimeProfilePhase
  rendererVersion: string
  timings: MarkdownRenderTimings
}

export type MarkdownFeatureActivationKind =
  | 'code-highlight'
  | 'csp-style'
  | 'external-link'
  | 'hash-link'
  | 'heading'
  | 'latex'
  | 'mermaid'

export interface MarkdownFeatureActivationFeatureOptions {
  codeHighlight?: boolean
  cspNonce?: boolean
  externalLink?: boolean
  hashLink?: boolean
  headingSlug?: boolean
  latex?: boolean
  mermaid?: boolean
}

export interface MarkdownFeatureActivationItem {
  count: number
  kind: MarkdownFeatureActivationKind
}

export interface MarkdownFeatureActivationError {
  kind: MarkdownFeatureActivationKind
  message: string
}

export interface MarkdownFeatureActivationResult {
  activated: readonly MarkdownFeatureActivationItem[]
  errors: readonly MarkdownFeatureActivationError[]
}

type MarkdownHeavyFeatureKind = 'code-highlight' | 'latex' | 'mermaid'

interface MarkdownHeavyFeatureIdentity {
  readonly config: string
  readonly documentEpoch: number | string
  readonly documentKey: string
  readonly featureKind: MarkdownHeavyFeatureKind
  readonly gatewayVersion: string
  readonly locale: string
  readonly nodeId: string
  readonly rendererVersion: string
  readonly revision: number | string
  readonly sourceIdentity: string
  readonly theme: string
}

interface MarkdownHeavyFeatureLifecycle {
  readonly activate: <T>(input: {
    readonly commit: (
      value: T,
      signal: AbortSignal,
    ) => HTMLElement | void | Promise<HTMLElement | void>
    readonly element: HTMLElement
    readonly estimateBytes: (value: T) => number
    readonly identity: MarkdownHeavyFeatureIdentity
    readonly render: (signal: AbortSignal) => Promise<T>
    readonly resources?: Readonly<{
      listeners?: number
      observers?: number
      runtimes?: number
      tasks?: number
    }>
    readonly signal?: AbortSignal
    readonly teardown?: () => void
  }) => Promise<boolean>
  mountStatic: (input: {
    readonly element: HTMLElement
    readonly identity: MarkdownHeavyFeatureIdentity
  }) => boolean
}

export type MarkdownFeatureActivationTheme = 'dark' | 'light'

export interface MarkdownFeatureThemeTokens {
  readonly background: string
  readonly danger: string
  readonly edgeLabelBackground: string
  readonly lineColor: string
  readonly mainBackground: string
  readonly nodeBorder: string
  readonly primaryBorderColor: string
  readonly primaryColor: string
  readonly primaryTextColor: string
  readonly secondaryColor: string
  readonly tertiaryColor: string
}

export interface MarkdownFeatureRenderContext {
  readonly signal?: AbortSignal
  readonly theme: MarkdownFeatureActivationTheme
  readonly tokens: Readonly<MarkdownFeatureThemeTokens>
}

export interface MarkdownFeatureActivationOptions {
  baseUrl?: string | null
  concurrency?: number
  cspNonce?: string | null
  features?: MarkdownFeatureActivationFeatureOptions
  root: ParentNode
  signal?: AbortSignal
}

interface MarkdownHeavyFeatureActivationOptions extends MarkdownFeatureActivationOptions {
  readonly heavyLifecycle?: MarkdownHeavyFeatureLifecycle
  readonly isolatedRenderFactory?: MarkdownHeavyFeatureIsolatedRenderFactory
  readonly resolveHeavyFeatureIdentity?: (input: {
    readonly element: HTMLElement
    readonly kind: MarkdownHeavyFeatureKind
    readonly source: string
    readonly theme: MarkdownFeatureActivationTheme
    readonly tokens: Readonly<MarkdownFeatureThemeTokens>
  }) => MarkdownHeavyFeatureIdentity | null
  readonly scheduleHeavyFeatureCommit?: (input: {
    readonly key: string
    readonly run: () => HTMLElement | void
    readonly signal: AbortSignal
  }) => Promise<HTMLElement | void>
}

export type { FeatureRenderOutput }

type MarkdownFeatureOutputGateway = Readonly<{
  commitMarkdownFeatureOutput: (
    target: HTMLElement,
    output: FeatureRenderOutput,
    options?: MarkdownFeatureOutputCommitOptions,
  ) => HTMLElement
}>

let markdownFeatureOutputGatewayPromise: Promise<MarkdownFeatureOutputGateway> | null =
  null

const loadMarkdownFeatureOutputGateway = () => {
  markdownFeatureOutputGatewayPromise ??=
    import('./markdown-feature-output-gateway')
  return markdownFeatureOutputGatewayPromise
}

const defaultMarkdownFeatureOptions: Required<MarkdownFeatureActivationFeatureOptions> =
  {
    codeHighlight: true,
    cspNonce: true,
    externalLink: true,
    hashLink: true,
    headingSlug: true,
    latex: true,
    mermaid: true,
  }

const toMarkdownFeatureOptions = (
  features: MarkdownFeatureActivationFeatureOptions | undefined,
) => ({
  ...defaultMarkdownFeatureOptions,
  ...(features ?? {}),
})

const pushActivation = (
  activated: MarkdownFeatureActivationItem[],
  kind: MarkdownFeatureActivationKind,
  count: number,
) => {
  if (count > 0) activated.push({ count, kind })
}

const createActivationError = (
  kind: MarkdownFeatureActivationKind,
  error: unknown,
): MarkdownFeatureActivationError => ({
  kind,
  message:
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : `${kind}_activation_failed`,
})

const slugifyMarkdownHeading = (value: string, fallback: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return slug || fallback
}

const collectExistingIds = (root: ParentNode) =>
  new Set(
    Array.from(root.querySelectorAll<HTMLElement>('[id]'))
      .map((element) => element.id)
      .filter(Boolean),
  )

const reserveUniqueId = (ids: Set<string>, base: string) => {
  let id = base
  let suffix = 2
  while (ids.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  ids.add(id)
  return id
}

const activateHeadingSlugs = (root: ParentNode) => {
  const ids = collectExistingIds(root)
  let count = 0
  Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')).forEach(
    (heading, index) => {
      if (!heading.id) {
        heading.id = reserveUniqueId(
          ids,
          slugifyMarkdownHeading(
            heading.textContent ?? '',
            `section-${index + 1}`,
          ),
        )
      }
      heading.dataset.markdownHeading = heading.id
      count += 1
    },
  )
  return count
}

const isExternalMarkdownUrl = (href: string, baseUrl?: string | null) => {
  if (/^(?:mailto|tel):/i.test(href)) return false
  if (href.startsWith('#')) return false

  try {
    const fallbackBase =
      baseUrl ??
      (typeof window !== 'undefined' && window.location?.href
        ? window.location.href
        : 'https://fsus.local/')
    const current = new URL(fallbackBase)
    const target = new URL(href, current)
    return target.origin !== current.origin
  } catch {
    return false
  }
}

const addRelToken = (element: HTMLAnchorElement, token: string) => {
  const tokens = new Set(
    (element.getAttribute('rel') ?? '').split(/\s+/).filter(Boolean),
  )
  tokens.add(token)
  element.setAttribute('rel', Array.from(tokens).join(' '))
}

const activateLinks = (
  root: ParentNode,
  baseUrl?: string | null,
): { external: number; hash: number } => {
  let external = 0
  let hash = 0

  Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]')).forEach(
    (anchor) => {
      const href = anchor.getAttribute('href') ?? ''
      if (href.startsWith('#')) {
        anchor.dataset.markdownHashLink = 'true'
        hash += 1
        return
      }

      if (!isExternalMarkdownUrl(href, baseUrl)) return

      anchor.target = '_blank'
      addRelToken(anchor, 'noopener')
      addRelToken(anchor, 'noreferrer')
      anchor.dataset.markdownExternalLink = 'true'
      external += 1
    },
  )

  return { external, hash }
}

const activateCspNonce = (root: ParentNode, nonce?: string | null) => {
  if (!nonce) return 0

  let count = 0
  Array.from(root.querySelectorAll<HTMLStyleElement>('style')).forEach(
    (style) => {
      if (!style.nonce) {
        style.nonce = nonce
        count += 1
      }
    },
  )
  return count
}

const isElementNode = (node: Node): node is Element =>
  node.nodeType === Node.ELEMENT_NODE

const selectMarkdownFeatureElements = (root: ParentNode, selector: string) => {
  const elements: HTMLElement[] = []
  const rootNode = root as Node

  if (isElementNode(rootNode) && rootNode.matches(selector)) {
    elements.push(rootNode as HTMLElement)
  }

  elements.push(...Array.from(root.querySelectorAll<HTMLElement>(selector)))
  return Array.from(new Set(elements))
}

const getRootElement = (root: ParentNode) => {
  if (isElementNode(root as Node)) return root as Element
  if (root instanceof Document) return root.documentElement
  return null
}

const resolveFeatureTheme = (
  root: ParentNode,
): MarkdownFeatureActivationTheme => {
  const rootElement = getRootElement(root)
  let current: Element | null = rootElement

  while (current) {
    const resolvedTheme =
      current.getAttribute('data-theme-resolved') ??
      current.getAttribute('data-theme')
    if (resolvedTheme === 'dark' || resolvedTheme === 'light') {
      return resolvedTheme
    }
    if (current.classList.contains('dark')) return 'dark'
    current = current.parentElement
  }

  const documentElement =
    root instanceof Document
      ? root.documentElement
      : rootElement?.ownerDocument?.documentElement
  const documentTheme =
    documentElement?.getAttribute('data-theme-resolved') ??
    documentElement?.getAttribute('data-theme')
  if (documentTheme === 'dark' || documentTheme === 'light') {
    return documentTheme
  }
  if (documentElement?.classList.contains('dark')) return 'dark'

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }

  return 'light'
}

const getComputedToken = (
  style: CSSStyleDeclaration | null,
  token: string,
  fallback: string,
) => {
  if (!style) return fallback
  const value = style.getPropertyValue(token).trim()
  if (
    !value ||
    value.length > 128 ||
    /[;{}@\\]|\/\*|\*\//u.test(value) ||
    !(
      /^#[0-9a-f]{3,8}$/iu.test(value) ||
      /^[a-z]+$/iu.test(value) ||
      /^(?:color|color-mix|hsl|hsla|lab|lch|oklab|oklch|rgb|rgba)\([0-9a-z.%+\-,/\s]+\)$/iu.test(
        value,
      )
    )
  ) {
    return fallback
  }
  return value
}

const getFeatureStyleRoot = (element: HTMLElement, root: ParentNode) =>
  getRootElement(root) ?? element.ownerDocument.documentElement

const applyNonceToFeatureStyles = (
  root: ParentNode | Node,
  nonce?: string | null,
) => {
  if (!nonce) return

  const styles: Element[] = []
  const rootNode = root as Node
  if (isElementNode(rootNode) && rootNode.tagName.toLowerCase() === 'style') {
    styles.push(rootNode)
  }
  if ('querySelectorAll' in root) {
    styles.push(...Array.from(root.querySelectorAll('style')))
  }

  styles.forEach((style) => {
    if (!(style as HTMLStyleElement).nonce) {
      ;(style as HTMLStyleElement).nonce = nonce
    }
  })
}

const formatFeatureErrorMessage = (
  kind: MarkdownFeatureActivationKind,
  error: unknown,
) =>
  error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : `${kind}_activation_failed`

const createFeatureErrorElement = (
  document: Document,
  kind: MarkdownFeatureActivationKind,
  error: unknown,
  source?: string,
  inline = false,
) => {
  const element = document.createElement(inline ? 'span' : 'div')
  element.className = 'el-markdown-renderer__feature-error'
  element.setAttribute('role', 'note')
  element.dataset.markdownFeatureError = kind

  const message = document.createElement(inline ? 'span' : 'p')
  message.className = 'el-markdown-renderer__feature-error-message'
  message.textContent = formatFeatureErrorMessage(kind, error)
  element.append(message)

  if (source) {
    const code = document.createElement('code')
    code.textContent = source
    element.append(code)
  }

  return element
}

const renderFeatureError = (
  element: HTMLElement,
  kind: MarkdownFeatureActivationKind,
  error: unknown,
  source?: string,
) => {
  const inline = element.tagName === 'SPAN' || element.tagName === 'CODE'
  const errorElement = createFeatureErrorElement(
    element.ownerDocument,
    kind,
    error,
    source,
    inline,
  )
  element.replaceChildren(errorElement)
  element.dataset.markdownFeatureError = kind
}

const replaceWithFeatureError = (
  element: HTMLElement,
  kind: MarkdownFeatureActivationKind,
  error: unknown,
  source?: string,
) => {
  const inline = element.tagName === 'SPAN' || element.tagName === 'CODE'
  const errorElement = createFeatureErrorElement(
    element.ownerDocument,
    kind,
    error,
    source,
    inline,
  )
  element.replaceWith(errorElement)
}

const extractFeatureSource = (
  element: HTMLElement,
  dataNames: readonly string[],
) => {
  for (const name of dataNames) {
    const value = element.dataset[name]
    if (value) return value
  }

  for (const attribute of [
    'data-markdown-source',
    'data-source',
    'data-source-code',
  ]) {
    const value = element.getAttribute(attribute)
    if (value) return value
  }

  const code =
    element.tagName === 'CODE'
      ? element
      : element.querySelector<HTMLElement>('code')
  return code?.textContent?.replace(/\n+$/g, '') ?? ''
}

type MermaidRuntime = {
  initialize?: (options: Record<string, unknown>) => void
  render?: (
    id: string,
    source: string,
  ) => Promise<{ svg: string }> | { svg: string } | string
}

type GlobalMermaidRuntime = typeof globalThis & {
  mermaid?: MermaidRuntime | { default?: MermaidRuntime }
}

type KatexRuntime = {
  renderToString?: (source: string, options: Record<string, unknown>) => string
}

type ShikiRenderOptions = {
  lang: string
  theme: string
}

type ShikiRuntime = {
  codeToHtml?: (
    source: string,
    options: ShikiRenderOptions,
  ) => string | Promise<string>
  ensureLoaded?: (language: string, theme: string) => Promise<void>
}

type ShikiHighlighter = {
  codeToHtml: (
    source: string,
    options: ShikiRenderOptions,
  ) => string | Promise<string>
  loadLanguage?: (...languages: unknown[]) => Promise<void>
  loadTheme?: (...themes: unknown[]) => Promise<void>
}

type ShikiCoreModule = {
  createHighlighterCore?: (options: {
    engine: unknown
    langs: unknown[]
    themes: unknown[]
  }) => Promise<ShikiHighlighter>
  default?: ShikiCoreModule
}

type ShikiJavaScriptEngineModule = {
  createJavaScriptRegexEngine?: () => unknown
  default?: ShikiJavaScriptEngineModule
}

const resolveDefaultModule = <T>(module: T | { default?: T }) =>
  'default' in (module as Record<string, unknown>) &&
  (module as { default?: T }).default
    ? (module as { default: T }).default
    : (module as T)

let mermaidRuntimePromise: Promise<MermaidRuntime> | null = null

const loadMermaidRuntime = async () => {
  const globalMermaid = (globalThis as GlobalMermaidRuntime).mermaid
  if (globalMermaid) {
    return resolveDefaultModule<MermaidRuntime>(globalMermaid)
  }

  mermaidRuntimePromise ??= import('mermaid').then((module) =>
    resolveDefaultModule<MermaidRuntime>(
      module as unknown as MermaidRuntime | { default?: MermaidRuntime },
    ),
  )

  return mermaidRuntimePromise
}

const loadKatexRuntime = async () =>
  resolveDefaultModule<KatexRuntime>(
    (await import('katex')) as unknown as
      | KatexRuntime
      | { default?: KatexRuntime },
  )

const shikiLanguageLoaders: Record<string, () => Promise<unknown>> = {
  bash: () => import('shiki/dist/langs/bash.mjs'),
  'c#': () => import('shiki/dist/langs/csharp.mjs'),
  js: () => import('shiki/dist/langs/javascript.mjs'),
  ts: () => import('shiki/dist/langs/typescript.mjs'),
}
const shikiThemeLoaders: Record<string, () => Promise<unknown>> = {
  'github-dark': () => import('shiki/dist/themes/github-dark.mjs'),
  'github-light': () => import('shiki/dist/themes/github-light.mjs'),
}
let shikiRuntimePromise: Promise<ShikiRuntime> | null = null

const loadShikiRuntime = async () => {
  shikiRuntimePromise ??= (async () => {
    const [coreModule, engineModule] = await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
    ])
    const { createHighlighterCore } = resolveDefaultModule<ShikiCoreModule>(
      coreModule as ShikiCoreModule,
    )
    const { createJavaScriptRegexEngine } =
      resolveDefaultModule<ShikiJavaScriptEngineModule>(
        engineModule as ShikiJavaScriptEngineModule,
      )
    if (!createHighlighterCore || !createJavaScriptRegexEngine) {
      throw createMarkdownRuntimeError('infra', 'shiki_runtime_unavailable')
    }
    const highlighter = await createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      langs: [],
      themes: [],
    })
    const loadedLanguages = new Set<string>()
    const loadedThemes = new Set<string>()
    const pendingLanguages = new Map<string, Promise<void>>()
    const pendingThemes = new Map<string, Promise<void>>()
    const loadOne = async (
      key: string,
      loaders: Record<string, () => Promise<unknown>>,
      loaded: Set<string>,
      pending: Map<string, Promise<void>>,
      apply: ((...values: unknown[]) => Promise<void>) | undefined,
    ) => {
      if (loaded.has(key) || !apply) return
      const loader = loaders[key]
      if (!loader) return
      let promise = pending.get(key)
      if (!promise) {
        promise = loader()
          .then((module) => {
            const value = (module as { default?: unknown }).default ?? module
            return apply(...(Array.isArray(value) ? value : [value]))
          })
          .then(() => {
            loaded.add(key)
            pending.delete(key)
          })
          .catch((error) => {
            pending.delete(key)
            throw error
          })
        pending.set(key, promise)
      }
      await promise
    }

    return {
      codeToHtml: (source, options) => highlighter.codeToHtml(source, options),
      ensureLoaded: async (language, theme) => {
        await Promise.all([
          loadOne(
            language,
            shikiLanguageLoaders,
            loadedLanguages,
            pendingLanguages,
            highlighter.loadLanguage?.bind(highlighter),
          ),
          loadOne(
            theme,
            shikiThemeLoaders,
            loadedThemes,
            pendingThemes,
            highlighter.loadTheme?.bind(highlighter),
          ),
        ])
      },
    }
  })()

  return shikiRuntimePromise
}

let markdownMermaidRenderId = 0

const resolveMarkdownFeatureThemeTokens = (
  element: HTMLElement,
  root: ParentNode,
): MarkdownFeatureThemeTokens => {
  const styleRoot = getFeatureStyleRoot(element, root)
  const style =
    styleRoot && typeof window !== 'undefined'
      ? window.getComputedStyle(styleRoot)
      : null
  return Object.freeze({
    background: getComputedToken(style, '--el-bg-color', '#ffffff'),
    danger: getComputedToken(style, '--el-color-danger', '#f56c6c'),
    edgeLabelBackground: getComputedToken(
      style,
      '--el-bg-color-overlay',
      '#ffffff',
    ),
    lineColor: getComputedToken(style, '--el-border-color-darker', '#909399'),
    mainBackground: getComputedToken(style, '--el-fill-color-light', '#f5f7fa'),
    nodeBorder: getComputedToken(style, '--el-color-primary', '#409eff'),
    primaryBorderColor: getComputedToken(
      style,
      '--el-color-primary',
      '#409eff',
    ),
    primaryColor: getComputedToken(style, '--el-fill-color-light', '#f5f7fa'),
    primaryTextColor: getComputedToken(
      style,
      '--el-text-color-primary',
      '#303133',
    ),
    secondaryColor: getComputedToken(style, '--el-fill-color-blank', '#ffffff'),
    tertiaryColor: getComputedToken(
      style,
      '--el-fill-color-lighter',
      '#fafafa',
    ),
  })
}

const renderMermaidFeature = async (
  source: string,
  context: MarkdownFeatureRenderContext,
): Promise<FeatureRenderOutput> => {
  const mermaid = await loadMermaidRuntime()
  if (context.signal?.aborted) {
    throw createMarkdownRuntimeError('infra', 'mermaid_render_aborted')
  }
  if (typeof mermaid.render !== 'function') {
    throw createMarkdownRuntimeError('infra', 'mermaid_render_unavailable')
  }

  mermaid.initialize?.({
    htmlLabels: false,
    securityLevel: 'strict',
    startOnLoad: false,
    theme: context.theme === 'dark' ? 'dark' : 'default',
    themeVariables: {
      background: context.tokens.background,
      edgeLabelBackground: context.tokens.edgeLabelBackground,
      lineColor: context.tokens.lineColor,
      mainBkg: context.tokens.mainBackground,
      nodeBorder: context.tokens.nodeBorder,
      primaryBorderColor: context.tokens.primaryBorderColor,
      primaryColor: context.tokens.primaryColor,
      primaryTextColor: context.tokens.primaryTextColor,
      secondaryColor: context.tokens.secondaryColor,
      tertiaryColor: context.tokens.tertiaryColor,
    },
  })

  const renderId = `fsus-markdown-mermaid-${++markdownMermaidRenderId}`
  const rendered = await mermaid.render(renderId, source)
  if (context.signal?.aborted) {
    throw createMarkdownRuntimeError('infra', 'mermaid_render_aborted')
  }
  return Object.freeze({
    kind: 'mermaid',
    payload:
      typeof rendered === 'string'
        ? rendered
        : (rendered as { svg: string }).svg,
    rootId: renderId,
  })
}

const isBlockLatexElement = (element: HTMLElement) =>
  element.tagName === 'DIV' ||
  element.tagName === 'FIGURE' ||
  element.dataset.latexDisplay === 'block'

const renderLatexFeature = async (
  source: string,
  context: MarkdownFeatureRenderContext,
  displayMode: boolean,
): Promise<FeatureRenderOutput> => {
  const katex = await loadKatexRuntime()
  if (context.signal?.aborted) {
    throw createMarkdownRuntimeError('infra', 'katex_render_aborted')
  }
  if (typeof katex.renderToString !== 'function') {
    throw createMarkdownRuntimeError('infra', 'katex_render_unavailable')
  }

  const payload = katex.renderToString(source, {
    displayMode,
    errorColor: context.tokens.danger,
    output: 'mathml',
    throwOnError: false,
    trust: false,
  })
  if (context.signal?.aborted) {
    throw createMarkdownRuntimeError('infra', 'katex_render_aborted')
  }
  return Object.freeze({ kind: 'latex', payload })
}

export const MARKDOWN_CODE_LANGUAGE_ALIASES = Object.freeze({
  csharp: 'c#',
  cs: 'c#',
  javascript: 'js',
  typescript: 'ts',
  shell: 'bash',
  sh: 'bash',
} as const)

export const MARKDOWN_CODE_LANGUAGES = Object.freeze([
  'bash',
  'c#',
  'js',
  'text',
  'ts',
] as const)

export type MarkdownCodeLanguage = (typeof MARKDOWN_CODE_LANGUAGES)[number]

export const normalizeMarkdownCodeLanguage = (language: string | undefined) => {
  if (!language) return 'text'
  const normalized = language.trim().toLowerCase()
  return (
    MARKDOWN_CODE_LANGUAGE_ALIASES[
      normalized as keyof typeof MARKDOWN_CODE_LANGUAGE_ALIASES
    ] ?? normalized
  )
}

export const resolveMarkdownCodeLanguageAvailability = (
  language: string | undefined,
) => {
  const info = language ?? ''
  const canonical = normalizeMarkdownCodeLanguage(language)
  const available =
    canonical === 'text' ||
    canonical in shikiLanguageLoaders ||
    (MARKDOWN_CODE_LANGUAGES as readonly string[]).includes(canonical)
  return Object.freeze({
    available,
    canonical: available ? canonical : 'text',
    fallback: available ? ('none' as const) : ('plain' as const),
    info,
  })
}

const normalizeCodeLanguage = (language: string | undefined) =>
  normalizeMarkdownCodeLanguage(language)

const extractCodeLanguage = (element: HTMLElement) => {
  for (const className of Array.from(element.classList)) {
    const match = /^language-(.+)$/i.exec(className)
    if (match?.[1]) return normalizeCodeLanguage(match[1])
  }
  return 'text'
}

const renderShikiHtml = async (
  shiki: ShikiRuntime,
  source: string,
  language: string,
  theme: string,
) => {
  if (typeof shiki.codeToHtml !== 'function') {
    throw createMarkdownRuntimeError('infra', 'shiki_code_to_html_unavailable')
  }

  try {
    return await shiki.codeToHtml(source, { lang: language, theme })
  } catch (error) {
    if (language === 'text') throw error
    return shiki.codeToHtml(source, { lang: 'text', theme })
  }
}

const renderCodeHighlightFeature = async (
  source: string,
  language: string,
  context: MarkdownFeatureRenderContext,
): Promise<FeatureRenderOutput> => {
  const theme = context.theme === 'dark' ? 'github-dark' : 'github-light'
  const shiki = await loadShikiRuntime()
  await shiki.ensureLoaded?.(language, theme)
  if (context.signal?.aborted) {
    throw createMarkdownRuntimeError('infra', 'shiki_render_aborted')
  }
  const payload = await renderShikiHtml(shiki, source, language, theme)
  if (context.signal?.aborted) {
    throw createMarkdownRuntimeError('infra', 'shiki_render_aborted')
  }
  return Object.freeze({ kind: 'code-highlight', payload })
}

interface MarkdownFeatureActivationContext extends Omit<
  MarkdownFeatureRenderContext,
  'tokens'
> {
  readonly cspNonce?: string | null
  readonly kind: Extract<
    MarkdownFeatureActivationKind,
    MarkdownFeatureOutputKind
  >
  readonly resolveTokens: (
    element: HTMLElement,
  ) => Readonly<MarkdownFeatureThemeTokens>
  readonly root: ParentNode
  readonly heavyLifecycle?: MarkdownHeavyFeatureLifecycle
  readonly isolatedRenderFactory?: MarkdownHeavyFeatureIsolatedRenderFactory
  readonly resolveHeavyFeatureIdentity?: MarkdownHeavyFeatureActivationOptions['resolveHeavyFeatureIdentity']
  readonly scheduleHeavyFeatureCommit?: MarkdownHeavyFeatureActivationOptions['scheduleHeavyFeatureCommit']
}

const toFeatureRenderContext = (
  context: MarkdownFeatureActivationContext,
  element: HTMLElement,
): MarkdownFeatureRenderContext =>
  Object.freeze({
    signal: context.signal,
    theme: context.theme,
    tokens: context.resolveTokens(element),
  })

const estimateFeatureOutputBytes = (output: FeatureRenderOutput) =>
  output.payload.length * 2 +
  (output.kind === 'mermaid' ? output.rootId.length * 2 : 0)

const activateHeavyFeature = async (input: {
  readonly commit: (output: FeatureRenderOutput) => HTMLElement | void
  readonly context: MarkdownFeatureActivationContext
  readonly element: HTMLElement
  readonly render: (
    signal: AbortSignal | undefined,
  ) => Promise<FeatureRenderOutput>
  readonly isolatedRequest: MarkdownHeavyFeatureIsolatedRenderRequest
  readonly source: string
}) => {
  const identity = input.context.resolveHeavyFeatureIdentity?.({
    element: input.element,
    kind: input.context.kind,
    source: input.source,
    theme: input.context.theme,
    tokens: input.context.resolveTokens(input.element),
  })
  if (!input.context.heavyLifecycle) {
    const output = await input.render(input.context.signal)
    if (input.context.signal?.aborted) return false
    input.commit(output)
    return true
  }
  if (!identity) return false
  const isolatedRequest = Object.freeze({
    ...input.isolatedRequest,
    lifecycleKey: [
      identity.documentKey,
      identity.documentEpoch,
      identity.nodeId,
      identity.featureKind,
    ].join(':'),
  })
  const resourceBridge = assertMarkdownHeavyFeatureAdapterResourceBridge(
    createMarkdownHeavyFeatureAdapterResourceBridge(
      input.context.isolatedRenderFactory,
    ),
  )
  try {
    return await input.context.heavyLifecycle.activate({
      commit: (output, signal) =>
        input.context.scheduleHeavyFeatureCommit
          ? input.context.scheduleHeavyFeatureCommit({
              key: [
                'markdown-heavy-feature',
                identity.documentKey,
                identity.documentEpoch,
                identity.revision,
                identity.nodeId,
                identity.featureKind,
              ].join(':'),
              run: () => input.commit(output),
              signal,
            })
          : input.commit(output),
      element: input.element,
      estimateBytes: estimateFeatureOutputBytes,
      identity,
      render: (signal) =>
        resourceBridge.run(
          signal,
          (adapterSignal) => input.render(adapterSignal),
          isolatedRequest,
        ),
      resources: resourceBridge.resources,
      signal: input.context.signal,
      teardown: resourceBridge.teardown,
    })
  } finally {
    resourceBridge.teardown()
  }
}

const mountPreRenderedHeavyFeature = (
  element: HTMLElement,
  context: MarkdownFeatureActivationContext,
) => {
  const identity = context.resolveHeavyFeatureIdentity?.({
    element,
    kind: context.kind,
    source: '',
    theme: context.theme,
    tokens: context.resolveTokens(element),
  })
  if (!context.heavyLifecycle || !identity) return false
  return context.heavyLifecycle.mountStatic({ element, identity })
}

const activateBuiltInFeature = async (
  element: HTMLElement,
  context: MarkdownFeatureActivationContext,
): Promise<boolean> => {
  const { kind } = context

  if (kind === 'mermaid') {
    if (
      element.dataset.mermaidRendered === 'true' &&
      !element.querySelector('code')
    ) {
      applyNonceToFeatureStyles(element, context.cspNonce)
      mountPreRenderedHeavyFeature(element, context)
      return false
    }
    const source = extractFeatureSource(element, [
      'mermaidSource',
      'markdownSource',
      'source',
    ]).trim()
    if (!source) return false
    try {
      const gateway = await loadMarkdownFeatureOutputGateway()
      return await activateHeavyFeature({
        context,
        element,
        source,
        isolatedRequest: {
          cspNonce: context.cspNonce,
          kind: 'mermaid',
          source,
          theme: context.theme,
          tokens: context.resolveTokens(element),
        },
        render: (signal) =>
          renderMermaidFeature(source, {
            ...toFeatureRenderContext(context, element),
            signal,
          }),
        commit: (output) => {
          const committed = gateway.commitMarkdownFeatureOutput(
            element,
            output,
            {
              nonce: context.cspNonce,
            },
          )
          committed.dataset.mermaidRendered = 'true'
          committed.dataset.markdownFeatureActivated = 'mermaid'
          committed.removeAttribute('data-mermaid-placeholder')
          return committed
        },
      })
    } catch (error) {
      renderFeatureError(element, 'mermaid', error, source)
      throw error
    }
  }

  if (kind === 'latex') {
    if (element.dataset.latexRendered && !element.querySelector('code')) {
      applyNonceToFeatureStyles(element, context.cspNonce)
      mountPreRenderedHeavyFeature(element, context)
      return false
    }
    const source = extractFeatureSource(element, [
      'latexSource',
      'markdownSource',
      'source',
    ]).trim()
    if (!source) return false
    try {
      const gateway = await loadMarkdownFeatureOutputGateway()
      return await activateHeavyFeature({
        context,
        element,
        source,
        isolatedRequest: {
          cspNonce: context.cspNonce,
          displayMode: isBlockLatexElement(element),
          kind: 'latex',
          source,
          theme: context.theme,
          tokens: context.resolveTokens(element),
        },
        render: (signal) =>
          renderLatexFeature(
            source,
            { ...toFeatureRenderContext(context, element), signal },
            isBlockLatexElement(element),
          ),
        commit: (output) => {
          const committed = gateway.commitMarkdownFeatureOutput(
            element,
            output,
            {
              nonce: context.cspNonce,
            },
          )
          committed.dataset.latexRendered = 'katex'
          committed.dataset.markdownFeatureActivated = 'latex'
          committed.removeAttribute('data-latex-placeholder')
          return committed
        },
      })
    } catch (error) {
      renderFeatureError(element, 'latex', error, source)
      throw error
    }
  }

  const code =
    element.tagName === 'CODE' ? element : element.querySelector('code')
  if (!code) return false
  const pre = code.closest('pre') ?? code
  if (
    pre instanceof HTMLElement &&
    pre.dataset.codeHighlighted === 'shiki' &&
    pre.dataset.markdownFeatureTheme === context.theme
  ) {
    applyNonceToFeatureStyles(pre, context.cspNonce)
    mountPreRenderedHeavyFeature(pre, context)
    return false
  }
  const source = code.textContent ?? ''
  if (!source) return false
  const language =
    pre instanceof HTMLElement && pre.dataset.markdownFeatureLanguage
      ? pre.dataset.markdownFeatureLanguage
      : extractCodeLanguage(code)
  try {
    const gateway = await loadMarkdownFeatureOutputGateway()
    return await activateHeavyFeature({
      context,
      element: pre,
      source,
      isolatedRequest: {
        cspNonce: context.cspNonce,
        kind: 'code-highlight',
        language,
        source,
        theme: context.theme,
        tokens: context.resolveTokens(element),
      },
      render: (signal) =>
        renderCodeHighlightFeature(source, language, {
          ...toFeatureRenderContext(context, element),
          signal,
        }),
      commit: (output) => {
        const committed = gateway.commitMarkdownFeatureOutput(pre, output, {
          mode: 'replace-element',
          nonce: context.cspNonce,
        })
        committed.dataset.codeHighlighted = 'shiki'
        committed.dataset.markdownFeatureActivated = 'code-highlight'
        committed.dataset.markdownFeatureLanguage = language
        committed.dataset.markdownFeatureTheme = context.theme
        return committed
      },
    })
  } catch (error) {
    replaceWithFeatureError(pre, 'code-highlight', error, source)
    throw error
  }
}

interface MarkdownFeatureActivationWork {
  readonly completed: Promise<void>
  readonly context: MarkdownFeatureActivationContext
  readonly dependencies: readonly MarkdownFeatureActivationWork[]
  readonly element: HTMLElement
  error?: MarkdownFeatureActivationError
  committed?: boolean
  complete: () => void
}

interface MarkdownFeatureActivationBatch {
  readonly context: MarkdownFeatureActivationContext
  readonly errors: MarkdownFeatureActivationError[]
  readonly work: MarkdownFeatureActivationWork[]
}

const markdownHeavyFeatureActivationRegistry = Object.freeze([
  Object.freeze({
    enabled: (features: Required<MarkdownFeatureActivationFeatureOptions>) =>
      features.mermaid,
    kind: 'mermaid' as const,
    selector:
      '.markdown-renderer__mermaid,[data-mermaid-placeholder],[data-mermaid-rendered]',
  }),
  Object.freeze({
    enabled: (features: Required<MarkdownFeatureActivationFeatureOptions>) =>
      features.latex,
    kind: 'latex' as const,
    selector:
      '.markdown-renderer__latex,[data-latex-placeholder],[data-latex-rendered]',
  }),
  Object.freeze({
    enabled: (features: Required<MarkdownFeatureActivationFeatureOptions>) =>
      features.codeHighlight,
    kind: 'code-highlight' as const,
    selector: 'pre code[class*="language-"],[data-code-highlighted="shiki"]',
  }),
])

const isElementInActivationRoot = (root: ParentNode, element: HTMLElement) => {
  const rootNode = root as Node
  return rootNode === element || rootNode.contains(element)
}

const createMarkdownFeatureActivationWork = (
  element: HTMLElement,
  context: MarkdownFeatureActivationContext,
  dependencies: readonly MarkdownFeatureActivationWork[],
): MarkdownFeatureActivationWork => {
  let complete: () => void = () => undefined
  const completed = new Promise<void>((resolve) => {
    complete = () => resolve()
  })
  return {
    complete,
    completed,
    context,
    dependencies,
    element,
  }
}

const activateMarkdownFeatureWork = async (
  batches: readonly MarkdownFeatureActivationBatch[],
  concurrency: number,
  signal?: AbortSignal,
) => {
  const work = batches.flatMap((batch) => batch.work)
  let nextIndex = 0

  const activateNext = async () => {
    while (!signal?.aborted) {
      const current = work[nextIndex++]
      if (!current) return

      try {
        await Promise.all(
          current.dependencies.map((dependency) => dependency.completed),
        )
        if (
          signal?.aborted ||
          !isElementInActivationRoot(current.context.root, current.element)
        ) {
          continue
        }

        const committed = await activateBuiltInFeature(
          current.element,
          current.context,
        )
        if (!signal?.aborted) {
          current.committed = committed
        }
      } catch (error) {
        current.error = createActivationError(current.context.kind, error)
      } finally {
        current.complete()
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(work.length, concurrency) }, () =>
      activateNext(),
    ),
  )
}

export const activateMarkdownFeatures = async (
  options: MarkdownFeatureActivationOptions,
): Promise<MarkdownFeatureActivationResult> => {
  const heavyOptions = options as MarkdownHeavyFeatureActivationOptions
  const features = toMarkdownFeatureOptions(options.features)
  const activated: MarkdownFeatureActivationItem[] = []
  const errors: MarkdownFeatureActivationError[] = []
  const theme = resolveFeatureTheme(options.root)
  const concurrency = Math.max(1, Math.min(4, options.concurrency ?? 3))
  let themeTokens: Readonly<MarkdownFeatureThemeTokens> | undefined
  const resolveTokens = (element: HTMLElement) =>
    (themeTokens ??= resolveMarkdownFeatureThemeTokens(element, options.root))

  if (options.signal?.aborted) return { activated, errors }

  if (features.headingSlug) {
    pushActivation(activated, 'heading', activateHeadingSlugs(options.root))
  }

  if (features.externalLink || features.hashLink) {
    const links = activateLinks(options.root, options.baseUrl)
    if (features.externalLink) {
      pushActivation(activated, 'external-link', links.external)
    }
    if (features.hashLink) {
      pushActivation(activated, 'hash-link', links.hash)
    }
  }

  if (features.cspNonce) {
    pushActivation(
      activated,
      'csp-style',
      activateCspNonce(options.root, options.cspNonce),
    )
  }

  const batches: MarkdownFeatureActivationBatch[] = []
  const priorWork: MarkdownFeatureActivationWork[] = []

  for (const {
    enabled,
    kind,
    selector,
  } of markdownHeavyFeatureActivationRegistry) {
    if (options.signal?.aborted) break
    if (!enabled(features)) continue

    const context: MarkdownFeatureActivationContext = {
      cspNonce: options.cspNonce,
      heavyLifecycle: heavyOptions.heavyLifecycle,
      isolatedRenderFactory: heavyOptions.isolatedRenderFactory,
      kind,
      resolveHeavyFeatureIdentity: heavyOptions.resolveHeavyFeatureIdentity,
      scheduleHeavyFeatureCommit: heavyOptions.scheduleHeavyFeatureCommit,
      resolveTokens,
      root: options.root,
      signal: options.signal,
      theme,
    }
    const batch: MarkdownFeatureActivationBatch = {
      context,
      errors: [],
      work: [],
    }
    batches.push(batch)

    try {
      selectMarkdownFeatureElements(options.root, selector).forEach(
        (element) => {
          const dependencies = priorWork.filter(
            (prior) =>
              prior.element !== element && prior.element.contains(element),
          )
          const current = createMarkdownFeatureActivationWork(
            element,
            context,
            dependencies,
          )
          batch.work.push(current)
          priorWork.push(current)
        },
      )
    } catch (error) {
      batch.errors.push(createActivationError(kind, error))
    }
  }

  await activateMarkdownFeatureWork(batches, concurrency, options.signal)

  batches.forEach((batch) => {
    pushActivation(
      activated,
      batch.context.kind,
      batch.work.filter((work) => work.committed).length,
    )
    errors.push(
      ...batch.errors,
      ...batch.work.flatMap((work) => (work.error ? [work.error] : [])),
    )
  })

  return { activated, errors }
}

type MarkdownModule = {
  HEAPU8: Uint8Array
  memory?: WebAssembly.Memory
  _markdown_render?: (
    ptr: number,
    len: number,
    allowLatex: number,
    allowMermaid: number,
    argumentCount: number,
  ) => number
  _markdown_render_profile?: (
    ptr: number,
    len: number,
    allowLatex: number,
    allowMermaid: number,
    payloadMode: number,
    argumentCount: number,
  ) => number
  _markdown_get_last_html_ptr?: () => number
  _markdown_get_last_html_len?: () => number
  _markdown_get_last_error_ptr?: () => number
  _markdown_get_last_error_len?: () => number
  _markdown_get_last_error_code?: () => number
  _markdown_get_last_features_ptr?: () => number
  _markdown_get_last_features_len?: () => number
  _markdown_get_last_placeholders_ptr?: () => number
  _markdown_get_last_placeholders_len?: () => number
  _markdown_get_last_chunks_ptr?: () => number
  _markdown_get_last_chunks_len?: () => number
  _markdown_get_last_renderer_version_ptr?: () => number
  _markdown_get_last_renderer_version_len?: () => number
  _markdown_get_last_metadata_ptr?: () => number
  _markdown_get_last_metadata_len?: () => number
  _markdown_alloc_buffer?: (size: number) => number
  _markdown_free_buffer?: (ptr: number) => void
}

type MarkdownModuleFactoryResult = MarkdownModule & Record<string, unknown>

let runtimeModule: MarkdownModuleFactoryResult | null = null
let runtimePromise: Promise<{
  module: MarkdownModuleFactoryResult | null
  engine: MarkdownRuntimeKind
}> | null = null
let runtimeEngine: MarkdownRuntimeKind = 'UNKNOWN'

function supportsSimdMarkdown(): boolean {
  try {
    const simdProbe = new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10,
      1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ])
    return WebAssembly.validate(simdProbe)
  } catch {
    return false
  }
}

function resolveMarkdownAssetKind(): MarkdownAssetKind {
  return supportsSimdMarkdown() ? 'simd' : 'basic'
}

function pickExport<T>(raw: Record<string, unknown>, ...names: string[]): T {
  for (const name of names) {
    const direct = raw[name]
    if (direct) {
      return direct as T
    }

    const underscored = raw[`_${name}`]
    if (underscored) {
      return underscored as T
    }
  }

  throw createMarkdownRuntimeError(
    'invariant',
    `wasm_export_missing:${names[0] ?? 'unknown'}`,
  )
}

function mapMarkdownErrorCode(
  code: number,
  fallback: string,
): MarkdownRuntimeErrorCode {
  switch (code) {
    case 1:
      return 'protocol'
    default:
      if (fallback.includes('source') || fallback.includes('input')) {
        return 'protocol'
      }
      return 'infra'
  }
}

async function initMarkdownRuntimeModule(): Promise<{
  module: MarkdownModuleFactoryResult | null
  engine: MarkdownRuntimeKind
}> {
  if (runtimeModule) {
    return { module: runtimeModule, engine: runtimeEngine }
  }

  if (!runtimePromise) {
    runtimePromise = (async () => {
      const assetKind = resolveMarkdownAssetKind()
      const engine: MarkdownRuntimeKind =
        assetKind === 'simd' ? 'SIMD-128' : 'SCALAR-BASIC'
      const asset = resolveMarkdownAsset(assetKind)
      const module = await loadEmscriptenModule<MarkdownModuleFactoryResult>(
        asset.moduleUrl,
        'createMarkdownModule',
        asset.wasmUrl,
      )

      if (!module) {
        return { module: null, engine }
      }

      const raw = module as unknown as Record<string, unknown>
      runtimeModule = module
      Object.assign(runtimeModule, {
        _markdown_render: pickExport<
          (
            ptr: number,
            len: number,
            allowLatex: number,
            allowMermaid: number,
            argumentCount: number,
          ) => number
        >(raw, 'markdown_render', 'render_markdown'),
        _markdown_render_profile: pickExport<
          (
            ptr: number,
            len: number,
            allowLatex: number,
            allowMermaid: number,
            payloadMode: number,
            argumentCount: number,
          ) => number
        >(raw, 'markdown_render_profile'),
        _markdown_get_last_html_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_html_ptr',
          'get_last_html_ptr',
        ),
        _markdown_get_last_html_len: pickExport<() => number>(
          raw,
          'markdown_get_last_html_len',
          'get_last_html_len',
        ),
        _markdown_get_last_error_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_error_ptr',
          'get_last_error_ptr',
        ),
        _markdown_get_last_error_len: pickExport<() => number>(
          raw,
          'markdown_get_last_error_len',
          'get_last_error_len',
        ),
        _markdown_get_last_error_code: pickExport<() => number>(
          raw,
          'markdown_get_last_error_code',
          'get_last_error_code',
        ),
        _markdown_get_last_features_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_features_ptr',
          'get_last_features_ptr',
        ),
        _markdown_get_last_features_len: pickExport<() => number>(
          raw,
          'markdown_get_last_features_len',
          'get_last_features_len',
        ),
        _markdown_get_last_placeholders_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_placeholders_ptr',
          'get_last_placeholders_ptr',
        ),
        _markdown_get_last_placeholders_len: pickExport<() => number>(
          raw,
          'markdown_get_last_placeholders_len',
          'get_last_placeholders_len',
        ),
        _markdown_get_last_chunks_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_chunks_ptr',
          'get_last_chunks_ptr',
        ),
        _markdown_get_last_chunks_len: pickExport<() => number>(
          raw,
          'markdown_get_last_chunks_len',
          'get_last_chunks_len',
        ),
        _markdown_get_last_renderer_version_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_renderer_version_ptr',
          'get_last_renderer_version_ptr',
        ),
        _markdown_get_last_renderer_version_len: pickExport<() => number>(
          raw,
          'markdown_get_last_renderer_version_len',
          'get_last_renderer_version_len',
        ),
        _markdown_get_last_metadata_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_metadata_ptr',
          'get_last_metadata_ptr',
        ),
        _markdown_get_last_metadata_len: pickExport<() => number>(
          raw,
          'markdown_get_last_metadata_len',
          'get_last_metadata_len',
        ),
        _markdown_alloc_buffer: pickExport<(size: number) => number>(
          raw,
          'markdown_alloc_buffer',
          'alloc_buffer',
        ),
        _markdown_free_buffer: pickExport<(ptr: number) => void>(
          raw,
          'markdown_free_buffer',
          'free_buffer',
        ),
      })
      runtimeEngine = engine

      return { module: runtimeModule, engine }
    })().catch(() => ({
      module: null,
      engine: 'UNKNOWN' as MarkdownRuntimeKind,
    }))
  }

  return await runtimePromise
}

function readCString(
  memory: WebAssembly.Memory,
  ptr: number,
  len: number,
): string {
  if (ptr <= 0 || len <= 0) {
    return ''
  }

  const view = new Uint8Array(memory.buffer, ptr, len)
  return decodeUtf8(view)
}

function resolveModuleMemory(
  module: MarkdownModuleFactoryResult,
): WebAssembly.Memory | null {
  if (module.memory) {
    return module.memory
  }

  const heapBuffer = module.HEAPU8?.buffer
  if (!heapBuffer) {
    return null
  }

  return { buffer: heapBuffer } as WebAssembly.Memory
}

function readStructured<T>(
  memory: WebAssembly.Memory,
  ptr: number,
  len: number,
  fallback: T,
): T {
  const raw = readCString(memory, ptr, len)
  if (!raw) {
    return fallback
  }

  try {
    return parseStructuredText(raw) as T
  } catch {
    return fallback
  }
}

function parseStructuredText(raw: string): unknown {
  const source = raw.trim()
  if (!source) return null

  try {
    return JSON.parse(source)
  } catch {
    return parseStructuredTextFallback(source)
  }
}

function parseStructuredTextFallback(source: string): unknown {
  let offset = 0
  const skipWhitespace = () => {
    while (/\s/u.test(source[offset] ?? '')) offset += 1
  }
  const parseValue = (): unknown => {
    skipWhitespace()
    const char = source[offset]
    if (char === '"') return parseString()
    if (char === '[') return parseArray()
    if (char === '{') return parseObject()
    if (source.startsWith('true', offset)) {
      offset += 4
      return true
    }
    if (source.startsWith('false', offset)) {
      offset += 5
      return false
    }
    if (source.startsWith('null', offset)) {
      offset += 4
      return null
    }
    return parseNumber()
  }
  const parseString = (): string => {
    offset += 1
    let value = ''
    while (offset < source.length) {
      const char = source[offset++]
      if (char === '"') return value
      if (char !== '\\') {
        value += char
        continue
      }
      const escaped = source[offset++]
      if (escaped === 'n') value += '\n'
      else if (escaped === 'r') value += '\r'
      else if (escaped === 't') value += '\t'
      else if (escaped === 'b') value += '\b'
      else if (escaped === 'f') value += '\f'
      else if (escaped === 'u') {
        value += String.fromCharCode(
          Number.parseInt(source.slice(offset, offset + 4), 16),
        )
        offset += 4
      } else {
        value += escaped
      }
    }
    throw createMarkdownRuntimeError('protocol', 'structured_string_unclosed')
  }
  const parseArray = (): unknown[] => {
    offset += 1
    const values: unknown[] = []
    skipWhitespace()
    if (source[offset] === ']') {
      offset += 1
      return values
    }
    while (offset < source.length) {
      values.push(parseValue())
      skipWhitespace()
      if (source[offset] === ']') {
        offset += 1
        return values
      }
      if (source[offset++] !== ',')
        throw createMarkdownRuntimeError(
          'protocol',
          'structured_array_separator_invalid',
        )
    }
    throw createMarkdownRuntimeError('protocol', 'structured_array_unclosed')
  }
  const parseObject = (): Record<string, unknown> => {
    offset += 1
    const value: Record<string, unknown> = {}
    skipWhitespace()
    if (source[offset] === '}') {
      offset += 1
      return value
    }
    while (offset < source.length) {
      const key = parseString()
      skipWhitespace()
      if (source[offset++] !== ':')
        throw createMarkdownRuntimeError(
          'protocol',
          'structured_object_separator_invalid',
        )
      value[key] = parseValue()
      skipWhitespace()
      if (source[offset] === '}') {
        offset += 1
        return value
      }
      if (source[offset++] !== ',')
        throw createMarkdownRuntimeError(
          'protocol',
          'structured_object_entry_invalid',
        )
      skipWhitespace()
    }
    throw createMarkdownRuntimeError('protocol', 'structured_object_unclosed')
  }
  const parseNumber = (): number => {
    const start = offset
    while (/[-+0-9.eE]/u.test(source[offset] ?? '')) offset += 1
    const value = Number(source.slice(start, offset))
    if (!Number.isFinite(value))
      throw createMarkdownRuntimeError('protocol', 'structured_number_invalid')
    return value
  }
  const value = parseValue()
  skipWhitespace()
  if (offset !== source.length)
    throw createMarkdownRuntimeError('protocol', 'structured_trailing_data')
  return value
}
export async function initMarkdownRuntime(): Promise<
  FsusResult<MarkdownRuntimeKind>
> {
  try {
    const result = await initMarkdownRuntimeModule()
    if (!result.module) {
      return fsusErr(
        createFsusRuntimeError('infra', 'markdown_wasm_runtime_unavailable'),
      )
    }
    return fsusOk(result.engine)
  } catch (error) {
    return fsusErr(
      markdownErrorToFsusError(error, 'markdown_wasm_runtime_init_failed'),
    )
  }
}

const now = () => {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now()
  }
  return Date.now()
}

const roundMs = (value: number) => Math.round(value * 100) / 100

type MutableMarkdownRenderTimings = {
  -readonly [TKey in keyof MarkdownRenderTimings]: MarkdownRenderTimings[TKey]
}

const createTimings = (): MutableMarkdownRenderTimings => ({
  initMs: 0,
  encodeMs: 0,
  wasmRenderMs: 0,
  readHtmlMs: 0,
  readFeaturesMs: 0,
  readPlaceholdersMs: 0,
  readMetadataMs: 0,
  totalMs: 0,
})

const finalizeTimings = (
  timings: MutableMarkdownRenderTimings,
  startedAt: number,
): MarkdownRenderTimings => {
  timings.totalMs = roundMs(now() - startedAt)
  timings.initMs = roundMs(timings.initMs)
  timings.encodeMs = roundMs(timings.encodeMs)
  timings.wasmRenderMs = roundMs(timings.wasmRenderMs)
  timings.readHtmlMs = roundMs(timings.readHtmlMs)
  timings.readFeaturesMs = roundMs(timings.readFeaturesMs)
  timings.readPlaceholdersMs = roundMs(timings.readPlaceholdersMs)
  timings.readMetadataMs = roundMs(timings.readMetadataMs)
  return timings
}

type MarkdownPayloadMode = 'html-only' | 'summary' | 'full-result' | 'chunks'

const payloadModeToWasmMode = (mode: MarkdownPayloadMode) => {
  if (mode === 'chunks') return 3
  if (mode === 'html-only') return 2
  if (mode === 'summary') return 1
  return 0
}

const buildDefaultMetadata = (
  payload: MarkdownRenderRequest,
  source: string,
  features: readonly MarkdownRenderFeature[],
  placeholderCount: number,
  rendererVersion: string,
): MarkdownRenderMetadata => ({
  mode: payload.mode ?? 'article',
  baseUrl: payload.baseUrl ?? null,
  allowLatex: payload.allowLatex !== false,
  allowMermaid: payload.allowMermaid !== false,
  sourceLength: source.length,
  featureCount: features.length,
  placeholderCount,
  rendererVersion,
})

type MarkdownRuntimePayloadResult =
  | MarkdownRuntimeHtmlResult
  | MarkdownRuntimeSummaryResult
  | MarkdownRuntimeRenderResult
  | MarkdownRuntimeChunkResult

async function renderMarkdownPayloadWithRuntime(
  request: MarkdownRenderRequest | string,
  payloadMode: MarkdownPayloadMode,
): Promise<MarkdownRuntimePayloadResult | null> {
  const startedAt = now()
  const timings = createTimings()
  const payload = typeof request === 'string' ? { source: request } : request
  const source = normalizeMarkdownSource(payload.source)

  const initStartedAt = now()
  const { module, engine } = await initMarkdownRuntimeModule()
  timings.initMs = now() - initStartedAt

  if (!module) {
    return null
  }

  const alloc = module._markdown_alloc_buffer
  const free = module._markdown_free_buffer
  const render = module._markdown_render_profile ?? module._markdown_render
  const getHtmlPtr = module._markdown_get_last_html_ptr
  const getHtmlLen = module._markdown_get_last_html_len
  const getErrorPtr = module._markdown_get_last_error_ptr
  const getErrorLen = module._markdown_get_last_error_len
  const getErrorCode = module._markdown_get_last_error_code
  const getFeaturesPtr = module._markdown_get_last_features_ptr
  const getFeaturesLen = module._markdown_get_last_features_len
  const getPlaceholdersPtr = module._markdown_get_last_placeholders_ptr
  const getPlaceholdersLen = module._markdown_get_last_placeholders_len
  const getChunksPtr = module._markdown_get_last_chunks_ptr
  const getChunksLen = module._markdown_get_last_chunks_len
  const getRendererVersionPtr = module._markdown_get_last_renderer_version_ptr
  const getRendererVersionLen = module._markdown_get_last_renderer_version_len
  const getMetadataPtr = module._markdown_get_last_metadata_ptr
  const getMetadataLen = module._markdown_get_last_metadata_len

  if (
    !alloc ||
    !free ||
    !render ||
    !getHtmlPtr ||
    !getHtmlLen ||
    !getErrorPtr ||
    !getErrorLen ||
    !getErrorCode ||
    !getFeaturesPtr ||
    !getFeaturesLen ||
    !getPlaceholdersPtr ||
    !getPlaceholdersLen ||
    !getChunksPtr ||
    !getChunksLen ||
    !getRendererVersionPtr ||
    !getRendererVersionLen ||
    !getMetadataPtr ||
    !getMetadataLen
  ) {
    return null
  }

  const encodeStartedAt = now()
  const bytes = encodeUtf8(source)
  const ptr = alloc(bytes.byteLength)
  if (ptr <= 0) {
    return null
  }

  try {
    module.HEAPU8.set(bytes, ptr)
    timings.encodeMs = now() - encodeStartedAt

    const renderStartedAt = now()
    const ok =
      render === module._markdown_render_profile
        ? module._markdown_render_profile(
            ptr,
            bytes.byteLength,
            payload.allowLatex === false ? 0 : 1,
            payload.allowMermaid === false ? 0 : 1,
            payloadModeToWasmMode(payloadMode),
            5,
          )
        : module._markdown_render?.(
            ptr,
            bytes.byteLength,
            payload.allowLatex === false ? 0 : 1,
            payload.allowMermaid === false ? 0 : 1,
            4,
          )
    timings.wasmRenderMs = now() - renderStartedAt

    const memory = resolveModuleMemory(module)
    if (!memory) {
      return null
    }
    if (ok !== 1) {
      const error = readCString(memory, getErrorPtr(), getErrorLen())
      if (error) {
        throw createMarkdownRuntimeError(
          mapMarkdownErrorCode(getErrorCode(), error),
          `markdown_wasm_render_failed:${error}`,
        )
      }
      return null
    }

    const htmlStartedAt = now()
    const html = readCString(memory, getHtmlPtr(), getHtmlLen())
    timings.readHtmlMs = now() - htmlStartedAt

    const metadataStartedAt = now()
    const rendererVersion =
      readCString(memory, getRendererVersionPtr(), getRendererVersionLen()) ||
      MARKDOWN_RENDERER_VERSION
    timings.readMetadataMs = now() - metadataStartedAt

    if (payloadMode === 'html-only') {
      return authorizeMarkdownRuntimeResult({
        html: html as MarkdownSafeHtml,
        parser: MARKDOWN_RENDER_PARSER,
        rawSource: payload.source,
        normalizedSource: source,
        sourceIdentity: resolveMarkdownSourceIdentity(payload),
        engine,
        rendererVersion,
        timings: finalizeTimings(timings, startedAt),
      })
    }

    const featuresStartedAt = now()
    const features = readStructured<MarkdownSafeRenderResult['features']>(
      memory,
      getFeaturesPtr(),
      getFeaturesLen(),
      [],
    )
    timings.readFeaturesMs = now() - featuresStartedAt

    const metadataReadStartedAt = now()
    const metadata = readStructured<MarkdownRenderMetadata>(
      memory,
      getMetadataPtr(),
      getMetadataLen(),
      buildDefaultMetadata(payload, source, features, 0, rendererVersion),
    )
    timings.readMetadataMs += now() - metadataReadStartedAt

    if (payloadMode === 'summary') {
      return authorizeMarkdownRuntimeResult({
        html: html as MarkdownSafeHtml,
        parser: MARKDOWN_RENDER_PARSER,
        rawSource: payload.source,
        normalizedSource: source,
        sourceIdentity: resolveMarkdownSourceIdentity(payload),
        engine,
        features,
        metadata,
        rendererVersion,
        timings: finalizeTimings(timings, startedAt),
      })
    }

    const placeholdersStartedAt = now()
    const placeholders = readStructured<MarkdownRenderPlaceholder[]>(
      memory,
      getPlaceholdersPtr(),
      getPlaceholdersLen(),
      [],
    )
    timings.readPlaceholdersMs = now() - placeholdersStartedAt

    const safeResult = {
      html: html as MarkdownSafeHtml,
      parser: MARKDOWN_RENDER_PARSER,
      rawSource: payload.source,
      normalizedSource: source,
      sourceIdentity: resolveMarkdownSourceIdentity(payload),
      features,
      placeholders,
      rendererVersion,
      metadata,
    }
    if (payloadMode === 'chunks') {
      const chunks = readStructured<MarkdownRenderChunk[]>(
        memory,
        getChunksPtr(),
        getChunksLen(),
        [],
      )
      return authorizeMarkdownRuntimeResult({
        ...safeResult,
        chunks,
        engine,
        timings: finalizeTimings(timings, startedAt),
      })
    }

    return authorizeMarkdownRuntimeResult({
      ...safeResult,
      engine,
      timings: finalizeTimings(timings, startedAt),
    })
  } finally {
    free(ptr)
  }
}

export async function renderMarkdownHtmlWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownRuntimeHtmlResult>> {
  try {
    const result = (await renderMarkdownPayloadWithRuntime(
      request,
      'html-only',
    )) as MarkdownRuntimeHtmlResult | null
    return result
      ? fsusOk(result)
      : fsusErr(
          createFsusRuntimeError('infra', 'markdown_wasm_runtime_unavailable'),
        )
  } catch (error) {
    return fsusErr(
      markdownErrorToFsusError(error, 'markdown_wasm_html_render_failed'),
    )
  }
}

export async function renderMarkdownSummaryWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownRuntimeSummaryResult>> {
  try {
    const result = (await renderMarkdownPayloadWithRuntime(
      request,
      'summary',
    )) as MarkdownRuntimeSummaryResult | null
    return result
      ? fsusOk(result)
      : fsusErr(
          createFsusRuntimeError('infra', 'markdown_wasm_runtime_unavailable'),
        )
  } catch (error) {
    return fsusErr(
      markdownErrorToFsusError(error, 'markdown_wasm_summary_render_failed'),
    )
  }
}

export async function renderMarkdownWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownSafeHtml>> {
  const result = await renderMarkdownHtmlWithRuntime(request)
  return isFsusErr(result) ? fsusErr(result.error) : fsusOk(result.value.html)
}

export async function renderMarkdownResultWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownRuntimeRenderResult>> {
  try {
    const result = (await renderMarkdownPayloadWithRuntime(
      request,
      'full-result',
    )) as MarkdownRuntimeRenderResult | null
    return result
      ? fsusOk(result)
      : fsusErr(
          createFsusRuntimeError('infra', 'markdown_wasm_runtime_unavailable'),
        )
  } catch (error) {
    return fsusErr(
      markdownErrorToFsusError(error, 'markdown_wasm_full_render_failed'),
    )
  }
}

export async function renderMarkdownChunksWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownRuntimeChunkResult>> {
  try {
    const result = (await renderMarkdownPayloadWithRuntime(
      request,
      'chunks',
    )) as MarkdownRuntimeChunkResult | null
    return result
      ? fsusOk(result)
      : fsusErr(
          createFsusRuntimeError('infra', 'markdown_wasm_runtime_unavailable'),
        )
  } catch (error) {
    return fsusErr(
      markdownErrorToFsusError(error, 'markdown_wasm_chunks_render_failed'),
    )
  }
}

export { MARKDOWN_RENDER_PARSER, MARKDOWN_RENDERER_VERSION }
