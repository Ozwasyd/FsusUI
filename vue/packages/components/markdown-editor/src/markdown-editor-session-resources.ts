import type { MarkdownEditorSessionResourceUsage } from './markdown-editor-session'
import type { MarkdownEditorFrameScheduler } from '../../../hooks/use-markdown-editor-frame-scheduler'

export const markdownEditorSessionResourceOwners = Object.freeze([
  'frame-scheduler',
  'editor-surface',
  'editor-layout-callbacks',
  'renderer-projection',
  'language-search',
  'attachment-embed',
  'async-command',
] as const)

export type MarkdownEditorSessionResourceOwner =
  (typeof markdownEditorSessionResourceOwners)[number]

export interface MarkdownEditorSessionResourceInspection {
  readonly ownerRef: MarkdownEditorSessionResourceOwner
  readonly usage: MarkdownEditorSessionResourceUsage
  readonly paused: boolean
  readonly recoverable: boolean
  readonly retainedListeners: number
}

/** Each unique resource owner reports and controls only its own resources. */
export interface MarkdownEditorSessionResourceParticipant {
  readonly ownerRef: MarkdownEditorSessionResourceOwner
  inspect(): MarkdownEditorSessionResourceInspection
  pause(): MarkdownEditorSessionResourceInspection
  resume(): MarkdownEditorSessionResourceInspection
  dispose(snapshotRef: string): void
}

export interface MarkdownEditorSessionResourceCensus {
  readonly complete: boolean
  readonly participants: readonly MarkdownEditorSessionResourceInspection[]
  readonly missingOwners: readonly MarkdownEditorSessionResourceOwner[]
}

const assertInspection = (
  inspection: MarkdownEditorSessionResourceInspection,
  ownerRef: MarkdownEditorSessionResourceOwner,
) => {
  if (inspection.ownerRef !== ownerRef) {
    throw new Error('editor-session-resource-owner-mismatch')
  }
  const fields = [
    'editorInstances', 'renderers', 'observers', 'timers',
    'backgroundTasks', 'networkRequests', 'memoryUnits',
  ] as const
  for (const field of fields) {
    if (!Number.isSafeInteger(inspection.usage[field]) || inspection.usage[field] < 0) {
      throw new Error(`editor-session-resource-usage-invalid:${ownerRef}:${field}`)
    }
  }
  if (!Number.isSafeInteger(inspection.retainedListeners) || inspection.retainedListeners < 0) {
    throw new Error(`editor-session-resource-listener-usage-invalid:${ownerRef}`)
  }
  if (inspection.paused && (
    inspection.retainedListeners !== 0 ||
    inspection.usage.renderers !== 0 || inspection.usage.observers !== 0 ||
    inspection.usage.timers !== 0 || inspection.usage.backgroundTasks !== 0 ||
    inspection.usage.networkRequests !== 0
  )) throw new Error(`editor-session-resource-owner-still-running:${ownerRef}`)
}

export const createMarkdownEditorSessionResourceCoordinator = (
  readParticipants: () => readonly MarkdownEditorSessionResourceParticipant[],
) => {
  const inspect = (): MarkdownEditorSessionResourceCensus => {
    const participants = readParticipants()
    const seen = new Set<MarkdownEditorSessionResourceOwner>()
    const inspections = participants.map((participant) => {
      if (seen.has(participant.ownerRef) || !markdownEditorSessionResourceOwners.includes(participant.ownerRef)) {
        throw new Error('editor-session-resource-owner-duplicate-or-unknown')
      }
      seen.add(participant.ownerRef)
      const inspection = participant.inspect()
      assertInspection(inspection, participant.ownerRef)
      return inspection
    })
    const missingOwners = markdownEditorSessionResourceOwners.filter((ownerRef) => !seen.has(ownerRef))
    return Object.freeze({
      complete: missingOwners.length === 0,
      participants: Object.freeze(inspections),
      missingOwners: Object.freeze(missingOwners),
    })
  }
  const requireComplete = () => {
    const census = inspect()
    if (!census.complete) {
      throw new Error(`editor-session-resource-owner-unavailable:${census.missingOwners.join(',')}`)
    }
    return census
  }
  const aggregate = (census: MarkdownEditorSessionResourceCensus): MarkdownEditorSessionResourceUsage => {
    const usage = {
      editorInstances: 0, renderers: 0, observers: 0, timers: 0,
      backgroundTasks: 0, networkRequests: 0, memoryUnits: 0,
    }
    for (const participant of census.participants) {
      for (const field of Object.keys(usage) as (keyof typeof usage)[]) {
        usage[field] += participant.usage[field]
        if (!Number.isSafeInteger(usage[field])) throw new Error('editor-session-resource-usage-overflow')
      }
    }
    return Object.freeze(usage)
  }
  return Object.freeze({
    inspectParticipants: inspect,
    inspectResources: () => aggregate(requireComplete()),
    pauseResources() {
      requireComplete()
      const participants = readParticipants()
      // A failure is propagated with real owner states intact, never a paused ack.
      for (const participant of participants) assertInspection(participant.pause(), participant.ownerRef)
      const census = requireComplete()
      if (!census.participants.every((participant) => participant.paused)) {
        throw new Error('editor-session-resources-not-paused')
      }
      return aggregate(census)
    },
    resumeResources() {
      requireComplete()
      for (const participant of readParticipants()) assertInspection(participant.resume(), participant.ownerRef)
      const census = requireComplete()
      if (census.participants.some((participant) => participant.paused)) {
        throw new Error('editor-session-resources-not-resumed')
      }
      return aggregate(census)
    },
    disposeAfterSnapshot(snapshotRef: string) {
      const census = requireComplete()
      if (!census.participants.every((participant) => participant.paused && participant.recoverable)) {
        throw new Error('editor-session-recoverable-disposal-owner-unavailable')
      }
      for (const participant of readParticipants()) participant.dispose(snapshotRef)
    },
  })
}

/** Adapts the real scheduler's queue/handle census and cancellation authority. */
export const createMarkdownEditorFrameResourceParticipant = (
  scheduler: MarkdownEditorFrameScheduler,
): MarkdownEditorSessionResourceParticipant => {
  const inspect = (): MarkdownEditorSessionResourceInspection => {
    const metrics = scheduler.metrics()
    const state = scheduler.resourceState()
    if (state.frameRequestKind === 'custom') {
      throw new Error('editor-session-custom-frame-resource-owner-unavailable')
    }
    return Object.freeze({
      ownerRef: 'frame-scheduler',
      paused: state.paused,
      recoverable: false,
      retainedListeners: 0,
      usage: Object.freeze({
        editorInstances: 0, renderers: 0, observers: 0,
        timers: state.frameRequestKind === 'timer' ? state.pendingFrames + state.pendingAuxiliaryFrames : 0,
        backgroundTasks: metrics.pendingTasks + state.pendingFrames + state.pendingAuxiliaryFrames + state.runningAuxiliaryFrames + (state.runningPhase === null ? 0 : 1),
        networkRequests: 0,
        // Logical bounded resource units, not claimed physical heap bytes.
        memoryUnits: metrics.pendingTasks,
      }),
    })
  }
  return Object.freeze({
    ownerRef: 'frame-scheduler',
    inspect,
    pause() { scheduler.pause(); return inspect() },
    resume() { scheduler.resume(); return inspect() },
    dispose() { throw new Error('editor-session-frame-checkpoint-not-recoverable') },
  })
}
