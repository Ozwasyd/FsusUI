import type { MarkdownEditorDocumentIdentity } from './markdown-editor-transaction'

/** Borrow original principal AND document/source custody; never mint an application issuer. */
export interface MarkdownEditorNativeHandoverPrincipal {
  hasCustody(): unknown
}

export interface MarkdownEditorNativeHandoverInspection {
  readonly scope: 'same-process-native-checkpoint-memory'
  readonly complete: false
  readonly resourcesValidated: false
  readonly state: 'reserved' | 'released' | 'receiving' | 'transferred' | 'cancelled'
  readonly eligible: boolean
  readonly retainedHistoryUnits: number
  readonly firstCause: unknown
  readonly latestCause: unknown
  readonly failed: boolean
}

export interface MarkdownEditorNativeHandover {
  readonly snapshotRef: string
  readonly editorSessionRef: string
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly revision: number
  inspect(): MarkdownEditorNativeHandoverInspection
  /** Cancel original memory custody; this is never a disposal or full-ref receipt. */
  cancel(): boolean
}

export interface MarkdownEditorNativeHandoverProof {
  readonly status: 'native-recreated'
  readonly snapshotRef: string
  readonly editorSessionRef: string
  readonly nativeHistoryTransferred: true
  readonly fullRefsRestored: false
  readonly resourcesValidated: false
}
