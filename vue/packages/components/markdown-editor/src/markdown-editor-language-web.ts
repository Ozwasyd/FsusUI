import type { MarkdownStableProjection } from '../../../wasm/markdown-runtime'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import type {
  MarkdownEditorDocumentIdentity,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'
import type {
  MarkdownLanguageToolCapability,
  MarkdownLanguageToolCommitInput,
  MarkdownLanguageToolCommitResult,
  MarkdownLanguageToolConfig,
  MarkdownLanguageToolSession,
  MarkdownLanguageToolSessionKind,
} from './markdown-editor-language-tools'
import {
  commitMarkdownLanguageToolMutation,
  createMarkdownLanguageToolSession,
  resolveMarkdownLanguageToolCapability,
  resolveMarkdownLanguageToolContextCapability,
} from './markdown-editor-language-tools'

export interface MarkdownWebTextareaLike {
  autocapitalize?: string
  autocomplete?: string
  autocorrect?: boolean | string
  lang?: string
  selectionDirection?: 'backward' | 'forward' | 'none'
  selectionEnd?: number
  selectionStart?: number
  spellcheck?: boolean
  value?: string
  setAttribute?(name: string, value: string): void
}

export interface MarkdownWebLanguageCoordinates {
  readonly inAtomic: boolean
  readonly inCode: boolean
  readonly inMarker: boolean
  readonly inUrl: boolean
  readonly rawOffset: number
  readonly reason?: MarkdownLanguageToolCapability['reason']
  /**
   * The visual offset is deliberately absent until the editor owner supplies
   * the canonical #325 anchor map. Raw offsets are never visual authority.
   */
  readonly visualOffset?: number
}

export interface MarkdownWebLanguageBeforeInput {
  readonly data?: string | null
  readonly inputType?: string
  readonly isComposing?: boolean
  readonly preventDefault?: () => void
  /**
   * The editor owner resolves browser target ranges through the canonical map.
   * DOM ranges themselves are never accepted as source authority.
   */
  readonly rawTargetRange?: MarkdownEditorSelection
}

export interface MarkdownWebLanguageController {
  readonly autocorrect: boolean
  readonly capability: MarkdownLanguageToolCapability
  readonly dictation: boolean
  readonly lang?: string
  readonly nativeWritingTools: MarkdownLanguageToolCapability['nativeWritingTools']
  readonly session: MarkdownLanguageToolSession | null
  readonly spellcheck: boolean
  readonly status: MarkdownLanguageToolCapability['status']
  applyReplacement(
    from: number,
    to: number,
    insert: string,
    kind?: MarkdownLanguageToolSessionKind,
  ): MarkdownLanguageToolCommitResult
  createSession(
    kind?: MarkdownLanguageToolSessionKind,
  ): MarkdownLanguageToolSession
  handleBeforeInput(event: MarkdownWebLanguageBeforeInput): {
    readonly handled: boolean
    readonly reason?: string
    readonly transaction?: MarkdownEditorTransaction
  }
  switchMode(nextMode: MarkdownEditorMode): MarkdownLanguageToolCapability
  updateState(input: {
    readonly config?: MarkdownLanguageToolConfig
    readonly projection?: MarkdownStableProjection
    readonly projectionRevision?: number
    readonly revision: number
    readonly source: string
  }): MarkdownLanguageToolCapability
  updateContext(input: {
    readonly disabled?: boolean
    readonly isComposing?: boolean
    readonly mode?: MarkdownEditorMode
    readonly offset?: number
    readonly readonly?: boolean
    readonly selection?: MarkdownEditorSelection
  }): MarkdownLanguageToolCapability
}

const selectionFrom = (
  textarea: MarkdownWebTextareaLike,
): MarkdownEditorSelection =>
  Object.freeze({
    direction: textarea.selectionDirection ?? 'none',
    end: textarea.selectionEnd ?? 0,
    start: textarea.selectionStart ?? 0,
  })

const rejected = (
  reason: MarkdownLanguageToolCommitResult['reason'],
): MarkdownLanguageToolCommitResult =>
  Object.freeze({
    accepted: false,
    reason,
  })

export const resolveMarkdownWebLanguageCoordinates = (input: {
  readonly documentIdentity?: MarkdownEditorDocumentIdentity
  readonly mode?: MarkdownEditorMode
  readonly offset: number
  readonly projection?: MarkdownStableProjection
  readonly source: string
}): MarkdownWebLanguageCoordinates => {
  const clamped = Math.max(0, Math.min(input.source.length, input.offset))
  const capability = resolveMarkdownLanguageToolContextCapability({
    documentIdentity: input.documentIdentity,
    mode: input.mode,
    offset: clamped,
    projection: input.projection,
    source: input.source,
  })

  return Object.freeze({
    inAtomic: capability.reason === 'atomic-node',
    inCode: capability.reason === 'code-block',
    inMarker: capability.reason === 'hidden-marker',
    inUrl: capability.reason === 'url',
    rawOffset: clamped,
    reason: capability.reason,
  })
}

export const planMarkdownWebReplacement = (
  input: MarkdownLanguageToolCommitInput,
): MarkdownLanguageToolCommitResult => commitMarkdownLanguageToolMutation(input)

export const bindMarkdownWebLanguageTools = (
  textarea: MarkdownWebTextareaLike,
  options: {
    readonly config?: MarkdownLanguageToolConfig
    readonly documentIdentity?: MarkdownEditorDocumentIdentity
    readonly mode?: MarkdownEditorMode
    readonly projection?: MarkdownStableProjection
    readonly projectionRevision?: number
    readonly revision?: number
    readonly source?: string
  } = {},
): MarkdownWebLanguageController & MarkdownLanguageToolCapability => {
  const documentIdentity =
    options.documentIdentity ?? Object.freeze({ epoch: 0, id: 'web-editor' })
  let currentRevision = options.revision ?? 0
  let currentSource = options.source ?? textarea.value ?? ''
  let currentConfig = options.config
  let currentMode: MarkdownEditorMode = options.mode ?? 'source'
  let currentProjection = options.projection
  let currentProjectionRevision = options.projection
    ? options.projectionRevision
    : undefined
  let currentCapability = resolveMarkdownLanguageToolCapability(currentConfig)
  let currentSession: MarkdownLanguageToolSession | null = null

  const baseCapability = () =>
    resolveMarkdownLanguageToolCapability(currentConfig)

  const applyAttributes = () => {
    const base = baseCapability()
    textarea.spellcheck = base.spellcheck
    textarea.lang = base.lang ?? ''
    textarea.autocapitalize = 'sentences'
    textarea.autocomplete = 'off'
    const autocorrect = base.autocorrect ? 'on' : 'off'
    if (textarea.setAttribute) {
      textarea.setAttribute('autocorrect', autocorrect)
      textarea.setAttribute(
        'writingsuggestions',
        base.nativeWritingTools === 'disabled' ? 'false' : 'true',
      )
    } else {
      textarea.autocorrect = autocorrect
    }
  }

  const localCapability = (input: {
    readonly disabled?: boolean
    readonly isComposing?: boolean
    readonly mode?: MarkdownEditorMode
    readonly offset?: number
    readonly readonly?: boolean
    readonly selection?: MarkdownEditorSelection
  }) =>
    resolveMarkdownLanguageToolContextCapability({
      config: currentConfig,
      disabled: input.disabled,
      documentIdentity,
      isComposing: input.isComposing,
      mode: input.mode ?? currentMode,
      offset: input.offset,
      projection: currentProjection,
      readonly: input.readonly,
      revision: currentRevision,
      selection: input.selection,
      source: currentSource,
    })

  const createSession = (
    kind: MarkdownLanguageToolSessionKind = 'spellcheck',
    selection = selectionFrom(textarea),
  ) => {
    currentSession = createMarkdownLanguageToolSession({
      documentIdentity,
      kind,
      revision: currentRevision,
      selection,
    })
    return currentSession
  }

  const unavailableReasonFor = (
    kind: MarkdownLanguageToolSessionKind,
  ): MarkdownLanguageToolCommitResult['reason'] | undefined => {
    if (
      currentCapability.status !== 'supported' ||
      currentCapability.reason !== undefined
    ) {
      return currentCapability.reason ?? 'unsupported-platform'
    }
    if (
      kind === 'writing-tools' &&
      currentCapability.nativeWritingTools === 'disabled'
    ) {
      return 'disabled'
    }
    if (kind === 'dictation' && !currentCapability.dictation) return 'disabled'
    if (kind === 'autocorrect' && !currentCapability.autocorrect) {
      return 'disabled'
    }
    if (
      (kind === 'spellcheck' || kind === 'context-menu') &&
      !currentCapability.spellcheck
    ) {
      return 'disabled'
    }
    return undefined
  }

  const commit = (
    from: number,
    to: number,
    insert: string,
    kind: MarkdownLanguageToolSessionKind,
    targetSelection = selectionFrom(textarea),
  ): MarkdownLanguageToolCommitResult => {
    const unavailableReason = unavailableReasonFor(kind)
    if (unavailableReason) return rejected(unavailableReason)
    if (!currentProjection) return rejected('projection-unavailable')
    if (currentProjectionRevision === undefined) {
      return rejected('stale-projection')
    }
    if (!currentSession) return rejected('session-required')
    return planMarkdownWebReplacement({
      currentDocumentIdentity: documentIdentity,
      currentRevision,
      currentSelection: targetSelection,
      documentIdentity,
      from,
      insert,
      kind,
      projection: currentProjection,
      projectionRevision: currentProjectionRevision,
      revision: currentRevision,
      session: currentSession,
      source: currentSource,
      to,
    })
  }

  applyAttributes()

  return Object.freeze({
    get autocorrect() {
      return currentCapability.autocorrect
    },
    get capability() {
      return currentCapability
    },
    get dictation() {
      return currentCapability.dictation
    },
    get lang() {
      return currentCapability.lang
    },
    get nativeWritingTools() {
      return currentCapability.nativeWritingTools
    },
    get reason() {
      return currentCapability.reason
    },
    get session() {
      return currentSession
    },
    get spellcheck() {
      return currentCapability.spellcheck
    },
    get spellcheckMode() {
      return currentCapability.spellcheckMode
    },
    get status() {
      return currentCapability.status
    },

    createSession,

    applyReplacement(
      from: number,
      to: number,
      insert: string,
      kind: MarkdownLanguageToolSessionKind = currentSession?.kind ??
        'spellcheck',
    ) {
      const result = commit(from, to, insert, kind)
      currentSession = null
      return result
    },

    switchMode(nextMode: MarkdownEditorMode) {
      currentMode = nextMode
      currentCapability = localCapability({
        mode: nextMode,
        selection: selectionFrom(textarea),
      })
      applyAttributes()
      return currentCapability
    },

    updateState(input: {
      readonly config?: MarkdownLanguageToolConfig
      readonly projection?: MarkdownStableProjection
      readonly projectionRevision?: number
      readonly revision: number
      readonly source: string
    }) {
      currentRevision = input.revision
      currentSource = input.source
      currentConfig = input.config ?? currentConfig
      currentProjection = input.projection
      currentProjectionRevision = input.projection
        ? input.projectionRevision
        : undefined
      currentSession = null
      currentCapability = resolveMarkdownLanguageToolCapability(currentConfig)
      applyAttributes()
      return currentCapability
    },

    updateContext(input: {
      readonly disabled?: boolean
      readonly isComposing?: boolean
      readonly mode?: MarkdownEditorMode
      readonly offset?: number
      readonly readonly?: boolean
      readonly selection?: MarkdownEditorSelection
    }) {
      currentCapability = localCapability(input)
      // Context suppression remains local; do not disable the textarea globally.
      textarea.spellcheck = baseCapability().spellcheck
      return currentCapability
    },

    handleBeforeInput(event: MarkdownWebLanguageBeforeInput) {
      if (event.inputType !== 'insertReplacementText') {
        return Object.freeze({ handled: false })
      }

      // Browser DOM mutation cannot fall through once classified as a native
      // replacement. Rejected commits are still consumed at this boundary.
      event.preventDefault?.()
      if (event.isComposing) {
        currentSession = null
        return Object.freeze({
          handled: true,
          reason: 'composition-active',
        })
      }
      const kind = currentSession?.kind ?? 'spellcheck'
      const unavailableReason = unavailableReasonFor(kind)
      if (unavailableReason) {
        currentSession = null
        return Object.freeze({
          handled: true,
          reason: unavailableReason,
        })
      }

      const currentSelection = selectionFrom(textarea)
      const targetSelection = event.rawTargetRange ?? currentSelection
      if (!currentSession) createSession(kind, targetSelection)
      const result = commit(
        targetSelection.start,
        targetSelection.end,
        event.data ?? '',
        kind,
        currentSelection,
      )
      currentSession = null
      return Object.freeze({
        handled: true,
        reason: result.reason,
        transaction: result.transaction,
      })
    },
  })
}
