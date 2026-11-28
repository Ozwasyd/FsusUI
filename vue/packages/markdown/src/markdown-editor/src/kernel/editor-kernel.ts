import type {
  MarkdownDocumentIdentity,
  MarkdownStableProjection,
} from '@fsusui/wasm/markdown-runtime'
import type {
  MarkdownEditorCommand,
  MarkdownEditorCommandContext,
  MarkdownEditorInsertOptions,
  MarkdownEditorMetricsChange,
} from '../markdown-editor'
import {
  abortMarkdownEditorCommandSessions,
  createMarkdownEditorCommandSession,
  rebaseMarkdownEditorCommandSession,
  resolveMarkdownEditorCommandSession,
  type MarkdownEditorCommandPendingState,
  type MarkdownEditorCommandSession,
} from '../markdown-editor-command-async'
import type { MarkdownEditorCommandRuntimeState } from '../markdown-editor-command-snapshot'
import {
  composeMarkdownEditorPositionMapInstances,
  createMarkdownEditorPositionMap,
  deriveMarkdownEditorChange,
  MarkdownEditorTransactionStore,
  toMarkdownEditorTransactionEvent,
  type MarkdownEditorDispatchResult,
  type MarkdownEditorHistoryState,
  type MarkdownEditorInputMergeDirection,
  type MarkdownEditorPositionMap,
  type MarkdownEditorSelection,
  type MarkdownEditorTransaction,
  type MarkdownEditorTransactionEvent,
  type MarkdownEditorTransactionRejection,
} from '../markdown-editor-transaction'

export type MarkdownEditorKernelOperation =
  | {
      readonly allowBlocked?: boolean
      readonly emitValue?: boolean
      readonly internalPropReset?: boolean
      readonly kind: 'transaction'
      readonly mergeDirection?: MarkdownEditorInputMergeDirection
      readonly restoreSelection?: boolean
      readonly transaction: MarkdownEditorTransaction
    }
  | {
      readonly kind: 'undo' | 'redo'
      readonly restoreSelection?: boolean
    }

export interface MarkdownEditorKernelDispatchGuards {
  readonly blocked: boolean
  readonly composing: boolean
  readonly currentProjection?: MarkdownStableProjection
}

export interface MarkdownEditorKernelDispatchOutcome {
  readonly appliedChanges: readonly MarkdownEditorTransaction['changes'][number][]
  readonly commandStateChanged?: boolean
  readonly emitValue: boolean
  readonly event: MarkdownEditorTransactionEvent
  readonly historyChanged: boolean
  readonly metricsChange?: MarkdownEditorMetricsChange
  readonly ownedAttachmentItemId?: string
  readonly previousRevision: number
  readonly previousValue: string
  readonly restoreSelection: boolean
  readonly result: MarkdownEditorDispatchResult
  readonly selectionChanged: boolean
  readonly valueChanged: boolean
}

export interface MarkdownEditorKernelOptions {
  readonly documentIdentity: MarkdownDocumentIdentity
  readonly initialSelection?: MarkdownEditorSelection
  readonly initialValue: string
  readonly maxPositionMaps?: number
}

export const areMarkdownEditorHistoriesEqual = (
  first: MarkdownEditorHistoryState,
  second: MarkdownEditorHistoryState,
) =>
  first.undoDepth === second.undoDepth &&
  first.redoDepth === second.redoDepth &&
  first.retainedUnits === second.retainedUnits &&
  first.canUndo === second.canUndo &&
  first.canRedo === second.canRedo

export const rebaseMarkdownEditorCommandTransaction = (
  transaction: MarkdownEditorTransaction,
  positionMap: MarkdownEditorPositionMap | undefined,
): MarkdownEditorTransaction | undefined => {
  if (!positionMap) return transaction
  const changes = transaction.changes.map((change) => {
    const rebased = positionMap.rebase({
      start: change.from,
      end: change.to,
    })
    if (rebased.status !== 'mapped') return undefined
    return Object.freeze({
      from: rebased.start,
      to: rebased.end,
      insert: change.insert,
    })
  })
  if (changes.some((change) => change === undefined)) return undefined
  const selection = transaction.selection
    ? positionMap.rebase({
        start: transaction.selection.start,
        end: transaction.selection.end,
      })
    : undefined
  if (selection?.status === 'deleted') return undefined
  return Object.freeze({
    ...transaction,
    changes: changes as MarkdownEditorTransaction['changes'],
    ...(selection
      ? {
          selection: {
            direction: transaction.selection?.direction,
            start: selection.start,
            end: selection.end,
          },
        }
      : {}),
  })
}

const operationToTransaction = (
  operation: MarkdownEditorKernelOperation,
  documentIdentity: MarkdownDocumentIdentity,
): MarkdownEditorTransaction => {
  if (operation.kind === 'transaction') {
    return Object.freeze({
      ...operation.transaction,
      documentIdentity:
        operation.transaction.documentIdentity ?? documentIdentity,
    })
  }
  return Object.freeze({
    changes: [],
    history: 'skip',
    metadata: Object.freeze({ action: operation.kind }),
    origin: 'command',
  })
}

/**
 * Zero-Vue, zero-DOM headless editor kernel owning the document transaction
 * store, bounded revision position-map history, and async command sessions.
 */
export class MarkdownEditorKernel {
  readonly store: MarkdownEditorTransactionStore
  readonly commandSessions = new Map<string, MarkdownEditorCommandSession>()
  readonly commandRuntimeStates = new Map<
    string,
    MarkdownEditorCommandRuntimeState
  >()
  readonly commandContextSignal = new AbortController().signal
  private readonly revisionPositionMaps = new Map<
    number,
    MarkdownEditorPositionMap
  >()
  private readonly maxPositionMaps: number
  private documentIdentity: MarkdownDocumentIdentity
  private readonly transactionListeners = new Set<
    (outcome: MarkdownEditorKernelDispatchOutcome) => void
  >()
  private readonly commandStateListeners = new Set<() => void>()

  constructor(options: MarkdownEditorKernelOptions) {
    this.documentIdentity = options.documentIdentity
    this.maxPositionMaps = options.maxPositionMaps ?? 128
    const selection: MarkdownEditorSelection = options.initialSelection ?? {
      direction: 'none',
      end: options.initialValue.length,
      start: options.initialValue.length,
    }
    this.store = new MarkdownEditorTransactionStore(
      options.initialValue,
      selection,
      options.documentIdentity,
    )
  }

  get value() {
    return this.store.value
  }

  get revision() {
    return this.store.revision
  }

  get selection() {
    return this.store.selection
  }

  get history() {
    return this.store.history
  }

  onTransaction(
    listener: (outcome: MarkdownEditorKernelDispatchOutcome) => void,
  ): () => void {
    this.transactionListeners.add(listener)
    return () => {
      this.transactionListeners.delete(listener)
    }
  }

  onCommandStateChange(listener: () => void): () => void {
    this.commandStateListeners.add(listener)
    return () => {
      this.commandStateListeners.delete(listener)
    }
  }

  private notifyCommandStateChange() {
    for (const listener of this.commandStateListeners) listener()
  }

  setCommandRuntimeState(
    key: string,
    runtimeState: MarkdownEditorCommandRuntimeState,
  ) {
    this.commandRuntimeStates.set(key, runtimeState)
    this.notifyCommandStateChange()
  }

  abortPendingCommands(reason = 'editor-reset') {
    for (const session of this.commandSessions.values()) {
      session.abort.abort(reason)
      this.commandRuntimeStates.set(session.key, { state: 'aborted' })
    }
    abortMarkdownEditorCommandSessions(this.commandSessions.values(), reason)
    this.commandSessions.clear()
    this.notifyCommandStateChange()
  }

  beginCommandSession(
    command: MarkdownEditorCommand,
    context: MarkdownEditorCommandContext,
    anchorRange: Readonly<{ start: number; end: number }>,
  ): MarkdownEditorCommandSession | null {
    const active = this.commandSessions.get(command.key)
    if (active?.state === 'pending' && !command.concurrent) return null
    const session = createMarkdownEditorCommandSession(command.key, context, {
      activeSessions: this.commandSessions,
      anchor: {
        ...anchorRange,
        nodeId: context.syntax?.nodeId,
      },
      concurrent: command.concurrent,
    })
    this.commandSessions.set(command.key, session)
    this.setCommandRuntimeState(command.key, { state: 'pending' })
    return session
  }

  isCurrentCommandSession(
    key: string,
    session: MarkdownEditorCommandSession,
  ): boolean {
    return this.commandSessions.get(key) === session
  }

  rebaseCommandSession(
    session: MarkdownEditorCommandSession,
    currentContext: MarkdownEditorCommandContext,
    positionMap: MarkdownEditorPositionMap | undefined,
  ): MarkdownEditorCommandPendingState {
    const state = rebaseMarkdownEditorCommandSession(
      session,
      currentContext,
      positionMap,
    )
    if (state !== 'pending') {
      this.setCommandRuntimeState(session.key, { state })
    }
    return state
  }

  resolveCommandSession(
    session: MarkdownEditorCommandSession,
    currentContext: MarkdownEditorCommandContext,
    targetState: 'resolved-current' | 'rejected',
    error?: unknown,
  ): MarkdownEditorCommandPendingState {
    const state = resolveMarkdownEditorCommandSession(
      session,
      currentContext,
      targetState,
      error,
    )
    this.setCommandRuntimeState(
      session.key,
      error === undefined ? { state } : { error, state },
    )
    return state
  }

  clearCommandSession(key: string, session: MarkdownEditorCommandSession) {
    if (this.commandSessions.get(key) === session) {
      this.commandSessions.delete(key)
    }
  }

  clearPositionMaps() {
    this.revisionPositionMaps.clear()
  }

  positionMapFromRevision(
    fromRevision: number,
    toRevision: number,
    currentProjection?: MarkdownStableProjection,
  ): MarkdownEditorPositionMap | undefined {
    if (fromRevision === toRevision) {
      return createMarkdownEditorPositionMap([], {
        documentIdentity: this.documentIdentity,
        projection: currentProjection,
        source: this.store.value,
      })
    }
    const maps: MarkdownEditorPositionMap[] = []
    for (let revision = fromRevision; revision < toRevision; revision += 1) {
      const map = this.revisionPositionMaps.get(revision)
      if (!map) return undefined
      maps.push(map)
    }
    return composeMarkdownEditorPositionMapInstances(maps)
  }

  private rejectedResult(
    reason: MarkdownEditorTransactionRejection,
  ): MarkdownEditorDispatchResult {
    return Object.freeze({
      accepted: false,
      beforeRevision: this.store.revision,
      documentIdentity: this.store.documentIdentity,
      history: this.store.history,
      reason,
      revision: this.store.revision,
      selection: this.store.selection,
      value: this.store.value,
    })
  }

  dispatchOperation(
    operation: MarkdownEditorKernelOperation,
    guards: MarkdownEditorKernelDispatchGuards,
  ): MarkdownEditorKernelDispatchOutcome {
    const transaction = operationToTransaction(operation, this.documentIdentity)
    const blocked =
      operation.kind === 'transaction'
        ? !operation.allowBlocked && guards.blocked
        : guards.blocked
    const compositionBlocked =
      guards.composing &&
      !(operation.kind === 'transaction' && operation.internalPropReset)

    if (blocked || compositionBlocked) {
      const result = this.rejectedResult(
        blocked ? 'disabled' : 'composition-active',
      )
      const outcome: MarkdownEditorKernelDispatchOutcome = {
        appliedChanges: [],
        emitValue: false,
        event: toMarkdownEditorTransactionEvent(transaction, result),
        historyChanged: false,
        previousRevision: this.store.revision,
        previousValue: this.store.value,
        restoreSelection: false,
        result,
        selectionChanged: false,
        valueChanged: false,
      }
      for (const listener of this.transactionListeners) listener(outcome)
      return outcome
    }

    const previousValue = this.store.value
    const previousRevision = this.store.revision
    const previousSelection = this.store.selection
    const previousHistory = this.store.history

    const result =
      operation.kind === 'transaction'
        ? this.store.dispatch(transaction, {
            mergeDirection: operation.mergeDirection,
            now: Date.now(),
          })
        : operation.kind === 'undo'
          ? this.store.undo()
          : this.store.redo()

    const valueChanged = result.accepted && result.value !== previousValue
    let metricsChange: MarkdownEditorMetricsChange | undefined
    let appliedChanges: readonly MarkdownEditorTransaction['changes'][number][] =
      []

    if (valueChanged) {
      const derived = deriveMarkdownEditorChange(previousValue, result.value)
      metricsChange =
        operation.kind === 'transaction' &&
        operation.transaction.changes.length === 1
          ? operation.transaction.changes[0]
          : derived
      appliedChanges =
        operation.kind === 'transaction'
          ? operation.transaction.changes
          : derived
            ? [derived]
            : []

      if (derived) {
        this.revisionPositionMaps.set(
          previousRevision,
          guards.currentProjection
            ? createMarkdownEditorPositionMap([derived], {
                documentIdentity: this.documentIdentity,
                projection: guards.currentProjection,
                source: previousValue,
              })
            : createMarkdownEditorPositionMap([derived], {
                documentIdentity: this.documentIdentity,
                source: previousValue,
              }),
        )
        while (this.revisionPositionMaps.size > this.maxPositionMaps) {
          const oldest = this.revisionPositionMaps.keys().next().value
          if (oldest === undefined) break
          this.revisionPositionMaps.delete(oldest)
        }
      }
    }

    const selectionChanged =
      result.accepted &&
      (result.selection.start !== previousSelection.start ||
        result.selection.end !== previousSelection.end ||
        result.selection.direction !== previousSelection.direction)
    const historyChanged =
      result.accepted &&
      !areMarkdownEditorHistoriesEqual(previousHistory, result.history)

    const outcome: MarkdownEditorKernelDispatchOutcome = {
      appliedChanges,
      emitValue:
        valueChanged &&
        (operation.kind !== 'transaction' || operation.emitValue !== false),
      event: toMarkdownEditorTransactionEvent(transaction, result),
      historyChanged,
      metricsChange,
      ownedAttachmentItemId:
        operation.kind === 'transaction' &&
        typeof operation.transaction.metadata?.attachmentItemId === 'string'
          ? operation.transaction.metadata.attachmentItemId
          : undefined,
      previousRevision,
      previousValue,
      restoreSelection:
        result.accepted && operation.restoreSelection !== false,
      result,
      selectionChanged,
      valueChanged,
    }
    for (const listener of this.transactionListeners) listener(outcome)
    return outcome
  }

  createInsertTransaction(
    markdown: string,
    selection: MarkdownEditorSelection,
    options: MarkdownEditorInsertOptions = {},
  ): MarkdownEditorTransaction {
    const cursor = selection.start + markdown.length
    return {
      changes: [
        {
          from: selection.start,
          insert: markdown,
          to: selection.end,
        },
      ],
      expectedRevision: options.expectedRevision,
      history: 'separate',
      metadata: options.metadata,
      origin: 'programmatic',
      selection: {
        direction: 'none',
        end: cursor,
        start: cursor,
      },
    }
  }

  switchDocument(
    documentIdentity: MarkdownDocumentIdentity,
    nextValue: string,
  ) {
    const previousHistory = this.store.history
    this.abortPendingCommands()
    this.documentIdentity = documentIdentity
    this.clearPositionMaps()
    this.store.switchDocument(documentIdentity, nextValue)
    return {
      history: this.store.history,
      historyChanged: !areMarkdownEditorHistoriesEqual(
        previousHistory,
        this.store.history,
      ),
      revision: this.store.revision,
      selection: this.store.selection,
      value: this.store.value,
    }
  }
}
