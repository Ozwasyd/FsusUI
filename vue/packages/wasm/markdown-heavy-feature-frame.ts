import { activateMarkdownFeatures } from './markdown-runtime'
import type { FeatureRenderOutput } from './markdown-runtime'
import {
  MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
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

const render = async (request: MarkdownHeavyFeatureIsolatedRenderRequest) => {
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
  })
  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message ?? 'isolated_render_failed')
  }
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
  port.onmessage = (message) => {
    if (
      !validateMarkdownHeavyFeatureFrameContinueMessage(
        message.data,
        capability,
      )
    ) {
      port.postMessage({
        capability,
        message: 'markdown_heavy_feature_frame_continue_invalid',
        scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
        type: 'reject',
      })
      port.close()
      return
    }
    port.onmessage = null
    void render(request).then(
      (output) =>
        port.postMessage({
          capability,
          scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
          type: 'resolve',
          output,
        }),
      (error: unknown) =>
        port.postMessage({
          capability,
          message: error instanceof Error ? error.message : String(error),
          scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
          type: 'reject',
        }),
    )
  }
  port.postMessage({
    capability,
    scope: MARKDOWN_HEAVY_FEATURE_FRAME_SCOPE,
    type: 'started',
  })
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
