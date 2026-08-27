import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes, PropType } from 'vue'
import type { MarkdownFeatureActivationFeatureOptions } from '@element-plus/wasm'
import type MarkdownEditor from './markdown-editor.vue'
import type { MarkdownAttachmentBatchIntent } from './markdown-editor-attachment'
import type { MarkdownEditorMetricsOptions } from './markdown-editor-metrics'
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
  evaluateMarkdownOutlineMutations,
  resolveMarkdownEditorOutline,
  revealHeading,
  revealSourceRange,
} from './markdown-editor-outline'
export {
  collectMarkdownEmbedNodes,
  runMarkdownEmbedEdit,
  runMarkdownEmbedInsert,
  runMarkdownEmbedRemove,
} from './markdown-editor-embed'
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

export const resolveMarkdownEditorPrimaryCommands = <
  T extends { readonly key: string },
>(
  commands: readonly T[],
  density: MarkdownEditorToolbarDensity,
  primaryKeys?: readonly string[],
): T[] => {
  const keySet = primaryKeys?.length ? new Set(primaryKeys) : null
  const selected = keySet
    ? commands.filter((command) => keySet.has(command.key))
    : [...commands]
  return selected.slice(
    0,
    resolveMarkdownEditorToolbarLimit(density, selected.length),
  )
}

export const resolveMarkdownEditorOverflowCommands = <
  T extends { readonly key: string },
>(
  commands: readonly T[],
  density: MarkdownEditorToolbarDensity,
  primaryKeys?: readonly string[],
): T[] => {
  const keySet = primaryKeys?.length ? new Set(primaryKeys) : null
  if (keySet) {
    return commands.filter((command) => !keySet.has(command.key))
  }
  return commands.slice(
    resolveMarkdownEditorToolbarLimit(density, commands.length),
  )
}

export type MarkdownEditorActionKey = 'image' | 'save' | 'submit'

export interface MarkdownEditorActionItem {
  key: MarkdownEditorActionKey
  label: string
}

export interface MarkdownEditorCommandResult {
  readonly transaction?: MarkdownEditorTransaction
}

export type MarkdownEditorCommandLifecycleState =
  | 'idle'
  | 'pending'
  | 'resolved-current'
  | 'rejected'
  | 'aborted'
  | 'stale'

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
export interface MarkdownEditorLocaleText {
  readonly modes: Readonly<Record<MarkdownEditorMode, string>>
  readonly commands: Readonly<Record<MarkdownEditorCommandIcon, string>>
  readonly actions: Readonly<Record<MarkdownEditorActionKey, string>>
  readonly pasteAsMarkdown: Readonly<{
    cancel: string
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
    searchPlaceholder: string
    title: string
  }>
  readonly capabilityAnnouncement: (capability: string) => string
  readonly overflow: string
  readonly overflowAria: (count: number) => string
  readonly editorAria: string
  readonly modeSwitcherAria: string
  readonly metrics: Readonly<{ characters: string; words: string }>
}

export type MarkdownEditorLocaleTextOverride = {
  readonly [K in keyof MarkdownEditorLocaleText]?: MarkdownEditorLocaleText[K]
}

export const defaultMarkdownEditorLocaleText: MarkdownEditorLocaleText =
  Object.freeze({
    modes: Object.freeze({
      source: '源码',
      live: '实时',
      split: '分屏',
      preview: '预览',
    }),
    commands: Object.freeze({
      bold: 'Bold',
      code: 'Code',
      heading: 'Heading',
      image: 'Insert image',
      italic: 'Italic',
      link: 'Link',
      quote: 'Quote',
    }),
    actions: Object.freeze({
      image: '上传图片',
      save: '保存',
      submit: '提交',
    }),
    pasteAsMarkdown: Object.freeze({
      cancel: 'Cancel',
      conversionWarnings: 'Conversion warnings',
      description:
        'Review the converted Markdown and source changes before importing.',
      disabledDescriptions: Object.freeze({
        composition: 'Unavailable while text composition is active.',
        disabled: 'Unavailable while the editor is disabled.',
        loading: 'Unavailable while the editor is loading.',
        previewOnly: 'Unavailable in preview only mode.',
        readonly: 'Unavailable while the editor is readonly.',
      }),
      importMarkdown: 'Import Markdown',
      markdownPreview: 'Markdown preview',
      pastePlainText: 'Paste plain text',
      sourceAfter: 'After',
      sourceBefore: 'Before',
      sourceDiff: 'Source diff',
      stale: 'The document or selection changed. Review the clipboard again.',
      title: 'Paste as Markdown',
    }),
    commandPalette: Object.freeze({
      searchPlaceholder: 'Search commands',
      title: 'Command palette',
    }),
    capabilityAnnouncement: (capability: string) =>
      `Editor capability: ${capability}`,
    overflow: '格式工具',
    overflowAria: (count: number) => `格式工具，${count} 个工具`,
    editorAria: 'Markdown editor',
    modeSwitcherAria: 'Markdown mode',
    metrics: Object.freeze({ characters: 'chars', words: 'words' }),
  })

export type MarkdownEditorLocaleMutationKind =
  | "hardcoded-copy"
  | "error-string-matching"
  | "cross-language-fallback"
  | "duplicate-labels"

export const evaluateMarkdownEditorLocaleMutations = () =>
  Object.freeze({
    authority: defaultMarkdownEditorLocaleText,
    mutations: Object.freeze([
      Object.freeze({ kind: "hardcoded-copy" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "error-string-matching" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "cross-language-fallback" as const, equivalent: false, accepted: false }),
      Object.freeze({ kind: "duplicate-labels" as const, equivalent: false, accepted: false }),
    ]),
  })

export const resolveMarkdownEditorLocaleText = (
  localeText?: MarkdownEditorLocaleTextOverride,
): MarkdownEditorLocaleText => ({
  ...defaultMarkdownEditorLocaleText,
  ...localeText,
  actions: {
    ...defaultMarkdownEditorLocaleText.actions,
    ...localeText?.actions,
  },
  commands: {
    ...defaultMarkdownEditorLocaleText.commands,
    ...localeText?.commands,
  },
  metrics: {
    ...defaultMarkdownEditorLocaleText.metrics,
    ...localeText?.metrics,
  },
  modes: {
    ...defaultMarkdownEditorLocaleText.modes,
    ...localeText?.modes,
  },
  pasteAsMarkdown: {
    ...defaultMarkdownEditorLocaleText.pasteAsMarkdown,
    ...localeText?.pasteAsMarkdown,
    disabledDescriptions: {
      ...defaultMarkdownEditorLocaleText.pasteAsMarkdown.disabledDescriptions,
      ...localeText?.pasteAsMarkdown?.disabledDescriptions,
    },
  },
  commandPalette: {
    ...defaultMarkdownEditorLocaleText.commandPalette,
    ...localeText?.commandPalette,
  },
  capabilityAnnouncement:
    localeText?.capabilityAnnouncement ??
    defaultMarkdownEditorLocaleText.capabilityAnnouncement,
  overflowAria:
    localeText?.overflowAria ?? defaultMarkdownEditorLocaleText.overflowAria,
})

/** Syntax is supplied by the editor projection, never derived by commands. */
export interface MarkdownEditorSyntaxContext {
  readonly nodeId?: string
  readonly range?: Readonly<{ end: number; start: number }>
  readonly type?: string
}

export interface MarkdownEditorCommandContext {
  readonly dispatch: MarkdownEditorTransactionDispatcher
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly mode: MarkdownEditorMode
  readonly positionMap?: MarkdownEditorPositionMap
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
  readonly presentation?: readonly MarkdownEditorCommandPresentation[]
  readonly when?: (context: MarkdownEditorCommandContext) => boolean
  readonly enabled?: (context: MarkdownEditorCommandContext) => boolean
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
    label: 'B',
    group: 'format',
    icon: 'bold',
    keywords: ['bold'],
    shortcut: 'Mod+B',
    title: 'Bold',
    when: () => true,
    enabled: () => true,
    run: (context) => ({ transaction: wrapSelection(context.value, context.selection, '**', '**', 'text') }),
  },
  {
    key: 'italic',
    label: 'I',
    group: 'format',
    icon: 'italic',
    keywords: ['italic'],
    shortcut: 'Mod+I',
    title: 'Italic',
    when: () => true,
    enabled: () => true,
    run: (context) => ({ transaction: wrapSelection(context.value, context.selection, '*', '*', 'text') }),
  },
  {
    key: 'heading',
    label: 'H',
    group: 'block',
    icon: 'heading',
    keywords: ['heading'],
    shortcut: 'Mod+Alt+H',
    title: 'Heading',
    when: () => true,
    enabled: () => true,
    run: (context) => ({ transaction: prefixSelectedLines(context.value, context.selection, '## ') }),
  },
  {
    key: 'quote',
    label: 'Q',
    group: 'block',
    icon: 'quote',
    title: 'Quote',
    when: () => true,
    enabled: () => true,
    run: (context) => ({ transaction: prefixSelectedLines(context.value, context.selection, '> ') }),
  },
  {
    key: 'code',
    label: '{}',
    group: 'format',
    icon: 'code',
    shortcut: 'Mod+E',
    title: 'Code',
    when: () => true,
    enabled: () => true,
    run: (context) => ({ transaction: wrapSelection(context.value, context.selection, '`', '`', 'code') }),
  },
  {
    key: 'link',
    label: 'Link',
    group: 'insert',
    icon: 'link',
    shortcut: 'Mod+K',
    title: 'Link',
    when: () => true,
    enabled: () => true,
    run: (context) => ({ transaction: wrapSelection(context.value, context.selection, '[', '](https://example.com)', 'label') }),
  },
  {
    key: 'image',
    label: '图片',
    group: 'insert',
    icon: 'image',
    title: '插入图片',
    when: () => true,
    enabled: () => true,
    run: (context) => ({ transaction: wrapSelection(
        context.value,
        context.selection,
        '![',
        '](https://example.com/image.png)',
        'alt',
      ) }),
  },
  {
    key: 'paste-as-markdown',
    label: 'Paste as Markdown',
    group: 'insert',
    title: 'Paste as Markdown',
    presentation: ['toolbar', 'palette'],
    when: () => true,
    enabled: () => true,
    run: () => ({}),
  },
]

export const isMarkdownEditorCommandVisible = (
  command: MarkdownEditorCommand,
  context: MarkdownEditorCommandContext,
) => command.when?.(context) ?? true

export const isMarkdownEditorCommandEnabled = (
  command: MarkdownEditorCommand,
  context: MarkdownEditorCommandContext,
) => !context.readonly && !context.signal.aborted && (command.enabled?.(context) ?? true)

export const getMarkdownEditorCommand = (
  commands: readonly MarkdownEditorCommand[], key: string,
) => commands.find((command) => command.key === key)

export const filterMarkdownEditorCommands = (
  commands: readonly MarkdownEditorCommand[], context: MarkdownEditorCommandContext,
  presentation?: MarkdownEditorCommandPresentation,
) => commands.filter((command) => isMarkdownEditorCommandVisible(command, context) && (!presentation || !command.presentation || command.presentation.includes(presentation)))

export const resolveMarkdownEditorShortcut = (
  commands: readonly MarkdownEditorCommand[], shortcut: string,
) => {
  const matches = commands.filter((command) => command.shortcut?.toLowerCase() === shortcut.toLowerCase())
  if (matches.length > 1) throw new Error(`Markdown editor shortcut conflict: ${shortcut}`)
  return matches[0]
}

export const runMarkdownEditorCommand = async (
  command: MarkdownEditorCommand,
  context: MarkdownEditorCommandContext,
) => {
  if (!isMarkdownEditorCommandVisible(command, context) || !isMarkdownEditorCommandEnabled(command, context)) return undefined
  return await command.run(context)
}

export const markdownEditorProps = buildProps({
  modelValue: {
    type: String,
    default: '',
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
    default: defaultMarkdownEditorLocaleText.actions.image,
  },
  showSaveAction: {
    type: Boolean,
    default: true,
  },
  saveActionLabel: {
    type: String,
    default: defaultMarkdownEditorLocaleText.actions.save,
  },
  showSubmitAction: {
    type: Boolean,
    default: true,
  },
  submitActionLabel: {
    type: String,
    default: defaultMarkdownEditorLocaleText.actions.submit,
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
    default: defaultMarkdownEditorLocaleText.overflow,
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
  minRows: {
    type: Number,
    default: 12,
  },
} as const)

export const markdownEditorEmits = {
  [UPDATE_MODEL_EVENT]: (value: string) => typeof value === 'string',
  [CHANGE_EVENT]: (value: string) => typeof value === 'string',
  command: (command: MarkdownEditorCommand) => Boolean(command?.key),
  'mode-change': (mode: MarkdownEditorMode) =>
    mode === 'source' || mode === 'live' || mode === 'split' || mode === 'preview',
  save: (value: string) => typeof value === 'string',
  submit: (value: string) => typeof value === 'string',
  'upload-image': (_batch?: MarkdownAttachmentBatchIntent) => true,
  'render-complete': (..._args: unknown[]) => true,
  'render-error': (..._args: unknown[]) => true,
  'features-activated': (..._args: unknown[]) => true,
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
