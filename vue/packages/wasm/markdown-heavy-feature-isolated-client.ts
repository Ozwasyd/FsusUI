import MarkdownHeavyFeatureFrameUrl from './markdown-heavy-feature-frame.ts?worker&url'
import {
  MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
  createMarkdownHeavyFeatureAdapterResourceOwner,
  registerMarkdownHeavyFeatureIsolatedRenderFactory,
  type MarkdownHeavyFeatureAdapterResources,
  type MarkdownHeavyFeatureFrameProviderObservation,
  type MarkdownHeavyFeatureIsolatedRenderRequest,
  validateMarkdownHeavyFeatureIsolatedRenderOutput,
  validateMarkdownHeavyFeatureIsolatedRenderRequest,
  validateMarkdownHeavyFeatureFrameResourceSnapshot,
} from './markdown-heavy-feature-resource'
import type { FeatureRenderOutput } from './markdown-feature-output-gateway'
import { toMarkdownFeatureParsingHtml } from './markdown-feature-output-gateway'
import {
  scheduleMarkdownHeavyFeatureFrameContinue,
  type MarkdownHeavyFeatureFrameContinueScheduler,
  type MarkdownHeavyFeatureTrustedScriptUrlFactory,
} from './markdown-heavy-feature-frame-scheduler'

export {
  scheduleMarkdownHeavyFeatureFrameContinue,
  type MarkdownHeavyFeatureFrameContinueScheduler,
  type MarkdownHeavyFeatureTrustedScriptUrlFactory,
}

const abortError = () => new DOMException('Aborted', 'AbortError')
const isolatedFrameDocument =
  '<!doctype html><html><head><meta charset="UTF-8"></head><body></body></html>'

const initializeFrameDocument = (frameDocument: Document) => {
  frameDocument.open()
  ;(
    frameDocument as unknown as {
      write: (html: string | object) => void
    }
  ).write(toMarkdownFeatureParsingHtml(document, isolatedFrameDocument))
  frameDocument.close()
}

const createCapability = () => {
  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.getRandomValues) {
    throw new Error('markdown_heavy_feature_frame_capability_unavailable')
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

const canUseIsolatedFrame = () =>
  typeof document !== 'undefined' &&
  typeof window !== 'undefined' &&
  typeof MessageChannel === 'function' &&
  !window.navigator.userAgent.toLowerCase().includes('jsdom')

export const createMarkdownHeavyFeatureIsolatedRender = <
  T extends FeatureRenderOutput,
>(
  request: MarkdownHeavyFeatureIsolatedRenderRequest,
  trustedScriptUrlFactory?: MarkdownHeavyFeatureTrustedScriptUrlFactory,
  scheduleContinue?: MarkdownHeavyFeatureFrameContinueScheduler,
) => {
  const validatedRequest =
    validateMarkdownHeavyFeatureIsolatedRenderRequest(request)
  if (!validatedRequest) {
    throw new Error('markdown_heavy_feature_frame_request_invalid')
  }
  const expectedOrigin = window.location.origin
  if (!expectedOrigin || expectedOrigin === 'null') {
    throw new Error('markdown_heavy_feature_frame_origin_invalid')
  }
  const capability = createCapability()
  const frameOwner = createMarkdownHeavyFeatureAdapterResourceOwner()
  let active = true
  let cleanupRunning = false
  let readyAttached = false
  let bootstrapPending = false
  let bootstrapIssued = false
  let requestPending = false
  let requestDispatchEntered = false
  let requestTerminalObserved = false
  let frameProvider: MarkdownHeavyFeatureFrameProviderObservation | undefined
  let started = false
  let scheduledContinue: { cancel: (() => void) | null } | null = null
  let port: MessagePort | null = null
  let transferPort: MessagePort | null = null
  let script: HTMLScriptElement | null = null
  let resolveModule!: () => void
  let rejectModule!: (cause: unknown) => void
  const moduleSettlement = new Promise<void>((resolve, reject) => {
    resolveModule = resolve
    rejectModule = reject
  })
  void moduleSettlement.catch(() => undefined)
  let resolveRequest!: () => void
  let rejectRequest!: (cause: unknown) => void
  const requestSettlement = new Promise<void>((resolve, reject) => {
    resolveRequest = resolve
    rejectRequest = reject
  })
  void requestSettlement.catch(() => undefined)
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
          frameOwner.retainFailure('frame-resource-observer', listener, cause)
        }
      }
    } finally {
      notifying = false
    }
  }
  frameOwner.resources.subscribe?.(notifyResourceChange)
  const iframe = document.createElement('iframe')

  let resolvePromise!: (value: T) => void
  let rejectPromise!: (reason: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  const removeReadyListener = () => {
    if (!readyAttached) return
    window.removeEventListener('message', ready)
    readyAttached = false
  }
  const nativeCleanup = (
    operation: string,
    resource: object,
    run: () => void,
  ) => {
    try {
      run()
      return true
    } catch (cause) {
      frameOwner.retainFailure(operation, resource, cause)
      return false
    }
  }
  const removeScriptHandlers = () => {
    if (!script) return
    script.onerror = null
    script.onload = null
  }
  const cleanup = () => {
    if (cleanupRunning) return
    cleanupRunning = true
    try {
      if (port && requestDispatchEntered && !requestTerminalObserved)
        nativeCleanup('frame-cancel-dispatch', port, () =>
          port?.postMessage({
            capability,
            scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
            type: 'cancel',
          }),
        )
      if (frameProvider)
        frameProvider = Object.freeze({
          observation: 'unavailable',
          snapshot: frameProvider.snapshot,
        })
      const continuation = scheduledContinue
      scheduledContinue = null
      continuation?.cancel?.()
      frameOwner.requestCancellation()
      nativeCleanup('ready-listener-remove', iframe, removeReadyListener)
      if (
        nativeCleanup(
          'script-handlers-remove',
          script ?? iframe,
          removeScriptHandlers,
        )
      )
        script = null
      if (port) {
        const ownedPort = port
        const message = nativeCleanup('port-message-remove', ownedPort, () => {
          ownedPort.onmessage = null
        })
        const error = nativeCleanup('port-error-remove', ownedPort, () => {
          ownedPort.onmessageerror = null
        })
        const closed = nativeCleanup('port-close', ownedPort, () =>
          ownedPort.close(),
        )
        if (message && error && closed) port = null
      }
      if (
        transferPort &&
        nativeCleanup('transfer-port-close', transferPort, () =>
          transferPort?.close(),
        )
      )
        transferPort = null
      nativeCleanup('frame-remove', iframe, () => iframe.remove())
      bootstrapPending = false
      requestPending = false
      notifyResourceChange()
    } finally {
      cleanupRunning = false
    }
  }
  const teardown = () => {
    if (!active) {
      if (
        readyAttached ||
        script ||
        port ||
        transferPort ||
        iframe.isConnected ||
        scheduledContinue
      )
        cleanup()
      return
    }
    active = false
    cleanup()
    rejectPromise(abortError())
  }
  const ready = (event: MessageEvent) => {
    if (
      !active ||
      event.source !== iframe.contentWindow ||
      event.origin !== expectedOrigin ||
      event.data?.scope !== MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE ||
      event.data?.type !== 'ready' ||
      event.data?.capability !== capability
    ) {
      return
    }
    resolveModule()
    if (
      !nativeCleanup('ready-listener-remove', iframe, removeReadyListener) ||
      !nativeCleanup(
        'script-handlers-remove',
        script ?? iframe,
        removeScriptHandlers,
      ) ||
      !active
    ) {
      teardown()
      return
    }
    bootstrapPending = false
    try {
      const channel = new MessageChannel()
      port = channel.port1
      transferPort = channel.port2
      port.onmessageerror = (event) => {
        frameOwner.retainFailure('port-message-error', port ?? iframe, event)
        teardown()
      }
      port.onmessage = (message) => {
        if (
          message.data?.scope === MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE &&
          message.data?.capability === capability &&
          message.data?.type === 'resources'
        ) {
          const snapshot = validateMarkdownHeavyFeatureFrameResourceSnapshot(
            message.data.snapshot,
          )
          if (Reflect.ownKeys(message.data).length !== 4 || !snapshot) {
            frameOwner.retainFailure(
              'frame-provider-snapshot-invalid',
              port ?? iframe,
              message.data,
            )
            teardown()
            return
          }
          frameProvider = Object.freeze({
            observation: active ? 'observed' : 'unavailable',
            snapshot,
          })
          notifyResourceChange()
          return
        }
        if (!active) {
          // A late, authentic peer terminal message is observation only. It
          // never revives the realm, schedules continuation or commits output.
          if (
            message.data?.scope !== MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE ||
            message.data?.capability !== capability
          )
            return
          if (
            message.data.type === 'resolve' &&
            validateMarkdownHeavyFeatureIsolatedRenderOutput(
              message.data.output,
              validatedRequest.kind,
            )
          ) {
            requestTerminalObserved = true
            resolveRequest()
          }
          if (message.data.type === 'reject') {
            requestTerminalObserved = true
            rejectRequest(
              new Error(
                typeof message.data.message === 'string'
                  ? message.data.message
                  : 'markdown_heavy_feature_frame_failed',
              ),
            )
          }
          return
        }
        if (
          message.data?.scope !== MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE ||
          message.data?.capability !== capability
        ) {
          teardown()
          return
        }
        if (message.data.type === 'started') {
          if (started) {
            teardown()
            return
          }
          started = true
          iframe.dataset.fsusMarkdownHeavyWork = validatedRequest.kind
          const continueRender = () => {
            if (!active) return
            try {
              port?.postMessage({
                capability,
                scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
                type: 'continue',
              })
            } catch (error) {
              frameOwner.retainFailure(
                'frame-continue-dispatch',
                port ?? iframe,
                error,
              )
              active = false
              cleanup()
              rejectPromise(error)
            }
          }
          if (scheduleContinue) {
            const continuation = { cancel: null as (() => void) | null }
            scheduledContinue = continuation
            notifyResourceChange()
            try {
              const cancel = frameOwner.scheduleContinue(
                scheduleContinue,
                `markdown-heavy-frame-continue:${validatedRequest.lifecycleKey ?? 'node'}:${capability}`,
                () => {
                  if (scheduledContinue !== continuation) return
                  scheduledContinue = null
                  notifyResourceChange()
                  continueRender()
                },
                teardown,
              )
              if (scheduledContinue === continuation) {
                continuation.cancel = cancel
                if (!cancel) teardown()
              } else if (!active) cancel?.()
            } catch (error) {
              active = false
              cleanup()
              rejectPromise(error)
            }
          } else {
            continueRender()
          }
          return
        }
        if (message.data.type === 'resolve') {
          const output = validateMarkdownHeavyFeatureIsolatedRenderOutput(
            message.data.output,
            validatedRequest.kind,
          )
          if (!output) {
            active = false
            cleanup()
            rejectPromise(
              new Error('markdown_heavy_feature_frame_output_invalid'),
            )
            return
          }
          active = false
          requestTerminalObserved = true
          resolveRequest()
          cleanup()
          resolvePromise(output as T)
          return
        }
        if (message.data.type === 'reject') {
          const error = new Error(
            typeof message.data.message === 'string'
              ? message.data.message
              : 'markdown_heavy_feature_frame_failed',
          )
          active = false
          requestTerminalObserved = true
          rejectRequest(error)
          cleanup()
          rejectPromise(error)
          return
        }
        teardown()
      }
      requestPending = true
      frameOwner.observeRequest(requestSettlement, () => requestDispatchEntered)
      notifyResourceChange()
      if (!active || !iframe.contentWindow) {
        // No postMessage has entered the native dispatch path yet.
        rejectRequest(abortError())
        throw abortError()
      }
      requestDispatchEntered = true
      frameProvider = Object.freeze({ observation: 'unknown' })
      iframe.contentWindow.postMessage(
        {
          capability,
          request: validatedRequest,
          scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
          type: 'render',
        },
        expectedOrigin,
        [channel.port2],
      )
      transferPort = null
    } catch (error) {
      frameOwner.retainFailure('frame-request-dispatch', iframe, error)
      active = false
      cleanup()
      rejectPromise(error)
    }
  }

  const resources: MarkdownHeavyFeatureAdapterResources = Object.freeze({
    scope: 'owned-handles',
    get listeners() {
      return (
        (readyAttached ? 1 : 0) +
        (port?.onmessage ? 1 : 0) +
        (port?.onmessageerror ? 1 : 0) +
        (script?.onerror ? 1 : 0) +
        (script?.onload ? 1 : 0) +
        frameOwner.resources.listeners
      )
    },
    get networkRequests() {
      // Realm removal does not expose module-loader/third-party network aborts.
      return bootstrapIssued
        ? 'unknown'
        : (frameOwner.resources.networkRequests ?? 'unknown')
    },
    observers: 0,
    get pendingImports() {
      return frameOwner.resources.pendingImports ?? 0
    },
    get runtimes() {
      return iframe.isConnected ? 1 : 0
    },
    get scheduledContinuations() {
      return frameOwner.resources.scheduledContinuations ?? 0
    },
    subscribe(listener: () => void) {
      resourceChangeListeners.add(listener)
      return () => resourceChangeListeners.delete(listener)
    },
    get tasks() {
      return (
        (readyAttached ? 1 : 0) +
        (bootstrapPending ? 1 : 0) +
        (requestPending ? 1 : 0) +
        frameOwner.resources.tasks
      )
    },
    get timers() {
      return bootstrapIssued
        ? 'unknown'
        : (frameOwner.resources.timers ?? 'unknown')
    },
    get ownedTimers() {
      return frameOwner.resources.ownedTimers ?? 0
    },
    get ownedRequests() {
      return frameOwner.resources.ownedRequests ?? 0
    },
    get pendingRequests() {
      return frameOwner.resources.pendingRequests ?? 0
    },
    get pendingInstallations() {
      return frameOwner.resources.pendingInstallations ?? 0
    },
    get failures() {
      return frameOwner.resources.failures ?? []
    },
    get frameProvider() {
      return frameProvider
    },
    cancelTimers: frameOwner.resources.cancelTimers,
    cancelRequests: frameOwner.resources.cancelRequests,
    cancelContinuations: frameOwner.resources.cancelContinuations,
  })
  const handle = Object.freeze({
    promise,
    resources: () => resources,
    teardown,
  })

  let installPhase = 'frame-setup'
  try {
    iframe.setAttribute('aria-hidden', 'true')
    iframe.setAttribute('tabindex', '-1')
    iframe.dataset.fsusMarkdownHeavyPending = validatedRequest.kind
    if (validatedRequest.lifecycleKey)
      iframe.dataset.fsusMarkdownHeavyNode = validatedRequest.lifecycleKey
    iframe.style.position = 'fixed'
    iframe.style.inset = '-10000px auto auto -10000px'
    iframe.style.width = '1024px'
    iframe.style.height = '768px'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.style.pointerEvents = 'none'
    readyAttached = true
    window.addEventListener('message', ready)
    if (!active) return handle
    document.body.append(iframe)
    if (!active) {
      cleanup()
      return handle
    }
    installPhase = 'frame-script-install'
    const frameDocument = iframe.contentDocument
    if (!frameDocument) {
      teardown()
    } else {
      initializeFrameDocument(frameDocument)
      frameDocument.documentElement.dataset.fsusMarkdownFrameCapability =
        capability
      frameDocument.documentElement.dataset.fsusMarkdownParentOrigin =
        expectedOrigin
      script = frameDocument.createElement('script')
      script.type = 'module'
      const moduleUrl = new URL(
        MarkdownHeavyFeatureFrameUrl,
        window.location.href,
      )
      try {
        const trustedModuleUrl = trustedScriptUrlFactory
          ? trustedScriptUrlFactory(moduleUrl)
          : moduleUrl
        if (!active) return handle
        script.src = trustedModuleUrl as string
      } catch (cause) {
        frameOwner.retainFailure('frame-script-url', script ?? iframe, cause)
        active = false
        cleanup()
        rejectPromise(
          new Error('markdown_heavy_feature_frame_script_url_rejected', {
            cause,
          }),
        )
        return handle
      }
      if (validatedRequest.cspNonce) script.nonce = validatedRequest.cspNonce
      script.onerror = (event) => {
        const error = new Error('markdown_heavy_feature_frame_load_failed', {
          cause: event,
        })
        rejectModule(error)
        frameOwner.retainFailure('frame-script-load', script ?? iframe, event)
        if (!active) {
          cleanup()
          return
        }
        active = false
        cleanup()
        rejectPromise(error)
      }
      script.onload = () => {
        resolveModule()
        bootstrapPending = false
        if (
          !nativeCleanup(
            'script-handlers-remove',
            script ?? iframe,
            removeScriptHandlers,
          )
        ) {
          teardown()
          return
        }
        notifyResourceChange()
      }
      bootstrapPending = true
      bootstrapIssued = true
      frameOwner.observeImport(moduleSettlement)
      if (!active) {
        // Cancelled before native append: this particular load never started.
        resolveModule()
        return handle
      }
      frameDocument.head.append(script)
    }
  } catch (error) {
    frameOwner.retainFailure(installPhase, script ?? iframe, error)
    active = false
    cleanup()
    rejectPromise(error)
  }

  return handle
}

export const installMarkdownHeavyFeatureIsolatedRenderer = (
  trustedScriptUrlFactory?: MarkdownHeavyFeatureTrustedScriptUrlFactory,
) => {
  if (!canUseIsolatedFrame()) return false
  registerMarkdownHeavyFeatureIsolatedRenderFactory(
    <T>(request: MarkdownHeavyFeatureIsolatedRenderRequest) => {
      const handle = createMarkdownHeavyFeatureIsolatedRender(
        request,
        trustedScriptUrlFactory,
      )
      return Object.freeze({
        ...handle,
        promise: handle.promise as Promise<T>,
      })
    },
  )
  return true
}
