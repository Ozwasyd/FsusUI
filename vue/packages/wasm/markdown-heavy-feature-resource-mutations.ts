import {
  assertMarkdownHeavyFeatureAdapterResourceBridge,
  createMarkdownHeavyFeatureAdapterResourceBridge,
  createMarkdownHeavyFeatureAdapterResourceBridgeInternal,
} from './markdown-heavy-feature-resource'

type SchedulerAttempt = 'feature-local-interval' | 'feature-local-raf'
type RetentionAttempt =
  | 'feature-local-mutation-observer'
  | 'feature-local-promise-retry'
  | 'feature-local-resize-observer'

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

const captureRetentionAttempts = (run: () => void) => {
  const target = globalThis as typeof globalThis & Record<PropertyKey, unknown>
  const descriptors = new Map<PropertyKey, PropertyDescriptor | undefined>()
  const attempts: RetentionAttempt[] = []
  const queuedMicrotasks: Array<() => void> = []
  const replace = (key: PropertyKey, value: unknown) => {
    descriptors.set(key, Object.getOwnPropertyDescriptor(target, key))
    Object.defineProperty(target, key, {
      configurable: true,
      value,
      writable: true,
    })
  }
  const Observer = class {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
  try {
    replace(
      'MutationObserver',
      class extends Observer {
        constructor() {
          super()
          attempts.push('feature-local-mutation-observer')
        }
      },
    )
    replace(
      'ResizeObserver',
      class extends Observer {
        constructor() {
          super()
          attempts.push('feature-local-resize-observer')
        }
      },
    )
    replace('queueMicrotask', (callback: () => void) => {
      attempts.push('feature-local-promise-retry')
      if (
        attempts.filter((attempt) => attempt === 'feature-local-promise-retry')
          .length <= 4
      ) {
        queuedMicrotasks.push(callback)
      }
    })
    run()
    while (queuedMicrotasks.length > 0) queuedMicrotasks.shift()?.()
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(target, key, descriptor)
      else delete target[key]
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
  const cleanRetentionAttempts = captureRetentionAttempts(() => {
    const bridge = assertMarkdownHeavyFeatureAdapterResourceBridge(
      createMarkdownHeavyFeatureAdapterResourceBridge(),
    )
    bridge.teardown()
  })
  const mutantRetentionAttempts = captureRetentionAttempts(() => {
    const bridge = createMarkdownHeavyFeatureAdapterResourceBridgeInternal(
      () => {
        new MutationObserver(() => undefined)
        new ResizeObserver(() => undefined)
        const retry = () => queueMicrotask(retry)
        queueMicrotask(retry)
      },
    )
    bridge.teardown()
  })

  return Object.freeze({
    featureLocalRetention: Object.freeze({
      accepted:
        cleanRetentionAttempts.length > 0 ||
        !mutantRetentionAttempts.includes('feature-local-mutation-observer') ||
        !mutantRetentionAttempts.includes('feature-local-resize-observer') ||
        mutantRetentionAttempts.filter(
          (attempt) => attempt === 'feature-local-promise-retry',
        ).length < 4,
      cleanAttempts: cleanRetentionAttempts,
      mutantAttempts: mutantRetentionAttempts,
    }),
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
