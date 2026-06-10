import { loadEmscriptenModule } from './runtime/emscripten'
import { resolveMarkdownAsset, type MarkdownAssetKind } from './runtime/assets'
import { createSerializedExecutor } from './runtime/serialized'
import { decodeUtf8, encodeUtf8 } from './runtime/utf8'
import {
  MARKDOWN_RENDERER_VERSION,
  buildMarkdownRenderResult,
  normalizeMarkdownSource,
  type MarkdownRenderChunk,
  type MarkdownRenderFeature,
  type MarkdownRenderMetadata,
  type MarkdownRenderPlaceholder,
  type MarkdownRenderRequest,
  type MarkdownRenderResult,
  type MarkdownRenderTimings,
} from './markdown'
import type {
  FsusErrorCode,
  FsusErrorDetail,
  FsusResult,
} from '@element-plus/utils'

export type MarkdownRuntimeErrorCode = 'invariant' | 'protocol' | 'infra'

export class MarkdownRuntimeError extends Error {
  constructor(
    public readonly code: MarkdownRuntimeErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'MarkdownRuntimeError'
  }
}

const fsusErrorCategories = {
  aborted: 'runtime',
  conflict: 'conflict',
  forbidden: 'auth',
  infra: 'runtime',
  invariant: 'invariant',
  'not-found': 'not-found',
  protocol: 'runtime',
  timeout: 'runtime',
  unauthorized: 'auth',
  unknown: 'unknown',
  validation: 'validation',
} as const satisfies Record<FsusErrorCode, FsusErrorDetail['category']>

const createFsusRuntimeError = (
  code: FsusErrorCode,
  message: string,
  cause?: unknown,
): FsusErrorDetail => ({
  category: fsusErrorCategories[code],
  code,
  message,
  ...(cause === undefined ? {} : { cause }),
})

const fsusOk = <T>(value: T): FsusResult<T> => ({ ok: true, value })

const fsusErr = <T = never>(error: FsusErrorDetail): FsusResult<T> => ({
  ok: false,
  error,
})

const isFsusErr = <T>(
  result: FsusResult<T>,
): result is { ok: false; error: FsusErrorDetail } => result.ok === false

const markdownErrorToFsusError = (
  error: unknown,
  fallbackMessage: string,
): FsusErrorDetail => {
  if (error instanceof MarkdownRuntimeError) {
    return createFsusRuntimeError(error.code, error.message, error)
  }
  if (error instanceof Error) {
    return createFsusRuntimeError('infra', error.message, error)
  }
  return createFsusRuntimeError(
    'unknown',
    typeof error === 'string' ? error : fallbackMessage,
    error,
  )
}

function createMarkdownRuntimeError(
  code: MarkdownRuntimeErrorCode,
  message: string,
): MarkdownRuntimeError {
  return new MarkdownRuntimeError(code, message)
}

export type MarkdownRuntimeKind = 'SIMD-128' | 'SCALAR-BASIC' | 'UNKNOWN'
export type MarkdownRuntimeProfilePhase =
  | 'html-only'
  | 'summary'
  | 'full-result'
  | 'chunks'
export type MarkdownRuntimeRenderResult = MarkdownRenderResult & {
  engine: MarkdownRuntimeKind
  timings: MarkdownRenderTimings
}

export interface MarkdownRuntimeHtmlResult {
  html: string
  engine: MarkdownRuntimeKind
  rendererVersion: string
  timings: MarkdownRenderTimings
}

export interface MarkdownRuntimeSummaryResult {
  html: string
  engine: MarkdownRuntimeKind
  features: readonly MarkdownRenderFeature[]
  metadata: MarkdownRenderMetadata
  rendererVersion: string
  timings: MarkdownRenderTimings
}

export type MarkdownRuntimeChunkResult = MarkdownRuntimeRenderResult & {
  chunks: readonly MarkdownRenderChunk[]
}

export interface MarkdownRuntimeProfile {
  engine: MarkdownRuntimeKind
  phase: MarkdownRuntimeProfilePhase
  rendererVersion: string
  timings: MarkdownRenderTimings
}

export type MarkdownFeatureActivationKind =
  | 'code-highlight'
  | 'csp-style'
  | 'external-link'
  | 'hash-link'
  | 'heading'
  | 'latex'
  | 'mermaid'

export interface MarkdownFeatureActivationFeatureOptions {
  codeHighlight?: boolean
  cspNonce?: boolean
  externalLink?: boolean
  hashLink?: boolean
  headingSlug?: boolean
  latex?: boolean
  mermaid?: boolean
}

export interface MarkdownFeatureActivationItem {
  count: number
  kind: MarkdownFeatureActivationKind
}

export interface MarkdownFeatureActivationError {
  kind: MarkdownFeatureActivationKind
  message: string
}

export interface MarkdownFeatureActivationResult {
  activated: readonly MarkdownFeatureActivationItem[]
  errors: readonly MarkdownFeatureActivationError[]
}

export type MarkdownFeatureActivationTheme = 'dark' | 'light'

export interface MarkdownFeatureAdapterContext {
  baseUrl?: string | null
  cspNonce?: string | null
  kind: MarkdownFeatureActivationKind
  root: ParentNode
  theme: MarkdownFeatureActivationTheme
}

export type MarkdownFeatureAdapter = (
  element: HTMLElement,
  context?: MarkdownFeatureAdapterContext,
) => void | Promise<void>

export interface MarkdownFeatureActivationOptions {
  baseUrl?: string | null
  codeHighlightAdapter?: MarkdownFeatureAdapter | null
  cspNonce?: string | null
  features?: MarkdownFeatureActivationFeatureOptions
  latexAdapter?: MarkdownFeatureAdapter | null
  mermaidAdapter?: MarkdownFeatureAdapter | null
  root: ParentNode
}

const defaultMarkdownFeatureOptions: Required<MarkdownFeatureActivationFeatureOptions> =
  {
    codeHighlight: true,
    cspNonce: true,
    externalLink: true,
    hashLink: true,
    headingSlug: true,
    latex: true,
    mermaid: true,
  }

const toMarkdownFeatureOptions = (
  features: MarkdownFeatureActivationFeatureOptions | undefined,
) => ({
  ...defaultMarkdownFeatureOptions,
  ...(features ?? {}),
})

const pushActivation = (
  activated: MarkdownFeatureActivationItem[],
  kind: MarkdownFeatureActivationKind,
  count: number,
) => {
  if (count > 0) activated.push({ count, kind })
}

const createActivationError = (
  kind: MarkdownFeatureActivationKind,
  error: unknown,
): MarkdownFeatureActivationError => ({
  kind,
  message:
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : `${kind}_activation_failed`,
})

const slugifyMarkdownHeading = (value: string, fallback: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')

  return slug || fallback
}

const collectExistingIds = (root: ParentNode) =>
  new Set(
    Array.from(root.querySelectorAll<HTMLElement>('[id]'))
      .map((element) => element.id)
      .filter(Boolean),
  )

const reserveUniqueId = (ids: Set<string>, base: string) => {
  let id = base
  let suffix = 2
  while (ids.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  ids.add(id)
  return id
}

const activateHeadingSlugs = (root: ParentNode) => {
  const ids = collectExistingIds(root)
  let count = 0
  Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')).forEach(
    (heading, index) => {
      if (!heading.id) {
        heading.id = reserveUniqueId(
          ids,
          slugifyMarkdownHeading(
            heading.textContent ?? '',
            `section-${index + 1}`,
          ),
        )
      }
      heading.dataset.markdownHeading = heading.id
      count += 1
    },
  )
  return count
}

const isExternalMarkdownUrl = (href: string, baseUrl?: string | null) => {
  if (/^(?:mailto|tel):/i.test(href)) return false
  if (href.startsWith('#')) return false

  try {
    const fallbackBase =
      baseUrl ??
      (typeof window !== 'undefined' && window.location?.href
        ? window.location.href
        : 'https://fsus.local/')
    const current = new URL(fallbackBase)
    const target = new URL(href, current)
    return target.origin !== current.origin
  } catch {
    return false
  }
}

const addRelToken = (element: HTMLAnchorElement, token: string) => {
  const tokens = new Set(
    (element.getAttribute('rel') ?? '').split(/\s+/).filter(Boolean),
  )
  tokens.add(token)
  element.setAttribute('rel', Array.from(tokens).join(' '))
}

const activateLinks = (
  root: ParentNode,
  baseUrl?: string | null,
): { external: number; hash: number } => {
  let external = 0
  let hash = 0

  Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]')).forEach(
    (anchor) => {
      const href = anchor.getAttribute('href') ?? ''
      if (href.startsWith('#')) {
        anchor.dataset.markdownHashLink = 'true'
        hash += 1
        return
      }

      if (!isExternalMarkdownUrl(href, baseUrl)) return

      anchor.target = '_blank'
      addRelToken(anchor, 'noopener')
      addRelToken(anchor, 'noreferrer')
      anchor.dataset.markdownExternalLink = 'true'
      external += 1
    },
  )

  return { external, hash }
}

const activateCspNonce = (root: ParentNode, nonce?: string | null) => {
  if (!nonce) return 0

  let count = 0
  Array.from(root.querySelectorAll<HTMLStyleElement>('style')).forEach(
    (style) => {
      if (!style.nonce) {
        style.nonce = nonce
        count += 1
      }
    },
  )
  return count
}

const isElementNode = (node: Node): node is Element =>
  node.nodeType === Node.ELEMENT_NODE

const selectMarkdownFeatureElements = (root: ParentNode, selector: string) => {
  const elements: HTMLElement[] = []
  const rootNode = root as Node

  if (isElementNode(rootNode) && rootNode.matches(selector)) {
    elements.push(rootNode as HTMLElement)
  }

  elements.push(...Array.from(root.querySelectorAll<HTMLElement>(selector)))
  return Array.from(new Set(elements))
}

const getRootElement = (root: ParentNode) => {
  if (isElementNode(root as Node)) return root as Element
  if (root instanceof Document) return root.documentElement
  return null
}

const resolveFeatureTheme = (
  root: ParentNode,
): MarkdownFeatureActivationTheme => {
  const rootElement = getRootElement(root)
  let current: Element | null = rootElement

  while (current) {
    const resolvedTheme =
      current.getAttribute('data-theme-resolved') ??
      current.getAttribute('data-theme')
    if (resolvedTheme === 'dark' || resolvedTheme === 'light') {
      return resolvedTheme
    }
    if (current.classList.contains('dark')) return 'dark'
    current = current.parentElement
  }

  const documentElement =
    root instanceof Document
      ? root.documentElement
      : rootElement?.ownerDocument?.documentElement
  const documentTheme =
    documentElement?.getAttribute('data-theme-resolved') ??
    documentElement?.getAttribute('data-theme')
  if (documentTheme === 'dark' || documentTheme === 'light') {
    return documentTheme
  }
  if (documentElement?.classList.contains('dark')) return 'dark'

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }

  return 'light'
}

const getComputedToken = (
  element: Element | null,
  token: string,
  fallback: string,
) => {
  if (!element || typeof window === 'undefined') return fallback
  const value = window.getComputedStyle(element).getPropertyValue(token).trim()
  return value || fallback
}

const getFeatureStyleRoot = (element: HTMLElement, root: ParentNode) =>
  getRootElement(root) ?? element.ownerDocument.documentElement

const unsafeFeatureElementNames = new Set([
  'base',
  'embed',
  'foreignobject',
  'iframe',
  'link',
  'meta',
  'object',
  'script',
])

const featureUrlAttributeNames = new Set([
  'action',
  'formaction',
  'href',
  'poster',
  'src',
  'xlink:href',
])

const unsafeFeatureUrlProtocolRe = /^(?:javascript|vbscript):/i
const featureDataUrlRe = /^data:/i
const safeFeatureDataImageRe =
  /^data:image\/(?:gif|jpeg|jpg|png|webp|svg\+xml);base64,/i

const stripFeatureUrlControlChars = (value: string) =>
  Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code > 31 && code !== 127 && !/\s/.test(char)
    })
    .join('')

const isUnsafeFeatureUrl = (value: string) => {
  const normalized = stripFeatureUrlControlChars(value)
  if (unsafeFeatureUrlProtocolRe.test(normalized)) return true
  return (
    featureDataUrlRe.test(normalized) && !safeFeatureDataImageRe.test(value)
  )
}

const hasUnsafeFeatureStyle = (value: string) =>
  /(?:expression\s*\(|url\s*\(\s*['"]?\s*(?:javascript|vbscript):)/i.test(value)

const applyNonceToFeatureStyles = (
  root: ParentNode | Node,
  nonce?: string | null,
) => {
  if (!nonce) return

  const styles: Element[] = []
  const rootNode = root as Node
  if (isElementNode(rootNode) && rootNode.tagName.toLowerCase() === 'style') {
    styles.push(rootNode)
  }
  if ('querySelectorAll' in root) {
    styles.push(...Array.from(root.querySelectorAll('style')))
  }

  styles.forEach((style) => {
    if (!(style as HTMLStyleElement).nonce) {
      ;(style as HTMLStyleElement).nonce = nonce
    }
  })
}

const sanitizeFeatureFragment = (
  fragment: DocumentFragment,
  nonce?: string | null,
) => {
  const elements = Array.from(fragment.querySelectorAll('*'))
  for (const element of elements) {
    const name = element.tagName.toLowerCase()

    if (unsafeFeatureElementNames.has(name)) {
      element.remove()
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name.toLowerCase()
      const value = attribute.value.trim()

      if (attributeName.startsWith('on') || attributeName === 'srcdoc') {
        element.removeAttribute(attribute.name)
        continue
      }

      if (
        featureUrlAttributeNames.has(attributeName) &&
        isUnsafeFeatureUrl(value)
      ) {
        element.removeAttribute(attribute.name)
        continue
      }

      if (attributeName === 'style' && hasUnsafeFeatureStyle(value)) {
        element.removeAttribute(attribute.name)
      }
    }
  }

  applyNonceToFeatureStyles(fragment, nonce)
  return fragment
}

const createSafeFeatureFragment = (
  document: Document,
  html: string,
  nonce?: string | null,
) => {
  const template = document.createElement('template')
  template.innerHTML = html
  return sanitizeFeatureFragment(template.content, nonce)
}

const withStyleNonceBridge = async <T>(
  document: Document,
  nonce: string | null | undefined,
  task: () => T | Promise<T>,
): Promise<T> => {
  const nodePrototype = document.defaultView?.Node?.prototype
  if (!nonce || !nodePrototype) return task()

  const originalAppendChild = nodePrototype.appendChild
  const originalInsertBefore = nodePrototype.insertBefore
  const originalReplaceChild = nodePrototype.replaceChild

  nodePrototype.appendChild = function (this: Node, node: Node) {
    applyNonceToFeatureStyles(node, nonce)
    return originalAppendChild.call(this, node)
  } as typeof nodePrototype.appendChild

  nodePrototype.insertBefore = function (
    this: Node,
    node: Node,
    child: Node | null,
  ) {
    applyNonceToFeatureStyles(node, nonce)
    return originalInsertBefore.call(this, node, child)
  } as typeof nodePrototype.insertBefore

  nodePrototype.replaceChild = function (this: Node, node: Node, child: Node) {
    applyNonceToFeatureStyles(node, nonce)
    return originalReplaceChild.call(this, node, child)
  } as typeof nodePrototype.replaceChild

  try {
    return await task()
  } finally {
    nodePrototype.appendChild = originalAppendChild
    nodePrototype.insertBefore = originalInsertBefore
    nodePrototype.replaceChild = originalReplaceChild
  }
}

const formatFeatureErrorMessage = (
  kind: MarkdownFeatureActivationKind,
  error: unknown,
) =>
  error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : `${kind}_activation_failed`

const createFeatureErrorElement = (
  document: Document,
  kind: MarkdownFeatureActivationKind,
  error: unknown,
  source?: string,
  inline = false,
) => {
  const element = document.createElement(inline ? 'span' : 'div')
  element.className = 'el-markdown-renderer__feature-error'
  element.setAttribute('role', 'note')
  element.dataset.markdownFeatureError = kind

  const message = document.createElement(inline ? 'span' : 'p')
  message.className = 'el-markdown-renderer__feature-error-message'
  message.textContent = formatFeatureErrorMessage(kind, error)
  element.append(message)

  if (source) {
    const code = document.createElement('code')
    code.textContent = source
    element.append(code)
  }

  return element
}

const renderFeatureError = (
  element: HTMLElement,
  kind: MarkdownFeatureActivationKind,
  error: unknown,
  source?: string,
) => {
  const inline = element.tagName === 'SPAN' || element.tagName === 'CODE'
  const errorElement = createFeatureErrorElement(
    element.ownerDocument,
    kind,
    error,
    source,
    inline,
  )
  element.replaceChildren(errorElement)
  element.dataset.markdownFeatureError = kind
}

const replaceWithFeatureError = (
  element: HTMLElement,
  kind: MarkdownFeatureActivationKind,
  error: unknown,
  source?: string,
) => {
  const inline = element.tagName === 'SPAN' || element.tagName === 'CODE'
  const errorElement = createFeatureErrorElement(
    element.ownerDocument,
    kind,
    error,
    source,
    inline,
  )
  element.replaceWith(errorElement)
}

const extractFeatureSource = (
  element: HTMLElement,
  dataNames: readonly string[],
) => {
  for (const name of dataNames) {
    const value = element.dataset[name]
    if (value) return value
  }

  for (const attribute of [
    'data-markdown-source',
    'data-source',
    'data-source-code',
  ]) {
    const value = element.getAttribute(attribute)
    if (value) return value
  }

  const code =
    element.tagName === 'CODE'
      ? element
      : element.querySelector<HTMLElement>('code')
  return code?.textContent?.replace(/\n+$/g, '') ?? ''
}

type MermaidRuntime = {
  initialize?: (options: Record<string, unknown>) => void
  render?: (
    id: string,
    source: string,
  ) => Promise<{ svg: string }> | { svg: string } | string
}

type KatexRuntime = {
  renderToString?: (source: string, options: Record<string, unknown>) => string
}

type ShikiRuntime = {
  codeToHtml?: (
    source: string,
    options: Record<string, unknown>,
  ) => string | Promise<string>
}

const resolveDefaultModule = <T>(module: T | { default?: T }) =>
  'default' in (module as Record<string, unknown>) &&
  (module as { default?: T }).default
    ? (module as { default: T }).default
    : (module as T)

const loadMermaidRuntime = async () =>
  resolveDefaultModule<MermaidRuntime>(
    (await import('mermaid')) as unknown as
      | MermaidRuntime
      | { default?: MermaidRuntime },
  )

const loadKatexRuntime = async () =>
  resolveDefaultModule<KatexRuntime>(
    (await import('katex')) as unknown as
      | KatexRuntime
      | { default?: KatexRuntime },
  )

const loadShikiRuntime = async () =>
  resolveDefaultModule<ShikiRuntime>(
    (await import('shiki')) as unknown as
      | ShikiRuntime
      | { default?: ShikiRuntime },
  )

let markdownMermaidRenderId = 0

const createMermaidThemeVariables = (
  element: HTMLElement,
  context: MarkdownFeatureAdapterContext,
) => {
  const styleRoot = getFeatureStyleRoot(element, context.root)
  return {
    background: getComputedToken(styleRoot, '--el-bg-color', '#ffffff'),
    edgeLabelBackground: getComputedToken(
      styleRoot,
      '--el-bg-color-overlay',
      '#ffffff',
    ),
    lineColor: getComputedToken(
      styleRoot,
      '--el-border-color-darker',
      '#909399',
    ),
    mainBkg: getComputedToken(styleRoot, '--el-fill-color-light', '#f5f7fa'),
    nodeBorder: getComputedToken(styleRoot, '--el-color-primary', '#409eff'),
    primaryBorderColor: getComputedToken(
      styleRoot,
      '--el-color-primary',
      '#409eff',
    ),
    primaryColor: getComputedToken(
      styleRoot,
      '--el-fill-color-light',
      '#f5f7fa',
    ),
    primaryTextColor: getComputedToken(
      styleRoot,
      '--el-text-color-primary',
      '#303133',
    ),
    secondaryColor: getComputedToken(
      styleRoot,
      '--el-fill-color-blank',
      '#ffffff',
    ),
    tertiaryColor: getComputedToken(
      styleRoot,
      '--el-fill-color-lighter',
      '#fafafa',
    ),
  }
}

export const defaultMermaidAdapter: MarkdownFeatureAdapter = async (
  element,
  context,
) => {
  if (
    element.dataset.mermaidRendered === 'true' &&
    !element.querySelector('code')
  ) {
    applyNonceToFeatureStyles(element, context?.cspNonce)
    return
  }

  const source = extractFeatureSource(element, [
    'mermaidSource',
    'markdownSource',
    'source',
  ]).trim()
  if (!source) return

  try {
    const mermaid = await loadMermaidRuntime()
    if (typeof mermaid.render !== 'function') {
      throw new Error('mermaid_render_unavailable')
    }

    mermaid.initialize?.({
      securityLevel: 'strict',
      startOnLoad: false,
      theme: context?.theme === 'dark' ? 'dark' : 'default',
      themeVariables: context
        ? createMermaidThemeVariables(element, context)
        : undefined,
    })

    const renderId = `fsus-markdown-mermaid-${++markdownMermaidRenderId}`
    const rendered = await withStyleNonceBridge(
      element.ownerDocument,
      context?.cspNonce,
      () => mermaid.render!(renderId, source),
    )
    const svg =
      typeof rendered === 'string'
        ? rendered
        : (rendered as { svg: string }).svg
    const fragment = createSafeFeatureFragment(
      element.ownerDocument,
      svg,
      context?.cspNonce,
    )

    element.replaceChildren(fragment)
    element.dataset.mermaidRendered = 'true'
    element.dataset.markdownFeatureActivated = 'mermaid'
    element.removeAttribute('data-mermaid-placeholder')
  } catch (error) {
    renderFeatureError(element, 'mermaid', error, source)
    throw error
  }
}

const isBlockLatexElement = (element: HTMLElement) =>
  element.tagName === 'DIV' ||
  element.tagName === 'FIGURE' ||
  element.dataset.latexDisplay === 'block'

export const defaultLatexAdapter: MarkdownFeatureAdapter = async (
  element,
  context,
) => {
  if (element.dataset.latexRendered && !element.querySelector('code')) {
    applyNonceToFeatureStyles(element, context?.cspNonce)
    return
  }

  const source = extractFeatureSource(element, [
    'latexSource',
    'markdownSource',
    'source',
  ]).trim()
  if (!source) return

  try {
    const katex = await loadKatexRuntime()
    if (typeof katex.renderToString !== 'function') {
      throw new Error('katex_render_unavailable')
    }

    const styleRoot = context
      ? getFeatureStyleRoot(element, context.root)
      : element.ownerDocument.documentElement
    const html = katex.renderToString(source, {
      displayMode: isBlockLatexElement(element),
      errorColor: getComputedToken(styleRoot, '--el-color-danger', '#f56c6c'),
      throwOnError: false,
      trust: false,
    })
    const fragment = createSafeFeatureFragment(
      element.ownerDocument,
      html,
      context?.cspNonce,
    )

    element.replaceChildren(fragment)
    element.dataset.latexRendered = 'katex'
    element.dataset.markdownFeatureActivated = 'latex'
    element.removeAttribute('data-latex-placeholder')
  } catch (error) {
    renderFeatureError(element, 'latex', error, source)
    throw error
  }
}

const languageAliases = new Map([
  ['csharp', 'c#'],
  ['cs', 'c#'],
  ['javascript', 'js'],
  ['typescript', 'ts'],
  ['shell', 'bash'],
  ['sh', 'bash'],
])

const normalizeCodeLanguage = (language: string | undefined) => {
  if (!language) return 'text'
  const normalized = language.trim().toLowerCase()
  return languageAliases.get(normalized) ?? normalized ?? 'text'
}

const extractCodeLanguage = (element: HTMLElement) => {
  for (const className of Array.from(element.classList)) {
    const match = /^language-(.+)$/i.exec(className)
    if (match?.[1]) return normalizeCodeLanguage(match[1])
  }
  return 'text'
}

const renderShikiHtml = async (
  shiki: ShikiRuntime,
  source: string,
  language: string,
  theme: string,
) => {
  if (typeof shiki.codeToHtml !== 'function') {
    throw new Error('shiki_code_to_html_unavailable')
  }

  try {
    return await shiki.codeToHtml(source, { lang: language, theme })
  } catch (error) {
    if (language === 'text') throw error
    return shiki.codeToHtml(source, { lang: 'text', theme })
  }
}

export const defaultCodeHighlightAdapter: MarkdownFeatureAdapter = async (
  element,
  context,
) => {
  const code =
    element.tagName === 'CODE' ? element : element.querySelector('code')
  if (!code) return

  const pre = code.closest('pre') ?? code
  if (pre instanceof HTMLElement && pre.dataset.codeHighlighted === 'shiki') {
    applyNonceToFeatureStyles(pre, context?.cspNonce)
    return
  }

  const source = code.textContent ?? ''
  const language = extractCodeLanguage(code)
  const theme = context?.theme === 'dark' ? 'github-dark' : 'github-light'

  try {
    const shiki = await loadShikiRuntime()
    const html = await renderShikiHtml(shiki, source, language, theme)
    const fragment = createSafeFeatureFragment(
      element.ownerDocument,
      html,
      context?.cspNonce,
    )
    const highlightedPre = Array.from(fragment.childNodes).find(
      (node): node is HTMLElement =>
        isElementNode(node) && node.tagName === 'PRE',
    )

    if (pre instanceof HTMLElement) {
      if (highlightedPre) {
        highlightedPre.dataset.codeHighlighted = 'shiki'
        highlightedPre.dataset.markdownFeatureActivated = 'code-highlight'
        pre.replaceWith(highlightedPre)
      } else {
        pre.replaceChildren(fragment)
        pre.dataset.codeHighlighted = 'shiki'
        pre.dataset.markdownFeatureActivated = 'code-highlight'
      }
    } else {
      element.replaceChildren(fragment)
      element.dataset.codeHighlighted = 'shiki'
      element.dataset.markdownFeatureActivated = 'code-highlight'
    }
  } catch (error) {
    if (pre instanceof HTMLElement) {
      replaceWithFeatureError(pre, 'code-highlight', error, source)
    } else {
      renderFeatureError(element, 'code-highlight', error, source)
    }
    throw error
  }
}

const markElements = async (
  root: ParentNode,
  selector: string,
  kind: MarkdownFeatureActivationKind,
  adapter: MarkdownFeatureAdapter | null | undefined,
  context: MarkdownFeatureAdapterContext,
) => {
  const elements = selectMarkdownFeatureElements(root, selector)
  const errors: MarkdownFeatureActivationError[] = []
  let count = 0

  for (const element of elements) {
    try {
      if (adapter) await adapter(element, context)
      element.dataset.markdownFeatureActivated = kind
      count += 1
    } catch (error) {
      errors.push(createActivationError(kind, error))
    }
  }
  return { count, errors }
}

export const activateMarkdownFeatures = async (
  options: MarkdownFeatureActivationOptions,
): Promise<MarkdownFeatureActivationResult> => {
  const features = toMarkdownFeatureOptions(options.features)
  const activated: MarkdownFeatureActivationItem[] = []
  const errors: MarkdownFeatureActivationError[] = []
  const theme = resolveFeatureTheme(options.root)

  if (features.headingSlug) {
    pushActivation(activated, 'heading', activateHeadingSlugs(options.root))
  }

  if (features.externalLink || features.hashLink) {
    const links = activateLinks(options.root, options.baseUrl)
    if (features.externalLink) {
      pushActivation(activated, 'external-link', links.external)
    }
    if (features.hashLink) {
      pushActivation(activated, 'hash-link', links.hash)
    }
  }

  if (features.cspNonce) {
    pushActivation(
      activated,
      'csp-style',
      activateCspNonce(options.root, options.cspNonce),
    )
  }

  for (const [kind, selector, adapter] of [
    [
      'mermaid',
      '.markdown-renderer__mermaid,[data-mermaid-placeholder],[data-mermaid-rendered]',
      options.mermaidAdapter,
    ],
    [
      'latex',
      '.markdown-renderer__latex,[data-latex-placeholder],[data-latex-rendered]',
      options.latexAdapter,
    ],
    [
      'code-highlight',
      'pre code[class*="language-"]',
      options.codeHighlightAdapter,
    ],
  ] as const) {
    if (
      (kind === 'mermaid' && !features.mermaid) ||
      (kind === 'latex' && !features.latex) ||
      (kind === 'code-highlight' && !features.codeHighlight)
    ) {
      continue
    }

    try {
      const result = await markElements(options.root, selector, kind, adapter, {
        baseUrl: options.baseUrl,
        cspNonce: options.cspNonce,
        kind,
        root: options.root,
        theme,
      })
      pushActivation(activated, kind, result.count)
      errors.push(...result.errors)
    } catch (error) {
      errors.push(createActivationError(kind, error))
    }
  }

  return { activated, errors }
}

type MarkdownModule = {
  HEAPU8: Uint8Array
  memory?: WebAssembly.Memory
  _markdown_render?: (
    ptr: number,
    len: number,
    allowHtml: number,
    allowLatex: number,
    allowMermaid: number,
  ) => number
  _markdown_render_profile?: (
    ptr: number,
    len: number,
    allowHtml: number,
    allowLatex: number,
    allowMermaid: number,
    payloadMode: number,
  ) => number
  _markdown_get_last_html_ptr?: () => number
  _markdown_get_last_html_len?: () => number
  _markdown_get_last_error_ptr?: () => number
  _markdown_get_last_error_len?: () => number
  _markdown_get_last_error_code?: () => number
  _markdown_get_last_features_ptr?: () => number
  _markdown_get_last_features_len?: () => number
  _markdown_get_last_placeholders_ptr?: () => number
  _markdown_get_last_placeholders_len?: () => number
  _markdown_get_last_chunks_ptr?: () => number
  _markdown_get_last_chunks_len?: () => number
  _markdown_get_last_renderer_version_ptr?: () => number
  _markdown_get_last_renderer_version_len?: () => number
  _markdown_get_last_metadata_ptr?: () => number
  _markdown_get_last_metadata_len?: () => number
  _markdown_alloc_buffer?: (size: number) => number
  _markdown_free_buffer?: (ptr: number) => void
}

type MarkdownModuleFactoryResult = MarkdownModule & Record<string, unknown>

let runtimeModule: MarkdownModuleFactoryResult | null = null
let runtimePromise: Promise<{
  module: MarkdownModuleFactoryResult | null
  engine: MarkdownRuntimeKind
}> | null = null
let runtimeEngine: MarkdownRuntimeKind = 'UNKNOWN'
const withMarkdownRuntimeLock = createSerializedExecutor()

function supportsSimdMarkdown(): boolean {
  try {
    const simdProbe = new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10,
      1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ])
    return WebAssembly.validate(simdProbe)
  } catch {
    return false
  }
}

function resolveMarkdownAssetKind(): MarkdownAssetKind {
  return supportsSimdMarkdown() ? 'simd' : 'basic'
}

function pickExport<T>(raw: Record<string, unknown>, ...names: string[]): T {
  for (const name of names) {
    const direct = raw[name]
    if (direct) {
      return direct as T
    }

    const underscored = raw[`_${name}`]
    if (underscored) {
      return underscored as T
    }
  }

  throw createMarkdownRuntimeError(
    'invariant',
    `wasm_export_missing:${names[0] ?? 'unknown'}`,
  )
}

function mapMarkdownErrorCode(
  code: number,
  fallback: string,
): MarkdownRuntimeErrorCode {
  switch (code) {
    case 1:
      return 'protocol'
    default:
      if (fallback.includes('source') || fallback.includes('input')) {
        return 'protocol'
      }
      return 'infra'
  }
}

async function initMarkdownRuntimeModule(): Promise<{
  module: MarkdownModuleFactoryResult | null
  engine: MarkdownRuntimeKind
}> {
  if (runtimeModule) {
    return { module: runtimeModule, engine: runtimeEngine }
  }

  if (!runtimePromise) {
    runtimePromise = (async () => {
      const assetKind = resolveMarkdownAssetKind()
      const engine: MarkdownRuntimeKind =
        assetKind === 'simd' ? 'SIMD-128' : 'SCALAR-BASIC'
      const asset = resolveMarkdownAsset(assetKind)
      const module = await loadEmscriptenModule<MarkdownModuleFactoryResult>(
        asset.moduleUrl,
        'createMarkdownModule',
        asset.wasmUrl,
      )

      if (!module) {
        return { module: null, engine }
      }

      const raw = module as unknown as Record<string, unknown>
      runtimeModule = module
      Object.assign(runtimeModule, {
        _markdown_render: pickExport<
          (
            ptr: number,
            len: number,
            allowHtml: number,
            allowLatex: number,
            allowMermaid: number,
          ) => number
        >(raw, 'markdown_render', 'render_markdown'),
        _markdown_render_profile: pickExport<
          (
            ptr: number,
            len: number,
            allowHtml: number,
            allowLatex: number,
            allowMermaid: number,
            payloadMode: number,
          ) => number
        >(raw, 'markdown_render_profile'),
        _markdown_get_last_html_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_html_ptr',
          'get_last_html_ptr',
        ),
        _markdown_get_last_html_len: pickExport<() => number>(
          raw,
          'markdown_get_last_html_len',
          'get_last_html_len',
        ),
        _markdown_get_last_error_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_error_ptr',
          'get_last_error_ptr',
        ),
        _markdown_get_last_error_len: pickExport<() => number>(
          raw,
          'markdown_get_last_error_len',
          'get_last_error_len',
        ),
        _markdown_get_last_error_code: pickExport<() => number>(
          raw,
          'markdown_get_last_error_code',
          'get_last_error_code',
        ),
        _markdown_get_last_features_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_features_ptr',
          'get_last_features_ptr',
        ),
        _markdown_get_last_features_len: pickExport<() => number>(
          raw,
          'markdown_get_last_features_len',
          'get_last_features_len',
        ),
        _markdown_get_last_placeholders_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_placeholders_ptr',
          'get_last_placeholders_ptr',
        ),
        _markdown_get_last_placeholders_len: pickExport<() => number>(
          raw,
          'markdown_get_last_placeholders_len',
          'get_last_placeholders_len',
        ),
        _markdown_get_last_chunks_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_chunks_ptr',
          'get_last_chunks_ptr',
        ),
        _markdown_get_last_chunks_len: pickExport<() => number>(
          raw,
          'markdown_get_last_chunks_len',
          'get_last_chunks_len',
        ),
        _markdown_get_last_renderer_version_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_renderer_version_ptr',
          'get_last_renderer_version_ptr',
        ),
        _markdown_get_last_renderer_version_len: pickExport<() => number>(
          raw,
          'markdown_get_last_renderer_version_len',
          'get_last_renderer_version_len',
        ),
        _markdown_get_last_metadata_ptr: pickExport<() => number>(
          raw,
          'markdown_get_last_metadata_ptr',
          'get_last_metadata_ptr',
        ),
        _markdown_get_last_metadata_len: pickExport<() => number>(
          raw,
          'markdown_get_last_metadata_len',
          'get_last_metadata_len',
        ),
        _markdown_alloc_buffer: pickExport<(size: number) => number>(
          raw,
          'markdown_alloc_buffer',
          'alloc_buffer',
        ),
        _markdown_free_buffer: pickExport<(ptr: number) => void>(
          raw,
          'markdown_free_buffer',
          'free_buffer',
        ),
      })
      runtimeEngine = engine

      return { module: runtimeModule, engine }
    })().catch(() => ({
      module: null,
      engine: 'UNKNOWN' as MarkdownRuntimeKind,
    }))
  }

  return await runtimePromise
}

function readCString(
  memory: WebAssembly.Memory,
  ptr: number,
  len: number,
): string {
  if (ptr <= 0 || len <= 0) {
    return ''
  }

  const view = new Uint8Array(memory.buffer, ptr, len)
  return decodeUtf8(view)
}

function resolveModuleMemory(
  module: MarkdownModuleFactoryResult,
): WebAssembly.Memory | null {
  if (module.memory) {
    return module.memory
  }

  const heapBuffer = module.HEAPU8?.buffer
  if (!heapBuffer) {
    return null
  }

  return { buffer: heapBuffer } as WebAssembly.Memory
}

function readStructured<T>(
  memory: WebAssembly.Memory,
  ptr: number,
  len: number,
  fallback: T,
): T {
  const raw = readCString(memory, ptr, len)
  if (!raw) {
    return fallback
  }

  try {
    return parseStructuredText(raw) as T
  } catch {
    return fallback
  }
}

function parseStructuredText(raw: string): unknown {
  const source = raw.trim()
  if (!source) return null

  try {
    return JSON.parse(source)
  } catch {
    return parseStructuredTextFallback(source)
  }
}

function parseStructuredTextFallback(source: string): unknown {
  let offset = 0
  const skipWhitespace = () => {
    while (/\s/u.test(source[offset] ?? '')) offset += 1
  }
  const parseValue = (): unknown => {
    skipWhitespace()
    const char = source[offset]
    if (char === '"') return parseString()
    if (char === '[') return parseArray()
    if (char === '{') return parseObject()
    if (source.startsWith('true', offset)) {
      offset += 4
      return true
    }
    if (source.startsWith('false', offset)) {
      offset += 5
      return false
    }
    if (source.startsWith('null', offset)) {
      offset += 4
      return null
    }
    return parseNumber()
  }
  const parseString = (): string => {
    offset += 1
    let value = ''
    while (offset < source.length) {
      const char = source[offset++]
      if (char === '"') return value
      if (char !== '\\') {
        value += char
        continue
      }
      const escaped = source[offset++]
      if (escaped === 'n') value += '\n'
      else if (escaped === 'r') value += '\r'
      else if (escaped === 't') value += '\t'
      else if (escaped === 'b') value += '\b'
      else if (escaped === 'f') value += '\f'
      else if (escaped === 'u') {
        value += String.fromCharCode(
          Number.parseInt(source.slice(offset, offset + 4), 16),
        )
        offset += 4
      } else {
        value += escaped
      }
    }
    throw createMarkdownRuntimeError('protocol', 'structured_string_unclosed')
  }
  const parseArray = (): unknown[] => {
    offset += 1
    const values: unknown[] = []
    skipWhitespace()
    if (source[offset] === ']') {
      offset += 1
      return values
    }
    while (offset < source.length) {
      values.push(parseValue())
      skipWhitespace()
      if (source[offset] === ']') {
        offset += 1
        return values
      }
      if (source[offset++] !== ',')
        throw createMarkdownRuntimeError(
          'protocol',
          'structured_array_separator_invalid',
        )
    }
    throw createMarkdownRuntimeError('protocol', 'structured_array_unclosed')
  }
  const parseObject = (): Record<string, unknown> => {
    offset += 1
    const value: Record<string, unknown> = {}
    skipWhitespace()
    if (source[offset] === '}') {
      offset += 1
      return value
    }
    while (offset < source.length) {
      const key = parseString()
      skipWhitespace()
      if (source[offset++] !== ':')
        throw createMarkdownRuntimeError(
          'protocol',
          'structured_object_separator_invalid',
        )
      value[key] = parseValue()
      skipWhitespace()
      if (source[offset] === '}') {
        offset += 1
        return value
      }
      if (source[offset++] !== ',')
        throw createMarkdownRuntimeError(
          'protocol',
          'structured_object_entry_invalid',
        )
      skipWhitespace()
    }
    throw createMarkdownRuntimeError('protocol', 'structured_object_unclosed')
  }
  const parseNumber = (): number => {
    const start = offset
    while (/[-+0-9.eE]/u.test(source[offset] ?? '')) offset += 1
    const value = Number(source.slice(start, offset))
    if (!Number.isFinite(value))
      throw createMarkdownRuntimeError('protocol', 'structured_number_invalid')
    return value
  }
  const value = parseValue()
  skipWhitespace()
  if (offset !== source.length)
    throw createMarkdownRuntimeError('protocol', 'structured_trailing_data')
  return value
}
export async function initMarkdownRuntime(): Promise<
  FsusResult<MarkdownRuntimeKind>
> {
  try {
    const result = await initMarkdownRuntimeModule()
    if (!result.module) {
      return fsusErr(
        createFsusRuntimeError('infra', 'markdown_wasm_runtime_unavailable'),
      )
    }
    return fsusOk(result.engine)
  } catch (error) {
    return fsusErr(
      markdownErrorToFsusError(error, 'markdown_wasm_runtime_init_failed'),
    )
  }
}

const now = () => {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now()
  }
  return Date.now()
}

const roundMs = (value: number) => Math.round(value * 100) / 100

const createTimings = (): MarkdownRenderTimings => ({
  initMs: 0,
  encodeMs: 0,
  wasmRenderMs: 0,
  readHtmlMs: 0,
  readFeaturesMs: 0,
  readPlaceholdersMs: 0,
  readMetadataMs: 0,
  totalMs: 0,
})

const finalizeTimings = (timings: MarkdownRenderTimings, startedAt: number) => {
  timings.totalMs = roundMs(now() - startedAt)
  timings.initMs = roundMs(timings.initMs)
  timings.encodeMs = roundMs(timings.encodeMs)
  timings.wasmRenderMs = roundMs(timings.wasmRenderMs)
  timings.readHtmlMs = roundMs(timings.readHtmlMs)
  timings.readFeaturesMs = roundMs(timings.readFeaturesMs)
  timings.readPlaceholdersMs = roundMs(timings.readPlaceholdersMs)
  timings.readMetadataMs = roundMs(timings.readMetadataMs)
  return timings
}

type MarkdownPayloadMode = 'html-only' | 'summary' | 'full-result' | 'chunks'

const payloadModeToWasmMode = (mode: MarkdownPayloadMode) => {
  if (mode === 'chunks') return 3
  if (mode === 'html-only') return 2
  if (mode === 'summary') return 1
  return 0
}

const buildDefaultMetadata = (
  payload: MarkdownRenderRequest,
  source: string,
  features: readonly MarkdownRenderFeature[],
  placeholderCount: number,
  rendererVersion: string,
): MarkdownRenderMetadata => ({
  mode: payload.mode ?? 'article',
  baseUrl: payload.baseUrl ?? null,
  allowHtml: !!payload.allowHtml,
  allowLatex: payload.allowLatex !== false,
  allowMermaid: payload.allowMermaid !== false,
  sourceLength: source.length,
  featureCount: features.length,
  placeholderCount,
  rendererVersion,
})

type MarkdownRuntimePayloadResult =
  | MarkdownRuntimeHtmlResult
  | MarkdownRuntimeSummaryResult
  | MarkdownRuntimeRenderResult
  | MarkdownRuntimeChunkResult

async function renderMarkdownPayloadWithRuntime(
  request: MarkdownRenderRequest | string,
  payloadMode: MarkdownPayloadMode,
): Promise<MarkdownRuntimePayloadResult | null> {
  return await withMarkdownRuntimeLock(async () => {
    const startedAt = now()
    const timings = createTimings()
    const payload = typeof request === 'string' ? { source: request } : request
    const source = normalizeMarkdownSource(payload.source)

    const initStartedAt = now()
    const { module, engine } = await initMarkdownRuntimeModule()
    timings.initMs = now() - initStartedAt

    if (!module) {
      return null
    }

    const alloc = module._markdown_alloc_buffer
    const free = module._markdown_free_buffer
    const render = module._markdown_render_profile ?? module._markdown_render
    const getHtmlPtr = module._markdown_get_last_html_ptr
    const getHtmlLen = module._markdown_get_last_html_len
    const getErrorPtr = module._markdown_get_last_error_ptr
    const getErrorLen = module._markdown_get_last_error_len
    const getErrorCode = module._markdown_get_last_error_code
    const getFeaturesPtr = module._markdown_get_last_features_ptr
    const getFeaturesLen = module._markdown_get_last_features_len
    const getPlaceholdersPtr = module._markdown_get_last_placeholders_ptr
    const getPlaceholdersLen = module._markdown_get_last_placeholders_len
    const getChunksPtr = module._markdown_get_last_chunks_ptr
    const getChunksLen = module._markdown_get_last_chunks_len
    const getRendererVersionPtr = module._markdown_get_last_renderer_version_ptr
    const getRendererVersionLen = module._markdown_get_last_renderer_version_len
    const getMetadataPtr = module._markdown_get_last_metadata_ptr
    const getMetadataLen = module._markdown_get_last_metadata_len

    if (
      !alloc ||
      !free ||
      !render ||
      !getHtmlPtr ||
      !getHtmlLen ||
      !getErrorPtr ||
      !getErrorLen ||
      !getErrorCode ||
      !getFeaturesPtr ||
      !getFeaturesLen ||
      !getPlaceholdersPtr ||
      !getPlaceholdersLen ||
      !getChunksPtr ||
      !getChunksLen ||
      !getRendererVersionPtr ||
      !getRendererVersionLen ||
      !getMetadataPtr ||
      !getMetadataLen
    ) {
      return null
    }

    const encodeStartedAt = now()
    const bytes = encodeUtf8(source)
    const ptr = alloc(bytes.byteLength)
    if (ptr <= 0) {
      return null
    }

    try {
      module.HEAPU8.set(bytes, ptr)
      timings.encodeMs = now() - encodeStartedAt

      const renderStartedAt = now()
      const ok =
        render === module._markdown_render_profile
          ? module._markdown_render_profile(
              ptr,
              bytes.byteLength,
              payload.allowHtml ? 1 : 0,
              payload.allowLatex === false ? 0 : 1,
              payload.allowMermaid === false ? 0 : 1,
              payloadModeToWasmMode(payloadMode),
            )
          : module._markdown_render?.(
              ptr,
              bytes.byteLength,
              payload.allowHtml ? 1 : 0,
              payload.allowLatex === false ? 0 : 1,
              payload.allowMermaid === false ? 0 : 1,
            )
      timings.wasmRenderMs = now() - renderStartedAt

      const memory = resolveModuleMemory(module)
      if (!memory) {
        return null
      }
      if (ok !== 1) {
        const error = readCString(memory, getErrorPtr(), getErrorLen())
        if (error) {
          throw createMarkdownRuntimeError(
            mapMarkdownErrorCode(getErrorCode(), error),
            `markdown_wasm_render_failed:${error}`,
          )
        }
        return null
      }

      const htmlStartedAt = now()
      const html = readCString(memory, getHtmlPtr(), getHtmlLen())
      timings.readHtmlMs = now() - htmlStartedAt

      const metadataStartedAt = now()
      const rendererVersion =
        readCString(memory, getRendererVersionPtr(), getRendererVersionLen()) ||
        MARKDOWN_RENDERER_VERSION
      timings.readMetadataMs = now() - metadataStartedAt

      if (payloadMode === 'html-only') {
        return {
          html,
          engine,
          rendererVersion,
          timings: finalizeTimings(timings, startedAt),
        }
      }

      const featuresStartedAt = now()
      const features = readStructured<MarkdownRenderResult['features']>(
        memory,
        getFeaturesPtr(),
        getFeaturesLen(),
        [],
      )
      timings.readFeaturesMs = now() - featuresStartedAt

      const metadataReadStartedAt = now()
      const metadata = readStructured<MarkdownRenderMetadata>(
        memory,
        getMetadataPtr(),
        getMetadataLen(),
        buildDefaultMetadata(payload, source, features, 0, rendererVersion),
      )
      timings.readMetadataMs += now() - metadataReadStartedAt

      if (payloadMode === 'summary') {
        return {
          html,
          engine,
          features,
          metadata,
          rendererVersion,
          timings: finalizeTimings(timings, startedAt),
        }
      }

      const placeholdersStartedAt = now()
      const placeholders = readStructured<MarkdownRenderPlaceholder[]>(
        memory,
        getPlaceholdersPtr(),
        getPlaceholdersLen(),
        [],
      )
      timings.readPlaceholdersMs = now() - placeholdersStartedAt

      if (payloadMode === 'chunks') {
        const chunks = readStructured<MarkdownRenderChunk[]>(
          memory,
          getChunksPtr(),
          getChunksLen(),
          [],
        )
        return {
          ...buildMarkdownRenderResult({
            html,
            source,
            features,
            placeholders,
            rendererVersion,
            metadata,
          }),
          chunks,
          engine,
          timings: finalizeTimings(timings, startedAt),
        }
      }

      return {
        ...buildMarkdownRenderResult({
          html,
          source,
          features,
          placeholders,
          rendererVersion,
          metadata,
        }),
        engine,
        timings: finalizeTimings(timings, startedAt),
      }
    } finally {
      free(ptr)
    }
  })
}

export async function renderMarkdownHtmlWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownRuntimeHtmlResult>> {
  try {
    const result = (await renderMarkdownPayloadWithRuntime(
      request,
      'html-only',
    )) as MarkdownRuntimeHtmlResult | null
    return result
      ? fsusOk(result)
      : fsusErr(
          createFsusRuntimeError('infra', 'markdown_wasm_runtime_unavailable'),
        )
  } catch (error) {
    return fsusErr(
      markdownErrorToFsusError(error, 'markdown_wasm_html_render_failed'),
    )
  }
}

export async function renderMarkdownSummaryWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownRuntimeSummaryResult>> {
  try {
    const result = (await renderMarkdownPayloadWithRuntime(
      request,
      'summary',
    )) as MarkdownRuntimeSummaryResult | null
    return result
      ? fsusOk(result)
      : fsusErr(
          createFsusRuntimeError('infra', 'markdown_wasm_runtime_unavailable'),
        )
  } catch (error) {
    return fsusErr(
      markdownErrorToFsusError(error, 'markdown_wasm_summary_render_failed'),
    )
  }
}

export async function renderMarkdownWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<string>> {
  const result = await renderMarkdownHtmlWithRuntime(request)
  return isFsusErr(result) ? fsusErr(result.error) : fsusOk(result.value.html)
}

export async function renderMarkdownResultWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownRuntimeRenderResult>> {
  try {
    const result = (await renderMarkdownPayloadWithRuntime(
      request,
      'full-result',
    )) as MarkdownRuntimeRenderResult | null
    return result
      ? fsusOk(result)
      : fsusErr(
          createFsusRuntimeError('infra', 'markdown_wasm_runtime_unavailable'),
        )
  } catch (error) {
    return fsusErr(
      markdownErrorToFsusError(error, 'markdown_wasm_full_render_failed'),
    )
  }
}

export async function renderMarkdownChunksWithRuntime(
  request: MarkdownRenderRequest | string,
): Promise<FsusResult<MarkdownRuntimeChunkResult>> {
  try {
    const result = (await renderMarkdownPayloadWithRuntime(
      request,
      'chunks',
    )) as MarkdownRuntimeChunkResult | null
    return result
      ? fsusOk(result)
      : fsusErr(
          createFsusRuntimeError('infra', 'markdown_wasm_runtime_unavailable'),
        )
  } catch (error) {
    return fsusErr(
      markdownErrorToFsusError(error, 'markdown_wasm_chunks_render_failed'),
    )
  }
}

export { MARKDOWN_RENDERER_VERSION }
