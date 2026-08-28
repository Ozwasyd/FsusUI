import { CHANGE_EVENT, UPDATE_MODEL_EVENT } from '@element-plus/constants'
import { buildProps, definePropType } from '@element-plus/utils'

import type { ExtractPropTypes, PropType } from 'vue'
import type {
  MarkdownFeatureActivationFeatureOptions,
  MarkdownStableProjection,
} from '@element-plus/wasm'
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
  readonly commandGroups: Readonly<Record<string, string>>
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

export const defaultMarkdownEditorLocaleText: MarkdownEditorLocaleText =
  Object.freeze({
    modes: Object.freeze({
      source: '源码',
      live: '实时',
      split: '分屏',
      preview: '预览',
    }),
    commands: Object.freeze({
      bold: '加粗',
      code: '代码',
      heading: '标题',
      image: '插入图片',
      italic: '斜体',
      link: '链接',
      quote: '引用',
    }),
    actions: Object.freeze({
      image: '上传图片',
      save: '保存',
      submit: '提交',
    }),
    pasteAsMarkdown: Object.freeze({
      cancel: '取消',
      clipboardFailed: '无法读取剪贴板。',
      clipboardUnavailable: '当前环境无法访问剪贴板。',
      conversionWarnings: '转换警告',
      description: '导入前检查转换后的 Markdown 与源码变更。',
      disabledDescriptions: Object.freeze({
        composition: '文字组合输入期间不可用。',
        disabled: '编辑器已禁用。',
        loading: '编辑器加载期间不可用。',
        previewOnly: '仅预览模式下不可用。',
        readonly: '编辑器为只读状态。',
      }),
      importMarkdown: '导入 Markdown',
      markdownPreview: 'Markdown 预览',
      pastePlainText: '粘贴纯文本',
      sourceAfter: '变更后',
      sourceBefore: '变更前',
      sourceDiff: '源码差异',
      stale: '文档或选区已变化，请重新检查剪贴板。',
      title: '粘贴为 Markdown',
    }),
    commandPalette: Object.freeze({
      empty: '没有匹配的命令',
      results: (count: number) => `${count} 个命令`,
      searchPlaceholder: '搜索命令',
      title: '命令面板',
    }),
    contextual: Object.freeze({
      anchorId: '锚点 ID',
      apply: '应用',
      cancel: '取消',
      copy: '复制',
      destination: '目标地址',
      editAnchor: '编辑块锚点',
      editLink: '编辑链接',
      invalidAnchor: '锚点 ID 无效或已存在',
      insertAnchor: '插入块锚点',
      label: '显示文本',
      open: '打开',
      removeAnchor: '移除锚点',
      removeLink: '移除链接并保留文本',
      sourceReveal: '在源码中显示',
      title: '标题',
      unsafeUrl: '链接地址不安全或不受支持',
    }),
    commandGroups: Object.freeze({
      block: '块',
      format: '格式',
      insert: '插入',
    }),
    surfaces: Object.freeze({
      selectionToolbar: '选区工具',
      slashMenu: '块插入命令',
      commandPending: '命令执行中',
      commandRejected: '命令执行失败',
    }),
    textarea: Object.freeze({
      live: 'Markdown 实时编辑区',
      source: 'Markdown 源码编辑区',
    }),
    states: Object.freeze({
      disabled: '已禁用',
      empty: '空文档',
      loading: '加载中',
      readonly: '只读',
    }),
    results: Object.freeze({
      pending: '执行中',
      'resolved-current': '已完成',
      rejected: '执行失败',
      aborted: '已取消',
      stale: '结果已过期',
      deleted: '目标已删除',
    }),
    capabilities: Object.freeze({
      supported: '完整支持',
      'unsupported-platform': '当前平台不支持',
      'runtime-unavailable': '运行时不可用',
      'projection-failed': '语法投影失败',
      'feature-degraded': '部分功能降级',
      fatal: '编辑器不可用',
    }),
    capabilityAnnouncement: (capability: string) => `编辑器能力：${capability}`,
    overflow: '格式工具',
    overflowAria: (count: number) => `格式工具，${count} 个工具`,
    editorAria: 'Markdown 编辑器',
    modeSwitcherAria: 'Markdown 模式',
    metrics: Object.freeze({
      bytes: '字节',
      characters: '字符',
      column: '列',
      line: '行',
      lines: '行数',
      selected: '已选',
      words: '词',
    }),
  })

export type MarkdownEditorLocaleMutationKind =
  | 'hardcoded-copy'
  | 'error-string-matching'
  | 'cross-language-fallback'
  | 'duplicate-labels'

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
  commandGroups: {
    ...defaultMarkdownEditorLocaleText.commandGroups,
    ...localeText?.commandGroups,
  },
  contextual: {
    ...defaultMarkdownEditorLocaleText.contextual,
    ...localeText?.contextual,
  },
  surfaces: {
    ...defaultMarkdownEditorLocaleText.surfaces,
    ...localeText?.surfaces,
  },
  textarea: {
    ...defaultMarkdownEditorLocaleText.textarea,
    ...localeText?.textarea,
  },
  states: {
    ...defaultMarkdownEditorLocaleText.states,
    ...localeText?.states,
  },
  results: {
    ...defaultMarkdownEditorLocaleText.results,
    ...localeText?.results,
  },
  capabilities: {
    ...defaultMarkdownEditorLocaleText.capabilities,
    ...localeText?.capabilities,
  },
  capabilityAnnouncement:
    localeText?.capabilityAnnouncement ??
    defaultMarkdownEditorLocaleText.capabilityAnnouncement,
  overflowAria:
    localeText?.overflowAria ?? defaultMarkdownEditorLocaleText.overflowAria,
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
    commands: { bold: 'BOLD-L10N' },
    contextual: { editLink: 'EDIT-LINK-L10N' },
    modes: { source: 'SOURCE-L10N' },
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
            defaultMarkdownEditorLocaleText.contextual.editLink,
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
]

export const isMarkdownEditorCommandVisible = (
  command: MarkdownEditorCommand,
  context: MarkdownEditorCommandContext,
) => command.when?.(context) ?? true

export const isMarkdownEditorCommandEnabled = (
  command: MarkdownEditorCommand,
  context: MarkdownEditorCommandContext,
) =>
  !context.readonly &&
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
  documentIdentity: {
    type: definePropType<MarkdownEditorDocumentIdentity>(Object),
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
    mode === 'source' ||
    mode === 'live' ||
    mode === 'split' ||
    mode === 'preview',
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
