import type { ObjectDirective, WatchHandle } from 'vue'
import { callWithAsyncErrorHandling, ErrorCodes, getCurrentInstance } from 'vue'
import type { MarkdownEditorSessionDocumentAuthority, MarkdownEditorSessionDocumentAuthorityTicket } from './markdown-editor-session'

type NativeEventCallback = { invoke(event: Event): unknown }['invoke']
export type MarkdownEditorNativeSurfaceEvents = Readonly<Record<string, NativeEventCallback | readonly NativeEventCallback[]>>

/** Exact local registrations only; Vue's opaque registrations remain unsupported. */
export interface MarkdownEditorNativeSurfaceInspection {
  readonly scope: 'native-surface-owned-registrations'
  readonly complete: false
  readonly ownedRegistrationsPaused: boolean
  readonly fullSurfacePaused: false
  readonly attachedListeners: number | null
  readonly unknownListenerRegistrations: number
  readonly registeredListeners: number
  readonly retainedWatchHandles: number
  readonly pausedWatchHandles: number
  readonly runningCallbacks: number
  readonly failedRegistrations: number
  readonly unsupported: readonly string[]
  readonly firstCause: unknown
  readonly latestCause: unknown
  readonly imperative: Readonly<{ resizeObservers: number | null; layoutGestureTimers: number }>
}

export interface MarkdownEditorNativeSurfaceResourceHandle {
  inspect(): MarkdownEditorNativeSurfaceInspection
  pauseOwnedRegistrations(): MarkdownEditorNativeSurfaceInspection
  resumeOwnedRegistrations(): MarkdownEditorNativeSurfaceInspection
  /** Retry only actual held cleanup; never reopen retired native admission. */
  retryOwnedCleanup(): MarkdownEditorNativeSurfaceInspection
}

interface ListenerRecord {
  readonly target: EventTarget
  readonly name: string
  readonly listener: EventListener
  handler: (event: Event) => unknown
  attached: boolean
  desired: boolean
  failed: boolean
  uncertain: boolean
  attachedGeneration: number
}

interface WatchRecord {
  readonly handle: WatchHandle
  paused: boolean
  failed: boolean
}

/** Own the actual SFC registrations; no tree discovery or Vue internal invoker access. */
export const createMarkdownEditorNativeSurfaceResources = (owner: {
  readonly documentAuthority: MarkdownEditorSessionDocumentAuthority
  readonly unavailable: () => boolean
  readonly composing: () => boolean
  readonly invalidatePublication: () => void
  readonly pauseImperative: () => void
  readonly resumeImperative: () => void
  readonly inspectImperative: () => Readonly<{ resizeObservers: number | null; layoutGestureTimers: number }>
}) => {
  const instance = getCurrentInstance()
  const listeners = new Set<ListenerRecord>()
  const targets = new Map<EventTarget, Map<string, ListenerRecord>>()
  const watches = new Set<WatchRecord>()
  const eventGenerations = new WeakMap<Event, number>()
  let eventGeneration = 0
  const capture = owner.documentAuthority.capture.bind(owner.documentAuthority)
  const hasNative = owner.documentAuthority.hasCustody.bind(owner.documentAuthority)
  let paused = false
  let transitioning = false
  let resuming = false
  let disposed = false
  let callbacks = 0
  let imperativePaused = false
  let pauseTicket: MarkdownEditorSessionDocumentAuthorityTicket | null = null
  let pauseStructureCurrent = false
  let firstCause: unknown
  let latestCause: unknown
  let failed = false
  const recordFailure = (cause: unknown) => {
    if (!failed) firstCause = cause
    failed = true
    latestCause = cause
  }
  const detach = (record: ListenerRecord) => {
    if (record.attached) {
      record.uncertain = true
      record.target.removeEventListener(record.name, record.listener)
      record.attached = false
      record.uncertain = false
    } else if (record.uncertain) {
      record.target.removeEventListener(record.name, record.listener)
      record.uncertain = false
    }
    record.failed = false
    if (!record.desired) {
      listeners.delete(record)
      const records = targets.get(record.target)
      if (records?.get(record.name) === record) {
        records.delete(record.name)
        if (records.size === 0 && targets.get(record.target) === records) targets.delete(record.target)
      }
    }
  }
  const attach = (record: ListenerRecord) => {
    if (!record.attached && record.desired) {
      if (eventGeneration === Number.MAX_SAFE_INTEGER)
        throw new Error('editor-native-surface-event-generation-exhausted')
      record.attachedGeneration = ++eventGeneration
      record.uncertain = true
      record.target.addEventListener(record.name, record.listener)
      record.attached = true
      record.uncertain = false
    }
    record.failed = false
  }
  const all = (tasks: readonly (() => void)[]) => {
    let didFail = false
    let original: unknown
    for (const task of tasks) {
      try { task() } catch (cause) {
        if (!didFail) original = cause
        didFail = true
        recordFailure(cause)
      }
    }
    if (didFail) throw original
  }
  const inspect = (): MarkdownEditorNativeSurfaceInspection => Object.freeze({
    scope: 'native-surface-owned-registrations', complete: false,
    ownedRegistrationsPaused: paused && imperativePaused && !transitioning && callbacks === 0 &&
      [...listeners].every((record) => !record.attached && !record.uncertain && !record.failed) &&
      [...watches].every((record) => record.paused && !record.failed),
    fullSurfacePaused: false,
    attachedListeners: [...listeners].some((record) => record.uncertain) ? null :
      [...listeners].filter((record) => record.attached).length,
    unknownListenerRegistrations: [...listeners].filter((record) => record.uncertain).length,
    registeredListeners: listeners.size,
    retainedWatchHandles: watches.size,
    pausedWatchHandles: [...watches].filter((record) => record.paused).length,
    runningCallbacks: callbacks,
    failedRegistrations: [...listeners, ...watches].filter((record) => record.failed).length,
    unsupported: Object.freeze([
      'vue-component-render-effect-and-scheduler',
      'vue-v-model-text-directive-input-composition-change-listeners',
      'vue-watch-paused-dependency-subscriptions',
      'vue-watch-scheduler-queued-jobs-and-async-continuations',
      'original-native-session-authority-invalidation-watch',
      'fallthrough-attrs-native-event-registrations',
      'child-component-emitter-subscriptions',
      'other-vue-directive-and-teleport-lifecycle',
    ]), firstCause, latestCause, imperative: owner.inspectImperative(),
  })
  const assertTransition = () => {
    if (disposed || transitioning || callbacks || owner.unavailable() || owner.composing())
      throw new Error('editor-native-surface-transition-unavailable')
  }
  const pauseWatches = () => all([...watches].map((record) => () => {
    try { record.handle.pause(); record.paused = true; record.failed = false }
    catch (cause) { record.failed = true; throw cause }
  }))
  const detachAll = () => all([...listeners].map((record) => () => {
    try { detach(record) } catch (cause) { record.failed = true; throw cause }
  }))
  const pauseImperative = () => { imperativePaused = false; owner.pauseImperative(); imperativePaused = true }
  const resumeImperative = () => { imperativePaused = false; owner.resumeImperative() }
  const handle: MarkdownEditorNativeSurfaceResourceHandle = Object.freeze({
    inspect,
    pauseOwnedRegistrations() {
      assertTransition()
      // Capture only during admission. Rearm retains THIS original ticket;
      // a native write/retirement or structure change never reacquires it.
      if (!paused) {
        const ticket = capture()
        if (!ticket || !hasNative(ticket)) throw new Error('editor-native-surface-document-authority-unavailable')
        pauseTicket = ticket
        pauseStructureCurrent = true
      }
      paused = true
      transitioning = true
      try { all([pauseWatches, detachAll, pauseImperative]) }
      finally { transitioning = false }
      if (!pauseTicket || !pauseStructureCurrent || !hasNative(pauseTicket) || owner.unavailable() || owner.composing())
        throw new Error('editor-native-surface-pause-authority-stale')
      return inspect()
    },
    resumeOwnedRegistrations() {
      assertTransition()
      if (!paused) return inspect()
      const ticket = pauseTicket
      if (!ticket || !pauseStructureCurrent || !hasNative(ticket))
        throw new Error('editor-native-surface-rearm-authority-stale')
      transitioning = true
      resuming = true
      try {
        all([resumeImperative, ...[...listeners].map((record) => () => {
          try { attach(record) } catch (cause) { record.failed = true; throw cause }
        }), ...[...watches].map((record) => () => {
          try { record.handle.resume(); record.paused = false; record.failed = false }
          catch (cause) { record.failed = true; throw cause }
        })])
        if (disposed || owner.unavailable() || owner.composing() || !pauseStructureCurrent || !hasNative(ticket))
          throw new Error('editor-native-surface-rearm-authority-stale')
        paused = false
        pauseTicket = null
      } catch (cause) {
        resuming = false
        recordFailure(cause)
        try { all([pauseWatches, detachAll, pauseImperative]) } catch { /* Same failure records remain inspectable. */ }
        throw cause
      } finally { resuming = false; transitioning = false }
      return inspect()
    },
    retryOwnedCleanup() {
      if ((!paused && !disposed) || transitioning || callbacks)
        throw new Error('editor-native-surface-cleanup-unavailable')
      transitioning = true
      try {
        all([detachAll, ...[...watches].map((record) => () => {
          try {
            if (disposed) { record.handle.stop(); watches.delete(record) }
            else { record.handle.pause(); record.paused = true }
            record.failed = false
          } catch (cause) { record.failed = true; throw cause }
        }), pauseImperative])
      } finally { transitioning = false }
      return inspect()
    },
  })
  const releaseTarget = (target: EventTarget, structural = true) => {
    const records = targets.get(target)
    if (!records) return
    if (paused && structural) pauseStructureCurrent = false
    all([...records.values()].map((record) => () => {
      record.desired = false
      try { detach(record) }
      catch (cause) { record.failed = true; throw cause }
    }))
    if (records.size === 0 && targets.get(target) === records) targets.delete(target)
  }
  const bindTarget = (target: EventTarget, events: MarkdownEditorNativeSurfaceEvents, structural = true) => {
    if (disposed) throw new Error('editor-native-surface-disposed')
    let records = targets.get(target)
    if (!records) {
      if (paused && structural) pauseStructureCurrent = false
      records = new Map()
      targets.set(target, records)
    }
    for (const [name, callback] of Object.entries(events)) {
      const handler = Array.isArray(callback)
        ? (event: Event) => { for (const run of callback) run(event) }
        : callback as (event: Event) => unknown
      const existing = records.get(name)
      if (existing) {
        if (!existing.desired) throw new Error('editor-native-surface-original-registration-cleanup-pending')
        existing.handler = handler
        continue
      }
      if (paused && structural) pauseStructureCurrent = false
      const record: ListenerRecord = { target, name, handler, attached: false, desired: true, failed: false, uncertain: false,
        attachedGeneration: 0,
        listener: (event) => {
          if (paused || transitioning || disposed || !record.desired || !record.attached || owner.unavailable()) return
          let generation = eventGenerations.get(event)
          if (generation === undefined) { generation = eventGeneration; eventGenerations.set(event, generation) }
          if (generation < record.attachedGeneration) return
          callbacks += 1
          try {
            owner.invalidatePublication()
            // Preserve the original Vue component error-boundary and async-error
            // routing while owning the actual native registration ourselves.
            callWithAsyncErrorHandling(record.handler, instance, ErrorCodes.NATIVE_EVENT_HANDLER, [event])
          }
          finally { callbacks -= 1 }
        } }
      records.set(name, record)
      listeners.add(record)
      if (!paused || resuming) {
        try { attach(record) } catch (cause) { record.failed = true; recordFailure(cause); throw cause }
      }
    }
    all([...records.values()].filter((record) => !(record.name in events)).map((record) => () => {
      if (paused && structural) pauseStructureCurrent = false
      record.desired = false
      try { detach(record) }
      catch (cause) { record.failed = true; throw cause }
    }))
  }
  const directive: ObjectDirective<HTMLElement, MarkdownEditorNativeSurfaceEvents> = {
    mounted: (element, binding) => bindTarget(element, binding.value),
    updated: (element, binding) => bindTarget(element, binding.value),
    beforeUnmount: (element) => releaseTarget(element),
  }
  return Object.freeze({
    handle, directive, bindTarget, releaseTarget,
    // Called by the original synchronous SFC source/context guard, including
    // when the controlled prop watcher is paused and has not written Native yet.
    invalidateAdmission() { pauseStructureCurrent = false },
    runImperativeCallback(callback: () => void) {
      if (disposed || paused || transitioning || owner.unavailable()) return
      callbacks += 1
      try { owner.invalidatePublication(); callback() }
      finally { callbacks -= 1 }
    },
    runWatchCallback<Result>(callback: () => Result): Result | undefined {
      if (disposed || (paused && !resuming)) {
        // Vue may already have queued a job before pause. Do not replay its
        // arguments/body here, or certify a rearm after that skipped callback.
        pauseStructureCurrent = false
        return undefined
      }
      callbacks += 1
      try { owner.invalidatePublication(); return callback() }
      finally { callbacks -= 1 }
    },
    ownWatch(watch: WatchHandle): WatchHandle {
      const record: WatchRecord = { handle: watch, paused: false, failed: false }
      watches.add(record)
      if (paused) {
        try { watch.pause(); record.paused = true }
        catch (cause) { record.failed = true; recordFailure(cause); throw cause }
      }
      return watch
    },
    disposeRegistrations() {
      disposed = true
      paused = true
      pauseStructureCurrent = false
      all([detachAll, ...[...watches].map((record) => () => {
        try { record.handle.stop(); record.paused = true; record.failed = false; watches.delete(record) }
        catch (cause) { record.failed = true; throw cause }
      })])
    },
  })
}
