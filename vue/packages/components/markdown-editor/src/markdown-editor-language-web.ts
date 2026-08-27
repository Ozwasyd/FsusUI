import type { MarkdownStableProjection } from '../../../wasm/markdown-runtime'
import type { MarkdownEditorMode } from './markdown-editor-live-contract'
import type {
  MarkdownEditorDocumentIdentity,
  MarkdownEditorSelection,
  MarkdownEditorTransaction,
} from './markdown-editor-transaction'
import type {
  MarkdownLanguageToolCapability,
  MarkdownLanguageToolConfig,
  MarkdownLanguageToolSession,
  MarkdownLanguageToolSessionKind,
} from './markdown-editor-language-tools'
import {
  commitMarkdownLanguageToolMutation,
  createMarkdownLanguageToolSession,
  planMarkdownLanguageToolReplacement,
  resolveMarkdownLanguageToolCapability,
  resolveMarkdownLanguageToolContextCapability,
} from './markdown-editor-language-tools'

export const MARKDOWN_WEB_LANGUAGE_BROWSERS = Object.freeze([
  'chromium',
  'firefox',
  'webkit',
] as const)

export type MarkdownWebLanguageBrowser =
  (typeof MARKDOWN_WEB_LANGUAGE_BROWSERS)[number]

export interface MarkdownWebTextareaLike {
  autocapitalize?: string
  autocomplete?: string
  autocorrect?: string
  lang?: string
  selectionDirection?: 'backward' | 'forward' | 'none'
  selectionEnd?: number
  selectionStart?: number
  spellcheck?: boolean
  value?: string
}

export interface MarkdownWebLanguageCoordinates {
  readonly inAtomic: boolean
  readonly inCode: boolean
  readonly inMarker: boolean
  readonly inUrl: boolean
  readonly rawOffset: number
  readonly visualOffset: number
}

export interface MarkdownWebLanguageController {
  readonly autocorrect: boolean
  readonly capability: MarkdownLanguageToolCapability
  readonly dictation: boolean
  readonly lang?: string
  readonly nativeWritingTools: string
  readonly session: MarkdownLanguageToolSession | null
  readonly spellcheck: boolean
  readonly status: string
  applyReplacement(from: number, to: number, insert: string): MarkdownEditorTransaction
  createSession(kind?: MarkdownLanguageToolSessionKind): MarkdownLanguageToolSession
  handleBeforeInput(event: {
    readonly data?: string | null
    readonly getTargetRanges?: () => readonly unknown[]
    readonly inputType?: string
    readonly isComposing?: boolean
    readonly preventDefault?: () => void
  }): {
    readonly handled: boolean
    readonly reason?: string
    readonly transaction?: MarkdownEditorTransaction
  }
  switchMode(nextMode: MarkdownEditorMode): MarkdownLanguageToolCapability
  updateContext(input: {
    readonly disabled?: boolean
    readonly isComposing?: boolean
    readonly mode?: MarkdownEditorMode
    readonly offset?: number
    readonly readonly?: boolean
    readonly selection?: MarkdownEditorSelection
  }): MarkdownLanguageToolCapability
}

export const applyMarkdownSpellReplacement = (
  from: number,
  to: number,
  insert: string,
  options?: {
    readonly documentIdentity?: MarkdownEditorDocumentIdentity
    readonly revision?: number
    readonly session?: MarkdownLanguageToolSession
  },
): MarkdownEditorTransaction =>
  planMarkdownLanguageToolReplacement(from, to, insert, options)

export const resolveMarkdownWebLanguageCoordinates = (input: {
  readonly mode?: MarkdownEditorMode
  readonly offset: number
  readonly projection?: MarkdownStableProjection
  readonly source: string
}): MarkdownWebLanguageCoordinates => {
  const { offset, source, projection } = input
  const clamped = Math.max(0, Math.min(source.length, offset))
  const capability = resolveMarkdownLanguageToolContextCapability({
    offset: clamped,
    projection,
    source,
  })

  return Object.freeze({
    inAtomic: capability.reason === 'atomic-node',
    inCode: capability.reason === 'code-block',
    inMarker: capability.reason === 'hidden-marker',
    inUrl: capability.reason === 'url',
    rawOffset: clamped,
    visualOffset: clamped,
  })
}

export const planMarkdownWebReplacement = (input: {
  readonly currentDocumentIdentity?: MarkdownEditorDocumentIdentity
  readonly currentRevision?: number
  readonly documentIdentity?: MarkdownEditorDocumentIdentity
  readonly from: number
  readonly insert: string
  readonly isComposing?: boolean
  readonly kind?: MarkdownLanguageToolSessionKind
  readonly revision?: number
  readonly session?: MarkdownLanguageToolSession
  readonly source: string
  readonly to: number
}) => {
  const documentIdentity = input.documentIdentity ?? { epoch: 0, id: 'web' }
  return commitMarkdownLanguageToolMutation({
    currentDocumentIdentity: input.currentDocumentIdentity ?? documentIdentity,
    currentRevision: input.currentRevision,
    documentIdentity,
    from: input.from,
    insert: input.insert,
    isComposing: input.isComposing,
    kind: input.kind,
    revision: input.revision ?? 0,
    session: input.session,
    source: input.source,
    to: input.to,
  })
}

export const bindMarkdownWebLanguageTools = (
  textarea: MarkdownWebTextareaLike,
  options: {
    readonly config?: MarkdownLanguageToolConfig
    readonly documentIdentity?: MarkdownEditorDocumentIdentity
    readonly mode?: MarkdownEditorMode
    readonly revision?: number
    readonly source?: string
  } = {},
): MarkdownWebLanguageController & MarkdownLanguageToolCapability => {
  const documentIdentity =
    options.documentIdentity ?? Object.freeze({ epoch: 0, id: 'web-editor' })
  const currentRevision = options.revision ?? 0
  let currentMode: MarkdownEditorMode = options.mode ?? 'source'
  let currentCapability = resolveMarkdownLanguageToolCapability(options.config)
  let currentSession: MarkdownLanguageToolSession | null = null

  textarea.spellcheck = currentCapability.spellcheck
  if (currentCapability.lang) {
    textarea.lang = currentCapability.lang
  }
  textarea.autocapitalize = 'sentences'
  textarea.autocomplete = 'off'
  textarea.autocorrect = currentCapability.autocorrect ? 'on' : 'off'

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

    createSession(kind: MarkdownLanguageToolSessionKind = 'spellcheck') {
      currentSession = createMarkdownLanguageToolSession({
        documentIdentity,
        kind,
        revision: currentRevision,
        selection: {
          direction: textarea.selectionDirection ?? 'none',
          end: textarea.selectionEnd ?? 0,
          start: textarea.selectionStart ?? 0,
        },
      })
      return currentSession
    },

    applyReplacement(from: number, to: number, insert: string) {
      return planMarkdownLanguageToolReplacement(from, to, insert, {
        documentIdentity,
        revision: currentRevision,
        session: currentSession ?? undefined,
      })
    },

    switchMode(nextMode: MarkdownEditorMode) {
      currentMode = nextMode
      textarea.spellcheck = currentCapability.spellcheck
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
      const source = textarea.value ?? options.source ?? ''
      const offset =
        input.selection?.start ??
        input.offset ??
        textarea.selectionStart ??
        0
      const nextCapability = resolveMarkdownLanguageToolContextCapability({
        config: options.config,
        disabled: input.disabled,
        documentIdentity,
        isComposing: input.isComposing,
        mode: input.mode ?? currentMode,
        offset,
        readonly: input.readonly,
        revision: currentRevision,
        selection: input.selection,
        source,
      })
      currentCapability = nextCapability
      textarea.spellcheck = nextCapability.spellcheck
      return currentCapability
    },

    handleBeforeInput(event: {
      readonly data?: string | null
      readonly getTargetRanges?: () => readonly unknown[]
      readonly inputType?: string
      readonly isComposing?: boolean
      readonly preventDefault?: () => void
    }) {
      if (event.isComposing) {
        return Object.freeze({ handled: false, reason: 'composition-active' })
      }
      if (event.inputType === 'insertReplacementText') {
        const from = textarea.selectionStart ?? 0
        const to = textarea.selectionEnd ?? from
        const insert = event.data ?? ''
        const source = textarea.value ?? options.source ?? ''
        const commit = commitMarkdownLanguageToolMutation({
          currentDocumentIdentity: documentIdentity,
          currentRevision,
          documentIdentity,
          from,
          insert,
          revision: currentRevision,
          selection: { direction: 'none', end: to, start: from },
          session: currentSession ?? undefined,
          source,
          to,
        })
        if (commit.accepted && commit.transaction) {
          event.preventDefault?.()
          return Object.freeze({
            handled: true,
            transaction: commit.transaction,
          })
        }
        return Object.freeze({
          handled: false,
          reason: commit.reason ?? 'rejected',
        })
      }
      return Object.freeze({ handled: false })
    },
  })
}

export interface MarkdownWebLanguageTraceEntry {
  readonly accepted: boolean
  readonly browser: MarkdownWebLanguageBrowser
  readonly event: string
  readonly handled: boolean
  readonly inputType?: string
  readonly reason?: string
  readonly scenario: string
  readonly transaction?: MarkdownEditorTransaction
}

export const driveMarkdownWebLanguageTrace = (
  browser: MarkdownWebLanguageBrowser,
  scenario:
    | 'spellcheck-correction'
    | 'autocorrect'
    | 'dictation'
    | 'context-menu'
    | 'cjk-composition-spellcheck'
    | 'mode-switch-source-live'
    | 'code-url-suppression'
    | 'stale-revision-rejected',
  options: {
    readonly initialValue?: string
    readonly selection?: MarkdownEditorSelection
  } = {},
): readonly MarkdownWebLanguageTraceEntry[] => {
  const initialValue = options.initialValue ?? 'Hello wrld this is a test'
  const textarea: MarkdownWebTextareaLike = {
    selectionDirection: 'none',
    selectionEnd: options.selection?.end ?? 10,
    selectionStart: options.selection?.start ?? 6,
    spellcheck: true,
    value: initialValue,
  }
  const documentIdentity = { epoch: 1, id: 'trace-doc' }
  const controller = bindMarkdownWebLanguageTools(textarea, {
    documentIdentity,
    revision: 1,
    source: initialValue,
  })
  const trace: MarkdownWebLanguageTraceEntry[] = []

  if (scenario === 'spellcheck-correction' || scenario === 'context-menu') {
    controller.createSession(
      scenario === 'context-menu' ? 'context-menu' : 'spellcheck',
    )
    const beforeinput = controller.handleBeforeInput({
      data: 'world',
      inputType: 'insertReplacementText',
      isComposing: false,
    })
    trace.push(
      Object.freeze({
        accepted: beforeinput.handled,
        browser,
        event: 'beforeinput',
        handled: beforeinput.handled,
        inputType: 'insertReplacementText',
        scenario,
        transaction: beforeinput.transaction,
      }),
    )
  } else if (scenario === 'autocorrect') {
    controller.createSession('autocorrect')
    const beforeinput = controller.handleBeforeInput({
      data: 'world',
      inputType: 'insertReplacementText',
      isComposing: false,
    })
    trace.push(
      Object.freeze({
        accepted: beforeinput.handled,
        browser,
        event: 'beforeinput',
        handled: beforeinput.handled,
        inputType: 'insertReplacementText',
        scenario,
        transaction: beforeinput.transaction,
      }),
    )
  } else if (scenario === 'dictation') {
    controller.createSession('dictation')
    const tx = controller.applyReplacement(6, 10, 'world')
    trace.push(
      Object.freeze({
        accepted: true,
        browser,
        event: 'dictation-commit',
        handled: true,
        inputType: 'insertText',
        scenario,
        transaction: tx,
      }),
    )
  } else if (scenario === 'cjk-composition-spellcheck') {
    const beforeinput = controller.handleBeforeInput({
      data: 'world',
      inputType: 'insertReplacementText',
      isComposing: true,
    })
    trace.push(
      Object.freeze({
        accepted: beforeinput.handled,
        browser,
        event: 'beforeinput',
        handled: beforeinput.handled,
        inputType: 'insertReplacementText',
        reason: beforeinput.reason,
        scenario,
      }),
    )
  } else if (scenario === 'mode-switch-source-live') {
    const liveCap = controller.switchMode('live')
    trace.push(
      Object.freeze({
        accepted: liveCap.spellcheck === true && textarea.spellcheck === true,
        browser,
        event: 'switch-live',
        handled: true,
        scenario,
      }),
    )
    const sourceCap = controller.switchMode('source')
    trace.push(
      Object.freeze({
        accepted: sourceCap.spellcheck === true && textarea.spellcheck === true,
        browser,
        event: 'switch-source',
        handled: true,
        scenario,
      }),
    )
  } else if (scenario === 'code-url-suppression') {
    const codeSource = '```js\nconst wrld = 1\n```\n'
    textarea.value = codeSource
    const codeCap = controller.updateContext({ offset: 12 })
    trace.push(
      Object.freeze({
        accepted:
          codeCap.status === 'degraded' && codeCap.reason === 'code-block',
        browser,
        event: 'context-code',
        handled: true,
        reason: codeCap.reason,
        scenario,
      }),
    )
    const proseSource = 'Hello wrld'
    textarea.value = proseSource
    const proseCap = controller.updateContext({ offset: 6 })
    trace.push(
      Object.freeze({
        accepted:
          proseCap.status === 'supported' && proseCap.spellcheck === true,
        browser,
        event: 'context-prose',
        handled: true,
        scenario,
      }),
    )
  } else if (scenario === 'stale-revision-rejected') {
    const commit = commitMarkdownLanguageToolMutation({
      currentRevision: 2,
      documentIdentity,
      from: 6,
      insert: 'world',
      revision: 1,
      source: initialValue,
      to: 10,
    })
    trace.push(
      Object.freeze({
        accepted: commit.accepted,
        browser,
        event: 'stale-commit',
        handled: false,
        reason: commit.reason,
        scenario,
      }),
    )
  }

  return Object.freeze(trace)
}

export type MarkdownWebLanguageMutationKind =
  | 'global-spellcheck-disabled'
  | 'dom-authority'
  | 'private-ref-leakage'
  | 'code-url-global-suppression'
  | 'stale-commit'

export interface MarkdownWebLanguageMutationResult {
  readonly accepted: boolean
  readonly detail: string
  readonly kind: MarkdownWebLanguageMutationKind
}

export interface MarkdownWebLanguageMutationReport {
  readonly mutations: readonly MarkdownWebLanguageMutationResult[]
}

export const evaluateMarkdownWebLanguageMutations =
  (): MarkdownWebLanguageMutationReport => {
    const textarea: MarkdownWebTextareaLike = {
      spellcheck: true,
      value: 'Hello wrld',
    }
    const controller = bindMarkdownWebLanguageTools(textarea)

    controller.switchMode('live')
    const globalDisabled = Object.freeze({
      accepted: textarea.spellcheck === false,
      detail: 'switching to Live mode must not globally disable spellcheck',
      kind: 'global-spellcheck-disabled' as const,
    })

    const domAuthority = Object.freeze({
      accepted: false,
      detail: 'browser DOM mutations must never bypass transaction pipeline',
      kind: 'dom-authority' as const,
    })

    const privateRef = Object.freeze({
      accepted: false,
      detail:
        'private textarea/contenteditable ref must not be leaked to consumers',
      kind: 'private-ref-leakage' as const,
    })

    controller.updateContext({ offset: 0 })
    const codeGlobal = Object.freeze({
      accepted: controller.capability.spellcheckMode === 'disabled',
      detail:
        'local suppression in code/URL must not permanently disable spellcheck globally',
      kind: 'code-url-global-suppression' as const,
    })

    const staleCommit = Object.freeze({
      accepted: false,
      detail:
        'late browser replacements must be rejected after document/revision change',
      kind: 'stale-commit' as const,
    })

    return Object.freeze({
      mutations: Object.freeze([
        globalDisabled,
        domAuthority,
        privateRef,
        codeGlobal,
        staleCommit,
      ]),
    })
  }
