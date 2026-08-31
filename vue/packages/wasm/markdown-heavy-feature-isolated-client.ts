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

const abortError = () => new DOMException('Aborted', 'AbortError')

export type MarkdownHeavyFeatureTrustedScriptUrlFactory = (
  moduleUrl: URL,
) => unknown

export type MarkdownHeavyFeatureFrameContinueScheduler = (
  key: string,
  run: () => void,
) => boolean

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
  let port: MessagePort | null = null
  let script: HTMLScriptElement | null = null
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('tabindex', '-1')
  iframe.style.display = 'none'
  document.body.append(iframe)

  let resolvePromise!: (value: T) => void
  let rejectPromise!: (reason: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  const removeReadyListener = () => window.removeEventListener('message', ready)
  const cleanup = () => {
    removeReadyListener()
    if (script) script.onerror = null
    script = null
    port?.close()
    port = null
    iframe.remove()
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
    if (script) script.onerror = null
    const channel = new MessageChannel()
    port = channel.port1
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
        iframe.dataset.fsusMarkdownHeavyWork = validatedRequest.kind
        if (validatedRequest.lifecycleKey) {
          iframe.dataset.fsusMarkdownHeavyNode = validatedRequest.lifecycleKey
        }
        const continueRender = () => {
          if (!active) return
          port?.postMessage({
            capability,
            scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
            type: 'continue',
          })
        }
        if (
          scheduleContinue &&
          !scheduleContinue(
            `markdown-heavy-frame-continue:${validatedRequest.lifecycleKey ?? capability}`,
            continueRender,
          )
        ) {
          teardown()
        } else if (!scheduleContinue) {
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
    iframe.contentWindow?.postMessage(
      {
        capability,
        request: validatedRequest,
        scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
        type: 'render',
      },
      expectedOrigin,
      [channel.port2],
    )
  }
  window.addEventListener('message', ready)

  const frameDocument = iframe.contentDocument
  if (!frameDocument) {
    teardown()
  } else {
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
    const trustedModuleUrl = trustedScriptUrlFactory
      ? trustedScriptUrlFactory(moduleUrl)
      : moduleUrl
    try {
      script.src = trustedModuleUrl as string
    } catch (cause) {
      active = false
      cleanup()
      rejectPromise(
        new Error('markdown_heavy_feature_frame_script_url_rejected', {
          cause,
        }),
      )
      return Object.freeze({
        promise,
        resources: (): MarkdownHeavyFeatureAdapterResources =>
          Object.freeze({ listeners: 0, observers: 0, runtimes: 0, tasks: 0 }),
        teardown,
      })
    }
    if (validatedRequest.cspNonce) script.nonce = validatedRequest.cspNonce
    script.onerror = () => {
      if (!active) return
      active = false
      cleanup()
      rejectPromise(new Error('markdown_heavy_feature_frame_load_failed'))
    }
    frameDocument.head.append(script)
  }

  return Object.freeze({
    promise,
    resources: (): MarkdownHeavyFeatureAdapterResources =>
      Object.freeze({
        listeners: active ? 2 : 0,
        observers: 0,
        runtimes: active ? 1 : 0,
        tasks: active ? 1 : 0,
      }),
    teardown,
  })
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
