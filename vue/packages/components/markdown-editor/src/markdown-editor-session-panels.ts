import type { MarkdownAtomicNodeSession } from './markdown-editor-live-selection'
import type { MarkdownAttachmentItemKind } from './markdown-editor-attachment'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import type { MarkdownLiveLayoutAnchor } from './markdown-editor-live-layout'
import type { MarkdownEditorOutlineItem } from './markdown-editor-outline'
import type { MarkdownSearchUiState } from './markdown-editor-search-ui'
import type { MarkdownEditorDocumentIdentity, MarkdownEditorResolvedSelection } from './markdown-editor-transaction'
import type { MarkdownSearchMatch, MarkdownSearchMode } from '../../../wasm/markdown-search-model'

export interface MarkdownEditorSessionPanelState {
  readonly mode: MarkdownEditorMode
  readonly activeNode: Readonly<{
    selection: MarkdownEditorResolvedSelection
    syntaxNodeId: string | null
    syntaxKind: string | null
    linkNodeId: string
    anchorNodeId: string
    atomicSession: MarkdownAtomicNodeSession | null
    contextualSurface: 'anchor-properties' | 'link-properties' | null
    contextualEpoch: number
    contextualRevision: number
    contextualError: string
    linkLabel: string
    linkDestination: string
    linkTitle: string
    anchorId: string
  }>
  readonly scrollAnchor: Readonly<{
    anchor: MarkdownLiveLayoutAnchor | null
    textareaTop: number | null
    textareaLeft: number | null
    previewTop: number | null
    previewLeft: number | null
    retainedPreviewLeft: number
  }>
  readonly outline: readonly MarkdownEditorOutlineItem[]
  readonly search: Readonly<{
    ui: MarkdownSearchUiState
    query: string
    replaceText: string
    matches: readonly MarkdownSearchMatch[]
    currentIndex: number | null
    mode: MarkdownSearchMode
  }>
  readonly attachment: readonly MarkdownEditorSessionAttachmentState[] | null
}

export interface MarkdownEditorSessionAttachmentState {
  readonly id: string
  readonly name: string | null
  readonly kind: MarkdownAttachmentItemKind | null
  readonly batchId: string | null
  readonly itemId: string | null
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly revision: number
  readonly attempt: number
  readonly phase: string
  readonly progress: number
  readonly code: string | null
  readonly message: string | null
  readonly range: Readonly<{ start: number; end: number }> | null
  readonly signalAborted: boolean | null
}

export interface MarkdownEditorSessionPanelRefs {
  readonly activeNodeRef: string
  readonly scrollAnchorRef: string
  readonly outlineRef: string
  readonly searchRef: string
  /** Null when real attachment settlement/custody cannot be retained safely. */
  readonly attachmentStateRef: string | null
}

/** Private original-owner capture; retained ONLY in the existing single session checkpoint. */
export interface MarkdownEditorSessionPanelCapture {
  readonly state: MarkdownEditorSessionPanelState
  readonly missingOwners: readonly string[]
  readonly memoryUnits: number
  /** Actual original owner/projection/DOM/job custody, never equal metadata alone. */
  isCurrent(): boolean
  /** Restore mutable UI through original refs; preserve derived projection and original jobs. */
  restore(): void
}

/** Whitelisted immutable UI metadata, no parser/body/history, DOM, File or controller cloning. */
export const freezeMarkdownEditorSessionPanelState = (
  input: MarkdownEditorSessionPanelState,
): MarkdownEditorSessionPanelState => Object.freeze({
  mode: input.mode,
  activeNode: Object.freeze({
    ...input.activeNode,
    selection: Object.freeze({ ...input.activeNode.selection }),
    atomicSession: input.activeNode.atomicSession
      ? Object.freeze({ nodeId: input.activeNode.atomicSession.nodeId, phase: input.activeNode.atomicSession.phase }) : null,
  }),
  scrollAnchor: Object.freeze({
    ...input.scrollAnchor,
    anchor: input.scrollAnchor.anchor ? Object.freeze({
      ...input.scrollAnchor.anchor,
      documentIdentity: Object.freeze({ ...input.scrollAnchor.anchor.documentIdentity }),
      range: Object.freeze({ ...input.scrollAnchor.anchor.range }),
      visual: Object.freeze({ ...input.scrollAnchor.anchor.visual }),
    }) : null,
  }),
  outline: Object.freeze(input.outline.map((item) => Object.freeze({
    ...item,
    sourceRange: Object.freeze({ ...item.sourceRange }),
    contentRange: Object.freeze({ ...item.contentRange }),
    diagnostics: Object.freeze(item.diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic }))),
  }))),
  search: Object.freeze({
    ...input.search,
    ui: Object.freeze({ ...input.search.ui, aria: Object.freeze({ ...input.search.ui.aria }) }),
    matches: Object.freeze(input.search.matches.map((match) => Object.freeze({
      ...match, range: Object.freeze({ ...match.range }),
    }))),
  }),
  attachment: input.attachment === null ? null : Object.freeze(input.attachment.map((job) => Object.freeze({
    ...job,
    documentIdentity: Object.freeze({ ...job.documentIdentity }),
    range: job.range ? Object.freeze({ ...job.range }) : null,
  }))),
})

export const markdownEditorSessionPanelMemoryUnits = (state: MarkdownEditorSessionPanelState): number => {
  // Actual retained immutable records plus their string payload, not complete resource usage.
  const strings = JSON.stringify(state).length
  return 5 + state.outline.length + state.search.matches.length + (state.attachment?.length ?? 0) +
    Math.ceil(strings * 2 / 65_536)
}
