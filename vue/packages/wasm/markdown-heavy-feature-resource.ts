export interface MarkdownHeavyFeatureAdapterResources {
  readonly listeners: number
  readonly observers: number
  readonly runtimes: number
  readonly tasks: number
}

export interface MarkdownHeavyFeatureAdapterResourceBridge {
  readonly resources: MarkdownHeavyFeatureAdapterResources
  readonly run: <T>(
    lifecycleSignal: AbortSignal,
    render: (adapterSignal: AbortSignal) => Promise<T>,
  ) => Promise<T>
  readonly snapshot: () => Readonly<{
    aborted: boolean
    listenerAttached: boolean
    taskActive: boolean
  }>
  readonly teardown: () => void
}

const ACTIVE_ADAPTER_RESOURCES = Object.freeze({
  listeners: 2,
  observers: 0,
  runtimes: 0,
  tasks: 1,
})

const abortError = () => new DOMException('Aborted', 'AbortError')

const createMarkdownHeavyFeatureAdapterResourceBridgeInternal = (
  startFeatureLocalScheduler?: () => void,
): MarkdownHeavyFeatureAdapterResourceBridge => {
  startFeatureLocalScheduler?.()
  const adapterController = new AbortController()
  let removeLifecycleAbort: (() => void) | null = null
  let listenerAttached = false
  let taskActive = false

  const removeListener = () => {
    removeLifecycleAbort?.()
    removeLifecycleAbort = null
    listenerAttached = false
  }

  const teardown = () => {
    removeListener()
    adapterController.abort()
    taskActive = false
  }

  const run: MarkdownHeavyFeatureAdapterResourceBridge['run'] = async (
    lifecycleSignal,
    render,
  ) => {
    if (taskActive || adapterController.signal.aborted) throw abortError()
    taskActive = true
    const forwardAbort = () => adapterController.abort()
    lifecycleSignal.addEventListener('abort', forwardAbort, { once: true })
    removeLifecycleAbort = () =>
      lifecycleSignal.removeEventListener('abort', forwardAbort)
    listenerAttached = true
    if (lifecycleSignal.aborted) forwardAbort()

    try {
      return await new Promise((resolve, reject) => {
        const rejectAbort = () => reject(abortError())
        adapterController.signal.addEventListener('abort', rejectAbort, {
          once: true,
        })
        Promise.resolve()
          .then(() => render(adapterController.signal))
          .then(resolve, reject)
          .finally(() =>
            adapterController.signal.removeEventListener('abort', rejectAbort),
          )
      })
    } finally {
      removeListener()
      taskActive = false
    }
  }

  return Object.freeze({
    resources: ACTIVE_ADAPTER_RESOURCES,
    run,
    snapshot: () =>
      Object.freeze({
        aborted: adapterController.signal.aborted,
        listenerAttached,
        taskActive,
      }),
    teardown,
  })
}

export const createMarkdownHeavyFeatureAdapterResourceBridge = () =>
  createMarkdownHeavyFeatureAdapterResourceBridgeInternal()

export const assertMarkdownHeavyFeatureAdapterResourceBridge = (
  bridge: Partial<MarkdownHeavyFeatureAdapterResourceBridge>,
) => {
  if (
    typeof bridge.run !== 'function' ||
    typeof bridge.teardown !== 'function' ||
    bridge.resources?.listeners !== 2 ||
    bridge.resources.tasks !== 1 ||
    bridge.resources.observers !== 0 ||
    bridge.resources.runtimes !== 0
  ) {
    throw new Error('markdown_heavy_feature_adapter_resource_invalid')
  }
  return bridge as MarkdownHeavyFeatureAdapterResourceBridge
}

type SchedulerAttempt = 'feature-local-interval' | 'feature-local-raf'

const captureSchedulerAttempts = (run: () => void) => {
  const target = globalThis as typeof globalThis &
    Record<'requestAnimationFrame' | 'setInterval', unknown>
  const descriptors = new Map<PropertyKey, PropertyDescriptor | undefined>()
  const attempts: SchedulerAttempt[] = []
  const replace = (
    key: 'requestAnimationFrame' | 'setInterval',
    value: unknown,
  ) => {
    descriptors.set(key, Object.getOwnPropertyDescriptor(target, key))
    Object.defineProperty(target, key, {
      configurable: true,
      value,
      writable: true,
    })
  }
  try {
    replace('requestAnimationFrame', () => {
      attempts.push('feature-local-raf')
      return 1
    })
    replace('setInterval', () => {
      attempts.push('feature-local-interval')
      return 1
    })
    run()
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(target, key, descriptor)
      else delete target[key as 'requestAnimationFrame' | 'setInterval']
    }
  }
  return Object.freeze([...attempts])
}

export const evaluateMarkdownHeavyFeatureAdapterResourceMutations = () => {
  const production = createMarkdownHeavyFeatureAdapterResourceBridge()
  let missingTeardownAccepted = true
  try {
    assertMarkdownHeavyFeatureAdapterResourceBridge({
      resources: production.resources,
      run: production.run,
    })
  } catch {
    missingTeardownAccepted = false
  } finally {
    production.teardown()
  }

  const cleanAttempts = captureSchedulerAttempts(() => {
    const bridge = assertMarkdownHeavyFeatureAdapterResourceBridge(
      createMarkdownHeavyFeatureAdapterResourceBridge(),
    )
    bridge.teardown()
  })
  const mutantAttempts = captureSchedulerAttempts(() => {
    const bridge = createMarkdownHeavyFeatureAdapterResourceBridgeInternal(
      () => {
        requestAnimationFrame(() => undefined)
        setInterval(() => undefined, 16)
      },
    )
    bridge.teardown()
  })

  return Object.freeze({
    featureLocalScheduler: Object.freeze({
      accepted:
        cleanAttempts.length > 0 ||
        mutantAttempts.length !== 2 ||
        !mutantAttempts.includes('feature-local-raf') ||
        !mutantAttempts.includes('feature-local-interval'),
      cleanAttempts,
      mutantAttempts,
    }),
    missingTeardown: Object.freeze({ accepted: missingTeardownAccepted }),
  })
}
