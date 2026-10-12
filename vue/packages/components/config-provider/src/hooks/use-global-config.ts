import {
  computed,
  getCurrentInstance,
  getCurrentScope,
  inject,
  isProxy,
  onScopeDispose,
  provide,
  ref,
  shallowRef,
  unref,
} from 'vue'
import { debugWarn, keysOf } from '@element-plus/utils'
import {
  SIZE_INJECTION_KEY,
  defaultInitialZIndex,
  defaultNamespace,
  localeContextKey,
  namespaceContextKey,
  useLocale,
  useNamespace,
  useZIndex,
  zIndexContextKey,
} from '@element-plus/hooks'
import { configProviderContextKey } from '../constants'

import type { MaybeRef } from 'vue'
import type { App, Ref } from 'vue'
import type {
  ConfigProviderContext,
  GlobalConfigFeed,
  GlobalConfigSnapshotProducer,
  GlobalConfigTicket,
} from '../constants'

type Publication = {
  identity: object
  snapshot?: ConfigProviderContext
  owned: boolean
  active: boolean
  valid: boolean
  writing: boolean
  epoch: number
  revoke: Set<() => void>
  publish: Set<() => void>
  cleanup: Set<() => void>
  failures: readonly unknown[]
  sources: Set<Publication>
}

const publications = new WeakMap<object, Publication>()
const feeds = new WeakMap<object, GlobalConfigFeed<unknown>>()
const producers = new WeakMap<object, Publication>()
const providerOwners = new WeakMap<object, Publication>()
const subscriptionOwners = new WeakMap<
  () => void,
  { listener: () => void; subscriptionId: object }
>()
const NativePromise = Promise

const createPublication = (owned: boolean): Publication => ({
  identity: Object.freeze({}),
  owned,
  active: true,
  valid: false,
  writing: false,
  epoch: 0,
  revoke: new Set(),
  publish: new Set(),
  cleanup: new Set(),
  failures: Object.freeze([]),
  sources: new Set(),
})

const publicationCurrent = (publication: Publication): boolean =>
  publication.active &&
  publication.owned &&
  publication.valid &&
  !publication.failures.length &&
  [...publication.sources].every(publicationCurrent)

const publicationFailures = (publication: Publication): readonly unknown[] =>
  Object.freeze([
    ...publication.failures,
    ...[...publication.sources].flatMap(publicationFailures),
  ])

const recordCallbackFailure = (
  publication: Publication,
  owner: { listener: () => void; subscriptionId?: object; contextIdentity: object },
  cause: unknown
) => {
  publication.failures = Object.freeze([
    ...publication.failures,
    Object.freeze({ ...owner, cause }),
  ])
  publication.valid = false
}

type CallbackThen = (
  fulfilled: () => void,
  rejected: (cause: unknown) => void
) => unknown

const observeCallbackResult = (
  publication: Publication,
  owner: { listener: () => void; subscriptionId?: object; contextIdentity: object },
  result: unknown,
  then: CallbackThen
) => {
  // Use notify's pre-invocation owner, including across synchronous reentry.
  const rejected = (cause: unknown) =>
    recordCallbackFailure(publication, owner, cause)
  const drain = async (value: unknown) => {
    try {
      await value
    } catch (cause) {
      rejected(cause)
    }
  }
  // Await installs the intrinsic reaction on a native Promise without calling
  // its .then/.catch or creating a Symbol.species continuation.
  if (result instanceof NativePromise && result.constructor === NativePromise) {
    void drain(result)
    return
  }
  try {
    const continuation = then.call(result, () => undefined, rejected)
    // A custom then/species can return a separately rejected continuation.
    // Observe its outcome too, rather than discard it or record it as a cause.
    if (continuation !== result) void drain(continuation)
  } catch (cause) {
    rejected(cause)
  }
}

const notify = (publication: Publication, listeners: Set<() => void>) => {
  let failed = false
  let failure: unknown
  for (const listener of [...listeners]) {
    const owner = {
      listener,
      ...subscriptionOwners.get(listener),
      contextIdentity: publication.identity,
    }
    try {
      const result: unknown = listener()
      const native = result instanceof NativePromise
      const then = !native && result
        ? (result as { then?: unknown }).then
        : undefined
      if (native || typeof then === 'function') {
        observeCallbackResult(
          publication,
          owner,
          result,
          native ? NativePromise.prototype.then : (then as CallbackThen)
        )
        throw new Error('Config custody callbacks must be synchronous')
      }
    } catch (error) {
      failed = true
      failure = error
      recordCallbackFailure(publication, owner, error)
    }
  }
  if (failed) throw failure
}

const revokePublication = (publication: Publication) => {
  publication.valid = false
  publication.epoch++
  notify(publication, publication.revoke)
}

const releasePublication = (publication: Publication) => {
  if (!publication.active) return
  publication.active = false
  try {
    revokePublication(publication)
  } finally {
    try {
      notify(publication, publication.cleanup)
    } finally {
      publication.revoke.clear()
      publication.publish.clear()
      publication.cleanup.clear()
      publication.sources.clear()
    }
  }
}

// Copy data rather than freeze the caller's objects. Live proxies, accessors,
// functions and mutable class instances cannot enter the controlled path.
const snapshotConfig = <T>(value: T, ancestors = new Set<object>()): T => {
  if (typeof value === 'function') throw new Error('Unsupported config snapshot')
  if (!value || typeof value !== 'object') return value
  if (
    isProxy(value) ||
    ancestors.has(value) ||
    (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)
  ) {
    throw new Error('Config snapshots require acyclic plain data')
  }
  ancestors.add(value)
  const copy = (Array.isArray(value) ? new Array(value.length) : {}) as Record<
    PropertyKey,
    unknown
  >
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!
    if (!('value' in descriptor)) throw new Error('Config snapshot accessor')
    Object.defineProperty(copy, key, {
      value: snapshotConfig(descriptor.value, ancestors),
      enumerable: descriptor.enumerable,
    })
  }
  ancestors.delete(value)
  return Object.freeze(copy) as T
}

const createFeed = <T>(
  publication: Publication,
  select: (snapshot: ConfigProviderContext) => T,
  canCapture = (_snapshot: ConfigProviderContext) => true
): GlobalConfigFeed<T> => {
  const subscriptions = new Set<object>()
  const tickets = new WeakSet<object>()
  return Object.freeze({
    issueTicket: () => {
      const { snapshot, epoch, identity } = publication
      if (
        !publicationCurrent(publication) ||
        !subscriptions.size ||
        !snapshot ||
        !canCapture(snapshot)
      ) {
        return null
      }
      const custody = [...subscriptions]
      const ticket: GlobalConfigTicket<T> = Object.freeze({
        contextIdentity: identity,
        value: select(snapshot),
        // Pure: no Vue reads, watcher flush, mutation, refresh or reacquisition.
        current: () =>
          publicationCurrent(publication) &&
          publication.epoch === epoch &&
          custody.every((subscription) => subscriptions.has(subscription)),
      })
      tickets.add(ticket)
      return ticket
    },
    isCurrent: (ticket: unknown) =>
      !!ticket &&
      typeof ticket === 'object' &&
      tickets.has(ticket) &&
      (ticket as GlobalConfigTicket<T>).current(),
    getFailures: () => publicationFailures(publication),
    subscribe: (listener: () => void) => {
      if (!publication.active) throw new Error('Config publication released')
      if (typeof listener !== 'function') {
        throw new TypeError('Invalid config listener')
      }
      const identity = Object.freeze({})
      const subscription = () => {
        if (subscriptions.has(identity)) return listener()
      }
      subscriptionOwners.set(subscription, { listener, subscriptionId: identity })
      subscriptions.add(identity)
      publication.revoke.add(subscription)
      const release = () => {
        subscriptions.delete(identity)
        publication.revoke.delete(subscription)
      }
      if (getCurrentScope()) onScopeDispose(release)
      return release
    },
  })
}

export const getGlobalConfigFeed = <T>(
  config: Readonly<Ref<T>>
): GlobalConfigFeed<T> | undefined =>
  feeds.get(config) as GlobalConfigFeed<T> | undefined

export const createGlobalConfigSnapshot = (
  initial: ConfigProviderContext
): GlobalConfigSnapshotProducer => {
  const publication = createPublication(true)
  publication.snapshot = snapshotConfig(initial)
  publication.valid = true
  const config = shallowRef(publication.snapshot)
  const producer = Object.freeze({
    config: computed(() => config.value),
    update: (next: ConfigProviderContext) => {
      if (!publication.active || publication.writing) {
        throw new Error('Config producer released or writing')
      }
      const snapshot = snapshotConfig(next)
      publication.writing = true
      let publishing = false
      try {
        revokePublication(publication)
        if (!publication.active) throw new Error('Config producer released')
        publication.snapshot = snapshot
        config.value = snapshot
        publishing = true
        publication.valid = !publication.failures.length
        notify(publication, publication.publish)
      } catch (error) {
        if (publishing) revokePublication(publication)
        throw error
      } finally {
        publication.writing = false
      }
    },
    release: () => releasePublication(publication),
  })
  producers.set(producer, publication)
  return producer
}

export const releaseGlobalConfig = (
  context: Ref<ConfigProviderContext | undefined>
) => {
  const publication = publications.get(context)
  if (!publication || publication === globalPublication) return false
  releasePublication(publication)
  return true
}

// Fallback for global methods without an app context.
const globalConfigValue = ref<ConfigProviderContext>()
const globalPublication = createPublication(false)
const detachGlobalConfig = () => {
  notify(globalPublication, globalPublication.cleanup)
  globalPublication.cleanup.clear()
  globalPublication.sources.clear()
}
const globalConfig = computed({
  get: () => globalConfigValue.value,
  set: (value) => {
    if (globalPublication.writing) throw new Error('Global config is writing')
    globalPublication.writing = true
    try {
      revokePublication(globalPublication)
      detachGlobalConfig()
      globalPublication.identity = Object.freeze({})
      globalPublication.snapshot = undefined
      globalPublication.owned = false
      globalConfigValue.value = value
    } finally {
      globalPublication.writing = false
    }
  },
})
publications.set(globalConfig, globalPublication)
feeds.set(globalConfig, createFeed(globalPublication, (snapshot) => snapshot))

export function useGlobalConfig<
  K extends keyof ConfigProviderContext,
  D extends ConfigProviderContext[K]
>(
  key: K,
  defaultValue?: D
): Ref<Exclude<ConfigProviderContext[K], undefined> | D>
export function useGlobalConfig(): Ref<ConfigProviderContext | undefined>
export function useGlobalConfig(
  key?: keyof ConfigProviderContext,
  defaultValue = undefined
) {
  const config = getCurrentInstance()
    ? inject(configProviderContextKey, undefined) ?? globalConfig
    : globalConfig
  if (key) {
    const selected = computed(() => config.value?.[key] ?? defaultValue)
    const publication = publications.get(config)
    if (publication) {
      feeds.set(
        selected,
        createFeed(
          publication,
          (snapshot) => snapshot[key] ?? defaultValue,
          (snapshot) => snapshot[key] != null || defaultValue === undefined
        )
      )
    }
    return selected
  } else {
    return config
  }
}

// for components like `ElMessage` `ElNotification` `ElMessageBox`.
export function useGlobalComponentSettings(
  block: string,
  sizeFallback?: MaybeRef<ConfigProviderContext['size']>
) {
  const config = useGlobalConfig()

  const ns = useNamespace(
    block,
    computed(() => config.value?.namespace || defaultNamespace)
  )

  const locale = useLocale(computed(() => config.value?.locale))
  const zIndex = useZIndex(
    computed(() => config.value?.zIndex || defaultInitialZIndex)
  )
  const size = computed(() => unref(sizeFallback) || config.value?.size || '')
  provideGlobalConfig(computed(() => unref(config) || {}))

  return {
    ns,
    locale,
    zIndex,
    size,
  }
}

export const provideGlobalConfig = (
  config: MaybeRef<ConfigProviderContext> | GlobalConfigSnapshotProducer,
  app?: App,
  global = false
) => {
  const instance = getCurrentInstance()
  const inSetup = !!instance
  const oldConfig = inSetup ? useGlobalConfig() : undefined

  const provideFn = app?.provide ?? (inSetup ? provide : undefined)
  if (!provideFn) {
    debugWarn(
      'provideGlobalConfig',
      'provideGlobalConfig() can only be used inside setup().'
    )
    return
  }
  if (!app && globalPublication.writing) {
    throw new Error('Global config publication is writing')
  }

  const producer = producers.get(config)
  if (producer && !producer.active) throw new Error('Config producer released')
  // An opt-in root owns its complete snapshot. A real injected parent is
  // inherited; the process fallback is a selection, not a root dependency.
  const parent = producer && Object.is(oldConfig, globalConfig)
    ? undefined : oldConfig
  const parentPublication = parent && publications.get(parent)
  const publication = createPublication(
    !!producer && (!parent || !!parentPublication?.owned)
  )
  try {
    const ownedContext = shallowRef<ConfigProviderContext>({})
    const context = computed(() => {
      if (producer && publication.owned) return ownedContext.value
      const cfg = producer
        ? unref((config as GlobalConfigSnapshotProducer).config)
        : unref(config as MaybeRef<ConfigProviderContext>)
      if (!parent?.value) return cfg
      return mergeConfig(parent.value, cfg)
    })
    const refresh = () => {
      if (!publication.active || !producer?.active) return
      if (!publication.owned) return
      if (
        !producer.valid ||
        producer.failures.length ||
        publication.failures.length ||
        (parentPublication && !parentPublication.valid)
      ) return
      const cfg = producer.snapshot!
      publication.snapshot = parentPublication?.snapshot
        ? snapshotConfig(mergeConfig(parentPublication.snapshot, cfg))
        : cfg
      ownedContext.value = publication.snapshot
      publication.valid = true
      notify(publication, publication.publish)
    }
    const connect = (source: Publication) => {
      publication.sources.add(source)
      const revoke = () => revokePublication(publication)
      const release = () => releasePublication(publication)
      source.revoke.add(revoke)
      source.publish.add(refresh)
      source.cleanup.add(release)
      publication.cleanup.add(() => {
        source.revoke.delete(revoke)
        source.publish.delete(refresh)
        source.cleanup.delete(release)
        publication.sources.delete(source)
      })
    }
    if (producer) connect(producer)
    if (parentPublication && publication.owned) connect(parentPublication)
    refresh()
    publications.set(context, publication)
    feeds.set(context, createFeed(publication, (snapshot) => snapshot))
    const owner = app ?? instance
    if (owner) {
      const previous = providerOwners.get(owner)
      providerOwners.set(owner, publication)
      if (previous) releasePublication(previous)
      if (providerOwners.get(owner) !== publication) {
        throw new Error('Config provider replaced during publication')
      }
    }
    if (inSetup) onScopeDispose(() => releasePublication(publication))

    provideFn(configProviderContextKey, context)
    provideFn(
      localeContextKey,
      computed(() => context.value.locale)
    )
    provideFn(
      namespaceContextKey,
      computed(() => context.value.namespace)
    )
    provideFn(
      zIndexContextKey,
      computed(() => context.value.zIndex)
    )

    provideFn(SIZE_INJECTION_KEY, {
      size: computed(() => context.value.size || ''),
    })

    if (!app && (global || !globalConfig.value)) {
      globalPublication.writing = true
      try {
        revokePublication(globalPublication)
        if (!publication.active) throw new Error('Config publication released')
        detachGlobalConfig()
        globalPublication.sources.add(publication)
        const revoke = () => revokePublication(globalPublication)
        const publish = () => {
          if (!publication.active) return
          const wasWriting = globalPublication.writing
          globalPublication.writing = true
          try {
            globalPublication.identity = publication.identity
            globalPublication.snapshot = publication.snapshot
            globalPublication.owned = publication.owned
            globalConfigValue.value = context.value
            globalPublication.valid = publication.valid
            notify(globalPublication, globalPublication.publish)
          } finally {
            globalPublication.writing = wasWriting
          }
        }
        const release = () => {
          publication.revoke.delete(revoke)
          publication.publish.delete(publish)
          publication.cleanup.delete(release)
          globalPublication.sources.delete(publication)
          globalPublication.cleanup.delete(release)
        }
        publication.revoke.add(revoke)
        publication.publish.add(publish)
        publication.cleanup.add(release)
        globalPublication.cleanup.add(release)
        publish()
      } finally {
        globalPublication.writing = false
      }
    }
    return context
  } catch (error) {
    releasePublication(publication)
    throw error
  }
}

const mergeConfig = (
  a: ConfigProviderContext,
  b: ConfigProviderContext
): ConfigProviderContext => {
  const keys = [...new Set([...keysOf(a), ...keysOf(b)])]
  const obj: Record<string, any> = {}
  for (const key of keys) {
    obj[key] = b[key] ?? a[key]
  }
  return obj
}
