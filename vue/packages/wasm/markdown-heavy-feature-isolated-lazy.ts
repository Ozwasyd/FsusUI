import type {
  MarkdownHeavyFeatureAdapterResources,
  MarkdownHeavyFeatureIsolatedRenderHandle,
  MarkdownHeavyFeatureIsolatedRenderRequest,
} from './markdown-heavy-feature-resource'
import { hasMarkdownHeavyFeatureOwnedResources } from './markdown-heavy-feature-resource'
import type {
  MarkdownHeavyFeatureFrameContinueScheduler,
  MarkdownHeavyFeatureTrustedScriptUrlFactory,
} from './markdown-heavy-feature-frame-scheduler'

interface MarkdownHeavyFeatureIsolatedClient {
  readonly createMarkdownHeavyFeatureIsolatedRender: (
    request: MarkdownHeavyFeatureIsolatedRenderRequest,
    trustedScriptUrlFactory?: MarkdownHeavyFeatureTrustedScriptUrlFactory,
    scheduleContinue?: MarkdownHeavyFeatureFrameContinueScheduler,
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
  let importPending = true
  let innerHandle: MarkdownHeavyFeatureIsolatedRenderHandle<T> | null = null
  let removeInnerResourceChange: (() => void) | null = null
  let rejectAbort!: (reason: unknown) => void
  const resourceChangeListeners = new Set<() => void>()
  const notifyResourceChange = () => {
    for (const listener of resourceChangeListeners) listener()
  }
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
  let clientPromise: Promise<MarkdownHeavyFeatureIsolatedClient>
  try {
    clientPromise = loadClient()
  } catch (error) {
    clientPromise = Promise.reject(error)
  }
  const loadPromise = clientPromise
    .then((client) => {
      importPending = false
      if (!active) throw abortError()
      const handle = client.createMarkdownHeavyFeatureIsolatedRender(
        request,
        trustedScriptUrlFactory,
        scheduleContinue,
      ) as MarkdownHeavyFeatureIsolatedRenderHandle<T>
      // Consume rejection even if subscription/teardown reenters cancellation
      // before the active branch can return the original promise.
      void handle.promise.catch(() => undefined)
      innerHandle = handle
      removeInnerResourceChange =
        handle.resources().subscribe?.(onInnerResourceChange) ?? null
      if (!active) {
        handle.teardown()
        onInnerResourceChange()
        throw abortError()
      }
      notifyResourceChange()
      return handle.promise
    })
    .finally(() => {
      importPending = false
      notifyResourceChange()
    })
  const resources: MarkdownHeavyFeatureAdapterResources = Object.freeze({
    scope: 'owned-handles',
    get listeners() {
      return innerHandle?.resources().listeners ?? 0
    },
    get observers() {
      return innerHandle?.resources().observers ?? 0
    },
    get runtimes() {
      return innerHandle?.resources().runtimes ?? 0
    },
    get networkRequests() {
      // Dynamic imports expose settlement, not an abortable network handle.
      return 'unknown' as const
    },
    get pendingImports() {
      return (
        (importPending ? 1 : 0) + (innerHandle?.resources().pendingImports ?? 0)
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
      return (importPending ? 1 : 0) + (innerHandle?.resources().tasks ?? 0)
    },
    get timers() {
      // A loader callback/import graph is not a timer ownership boundary.
      return 'unknown' as const
    },
  })
  const teardown = () => {
    if (!active) return
    active = false
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
