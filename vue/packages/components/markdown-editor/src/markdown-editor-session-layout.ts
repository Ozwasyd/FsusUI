import { nextTick } from 'vue'
import type { MarkdownEditorDocumentIdentity } from './markdown-editor-transaction'
import type { MarkdownEditorFrameScheduler } from '../../../hooks/use-markdown-editor-frame-scheduler'
import type { MarkdownEditorSessionResourceParticipant } from './markdown-editor-session-resources'

interface LayoutContext {
  readonly documentIdentity: MarkdownEditorDocumentIdentity
  readonly revision: number
  readonly disposed: boolean
}

/** Tracks real deferred continuations; pending promises remain counted until settlement. */
export const createMarkdownEditorSessionLayoutResources = (
  scheduler: MarkdownEditorFrameScheduler,
  readContext: () => LayoutContext,
) => {
  let lifecycleEpoch = 0
  let pauseRequested = false
  const pending = new Set<object>()

  const lease = (sameRevision = true) => {
    const context = readContext()
    const epoch = lifecycleEpoch
    return () => {
      const current = readContext()
      return !pauseRequested && !current.disposed && epoch === lifecycleEpoch &&
        current.documentIdentity.id === context.documentIdentity.id &&
        current.documentIdentity.epoch === context.documentIdentity.epoch &&
        (!sameRevision || current.revision === context.revision)
    }
  }
  const afterTick = (run: (isCurrent: () => boolean) => void): Promise<void> => {
    if (pauseRequested || readContext().disposed) return Promise.resolve()
    const token = {}
    const isCurrent = lease()
    pending.add(token)
    return nextTick(() => {
      try { if (isCurrent()) run(isCurrent) } finally { pending.delete(token) }
    })
  }
  const microtask = (run: () => void) => {
    if (pauseRequested || readContext().disposed) return
    const token = {}
    const isCurrent = lease(false)
    pending.add(token)
    queueMicrotask(() => {
      try { if (isCurrent()) run() } finally { pending.delete(token) }
    })
  }
  const participant: MarkdownEditorSessionResourceParticipant = {
    ownerRef: 'editor-layout-callbacks',
    inspect() {
      return {
        ownerRef: 'editor-layout-callbacks',
        paused: pauseRequested && pending.size === 0,
        recoverable: false,
        retainedListeners: 0,
        usage: {
          editorInstances: 0, renderers: 0, observers: 0, timers: 0,
          backgroundTasks: pending.size, networkRequests: 0,
          memoryUnits: pending.size,
        },
      }
    },
    pause() {
      lifecycleEpoch += 1
      pauseRequested = true
      // Microtasks cannot be physically removed. Keep each lease counted until
      // its guarded callback actually settles; the host cannot acknowledge pause
      // while the census still contains an outstanding continuation.
      return this.inspect()
    },
    resume() {
      lifecycleEpoch += 1
      pauseRequested = false
      return this.inspect()
    },
    dispose() {
      throw new Error('editor-session-layout-checkpoint-not-recoverable')
    },
  }
  return Object.freeze({
    participant,
    afterTick,
    microtask,
    requestFrame: (run: () => void) => scheduler.requestAuxiliaryFrame(run, lease(false)),
    cancelFrame: (handle: number) => scheduler.cancelAuxiliaryFrame(handle),
  })
}
