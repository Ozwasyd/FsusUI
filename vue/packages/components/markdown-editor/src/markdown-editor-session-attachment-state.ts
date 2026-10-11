import { toRaw } from 'vue'
import { inspectMarkdownAttachmentDispatch } from './markdown-editor-attachment-lifecycle'
import type { MarkdownAttachmentJob } from './markdown-editor-attachment-lifecycle'
import type { MarkdownEditorSessionAttachmentState } from './markdown-editor-session-panels'

/** Same original jobs/dispatches, no cloned job/controller, attempt minting or terminal replay. */
export const captureMarkdownEditorSessionAttachmentState = (
  readJobs: () => readonly MarkdownAttachmentJob[],
  assertOwnerQuiescent: () => void,
): {
  readonly state: readonly MarkdownEditorSessionAttachmentState[]
  isCurrent(): boolean
} | null => {
  if (typeof WeakRef !== 'function') return null
  try { assertOwnerQuiescent() } catch { return null }
  const jobs = readJobs().map((job) => toRaw(job))
  const proofs = jobs.map(inspectMarkdownAttachmentDispatch)
  const jobReferences = jobs.map((job) => new WeakRef(job))
  const controllers = jobs.map((job) => job.signalController ? new WeakRef(job.signalController) : null)
  // UI terminal phase/abort alone cannot prove the original invocation settled.
  if (jobs.some((job, index) => !job.documentIdentity || job.revision === undefined ||
    job.phase === 'pending' || job.phase === 'progress' ||
    !proofs[index]?.settlementAvailable || !proofs[index]?.settled || proofs[index]?.dispatching)) return null
  const readState = (job: MarkdownAttachmentJob): MarkdownEditorSessionAttachmentState => Object.freeze({
    id: job.id, batchId: job.batchId ?? null, itemId: job.itemId ?? null,
    documentIdentity: Object.freeze({ ...job.documentIdentity! }), revision: job.revision!,
    attempt: job.attempt, phase: job.phase, progress: job.progress,
    code: job.code ?? null, message: job.message ?? null,
    range: job.range ? Object.freeze({ ...job.range }) : null,
    signalAborted: job.signalController?.signal.aborted ?? null,
  })
  const state = Object.freeze(jobs.map(readState))
  const serialized = JSON.stringify(state)
  return Object.freeze({
    state,
    isCurrent() {
      try { assertOwnerQuiescent() } catch { return false }
      const current = readJobs().map((job) => toRaw(job))
      return current.length === jobReferences.length && current.every((job, index) => {
        const proof = inspectMarkdownAttachmentDispatch(job)
        return job === jobReferences[index]!.deref() && job.signalController === (controllers[index]?.deref() ?? undefined) &&
          proof?.dispatchRef === proofs[index]?.dispatchRef &&
          proof?.settled === true && proof.settlementAvailable && !proof.dispatching
      }) && JSON.stringify(current.map(readState)) === serialized
    },
  })
}
