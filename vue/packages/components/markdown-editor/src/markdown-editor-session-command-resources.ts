import type { MarkdownEditorCommand } from './markdown-editor'
import type { MarkdownEditorCommandSession } from './markdown-editor-command-async'
import type { MarkdownEditorDocumentIdentity } from './markdown-editor-transaction'
import type { MarkdownEditorSessionResourceParticipant } from './markdown-editor-session-resources'

/** Resource accounting only; command state remains on the original attempt. */
export const createMarkdownEditorSessionCommandResources = (
  readContext: () => {
    readonly documentIdentity: MarkdownEditorDocumentIdentity
    readonly disposed: boolean
    readonly commands: readonly MarkdownEditorCommand[]
  },
  isEditorOwned: (command: MarkdownEditorCommand) => boolean,
) => {
  const pending = new Map<MarkdownEditorCommandSession, {
    readonly lifecycleEpoch: number
    readonly editorOwned: boolean
  }>()
  let lifecycleEpoch = 0
  let pauseRequested = false

  const canInspect = () => readContext().commands.every(isEditorOwned) &&
    [...pending.values()].every((attempt) => attempt.editorOwned)
  const isCurrent = (session: MarkdownEditorCommandSession) => {
    const attempt = pending.get(session)
    const context = readContext()
    return attempt !== undefined && !pauseRequested && !context.disposed &&
      attempt.lifecycleEpoch === lifecycleEpoch && !session.abort.signal.aborted &&
      session.documentId === context.documentIdentity.id &&
      session.epoch === context.documentIdentity.epoch
  }
  const abortPending = (reason: string) => {
    for (const session of pending.keys()) {
      session.abort.abort(reason)
      session.state = 'aborted'
    }
    // Neither AbortSignal nor removing an entry from the command-key map proves
    // the provider promise settled. The attempt stays counted through finally.
  }
  const inspect: MarkdownEditorSessionResourceParticipant['inspect'] = () => {
    if (!canInspect()) throw new Error('editor-session-external-command-resource-owner-unavailable')
    return Object.freeze({
      ownerRef: 'async-command',
      paused: pauseRequested && pending.size === 0,
      recoverable: false,
      retainedListeners: 0,
      usage: Object.freeze({
        editorInstances: 0, renderers: 0, observers: 0, timers: 0,
        backgroundTasks: pending.size,
        // Only the original editor-owned pure commands qualify this census.
        // An arbitrary public run() provider cannot promise zero network work.
        networkRequests: 0, memoryUnits: pending.size,
      }),
    })
  }
  const participant: MarkdownEditorSessionResourceParticipant = Object.freeze({
    ownerRef: 'async-command',
    inspect,
    pause() {
      inspect()
      lifecycleEpoch += 1
      pauseRequested = true
      abortPending('editor-session-paused')
      return inspect()
    },
    resume() {
      inspect()
      lifecycleEpoch += 1
      pauseRequested = false
      return inspect()
    },
    dispose() { throw new Error('editor-session-command-checkpoint-not-recoverable') },
  })
  return Object.freeze({
    participant,
    canInspect,
    isCurrent,
    abortPending,
    get paused() { return pauseRequested },
    begin(session: MarkdownEditorCommandSession, command: MarkdownEditorCommand) {
      if (pauseRequested || readContext().disposed) throw new Error('editor-session-command-owner-paused-or-disposed')
      pending.set(session, { lifecycleEpoch, editorOwned: isEditorOwned(command) })
    },
    finish(session: MarkdownEditorCommandSession) { pending.delete(session) },
  })
}
