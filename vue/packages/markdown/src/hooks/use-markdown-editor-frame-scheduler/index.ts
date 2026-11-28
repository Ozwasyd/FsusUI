import { inject, onBeforeUnmount, provide } from 'vue'

import type { InjectionKey } from 'vue'

/**
 * Single frame scheduling authority for the MarkdownEditor surface (#640).
 *
 * Phase contract per scheduled frame:
 *
 * ```text
 * frame N
 *   measure    -> geometry/layout reads
 *   mutate     -> DOM/class/style/scroll/virtual mount writes
 *   post-paint -> non-blocking observation, next-frame requests, evidence sampling
 * ```
 *
 * Tasks are keyed; a repeated key replaces the pending task (coalescing).
 * Stale tasks are cancelled by their guard before every phase commit. A
 * measure request that arrives after the mutate phase of the current frame
 * has started is deferred to the next frame and counted as an editor-owned
 * read-after-write violation instead of forcing a synchronous layout flush.
 *
 * The scheduler owns every requestAnimationFrame handle for layout work in
 * the MarkdownEditor surface; feature modules only submit tasks. It never
 * touches Markdown source, history, selection logical state, projection
 * identity, or command semantics. This module is internal FsusUI
 * infrastructure and is not public API.
 */

export const MARKDOWN_EDITOR_FRAME_PHASES = Object.freeze([
  'measure',
  'mutate',
  'post-paint',
] as const)

export type MarkdownEditorFramePhase =
  (typeof MARKDOWN_EDITOR_FRAME_PHASES)[number]

export interface MarkdownEditorFrameTask {
  /**
   * Coalescing key. Compose it from document epoch/revision/node identity so
   * rapid requests for the same document state collapse into one frame task.
   */
  readonly key: string
  /** Layout/geometry reads. Must not write DOM, class, style, or scroll. */
  readonly measure?: () => void
  /** DOM/class/style/scroll writes. Must not read layout. */
  readonly mutate?: () => void
  /** Non-blocking settle work: observation, sampling, next-frame requests. */
  readonly postPaint?: () => void
  /**
   * Stale cancellation. Re-evaluated before each phase commit; returning
   * false cancels the remaining phases of the task (fail closed).
   */
  readonly guard?: () => boolean
}

export interface MarkdownEditorFrameSchedulerMetrics {
  readonly frameId: number
  readonly framesExecuted: number
  readonly frameRequests: number
  readonly pendingTasks: number
  readonly executed: Readonly<Record<MarkdownEditorFramePhase, number>>
  readonly durationMs: Readonly<Record<MarkdownEditorFramePhase, number>>
  readonly coalescedTasks: number
  readonly staleTasks: number
  readonly cancelledTasks: number
  readonly readAfterWriteViolations: number
  readonly overflowDroppedTasks: number
  readonly idle: boolean
}

export interface MarkdownEditorFrameScheduler {
  schedule: (task: MarkdownEditorFrameTask) => boolean
  scheduleMeasure: (
    key: string,
    run: () => void,
    guard?: () => boolean,
  ) => boolean
  scheduleMutate: (
    key: string,
    run: () => void,
    guard?: () => boolean,
  ) => boolean
  schedulePostPaint: (
    key: string,
    run: () => void,
    guard?: () => boolean,
  ) => boolean
  cancel: (key: string) => void
  cancelAll: () => void
  metrics: () => MarkdownEditorFrameSchedulerMetrics
  dispose: () => void
}

export interface MarkdownEditorFrameSchedulerOptions {
  readonly requestFrame?: (callback: () => void) => number
  readonly cancelFrame?: (handle: number) => void
  readonly now?: () => number
  readonly maxQueuedTasks?: number
  readonly onFrameEnd?: (metrics: MarkdownEditorFrameSchedulerMetrics) => void
}

interface FrameTaskEntry {
  readonly task: MarkdownEditorFrameTask
  started: boolean
}

const DEFAULT_MAX_QUEUED_TASKS = 256

const defaultRequestFrame = (callback: () => void): number => {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback)
  }
  return setTimeout(callback, 16) as unknown as number
}

const defaultCancelFrame = (handle: number) => {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle)
    return
  }
  clearTimeout(handle)
}

export const createMarkdownEditorFrameScheduler = (
  options: MarkdownEditorFrameSchedulerOptions = {},
): MarkdownEditorFrameScheduler => {
  const requestFrame = options.requestFrame ?? defaultRequestFrame
  const cancelFrame = options.cancelFrame ?? defaultCancelFrame
  const now =
    options.now ??
    (() =>
      typeof performance === 'undefined' ? Date.now() : performance.now())
  const maxQueuedTasks = options.maxQueuedTasks ?? DEFAULT_MAX_QUEUED_TASKS

  const entries = new Map<string, FrameTaskEntry>()
  let disposed = false
  let frameHandle = 0
  let runningPhase: MarkdownEditorFramePhase | null = null
  let frameId = 0
  let framesExecuted = 0
  let frameRequests = 0
  let coalescedTasks = 0
  let staleTasks = 0
  let cancelledTasks = 0
  let readAfterWriteViolations = 0
  let overflowDroppedTasks = 0
  const executed: Record<MarkdownEditorFramePhase, number> = {
    measure: 0,
    mutate: 0,
    'post-paint': 0,
  }
  const durationMs: Record<MarkdownEditorFramePhase, number> = {
    measure: 0,
    mutate: 0,
    'post-paint': 0,
  }

  const metrics = (): MarkdownEditorFrameSchedulerMetrics =>
    Object.freeze({
      frameId,
      framesExecuted,
      frameRequests,
      pendingTasks: entries.size,
      executed: Object.freeze({ ...executed }),
      durationMs: Object.freeze({ ...durationMs }),
      coalescedTasks,
      staleTasks,
      cancelledTasks,
      readAfterWriteViolations,
      overflowDroppedTasks,
      idle: entries.size === 0 && frameHandle === 0 && runningPhase === null,
    })

  const requestNextFrame = () => {
    if (frameHandle || runningPhase) return
    frameHandle = requestFrame(runFrame)
    frameRequests += 1
  }

  const finishEntryPhase = (
    entry: FrameTaskEntry,
    phase: MarkdownEditorFramePhase,
  ) => {
    const { task } = entry
    const hasMutate = phase === 'measure' && Boolean(task.mutate)
    const hasPostPaint =
      (phase === 'measure' || phase === 'mutate') && Boolean(task.postPaint)
    if (hasMutate || hasPostPaint) return
    if (entries.get(task.key) === entry) entries.delete(task.key)
  }

  const runPhase = (phase: MarkdownEditorFramePhase) => {
    const snapshot = [...entries.values()].filter((entry) => {
      const run =
        phase === 'measure'
          ? entry.task.measure
          : phase === 'mutate'
            ? entry.task.mutate
            : entry.task.postPaint
      return typeof run === 'function'
    })
    for (const entry of snapshot) {
      if (entries.get(entry.task.key) !== entry) continue
      const { guard } = entry.task
      if (guard && !guard()) {
        entries.delete(entry.task.key)
        staleTasks += 1
        continue
      }
      entry.started = true
      const startedAt = now()
      const run =
        phase === 'measure'
          ? entry.task.measure
          : phase === 'mutate'
            ? entry.task.mutate
            : entry.task.postPaint
      run?.()
      executed[phase] += 1
      durationMs[phase] += now() - startedAt
      finishEntryPhase(entry, phase)
    }
  }

  const runFrame = () => {
    frameHandle = 0
    if (disposed || runningPhase) return
    frameId += 1
    framesExecuted += 1
    runningPhase = 'measure'
    runPhase('measure')
    runningPhase = 'mutate'
    runPhase('mutate')
    runningPhase = 'post-paint'
    runPhase('post-paint')
    runningPhase = null
    options.onFrameEnd?.(metrics())
    // Only real invalidation keeps frames alive; an empty queue leaves the
    // scheduler idle with no resident frame loop (#640 rule 8).
    if (entries.size > 0) requestNextFrame()
  }

  const schedule = (task: MarkdownEditorFrameTask) => {
    if (disposed) return false
    if (
      entries.size >= maxQueuedTasks &&
      !entries.has(task.key) &&
      !runningPhase
    ) {
      overflowDroppedTasks += 1
      return false
    }
    if (
      task.measure &&
      (runningPhase === 'mutate' || runningPhase === 'post-paint')
    ) {
      // A measure request after this frame's writes started must not force a
      // synchronous layout flush; it defers to the next frame and is counted.
      readAfterWriteViolations += 1
    }
    const existing = entries.get(task.key)
    if (existing) {
      if (!existing.started) coalescedTasks += 1
      entries.delete(task.key)
    }
    entries.set(task.key, { started: false, task })
    requestNextFrame()
    return true
  }

  const cancel = (key: string) => {
    if (entries.delete(key)) cancelledTasks += 1
  }

  const cancelAll = () => {
    cancelledTasks += entries.size
    entries.clear()
    if (frameHandle) {
      cancelFrame(frameHandle)
      frameHandle = 0
    }
  }

  const dispose = () => {
    disposed = true
    entries.clear()
    if (frameHandle) {
      cancelFrame(frameHandle)
      frameHandle = 0
    }
  }

  return Object.freeze({
    schedule,
    scheduleMeasure: (key: string, run: () => void, guard?: () => boolean) =>
      schedule({ guard, key, measure: run }),
    scheduleMutate: (key: string, run: () => void, guard?: () => boolean) =>
      schedule({ guard, key, mutate: run }),
    schedulePostPaint: (key: string, run: () => void, guard?: () => boolean) =>
      schedule({ guard, key, postPaint: run }),
    cancel,
    cancelAll,
    metrics,
    dispose,
  })
}

export const MARKDOWN_EDITOR_FRAME_SCHEDULER: InjectionKey<MarkdownEditorFrameScheduler> =
  Symbol.for('fsus-markdown-editor-frame-scheduler')

export const useMarkdownEditorFrameScheduler = (
  options?: MarkdownEditorFrameSchedulerOptions,
) => {
  const scheduler = createMarkdownEditorFrameScheduler(options)
  onBeforeUnmount(() => {
    scheduler.dispose()
  })
  return scheduler
}

/**
 * Provide the editor-owned frame scheduler to the live renderer surface so
 * the whole MarkdownEditor surface shares one scheduling authority.
 */
export const provideMarkdownEditorFrameScheduler = (
  scheduler: MarkdownEditorFrameScheduler,
) => {
  provide(MARKDOWN_EDITOR_FRAME_SCHEDULER, scheduler)
}

/**
 * Consume the editor-owned frame scheduler when embedded in a MarkdownEditor;
 * standalone surfaces create their own instance with identical semantics.
 */
export const useEmbeddedMarkdownEditorFrameScheduler = () =>
  inject(MARKDOWN_EDITOR_FRAME_SCHEDULER, null) ??
  useMarkdownEditorFrameScheduler()

export type MarkdownEditorFrameSchedulerMutationKind =
  | 'mutate-phase-measurement'
  | 'unbounded-input-backlog'
  | 'stale-commit'
  | 'unmount-residue'
  | 'permanent-frame-loop'

interface ManualFrameControl {
  readonly requestFrame: (callback: () => void) => number
  readonly cancelFrame: (handle: number) => void
  /** Run exactly one pending frame; frames queued during it stay pending. */
  readonly flush: () => void
  readonly pendingFrames: () => number
}

const createManualFrameControl = (): ManualFrameControl => {
  const queue: Array<{ callback: () => void; handle: number }> = []
  let handleSeed = 0
  const requestFrame = (callback: () => void) => {
    handleSeed += 1
    queue.push({ callback, handle: handleSeed })
    return handleSeed
  }
  const cancelFrame = (handle: number) => {
    const index = queue.findIndex((item) => item.handle === handle)
    if (index >= 0) queue.splice(index, 1)
  }
  const flush = () => {
    const item = queue.shift()
    item?.callback()
  }
  return {
    cancelFrame,
    flush,
    pendingFrames: () => queue.length,
    requestFrame,
  }
}

/**
 * Mutation fixtures for the frame scheduler contract (#640). Every fixture
 * replays an anti-pattern against a real scheduler instance; `accepted`
 * is true when the anti-pattern survives (it must be false in every case).
 */
export const evaluateMarkdownEditorFrameSchedulerMutations = () => {
  const frames = createManualFrameControl()
  const scheduler = createMarkdownEditorFrameScheduler({
    cancelFrame: frames.cancelFrame,
    requestFrame: frames.requestFrame,
  })

  let sameFrameMeasureRan = false
  scheduler.schedule({
    key: 'fixture:writer',
    mutate: () => {
      scheduler.scheduleMeasure('fixture:late-read', () => {
        sameFrameMeasureRan = true
      })
    },
  })
  frames.flush()
  const measureDeferredToNextFrame =
    sameFrameMeasureRan === false && frames.pendingFrames() > 0
  frames.flush()

  for (let index = 0; index < 64; index += 1) {
    scheduler.schedule({
      key: 'fixture:burst',
      measure: () => undefined,
      mutate: () => undefined,
    })
  }
  const burstMetrics = scheduler.metrics()
  frames.flush()

  let staleRan = false
  scheduler.schedule({
    guard: () => false,
    key: 'fixture:stale',
    mutate: () => {
      staleRan = true
    },
  })
  frames.flush()

  let ranAfterDispose = false
  const disposeProbe = createMarkdownEditorFrameScheduler({
    cancelFrame: frames.cancelFrame,
    requestFrame: frames.requestFrame,
  })
  disposeProbe.schedule({
    key: 'fixture:dispose',
    mutate: () => {
      ranAfterDispose = true
    },
  })
  disposeProbe.dispose()
  frames.flush()

  scheduler.schedule({
    key: 'fixture:idle',
    mutate: () => undefined,
  })
  frames.flush()
  const settledMetrics = scheduler.metrics()
  const requestsBeforeQuiet = settledMetrics.frameRequests
  frames.flush()
  const loopedWhileIdle =
    scheduler.metrics().frameRequests > requestsBeforeQuiet ||
    !settledMetrics.idle

  return Object.freeze({
    mutations: Object.freeze([
      Object.freeze({
        accepted: !measureDeferredToNextFrame,
        detail:
          'measure requested during the mutate phase must defer to the next frame and count a violation',
        kind: 'mutate-phase-measurement' as const,
      }),
      Object.freeze({
        accepted:
          burstMetrics.pendingTasks > 1 ||
          burstMetrics.coalescedTasks < 63 ||
          burstMetrics.overflowDroppedTasks > 0,
        detail:
          'rapid same-key input must coalesce to one pending task without backlog growth',
        kind: 'unbounded-input-backlog' as const,
      }),
      Object.freeze({
        accepted: staleRan,
        detail: 'a task whose guard fails must never commit',
        kind: 'stale-commit' as const,
      }),
      Object.freeze({
        accepted: ranAfterDispose,
        detail: 'dispose must cancel pending frames and tasks',
        kind: 'unmount-residue' as const,
      }),
      Object.freeze({
        accepted: loopedWhileIdle,
        detail: 'an idle scheduler must not keep requesting frames',
        kind: 'permanent-frame-loop' as const,
      }),
    ]),
    schedulerMetrics: scheduler.metrics(),
  })
}
