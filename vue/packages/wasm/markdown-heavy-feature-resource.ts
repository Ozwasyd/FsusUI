import type { FeatureRenderOutput } from './markdown-feature-output-gateway'

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
  readonly listeners: number
  readonly observers: number
  readonly runtimes: number
  readonly subscribe?: (listener: () => void) => () => void
  readonly tasks: number
}

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
  readonly run: <T>(
    lifecycleSignal: AbortSignal,
    render: (adapterSignal: AbortSignal) => Promise<T>,
    isolatedRequest?: MarkdownHeavyFeatureIsolatedRenderRequest,
  ) => Promise<T>
  readonly snapshot: () => Readonly<{
    aborted: boolean
    listenerAttached: boolean
    taskActive: boolean
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
  let removeLifecycleAbort: (() => void) | null = null
  let listenerAttached = false
  let taskActive = false
  let isolatedHandle: MarkdownHeavyFeatureIsolatedRenderHandle<unknown> | null =
    null
  const resourceChangeListeners = new Set<() => void>()
  const notifyResourceChange = () => {
    for (const listener of resourceChangeListeners) listener()
  }

  const removeListener = () => {
    removeLifecycleAbort?.()
    removeLifecycleAbort = null
    listenerAttached = false
  }

  const teardown = () => {
    removeListener()
    adapterController.abort()
    isolatedHandle?.teardown()
    isolatedHandle = null
  }

  const run = async <T>(
    lifecycleSignal: AbortSignal,
    render: (adapterSignal: AbortSignal) => Promise<T>,
    isolatedRequest?: MarkdownHeavyFeatureIsolatedRenderRequest,
  ): Promise<T> => {
    if (taskActive || adapterController.signal.aborted) throw abortError()
    taskActive = true
    const forwardAbort = () => adapterController.abort()
    lifecycleSignal.addEventListener('abort', forwardAbort, { once: true })
    removeLifecycleAbort = () =>
      lifecycleSignal.removeEventListener('abort', forwardAbort)
    listenerAttached = true
    notifyResourceChange()
    if (lifecycleSignal.aborted) forwardAbort()
    if (adapterController.signal.aborted) {
      removeListener()
      taskActive = false
      throw abortError()
    }

    try {
      if (isolatedRequest && renderFactory) {
        const handle = renderFactory<T>(isolatedRequest)
        isolatedHandle =
          handle as MarkdownHeavyFeatureIsolatedRenderHandle<unknown>
        notifyResourceChange()
        if (adapterController.signal.aborted) handle.teardown()
        return await handle.promise
      }
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
      isolatedHandle?.teardown()
      isolatedHandle = null
      notifyResourceChange()
    }
  }

  const resources: MarkdownHeavyFeatureAdapterResources = Object.freeze({
    get listeners() {
      return taskActive ? 1 + (isolatedHandle?.resources().listeners ?? 1) : 0
    },
    get observers() {
      return isolatedHandle?.resources().observers ?? 0
    },
    get runtimes() {
      return isolatedHandle?.resources().runtimes ?? 0
    },
    subscribe(listener: () => void) {
      resourceChangeListeners.add(listener)
      return () => resourceChangeListeners.delete(listener)
    },
    get tasks() {
      return taskActive ? 1 : 0
    },
  })

  return Object.freeze({
    resources,
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
    !Number.isFinite(bridge.resources.listeners) ||
    !Number.isFinite(bridge.resources.tasks) ||
    !Number.isFinite(bridge.resources.observers) ||
    !Number.isFinite(bridge.resources.runtimes)
  ) {
    throw new Error('markdown_heavy_feature_adapter_resource_invalid')
  }
  return bridge as MarkdownHeavyFeatureAdapterResourceBridge
}
