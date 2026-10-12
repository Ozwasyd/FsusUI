import type {
  MarkdownHeavyFeatureAdapterResources,
  MarkdownHeavyFeatureIsolatedRenderHandle,
  MarkdownHeavyFeatureIsolatedRenderRequest,
} from './markdown-heavy-feature-resource'
import {
  createMarkdownHeavyFeatureAdapterResourceOwner,
  hasMarkdownHeavyFeatureOwnedResources,
  requestMarkdownHeavyFeatureResourceCancellation,
} from './markdown-heavy-feature-resource'
import type {
  MarkdownHeavyFeatureFrameContinueScheduler,
  MarkdownHeavyFeatureTrustedScriptUrlFactory,
} from './markdown-heavy-feature-frame-scheduler'

interface MarkdownHeavyFeatureIsolatedClient {
  readonly createMarkdownHeavyFeatureIsolatedRender: (
    request: MarkdownHeavyFeatureIsolatedRenderRequest,
    trustedScriptUrlFactory?: MarkdownHeavyFeatureTrustedScriptUrlFactory,
    scheduleContinue?: MarkdownHeavyFeatureFrameContinueScheduler,
    onHandleCreated?: (
      handle: MarkdownHeavyFeatureIsolatedRenderHandle<unknown>,
    ) => void,
  ) => MarkdownHeavyFeatureIsolatedRenderHandle<unknown>
}

type MarkdownHeavyFeatureIsolatedClientLoader =
  () => Promise<MarkdownHeavyFeatureIsolatedClient>

const abortError = () => new DOMException('Aborted', 'AbortError')

export const createLazyMarkdownHeavyFeatureIsolatedRender = <T>(
  request: MarkdownHeavyFeatureIsolatedRenderRequest,
  trustedScriptUrlFactory?: MarkdownHeavyFeatureTrustedScriptUrlFactory,
  scheduleContinue?: MarkdownHeavyFeatureFrameContinueScheduler,
  loadClient: MarkdownHeavyFeatureIsolatedClientLoader = () =>
    import('./markdown-heavy-feature-isolated-client'),
): MarkdownHeavyFeatureIsolatedRenderHandle<T> => {
  let active = true
  const importOwner = createMarkdownHeavyFeatureAdapterResourceOwner()
  let innerHandle: MarkdownHeavyFeatureIsolatedRenderHandle<T> | null = null
  let clientInstalling = false
  let removeInnerResourceChange: (() => void) | null = null
  let rejectAbort!: (reason: unknown) => void
  const resourceChangeListeners = new Set<() => void>()
  let notifying = false
  const notifyResourceChange = () => {
    if (notifying) return
    notifying = true
    try {
      for (const listener of [...resourceChangeListeners]) {
        try {
          listener()
        } catch (cause) {
          importOwner.retainFailure('lazy-resource-observer', listener, cause)
        }
      }
    } finally {
      notifying = false
    }
  }
  importOwner.resources.subscribe?.(notifyResourceChange)
  const abortPromise = new Promise<T>((_resolve, reject) => {
    rejectAbort = reject
  })
  const onInnerResourceChange = () => {
    if (
      !active &&
      innerHandle &&
      !hasMarkdownHeavyFeatureOwnedResources(innerHandle.resources())
    ) {
      removeInnerResourceChange?.()
      removeInnerResourceChange = null
    }
    notifyResourceChange()
  }
  const clientPromise = importOwner.loadImport(loadClient)
  const receiveInnerHandle = (
    handle: MarkdownHeavyFeatureIsolatedRenderHandle<unknown>,
  ) => {
    // Borrow the original handle, so teardown during setup reaches its owner.
    const ownedHandle = handle as MarkdownHeavyFeatureIsolatedRenderHandle<T>
    void ownedHandle.promise.catch(() => undefined)
    innerHandle = ownedHandle
    removeInnerResourceChange =
      ownedHandle.resources().subscribe?.(onInnerResourceChange) ?? null
    if (!active) {
      ownedHandle.teardown()
      onInnerResourceChange()
    }
  }
  const loadPromise = clientPromise
    .then((client) => {
      if (!active) throw abortError()
      clientInstalling = true
      try {
        notifyResourceChange()
        if (!active) return Promise.reject(abortError())
        const handle = client.createMarkdownHeavyFeatureIsolatedRender(
          request,
          trustedScriptUrlFactory,
          scheduleContinue,
          receiveInnerHandle,
        ) as MarkdownHeavyFeatureIsolatedRenderHandle<T>
        if (innerHandle !== handle) receiveInnerHandle(handle)
        if (!active) {
          handle.teardown()
          onInnerResourceChange()
          return handle.promise
        }
        notifyResourceChange()
        return handle.promise
      } catch (cause) {
        importOwner.retainFailure('isolated-client-install', client, cause)
        throw cause
      } finally {
        clientInstalling = false
        notifyResourceChange()
      }
    })
    .finally(() => {
      notifyResourceChange()
    })
  const resources: MarkdownHeavyFeatureAdapterResources = Object.freeze({
    scope: 'owned-handles',
    get listeners() {
      return (
        importOwner.resources.listeners +
        (innerHandle?.resources().listeners ?? 0)
      )
    },
    get observers() {
      return innerHandle?.resources().observers ?? 0
    },
    get frameProvider() {
      return innerHandle?.resources().frameProvider
    },
    get runtimes() {
      return innerHandle?.resources().runtimes ?? 0
    },
    get networkRequests() {
      // Dynamic imports expose settlement, not an abortable network handle.
      return importOwner.resources.networkRequests ?? 'unknown'
    },
    get pendingImports() {
      return (
        (importOwner.resources.pendingImports ?? 0) +
        (innerHandle?.resources().pendingImports ?? 0)
      )
    },
    get scheduledContinuations() {
      return innerHandle?.resources().scheduledContinuations ?? 0
    },
    subscribe(listener: () => void) {
      resourceChangeListeners.add(listener)
      return () => resourceChangeListeners.delete(listener)
    },
    get tasks() {
      return importOwner.resources.tasks + (innerHandle?.resources().tasks ?? 0)
    },
    get timers() {
      // A loader callback/import graph is not a timer ownership boundary.
      return importOwner.resources.timers ?? 'unknown'
    },
    get ownedTimers() {
      return (
        (importOwner.resources.ownedTimers ?? 0) +
        (innerHandle?.resources().ownedTimers ?? 0)
      )
    },
    get ownedRequests() {
      return (
        (importOwner.resources.ownedRequests ?? 0) +
        (innerHandle?.resources().ownedRequests ?? 0)
      )
    },
    get pendingRequests() {
      return (
        (importOwner.resources.pendingRequests ?? 0) +
        (innerHandle?.resources().pendingRequests ?? 0)
      )
    },
    get pendingInstallations() {
      return (
        (importOwner.resources.pendingInstallations ?? 0) +
        (clientInstalling ? 1 : 0) +
        (innerHandle?.resources().pendingInstallations ?? 0)
      )
    },
    get failures() {
      return Object.freeze([
        ...(importOwner.resources.failures ?? []),
        ...(innerHandle?.resources().failures ?? []),
      ])
    },
    cancelTimers: () =>
      requestMarkdownHeavyFeatureResourceCancellation(
        [
          importOwner.resources,
          ...(innerHandle ? [innerHandle.resources()] : []),
        ],
        'timers',
      ),
    cancelRequests: () =>
      requestMarkdownHeavyFeatureResourceCancellation(
        [
          importOwner.resources,
          ...(innerHandle ? [innerHandle.resources()] : []),
        ],
        'requests',
      ),
    cancelContinuations: () =>
      requestMarkdownHeavyFeatureResourceCancellation(
        [
          importOwner.resources,
          ...(innerHandle ? [innerHandle.resources()] : []),
        ],
        'continuations',
      ),
  })
  const teardown = () => {
    if (!active) return
    active = false
    importOwner.requestCancellation()
    innerHandle?.teardown()
    rejectAbort(abortError())
    onInnerResourceChange()
  }

  return Object.freeze({
    promise: Promise.race([loadPromise, abortPromise]),
    resources: () => resources,
    teardown,
  })
}
