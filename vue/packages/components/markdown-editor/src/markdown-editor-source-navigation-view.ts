import type {
  MarkdownEditorSession,
  MarkdownEditorSessionDocumentState,
} from './markdown-editor-session'
import type { MarkdownEditorResolvedSelection } from './markdown-editor-transaction'

/** Original mounted source owner only; not a checkpoint acquisition or navigation admission. */
export interface MarkdownEditorSourceNavigationViewOptions {
  readonly session: MarkdownEditorSession
  readonly expected: MarkdownEditorSessionDocumentState
  readonly signal: AbortSignal
  /** Synchronous; its original thrown value is propagated unchanged. */
  readonly assertAdmission: () => void
}

/** Nontransferable observation. Copies and observations from another instance are not current. */
export interface MarkdownEditorSourceNavigationView extends MarkdownEditorSessionDocumentState {
  readonly editorSessionRef: string
  readonly viewGeneration: number
  readonly selection: MarkdownEditorResolvedSelection
  readonly focusOffset: number
  readonly affinity: 'before' | 'after'
  /** Focus endpoint block-start minus usable source viewport block-start, in CSS pixels; may be negative. */
  readonly viewportOffset: number
  /** Actual scrollTop / (scrollHeight - clientHeight); zero only for a real zero-range or top position. */
  readonly percentage: number
  readonly viewport: Readonly<{
    readonly blockStart: number
    readonly height: number
    readonly reducedMotion: boolean
  }>
}

/** Actual trusted source input, not inferred from scroll and never an automatic resume notification. */
export interface MarkdownEditorSourceNavigationGesture extends MarkdownEditorSessionDocumentState {
  readonly viewGeneration: number
  readonly gesture: 'wheel' | 'touch' | 'pointer' | 'keyboard'
}
