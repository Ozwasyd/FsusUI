import type { FeatureRenderOutput } from './markdown-feature-output-gateway'
import type { MarkdownHeavyFeatureFrameContinueScheduler } from './markdown-heavy-feature-frame-scheduler'

const MAX_ISOLATED_SOURCE_LENGTH = 16 * 1024 * 1024
const MAX_ISOLATED_OUTPUT_LENGTH = 128 * 1024 * 1024
const MAX_ISOLATED_TOKEN_COUNT = 32

export const MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE =
  'fsus-markdown-heavy-feature-frame@1'

const boundedString = (value: unknown, maxLength: number) =>
  typeof value === 'string' && value.length <= maxLength

export const validateMarkdownHeavyFeatureFrameContinueMessage = (
  value: unknown,
  capability: string,
) => {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return (
    Reflect.ownKeys(message).length === 3 &&
    message.capability === capability &&
    message.scope === MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE &&
    message.type === 'continue'
  )
}

export interface MarkdownHeavyFeatureAdapterResources {
  // Directly owned handles; these counts do not census third-party realms.
  readonly listeners: number
  readonly networkRequests?: MarkdownHeavyFeatureResourceCount
  readonly observers: number
  readonly pendingImports?: number
  readonly runtimes: number
  readonly scheduledContinuations?: number
  readonly scope?: 'owned-handles'
  readonly subscribe?: (listener: () => void) => () => void
  readonly tasks: number
  readonly timers?: MarkdownHeavyFeatureResourceCount
  readonly ownedTimers?: number
  readonly ownedRequests?: number
  readonly pendingRequests?: number
  readonly pendingInstallations?: number
  readonly failures?: readonly MarkdownHeavyFeatureResourceFailure[]
  readonly cancelTimers?: () => MarkdownHeavyFeatureCancellationRequest
  readonly cancelRequests?: () => MarkdownHeavyFeatureCancellationRequest
  readonly cancelContinuations?: () => MarkdownHeavyFeatureCancellationRequest
}

export type MarkdownHeavyFeatureResourceCount =
  | number
  | 'unknown'
  | 'unavailable'

export interface MarkdownHeavyFeatureResourceFailure {
  readonly operation: string
  readonly resource: object
  readonly cause: unknown
}

/** A cancellation request/observation, never an asynchronous settlement ack. */
export interface MarkdownHeavyFeatureCancellationRequest {
  readonly requested: number
  readonly failures: readonly MarkdownHeavyFeatureResourceFailure[]
  readonly unavailable?: boolean
}

export interface MarkdownHeavyFeatureOwnedTimer {
  readonly ref: symbol
}

export interface MarkdownHeavyFeatureAdapterResourceOwner {
  readonly resources: MarkdownHeavyFeatureAdapterResources
  readonly setTimer: (
    run: () => void | Promise<void>,
    delay: number,
  ) => MarkdownHeavyFeatureOwnedTimer
  readonly clearTimer: (timer: MarkdownHeavyFeatureOwnedTimer) => boolean
  readonly fetchBytes: (
    input: string | URL,
    init?: RequestInit,
  ) => Promise<Readonly<{ response: Response; bytes: ArrayBuffer }>>
  readonly loadImport: <T>(load: () => Promise<T>) => Promise<T>
  readonly observeImport: <T>(promise: Promise<T>) => Promise<T>
  readonly observeRequest: <T>(
    promise: Promise<T>,
    entered?: () => boolean,
  ) => Promise<T>
  readonly retainFailure: (
    operation: string,
    resource: object,
    cause: unknown,
  ) => void
  readonly scheduleContinue: (
    schedule: MarkdownHeavyFeatureFrameContinueScheduler,
    key: string,
    run: () => void,
    drop: () => void,
  ) => (() => void) | null
  readonly requestCancellation: () => MarkdownHeavyFeatureCancellationRequest
}

export const createMarkdownHeavyFeatureAdapterResourceOwner =
  (): MarkdownHeavyFeatureAdapterResourceOwner => {
    const timers = new Map<
      MarkdownHeavyFeatureOwnedTimer,
      {
        handle?: ReturnType<typeof setTimeout>
        installing: boolean
        fired: boolean
        cancelRequested: boolean
      }
    >()
    const requests = new Set<{
      controller: AbortController
      started: boolean
      cancelRequested: boolean
      settlementUnknown: boolean
    }>()
    const imports = new Set<object>()
    const observedRequests = new Set<object>()
    const callbacks = new Set<object>()
    const continuations = new Set<{
      cancel: (() => void) | null
      installing: boolean
      entered: boolean
      cancelRequested: boolean
    }>()
    const listeners = new Map<object, () => void>()
    const subscribers = new Set<() => void>()
    const failures: MarkdownHeavyFeatureResourceFailure[] = []
    let closed = false
    let unknownTimers = false
    let unknownNetwork = false
    const fail = (operation: string, resource: object, cause: unknown) => {
      // A failed native/external boundary supplies no complete effect census.
      unknownTimers = true
      unknownNetwork = true
      failures.push(Object.freeze({ operation, resource, cause }))
    }
    const notify = () => {
      for (const listener of [...subscribers]) {
        try {
          listener()
        } catch (cause) {
          fail('resource-notification', listener, cause)
        }
      }
    }
    const observe = <T>(
      promise: Promise<T>,
      records: Set<object>,
      token: object,
      operation?: string | (() => string | undefined),
    ) => {
      // Both branches consume only the observation chain, preserving the real
      // promise's rejection for its caller. Cancellation never deletes a task.
      const settle = () => {
        records.delete(token)
        notify()
      }
      void promise.then(settle, (cause) => {
        try {
          const phase =
            typeof operation === 'function' ? operation() : operation
          if (phase) fail(phase, token, cause)
        } catch (observerCause) {
          fail('settlement-observer', token, observerCause)
        }
        settle()
      })
      return promise
    }
    const removeListener = (token: object) => {
      const remove = listeners.get(token)
      if (!remove) return
      try {
        remove()
        listeners.delete(token)
      } catch (cause) {
        fail('abort-listener-remove', token, cause)
      }
    }
    const clearTimer = (token: MarkdownHeavyFeatureOwnedTimer) => {
      const record = timers.get(token)
      if (!record) return false
      record.cancelRequested = true
      if (record.installing) return false
      if (record.handle === undefined) return false
      try {
        clearTimeout(record.handle)
        if (timers.get(token) === record) timers.delete(token)
        notify()
        return true
      } catch (cause) {
        fail('timer-clear', token, cause)
        notify()
        return false
      }
    }
    const cancelTimers = (): MarkdownHeavyFeatureCancellationRequest => {
      const before = failures.length
      const snapshot = [...timers.keys()]
      for (const token of snapshot) clearTimer(token)
      return Object.freeze({
        requested: snapshot.length,
        failures: Object.freeze(failures.slice(before)),
        unavailable:
          unknownTimers ||
          [...timers.values()].some(
            (record) => !record.installing && record.handle === undefined,
          ),
      })
    }
    const cancelRequests = (): MarkdownHeavyFeatureCancellationRequest => {
      const before = failures.length
      const snapshot = [...requests]
      for (const record of snapshot) {
        if (record.cancelRequested) continue
        record.cancelRequested = true
        try {
          record.controller.abort()
        } catch (cause) {
          fail('request-abort', record, cause)
        }
      }
      notify()
      return Object.freeze({
        requested: snapshot.length,
        failures: Object.freeze(failures.slice(before)),
        unavailable:
          unknownNetwork ||
          [...requests].some((record) => record.settlementUnknown),
      })
    }
    const cancelContinuation = (record: {
      cancel: (() => void) | null
      installing: boolean
      cancelRequested: boolean
    }) => {
      if (!continuations.has(record)) return
      record.cancelRequested = true
      if (record.installing || !record.cancel) return
      try {
        record.cancel()
        continuations.delete(record)
      } catch (cause) {
        fail('continuation-cancel', record, cause)
      }
      notify()
    }
    const cancelContinuations = (): MarkdownHeavyFeatureCancellationRequest => {
      const before = failures.length
      const snapshot = [...continuations]
      for (const record of snapshot) cancelContinuation(record)
      return Object.freeze({
        requested: snapshot.length,
        failures: Object.freeze(failures.slice(before)),
        unavailable: [...continuations].some(
          (record) => !record.installing && !record.cancel,
        ),
      })
    }
    const setTimer: MarkdownHeavyFeatureAdapterResourceOwner['setTimer'] = (
      run,
      delay,
    ) => {
      if (closed) throw abortError()
      const token = Object.freeze({ ref: Symbol('markdown-heavy-timer') })
      const record = {
        installing: true,
        entered: false,
        fired: false,
        cancelRequested: false,
        handle: undefined as ReturnType<typeof setTimeout> | undefined,
      }
      timers.set(token, record)
      notify()
      if (closed || record.cancelRequested) {
        timers.delete(token)
        notify()
        throw abortError()
      }
      try {
        record.entered = true
        record.handle = setTimeout(() => {
          record.fired = true
          timers.delete(token)
          if (closed || record.cancelRequested) {
            notify()
            return
          }
          const callback = Object.freeze({
            ref: Symbol('markdown-heavy-timer-callback'),
          })
          callbacks.add(callback)
          notify()
          const promise = Promise.resolve().then(() => {
            if (closed || record.cancelRequested) return
            return run()
          })
          void observe(promise, callbacks, callback).catch((cause) => {
            fail('timer-callback', token, cause)
            notify()
          })
        }, delay)
        record.installing = false
        if (!record.fired && (closed || record.cancelRequested))
          clearTimer(token)
      } catch (cause) {
        record.installing = false
        unknownTimers = true
        fail('timer-install', token, cause)
        notify()
        throw cause
      }
      notify()
      return token
    }
    const loadImport: MarkdownHeavyFeatureAdapterResourceOwner['loadImport'] = (
      load,
    ) => {
      if (closed) return Promise.reject(abortError())
      const token = Object.freeze({ ref: Symbol('markdown-heavy-import') })
      imports.add(token)
      notify()
      let entered = false
      const promise = Promise.resolve().then(() => {
        if (closed) throw abortError()
        notify()
        if (closed) throw abortError()
        // No native import abort or census of its third-party graph exists.
        unknownTimers = true
        unknownNetwork = true
        entered = true
        return load()
      })
      return observe(promise, imports, token, () =>
        entered ? 'import-settlement' : undefined,
      )
    }
    const observeImport: MarkdownHeavyFeatureAdapterResourceOwner['observeImport'] =
      (promise) => {
        const token = Object.freeze({
          ref: Symbol('markdown-heavy-observed-import'),
        })
        imports.add(token)
        unknownTimers = true
        unknownNetwork = true
        notify()
        return observe(promise, imports, token, 'module-settlement')
      }
    const observeRequest: MarkdownHeavyFeatureAdapterResourceOwner['observeRequest'] =
      (promise, entered) => {
        const token = Object.freeze({
          ref: Symbol('markdown-heavy-observed-request'),
        })
        observedRequests.add(token)
        unknownTimers = true
        unknownNetwork = true
        notify()
        return observe(promise, observedRequests, token, () =>
          !entered || entered() ? 'peer-request-settlement' : undefined,
        )
      }
    const fetchBytes: MarkdownHeavyFeatureAdapterResourceOwner['fetchBytes'] = (
      input,
      init,
    ) => {
      if (closed) return Promise.reject(abortError())
      const record = {
        controller: new AbortController(),
        started: false,
        cancelRequested: false,
        settlementUnknown: false,
      }
      requests.add(record)
      const token = Object.freeze({
        ref: Symbol('markdown-heavy-request-abort'),
      })
      let setupFailed = false
      let setupFailure: unknown
      let signal: AbortSignal | null | undefined
      try {
        signal = init?.signal
      } catch (cause) {
        setupFailed = true
        setupFailure = cause
        fail('request-setup', record, cause)
      }
      if (signal) {
        const externalSignal = signal
        const forward = () => {
          record.cancelRequested = true
          try {
            record.controller.abort(externalSignal.reason)
          } catch (cause) {
            fail('request-abort', record, cause)
          }
        }
        listeners.set(token, () =>
          externalSignal.removeEventListener('abort', forward),
        )
        try {
          externalSignal.addEventListener('abort', forward, { once: true })
          if (externalSignal.aborted) forward()
        } catch (cause) {
          setupFailed = true
          setupFailure = cause
          fail('abort-listener-install', token, cause)
        }
      }
      notify()
      const promise = Promise.resolve().then(async () => {
        if (setupFailed) throw setupFailure
        if (
          closed ||
          record.controller.signal.aborted ||
          record.cancelRequested
        )
          throw abortError()
        record.started = true
        notify()
        if (
          closed ||
          record.controller.signal.aborted ||
          record.cancelRequested
        )
          throw abortError()
        let nativeRequest: Promise<Response>
        try {
          nativeRequest = fetch(input, {
            ...init,
            signal: record.controller.signal,
          })
        } catch (cause) {
          // A native start that throws supplies no settlement promise. Keep its
          // controller/custody obligation, even after this wrapper rejects.
          record.settlementUnknown = true
          unknownNetwork = true
          fail('request-start', record, cause)
          throw cause
        }
        const response = await nativeRequest
        // Headers are not settlement. Keep custody through body consumption.
        let body: Promise<ArrayBuffer>
        try {
          body = response.arrayBuffer()
        } catch (cause) {
          record.settlementUnknown = true
          unknownNetwork = true
          fail('request-body-start', record, cause)
          throw cause
        }
        const bytes = await body
        return Object.freeze({ response, bytes })
      })
      const settle = () => {
        if (!record.settlementUnknown) {
          requests.delete(record)
          removeListener(token)
        }
        notify()
      }
      void promise.then(settle, (cause) => {
        if (record.started) fail('request-settlement', record, cause)
        settle()
      })
      return promise
    }
    const scheduleContinue: MarkdownHeavyFeatureAdapterResourceOwner['scheduleContinue'] =
      (schedule, key, run, drop) => {
        if (closed) {
          drop()
          return null
        }
        const record = {
          cancel: null as (() => void) | null,
          installing: true,
          cancelRequested: false,
        }
        continuations.add(record)
        notify()
        if (closed || record.cancelRequested) {
          continuations.delete(record)
          drop()
          notify()
          return null
        }
        const finish = (callback: () => void) => {
          if (!continuations.has(record)) return
          continuations.delete(record)
          notify()
          if (!closed && !record.cancelRequested) callback()
        }
        try {
          record.cancel = schedule(
            key,
            () => finish(run),
            () => {
              continuations.delete(record)
              notify()
              drop()
            },
          )
          record.installing = false
          if (!record.cancel) {
            continuations.delete(record)
            notify()
            return null
          }
          if (closed || record.cancelRequested) {
            // A synchronous drop can precede the returned cancellation handle.
            if (!continuations.has(record)) continuations.add(record)
            cancelContinuation(record)
          }
          return () => cancelContinuation(record)
        } catch (cause) {
          record.installing = false
          continuations.add(record)
          fail('continuation-install', record, cause)
          notify()
          throw cause
        }
      }
    const resources: MarkdownHeavyFeatureAdapterResources = Object.freeze({
      scope: 'owned-handles',
      get listeners() {
        return listeners.size
      },
      get networkRequests() {
        return unknownNetwork
          ? 'unknown'
          : [...requests].filter((record) => record.started).length
      },
      observers: 0,
      get ownedRequests() {
        return [...requests].filter((record) => record.started).length
      },
      get ownedTimers() {
        return [...timers.values()].filter(
          (record) => record.handle !== undefined && !record.fired,
        ).length
      },
      get pendingRequests() {
        return requests.size + observedRequests.size
      },
      get pendingImports() {
        return imports.size
      },
      get pendingInstallations() {
        return (
          [...timers.values()].filter((record) => record.installing).length +
          [...continuations].filter((record) => record.installing).length
        )
      },
      runtimes: 0,
      get scheduledContinuations() {
        return continuations.size
      },
      get tasks() {
        return (
          imports.size +
          requests.size +
          observedRequests.size +
          callbacks.size +
          continuations.size +
          [...timers.values()].filter((record) => record.installing).length
        )
      },
      get timers() {
        return unknownTimers ||
          [...timers.values()].some(
            (record) =>
              (record.installing && record.entered) ||
              (!record.installing && record.handle === undefined),
          )
          ? 'unknown'
          : [...timers.values()].filter(
              (record) => record.handle !== undefined && !record.fired,
            ).length
      },
      get failures() {
        return Object.freeze([...failures])
      },
      cancelTimers,
      cancelRequests,
      cancelContinuations,
      subscribe(listener: () => void) {
        subscribers.add(listener)
        return () => subscribers.delete(listener)
      },
    })
    return Object.freeze({
      resources,
      setTimer,
      clearTimer,
      fetchBytes,
      loadImport,
      observeImport,
      observeRequest,
      scheduleContinue,
      retainFailure(operation: string, resource: object, cause: unknown) {
        fail(operation, resource, cause)
        notify()
      },
      requestCancellation() {
        if (closed)
          return Object.freeze({
            requested: 0,
            failures: Object.freeze([...failures]),
            unavailable:
              unknownTimers ||
              unknownNetwork ||
              hasMarkdownHeavyFeatureOwnedResources(resources),
          })
        closed = true
        const before = failures.length
        const timer = cancelTimers()
        const request = cancelRequests()
        const continuation = cancelContinuations()
        notify()
        return Object.freeze({
          requested:
            timer.requested + request.requested + continuation.requested,
          failures: Object.freeze(failures.slice(before)),
          unavailable: Boolean(
            timer.unavailable ||
            request.unavailable ||
            continuation.unavailable ||
            imports.size > 0,
          ),
        })
      },
    })
  }

export const requestMarkdownHeavyFeatureResourceCancellation = (
  resources: readonly Partial<MarkdownHeavyFeatureAdapterResources>[],
  kind: 'timers' | 'requests' | 'continuations',
): MarkdownHeavyFeatureCancellationRequest => {
  let requested = 0
  let unavailable = false
  const failures: MarkdownHeavyFeatureResourceFailure[] = []
  for (const resource of resources) {
    const cancel =
      kind === 'timers'
        ? resource.cancelTimers
        : kind === 'requests'
          ? resource.cancelRequests
          : resource.cancelContinuations
    const count =
      kind === 'timers'
        ? resource.timers
        : kind === 'requests'
          ? resource.networkRequests
          : resource.scheduledContinuations
    if (!cancel) {
      if (count !== 0) unavailable = true
      continue
    }
    try {
      const result = cancel()
      requested += result.requested
      unavailable ||= Boolean(result.unavailable)
      failures.push(...result.failures)
    } catch (cause) {
      unavailable = true
      failures.push(
        Object.freeze({
          operation: `${kind}-cancel-provider`,
          resource,
          cause,
        }),
      )
    }
  }
  return Object.freeze({
    requested,
    unavailable,
    failures: Object.freeze(failures),
  })
}

export const hasMarkdownHeavyFeatureOwnedResources = (
  resources: MarkdownHeavyFeatureAdapterResources,
) =>
  resources.listeners > 0 ||
  resources.observers > 0 ||
  resources.runtimes > 0 ||
  resources.tasks > 0 ||
  (resources.pendingImports ?? 0) > 0 ||
  (resources.scheduledContinuations ?? 0) > 0 ||
  (resources.pendingRequests ?? 0) > 0 ||
  (resources.pendingInstallations ?? 0) > 0 ||
  (resources.failures?.length ?? 0) > 0 ||
  (typeof resources.timers === 'number' && resources.timers > 0) ||
  (typeof resources.networkRequests === 'number' &&
    resources.networkRequests > 0)

export interface MarkdownHeavyFeatureIsolatedRenderRequest {
  readonly cspNonce?: string | null
  readonly displayMode?: boolean
  readonly kind: 'code-highlight' | 'latex' | 'mermaid'
  readonly language?: string
  readonly lifecycleKey?: string
  readonly source: string
  readonly theme: 'dark' | 'light'
  readonly tokens: Readonly<Record<string, string>>
}

export const validateMarkdownHeavyFeatureIsolatedRenderRequest = (
  value: unknown,
): MarkdownHeavyFeatureIsolatedRenderRequest | null => {
  try {
    if (!value || typeof value !== 'object') return null
    const input = value as Record<string, unknown>
    if (
      !['code-highlight', 'latex', 'mermaid'].includes(String(input.kind)) ||
      !boundedString(input.source, MAX_ISOLATED_SOURCE_LENGTH) ||
      (input.theme !== 'dark' && input.theme !== 'light') ||
      !input.tokens ||
      typeof input.tokens !== 'object' ||
      Array.isArray(input.tokens) ||
      (input.cspNonce !== undefined &&
        input.cspNonce !== null &&
        !boundedString(input.cspNonce, 4096)) ||
      (input.displayMode !== undefined &&
        typeof input.displayMode !== 'boolean') ||
      (input.language !== undefined && !boundedString(input.language, 128)) ||
      (input.lifecycleKey !== undefined &&
        !boundedString(input.lifecycleKey, 4096))
    ) {
      return null
    }
    const tokenEntries = Object.entries(input.tokens)
    if (
      tokenEntries.length > MAX_ISOLATED_TOKEN_COUNT ||
      tokenEntries.some(
        ([key, token]) =>
          !boundedString(key, 128) || !boundedString(token, 2048),
      )
    ) {
      return null
    }
    return Object.freeze({
      ...(input.cspNonce === undefined ? {} : { cspNonce: input.cspNonce }),
      ...(input.displayMode === undefined
        ? {}
        : { displayMode: input.displayMode }),
      kind: input.kind as MarkdownHeavyFeatureIsolatedRenderRequest['kind'],
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.lifecycleKey === undefined
        ? {}
        : { lifecycleKey: input.lifecycleKey }),
      source: input.source as string,
      theme: input.theme,
      tokens: Object.freeze(Object.fromEntries(tokenEntries)),
    }) as MarkdownHeavyFeatureIsolatedRenderRequest
  } catch {
    return null
  }
}

export const validateMarkdownHeavyFeatureIsolatedRenderOutput = (
  value: unknown,
  expectedKind: MarkdownHeavyFeatureIsolatedRenderRequest['kind'],
): FeatureRenderOutput | null => {
  try {
    if (!value || typeof value !== 'object') return null
    const output = value as Record<string, unknown>
    if (
      output.kind !== expectedKind ||
      !boundedString(output.payload, MAX_ISOLATED_OUTPUT_LENGTH)
    ) {
      return null
    }
    if (expectedKind === 'mermaid') {
      if (!boundedString(output.rootId, 4096)) return null
      return Object.freeze({
        kind: 'mermaid',
        payload: output.payload as string,
        rootId: output.rootId as string,
      })
    }
    return Object.freeze({
      kind: expectedKind,
      payload: output.payload as string,
    }) as FeatureRenderOutput
  } catch {
    return null
  }
}

export interface MarkdownHeavyFeatureIsolatedRenderHandle<T> {
  readonly promise: Promise<T>
  readonly resources: () => MarkdownHeavyFeatureAdapterResources
  readonly teardown: () => void
}

export type MarkdownHeavyFeatureIsolatedRenderFactory = <T>(
  request: MarkdownHeavyFeatureIsolatedRenderRequest,
) => MarkdownHeavyFeatureIsolatedRenderHandle<T>

let isolatedRenderFactory: MarkdownHeavyFeatureIsolatedRenderFactory | null =
  null

export const registerMarkdownHeavyFeatureIsolatedRenderFactory = (
  factory: MarkdownHeavyFeatureIsolatedRenderFactory | null,
) => {
  isolatedRenderFactory = factory
}

export interface MarkdownHeavyFeatureAdapterResourceBridge {
  readonly resources: MarkdownHeavyFeatureAdapterResources
  readonly resourceOwner: MarkdownHeavyFeatureAdapterResourceOwner
  readonly run: <T>(
    lifecycleSignal: AbortSignal,
    render: (
      adapterSignal: AbortSignal,
      resourceOwner: MarkdownHeavyFeatureAdapterResourceOwner,
    ) => Promise<T>,
    isolatedRequest?: MarkdownHeavyFeatureIsolatedRenderRequest,
  ) => Promise<T>
  readonly snapshot: () => Readonly<{
    aborted: boolean
    listenerAttached: boolean
    taskActive: boolean
    cancellationRequested: boolean
  }>
  readonly teardown: () => void
}

const abortError = () => new DOMException('Aborted', 'AbortError')

export const createMarkdownHeavyFeatureAdapterResourceBridgeInternal = (
  startFeatureLocalWork?: () => void,
  renderFactory: MarkdownHeavyFeatureIsolatedRenderFactory | null = isolatedRenderFactory,
): MarkdownHeavyFeatureAdapterResourceBridge => {
  startFeatureLocalWork?.()
  const adapterController = new AbortController()
  const workOwner = createMarkdownHeavyFeatureAdapterResourceOwner()
  let removeLifecycleAbort: (() => void) | null = null
  let removeAdapterAbort: (() => void) | null = null
  let removeIsolatedResourceChange: (() => void) | null = null
  let listenerAttached = false
  let lifecycleListenerInstalling = false
  let adapterListenerInstalling = false
  let directTaskPending = false
  let directRenderStarted = false
  let runStarted = false
  let isolatedTeardownCalled = false
  let teardownRequested = false
  let isolatedHandle: MarkdownHeavyFeatureIsolatedRenderHandle<unknown> | null =
    null
  const resourceChangeListeners = new Set<() => void>()
  const notifyResourceChange = () => {
    for (const listener of resourceChangeListeners) listener()
  }
  workOwner.resources.subscribe?.(notifyResourceChange)

  const removeListener = () => {
    if (lifecycleListenerInstalling) return
    if (removeLifecycleAbort) {
      try {
        removeLifecycleAbort()
      } catch (cause) {
        workOwner.retainFailure(
          'lifecycle-listener-remove',
          removeLifecycleAbort,
          cause,
        )
        return
      }
    }
    removeLifecycleAbort = null
    listenerAttached = false
  }
  const removeAdapterListener = () => {
    if (adapterListenerInstalling || !removeAdapterAbort) return
    const remove = removeAdapterAbort
    try {
      remove()
      if (removeAdapterAbort === remove) removeAdapterAbort = null
    } catch (cause) {
      workOwner.retainFailure('adapter-listener-remove', remove, cause)
    }
  }

  const teardown = () => {
    let changed = false
    if (!teardownRequested) {
      teardownRequested = true
      changed = true
      removeListener()
      workOwner.requestCancellation()
      try {
        adapterController.abort()
      } catch (cause) {
        workOwner.retainFailure('adapter-abort', adapterController, cause)
      }
      removeAdapterListener()
    }
    if (isolatedHandle && !isolatedTeardownCalled) {
      changed = true
      isolatedTeardownCalled = true
      isolatedHandle.teardown()
    }
    if (changed) notifyResourceChange()
  }

  const onIsolatedResourceChange = () => {
    // Keep the provider reachable after wrapper rejection until its real work
    // settles (notably an uncancellable dynamic import).
    if (
      isolatedTeardownCalled &&
      isolatedHandle &&
      !hasMarkdownHeavyFeatureOwnedResources(isolatedHandle.resources())
    ) {
      removeIsolatedResourceChange?.()
      removeIsolatedResourceChange = null
    }
    notifyResourceChange()
  }

  const run = async <T>(
    lifecycleSignal: AbortSignal,
    render: (
      adapterSignal: AbortSignal,
      resourceOwner: MarkdownHeavyFeatureAdapterResourceOwner,
    ) => Promise<T>,
    isolatedRequest?: MarkdownHeavyFeatureIsolatedRenderRequest,
  ): Promise<T> => {
    if (runStarted || teardownRequested || adapterController.signal.aborted)
      throw abortError()
    runStarted = true
    const forwardAbort = teardown
    removeLifecycleAbort = () =>
      lifecycleSignal.removeEventListener('abort', forwardAbort)
    listenerAttached = true
    try {
      lifecycleListenerInstalling = true
      try {
        lifecycleSignal.addEventListener('abort', forwardAbort, { once: true })
      } catch (cause) {
        workOwner.retainFailure(
          'lifecycle-listener-install',
          lifecycleSignal,
          cause,
        )
        throw cause
      } finally {
        lifecycleListenerInstalling = false
      }
      if (teardownRequested) removeListener()
      notifyResourceChange()
      if (lifecycleSignal.aborted) forwardAbort()
      if (teardownRequested || adapterController.signal.aborted)
        throw abortError()
      if (isolatedRequest && renderFactory) {
        const handle = renderFactory<T>(isolatedRequest)
        isolatedHandle =
          handle as MarkdownHeavyFeatureIsolatedRenderHandle<unknown>
        removeIsolatedResourceChange =
          handle.resources().subscribe?.(onIsolatedResourceChange) ?? null
        notifyResourceChange()
        if (teardownRequested || adapterController.signal.aborted) teardown()
        return await handle.promise
      }
      directTaskPending = true
      notifyResourceChange()
      return await new Promise((resolve, reject) => {
        const rejectAbort = () => reject(abortError())
        removeAdapterAbort = () =>
          adapterController.signal.removeEventListener('abort', rejectAbort)
        adapterListenerInstalling = true
        try {
          adapterController.signal.addEventListener('abort', rejectAbort, {
            once: true,
          })
        } catch (cause) {
          directTaskPending = false
          workOwner.retainFailure(
            'adapter-listener-install',
            adapterController.signal,
            cause,
          )
          reject(cause)
          return
        } finally {
          adapterListenerInstalling = false
        }
        if (teardownRequested) removeAdapterListener()
        Promise.resolve()
          .then(() => {
            if (teardownRequested || adapterController.signal.aborted)
              throw abortError()
            directRenderStarted = true
            notifyResourceChange()
            if (teardownRequested || adapterController.signal.aborted)
              throw abortError()
            return render(adapterController.signal, workOwner)
          })
          .then(
            (value) => {
              directTaskPending = false
              removeAdapterListener()
              notifyResourceChange()
              resolve(value)
            },
            (error: unknown) => {
              directTaskPending = false
              removeAdapterListener()
              notifyResourceChange()
              reject(error)
            },
          )
      })
    } finally {
      removeListener()
      if (!directTaskPending) removeAdapterListener()
      if (isolatedHandle && !isolatedTeardownCalled) {
        isolatedTeardownCalled = true
        isolatedHandle.teardown()
      }
      onIsolatedResourceChange()
    }
  }

  const resources: MarkdownHeavyFeatureAdapterResources = Object.freeze({
    scope: 'owned-handles',
    get listeners() {
      return (
        (listenerAttached ? 1 : 0) +
        (removeAdapterAbort ? 1 : 0) +
        (isolatedHandle?.resources().listeners ?? 0) +
        workOwner.resources.listeners
      )
    },
    get networkRequests() {
      return directRenderStarted
        ? 'unknown'
        : isolatedHandle
          ? (isolatedHandle.resources().networkRequests ?? 'unknown')
          : (workOwner.resources.networkRequests ?? 'unknown')
    },
    get observers() {
      return isolatedHandle?.resources().observers ?? 0
    },
    get runtimes() {
      return isolatedHandle?.resources().runtimes ?? 0
    },
    get pendingImports() {
      return (
        (isolatedHandle?.resources().pendingImports ?? 0) +
        (workOwner.resources.pendingImports ?? 0)
      )
    },
    get scheduledContinuations() {
      return (
        (isolatedHandle?.resources().scheduledContinuations ?? 0) +
        (workOwner.resources.scheduledContinuations ?? 0)
      )
    },
    subscribe(listener: () => void) {
      resourceChangeListeners.add(listener)
      return () => resourceChangeListeners.delete(listener)
    },
    get tasks() {
      return (
        (directTaskPending ? 1 : 0) +
        (isolatedHandle?.resources().tasks ?? 0) +
        workOwner.resources.tasks
      )
    },
    get timers() {
      return directRenderStarted
        ? 'unknown'
        : isolatedHandle
          ? (isolatedHandle.resources().timers ?? 'unknown')
          : (workOwner.resources.timers ?? 'unknown')
    },
    get ownedTimers() {
      return (
        (workOwner.resources.ownedTimers ?? 0) +
        (isolatedHandle?.resources().ownedTimers ?? 0)
      )
    },
    get ownedRequests() {
      return (
        (workOwner.resources.ownedRequests ?? 0) +
        (isolatedHandle?.resources().ownedRequests ?? 0)
      )
    },
    get pendingRequests() {
      return (
        (workOwner.resources.pendingRequests ?? 0) +
        (isolatedHandle?.resources().pendingRequests ?? 0)
      )
    },
    get pendingInstallations() {
      return (
        (workOwner.resources.pendingInstallations ?? 0) +
        (isolatedHandle?.resources().pendingInstallations ?? 0) +
        (lifecycleListenerInstalling ? 1 : 0) +
        (adapterListenerInstalling ? 1 : 0)
      )
    },
    get failures() {
      return Object.freeze([
        ...(workOwner.resources.failures ?? []),
        ...(isolatedHandle?.resources().failures ?? []),
      ])
    },
    cancelTimers: () =>
      requestMarkdownHeavyFeatureResourceCancellation(
        [
          workOwner.resources,
          ...(isolatedHandle ? [isolatedHandle.resources()] : []),
        ],
        'timers',
      ),
    cancelRequests: () =>
      requestMarkdownHeavyFeatureResourceCancellation(
        [
          workOwner.resources,
          ...(isolatedHandle ? [isolatedHandle.resources()] : []),
        ],
        'requests',
      ),
    cancelContinuations: () =>
      requestMarkdownHeavyFeatureResourceCancellation(
        [
          workOwner.resources,
          ...(isolatedHandle ? [isolatedHandle.resources()] : []),
        ],
        'continuations',
      ),
  })

  return Object.freeze({
    resources,
    resourceOwner: workOwner,
    run,
    snapshot: () =>
      Object.freeze({
        aborted: adapterController.signal.aborted,
        listenerAttached,
        taskActive: resources.tasks > 0,
        cancellationRequested: teardownRequested,
      }),
    teardown,
  })
}

export const createMarkdownHeavyFeatureAdapterResourceBridge = (
  renderFactory?: MarkdownHeavyFeatureIsolatedRenderFactory | null,
) =>
  createMarkdownHeavyFeatureAdapterResourceBridgeInternal(
    undefined,
    renderFactory ?? isolatedRenderFactory,
  )

export const assertMarkdownHeavyFeatureAdapterResourceBridge = (
  bridge: Partial<MarkdownHeavyFeatureAdapterResourceBridge>,
) => {
  if (
    typeof bridge.run !== 'function' ||
    typeof bridge.teardown !== 'function' ||
    !bridge.resources ||
    [
      bridge.resources.listeners,
      bridge.resources.tasks,
      bridge.resources.observers,
      bridge.resources.runtimes,
    ].some((count) => !Number.isSafeInteger(count) || count < 0)
  ) {
    throw new Error('markdown_heavy_feature_adapter_resource_invalid')
  }
  return bridge as MarkdownHeavyFeatureAdapterResourceBridge
}
