import { inject, provide } from 'vue'

import type { InjectionKey } from 'vue'

export const MARKDOWN_HEAVY_FEATURE_KINDS = Object.freeze([
  'code-highlight',
  'latex',
  'mermaid',
] as const)

export type MarkdownHeavyFeatureKind =
  (typeof MARKDOWN_HEAVY_FEATURE_KINDS)[number]

export type MarkdownHeavyFeatureState =
  | 'active-work'
  | 'static-mounted'
  | 'unmounted'

export const MARKDOWN_HEAVY_FEATURE_CACHE_BUDGET = Object.freeze({
  maxBytes: 4 * 1024 * 1024,
  maxEntries: 128,
  version: 'markdown-heavy-feature-cache@1',
})

export interface MarkdownHeavyFeatureIdentity {
  readonly config: string
  readonly documentEpoch: number | string
  readonly documentKey: string
  readonly featureKind: MarkdownHeavyFeatureKind
  readonly gatewayVersion: string
  readonly locale: string
  readonly nodeId: string
  readonly rendererVersion: string
  readonly revision: number | string
  readonly sourceIdentity: string
  readonly theme: string
}

export interface MarkdownHeavyFeatureLifecycleMetrics {
  readonly aborts: number
  readonly activations: number
  readonly activeNodes: number
  readonly cacheBytes: number
  readonly cacheEntries: number
  readonly evictions: number
  readonly reuses: number
  readonly retainedListeners: number
  readonly retainedObservers: number
  readonly retainedResources: number
  readonly retainedRuntimes: number
  readonly retainedTasks: number
  readonly staleCommits: number
  readonly staticNodes: number
  readonly teardowns: number
  readonly unmountedNodes: number
}

export interface MarkdownHeavyFeatureResources {
  readonly listeners: number
  readonly observers: number
  readonly runtimes: number
  readonly tasks: number
}

export interface MarkdownHeavyFeatureActivation<T> {
  readonly commit: (
    value: T,
    signal: AbortSignal,
  ) => HTMLElement | void | Promise<HTMLElement | void>
  readonly element: HTMLElement
  readonly estimateBytes: (value: T) => number
  readonly identity: MarkdownHeavyFeatureIdentity
  readonly render: (signal: AbortSignal) => Promise<T>
  readonly resources?: Partial<MarkdownHeavyFeatureResources>
  readonly signal?: AbortSignal
  readonly teardown?: () => void
}

export interface MarkdownHeavyFeatureLifecycle {
  activate: <T>(input: MarkdownHeavyFeatureActivation<T>) => Promise<boolean>
  dispose: () => void
  metrics: () => MarkdownHeavyFeatureLifecycleMetrics
  resetDocument: (documentKey: string, documentEpoch: number | string) => void
  unmountRoot: (root: ParentNode) => void
}

export interface MarkdownHeavyFeatureLifecycleOptions {
  readonly maxBytes?: number
  readonly maxEntries?: number
}

interface CacheEntry {
  readonly bytes: number
  readonly key: string
  readonly value: unknown
  used: number
}

interface NodeRecord {
  controller: AbortController | null
  documentEpoch: number | string
  documentKey: string
  element: HTMLElement
  identityKey: string
  resources: MarkdownHeavyFeatureResources
  state: Exclude<MarkdownHeavyFeatureState, 'unmounted'>
  teardown?: () => void
}

const identityParts = (identity: MarkdownHeavyFeatureIdentity) => [
  identity.documentKey,
  identity.documentEpoch,
  identity.revision,
  identity.nodeId,
  identity.featureKind,
  identity.sourceIdentity,
  identity.config,
  identity.theme,
  identity.locale,
  identity.rendererVersion,
  identity.gatewayVersion,
]

const validIdentity = (identity: MarkdownHeavyFeatureIdentity) =>
  identityParts(identity).every(
    (part) =>
      (typeof part === 'string' && part.length > 0) ||
      (typeof part === 'number' && Number.isFinite(part)),
  )

const cacheKeyOf = (identity: MarkdownHeavyFeatureIdentity) =>
  JSON.stringify(identityParts(identity))

const nodeKeyOf = (identity: MarkdownHeavyFeatureIdentity) =>
  JSON.stringify([
    identity.documentKey,
    identity.documentEpoch,
    identity.nodeId,
    identity.featureKind,
  ])

const normalizeResourceCount = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0

const normalizeResources = (
  resources: Partial<MarkdownHeavyFeatureResources> | undefined,
): MarkdownHeavyFeatureResources => ({
  listeners: normalizeResourceCount(resources?.listeners),
  observers: normalizeResourceCount(resources?.observers),
  runtimes: normalizeResourceCount(resources?.runtimes),
  tasks: normalizeResourceCount(resources?.tasks),
})

const totalResources = (resources: MarkdownHeavyFeatureResources) =>
  resources.listeners +
  resources.observers +
  resources.runtimes +
  resources.tasks

const EMPTY_RESOURCES = Object.freeze({
  listeners: 0,
  observers: 0,
  runtimes: 0,
  tasks: 0,
})

const isDeeplyFrozen = (
  value: unknown,
  seen = new WeakSet<object>(),
): boolean => {
  if (Object(value) !== value) return true
  const object = value as object
  if (seen.has(object)) return true
  if (!Object.isFrozen(object)) return false
  seen.add(object)
  return Reflect.ownKeys(object).every((key) =>
    isDeeplyFrozen((object as Record<PropertyKey, unknown>)[key], seen),
  )
}

export const createMarkdownHeavyFeatureLifecycle = (
  options: MarkdownHeavyFeatureLifecycleOptions = {},
): MarkdownHeavyFeatureLifecycle => {
  const normalizeBudget = (value: number | undefined, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.floor(value))
      : fallback
  const maxBytes = normalizeBudget(
    options.maxBytes,
    MARKDOWN_HEAVY_FEATURE_CACHE_BUDGET.maxBytes,
  )
  const maxEntries = normalizeBudget(
    options.maxEntries,
    MARKDOWN_HEAVY_FEATURE_CACHE_BUDGET.maxEntries,
  )
  const cache = new Map<string, CacheEntry>()
  const nodes = new Map<string, NodeRecord>()
  let cacheBytes = 0
  let clock = 0
  let aborts = 0
  let activations = 0
  let evictions = 0
  let reuses = 0
  let retainedListeners = 0
  let retainedObservers = 0
  let retainedRuntimes = 0
  let retainedTasks = 0
  let staleCommits = 0
  let teardowns = 0
  let unmountedNodes = 0
  let disposed = false

  const releaseActiveResource = (record: NodeRecord) => {
    const resources = record.resources
    retainedListeners -= resources.listeners
    retainedObservers -= resources.observers
    retainedRuntimes -= resources.runtimes
    retainedTasks -= resources.tasks
    record.resources = EMPTY_RESOURCES
    const teardown = record.teardown
    record.teardown = undefined
    teardown?.()
  }

  const teardownRecord = (record: NodeRecord) => {
    if (record.controller && !record.controller.signal.aborted) {
      record.controller.abort()
      aborts += 1
    }
    record.controller = null
    releaseActiveResource(record)
    teardowns += 1
  }

  const evict = () => {
    while (cache.size > maxEntries || cacheBytes > maxBytes) {
      let oldest: CacheEntry | undefined
      for (const entry of cache.values()) {
        if (!oldest || entry.used < oldest.used) oldest = entry
      }
      if (!oldest) break
      cache.delete(oldest.key)
      cacheBytes -= oldest.bytes
      evictions += 1
    }
  }

  const activate = async <T>(input: MarkdownHeavyFeatureActivation<T>) => {
    if (disposed || !validIdentity(input.identity)) return false
    const resources = normalizeResources(input.resources)
    if (totalResources(resources) > 0 && !input.teardown) {
      throw new Error('markdown_heavy_feature_teardown_required')
    }
    const nodeKey = nodeKeyOf(input.identity)
    const identityKey = cacheKeyOf(input.identity)
    const previous = nodes.get(nodeKey)
    if (previous) {
      teardownRecord(previous)
      nodes.delete(nodeKey)
    }

    const controller = new AbortController()
    const record: NodeRecord = {
      controller,
      documentEpoch: input.identity.documentEpoch,
      documentKey: input.identity.documentKey,
      element: input.element,
      identityKey,
      resources,
      state: 'active-work',
      teardown: input.teardown,
    }
    retainedListeners += resources.listeners
    retainedObservers += resources.observers
    retainedRuntimes += resources.runtimes
    retainedTasks += resources.tasks
    nodes.set(nodeKey, record)
    const discardIfCurrent = () => {
      if (nodes.get(nodeKey) !== record) return
      teardownRecord(record)
      nodes.delete(nodeKey)
      unmountedNodes += 1
    }
    const abort = () => discardIfCurrent()
    input.signal?.addEventListener('abort', abort, { once: true })
    if (input.signal?.aborted) {
      discardIfCurrent()
      input.signal.removeEventListener('abort', abort)
      return false
    }

    try {
      const cached = cache.get(identityKey)
      if (cached) {
        cached.used = ++clock
        const committed = await input.commit(
          cached.value as T,
          controller.signal,
        )
        if (controller.signal.aborted || nodes.get(nodeKey) !== record) {
          discardIfCurrent()
          staleCommits += 1
          return false
        }
        if (committed) record.element = committed
        releaseActiveResource(record)
        record.controller = null
        record.state = 'static-mounted'
        reuses += 1
        return false
      }

      activations += 1
      const value = await input.render(controller.signal)
      const current = nodes.get(nodeKey)
      if (
        controller.signal.aborted ||
        current !== record ||
        current.identityKey !== identityKey
      ) {
        discardIfCurrent()
        staleCommits += 1
        return false
      }
      if (!isDeeplyFrozen(value)) {
        discardIfCurrent()
        staleCommits += 1
        return false
      }
      const committed = await input.commit(value, controller.signal)
      if (controller.signal.aborted || nodes.get(nodeKey) !== record) {
        discardIfCurrent()
        staleCommits += 1
        return false
      }
      if (committed) current.element = committed
      releaseActiveResource(current)
      current.controller = null
      current.state = 'static-mounted'
      const estimate = input.estimateBytes(value)
      const bytes =
        Number.isFinite(estimate) && estimate >= 0
          ? Math.floor(estimate)
          : maxBytes + 1
      if (bytes <= maxBytes) {
        const old = cache.get(identityKey)
        if (old) cacheBytes -= old.bytes
        cache.set(identityKey, {
          bytes,
          key: identityKey,
          used: ++clock,
          value,
        })
        cacheBytes += bytes
        evict()
      }
      return true
    } catch (error) {
      if (controller.signal.aborted) {
        discardIfCurrent()
        staleCommits += 1
        return false
      }
      discardIfCurrent()
      throw error
    } finally {
      input.signal?.removeEventListener('abort', abort)
      if (record.controller === controller) record.controller = null
    }
  }

  const unmountRoot = (root: ParentNode) => {
    const rootNode = root as Node
    for (const [key, record] of nodes) {
      if (rootNode === record.element || rootNode.contains(record.element)) {
        teardownRecord(record)
        nodes.delete(key)
        unmountedNodes += 1
      }
    }
  }

  const resetDocument = (
    documentKey: string,
    documentEpoch: number | string,
  ) => {
    for (const [key, record] of nodes) {
      if (
        record.documentKey !== documentKey ||
        record.documentEpoch !== documentEpoch
      ) {
        teardownRecord(record)
        nodes.delete(key)
        unmountedNodes += 1
      }
    }
  }

  const metrics = (): MarkdownHeavyFeatureLifecycleMetrics => {
    let activeNodes = 0
    let staticNodes = 0
    for (const record of nodes.values()) {
      if (record.state === 'active-work') activeNodes += 1
      else staticNodes += 1
    }
    return Object.freeze({
      aborts,
      activations,
      activeNodes,
      cacheBytes,
      cacheEntries: cache.size,
      evictions,
      reuses,
      retainedListeners,
      retainedObservers,
      retainedResources:
        retainedListeners +
        retainedObservers +
        retainedRuntimes +
        retainedTasks,
      retainedRuntimes,
      retainedTasks,
      staleCommits,
      staticNodes,
      teardowns,
      unmountedNodes,
    })
  }

  const dispose = () => {
    disposed = true
    for (const record of nodes.values()) teardownRecord(record)
    nodes.clear()
    cache.clear()
    cacheBytes = 0
  }

  return Object.freeze({
    activate,
    dispose,
    metrics,
    resetDocument,
    unmountRoot,
  })
}

export interface MarkdownHeavyFeatureDocumentContext {
  readonly documentEpoch: () => number | string
  readonly documentKey: () => string
  readonly revision: () => number | string
}

export const MARKDOWN_HEAVY_FEATURE_DOCUMENT_CONTEXT: InjectionKey<MarkdownHeavyFeatureDocumentContext> =
  Symbol.for('fsus-markdown-heavy-feature-document-context')

export const provideMarkdownHeavyFeatureDocumentContext = (
  context: MarkdownHeavyFeatureDocumentContext,
) => provide(MARKDOWN_HEAVY_FEATURE_DOCUMENT_CONTEXT, context)

export const useMarkdownHeavyFeatureDocumentContext = () =>
  inject(MARKDOWN_HEAVY_FEATURE_DOCUMENT_CONTEXT, null)

export type MarkdownHeavyFeatureLifecycleMutationKind =
  | 'cross-document-reuse'
  | 'feature-local-scheduler'
  | 'missing-teardown'
  | 'offscreen-resident-runtime'
  | 'stale-commit'
  | 'unbounded-cache'

type MarkdownHeavyFeatureSchedulerAttempt =
  | 'feature-local-interval'
  | 'feature-local-raf'

const captureMarkdownHeavyFeatureSchedulerAttempts = (run: () => void) => {
  const target = globalThis as typeof globalThis &
    Record<'requestAnimationFrame' | 'setInterval', unknown>
  const descriptors = new Map<PropertyKey, PropertyDescriptor | undefined>()
  const attempts: MarkdownHeavyFeatureSchedulerAttempt[] = []
  const replace = (key: 'requestAnimationFrame' | 'setInterval', value: unknown) => {
    descriptors.set(key, Object.getOwnPropertyDescriptor(target, key))
    Object.defineProperty(target, key, {
      configurable: true,
      value,
      writable: true,
    })
  }
  const restore = () => {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(target, key, descriptor)
      else delete target[key as 'requestAnimationFrame' | 'setInterval']
    }
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
    restore()
  }
  return Object.freeze([...attempts])
}

export const evaluateMarkdownHeavyFeatureSchedulerMutation = () => {
  const cleanAttempts = captureMarkdownHeavyFeatureSchedulerAttempts(() => {
    createMarkdownHeavyFeatureLifecycle().dispose()
  })
  const mutantAttempts = captureMarkdownHeavyFeatureSchedulerAttempts(() => {
    requestAnimationFrame(() => undefined)
    setInterval(() => undefined, 16)
  })
  return Object.freeze({
    accepted:
      cleanAttempts.length > 0 ||
      mutantAttempts.length !== 2 ||
      !mutantAttempts.includes('feature-local-raf') ||
      !mutantAttempts.includes('feature-local-interval'),
    cleanAttempts,
    mutantAttempts,
  })
}

export const evaluateMarkdownHeavyFeatureLifecycleMutations = async () => {
  const lifecycle = createMarkdownHeavyFeatureLifecycle({
    maxBytes: 32,
    maxEntries: 1,
  })
  const element = document.createElement('div')
  let resolveRender!: (value: Readonly<{ payload: string }>) => void
  let resourceTeardowns = 0
  const identity = (
    epoch: number,
    nodeId: string,
  ): MarkdownHeavyFeatureIdentity => ({
    config: 'default',
    documentEpoch: epoch,
    documentKey: 'doc',
    featureKind: 'latex',
    gatewayVersion: 'gateway@1',
    locale: 'en',
    nodeId,
    rendererVersion: 'renderer@1',
    revision: 1,
    sourceIdentity: `source:${epoch}:${nodeId}`,
    theme: 'light',
  })
  const pending = lifecycle.activate<Readonly<{ payload: string }>>({
    commit: () => undefined,
    element,
    estimateBytes: (value) => value.payload.length * 2,
    identity: identity(1, 'stale'),
    resources: { runtimes: 1, tasks: 1 },
    render: () =>
      new Promise((resolve) => {
        resolveRender = resolve
      }),
    teardown: () => {
      resourceTeardowns += 1
    },
  })
  lifecycle.unmountRoot(element)
  resolveRender(Object.freeze({ payload: 'stale' }))
  await pending
  let documentRenders = 0
  for (const epoch of [10, 11]) {
    const documentElement = document.createElement('div')
    await lifecycle.activate({
      commit: () => undefined,
      element: documentElement,
      estimateBytes: (value) => value.payload.length * 2,
      identity: {
        ...identity(epoch, 'same-node'),
        sourceIdentity: 'same-source',
      },
      render: async () => {
        documentRenders += 1
        return Object.freeze({ payload: 'same' })
      },
    })
    lifecycle.unmountRoot(documentElement)
  }
  for (const nodeId of ['a', 'b']) {
    await lifecycle.activate({
      commit: () => undefined,
      element,
      estimateBytes: (value) => value.payload.length * 2,
      identity: identity(2, nodeId),
      render: async () => Object.freeze({ payload: nodeId.repeat(12) }),
    })
  }
  const report = lifecycle.metrics()
  const schedulerMutation = evaluateMarkdownHeavyFeatureSchedulerMutation()
  lifecycle.dispose()
  return Object.freeze({
    mutations: Object.freeze([
      {
        accepted:
          report.activeNodes > 0 ||
          report.retainedResources > 0 ||
          resourceTeardowns !== 1,
        kind: 'offscreen-resident-runtime' as const,
      },
      { accepted: report.cacheEntries > 1, kind: 'unbounded-cache' as const },
      { accepted: report.staleCommits === 0, kind: 'stale-commit' as const },
      { accepted: report.teardowns === 0, kind: 'missing-teardown' as const },
      {
        accepted: documentRenders !== 2,
        kind: 'cross-document-reuse' as const,
      },
      {
        accepted: schedulerMutation.accepted,
        kind: 'feature-local-scheduler' as const,
      },
    ]),
    report,
    schedulerMutation,
  })
}
