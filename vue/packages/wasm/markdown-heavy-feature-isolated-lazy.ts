import type {
  MarkdownHeavyFeatureAdapterResources,
  MarkdownHeavyFeatureIsolatedRenderHandle,
  MarkdownHeavyFeatureIsolatedRenderRequest,
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
  let taskActive = true
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
  const loadPromise = loadClient()
    .then((client) => {
      if (!active) throw abortError()
      const handle = client.createMarkdownHeavyFeatureIsolatedRender(
        request,
        trustedScriptUrlFactory,
        scheduleContinue,
      ) as MarkdownHeavyFeatureIsolatedRenderHandle<T>
      if (!active) {
        handle.teardown()
        throw abortError()
      }
      innerHandle = handle
      taskActive = false
      removeInnerResourceChange = handle.resources().subscribe?.(
        notifyResourceChange,
      ) ?? null
      notifyResourceChange()
      return handle.promise
    })
    .finally(() => {
      taskActive = false
      notifyResourceChange()
    })
  const resources: MarkdownHeavyFeatureAdapterResources = Object.freeze({
    get listeners() {
      return innerHandle?.resources().listeners ?? 0
    },
    get observers() {
      return innerHandle?.resources().observers ?? 0
    },
    get runtimes() {
      return taskActive ? 1 : (innerHandle?.resources().runtimes ?? 0)
    },
    subscribe(listener: () => void) {
      resourceChangeListeners.add(listener)
      return () => resourceChangeListeners.delete(listener)
    },
    get tasks() {
      return taskActive ? 1 : (innerHandle?.resources().tasks ?? 0)
    },
  })
  const teardown = () => {
    if (!active) return
    active = false
    taskActive = false
    removeInnerResourceChange?.()
    removeInnerResourceChange = null
    innerHandle?.teardown()
    innerHandle = null
    rejectAbort(abortError())
    notifyResourceChange()
  }

  return Object.freeze({
    promise: Promise.race([loadPromise, abortPromise]),
    resources: () => resources,
    teardown,
  })
}
