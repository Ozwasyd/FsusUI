import type {
  MarkdownEditorSessionResourceInspection,
  MarkdownEditorSessionResourceParticipant,
} from '../../markdown-editor/src/markdown-editor-session-resources'
import type { MarkdownSafeRenderResult } from '@element-plus/wasm'
import type {
  MarkdownEditorFrameScheduler,
  MarkdownEditorFrameTask,
} from '../../../hooks/use-markdown-editor-frame-scheduler'

export interface MarkdownRendererDocumentState {
  readonly documentIdentity: Readonly<{ id: string; epoch: number | string }>
  readonly revision: number | string
}

/** An opaque ref into this mounted renderer, not a serialized checkpoint. */
export interface MarkdownRendererLastValidRender extends MarkdownRendererDocumentState {
  readonly ref: string
}

export interface MarkdownRendererRenderGeneration extends MarkdownRendererDocumentState {
  readonly generation: number
}

// These owners currently release resources only on component unmount. Their
// private handles cannot be inferred from diagnostics, loading flags or DOM.
export const markdownRendererSessionSourceDependencies = Object.freeze([
  'render-pipeline-runtime:worker-pool-and-job-census-and-reversible-pause',
  'render-pipeline-hardware-profile:raf-sampler-and-listener-census-and-reversible-pause',
  'virtual-window:observer-frame-and-listener-census-and-reversible-pause',
  'heavy-feature-runtime:timer-and-network-census-and-reversible-pause',
  'renderer:validated-snapshot-restoration-after-disposal',
] as const)

export const createMarkdownRendererSessionResourceOwner = (options: {
  readonly ownerKey: string
  readonly readDocumentState: () => MarkdownRendererDocumentState
  readonly readProjectionResources: () => {
    readonly renderers: number
    readonly observers: number
    readonly backgroundTasks: number
    readonly memoryUnits: number
    readonly retainedListeners: number
  }
}) => {
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const frames = new Map<number, () => void>()
  const scheduledFrames = new Map<string, () => void>()
  const jobs = new Set<symbol>()
  const listeners = new Set<() => void>()
  let generation = 0
  let disposed = false
  let sequence = 0
  let retained: {
    readonly capture: MarkdownRendererLastValidRender
    readonly result: MarkdownSafeRenderResult
  } | null = null

  const sameDocument = (
    a: MarkdownRendererDocumentState,
    b: MarkdownRendererDocumentState,
  ) =>
    a.documentIdentity.id === b.documentIdentity.id &&
    a.documentIdentity.epoch === b.documentIdentity.epoch

  const readDocumentState = (): MarkdownRendererDocumentState => {
    const state = options.readDocumentState()
    return Object.freeze({
      documentIdentity: Object.freeze({ ...state.documentIdentity }),
      revision: state.revision,
    })
  }
  const beginRender = (): MarkdownRendererRenderGeneration =>
    Object.freeze({ ...readDocumentState(), generation: ++generation })
  const isCurrent = (token: MarkdownRendererRenderGeneration) => {
    const current = options.readDocumentState()
    return (
      !disposed &&
      token.generation === generation &&
      sameDocument(token, current) &&
      token.revision === current.revision
    )
  }
  const captureLastValidRender = (): MarkdownRendererLastValidRender | null => {
    if (disposed || !retained) return null
    if (!sameDocument(retained.capture, options.readDocumentState())) {
      retained = null
      return null
    }
    return retained.capture
  }
  const retainLastValidRender = (
    token: MarkdownRendererRenderGeneration,
    result: MarkdownSafeRenderResult,
  ) => {
    if (!isCurrent(token)) return false
    // The component calls this only at an authorized, identity-matched commit.
    // Keep the actual immutable result in the sole owner, never reconstruct it
    // from HTML, a source digest or a fabricated success receipt.
    retained = Object.freeze({
      capture: Object.freeze({
        documentIdentity: token.documentIdentity,
        revision: token.revision,
        ref: `${options.ownerKey}:render:${++sequence}`,
      }),
      result,
    })
    return true
  }
  const trackJob = () => {
    const job = Symbol('renderer-job')
    jobs.add(job)
    return () => jobs.delete(job)
  }
  const setTimer = (run: () => void, delay: number) => {
    const handle = setTimeout(() => {
      timers.delete(handle)
      if (!disposed) run()
    }, delay)
    timers.add(handle)
    return handle
  }
  const clearTimer = (handle: ReturnType<typeof setTimeout>) => {
    clearTimeout(handle)
    timers.delete(handle)
  }
  const afterFrame = () =>
    new Promise<void>((resolve) => {
      if (disposed || typeof requestAnimationFrame !== 'function') {
        resolve()
        return
      }
      const handle = requestAnimationFrame(() => {
        frames.delete(handle)
        resolve()
      })
      frames.set(handle, resolve)
    })
  const scheduleFrame = (
    scheduler: MarkdownEditorFrameScheduler,
    task: MarkdownEditorFrameTask,
    onCancel: () => void = () => undefined,
  ) => {
    if (disposed) {
      onCancel()
      return false
    }
    const key = `${options.ownerKey}:${task.key}`
    scheduledFrames.get(key)?.()
    const cancel = () => {
      scheduler.cancel(key)
      scheduledFrames.delete(key)
      onCancel()
    }
    const accepted = scheduler.schedule({
      ...task,
      key,
      postPaint: () => {
        scheduledFrames.delete(key)
        task.postPaint?.()
      },
    })
    if (accepted) scheduledFrames.set(key, cancel)
    else onCancel()
    return accepted
  }
  const cancelFrames = () => {
    for (const cancel of scheduledFrames.values()) cancel()
    for (const [handle, resolve] of frames) {
      cancelAnimationFrame(handle)
      resolve()
    }
    frames.clear()
  }
  const listenForAbort = (signal: AbortSignal, run: () => void) => {
    const remove = () => {
      signal.removeEventListener('abort', abort)
      listeners.delete(remove)
    }
    const abort = () => {
      remove()
      run()
    }
    signal.addEventListener('abort', abort, { once: true })
    listeners.add(remove)
    return remove
  }
  const inspectOwnedResources = () => {
    const projection = options.readProjectionResources()
    return Object.freeze({
      complete: false as const,
      missingSourceDependencies: markdownRendererSessionSourceDependencies,
      // Partial, directly held component resources. Never submit this as the
      // renderer-projection participant's aggregate inspection.
      inspection: Object.freeze({
        ownerRef: 'renderer-projection',
        paused: false,
        recoverable: false,
        retainedListeners: listeners.size + projection.retainedListeners,
        usage: Object.freeze({
          editorInstances: 0,
          renderers: (disposed ? 0 : 1) + projection.renderers,
          observers: projection.observers,
          timers: timers.size,
          backgroundTasks:
            jobs.size +
            frames.size +
            scheduledFrames.size +
            projection.backgroundTasks,
          networkRequests: 0,
          // Logical retained units, not physical heap bytes.
          memoryUnits:
            projection.memoryUnits +
            (retained ? 1 : 0) +
            timers.size +
            frames.size +
            scheduledFrames.size +
            jobs.size +
            listeners.size,
        }),
      } satisfies MarkdownEditorSessionResourceInspection),
    })
  }
  const requireSourceCensus = (): never => {
    throw new Error(
      `markdown-renderer-session-resource-source-unavailable:${markdownRendererSessionSourceDependencies.join(',')}`,
    )
  }
  const participant: MarkdownEditorSessionResourceParticipant = Object.freeze({
    ownerRef: 'renderer-projection',
    inspect: requireSourceCensus,
    // Refuse before mutation: cancelling the known component handles alone
    // cannot suspend the hidden hook resources, or justify a successful ack.
    pause: requireSourceCensus,
    resume: requireSourceCensus,
    dispose(_snapshotRef: string) {
      throw new Error('markdown-renderer-session-checkpoint-not-recoverable')
    },
  })
  const disposeOnUnmount = () => {
    disposed = true
    generation += 1
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
    cancelFrames()
    for (const remove of listeners) remove()
    retained = null
    // Promises remain in the census until their real finally blocks settle.
  }
  return Object.freeze({
    afterFrame,
    beginRender,
    captureLastValidRender,
    clearTimer,
    disposeOnUnmount,
    inspectOwnedResources,
    invalidate: () => {
      generation += 1
      cancelFrames()
      captureLastValidRender()
    },
    isCurrent,
    listenForAbort,
    participant,
    retainLastValidRender,
    scheduleFrame,
    setTimer,
    trackJob,
  })
}
