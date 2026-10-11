import MarkdownHeavyFeatureFrameUrl from './markdown-heavy-feature-frame.ts?worker&url'
import {
  MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
  registerMarkdownHeavyFeatureIsolatedRenderFactory,
  type MarkdownHeavyFeatureAdapterResources,
  type MarkdownHeavyFeatureIsolatedRenderRequest,
  validateMarkdownHeavyFeatureIsolatedRenderOutput,
  validateMarkdownHeavyFeatureIsolatedRenderRequest,
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
  let active = true
  let readyAttached = false
  let bootstrapPending = false
  let bootstrapIssued = false
  let requestPending = false
  let started = false
  let scheduledContinue: { cancel: (() => void) | null } | null = null
  let port: MessagePort | null = null
  let transferPort: MessagePort | null = null
  let script: HTMLScriptElement | null = null
  const resourceChangeListeners = new Set<() => void>()
  const notifyResourceChange = () => {
    for (const listener of resourceChangeListeners) listener()
  }
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('tabindex', '-1')
  iframe.dataset.fsusMarkdownHeavyPending = validatedRequest.kind
  if (validatedRequest.lifecycleKey) {
    iframe.dataset.fsusMarkdownHeavyNode = validatedRequest.lifecycleKey
  }
  iframe.style.position = 'fixed'
  iframe.style.inset = '-10000px auto auto -10000px'
  iframe.style.width = '1024px'
  iframe.style.height = '768px'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  document.body.append(iframe)

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
  const removeScriptHandlers = () => {
    if (!script) return
    script.onerror = null
    script.onload = null
  }
  const cleanup = () => {
    const continuation = scheduledContinue
    scheduledContinue = null
    continuation?.cancel?.()
    removeReadyListener()
    removeScriptHandlers()
    script = null
    if (port) {
      port.onmessage = null
      port.onmessageerror = null
    }
    port?.close()
    port = null
    transferPort?.close()
    transferPort = null
    iframe.remove()
    bootstrapPending = false
    requestPending = false
    notifyResourceChange()
  }
  const teardown = () => {
    if (!active) return
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
    removeReadyListener()
    removeScriptHandlers()
    bootstrapPending = false
    try {
      const channel = new MessageChannel()
      port = channel.port1
      transferPort = channel.port2
      port.onmessageerror = teardown
      port.onmessage = (message) => {
        if (!active) return
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
              const cancel = scheduleContinue(
                `markdown-heavy-frame-continue:${validatedRequest.lifecycleKey ?? capability}`,
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
          cleanup()
          rejectPromise(error)
          return
        }
        teardown()
      }
      requestPending = true
      notifyResourceChange()
      if (!iframe.contentWindow) throw abortError()
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
      active = false
      cleanup()
      rejectPromise(error)
    }
  }
  window.addEventListener('message', ready)
  readyAttached = true

  const resources: MarkdownHeavyFeatureAdapterResources = Object.freeze({
    scope: 'owned-handles',
    get listeners() {
      return (
        (readyAttached ? 1 : 0) +
        (port?.onmessage ? 1 : 0) +
        (port?.onmessageerror ? 1 : 0) +
        (script?.onerror ? 1 : 0) +
        (script?.onload ? 1 : 0)
      )
    },
    get networkRequests() {
      // Realm removal does not expose module-loader/third-party network aborts.
      return bootstrapIssued ? 'unknown' : 0
    },
    observers: 0,
    pendingImports: 0,
    get runtimes() {
      return iframe.isConnected ? 1 : 0
    },
    get scheduledContinuations() {
      return scheduledContinue ? 1 : 0
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
        (scheduledContinue ? 1 : 0)
      )
    },
    get timers() {
      return bootstrapIssued ? 'unknown' : 0
    },
  })
  const handle = Object.freeze({
    promise,
    resources: () => resources,
    teardown,
  })

  try {
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
        script.src = trustedModuleUrl as string
      } catch (cause) {
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
      script.onerror = () => {
        if (!active) return
        active = false
        cleanup()
        rejectPromise(new Error('markdown_heavy_feature_frame_load_failed'))
      }
      script.onload = () => {
        bootstrapPending = false
        removeScriptHandlers()
        notifyResourceChange()
      }
      bootstrapPending = true
      bootstrapIssued = true
      frameDocument.head.append(script)
    }
  } catch (error) {
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
