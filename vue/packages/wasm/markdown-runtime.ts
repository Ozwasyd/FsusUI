import {
  MarkdownRuntimeError,
  type MarkdownRuntimeErrorCode,
} from './markdown-runtime-error'
import {
  MARKDOWN_RENDER_PARSER,
  MARKDOWN_RENDERER_VERSION,
  type MarkdownRenderRequest,
  type MarkdownSafeHtml,
} from './markdown'
import type { FsusResult } from '@fsusui/core'
import {
  createFsusRuntimeError,
  fsusErr,
  fsusOk,
  isFsusErr,
  markdownErrorToFsusError,
  type MarkdownRuntimeChunkResult,
  type MarkdownRuntimeHtmlResult,
  type MarkdownRuntimeKind,
  type MarkdownRuntimeRenderResult,
  type MarkdownRuntimeSummaryResult,
} from './runtime/markdown-result-authority'
import {
  initMarkdownRuntimeModule,
  renderMarkdownPayloadWithRuntime,
} from './runtime/markdown-wasm-engine'

export { MarkdownRuntimeError, type MarkdownRuntimeErrorCode }
export {
  resolveMarkdownAsset,
  setMarkdownRuntimeAssetOverrides,
  type MarkdownAssetKind,
  type WasmAssetUrlPair,
} from './runtime/assets'
export {
  isMarkdownRuntimeAuthorizedResult,
  renderMarkdownFallbackWithRuntime,
  type MarkdownRuntimeChunkResult,
  type MarkdownRuntimeHtmlResult,
  type MarkdownRuntimeKind,
  type MarkdownRuntimeProfile,
  type MarkdownRuntimeProfilePhase,
  type MarkdownRuntimeRenderResult,
  type MarkdownRuntimeSummaryResult,
} from './runtime/markdown-result-authority'
export {
  MARKDOWN_CODE_LANGUAGES,
  MARKDOWN_CODE_LANGUAGE_ALIASES,
  activateMarkdownFeatures,
  normalizeMarkdownCodeLanguage,
  resolveMarkdownCodeLanguageAvailability,
  setMarkdownHeavyRuntimeLoadersOverride,
  type FeatureRenderOutput,
  type MarkdownCodeLanguage,
  type MarkdownFeatureActivationError,
  type MarkdownFeatureActivationFeatureOptions,
  type MarkdownFeatureActivationItem,
  type MarkdownFeatureActivationKind,
  type MarkdownFeatureActivationOptions,
  type MarkdownFeatureActivationResult,
  type MarkdownFeatureActivationTheme,
  type MarkdownFeatureRenderContext,
  type MarkdownFeatureThemeTokens,
  type MarkdownHeavyRuntimeLoadersOverride,
} from './runtime/markdown-feature-activation'
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
  type MarkdownEditorTableAlignment,
  type MarkdownEditorTableSyntaxProjection,
  type MarkdownEditorTableSyntaxRow,
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

const markdownRuntimeUnavailable = () =>
  fsusErr(createFsusRuntimeError('infra', 'markdown_wasm_runtime_unavailable'))

const markdownRuntimeFailure = (error: unknown, phase: string) =>
  fsusErr(markdownErrorToFsusError(error, `markdown_wasm_${phase}_failed`))

const toMarkdownRuntimeResult = <Result>(result: Result | null) =>
  result ? fsusOk(result) : markdownRuntimeUnavailable()

export async function initMarkdownRuntime(): Promise<
  FsusResult<MarkdownRuntimeKind>
> {
  try {
    const result = await initMarkdownRuntimeModule()
    return result.module ? fsusOk(result.engine) : markdownRuntimeUnavailable()
  } catch (error) {
    return markdownRuntimeFailure(error, 'runtime_init')
  }
}

export async function renderMarkdownHtmlWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownRuntimeHtmlResult>> {
  try {
    const result = await renderMarkdownPayloadWithRuntime(request, 'html-only')
    return toMarkdownRuntimeResult(result)
  } catch (error) {
    return markdownRuntimeFailure(error, 'html_render')
  }
}

export async function renderMarkdownSummaryWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownRuntimeSummaryResult>> {
  try {
    const result = await renderMarkdownPayloadWithRuntime(request, 'summary')
    return toMarkdownRuntimeResult(result)
  } catch (error) {
    return markdownRuntimeFailure(error, 'summary_render')
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
    const result = await renderMarkdownPayloadWithRuntime(request, 'full-result')
    return toMarkdownRuntimeResult(result)
  } catch (error) {
    return markdownRuntimeFailure(error, 'full_render')
  }
}

export async function renderMarkdownChunksWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownRuntimeChunkResult>> {
  try {
    const result = await renderMarkdownPayloadWithRuntime(request, 'chunks')
    return toMarkdownRuntimeResult(result)
  } catch (error) {
    return markdownRuntimeFailure(error, 'chunks_render')
  }
}

export { MARKDOWN_RENDER_PARSER, MARKDOWN_RENDERER_VERSION }
