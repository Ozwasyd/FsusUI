export {
  commitMarkdownLanguageToolMutation,
  createMarkdownLanguageToolSession,
  resolveMarkdownLanguageToolCapability,
  resolveMarkdownLanguageToolContextCapability,
  type MarkdownLanguageToolCapability,
  type MarkdownLanguageToolCommitInput,
  type MarkdownLanguageToolCommitResult,
  type MarkdownLanguageToolConfig,
  type MarkdownLanguageToolReason,
  type MarkdownLanguageToolSession,
  type MarkdownLanguageToolSessionKind,
  type MarkdownLanguageToolStatus,
  type MarkdownNativeWritingToolsMode,
  type MarkdownSpellcheckMode,
} from './markdown-editor-language-tools'
export {
  bindMarkdownWebLanguageTools,
  planMarkdownWebReplacement,
  resolveMarkdownWebLanguageCoordinates,
  type MarkdownWebLanguageBeforeInput,
  type MarkdownWebLanguageController,
  type MarkdownWebLanguageCoordinates,
  type MarkdownWebTextareaLike,
} from './markdown-editor-language-web'
import type { Language, TranslatePair } from '../../internal/bridge'
import { defaultMarkdownLanguage as English } from '../../internal/bridge'
import type {
  MarkdownNativeWritingToolsMode,
  MarkdownSpellcheckMode,
} from './markdown-editor-language-tools'
import { createMarkdownTableCommands } from './markdown-editor-table-acceptance'
import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '../../internal/bridge'
import { buildProps, definePropType } from '../../internal/bridge'

import type { ExtractPropTypes, PropType } from 'vue'
import type { MarkdownFeatureActivationFeatureOptions } from '@fsusui/wasm'
import type { MarkdownEmbedProvider } from '@fsusui/wasm/markdown-embed-provider'
import type { MarkdownStableProjection } from '@fsusui/wasm'
import type MarkdownEditor from './markdown-editor.vue'
import type { MarkdownAttachmentBatchIntent } from './markdown-editor-attachment'
import type { MarkdownEditorMetricsOptions } from './markdown-editor-metrics'
export {
  captureMarkdownAttachmentInput,
  createMarkdownAttachmentCaptureSession,
  createMarkdownAttachmentAtomicPresentation,
  createMarkdownAttachmentBatch,
  createMarkdownAttachmentRequest,
  createMarkdownAttachmentSession,
  commitMarkdownAttachmentResult,
  evaluateMarkdownAttachmentAcceptance,
  evaluateMarkdownAttachmentCaptureMutations,
  evaluateMarkdownAttachmentMutations,
  evaluateMarkdownAttachmentPresentationMutations,
  markdownFromAttachmentPayload,
  queryMarkdownAttachmentUnfinishedCount,
  validateMarkdownAttachmentPrepublish,
  type MarkdownAttachmentAcceptanceReport,
  type MarkdownAttachmentAnchor,
  type MarkdownAttachmentAtomicAction,
  type MarkdownAttachmentAtomicPresentation,
  type MarkdownAttachmentBatchIntent,
  type MarkdownAttachmentCaptureContext,
  type MarkdownAttachmentCaptureInput,
  type MarkdownAttachmentCaptureRejection,
  type MarkdownAttachmentCaptureResult,
  type MarkdownAttachmentCaptureSession,
  type MarkdownAttachmentInputFile,
  type MarkdownAttachmentIntent,
  type MarkdownAttachmentItemIntent,
  type MarkdownAttachmentItemKind,
  type MarkdownAttachmentMarkdownKind,
  type MarkdownAttachmentMutationKind,
  type MarkdownAttachmentPresentationMutationKind,
  type MarkdownAttachmentProvider,
  type MarkdownAttachmentProviderRequest,
  type MarkdownAttachmentProviderResult,
  type MarkdownAttachmentProviderStatus,
  type MarkdownAttachmentQueryState,
  type MarkdownAttachmentRange,
  type MarkdownAttachmentSourceKind,
} from './markdown-editor-attachment'
export {
  cancelMarkdownAttachmentJob,
  createMarkdownAttachmentJob,
  evaluateMarkdownAttachmentLifecycleMutations,
  formatMarkdownAttachmentPendingSource,
  planMarkdownAttachmentInsert,
  planMarkdownAttachmentRemove,
  planMarkdownAttachmentResolve,
  progressMarkdownAttachmentJob,
  rebaseMarkdownAttachmentJob,
  retryMarkdownAttachmentJob,
  type MarkdownAttachmentJob,
  type MarkdownAttachmentLifecycleMutationKind,
  type MarkdownAttachmentPhase,
} from './markdown-editor-attachment-lifecycle'
export {
  decomposeMarkdownImageNode,
  evaluateMarkdownImagePropertyMutations,
  evaluateMarkdownPropertyMutations,
  planMarkdownImageAltChange,
  planMarkdownImageAltEdit,
  planMarkdownImageAttachmentReplace,
  planMarkdownImageDestinationEdit,
  planMarkdownImageRemove,
  planMarkdownImageTitleEdit,
  planMarkdownLinkUnwrap,
  validateMarkdownPropertyUrl,
  type DecomposedMarkdownImageNode,
  type DecomposedMarkdownImageSubrange,
  type MarkdownImagePropertyMutationKind,
} from './markdown-editor-link-image'
export {
  escapeCaptionText,
  evaluateMarkdownCaptionAcceptance,
  evaluateMarkdownCaptionAcceptanceMutations,
  findMarkdownFigures,
  formatMarkdownFigureExactCopy,
  formatMarkdownFigureVisibleCopy,
  planMarkdownCaptionEdit,
  planMarkdownCaptionInsert,
  planMarkdownCaptionRemove,
  planMarkdownFigureCut,
  planMarkdownFigureDelete,
  planMarkdownFigureMove,
  type MarkdownCaptionAcceptanceMutationKind,
  type MarkdownCaptionAcceptanceReport,
  type MarkdownFigure,
} from './markdown-editor-caption'

import type {
  MarkdownEditorFocusExemptions,
  MarkdownEditorWritingAidsOptions,
} from './markdown-editor-writing-aids'
import type {
  MarkdownEditorHistoryState,
  MarkdownEditorDocumentIdentity,
  MarkdownEditorPositionMap,
  MarkdownEditorSelection,
  MarkdownEditorSelectionEvent,
  MarkdownEditorTransaction,
  MarkdownEditorTransactionDispatcher,
  MarkdownEditorTransactionEvent,
} from './markdown-editor-transaction'

export type {
  BeforeInputSnapshot,
  MarkdownEditorChange,
  MarkdownEditorDispatchResult,
  MarkdownEditorDocumentIdentity,
  MarkdownEditorHistoryMode,
  MarkdownEditorHistoryState,
  MarkdownEditorPositionMap,
  MarkdownEditorResolvedSelection,
  MarkdownEditorSelection,
  MarkdownEditorSelectionDirection,
  MarkdownEditorSelectionEvent,
  MarkdownEditorTransaction,
  MarkdownEditorTransactionDispatcher,
  MarkdownEditorTransactionEvent,
  MarkdownEditorTransactionOrigin,
  MarkdownEditorTransactionRejection,
} from './markdown-editor-transaction'
export type {
  MarkdownEmbedProvider,
  MarkdownEmbedProviderStatus,
  MarkdownEmbedRequest,
  MarkdownEmbedResult,
} from '@fsusui/wasm/markdown-embed-provider'

import { type MarkdownEditorMode } from './markdown-editor-live-contract'

export {
  evaluateMarkdownLiveCapabilityMutations,
  markdownEditorModes,
  markdownLiveCapabilities,
  markdownLiveCapabilityKey,
  readMarkdownLiveCapability,
  resolveMarkdownLiveCapability,
  type MarkdownEditorMode,
  type MarkdownLiveCapability,
  type MarkdownLiveCapabilityMutationKind,
  type MarkdownLiveCapabilityResult,
} from './markdown-editor-live-contract'
export {
  MARKDOWN_LIVE_SURFACE_OWNER,
  createMarkdownLiveSurface,
  evaluateMarkdownLiveSurfaceMutations,
  resolveMarkdownLiveSurface,
  type MarkdownLiveDecoration,
  type MarkdownLiveDecorationRole,
  type MarkdownLiveSurfaceMutationKind,
  type MarkdownLiveSurfaceOwner,
  type MarkdownLiveSurfacePlan,
} from './markdown-editor-live-surface'
export {
  MARKDOWN_LIVE_REVEAL_STATES,
  evaluateMarkdownLiveRevealMutations,
  resolveMarkdownLiveSyntaxReveal,
  type MarkdownLiveRevealField,
  type MarkdownLiveRevealIntent,
  type MarkdownLiveRevealMutationKind,
  type MarkdownLiveRevealPlan,
  type MarkdownLiveRevealRange,
  type MarkdownLiveRevealRangeRole,
  type MarkdownLiveRevealState,
  type MarkdownLiveRevealTarget,
} from './markdown-editor-live-reveal'
export {
  MARKDOWN_LATEX_BUDGET,
  classifyMarkdownLatexBody,
  commitMarkdownLatexPreview,
  evaluateMarkdownLatexMutations,
  planMarkdownLatexPreview,
  type MarkdownLatexClassification,
  type MarkdownLatexDisplay,
  type MarkdownLatexMutationKind,
  type MarkdownLatexPresentation,
  type MarkdownLatexPreviewAction,
  type MarkdownLatexPreviewPlan,
  type MarkdownLatexVerdict,
} from './markdown-editor-latex'
export {
  MARKDOWN_MERMAID_BUDGET,
  classifyMarkdownMermaidBody,
  commitMarkdownMermaidPreview,
  evaluateMarkdownMermaidMutations,
  planMarkdownMermaidPreview,
  type MarkdownMermaidClassification,
  type MarkdownMermaidMutationKind,
  type MarkdownMermaidPresentation,
  type MarkdownMermaidPreviewAction,
  type MarkdownMermaidPreviewPlan,
  type MarkdownMermaidVerdict,
} from './markdown-editor-mermaid'
export {
  applyMarkdownCodeLanguageChange,
  evaluateMarkdownCodeMutations,
  insertMarkdownCodeFence,
  resolveMarkdownCodeCopy,
  resolveMarkdownCodeInput,
  resolveMarkdownCodeLanguage,
  resolveMarkdownCodePresentation,
  resolveMarkdownCodeSession,
  type MarkdownCodeFenceChar,
  type MarkdownCodeFencePlan,
  type MarkdownCodeInputKey,
  type MarkdownCodeLanguageChangePlan,
  type MarkdownCodeLanguagePlan,
  type MarkdownCodeMutationKind,
  type MarkdownCodePresentation,
  type MarkdownCodePresentationPlan,
} from './markdown-editor-code'
export {
  MARKDOWN_TECHNICAL_ACCEPTANCE_MODES,
  MARKDOWN_TECHNICAL_ACCEPTANCE_SCALES,
  MARKDOWN_TECHNICAL_ACCEPTANCE_VERSION,
  evaluateMarkdownTechnicalAcceptance,
  evaluateMarkdownTechnicalAcceptanceMutations,
  type MarkdownTechnicalAcceptanceLeftover,
  type MarkdownTechnicalAcceptanceMutationKind,
  type MarkdownTechnicalAcceptanceReport,
} from './markdown-editor-technical-acceptance'
export {
  MARKDOWN_TECHNICAL_NODE_KINDS,
  MARKDOWN_TECHNICAL_STATES,
  commitMarkdownTechnicalFeatureResult,
  createMarkdownTechnicalFeatureRequest,
  evaluateMarkdownTechnicalMutations,
  resolveMarkdownTechnicalAtomic,
  resolveMarkdownTechnicalDiagnostic,
  resolveMarkdownTechnicalHeight,
  resolveMarkdownTechnicalNode,
  type MarkdownTechnicalDiagnostic,
  type MarkdownTechnicalFeatureCommit,
  type MarkdownTechnicalFeatureKind,
  type MarkdownTechnicalFeatureOutput,
  type MarkdownTechnicalFeatureRequest,
  type MarkdownTechnicalMappedRange,
  type MarkdownTechnicalMutationKind,
  type MarkdownTechnicalNodeKind,
  type MarkdownTechnicalNodePlan,
  type MarkdownTechnicalNodeState,
  type MarkdownTechnicalRanges,
} from './markdown-editor-technical'
export {
  MARKDOWN_LIVE_LAYOUT_BUDGET,
  MARKDOWN_LIVE_LAYOUT_GESTURES,
  MARKDOWN_LIVE_LAYOUT_TRIGGERS,
  captureMarkdownLiveLayoutAnchor,
  commitMarkdownLiveFeatureResult,
  evaluateMarkdownLiveLayoutMutations,
  resolveMarkdownLiveLayoutStability,
  resolveMarkdownLiveVirtualWindow,
  retainMarkdownLiveLayoutAcrossModes,
  type MarkdownLiveFeatureCommit,
  type MarkdownLiveLayoutAction,
  type MarkdownLiveLayoutAnchor,
  type MarkdownLiveLayoutGesture,
  type MarkdownLiveLayoutMutationKind,
  type MarkdownLiveLayoutOrigin,
  type MarkdownLiveLayoutPlan,
  type MarkdownLiveLayoutTrigger,
  type MarkdownLiveVirtualWindow,
} from './markdown-editor-live-layout'
export {
  MARKDOWN_ATOMIC_NODE_KINDS,
  MARKDOWN_LIVE_SELECTION_MOTIONS,
  createMarkdownLiveAnchorMap,
  evaluateMarkdownLiveSelectionMutations,
  resolveMarkdownAtomicNodeIntent,
  resolveMarkdownLiveSelectionMotion,
  retainMarkdownLiveSelection,
  roundTripMarkdownLiveSelection,
  type MarkdownAtomicAccessibility,
  type MarkdownAtomicNodeAction,
  type MarkdownAtomicNodeKind,
  type MarkdownAtomicNodePhase,
  type MarkdownAtomicNodePlan,
  type MarkdownAtomicNodeSession,
  type MarkdownAtomicNodeStatus,
  type MarkdownLiveSelectionMotion,
  type MarkdownLiveSelectionMutationKind,
  type MarkdownLiveSelectionPlan,
} from './markdown-editor-live-selection'
export {
  MARKDOWN_BLOCK_INPUT_CONTEXTS,
  MARKDOWN_BLOCK_INPUT_KEYS,
  MARKDOWN_BLOCK_INPUT_POSITIONS,
  evaluateMarkdownBlockInputMutations,
  markdownBlockInputActionFor,
  resolveMarkdownBlockInputContext,
  resolveMarkdownBlockInputIntent,
  type MarkdownBlockInputAction,
  type MarkdownBlockInputContextKind,
  type MarkdownBlockInputIntent,
  type MarkdownBlockInputKey,
  type MarkdownBlockInputMutationKind,
  type MarkdownBlockInputMutationResult,
  type MarkdownBlockInputPlan,
  type MarkdownBlockInputPosition,
  type MarkdownBlockInputRejection,
  type MarkdownTableInputHook,
} from './markdown-editor-input-intent'
export {
  MARKDOWN_PAIR_DEFAULTS,
  evaluateMarkdownPairInputMutations,
  resolveMarkdownPairInput,
  type MarkdownPairAction,
  type MarkdownPairInputPlan,
  type MarkdownPairMutationKind,
  type MarkdownPairRejection,
} from './markdown-editor-pair-input'
export {
  MARKDOWN_CLIPBOARD_MAX_PASTE_UNITS,
  MARKDOWN_CLIPBOARD_PASTE_PRIORITY,
  evaluateMarkdownClipboardMutations,
  htmlToSafePlainText,
  markdownClipboardItemsFromDataTransfer,
  resolveMarkdownClipboardCopy,
  resolveMarkdownClipboardCut,
  resolveMarkdownClipboardPaste,
  visibleTextFromMarkdownSource,
  writeMarkdownClipboardPayload,
  type MarkdownAttachmentClipboardIntent,
  type MarkdownClipboardCopyKind,
  type MarkdownClipboardCopyPlan,
  type MarkdownClipboardCutPlan,
  type MarkdownClipboardFileRef,
  type MarkdownClipboardItem,
  type MarkdownClipboardMutationKind,
  type MarkdownClipboardOrigin,
  type MarkdownClipboardPasteKind,
  type MarkdownClipboardPastePlan,
  type MarkdownClipboardPayload,
  type MarkdownClipboardRejection,
  type MarkdownClipboardTransfer,
} from './markdown-editor-clipboard'
export {
  MARKDOWN_NATIVE_SYNTHETIC_BROWSERS,
  MARKDOWN_NATIVE_TRACE_LIMIT,
  createMarkdownEditorNativeEventMachine,
  driveMarkdownNativeHarnessTrace,
  evaluateMarkdownNativeEventMutations,
  markdownNativeEventIdentity,
  markdownNativeSyntheticCompositionScript,
  type MarkdownEditorNativeEventMachine,
  type MarkdownNativeAction,
  type MarkdownNativeEventInput,
  type MarkdownNativeEventKind,
  type MarkdownNativeEventPlan,
  type MarkdownNativeHarnessResult,
  type MarkdownNativeMutationKind,
  type MarkdownNativePhase,
  type MarkdownNativeRejection,
  type MarkdownNativeSyntheticBrowser,
  type MarkdownNativeTraceEntry,
} from './markdown-editor-native-event'
export {
  evaluateMarkdownEditorChromeMutations,
  resolveMarkdownEditorChromeRegions,
} from './markdown-editor-chrome'
export {
  createMarkdownOutlineModel,
  createMarkdownOutlineTree,
  evaluateMarkdownOutlineMutations,
  evaluateMarkdownOutlineRevealMutations,
  resolveMarkdownEditorOutline,
  revealHeading,
  revealSourceRange,
  type MarkdownEditorOutlineItem,
  type MarkdownEditorOutlineRange,
  type MarkdownEditorRevealOptions,
  type MarkdownEditorRevealResult,
  type MarkdownOutlineDiagnostic,
  type MarkdownOutlineMutationKind,
  type MarkdownOutlineRevealMutationKind,
  type MarkdownOutlineTreeNode,
} from './markdown-editor-outline'
export {
  commitMarkdownOutlineActive,
  evaluateMarkdownOutlineActiveMutations,
  headingAtSourceOffset,
  headingIndexAtSourceOffset,
  planMarkdownOutlineReveal,
  resolveMarkdownActiveHeading,
  resolveMarkdownOutlineActive,
  resolveMarkdownOutlineNavigationOwner,
  type MarkdownOutlineActiveCause,
  type MarkdownOutlineActiveInput,
  type MarkdownOutlineActiveMutationKind,
  type MarkdownOutlineActiveResult,
  type MarkdownOutlineNavigationOwner,
  type MarkdownOutlineRevealPlan,
  type MarkdownOutlineRevealPlanOptions,
  type MarkdownOutlineViewport,
} from './markdown-editor-outline-active'
export {
  calculateTypewriterScrollTarget,
  createWritingAidsController,
  createMarkdownFocusSegments,
  evaluateMarkdownFocusMutations,
  evaluateMarkdownTypewriterMutations,
  resolveFocusState,
  resolveWritingAids,
  type MarkdownEditorFocusBlock,
  type MarkdownEditorFocusExemptions,
  type MarkdownEditorFocusInput,
  type MarkdownEditorFocusRange,
  type MarkdownEditorFocusSegment,
  type MarkdownEditorFocusState,
  type MarkdownEditorResolvedWritingAids,
  type MarkdownEditorTypewriterAnchor,
  type MarkdownEditorTypewriterScrollInput,
  type MarkdownEditorTypewriterScrollResult,
  type MarkdownEditorWritingAidsController,
  type MarkdownEditorWritingAidsOptions,
  type MarkdownEditorWritingAidsState,
  type MarkdownEditorWritingAidsSuspendReason,
  type MarkdownFocusMutationKind,
  type MarkdownTypewriterMutationKind,
} from './markdown-editor-writing-aids'
export {
  collectMarkdownEmbedNodes,
  commitMarkdownEmbedHeightChange,
  evaluateMarkdownEmbedUiMutations,
  formatMarkdownEmbedDirective,
  parseMarkdownEmbedLine,
  planMarkdownEmbedEdit,
  planMarkdownEmbedInsert,
  planMarkdownEmbedPresentation,
  planMarkdownEmbedRemove,
  presentMarkdownEmbed,
  resolveMarkdownEmbedAtomic,
  runMarkdownEmbedAction,
  runMarkdownEmbedEdit,
  runMarkdownEmbedInsert,
  runMarkdownEmbedRemove,
  type MarkdownEmbedActionKind,
  type MarkdownEmbedActionResult,
  type MarkdownEmbedPresentationPlan,
  type MarkdownEmbedPresentationStatus,
  type MarkdownEmbedUiMutationKind,
} from './markdown-editor-embed'
export {
  dispatchMarkdownSearchKeydown,
  evaluateMarkdownSearchUiMutations,
  executeMarkdownSearchSession,
  resolveMarkdownSearchHighlights,
  resolveMarkdownSearchNavigation,
  resolveMarkdownSearchUi,
  revealMarkdownSearchMatch,
  type MarkdownSearchHighlightItem,
  type MarkdownSearchHighlightResult,
  type MarkdownSearchKeyAction,
  type MarkdownSearchNavigationResult,
  type MarkdownSearchRevealResult,
  type MarkdownSearchRevealStatus,
  type MarkdownSearchUiAria,
  type MarkdownSearchUiOptions,
  type MarkdownSearchUiState,
} from './markdown-editor-search-ui'
export {
  MARKDOWN_INPUT_ACCEPTANCE_CONTEXTS,
  MARKDOWN_INPUT_ACCEPTANCE_MODES,
  MARKDOWN_INPUT_ACCEPTANCE_SELECTIONS,
  MARKDOWN_INPUT_ACCEPTANCE_UNICODE,
  MARKDOWN_INPUT_ACCEPTANCE_VERSION,
  evaluateMarkdownInputAcceptance,
  evaluateMarkdownInputAcceptanceMutations,
  type MarkdownInputAcceptanceContextCell,
  type MarkdownInputAcceptanceMutationKind,
  type MarkdownInputAcceptanceReport,
} from './markdown-editor-input-acceptance'
export type MarkdownEditorChrome = 'framed' | 'embedded' | 'minimal'
export const markdownEditorChromes = ['framed', 'embedded', 'minimal'] as const
export type MarkdownEditorMobileLayout = 'auto' | 'compact' | 'standard'
export type MarkdownEditorProfile = 'markdown' | 'prose'
export type MarkdownEditorInteractionProfile = 'auto' | 'touch' | 'keyboard'
export type MarkdownEditorToolbarDensity = 'minimal' | 'standard' | 'full'
export type MarkdownEditorSurface =
  | 'toolbar'
  | 'selection-toolbar'
  | 'command-palette'
  | 'slash-menu'

/** Opt-in command surfaces share the same command registry and context. */
export interface MarkdownEditorSurfaceOptions {
  readonly commandPalette?: boolean
  readonly selectionToolbar?: boolean
  readonly slashMenu?: boolean
  readonly toolbar?: boolean
}

export type MarkdownEditorStatusDensity = 'none' | 'minimal' | 'detailed'

export {
  calculateMarkdownEditorMetrics,
  createMarkdownEditorMetricsSession,
  evaluateMarkdownEditorMetricsMutations,
  type MarkdownEditorMetrics,
  type MarkdownEditorMetricsChange,
  type MarkdownEditorMetricsOptions,
  type MarkdownEditorMetricsSelection,
} from './markdown-editor-metrics'

export const resolveMarkdownEditorToolbarLimit = (
  density: MarkdownEditorToolbarDensity,
  commandCount: number,
): number => {
  if (density === 'minimal') return Math.min(2, commandCount)
  if (density === 'full') return commandCount
  return Math.min(6, commandCount)
}

const sortMarkdownEditorCommands = <
  T extends {
    readonly group?: string
    readonly key: string
    readonly priority?: number
  },
>(
  commands: readonly T[],
) =>
  [...commands].sort(
    (left, right) =>
      (right.priority ?? 0) - (left.priority ?? 0) ||
      (left.group ?? '').localeCompare(right.group ?? '') ||
      left.key.localeCompare(right.key),
  )

export const resolveMarkdownEditorPrimaryCommands = <
  T extends {
    readonly group?: string
    readonly key: string
    readonly priority?: number
  },
>(
  commands: readonly T[],
  density: MarkdownEditorToolbarDensity,
  primaryKeys?: readonly string[],
): T[] => {
  const keySet = primaryKeys?.length ? new Set(primaryKeys) : null
  const selected = keySet
    ? sortMarkdownEditorCommands(
        commands.filter((command) => keySet.has(command.key)),
      )
    : sortMarkdownEditorCommands(commands)
  return selected.slice(
    0,
    resolveMarkdownEditorToolbarLimit(density, selected.length),
  )
}

export const resolveMarkdownEditorOverflowCommands = <
  T extends {
    readonly group?: string
    readonly key: string
    readonly priority?: number
  },
>(
  commands: readonly T[],
  density: MarkdownEditorToolbarDensity,
  primaryKeys?: readonly string[],
): T[] => {
  const keySet = primaryKeys?.length ? new Set(primaryKeys) : null
  if (keySet) {
    return sortMarkdownEditorCommands(
      commands.filter((command) => !keySet.has(command.key)),
    )
  }
  return sortMarkdownEditorCommands(commands).slice(
    resolveMarkdownEditorToolbarLimit(density, commands.length),
  )
}

export type MarkdownEditorActionKey = 'image' | 'save' | 'submit'

export interface MarkdownEditorActionItem {
  key: MarkdownEditorActionKey
  label: string
}

export interface MarkdownEditorCommandResult {
  readonly focus?: 'editor' | 'surface' | 'none'
  readonly surface?: 'anchor-properties' | 'link-properties'
  readonly transaction?: MarkdownEditorTransaction
}

export type MarkdownEditorCommandLifecycleState =
  | 'idle'
  | 'pending'
  | 'resolved-current'
  | 'rejected'
  | 'aborted'
  | 'stale'
  | 'deleted'

export type MarkdownEditorCommandIcon =
  | 'bold'
  | 'code'
  | 'heading'
  | 'image'
  | 'italic'
  | 'link'
  | 'quote'

export type MarkdownEditorCommandPresentation =
  | 'toolbar'
  | 'selection'
  | 'slash'
  | 'palette'

/**
 * All editor-owned copy is collected here so consumers can replace it without
 * duplicating command, mode, or status semantics. A partial value is merged
 * with this source; missing entries always fall back to the same locale.
 */
export interface MarkdownEditorTableLocaleText {
  readonly menuLabel: string
  readonly actions: Readonly<{
    'insert-row-above': string
    'insert-row-below': string
    'move-row-up': string
    'move-row-down': string
    'delete-row': string
    'insert-col-left': string
    'insert-col-right': string
    'move-col-left': string
    'move-col-right': string
    'delete-col': string
    'align-left': string
    'align-left-title': string
    'align-center': string
    'align-center-title': string
    'align-right': string
    'align-right-title': string
    'format-table': string
  }>
}

export interface MarkdownEditorLocaleText {
  readonly modes: Readonly<Record<MarkdownEditorMode, string>>
  readonly commands: Readonly<Record<MarkdownEditorCommandIcon, string>>
  readonly actions: Readonly<Record<MarkdownEditorActionKey, string>>
  readonly pasteAsMarkdown: Readonly<{
    cancel: string
    clipboardFailed: string
    clipboardUnavailable: string
    conversionWarnings: string
    description: string
    disabledDescriptions: Readonly<{
      composition: string
      disabled: string
      loading: string
      previewOnly: string
      readonly: string
    }>
    importMarkdown: string
    markdownPreview: string
    pastePlainText: string
    sourceAfter: string
    sourceBefore: string
    sourceDiff: string
    stale: string
    title: string
  }>
  readonly commandPalette: Readonly<{
    empty: string
    results: (count: number) => string
    searchPlaceholder: string
    title: string
  }>
  readonly search: Readonly<{
    close: string
    find: string
    findAndReplaceAria: string
    findAria: string
    matchCase: string
    nextMatch: string
    noMatches: string
    previousMatch: string
    replace: string
    replaceAll: string
    replaceWithAria: string
    results: (current: number, total: number) => string
    toggleReplace: string
    truncatedResults: (count: number) => string
    useRegex: string
    wholeWord: string
  }>
  readonly attachments: Readonly<{
    actions: Readonly<Record<'cancel' | 'remove' | 'retry', string>>
    region: string
    unnamed: string
    uploading: (name: string) => string
    status: (name: string, status: string, percent: number) => string
  }>
  readonly imageProperties: Readonly<{
    alt: string
    apply: string
    caption: string
    copySource: string
    copyVisible: string
    destination: string
    destinationRejected: (code: string) => string
    open: string
    region: string
    removeCaption: string
    removeImage: string
    replace: string
    source: string
    title: string
    updateRejected: (code: string) => string
  }>
  readonly embeds: Readonly<{
    actions: Readonly<
      Record<
        | 'source-reveal'
        | 'open-source'
        | 'retry'
        | 'copy'
        | 'caret-before'
        | 'caret-after'
        | 'select-node'
        | 'delete',
        string
      >
    >
    modes: Readonly<Record<'article' | 'heading' | 'block', string>>
    name: (target: string, mode: string) => string
    region: string
    statuses: Readonly<
      Record<
        | 'idle'
        | 'pending'
        | 'resolved'
        | 'rejected'
        | 'error'
        | 'missing'
        | 'forbidden'
        | 'cycle'
        | 'depth-exceeded'
        | 'size-exceeded'
        | 'time-exceeded'
        | 'mode-mismatch'
        | 'stale',
        string
      >
    >
  }>
  readonly atomic: Readonly<{
    actionsRegion: (kind: string) => string
    editSource: (kind: string) => string
    enterAfter: (kind: string) => string
    enterBefore: (kind: string) => string
  }>
  readonly contextual: Readonly<{
    anchorId: string
    apply: string
    cancel: string
    copy: string
    destination: string
    editAnchor: string
    editLink: string
    invalidAnchor: string
    insertAnchor: string
    label: string
    open: string
    removeAnchor: string
    removeLink: string
    sourceReveal: string
    title: string
    unsafeUrl: string
  }>
  readonly commandGroups: Readonly<
    Partial<Record<'block' | 'format' | 'insert', string>> & {
      readonly [key: string]: string | undefined
    }
  >
  readonly surfaces: Readonly<{
    selectionToolbar: string
    slashMenu: string
    commandPending: string
    commandRejected: string
  }>
  readonly textarea: Readonly<{
    live: string
    source: string
  }>
  readonly states: Readonly<{
    disabled: string
    empty: string
    loading: string
    readonly: string
  }>
  readonly results: Readonly<
    Record<
      | 'pending'
      | 'resolved-current'
      | 'rejected'
      | 'aborted'
      | 'stale'
      | 'deleted',
      string
    >
  >
  readonly capabilities: Readonly<
    Record<
      | 'supported'
      | 'unsupported-platform'
      | 'runtime-unavailable'
      | 'projection-failed'
      | 'feature-degraded'
      | 'fatal',
      string
    >
  >
  readonly capabilityAnnouncement: (capability: string) => string
  readonly overflow: string
  readonly overflowAria: (count: number) => string
  readonly editorAria: string
  readonly modeSwitcherAria: string
  readonly metrics: Readonly<{
    bytes: string
    characters: string
    column: string
    line: string
    lines: string
    selected: string
    words: string
  }>
  readonly table: MarkdownEditorTableLocaleText
}

type MarkdownEditorLocaleDeepPartial<T> = T extends (
  ...args: infer _Args
) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]?: MarkdownEditorLocaleDeepPartial<T[K]> }
    : T

export type MarkdownEditorLocaleTextOverride =
  MarkdownEditorLocaleDeepPartial<MarkdownEditorLocaleText>

const isLocaleRecord = (
  value: unknown,
): value is Record<string, string | string[] | TranslatePair | undefined> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const readLocaleSection = (
  source: unknown,
  key: string,
): Record<string, string | string[] | TranslatePair | undefined> | undefined => {
  if (!isLocaleRecord(source)) return undefined
  const child = source[key]
  return isLocaleRecord(child) ? child : undefined
}

const readLocaleString = (
  source: unknown,
  key: string,
  fallback: string,
): string => {
  if (!isLocaleRecord(source)) return fallback
  const value = source[key]
  return typeof value === 'string' ? value : fallback
}

const formatLocaleTemplate = (
  template: string,
  params: Readonly<Record<string, string | number>>,
): string =>
  template.replace(/\{(\w+)\}/g, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(params, token)
      ? String(params[token])
      : match,
  )

const readLocaleRecordStrings = <T extends Readonly<Record<string, string>>>(
  source: unknown,
  fallback: T,
): T => {
  const result: Record<string, string> = {}
  for (const key of Object.keys(fallback)) {
    result[key] = readLocaleString(source, key, fallback[key]!)
  }
  return Object.freeze(result) as T
}

export const resolveMarkdownEditorLocaleFromLanguage = (
  language?: Language,
): MarkdownEditorLocaleText => {
  const fallbackRoot = English.el.markdownEditor
  const root = readLocaleSection(language?.el, 'markdownEditor')
  const pasteRoot = readLocaleSection(root, 'pasteAsMarkdown')
  const paletteRoot = readLocaleSection(root, 'commandPalette')
  const searchRoot = readLocaleSection(root, 'search')
  const attachmentsRoot = readLocaleSection(root, 'attachments')
  const imagePropsRoot = readLocaleSection(root, 'imageProperties')
  const embedsRoot = readLocaleSection(root, 'embeds')
  const atomicRoot = readLocaleSection(root, 'atomic')
  const commandGroupsRoot = readLocaleSection(root, 'commandGroups')
  const tableRoot = readLocaleSection(root, 'table')

  const paletteResultsTpl = readLocaleString(
    paletteRoot,
    'results',
    fallbackRoot.commandPalette.results,
  )
  const searchResultsTpl = readLocaleString(
    searchRoot,
    'results',
    fallbackRoot.search.results,
  )
  const searchTruncatedTpl = readLocaleString(
    searchRoot,
    'truncatedResults',
    fallbackRoot.search.truncatedResults,
  )
  const attachmentUploadingTpl = readLocaleString(
    attachmentsRoot,
    'uploading',
    fallbackRoot.attachments.uploading,
  )
  const attachmentResolvedTpl = readLocaleString(
    attachmentsRoot,
    'statusResolved',
    fallbackRoot.attachments.statusResolved,
  )
  const attachmentRejectedTpl = readLocaleString(
    attachmentsRoot,
    'statusRejected',
    fallbackRoot.attachments.statusRejected,
  )
  const attachmentCancelledTpl = readLocaleString(
    attachmentsRoot,
    'statusCancelled',
    fallbackRoot.attachments.statusCancelled,
  )
  const attachmentProgressTpl = readLocaleString(
    attachmentsRoot,
    'statusUploading',
    fallbackRoot.attachments.statusUploading,
  )
  const imageDestinationRejectedTpl = readLocaleString(
    imagePropsRoot,
    'destinationRejected',
    fallbackRoot.imageProperties.destinationRejected,
  )
  const imageUpdateRejectedTpl = readLocaleString(
    imagePropsRoot,
    'updateRejected',
    fallbackRoot.imageProperties.updateRejected,
  )
  const embedNameTpl = readLocaleString(
    embedsRoot,
    'name',
    fallbackRoot.embeds.name,
  )
  const atomicActionsRegionTpl = readLocaleString(
    atomicRoot,
    'actionsRegion',
    fallbackRoot.atomic.actionsRegion,
  )
  const atomicEditSourceTpl = readLocaleString(
    atomicRoot,
    'editSource',
    fallbackRoot.atomic.editSource,
  )
  const atomicEnterAfterTpl = readLocaleString(
    atomicRoot,
    'enterAfter',
    fallbackRoot.atomic.enterAfter,
  )
  const atomicEnterBeforeTpl = readLocaleString(
    atomicRoot,
    'enterBefore',
    fallbackRoot.atomic.enterBefore,
  )
  const capabilityAnnouncementTpl = readLocaleString(
    root,
    'capabilityAnnouncement',
    fallbackRoot.capabilityAnnouncement,
  )
  const overflowAriaTpl = readLocaleString(
    root,
    'overflowAria',
    fallbackRoot.overflowAria,
  )

  const commandGroups: Record<string, string | undefined> = {
    block: readLocaleString(
      commandGroupsRoot,
      'block',
      fallbackRoot.commandGroups.block,
    ),
    format: readLocaleString(
      commandGroupsRoot,
      'format',
      fallbackRoot.commandGroups.format,
    ),
    insert: readLocaleString(
      commandGroupsRoot,
      'insert',
      fallbackRoot.commandGroups.insert,
    ),
  }
  if (commandGroupsRoot) {
    for (const [key, value] of Object.entries(commandGroupsRoot)) {
      if (typeof value === 'string') {
        commandGroups[key] = value
      }
    }
  }

  return Object.freeze({
    modes: readLocaleRecordStrings(
      readLocaleSection(root, 'modes'),
      fallbackRoot.modes,
    ),
    commands: readLocaleRecordStrings(
      readLocaleSection(root, 'commands'),
      fallbackRoot.commands,
    ),
    actions: readLocaleRecordStrings(
      readLocaleSection(root, 'actions'),
      fallbackRoot.actions,
    ),
    pasteAsMarkdown: Object.freeze({
      cancel: readLocaleString(
        pasteRoot,
        'cancel',
        fallbackRoot.pasteAsMarkdown.cancel,
      ),
      clipboardFailed: readLocaleString(
        pasteRoot,
        'clipboardFailed',
        fallbackRoot.pasteAsMarkdown.clipboardFailed,
      ),
      clipboardUnavailable: readLocaleString(
        pasteRoot,
        'clipboardUnavailable',
        fallbackRoot.pasteAsMarkdown.clipboardUnavailable,
      ),
      conversionWarnings: readLocaleString(
        pasteRoot,
        'conversionWarnings',
        fallbackRoot.pasteAsMarkdown.conversionWarnings,
      ),
      description: readLocaleString(
        pasteRoot,
        'description',
        fallbackRoot.pasteAsMarkdown.description,
      ),
      disabledDescriptions: readLocaleRecordStrings(
        readLocaleSection(pasteRoot, 'disabledDescriptions'),
        fallbackRoot.pasteAsMarkdown.disabledDescriptions,
      ),
      importMarkdown: readLocaleString(
        pasteRoot,
        'importMarkdown',
        fallbackRoot.pasteAsMarkdown.importMarkdown,
      ),
      markdownPreview: readLocaleString(
        pasteRoot,
        'markdownPreview',
        fallbackRoot.pasteAsMarkdown.markdownPreview,
      ),
      pastePlainText: readLocaleString(
        pasteRoot,
        'pastePlainText',
        fallbackRoot.pasteAsMarkdown.pastePlainText,
      ),
      sourceAfter: readLocaleString(
        pasteRoot,
        'sourceAfter',
        fallbackRoot.pasteAsMarkdown.sourceAfter,
      ),
      sourceBefore: readLocaleString(
        pasteRoot,
        'sourceBefore',
        fallbackRoot.pasteAsMarkdown.sourceBefore,
      ),
      sourceDiff: readLocaleString(
        pasteRoot,
        'sourceDiff',
        fallbackRoot.pasteAsMarkdown.sourceDiff,
      ),
      stale: readLocaleString(
        pasteRoot,
        'stale',
        fallbackRoot.pasteAsMarkdown.stale,
      ),
      title: readLocaleString(
        pasteRoot,
        'title',
        fallbackRoot.pasteAsMarkdown.title,
      ),
    }),
    commandPalette: Object.freeze({
      empty: readLocaleString(
        paletteRoot,
        'empty',
        fallbackRoot.commandPalette.empty,
      ),
      results: (count: number) =>
        formatLocaleTemplate(paletteResultsTpl, { count }),
      searchPlaceholder: readLocaleString(
        paletteRoot,
        'searchPlaceholder',
        fallbackRoot.commandPalette.searchPlaceholder,
      ),
      title: readLocaleString(
        paletteRoot,
        'title',
        fallbackRoot.commandPalette.title,
      ),
    }),
    search: Object.freeze({
      close: readLocaleString(searchRoot, 'close', fallbackRoot.search.close),
      find: readLocaleString(searchRoot, 'find', fallbackRoot.search.find),
      findAndReplaceAria: readLocaleString(
        searchRoot,
        'findAndReplaceAria',
        fallbackRoot.search.findAndReplaceAria,
      ),
      findAria: readLocaleString(
        searchRoot,
        'findAria',
        fallbackRoot.search.findAria,
      ),
      matchCase: readLocaleString(
        searchRoot,
        'matchCase',
        fallbackRoot.search.matchCase,
      ),
      nextMatch: readLocaleString(
        searchRoot,
        'nextMatch',
        fallbackRoot.search.nextMatch,
      ),
      noMatches: readLocaleString(
        searchRoot,
        'noMatches',
        fallbackRoot.search.noMatches,
      ),
      previousMatch: readLocaleString(
        searchRoot,
        'previousMatch',
        fallbackRoot.search.previousMatch,
      ),
      replace: readLocaleString(
        searchRoot,
        'replace',
        fallbackRoot.search.replace,
      ),
      replaceAll: readLocaleString(
        searchRoot,
        'replaceAll',
        fallbackRoot.search.replaceAll,
      ),
      replaceWithAria: readLocaleString(
        searchRoot,
        'replaceWithAria',
        fallbackRoot.search.replaceWithAria,
      ),
      results: (current: number, total: number) =>
        formatLocaleTemplate(searchResultsTpl, { current, total }),
      toggleReplace: readLocaleString(
        searchRoot,
        'toggleReplace',
        fallbackRoot.search.toggleReplace,
      ),
      truncatedResults: (count: number) =>
        formatLocaleTemplate(searchTruncatedTpl, {
          count: count.toLocaleString(),
        }),
      useRegex: readLocaleString(
        searchRoot,
        'useRegex',
        fallbackRoot.search.useRegex,
      ),
      wholeWord: readLocaleString(
        searchRoot,
        'wholeWord',
        fallbackRoot.search.wholeWord,
      ),
    }),
    attachments: Object.freeze({
      actions: readLocaleRecordStrings(
        readLocaleSection(attachmentsRoot, 'actions'),
        fallbackRoot.attachments.actions,
      ),
      region: readLocaleString(
        attachmentsRoot,
        'region',
        fallbackRoot.attachments.region,
      ),
      unnamed: readLocaleString(
        attachmentsRoot,
        'unnamed',
        fallbackRoot.attachments.unnamed,
      ),
      uploading: (name: string) =>
        formatLocaleTemplate(attachmentUploadingTpl, { name }),
      status: (name: string, status: string, percent: number) =>
        status === 'resolved'
          ? formatLocaleTemplate(attachmentResolvedTpl, { name, percent })
          : status === 'rejected'
            ? formatLocaleTemplate(attachmentRejectedTpl, { name, percent })
            : status === 'cancelled'
              ? formatLocaleTemplate(attachmentCancelledTpl, { name, percent })
              : formatLocaleTemplate(attachmentProgressTpl, { name, percent }),
    }),
    imageProperties: Object.freeze({
      alt: readLocaleString(
        imagePropsRoot,
        'alt',
        fallbackRoot.imageProperties.alt,
      ),
      apply: readLocaleString(
        imagePropsRoot,
        'apply',
        fallbackRoot.imageProperties.apply,
      ),
      caption: readLocaleString(
        imagePropsRoot,
        'caption',
        fallbackRoot.imageProperties.caption,
      ),
      copySource: readLocaleString(
        imagePropsRoot,
        'copySource',
        fallbackRoot.imageProperties.copySource,
      ),
      copyVisible: readLocaleString(
        imagePropsRoot,
        'copyVisible',
        fallbackRoot.imageProperties.copyVisible,
      ),
      destination: readLocaleString(
        imagePropsRoot,
        'destination',
        fallbackRoot.imageProperties.destination,
      ),
      destinationRejected: (code: string) =>
        formatLocaleTemplate(imageDestinationRejectedTpl, { code }),
      open: readLocaleString(
        imagePropsRoot,
        'open',
        fallbackRoot.imageProperties.open,
      ),
      region: readLocaleString(
        imagePropsRoot,
        'region',
        fallbackRoot.imageProperties.region,
      ),
      removeCaption: readLocaleString(
        imagePropsRoot,
        'removeCaption',
        fallbackRoot.imageProperties.removeCaption,
      ),
      removeImage: readLocaleString(
        imagePropsRoot,
        'removeImage',
        fallbackRoot.imageProperties.removeImage,
      ),
      replace: readLocaleString(
        imagePropsRoot,
        'replace',
        fallbackRoot.imageProperties.replace,
      ),
      source: readLocaleString(
        imagePropsRoot,
        'source',
        fallbackRoot.imageProperties.source,
      ),
      title: readLocaleString(
        imagePropsRoot,
        'title',
        fallbackRoot.imageProperties.title,
      ),
      updateRejected: (code: string) =>
        formatLocaleTemplate(imageUpdateRejectedTpl, { code }),
    }),
    embeds: Object.freeze({
      actions: readLocaleRecordStrings(
        readLocaleSection(embedsRoot, 'actions'),
        fallbackRoot.embeds.actions,
      ),
      modes: readLocaleRecordStrings(
        readLocaleSection(embedsRoot, 'modes'),
        fallbackRoot.embeds.modes,
      ),
      name: (target: string, mode: string) =>
        formatLocaleTemplate(embedNameTpl, { target, mode }),
      region: readLocaleString(embedsRoot, 'region', fallbackRoot.embeds.region),
      statuses: readLocaleRecordStrings(
        readLocaleSection(embedsRoot, 'statuses'),
        fallbackRoot.embeds.statuses,
      ),
    }),
    atomic: Object.freeze({
      actionsRegion: (kind: string) =>
        formatLocaleTemplate(atomicActionsRegionTpl, { kind }),
      editSource: (kind: string) =>
        formatLocaleTemplate(atomicEditSourceTpl, { kind }),
      enterAfter: (kind: string) =>
        formatLocaleTemplate(atomicEnterAfterTpl, { kind }),
      enterBefore: (kind: string) =>
        formatLocaleTemplate(atomicEnterBeforeTpl, { kind }),
    }),
    contextual: readLocaleRecordStrings(
      readLocaleSection(root, 'contextual'),
      fallbackRoot.contextual,
    ),
    commandGroups: Object.freeze(commandGroups),
    surfaces: readLocaleRecordStrings(
      readLocaleSection(root, 'surfaces'),
      fallbackRoot.surfaces,
    ),
    textarea: readLocaleRecordStrings(
      readLocaleSection(root, 'textarea'),
      fallbackRoot.textarea,
    ),
    states: readLocaleRecordStrings(
      readLocaleSection(root, 'states'),
      fallbackRoot.states,
    ),
    results: readLocaleRecordStrings(
      readLocaleSection(root, 'results'),
      fallbackRoot.results,
    ),
    capabilities: readLocaleRecordStrings(
      readLocaleSection(root, 'capabilities'),
      fallbackRoot.capabilities,
    ),
    capabilityAnnouncement: (capability: string) =>
      formatLocaleTemplate(capabilityAnnouncementTpl, { capability }),
    overflow: readLocaleString(root, 'overflow', fallbackRoot.overflow),
    overflowAria: (count: number) =>
      formatLocaleTemplate(overflowAriaTpl, { count }),
    editorAria: readLocaleString(root, 'editorAria', fallbackRoot.editorAria),
    modeSwitcherAria: readLocaleString(
      root,
      'modeSwitcherAria',
      fallbackRoot.modeSwitcherAria,
    ),
    metrics: readLocaleRecordStrings(
      readLocaleSection(root, 'metrics'),
      fallbackRoot.metrics,
    ),
    table: Object.freeze({
      menuLabel: readLocaleString(
        tableRoot,
        'menuLabel',
        fallbackRoot.table.menuLabel,
      ),
      actions: readLocaleRecordStrings(
        readLocaleSection(tableRoot, 'actions'),
        fallbackRoot.table.actions,
      ),
    }),
  })
}

export const defaultMarkdownEditorLocaleText: MarkdownEditorLocaleText =
  resolveMarkdownEditorLocaleFromLanguage(English)

export type MarkdownEditorLocaleMutationKind =
  | 'hardcoded-copy'
  | 'error-string-matching'
  | 'cross-language-fallback'
  | 'duplicate-labels'

export const resolveMarkdownEditorLocaleText = (
  localeText?: MarkdownEditorLocaleTextOverride,
  base: MarkdownEditorLocaleText = defaultMarkdownEditorLocaleText,
): MarkdownEditorLocaleText => ({
  ...base,
  ...localeText,
  actions: {
    ...base.actions,
    ...localeText?.actions,
  },
  commands: {
    ...base.commands,
    ...localeText?.commands,
  },
  metrics: {
    ...base.metrics,
    ...localeText?.metrics,
  },
  modes: {
    ...base.modes,
    ...localeText?.modes,
  },
  pasteAsMarkdown: {
    ...base.pasteAsMarkdown,
    ...localeText?.pasteAsMarkdown,
    disabledDescriptions: {
      ...base.pasteAsMarkdown.disabledDescriptions,
      ...localeText?.pasteAsMarkdown?.disabledDescriptions,
    },
  },
  commandPalette: {
    ...base.commandPalette,
    ...localeText?.commandPalette,
  },
  search: { ...base.search, ...localeText?.search },
  attachments: {
    ...base.attachments,
    ...localeText?.attachments,
    actions: {
      ...base.attachments.actions,
      ...localeText?.attachments?.actions,
    },
  },
  imageProperties: {
    ...base.imageProperties,
    ...localeText?.imageProperties,
  },
  embeds: {
    ...base.embeds,
    ...localeText?.embeds,
    actions: {
      ...base.embeds.actions,
      ...localeText?.embeds?.actions,
    },
    modes: {
      ...base.embeds.modes,
      ...localeText?.embeds?.modes,
    },
    statuses: {
      ...base.embeds.statuses,
      ...localeText?.embeds?.statuses,
    },
  },
  atomic: { ...base.atomic, ...localeText?.atomic },
  commandGroups: {
    ...base.commandGroups,
    ...localeText?.commandGroups,
  },
  contextual: {
    ...base.contextual,
    ...localeText?.contextual,
  },
  surfaces: {
    ...base.surfaces,
    ...localeText?.surfaces,
  },
  textarea: {
    ...base.textarea,
    ...localeText?.textarea,
  },
  states: {
    ...base.states,
    ...localeText?.states,
  },
  results: {
    ...base.results,
    ...localeText?.results,
  },
  capabilities: {
    ...base.capabilities,
    ...localeText?.capabilities,
  },
  table: {
    ...base.table,
    ...localeText?.table,
    actions: {
      ...base.table.actions,
      ...localeText?.table?.actions,
    },
  },
  capabilityAnnouncement:
    localeText?.capabilityAnnouncement ?? base.capabilityAnnouncement,
  overflowAria: localeText?.overflowAria ?? base.overflowAria,
})

export const resolveMarkdownEditorCommandCopy = (
  command: MarkdownEditorCommand,
  localeText: MarkdownEditorLocaleText,
) => {
  const editorOwnedCommand = defaultMarkdownEditorCommands.includes(command)
  const localized =
    command.key === 'paste-as-markdown'
      ? localeText.pasteAsMarkdown.title
      : command.key === 'link-properties'
        ? localeText.contextual.editLink
        : command.key === 'anchor-insert'
          ? localeText.contextual.insertAnchor
          : command.key === 'anchor-properties'
            ? localeText.contextual.editAnchor
            : editorOwnedCommand && command.icon
              ? localeText.commands[command.icon]
              : command.title || command.label
  return Object.freeze({
    label: localized,
    name: localized,
    description: command.description ?? localized,
  })
}

export const resolveMarkdownEditorCapabilityText = (
  capability: string,
  localeText: MarkdownEditorLocaleText,
) =>
  capability in localeText.capabilities
    ? localeText.capabilities[
        capability as keyof MarkdownEditorLocaleText['capabilities']
      ]
    : localeText.capabilities['feature-degraded']

export const evaluateMarkdownEditorLocaleMutations = () => {
  const override = resolveMarkdownEditorLocaleText({
    atomic: { editSource: (kind) => `EDIT-${kind}-L10N` },
    attachments: { region: 'ATTACHMENTS-L10N' },
    commands: { bold: 'BOLD-L10N' },
    contextual: { editLink: 'EDIT-LINK-L10N' },
    modes: { source: 'SOURCE-L10N' },
    search: { find: 'FIND-L10N' },
    results: {
      aborted: 'ABORTED-L10N',
      rejected: 'REJECTED-L10N',
    },
    surfaces: { slashMenu: 'SLASH-L10N' },
  })
  const command = defaultMarkdownEditorCommands[0]!
  const commandCopy = resolveMarkdownEditorCommandCopy(command, override)
  const stableRejected = override.results.rejected
  const errorStringMutation = /cancel/iu.test(
    'provider cancelled after returning an error',
  )
    ? override.results.aborted
    : override.results.rejected
  const duplicateLabelsMutation = Object.freeze({
    label: commandCopy.label,
    name: command.label,
  })

  return Object.freeze({
    authority: defaultMarkdownEditorLocaleText,
    mutations: Object.freeze([
      Object.freeze({
        kind: 'hardcoded-copy' as const,
        equivalent:
          override.modes.source ===
            defaultMarkdownEditorLocaleText.modes.source ||
          override.surfaces.slashMenu ===
            defaultMarkdownEditorLocaleText.surfaces.slashMenu ||
          override.contextual.editLink ===
            defaultMarkdownEditorLocaleText.contextual.editLink ||
          override.search.find ===
            defaultMarkdownEditorLocaleText.search.find ||
          override.attachments.region ===
            defaultMarkdownEditorLocaleText.attachments.region ||
          override.atomic.editSource('image') ===
            defaultMarkdownEditorLocaleText.atomic.editSource('image'),
        accepted: false,
      }),
      Object.freeze({
        kind: 'error-string-matching' as const,
        equivalent: errorStringMutation === stableRejected,
        accepted: false,
      }),
      Object.freeze({
        kind: 'cross-language-fallback' as const,
        equivalent:
          override.modes.preview !==
          defaultMarkdownEditorLocaleText.modes.preview,
        accepted: false,
      }),
      Object.freeze({
        kind: 'duplicate-labels' as const,
        equivalent:
          duplicateLabelsMutation.label === duplicateLabelsMutation.name,
        accepted: false,
      }),
    ]),
  })
}

/** Syntax is supplied by the editor projection, never derived by commands. */
export interface MarkdownEditorSyntaxContext {
  readonly blockIdentity: string
  readonly contentRanges: readonly Readonly<{ end: number; start: number }>[]
  readonly diagnosticCode: string | null
  readonly markerRanges: readonly Readonly<{ end: number; start: number }>[]
  readonly nodeId: string
  readonly range: Readonly<{ end: number; start: number }>
  readonly status: 'malformed' | 'valid'
  readonly type: string
}

export const resolveMarkdownEditorSyntaxContext = (
  projection: MarkdownStableProjection,
  selection: MarkdownEditorSelection,
): MarkdownEditorSyntaxContext | undefined => {
  const start = Math.min(selection.start, selection.end)
  const end = Math.max(selection.start, selection.end)
  const nodes = projection.nodes
    .filter((node) =>
      start === end
        ? node.rawRange.start <= start && node.rawRange.end >= end
        : node.rawRange.start <= start && node.rawRange.end >= end,
    )
    .sort((left, right) => {
      const span =
        left.rawRange.end -
        left.rawRange.start -
        (right.rawRange.end - right.rawRange.start)
      return span || left.id.localeCompare(right.id)
    })
  const node = nodes[0]
  if (!node) return undefined
  return Object.freeze({
    blockIdentity: node.blockIdentity,
    contentRanges: node.rawContentRanges,
    diagnosticCode: node.diagnosticCode,
    markerRanges: node.rawMarkerRanges,
    nodeId: node.id,
    range: node.rawRange,
    status: node.status,
    type: node.kind,
  })
}

export interface MarkdownEditorCommandContext {
  readonly dispatch: MarkdownEditorTransactionDispatcher
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly mode: MarkdownEditorMode
  readonly positionMap?: MarkdownEditorPositionMap
  readonly projection?: MarkdownStableProjection
  readonly readonly: boolean
  readonly revision: number
  readonly selection: MarkdownEditorSelection
  readonly signal: AbortSignal
  readonly syntax?: MarkdownEditorSyntaxContext
  readonly value: string
}

export interface MarkdownEditorCommand {
  readonly key: string
  readonly label: string
  readonly description?: string
  readonly group: string
  readonly icon?: MarkdownEditorCommandIcon
  readonly shortcut?: string
  readonly title?: string
  readonly concurrent?: boolean
  readonly keywords?: readonly string[]
  readonly priority?: number
  readonly presentation?: readonly MarkdownEditorCommandPresentation[]
  readonly when?: (context: MarkdownEditorCommandContext) => boolean
  readonly enabled?: (context: MarkdownEditorCommandContext) => boolean
  readonly disabledReason?: (
    context: MarkdownEditorCommandContext,
  ) => string | undefined
  readonly run: (
    context: MarkdownEditorCommandContext,
  ) => MarkdownEditorCommandResult | Promise<MarkdownEditorCommandResult>
}

export interface MarkdownEditorInsertOptions {
  readonly expectedRevision?: number
  readonly metadata?: Readonly<Record<string, unknown>>
  readonly selection?: MarkdownEditorSelection
}

const clampSelection = (
  value: string,
  selection: MarkdownEditorSelection,
): MarkdownEditorSelection => ({
  direction: selection.direction ?? 'none',
  end: Math.max(0, Math.min(value.length, selection.end)),
  start: Math.max(0, Math.min(value.length, selection.start)),
})

const replaceRange = (
  value: string,
  selection: MarkdownEditorSelection,
  replacement: string,
  selectStartOffset = 0,
  selectEndOffset = replacement.length,
): MarkdownEditorTransaction => {
  const range = clampSelection(value, selection)
  return {
    changes: [{ from: range.start, insert: replacement, to: range.end }],
    expectedRevision: undefined,
    history: 'separate',
    origin: 'command',
    selection: {
      direction:
        selectStartOffset === selectEndOffset ? 'none' : range.direction,
      start: range.start + selectStartOffset,
      end: range.start + selectEndOffset,
    },
  }
}

const wrapSelection = (
  value: string,
  selection: MarkdownEditorSelection,
  prefix: string,
  suffix = prefix,
  placeholder = '',
) => {
  const range = clampSelection(value, selection)
  const selected = value.slice(range.start, range.end) || placeholder
  return replaceRange(
    value,
    range,
    `${prefix}${selected}${suffix}`,
    prefix.length,
    prefix.length + selected.length,
  )
}

const prefixSelectedLines = (
  value: string,
  selection: MarkdownEditorSelection,
  prefix: string,
) => {
  const range = clampSelection(value, selection)
  const lineStart = value.lastIndexOf('\n', range.start - 1) + 1
  const lineEndIndex = value.indexOf('\n', range.end)
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex
  const block = value.slice(lineStart, lineEnd)
  const replacement = block
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
    .join('\n')
  return replaceRange(
    value,
    { direction: range.direction, start: lineStart, end: lineEnd },
    replacement,
    range.start - lineStart + prefix.length,
    range.end - lineStart + prefix.length,
  )
}

export const defaultMarkdownEditorCommands: readonly MarkdownEditorCommand[] = [
  {
    key: 'bold',
    label: 'bold',
    group: 'format',
    icon: 'bold',
    keywords: ['bold'],
    priority: 100,
    shortcut: 'Mod+B',
    when: () => true,
    enabled: () => true,
    run: (context) => ({
      transaction: wrapSelection(
        context.value,
        context.selection,
        '**',
        '**',
        'text',
      ),
    }),
  },
  {
    key: 'italic',
    label: 'italic',
    group: 'format',
    icon: 'italic',
    keywords: ['italic'],
    priority: 90,
    shortcut: 'Mod+I',
    when: () => true,
    enabled: () => true,
    run: (context) => ({
      transaction: wrapSelection(
        context.value,
        context.selection,
        '*',
        '*',
        'text',
      ),
    }),
  },
  {
    key: 'heading',
    label: 'heading',
    group: 'block',
    icon: 'heading',
    keywords: ['heading'],
    priority: 80,
    shortcut: 'Mod+Alt+H',
    when: () => true,
    enabled: () => true,
    run: (context) => ({
      transaction: prefixSelectedLines(context.value, context.selection, '## '),
    }),
  },
  {
    key: 'quote',
    label: 'quote',
    group: 'block',
    icon: 'quote',
    priority: 70,
    when: () => true,
    enabled: () => true,
    run: (context) => ({
      transaction: prefixSelectedLines(context.value, context.selection, '> '),
    }),
  },
  {
    key: 'code',
    label: 'code',
    group: 'format',
    icon: 'code',
    priority: 60,
    shortcut: 'Mod+E',
    when: () => true,
    enabled: () => true,
    run: (context) => ({
      transaction: wrapSelection(
        context.value,
        context.selection,
        '`',
        '`',
        'code',
      ),
    }),
  },
  {
    key: 'link',
    label: 'link',
    group: 'insert',
    icon: 'link',
    priority: 50,
    shortcut: 'Mod+K',
    when: () => true,
    enabled: () => true,
    run: (context) => ({
      transaction: wrapSelection(
        context.value,
        context.selection,
        '[',
        '](https://example.com)',
        'label',
      ),
    }),
  },
  {
    key: 'image',
    label: 'image',
    group: 'insert',
    icon: 'image',
    priority: 40,
    when: () => true,
    enabled: () => true,
    run: (context) => ({
      transaction: wrapSelection(
        context.value,
        context.selection,
        '![',
        '](https://example.com/image.png)',
        'alt',
      ),
    }),
  },
  {
    key: 'paste-as-markdown',
    label: 'paste-as-markdown',
    group: 'insert',
    presentation: ['toolbar', 'palette'],
    priority: 10,
    when: () => true,
    enabled: () => true,
    run: () => ({}),
  },
  {
    key: 'link-properties',
    label: 'link-properties',
    group: 'format',
    presentation: ['selection', 'palette'],
    priority: 45,
    when: (context) => context.syntax?.type === 'link',
    enabled: (context) => context.syntax?.status === 'valid',
    run: () => ({ focus: 'surface', surface: 'link-properties' }),
  },
  {
    key: 'anchor-properties',
    label: 'anchor-properties',
    group: 'block',
    presentation: ['selection', 'palette'],
    priority: 35,
    when: (context) => context.syntax?.type === 'anchor',
    enabled: (context) => context.syntax?.status !== 'malformed',
    run: () => ({ focus: 'surface', surface: 'anchor-properties' }),
  },
  {
    key: 'anchor-insert',
    label: 'anchor-insert',
    group: 'block',
    presentation: ['slash', 'palette'],
    priority: 34,
    when: (context) =>
      context.syntax?.type !== 'anchor' &&
      context.selection.start === context.selection.end,
    enabled: (context) => context.syntax?.status !== 'malformed',
    run: () => ({ focus: 'surface', surface: 'anchor-properties' }),
  },
  ...createMarkdownTableCommands(),
]

export const isMarkdownEditorCommandVisible = (
  command: MarkdownEditorCommand,
  context: MarkdownEditorCommandContext,
) => command.when?.(context) ?? true

/**
 * `preview` has no editable surface, so commands stay listed but cannot run —
 * the same fail-closed rule the attachment, clipboard, code, language-tool, and
 * live-selection pipelines already apply. `when` still owns presentation.
 */
export const isMarkdownEditorCommandEnabled = (
  command: MarkdownEditorCommand,
  context: MarkdownEditorCommandContext,
) =>
  !context.readonly &&
  context.mode !== 'preview' &&
  !context.signal.aborted &&
  (command.enabled?.(context) ?? true)

export const getMarkdownEditorCommand = (
  commands: readonly MarkdownEditorCommand[],
  key: string,
) => commands.find((command) => command.key === key)

export const filterMarkdownEditorCommands = (
  commands: readonly MarkdownEditorCommand[],
  context: MarkdownEditorCommandContext,
  presentation?: MarkdownEditorCommandPresentation,
) =>
  commands.filter(
    (command) =>
      isMarkdownEditorCommandVisible(command, context) &&
      (!presentation ||
        !command.presentation ||
        command.presentation.includes(presentation)),
  )

export const resolveMarkdownEditorShortcut = (
  commands: readonly MarkdownEditorCommand[],
  shortcut: string,
) => {
  const normalizedShortcut = shortcut.replace(/\s+/gu, '').toLowerCase()
  const matches = commands.filter(
    (command) =>
      command.shortcut?.replace(/\s+/gu, '').toLowerCase() ===
      normalizedShortcut,
  )
  if (matches.length > 1)
    throw new Error(`Markdown editor shortcut conflict: ${shortcut}`)
  return matches[0]
}

export const runMarkdownEditorCommand = async (
  command: MarkdownEditorCommand,
  context: MarkdownEditorCommandContext,
) => {
  if (
    !isMarkdownEditorCommandVisible(command, context) ||
    !isMarkdownEditorCommandEnabled(command, context)
  )
    return undefined
  return await command.run(context)
}

export const markdownEditorProps = buildProps({
  modelValue: {
    type: String,
    default: '',
  },
  documentIdentity: {
    type: definePropType<MarkdownEditorDocumentIdentity>(Object),
    default: undefined,
  },
  defaultMode: {
    type: String as PropType<MarkdownEditorMode>,
    values: ['source', 'live', 'split', 'preview'],
    default: 'source',
  },
  mode: {
    type: String as PropType<MarkdownEditorMode | undefined>,
    values: ['source', 'live', 'split', 'preview'],
    default: undefined,
  },
  chrome: {
    type: String as PropType<MarkdownEditorChrome>,
    values: markdownEditorChromes,
    default: 'framed',
  },
  localeText: {
    type: definePropType<MarkdownEditorLocaleTextOverride>(Object),
    default: undefined,
  },
  statusDensity: {
    type: String as PropType<MarkdownEditorStatusDensity>,
    values: ['none', 'minimal', 'detailed'],
    default: 'minimal',
  },
  metrics: {
    type: definePropType<MarkdownEditorMetricsOptions>(Object),
    default: undefined,
  },
  toolbarDensity: {
    type: String as PropType<MarkdownEditorToolbarDensity>,
    values: ['minimal', 'standard', 'full'],
    default: 'standard',
  },
  surfaces: {
    type: definePropType<MarkdownEditorSurfaceOptions>(Object),
    default: () => ({ toolbar: true }),
  },
  writingAids: {
    type: definePropType<MarkdownEditorWritingAidsOptions>(Object),
    default: undefined,
  },
  focusExemptions: {
    type: definePropType<MarkdownEditorFocusExemptions>(Object),
    default: undefined,
  },
  placeholder: {
    type: String,
    default: '',
  },
  writingPlaceholder: {
    type: String,
    default: '',
  },
  editorProfile: {
    type: String as PropType<MarkdownEditorProfile>,
    values: ['markdown', 'prose'],
    default: 'markdown',
  },
  interactionProfile: {
    type: String as PropType<MarkdownEditorInteractionProfile>,
    values: ['auto', 'touch', 'keyboard'],
    default: 'auto',
  },
  textareaId: {
    type: String,
    default: undefined,
  },
  textareaName: {
    type: String,
    default: undefined,
  },
  readonly: Boolean,
  disabled: Boolean,
  loading: Boolean,
  showModeSwitcher: {
    type: Boolean,
    default: true,
  },
  showActions: {
    type: Boolean,
    default: true,
  },
  showImageAction: {
    type: Boolean,
    default: true,
  },
  imageActionLabel: {
    type: String,
    default: undefined,
  },
  showSaveAction: {
    type: Boolean,
    default: true,
  },
  saveActionLabel: {
    type: String,
    default: undefined,
  },
  showSubmitAction: {
    type: Boolean,
    default: true,
  },
  submitActionLabel: {
    type: String,
    default: undefined,
  },
  actionOverflowKeys: {
    type: definePropType<readonly MarkdownEditorActionKey[]>(Array),
    default: () => [],
  },
  commands: {
    type: definePropType<readonly MarkdownEditorCommand[]>(Array),
    default: () => defaultMarkdownEditorCommands,
  },
  primaryCommandKeys: {
    type: definePropType<readonly string[]>(Array),
    default: undefined,
  },
  commandOverflowLabel: {
    type: String,
    default: undefined,
  },
  mobileLayout: {
    type: String as PropType<MarkdownEditorMobileLayout>,
    values: ['auto', 'compact', 'standard'],
    default: 'auto',
  },
  previewBaseUrl: {
    type: String as PropType<string | null>,
    default: null,
  },
  previewCspNonce: {
    type: String as PropType<string | null>,
    default: null,
  },
  previewFeatures: {
    type: Object as PropType<MarkdownFeatureActivationFeatureOptions>,
    default: undefined,
  },
  embedProvider: {
    type: definePropType<MarkdownEmbedProvider>(Function),
    default: undefined,
  },
  minRows: {
    type: Number,
    default: 12,
  },
  spellcheck: {
    type: [String, Boolean] as PropType<MarkdownSpellcheckMode | boolean>,
    default: 'auto',
  },
  lang: {
    type: String,
    default: undefined,
  },
  nativeWritingTools: {
    type: String as PropType<MarkdownNativeWritingToolsMode>,
    values: ['auto', 'disabled'],
    default: 'auto',
  },
} as const)

export const markdownEditorEmits = {
  [UPDATE_MODEL_EVENT]: (value: string) => typeof value === 'string',
  [CHANGE_EVENT]: (value: string) => typeof value === 'string',
  command: (command: MarkdownEditorCommand) => Boolean(command?.key),
  'mode-change': (mode: MarkdownEditorMode) =>
    mode === 'source' ||
    mode === 'live' ||
    mode === 'split' ||
    mode === 'preview',
  save: (value: string) => typeof value === 'string',
  submit: (value: string) => typeof value === 'string',
  'upload-image': (_batch: MarkdownAttachmentBatchIntent) => true,
  'render-complete': (..._args: unknown[]) => true,
  'render-error': (..._args: unknown[]) => true,
  'features-activated': (..._args: unknown[]) => true,
  'embed-open-source': (target: string, mode: string) =>
    typeof target === 'string' && typeof mode === 'string',
  'embed-retry': (target: string, mode: string) =>
    typeof target === 'string' && typeof mode === 'string',
  transaction: (event: MarkdownEditorTransactionEvent) =>
    typeof event?.accepted === 'boolean' &&
    typeof event.revision === 'number' &&
    typeof event.value === 'string',
  'selection-change': (event: MarkdownEditorSelectionEvent) =>
    typeof event?.revision === 'number' &&
    typeof event.selection?.start === 'number' &&
    typeof event.selection?.end === 'number',
  'history-change': (history: MarkdownEditorHistoryState) =>
    typeof history?.undoDepth === 'number' &&
    typeof history.redoDepth === 'number',
}

export type MarkdownEditorProps = ExtractPropTypes<typeof markdownEditorProps>
export type MarkdownEditorEmits = typeof markdownEditorEmits
export type MarkdownEditorInstance = InstanceType<typeof MarkdownEditor>
