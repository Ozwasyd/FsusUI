import {
  activateMarkdownFeatures,
  inspectMarkdownHeavyFeatureRuntimeLoaders,
} from './markdown-runtime'
import type { FeatureRenderOutput } from './markdown-runtime'
import {
  MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
  createMarkdownHeavyFeatureAdapterResourceOwner,
  validateMarkdownHeavyFeatureFrameCancelMessage,
  type MarkdownHeavyFeatureAdapterResourceOwner,
  type MarkdownHeavyFeatureFrameResourceSnapshot,
  type MarkdownHeavyFeatureResourceCount,
  validateMarkdownHeavyFeatureFrameContinueMessage,
  validateMarkdownHeavyFeatureIsolatedRenderRequest,
  type MarkdownHeavyFeatureIsolatedRenderRequest,
} from './markdown-heavy-feature-resource'

const frameWindow = window as Window & typeof globalThis
const capability = document.documentElement.dataset.fsusMarkdownFrameCapability
const parentOrigin = document.documentElement.dataset.fsusMarkdownParentOrigin

if (!capability || !parentOrigin || parentOrigin === 'null') {
  throw new Error('markdown_heavy_feature_frame_authority_invalid')
}

const applyTokens = (
  element: HTMLElement,
  tokens: Readonly<Record<string, string>>,
) => {
  const tokenNames: Record<string, string> = {
    background: '--el-bg-color',
    danger: '--el-color-danger',
    edgeLabelBackground: '--el-bg-color-overlay',
    lineColor: '--el-border-color-darker',
    mainBackground: '--el-fill-color-light',
    nodeBorder: '--el-color-primary',
    primaryBorderColor: '--el-color-primary',
    primaryColor: '--el-fill-color-light',
    primaryTextColor: '--el-text-color-primary',
    secondaryColor: '--el-fill-color-blank',
    tertiaryColor: '--el-fill-color-lighter',
  }
  for (const [key, name] of Object.entries(tokenNames)) {
    const value = tokens[key]
    if (value) element.style.setProperty(name, value)
  }
}

const createTarget = (request: MarkdownHeavyFeatureIsolatedRenderRequest) => {
  if (request.kind === 'mermaid') {
    const pre = document.createElement('pre')
    pre.className = 'markdown-renderer__mermaid'
    pre.dataset.mermaidPlaceholder = 'true'
    const code = document.createElement('code')
    code.dataset.mermaidSource = request.source
    code.textContent = request.source
    pre.append(code)
    return pre
  }
  if (request.kind === 'latex') {
    const element = document.createElement(request.displayMode ? 'div' : 'span')
    element.className = 'markdown-renderer__latex'
    element.dataset.latexPlaceholder = 'true'
    element.dataset.latexSource = request.source
    element.textContent = request.source
    return element
  }
  const pre = document.createElement('pre')
  const code = document.createElement('code')
  code.className = `language-${request.language ?? 'text'}`
  code.textContent = request.source
  pre.append(code)
  return pre
}

const extractOutput = (
  request: MarkdownHeavyFeatureIsolatedRenderRequest,
  root: HTMLElement,
): FeatureRenderOutput => {
  if (request.kind === 'mermaid') {
    const svg = root.querySelector<SVGElement>('svg')
    if (!svg) throw new Error('mermaid_isolated_output_missing')
    return Object.freeze({
      kind: 'mermaid',
      payload: svg.outerHTML,
      rootId: svg.id || 'fsus-markdown-mermaid-isolated',
    })
  }
  if (request.kind === 'latex') {
    const katex = root.querySelector<HTMLElement>('.katex')
    if (!katex) throw new Error('latex_isolated_output_missing')
    return Object.freeze({ kind: 'latex', payload: katex.outerHTML })
  }
  const highlighted = root.querySelector<HTMLElement>(
    '[data-code-highlighted="shiki"]',
  )
  if (!highlighted) throw new Error('code_highlight_isolated_output_missing')
  return Object.freeze({
    kind: 'code-highlight',
    payload: highlighted.outerHTML,
  })
}

const render = async (
  request: MarkdownHeavyFeatureIsolatedRenderRequest,
  resourceOwner: MarkdownHeavyFeatureAdapterResourceOwner,
  signal: AbortSignal,
) => {
  if (signal.aborted || !resourceOwner.acceptsWork())
    throw new DOMException('Aborted', 'AbortError')
  const root = document.createElement('main')
  root.dataset.themeResolved = request.theme
  applyTokens(root, request.tokens)
  const target = createTarget(request)
  root.append(target)
  document.body.replaceChildren(root)
  const result = await activateMarkdownFeatures({
    concurrency: 1,
    cspNonce: request.cspNonce,
    features: {
      codeHighlight: request.kind === 'code-highlight',
      cspNonce: true,
      externalLink: false,
      hashLink: false,
      headingSlug: false,
      latex: request.kind === 'latex',
      mermaid: request.kind === 'mermaid',
    },
    root,
    resourceOwner,
    signal,
  })
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? 'isolated_render_failed')
  }
  if (signal.aborted || !resourceOwner.acceptsWork())
    throw new DOMException('Aborted', 'AbortError')
  return extractOutput(request, root)
}

const receiveRenderRequest = (event: MessageEvent) => {
  if (
    event.source !== frameWindow.parent ||
    event.origin !== parentOrigin ||
    event.data?.scope !== MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE ||
    event.data?.type !== 'render' ||
    event.data?.capability !== capability ||
    !event.ports[0]
  ) {
    return
  }
  frameWindow.removeEventListener('message', receiveRenderRequest)
  const port = event.ports[0]
  const request = validateMarkdownHeavyFeatureIsolatedRenderRequest(
    event.data.request,
  )
  if (!request) {
    port.postMessage({
      capability,
      message: 'markdown_heavy_feature_frame_request_invalid',
      scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
      type: 'reject',
    })
    port.close()
    return
  }
  const owner = createMarkdownHeavyFeatureAdapterResourceOwner()
  const controller = new AbortController()
  let renderEntered = false
  let pendingRender = false
  let cancellationRequested = false
  let terminal = false
  let portHeld = true
  let publishing = false
  const send = (message: Record<string, unknown>) => {
    try {
      port.postMessage({
        ...message,
        capability,
        scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
      })
    } catch (cause) {
      owner.retainFailure('frame-provider-dispatch', port, cause)
    }
  }
  const publishResources = () => {
    if (publishing) return
    publishing = true
    try {
      const owned = owner.resources
      const shared = inspectMarkdownHeavyFeatureRuntimeLoaders()
      const combine = (
        a: MarkdownHeavyFeatureResourceCount | undefined,
        b: MarkdownHeavyFeatureResourceCount | undefined,
      ): MarkdownHeavyFeatureResourceCount => {
        if (a === 'unavailable' || b === 'unavailable') return 'unavailable'
        if (typeof a !== 'number' || typeof b !== 'number') return 'unknown'
        return a + b
      }
      const snapshot: MarkdownHeavyFeatureFrameResourceSnapshot = {
        admission: owner.acceptsWork() ? 'open' : 'closed',
        cancellationRequested,
        pendingRender,
        listeners:
          (port.onmessage ? 1 : 0) +
          (port.onmessageerror ? 1 : 0) +
          owned.listeners,
        ports: portHeld ? 1 : 0,
        ownedTasks: owned.tasks,
        ownedImports: owned.pendingImports ?? 0,
        ownedRequests: owned.pendingRequests ?? 0,
        ownedTimers: owned.ownedTimers ?? 0,
        sharedImports: shared.resources.pendingImports ?? 0,
        sharedWork: shared.pendingLoaderWork,
        failureCount:
          (owned.failures?.length ?? 0) +
          (shared.resources.failures?.length ?? 0),
        // A third-party module graph cannot be censused or cancelled here.
        timers: combine(owned.timers, shared.resources.timers),
        networkRequests: combine(
          owned.networkRequests,
          shared.resources.networkRequests,
        ),
      }
      send({ type: 'resources', snapshot })
    } finally {
      publishing = false
    }
  }
  const unsubscribeOwned = owner.resources.subscribe?.(publishResources)
  const unsubscribeShared =
    inspectMarkdownHeavyFeatureRuntimeLoaders().resources.subscribe?.(
      publishResources,
    )
  const requestCancellation = () => {
    if (cancellationRequested) return
    cancellationRequested = true
    // Close producer admission before notifying abort listeners. Shared loader
    // caches are borrowed observations and have no consumer cancellation path.
    owner.requestCancellation()
    try {
      controller.abort()
    } catch (cause) {
      owner.retainFailure('frame-provider-abort', controller, cause)
    }
    publishResources()
  }
  const finish = (output?: FeatureRenderOutput, cause?: unknown) => {
    if (terminal) return
    terminal = true
    if (!output) owner.retainFailure('frame-render-settlement', port, cause)
    let message = 'isolated_render_failed'
    if (!output) {
      try {
        message = cause instanceof Error ? cause.message : String(cause)
      } catch (failure) {
        owner.retainFailure('frame-render-cause-format', port, failure)
      }
    }
    pendingRender = false
    owner.requestCancellation()
    try {
      port.onmessage = null
      port.onmessageerror = null
    } catch (failure) {
      owner.retainFailure('frame-provider-handlers-remove', port, failure)
    }
    unsubscribeOwned?.()
    unsubscribeShared?.()
    publishResources()
    send(
      output
        ? { type: 'resolve', output }
        : {
            type: 'reject',
            message,
          },
    )
    try {
      port.close()
      portHeld = false
    } catch (failure) {
      owner.retainFailure('frame-provider-port-close', port, failure)
      publishResources()
    }
    // Closing the transport cannot publish its own settlement acknowledgement.
    // The parent keeps the last received snapshot as unavailable after teardown.
  }
  port.onmessageerror = (event) => {
    owner.retainFailure('frame-provider-message-error', port, event)
    requestCancellation()
    // Loss of transport is not a render settlement.
  }
  port.onmessage = (message) => {
    if (
      validateMarkdownHeavyFeatureFrameCancelMessage(message.data, capability)
    ) {
      requestCancellation()
      if (!renderEntered)
        finish(undefined, new DOMException('Aborted', 'AbortError'))
      return
    }
    if (
      renderEntered ||
      !validateMarkdownHeavyFeatureFrameContinueMessage(
        message.data,
        capability,
      )
    ) {
      const cause = new Error('markdown_heavy_feature_frame_continue_invalid')
      owner.retainFailure('frame-provider-protocol', port, cause)
      requestCancellation()
      if (!renderEntered) finish(undefined, cause)
      else send({ type: 'protocol-error', message: cause.message })
      return
    }
    renderEntered = true
    pendingRender = true
    publishResources()
    // Observe this original producer promise until its actual terminal. Abort,
    // wrapper rejection and port/realm teardown never settle it on our behalf.
    void render(request, owner, controller.signal).then(
      (output) => finish(output),
      (cause: unknown) => finish(undefined, cause),
    )
  }
  publishResources()
  send({ type: 'started' })
}

frameWindow.addEventListener('message', receiveRenderRequest)

frameWindow.parent.postMessage(
  {
    capability,
    scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
    type: 'ready',
  },
  parentOrigin,
)

export {}
