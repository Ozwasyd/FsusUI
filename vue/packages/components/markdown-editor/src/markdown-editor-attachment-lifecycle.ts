export type MarkdownAttachmentPhase =
  | 'idle'
  | 'pending'
  | 'progress'
  | 'resolved'
  | 'rejected'
  | 'cancelled'

export interface MarkdownAttachmentJob {
  readonly id: string
  phase: MarkdownAttachmentPhase
  progress: number
}

export const createMarkdownAttachmentJob = (id: string): MarkdownAttachmentJob => ({
  id,
  phase: 'pending',
  progress: 0,
})

export const progressMarkdownAttachmentJob = (job: MarkdownAttachmentJob, progress: number) => {
  if (job.phase === 'cancelled') return job
  job.phase = 'progress'
  job.progress = progress
  return job
}

export const cancelMarkdownAttachmentJob = (job: MarkdownAttachmentJob) => {
  job.phase = 'cancelled'
  return job
}

export const retryMarkdownAttachmentJob = (job: MarkdownAttachmentJob) => {
  job.phase = 'pending'
  job.progress = 0
  return job
}

export const evaluateMarkdownAttachmentLifecycleMutations = () =>
  Object.freeze({
    mutations: Object.freeze([
      Object.freeze({ kind: 'library-owned-store' as const, equivalent: false, accepted: false }),
    ]),
  })
