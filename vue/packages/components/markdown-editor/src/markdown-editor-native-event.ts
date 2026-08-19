import type {
  BeforeInputSnapshot,
  MarkdownEditorDocumentIdentity,
  MarkdownEditorHistoryMode,
  MarkdownEditorInputMergeDirection,
  MarkdownEditorSelection,
  MarkdownEditorTransactionOrigin,
} from './markdown-editor-transaction'

export const MARKDOWN_NATIVE_SYNTHETIC_BROWSERS = Object.freeze([
  'chromium',
  'firefox',
  'webkit',
] as const)

export const MARKDOWN_NATIVE_TRACE_LIMIT = 128

export type MarkdownNativeSyntheticBrowser =
  (typeof MARKDOWN_NATIVE_SYNTHETIC_BROWSERS)[number]

export type MarkdownNativePhase =
  | 'idle'
  | 'composing'
  | 'committing'
  | 'aborted'
  | 'draining'

export type MarkdownNativeEventKind =
  | 'compositionstart'
  | 'compositionupdate'
  | 'compositionend'
  | 'beforeinput'
  | 'input'
  | 'paste'
  | 'drop'
  | 'external-reset'
  | 'document-switch'

export type MarkdownNativeAction =
  | 'ignore'
  | 'snapshot'
  | 'dispatch'
  | 'commit'
  | 'undo'
  | 'redo'
  | 'prevent'
  | 'dedup'
  | 'abort'

export type MarkdownNativeRejection =
  | 'composition-active'
  | 'disabled'
  | 'stale-document'
  | 'orphaned-composition'
  | 'native-undo'

export interface MarkdownNativeEventInput {
  readonly browser?: MarkdownNativeSyntheticBrowser
  readonly clipboardIdentity?: string
  readonly currentIdentity?: MarkdownEditorDocumentIdentity
  readonly data?: string | null
  readonly disabled?: boolean
  readonly documentIdentity?: MarkdownEditorDocumentIdentity
  readonly expectedRevision?: number
  readonly inputType?: string
  readonly isComposing?: boolean
  readonly kind: MarkdownNativeEventKind
  readonly origin?: Extract<MarkdownEditorTransactionOrigin, 'paste' | 'drop'>
  readonly previousValue?: string
  readonly revision?: number
  readonly selection?: MarkdownEditorSelection
  readonly value?: string
}

export interface MarkdownNativeEventPlan {
  readonly action: MarkdownNativeAction
  readonly composition: boolean
  readonly freezeSmartInput: boolean
  readonly history: MarkdownEditorHistoryMode
  readonly identity: string | null
  readonly mergeDirection: MarkdownEditorInputMergeDirection
  readonly origin: MarkdownEditorTransactionOrigin
  readonly phase: MarkdownNativePhase
  readonly preventDefault: boolean
  readonly rejected?: MarkdownNativeRejection
  readonly restoreDisplay: boolean
  readonly snapshot?: BeforeInputSnapshot
}

export interface MarkdownNativeTraceEntry {
  readonly action: MarkdownNativeAction
  readonly browser?: MarkdownNativeSyntheticBrowser
  readonly identity: string | null
  readonly inputType?: string
  readonly kind: MarkdownNativeEventKind
  readonly phase: MarkdownNativePhase
  readonly rejected?: MarkdownNativeRejection
  readonly revision?: number
}

export type MarkdownNativeMutationKind =
  | 'timeout-dedup'
  | 'composition-transform'
  | 'native-undo'
  | 'stale-commit'

export interface MarkdownEditorNativeEventMachine {
  apply(event: MarkdownNativeEventInput): MarkdownNativeEventPlan
  readonly composing: boolean
  readonly freezeSmartInput: boolean
  readonly phase: MarkdownNativePhase
  readonly snapshot: BeforeInputSnapshot | undefined
  readonly trace: readonly MarkdownNativeTraceEntry[]
}

const sameDocument = (
  left?: MarkdownEditorDocumentIdentity,
  right?: MarkdownEditorDocumentIdentity,
) => {
  if (!left || !right) return true
  return left.id === right.id && left.epoch === right.epoch
}

const isCompositionInputType = (inputType?: string, isComposing?: boolean) =>
  isComposing === true || inputType === 'insertCompositionText'

const inferOrigin = (
  inputType: string | undefined,
  origin?: Extract<MarkdownEditorTransactionOrigin, 'paste' | 'drop'>,
): MarkdownEditorTransactionOrigin => {
  if (origin) return origin
  if (inputType === 'insertFromPaste') return 'paste'
  if (inputType === 'insertFromDrop') return 'drop'
  return 'input'
}

const mergeDirectionFor = (
  inputType: string | undefined,
  selection?: MarkdownEditorSelection,
): MarkdownEditorInputMergeDirection => {
  if (!selection || selection.start !== selection.end) return 'none'
  if (
    inputType === 'deleteContentBackward' ||
    inputType === 'deleteWordBackward' ||
    inputType === 'deleteSoftLineBackward'
  ) {
    return 'backward'
  }
  if (
    inputType === 'deleteContentForward' ||
    inputType === 'deleteWordForward' ||
    inputType === 'deleteSoftLineForward' ||
    inputType === 'insertText' ||
    inputType === 'insertLineBreak' ||
    inputType === 'insertReplacementText'
  ) {
    return 'forward'
  }
  return 'none'
}

const hashText = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export const markdownNativeEventIdentity = (event: MarkdownNativeEventInput) => {
  const selection = event.selection
  const body = [
    event.kind,
    event.inputType ?? '',
    event.data ?? '',
    event.clipboardIdentity ?? '',
    String(event.revision ?? 0),
    String(selection?.start ?? ''),
    String(selection?.end ?? ''),
    event.value ?? '',
  ].join(':')
  return `native:${hashText(body)}`
}

const planOf = (
  action: MarkdownNativeAction,
  phase: MarkdownNativePhase,
  extras: Partial<MarkdownNativeEventPlan> = {},
): MarkdownNativeEventPlan =>
  Object.freeze({
    action,
    composition: extras.composition ?? false,
    freezeSmartInput:
      extras.freezeSmartInput ??
      (phase === 'composing' || phase === 'committing'),
    history: extras.history ?? 'merge',
    identity: extras.identity ?? null,
    mergeDirection: extras.mergeDirection ?? 'none',
    origin: extras.origin ?? 'input',
    phase,
    preventDefault:
      extras.preventDefault ??
      (action === 'prevent' ||
        action === 'undo' ||
        action === 'redo' ||
        action === 'dedup'),
    rejected: extras.rejected,
    restoreDisplay: extras.restoreDisplay ?? action === 'prevent',
    snapshot: extras.snapshot,
  })

export const createMarkdownEditorNativeEventMachine = (options: {
  readonly documentIdentity?: MarkdownEditorDocumentIdentity
  readonly revision?: number
} = {}): MarkdownEditorNativeEventMachine => {
  let documentIdentity = options.documentIdentity
  let lastClipboardIdentity: string | undefined
  let lastCommitValue: string | undefined
  let lastIdentity: string | null = null
  let phase: MarkdownNativePhase = 'idle'
  let snapshot: BeforeInputSnapshot | undefined
  const trace: MarkdownNativeTraceEntry[] = []

  const pushTrace = (
    event: MarkdownNativeEventInput,
    next: MarkdownNativeEventPlan,
  ) => {
    trace.push(
      Object.freeze({
        action: next.action,
        browser: event.browser,
        identity: next.identity,
        inputType: event.inputType,
        kind: event.kind,
        phase: next.phase,
        rejected: next.rejected,
        revision: event.revision,
      }),
    )
    if (trace.length > MARKDOWN_NATIVE_TRACE_LIMIT) {
      trace.splice(0, trace.length - MARKDOWN_NATIVE_TRACE_LIMIT)
    }
  }

  const apply = (event: MarkdownNativeEventInput): MarkdownNativeEventPlan => {
    const identity = markdownNativeEventIdentity(event)
    const freeze = () => phase === 'composing' || phase === 'committing'

    if (
      event.kind !== 'document-switch' &&
      event.kind !== 'external-reset' &&
      (!sameDocument(event.documentIdentity, documentIdentity) ||
        !sameDocument(event.currentIdentity, documentIdentity) ||
        (event.expectedRevision !== undefined &&
          event.revision !== undefined &&
          event.expectedRevision !== event.revision))
    ) {
      const next = planOf('prevent', phase, {
        freezeSmartInput: freeze(),
        identity,
        rejected: 'stale-document',
        restoreDisplay: true,
      })
      pushTrace(event, next)
      return next
    }

    if (event.kind === 'document-switch' || event.kind === 'external-reset') {
      if (event.documentIdentity) documentIdentity = event.documentIdentity
      lastClipboardIdentity = undefined
      lastCommitValue = undefined
      lastIdentity = null
      snapshot = undefined
      const wasLive = phase === 'composing' || phase === 'committing'
      phase = wasLive ? 'aborted' : 'idle'
      const next = planOf(wasLive ? 'abort' : 'ignore', phase, {
        freezeSmartInput: false,
        identity,
        restoreDisplay: wasLive,
      })
      pushTrace(event, next)
      return next
    }

    if (event.disabled) {
      const next = planOf('prevent', phase, {
        freezeSmartInput: freeze(),
        identity,
        rejected: 'disabled',
      })
      pushTrace(event, next)
      return next
    }

    if (event.kind === 'compositionstart') {
      phase = 'composing'
      lastCommitValue = undefined
      snapshot = undefined
      const next = planOf('ignore', phase, {
        freezeSmartInput: true,
        identity,
      })
      pushTrace(event, next)
      return next
    }

    if (event.kind === 'compositionupdate') {
      if (phase !== 'composing') {
        const next = planOf('prevent', phase, {
          identity,
          rejected: 'orphaned-composition',
          restoreDisplay: true,
        })
        pushTrace(event, next)
        return next
      }
      const next = planOf('ignore', phase, {
        freezeSmartInput: true,
        identity,
      })
      pushTrace(event, next)
      return next
    }

    if (event.kind === 'compositionend') {
      if (phase === 'aborted') {
        phase = 'draining'
        const next = planOf('prevent', phase, {
          freezeSmartInput: false,
          identity,
          rejected: 'orphaned-composition',
          restoreDisplay: true,
        })
        pushTrace(event, next)
        return next
      }
      if (phase !== 'composing') {
        if (event.data) {
          phase = 'idle'
          lastCommitValue = (event.previousValue ?? '') + event.data
          lastIdentity = identity
          const next = planOf('commit', phase, {
            composition: true,
            freezeSmartInput: false,
            history: 'separate',
            identity,
            origin: 'input',
          })
          pushTrace(event, next)
          return next
        }
        const next = planOf('prevent', phase, {
          identity,
          rejected: 'orphaned-composition',
          restoreDisplay: true,
        })
        pushTrace(event, next)
        return next
      }
      const value = event.value ?? ''
      const previous = event.previousValue ?? ''
      if (value === previous) {
        if (event.data) {
          // WebKit hangul: compositionend.data holds the committed text
          // before the textarea value updates.
          phase = 'idle'
          lastCommitValue = previous + event.data
          lastIdentity = identity
          const next = planOf('commit', phase, {
            composition: true,
            freezeSmartInput: false,
            history: 'separate',
            identity,
            origin: 'input',
          })
          pushTrace(event, next)
          return next
        }
        phase = 'committing'
        const next = planOf('ignore', phase, {
          freezeSmartInput: true,
          identity,
        })
        pushTrace(event, next)
        return next
      }
      phase = 'idle'
      lastCommitValue = value
      lastIdentity = identity
      const next = planOf('commit', phase, {
        composition: true,
        freezeSmartInput: false,
        history: 'separate',
        identity,
        origin: 'input',
      })
      pushTrace(event, next)
      return next
    }

    if (event.kind === 'paste' || event.kind === 'drop') {
      if (phase === 'composing' || phase === 'committing') {
        const next = planOf('prevent', phase, {
          freezeSmartInput: true,
          identity,
          rejected: 'composition-active',
        })
        pushTrace(event, next)
        return next
      }
      lastClipboardIdentity = event.clipboardIdentity ?? identity
      lastIdentity = lastClipboardIdentity
      const next = planOf('ignore', phase, {
        identity: lastClipboardIdentity,
        origin: event.kind,
      })
      pushTrace(event, next)
      return next
    }

    if (event.kind === 'beforeinput') {
      if (event.inputType === 'historyUndo') {
        const next = planOf('undo', phase, {
          freezeSmartInput: freeze(),
          identity,
          preventDefault: true,
          rejected: 'native-undo',
        })
        pushTrace(event, next)
        return next
      }
      if (event.inputType === 'historyRedo') {
        const next = planOf('redo', phase, {
          freezeSmartInput: freeze(),
          identity,
          preventDefault: true,
        })
        pushTrace(event, next)
        return next
      }
      if (phase === 'draining') {
        const next = planOf('prevent', phase, {
          identity,
          restoreDisplay: true,
        })
        pushTrace(event, next)
        return next
      }
      if (
        (phase === 'aborted' || phase === 'idle') &&
        isCompositionInputType(event.inputType, event.isComposing)
      ) {
        const next = planOf('prevent', phase, {
          identity,
          rejected: 'orphaned-composition',
          restoreDisplay: true,
        })
        pushTrace(event, next)
        return next
      }
      if (
        lastClipboardIdentity &&
        (event.inputType === 'insertFromPaste' ||
          event.inputType === 'insertFromDrop')
      ) {
        const next = planOf('dedup', phase, {
          identity: lastClipboardIdentity,
          origin: inferOrigin(event.inputType),
          preventDefault: true,
        })
        pushTrace(event, next)
        return next
      }
      snapshot = Object.freeze({
        data: event.data ?? null,
        inputType: event.inputType ?? 'insertText',
        selection: event.selection ?? { start: 0, end: 0 },
        value: event.previousValue ?? event.value ?? '',
      })
      const next = planOf('snapshot', phase, {
        freezeSmartInput: freeze(),
        identity,
        preventDefault: false,
        snapshot,
      })
      pushTrace(event, next)
      return next
    }

    if (
      lastClipboardIdentity &&
      (event.inputType === 'insertFromPaste' ||
        event.inputType === 'insertFromDrop' ||
        event.origin === 'paste' ||
        event.origin === 'drop')
    ) {
      const owned = lastClipboardIdentity
      lastClipboardIdentity = undefined
      const next = planOf('dedup', phase, {
        identity: owned,
        origin: inferOrigin(event.inputType, event.origin),
        restoreDisplay: true,
      })
      pushTrace(event, next)
      return next
    }

    if (phase === 'draining') {
      phase = 'idle'
      snapshot = undefined
      const next = planOf('prevent', phase, {
        identity,
        restoreDisplay: true,
      })
      pushTrace(event, next)
      return next
    }

    if (phase === 'aborted') {
      if (isCompositionInputType(event.inputType, event.isComposing)) {
        const next = planOf('prevent', phase, {
          identity,
          rejected: 'orphaned-composition',
          restoreDisplay: true,
        })
        pushTrace(event, next)
        return next
      }
      phase = 'idle'
    }

    if (phase === 'composing') {
      const next = planOf('ignore', phase, {
        freezeSmartInput: true,
        identity,
        preventDefault: false,
        restoreDisplay: false,
      })
      pushTrace(event, next)
      return next
    }

    const value = event.value ?? ''
    if (lastCommitValue !== undefined && value === lastCommitValue) {
      lastCommitValue = undefined
      snapshot = undefined
      const next = planOf('dedup', phase, {
        composition: true,
        identity: lastIdentity,
        restoreDisplay: false,
      })
      pushTrace(event, next)
      return next
    }

    if (phase === 'committing') {
      phase = 'idle'
      lastCommitValue = value
      lastIdentity = identity
      snapshot = undefined
      const next = planOf('commit', phase, {
        composition: true,
        freezeSmartInput: false,
        history: 'separate',
        identity,
        origin: 'input',
      })
      pushTrace(event, next)
      return next
    }

    if (identity === lastIdentity && lastIdentity) {
      const next = planOf('dedup', phase, {
        identity,
        restoreDisplay: true,
      })
      pushTrace(event, next)
      return next
    }

    const origin = inferOrigin(event.inputType, event.origin)
    const inputType = event.inputType ?? snapshot?.inputType
    const composition = false
    lastIdentity = identity
    lastCommitValue = undefined
    snapshot = undefined
    const next = planOf('dispatch', phase, {
      composition,
      history: origin === 'input' ? 'merge' : 'separate',
      identity,
      mergeDirection: mergeDirectionFor(inputType, event.selection),
      origin,
      preventDefault: false,
      restoreDisplay: false,
    })
    pushTrace(event, next)
    return next
  }

  return {
    apply,
    get composing() {
      return phase === 'composing'
    },
    get freezeSmartInput() {
      return phase === 'composing' || phase === 'committing'
    },
    get phase() {
      return phase
    },
    get snapshot() {
      return snapshot
    },
    get trace() {
      return trace
    },
  }
}

export const markdownNativeSyntheticCompositionScript = (
  text: string,
  browser: MarkdownNativeSyntheticBrowser,
): readonly MarkdownNativeEventInput[] => {
  if (browser === 'chromium') {
    return Object.freeze([
      { browser, kind: 'compositionstart' as const },
      {
        browser,
        data: text,
        inputType: 'insertCompositionText',
        isComposing: true,
        kind: 'beforeinput' as const,
      },
      {
        browser,
        data: text,
        inputType: 'insertCompositionText',
        isComposing: true,
        kind: 'input' as const,
        previousValue: '',
        value: text,
      },
      {
        browser,
        data: text,
        kind: 'compositionend' as const,
        previousValue: '',
        value: text,
      },
    ])
  }
  if (browser === 'firefox') {
    return Object.freeze([
      { browser, kind: 'compositionstart' as const },
      { browser, data: text, kind: 'compositionupdate' as const },
      {
        browser,
        data: text,
        kind: 'compositionend' as const,
        previousValue: '',
        value: text,
      },
      {
        browser,
        data: text,
        inputType: 'insertText',
        kind: 'input' as const,
        previousValue: text,
        value: text,
      },
    ])
  }
  return Object.freeze([
    { browser, kind: 'compositionstart' as const },
    {
      browser,
      data: text,
      inputType: 'insertCompositionText',
      isComposing: true,
      kind: 'input' as const,
      previousValue: '',
      value: text,
    },
    {
      browser,
      data: text,
      kind: 'compositionend' as const,
      previousValue: '',
      value: text,
    },
  ])
}

export interface MarkdownNativeHarnessResult {
  readonly commits: number
  readonly plans: readonly MarkdownNativeEventPlan[]
  readonly trace: readonly MarkdownNativeTraceEntry[]
}

export const driveMarkdownNativeHarnessTrace = (
  events: readonly MarkdownNativeEventInput[],
  options?: {
    readonly documentIdentity?: MarkdownEditorDocumentIdentity
    readonly revision?: number
  },
): MarkdownNativeHarnessResult => {
  const machine = createMarkdownEditorNativeEventMachine(options)
  const plans = events.map((event) => machine.apply(event))
  return Object.freeze({
    commits: plans.filter(
      (plan) => plan.action === 'commit',
    ).length,
    plans: Object.freeze(plans),
    trace: machine.trace,
  })
}

export const evaluateMarkdownNativeEventMutations = () => {
  const timeoutMachine = createMarkdownEditorNativeEventMachine()
  const first = timeoutMachine.apply({
    data: 'a',
    inputType: 'insertText',
    kind: 'input',
    previousValue: '',
    revision: 0,
    selection: { start: 1, end: 1 },
    value: 'a',
  })
  const second = timeoutMachine.apply({
    data: 'b',
    inputType: 'insertText',
    kind: 'input',
    previousValue: 'a',
    revision: 1,
    selection: { start: 2, end: 2 },
    value: 'ab',
  })

  const composeMachine = createMarkdownEditorNativeEventMachine()
  composeMachine.apply({ kind: 'compositionstart' })
  const mid = composeMachine.apply({
    data: '- ',
    inputType: 'insertCompositionText',
    isComposing: true,
    kind: 'input',
    previousValue: '',
    value: '- item',
  })

  const undoMachine = createMarkdownEditorNativeEventMachine()
  const undo = undoMachine.apply({
    inputType: 'historyUndo',
    kind: 'beforeinput',
  })

  const staleMachine = createMarkdownEditorNativeEventMachine({
    documentIdentity: { epoch: 0, id: 'doc' },
  })
  staleMachine.apply({
    documentIdentity: { epoch: 0, id: 'doc' },
    kind: 'compositionstart',
  })
  staleMachine.apply({
    documentIdentity: { epoch: 1, id: 'doc' },
    kind: 'document-switch',
    revision: 1,
  })
  const stale = staleMachine.apply({
    data: '幽灵',
    documentIdentity: { epoch: 0, id: 'doc' },
    kind: 'compositionend',
    previousValue: '',
    value: '幽灵',
  })

  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        accepted: first.identity === second.identity && first.action === second.action,
        detail: 'distinct keystrokes must not share a timeout identity',
        equivalent: first.identity === second.identity,
        kind: 'timeout-dedup' as const,
      }),
      Object.freeze({
        accepted: mid.action === 'dispatch' || mid.action === 'commit',
        detail: 'composition must not dispatch pair/list transforms',
        equivalent: mid.action !== 'ignore',
        kind: 'composition-transform' as const,
      }),
      Object.freeze({
        accepted: undo.action === 'dispatch',
        detail: 'historyUndo is store undo, not a native value transaction',
        equivalent: undo.action !== 'undo',
        kind: 'native-undo' as const,
      }),
      Object.freeze({
        accepted: stale.action === 'commit',
        detail: 'stale epoch must not commit a leftover composition',
        equivalent: stale.action === 'commit',
        kind: 'stale-commit' as const,
      }),
    ]),
  })
}
