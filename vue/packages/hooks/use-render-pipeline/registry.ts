import { getCurrentInstance, inject, provide } from 'vue'
import {
  createFsusRenderPipelineComponentPolicy,
  getFsusRenderPipelineComponentPolicy,
} from '@element-plus/utils'
import {
  positive,
  readRenderPipelineNow,
  shouldUseFsusRenderPipeline,
} from './config'
import {
  clearFsusRenderPipelineDiagnostics,
  createFsusRenderPipelineDiagnosticsHub,
  emitDefaultFsusRenderPipelineDiagnostic,
  getFsusRenderPipelineDiagnosticsSnapshot,
  registerFsusRenderPipelineDiagnosticSink,
} from './diagnostics'
import { canCreateWorker } from './hardware-profile'
import type {
  FsusRenderEstimate,
  FsusRenderPipelineAdapter,
  FsusRenderPipelineContext,
  FsusRenderPipelineContextInjectionKey,
  FsusRenderPipelineStrategy,
  FsusRenderPipelineStrategyCacheEntry,
  FsusRenderPipelineStrategyContext,
  FsusRenderPipelineStrategyResolver,
  FsusRenderPipelineStrategyResolverOptions,
  FsusResolvedRenderPipelineComponentPolicy,
  FsusResolvedRenderPipelineConfig,
} from './types'

const STRATEGY_CACHE_LIMIT = 128
const STRATEGY_CACHE_TTL_MS = 60_000

const normalizeAdapterId = (adapterId: string) => adapterId.trim()

export const createFsusRenderPipelineStrategyCache = ({
  limit = STRATEGY_CACHE_LIMIT,
  now: readNow = readRenderPipelineNow,
  ttlMs = STRATEGY_CACHE_TTL_MS,
}: {
  limit?: number
  now?: () => number
  ttlMs?: number
} = {}) => {
  const entries = new Map<string, FsusRenderPipelineStrategyCacheEntry>()
  const get = (cacheKey: string, profileVersion?: string) => {
    if (!cacheKey) return undefined
    const entry = entries.get(cacheKey)
    if (
      !entry ||
      entry.expiresAt <= readNow() ||
      (profileVersion !== undefined && entry.profileVersion !== profileVersion)
    ) {
      entries.delete(cacheKey)
      return undefined
    }
    return entry
  }
  const set = (
    cacheKey: string,
    entry: Pick<
      FsusRenderPipelineStrategyCacheEntry,
      'durationMs' | 'strategy'
    > & { profileVersion?: string; ttlMs?: number },
  ) => {
    if (!cacheKey) return
    const previous = entries.get(cacheKey)
    const durationEwmaMs =
      entry.durationMs === undefined
        ? previous?.durationEwmaMs
        : previous?.durationEwmaMs === undefined
          ? entry.durationMs
          : previous.durationEwmaMs * 0.75 + entry.durationMs * 0.25
    const updatedAt = readNow()
    entries.delete(cacheKey)
    entries.set(cacheKey, {
      ...entry,
      durationEwmaMs,
      expiresAt: updatedAt + positive(entry.ttlMs, ttlMs),
      sampleCount: (previous?.sampleCount ?? 0) + 1,
      updatedAt,
    })
    if (entries.size > limit) {
      const firstKey = entries.keys().next().value
      if (firstKey) entries.delete(firstKey)
    }
  }
  const invalidateProfile = (profileVersion: string) => {
    for (const [key, entry] of entries) {
      if (entry.profileVersion !== profileVersion) entries.delete(key)
    }
  }
  return { clear: () => entries.clear(), get, invalidateProfile, set }
}

const chooseDefaultFsusRenderPipelineStrategy = ({
  canUseWorker = false,
  config,
  estimate,
}: FsusRenderPipelineStrategyContext): FsusRenderPipelineStrategy => {
  if (!shouldUseFsusRenderPipeline(estimate, config)) {
    return config.mode === 'disabled' ? 'disabled' : 'sync'
  }

  if (config.worker !== 'disabled' && canUseWorker && canCreateWorker()) {
    return 'chunked-worker'
  }

  return 'chunked-main'
}

const readAdapterFingerprint = <TSource, TUnit>(
  adapter: FsusRenderPipelineAdapter<TSource, TUnit>,
  source: TSource,
) => {
  try {
    return adapter.fingerprint(source)
  } catch {
    return ''
  }
}

type FsusRenderPipelineStrategyResolverEntry = {
  order: number
  priority: number
  resolver: FsusRenderPipelineStrategyResolver
}

const stringifyPipelineConfigSignature = (
  config: FsusResolvedRenderPipelineConfig,
  canUseWorker: boolean,
  resolverVersion: number,
) =>
  [
    config.adaptive,
    config.mode,
    config.worker,
    config.thresholds.htmlBytes,
    config.thresholds.estimatedNodes,
    config.thresholds.itemCount,
    config.budget.dynamicFrameMs ? 'dynamic-frame' : 'fixed-frame',
    config.budget.frameMs,
    config.budget.overscanPx,
    config.budget.measureBatch,
    config.acceleration.mode,
    config.acceleration.compositor,
    config.acceleration.contentVisibility,
    config.acceleration.layerBudget,
    canUseWorker ? 'worker' : 'main',
    resolverVersion,
  ].join('|')

const buildStrategyCacheKey = <TSource, TUnit>(
  {
    adapter,
    canUseWorker,
    config,
    source,
  }: {
    adapter: FsusRenderPipelineAdapter<TSource, TUnit> | null
    canUseWorker: boolean
    config: FsusResolvedRenderPipelineConfig
    source: TSource
  },
  resolverVersion: number,
) => {
  if (!adapter) return ''
  const fingerprint = readAdapterFingerprint(adapter, source)
  if (!fingerprint) return ''
  return [
    adapter.id,
    fingerprint,
    stringifyPipelineConfigSignature(config, canUseWorker, resolverVersion),
  ].join('\u0000')
}

const createRenderPipelineRegistry = (
  strategyCache: ReturnType<typeof createFsusRenderPipelineStrategyCache>,
  parent?: FsusRenderPipelineContext | null,
) => {
  const adapters = new Map<
    string,
    FsusRenderPipelineAdapter<unknown, unknown>
  >()
  const strategyResolvers = new Set<FsusRenderPipelineStrategyResolverEntry>()
  let strategyResolverOrder = 0
  let strategyResolverVersion = 0

  const registerAdapter = <TSource, TUnit>(
    adapter: FsusRenderPipelineAdapter<TSource, TUnit>,
  ) => {
    const adapterId = normalizeAdapterId(adapter.id)
    if (!adapterId) {
      throw new Error('fsus_render_pipeline_adapter_id_required')
    }
    const normalizedAdapter = {
      ...adapter,
      id: adapterId,
    } as FsusRenderPipelineAdapter<unknown, unknown>
    const previous = adapters.get(adapterId)
    adapters.set(adapterId, normalizedAdapter)
    return () => {
      if (previous) {
        adapters.set(adapterId, previous)
      } else {
        adapters.delete(adapterId)
      }
    }
  }

  const getAdapter = <TSource = unknown, TUnit = unknown>(adapterId: string) =>
    (adapters.get(normalizeAdapterId(adapterId)) as
      | FsusRenderPipelineAdapter<TSource, TUnit>
      | undefined) ?? parent?.getAdapter<TSource, TUnit>(adapterId)

  const listAdapters = () => Array.from(adapters.values())

  const clearAdapters = () => {
    adapters.clear()
  }

  const invalidateResolvers = () => {
    strategyResolverVersion += 1
    strategyCache.clear()
  }

  const registerStrategyResolver = (
    resolver: FsusRenderPipelineStrategyResolver,
    resolverOptions: FsusRenderPipelineStrategyResolverOptions = {},
  ) => {
    const entry: FsusRenderPipelineStrategyResolverEntry = {
      order: strategyResolverOrder++,
      priority:
        typeof resolverOptions.priority === 'number' &&
        Number.isFinite(resolverOptions.priority)
          ? resolverOptions.priority
          : 0,
      resolver,
    }
    strategyResolvers.add(entry)
    invalidateResolvers()
    return () => {
      strategyResolvers.delete(entry)
      invalidateResolvers()
    }
  }

  const clearStrategyResolvers = () => {
    strategyResolvers.clear()
    invalidateResolvers()
  }

  const chooseStrategy = (
    estimate: FsusRenderEstimate,
    config: FsusResolvedRenderPipelineConfig,
    canUseWorker = false,
  ): FsusRenderPipelineStrategy => {
    const context = { canUseWorker, config, estimate }
    if (strategyResolvers.size > 0) {
      const resolvers = Array.from(strategyResolvers).sort(
        (left, right) =>
          right.priority - left.priority || left.order - right.order,
      )
      for (const { resolver } of resolvers) {
        const resolved = resolver(context)
        if (resolved) return resolved
      }
    }
    if (parent) {
      return parent.chooseStrategy(estimate, config, canUseWorker)
    }
    return chooseDefaultFsusRenderPipelineStrategy(context)
  }

  const createStrategyCacheKey = <TSource, TUnit>(input: {
    adapter: FsusRenderPipelineAdapter<TSource, TUnit> | null
    canUseWorker: boolean
    config: FsusResolvedRenderPipelineConfig
    source: TSource
  }) => buildStrategyCacheKey(input, strategyResolverVersion)

  return {
    chooseStrategy,
    clearAdapters,
    clearStrategyResolvers,
    createStrategyCacheKey,
    getAdapter,
    listAdapters,
    registerAdapter,
    registerStrategyResolver,
  }
}

export const defaultStrategyCache =
  /*#__PURE__*/ createFsusRenderPipelineStrategyCache()

const defaultRegistry =
  /*#__PURE__*/ createRenderPipelineRegistry(defaultStrategyCache)

export const registerFsusRenderPipelineAdapter: FsusRenderPipelineContext['registerAdapter'] =
  (adapter) => defaultRegistry.registerAdapter(adapter)

export const getFsusRenderPipelineAdapter = <
  TSource = unknown,
  TUnit = unknown,
>(
  adapterId: string,
) => defaultRegistry.getAdapter<TSource, TUnit>(adapterId)

export const listFsusRenderPipelineAdapters = () =>
  defaultRegistry.listAdapters()

export const clearFsusRenderPipelineAdapters = () =>
  defaultRegistry.clearAdapters()

export const registerFsusRenderPipelineStrategyResolver: FsusRenderPipelineContext['registerStrategyResolver'] =
  (resolver, resolverOptions = {}) =>
    defaultRegistry.registerStrategyResolver(resolver, resolverOptions)

export const clearFsusRenderPipelineStrategyResolvers = () =>
  defaultRegistry.clearStrategyResolvers()

export const chooseFsusRenderPipelineStrategy: FsusRenderPipelineContext['chooseStrategy'] =
  (estimate, config, canUseWorker = false) =>
    defaultRegistry.chooseStrategy(estimate, config, canUseWorker)

export const createDefaultRenderPipelineStrategyCacheKey: FsusRenderPipelineContext['createStrategyCacheKey'] =
  (input) => defaultRegistry.createStrategyCacheKey(input)

export const clearFsusRenderPipelineStrategyCache = () => {
  defaultStrategyCache.clear()
}

export const inspectFsusRenderPipelineStrategyCache = (cacheKey: string) =>
  defaultStrategyCache.get(cacheKey)

export const createFsusRenderPipelineContext = (options?: {
  diagnostics?: {
    clear: () => void
    emit: FsusRenderPipelineContext['emitDiagnostic']
    registerSink: FsusRenderPipelineContext['registerDiagnosticSink']
    snapshot: FsusRenderPipelineContext['getDiagnosticsSnapshot']
  }
  parent?: FsusRenderPipelineContext | null
}): FsusRenderPipelineContext => {
  const strategyCache = createFsusRenderPipelineStrategyCache()
  const diagnostics =
    options?.diagnostics ?? createFsusRenderPipelineDiagnosticsHub()
  const parent = options?.parent ?? null
  const {
    chooseStrategy,
    clearAdapters,
    clearStrategyResolvers,
    createStrategyCacheKey,
    getAdapter,
    listAdapters,
    registerAdapter,
    registerStrategyResolver,
  } = createRenderPipelineRegistry(strategyCache, parent)

  return {
    chooseStrategy,
    clearAdapters,
    clearDiagnostics: diagnostics.clear,
    clearStrategyCache: strategyCache.clear,
    clearStrategyResolvers,
    createStrategyCacheKey,
    emitDiagnostic: (event) => {
      diagnostics.emit(event)
      parent?.emitDiagnostic(event)
    },
    getAdapter,
    getCachedStrategy: strategyCache.get,
    getDiagnosticsSnapshot: diagnostics.snapshot,
    inspectStrategyCache: (cacheKey) => strategyCache.get(cacheKey),
    invalidateStrategyProfile: strategyCache.invalidateProfile,
    listAdapters,
    registerAdapter,
    registerDiagnosticSink: diagnostics.registerSink,
    registerStrategyResolver,
    setCachedStrategy: strategyCache.set,
  }
}

let defaultRenderPipelineContextInstance: FsusRenderPipelineContext | null =
  null

const getDefaultRenderPipelineContext = (): FsusRenderPipelineContext =>
  (defaultRenderPipelineContextInstance ??= {
    chooseStrategy: chooseFsusRenderPipelineStrategy,
    clearAdapters: clearFsusRenderPipelineAdapters,
    clearDiagnostics: clearFsusRenderPipelineDiagnostics,
    clearStrategyCache: clearFsusRenderPipelineStrategyCache,
    clearStrategyResolvers: clearFsusRenderPipelineStrategyResolvers,
    createStrategyCacheKey: createDefaultRenderPipelineStrategyCacheKey,
    emitDiagnostic: emitDefaultFsusRenderPipelineDiagnostic,
    getAdapter: getFsusRenderPipelineAdapter,
    getCachedStrategy: defaultStrategyCache.get,
    getDiagnosticsSnapshot: getFsusRenderPipelineDiagnosticsSnapshot,
    inspectStrategyCache: inspectFsusRenderPipelineStrategyCache,
    invalidateStrategyProfile: defaultStrategyCache.invalidateProfile,
    listAdapters: listFsusRenderPipelineAdapters,
    registerAdapter: registerFsusRenderPipelineAdapter,
    registerDiagnosticSink: registerFsusRenderPipelineDiagnosticSink,
    registerStrategyResolver: registerFsusRenderPipelineStrategyResolver,
    setCachedStrategy: defaultStrategyCache.set,
  })

export const FSUS_RENDER_PIPELINE_CONTEXT_KEY: FsusRenderPipelineContextInjectionKey =
  /*#__PURE__*/ Symbol('fsusRenderPipelineContext')

export const injectFsusRenderPipelineContext =
  (): FsusRenderPipelineContext | null =>
    getCurrentInstance() ? inject(FSUS_RENDER_PIPELINE_CONTEXT_KEY, null) : null

export const provideFsusRenderPipelineContext = (
  context: FsusRenderPipelineContext = createFsusRenderPipelineContext({
    parent: getDefaultRenderPipelineContext(),
  }),
) => {
  provide(FSUS_RENDER_PIPELINE_CONTEXT_KEY, context)
  return context
}

export const useFsusRenderPipelineContext = (): FsusRenderPipelineContext =>
  injectFsusRenderPipelineContext() ?? getDefaultRenderPipelineContext()

export const resolveFsusRenderPipelineComponentPolicy = (
  componentName: string,
  config: FsusResolvedRenderPipelineConfig,
  options: {
    canUseWorker?: boolean
    chooseStrategy?: FsusRenderPipelineContext['chooseStrategy']
    estimate?: FsusRenderEstimate
  } = {},
): FsusResolvedRenderPipelineComponentPolicy => {
  const normalizedName = componentName.trim()
  const policy =
    getFsusRenderPipelineComponentPolicy(normalizedName) ??
    createFsusRenderPipelineComponentPolicy(normalizedName)

  const estimate = {
    ...policy.estimate,
    ...options.estimate,
  }

  const pickStrategy =
    options.chooseStrategy ?? chooseFsusRenderPipelineStrategy
  const strategy =
    config.mode === 'disabled'
      ? 'disabled'
      : policy.budgeted
        ? pickStrategy(estimate, config, options.canUseWorker)
        : 'sync'

  return {
    ...policy,
    estimate,
    strategy,
  }
}
