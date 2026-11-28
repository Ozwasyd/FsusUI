import type { KatexRuntime, MermaidRuntime } from '../markdown-heavy-runtime-loaders'
import type {
  FeatureRenderOutput,
  MarkdownFeatureOutputCommitOptions,
  MarkdownFeatureOutputKind,
} from '../markdown-feature-output-gateway'
import type {
  MarkdownHeavyFeatureIsolatedRenderFactory,
  MarkdownHeavyFeatureIsolatedRenderRequest,
} from '../markdown-heavy-feature-resource'
import { createMarkdownRuntimeError } from './markdown-result-authority'

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

type MarkdownHeavyFeatureKind = 'code-highlight' | 'latex' | 'mermaid'

interface MarkdownHeavyFeatureIdentity {
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

interface MarkdownHeavyFeatureLifecycle {
  readonly activate: <T>(input: {
    readonly commit: (
      value: T,
      signal: AbortSignal,
    ) => HTMLElement | void | Promise<HTMLElement | void>
    readonly element: HTMLElement
    readonly estimateBytes: (value: T) => number
    readonly identity: MarkdownHeavyFeatureIdentity
    readonly render: (signal: AbortSignal) => Promise<T>
    readonly resources?: Readonly<{
      listeners?: number
      observers?: number
      runtimes?: number
      tasks?: number
    }>
    readonly signal?: AbortSignal
    readonly teardown?: () => void
  }) => Promise<boolean>
  mountStatic: (input: {
    readonly element: HTMLElement
    readonly identity: MarkdownHeavyFeatureIdentity
  }) => boolean
}

export type MarkdownFeatureActivationTheme = 'dark' | 'light'

export interface MarkdownFeatureThemeTokens {
  readonly background: string
  readonly danger: string
  readonly edgeLabelBackground: string
  readonly lineColor: string
  readonly mainBackground: string
  readonly nodeBorder: string
  readonly primaryBorderColor: string
  readonly primaryColor: string
  readonly primaryTextColor: string
  readonly secondaryColor: string
  readonly tertiaryColor: string
}

export interface MarkdownFeatureRenderContext {
  readonly signal?: AbortSignal
  readonly theme: MarkdownFeatureActivationTheme
  readonly tokens: Readonly<MarkdownFeatureThemeTokens>
}

export interface MarkdownFeatureActivationOptions {
  baseUrl?: string | null
  concurrency?: number
  cspNonce?: string | null
  features?: MarkdownFeatureActivationFeatureOptions
  root: ParentNode
  signal?: AbortSignal
}

interface MarkdownHeavyFeatureActivationOptions
  extends MarkdownFeatureActivationOptions {
  readonly heavyLifecycle?: MarkdownHeavyFeatureLifecycle
  readonly isolatedRenderFactory?: MarkdownHeavyFeatureIsolatedRenderFactory
  readonly resolveHeavyFeatureIdentity?: (input: {
    readonly element: HTMLElement
    readonly kind: MarkdownHeavyFeatureKind
    readonly source: string
    readonly theme: MarkdownFeatureActivationTheme
    readonly tokens: Readonly<MarkdownFeatureThemeTokens>
  }) => MarkdownHeavyFeatureIdentity | null
  readonly scheduleHeavyFeatureCommit?: (input: {
    readonly key: string
    readonly run: () => HTMLElement | void
    readonly signal: AbortSignal
  }) => Promise<HTMLElement | void>
}

export type { FeatureRenderOutput }

type MarkdownFeatureOutputGateway = Readonly<{
  commitMarkdownFeatureOutput: (
    target: HTMLElement,
    output: FeatureRenderOutput,
    options?: MarkdownFeatureOutputCommitOptions,
  ) => HTMLElement
}>

let markdownFeatureOutputGatewayPromise: Promise<MarkdownFeatureOutputGateway> | null =
  null

const loadMarkdownFeatureOutputGateway = () => {
  markdownFeatureOutputGatewayPromise ??= import(
    '../markdown-feature-output-gateway'
  )
  return markdownFeatureOutputGatewayPromise
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
  style: CSSStyleDeclaration | null,
  token: string,
  fallback: string,
) => {
  if (!style) return fallback
  const value = style.getPropertyValue(token).trim()
  if (
    !value ||
    value.length > 128 ||
    /[;{}@\\]|\/\*|\*\//u.test(value) ||
    !(
      /^#[0-9a-f]{3,8}$/iu.test(value) ||
      /^[a-z]+$/iu.test(value) ||
      /^(?:color|color-mix|hsl|hsla|lab|lch|oklab|oklch|rgb|rgba)\([0-9a-z.%+\-,/\s]+\)$/iu.test(
        value,
      )
    )
  ) {
    return fallback
  }
  return value
}

const getFeatureStyleRoot = (element: HTMLElement, root: ParentNode) =>
  getRootElement(root) ?? element.ownerDocument.documentElement

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
  element.className = 'fsus-markdown-renderer__feature-error'
  element.setAttribute('role', 'note')
  element.dataset.markdownFeatureError = kind

  const message = document.createElement(inline ? 'span' : 'p')
  message.className = 'fsus-markdown-renderer__feature-error-message'
  message.textContent = formatFeatureErrorMessage(kind, error)
  element.append(message)

  if (source) {
    const code = document.createElement('code')
    code.textContent = source
    element.append(code)
  }

  return element
}

const CANONICAL_BLOCK_ANCHOR_ID = /^[a-z][a-z0-9-]{0,63}$/u

const renderFeatureError = (
  element: HTMLElement,
  kind: MarkdownFeatureActivationKind,
  error: unknown,
  source?: string,
  replace = false,
) => {
  const inline = element.tagName === 'SPAN' || element.tagName === 'CODE'
  const errorElement = createFeatureErrorElement(
    element.ownerDocument,
    kind,
    error,
    source,
    inline,
  )
  if (replace) {
    const preservedId = element.id
    if (CANONICAL_BLOCK_ANCHOR_ID.test(preservedId)) {
      errorElement.id = preservedId
    }
    element.replaceWith(errorElement)
    return
  }
  element.replaceChildren(errorElement)
  element.dataset.markdownFeatureError = kind
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

type GlobalMermaidRuntime = typeof globalThis & {
  mermaid?: MermaidRuntime | { default?: MermaidRuntime }
}

const resolveDefaultModule = <T>(module: T | { default?: T }) =>
  'default' in (module as Record<string, unknown>) &&
  (module as { default?: T }).default
    ? (module as { default: T }).default
    : (module as T)

export interface MarkdownHeavyRuntimeLoadersOverride {
  readonly loadKatexRuntime?: () => Promise<KatexRuntime>
  readonly loadMermaidRuntime?: () => Promise<MermaidRuntime>
  readonly renderCodeHighlightFeature?: (
    source: string,
    language: string,
    context: MarkdownFeatureRenderContext,
  ) => Promise<FeatureRenderOutput>
}

let heavyRuntimeLoadersOverride: MarkdownHeavyRuntimeLoadersOverride | null =
  null

export const setMarkdownHeavyRuntimeLoadersOverride = (
  override: MarkdownHeavyRuntimeLoadersOverride | null,
) => {
  heavyRuntimeLoadersOverride = override
}

// Loader caches and optional-runtime setup are needed only by heavy features,
// never by initial Markdown hydration or the synchronous DOM safety pass.
const loadMermaidRuntime = async () => {
  const globalMermaid = (globalThis as GlobalMermaidRuntime).mermaid
  if (globalMermaid) return resolveDefaultModule<MermaidRuntime>(globalMermaid)
  if (heavyRuntimeLoadersOverride?.loadMermaidRuntime) {
    return heavyRuntimeLoadersOverride.loadMermaidRuntime()
  }
  return (await import('../markdown-heavy-runtime-loaders')).loadMermaidRuntime()
}

const loadKatexRuntime = async () => {
  if (heavyRuntimeLoadersOverride?.loadKatexRuntime) {
    return heavyRuntimeLoadersOverride.loadKatexRuntime()
  }
  return (await import('../markdown-heavy-runtime-loaders')).loadKatexRuntime()
}

let markdownMermaidRenderId = 0

const resolveMarkdownFeatureThemeTokens = (
  element: HTMLElement,
  root: ParentNode,
): MarkdownFeatureThemeTokens => {
  const styleRoot = getFeatureStyleRoot(element, root)
  const style =
    styleRoot && typeof window !== 'undefined'
      ? window.getComputedStyle(styleRoot)
      : null
  return Object.freeze({
    background: getComputedToken(style, '--fsus-color-surface-base', '#ffffff'),
    danger: getComputedToken(style, '--fsus-color-status-danger', '#d92d20'),
    edgeLabelBackground: getComputedToken(
      style,
      '--fsus-color-surface-overlay',
      '#ffffff',
    ),
    lineColor: getComputedToken(style, '--fsus-color-border-subtle', '#e4e4e7'),
    mainBackground: getComputedToken(style, '--fsus-color-fill-light', '#fafafa'),
    nodeBorder: getComputedToken(style, '--fsus-color-action-primary', '#2a599c'),
    primaryBorderColor: getComputedToken(
      style,
      '--fsus-color-action-primary',
      '#2a599c',
    ),
    primaryColor: getComputedToken(style, '--fsus-color-fill-light', '#fafafa'),
    primaryTextColor: getComputedToken(
      style,
      '--fsus-color-text-primary',
      '#0f0f11',
    ),
    secondaryColor: getComputedToken(style, '--fsus-color-surface-base', '#ffffff'),
    tertiaryColor: getComputedToken(
      style,
      '--fsus-color-fill-lighter',
      '#fcfcfc',
    ),
  })
}

const renderMermaidFeature = async (
  source: string,
  context: MarkdownFeatureRenderContext,
): Promise<FeatureRenderOutput> => {
  const mermaid = await loadMermaidRuntime()
  if (context.signal?.aborted) {
    throw createMarkdownRuntimeError('infra', 'mermaid_render_aborted')
  }
  if (typeof mermaid.render !== 'function') {
    throw createMarkdownRuntimeError('infra', 'mermaid_render_unavailable')
  }

  mermaid.initialize?.({
    htmlLabels: false,
    securityLevel: 'strict',
    startOnLoad: false,
    theme: context.theme === 'dark' ? 'dark' : 'default',
    themeVariables: {
      background: context.tokens.background,
      edgeLabelBackground: context.tokens.edgeLabelBackground,
      lineColor: context.tokens.lineColor,
      mainBkg: context.tokens.mainBackground,
      nodeBorder: context.tokens.nodeBorder,
      primaryBorderColor: context.tokens.primaryBorderColor,
      primaryColor: context.tokens.primaryColor,
      primaryTextColor: context.tokens.primaryTextColor,
      secondaryColor: context.tokens.secondaryColor,
      tertiaryColor: context.tokens.tertiaryColor,
    },
  })

  const renderId = `fsus-markdown-mermaid-${++markdownMermaidRenderId}`
  const rendered = await mermaid.render(renderId, source)
  if (context.signal?.aborted) {
    throw createMarkdownRuntimeError('infra', 'mermaid_render_aborted')
  }
  return Object.freeze({
    kind: 'mermaid',
    payload:
      typeof rendered === 'string'
        ? rendered
        : (rendered as { svg: string }).svg,
    rootId: renderId,
  })
}

const isBlockLatexElement = (element: HTMLElement) =>
  element.tagName === 'DIV' ||
  element.tagName === 'FIGURE' ||
  element.dataset.latexDisplay === 'block'

const renderLatexFeature = async (
  source: string,
  context: MarkdownFeatureRenderContext,
  displayMode: boolean,
): Promise<FeatureRenderOutput> => {
  const katex = await loadKatexRuntime()
  if (context.signal?.aborted) {
    throw createMarkdownRuntimeError('infra', 'katex_render_aborted')
  }
  if (typeof katex.renderToString !== 'function') {
    throw createMarkdownRuntimeError('infra', 'katex_render_unavailable')
  }

  const payload = katex.renderToString(source, {
    displayMode,
    errorColor: context.tokens.danger,
    output: 'mathml',
    throwOnError: false,
    trust: false,
  })
  if (context.signal?.aborted) {
    throw createMarkdownRuntimeError('infra', 'katex_render_aborted')
  }
  return Object.freeze({ kind: 'latex', payload })
}

export const MARKDOWN_CODE_LANGUAGE_ALIASES = Object.freeze({
  csharp: 'c#',
  cs: 'c#',
  javascript: 'js',
  typescript: 'ts',
  shell: 'bash',
  sh: 'bash',
} as const)

export const MARKDOWN_CODE_LANGUAGES = Object.freeze([
  'bash',
  'c#',
  'js',
  'text',
  'ts',
] as const)

export type MarkdownCodeLanguage = (typeof MARKDOWN_CODE_LANGUAGES)[number]

const markdownCodeLanguageAvailability = Object.fromEntries(
  MARKDOWN_CODE_LANGUAGES.map((language) => [language, true]),
)

export const normalizeMarkdownCodeLanguage = (language: string | undefined) => {
  if (!language) return 'text'
  const normalized = language.trim().toLowerCase()
  return (
    MARKDOWN_CODE_LANGUAGE_ALIASES[
      normalized as keyof typeof MARKDOWN_CODE_LANGUAGE_ALIASES
    ] ?? normalized
  )
}

export const resolveMarkdownCodeLanguageAvailability = (
  language: string | undefined,
) => {
  const info = language ?? ''
  const canonical = normalizeMarkdownCodeLanguage(language)
  const available = canonical in markdownCodeLanguageAvailability
  return Object.freeze({
    available,
    canonical: available ? canonical : 'text',
    fallback: available ? ('none' as const) : ('plain' as const),
    info,
  })
}

const extractCodeLanguage = (element: HTMLElement) => {
  for (const className of Array.from(element.classList)) {
    const match = /^language-(.+)$/i.exec(className)
    if (match?.[1]) return normalizeMarkdownCodeLanguage(match[1])
  }
  return 'text'
}

const renderCodeHighlightFeature = async (
  source: string,
  language: string,
  context: MarkdownFeatureRenderContext,
): Promise<FeatureRenderOutput> => {
  if (heavyRuntimeLoadersOverride?.renderCodeHighlightFeature) {
    return heavyRuntimeLoadersOverride.renderCodeHighlightFeature(
      source,
      language,
      context,
    )
  }
  return (
    await import('../markdown-heavy-runtime-loaders')
  ).renderCodeHighlightFeature(source, language, context)
}

interface MarkdownFeatureActivationContext
  extends Omit<MarkdownFeatureRenderContext, 'tokens'> {
  readonly cspNonce?: string | null
  readonly kind: Extract<
    MarkdownFeatureActivationKind,
    MarkdownFeatureOutputKind
  >
  readonly resolveTokens: (
    element: HTMLElement,
  ) => Readonly<MarkdownFeatureThemeTokens>
  readonly root: ParentNode
  readonly heavyLifecycle?: MarkdownHeavyFeatureLifecycle
  readonly isolatedRenderFactory?: MarkdownHeavyFeatureIsolatedRenderFactory
  readonly resolveHeavyFeatureIdentity?: MarkdownHeavyFeatureActivationOptions['resolveHeavyFeatureIdentity']
  readonly scheduleHeavyFeatureCommit?: MarkdownHeavyFeatureActivationOptions['scheduleHeavyFeatureCommit']
}

const toFeatureRenderContext = (
  context: MarkdownFeatureActivationContext,
  element: HTMLElement,
): MarkdownFeatureRenderContext =>
  Object.freeze({
    signal: context.signal,
    theme: context.theme,
    tokens: context.resolveTokens(element),
  })

const estimateFeatureOutputBytes = (output: FeatureRenderOutput) =>
  output.payload.length * 2 +
  (output.kind === 'mermaid' ? output.rootId.length * 2 : 0)

const activateHeavyFeature = async (input: {
  readonly commit: (output: FeatureRenderOutput) => HTMLElement | void
  readonly context: MarkdownFeatureActivationContext
  readonly element: HTMLElement
  readonly render: (
    signal: AbortSignal | undefined,
  ) => Promise<FeatureRenderOutput>
  readonly isolatedRequest: MarkdownHeavyFeatureIsolatedRenderRequest
  readonly source: string
}) => {
  const identity = input.context.resolveHeavyFeatureIdentity?.({
    element: input.element,
    kind: input.context.kind,
    source: input.source,
    theme: input.context.theme,
    tokens: input.context.resolveTokens(input.element),
  })
  if (!input.context.heavyLifecycle) {
    const output = await input.render(input.context.signal)
    if (input.context.signal?.aborted) return false
    input.commit(output)
    return true
  }
  if (!identity) return false
  const isolatedRequest = Object.freeze({
    ...input.isolatedRequest,
    lifecycleKey: [
      identity.documentKey,
      identity.documentEpoch,
      identity.nodeId,
      identity.featureKind,
    ].join(':'),
  })
  const {
    assertMarkdownHeavyFeatureAdapterResourceBridge,
    createMarkdownHeavyFeatureAdapterResourceBridge,
  } = await import('../markdown-heavy-feature-resource')
  const resourceBridge = assertMarkdownHeavyFeatureAdapterResourceBridge(
    createMarkdownHeavyFeatureAdapterResourceBridge(
      input.context.isolatedRenderFactory,
    ),
  )
  try {
    return await input.context.heavyLifecycle.activate({
      commit: (output, signal) =>
        input.context.scheduleHeavyFeatureCommit
          ? input.context.scheduleHeavyFeatureCommit({
              key: [
                'markdown-heavy-feature',
                identity.documentKey,
                identity.documentEpoch,
                identity.revision,
                identity.nodeId,
                identity.featureKind,
              ].join(':'),
              run: () => input.commit(output),
              signal,
            })
          : input.commit(output),
      element: input.element,
      estimateBytes: estimateFeatureOutputBytes,
      identity,
      render: (signal) =>
        resourceBridge.run(
          signal,
          (adapterSignal) => input.render(adapterSignal),
          isolatedRequest,
        ),
      resources: resourceBridge.resources,
      signal: input.context.signal,
      teardown: resourceBridge.teardown,
    })
  } finally {
    resourceBridge.teardown()
  }
}

const mountPreRenderedHeavyFeature = (
  element: HTMLElement,
  context: MarkdownFeatureActivationContext,
) => {
  const identity = context.resolveHeavyFeatureIdentity?.({
    element,
    kind: context.kind,
    source: '',
    theme: context.theme,
    tokens: context.resolveTokens(element),
  })
  if (!context.heavyLifecycle || !identity) return false
  return context.heavyLifecycle.mountStatic({ element, identity })
}

const activateBuiltInFeature = async (
  element: HTMLElement,
  context: MarkdownFeatureActivationContext,
): Promise<boolean> => {
  const { kind } = context

  if (kind === 'mermaid') {
    if (
      element.dataset.mermaidRendered === 'true' &&
      !element.querySelector('code')
    ) {
      applyNonceToFeatureStyles(element, context.cspNonce)
      mountPreRenderedHeavyFeature(element, context)
      return false
    }
    const source = extractFeatureSource(element, [
      'mermaidSource',
      'markdownSource',
      'source',
    ]).trim()
    if (!source) return false
    try {
      const gateway = await loadMarkdownFeatureOutputGateway()
      return await activateHeavyFeature({
        context,
        element,
        source,
        isolatedRequest: {
          cspNonce: context.cspNonce,
          kind: 'mermaid',
          source,
          theme: context.theme,
          tokens: context.resolveTokens(element),
        },
        render: (signal) =>
          renderMermaidFeature(source, {
            ...toFeatureRenderContext(context, element),
            signal,
          }),
        commit: (output) => {
          const committed = gateway.commitMarkdownFeatureOutput(
            element,
            output,
            {
              nonce: context.cspNonce,
            },
          )
          committed.dataset.mermaidRendered = 'true'
          committed.dataset.markdownFeatureActivated = 'mermaid'
          committed.removeAttribute('data-mermaid-placeholder')
          return committed
        },
      })
    } catch (error) {
      renderFeatureError(element, 'mermaid', error, source)
      throw error
    }
  }

  if (kind === 'latex') {
    if (element.dataset.latexRendered && !element.querySelector('code')) {
      applyNonceToFeatureStyles(element, context.cspNonce)
      mountPreRenderedHeavyFeature(element, context)
      return false
    }
    const source = extractFeatureSource(element, [
      'latexSource',
      'markdownSource',
      'source',
    ]).trim()
    if (!source) return false
    try {
      const gateway = await loadMarkdownFeatureOutputGateway()
      return await activateHeavyFeature({
        context,
        element,
        source,
        isolatedRequest: {
          cspNonce: context.cspNonce,
          displayMode: isBlockLatexElement(element),
          kind: 'latex',
          source,
          theme: context.theme,
          tokens: context.resolveTokens(element),
        },
        render: (signal) =>
          renderLatexFeature(
            source,
            { ...toFeatureRenderContext(context, element), signal },
            isBlockLatexElement(element),
          ),
        commit: (output) => {
          const committed = gateway.commitMarkdownFeatureOutput(
            element,
            output,
            {
              nonce: context.cspNonce,
            },
          )
          committed.dataset.latexRendered = 'katex'
          committed.dataset.markdownFeatureActivated = 'latex'
          committed.removeAttribute('data-latex-placeholder')
          return committed
        },
      })
    } catch (error) {
      renderFeatureError(element, 'latex', error, source)
      throw error
    }
  }

  const code =
    element.tagName === 'CODE' ? element : element.querySelector('code')
  if (!code) return false
  const pre = code.closest('pre') ?? code
  if (
    pre instanceof HTMLElement &&
    pre.dataset.codeHighlighted === 'shiki' &&
    pre.dataset.markdownFeatureTheme === context.theme
  ) {
    applyNonceToFeatureStyles(pre, context.cspNonce)
    mountPreRenderedHeavyFeature(pre, context)
    return false
  }
  const source = code.textContent ?? ''
  if (!source) return false
  const language =
    pre instanceof HTMLElement && pre.dataset.markdownFeatureLanguage
      ? pre.dataset.markdownFeatureLanguage
      : extractCodeLanguage(code)
  try {
    const gateway = await loadMarkdownFeatureOutputGateway()
    return await activateHeavyFeature({
      context,
      element: pre,
      source,
      isolatedRequest: {
        cspNonce: context.cspNonce,
        kind: 'code-highlight',
        language,
        source,
        theme: context.theme,
        tokens: context.resolveTokens(element),
      },
      render: (signal) =>
        renderCodeHighlightFeature(source, language, {
          ...toFeatureRenderContext(context, element),
          signal,
        }),
      commit: (output) => {
        const committed = gateway.commitMarkdownFeatureOutput(pre, output, {
          mode: 'replace-element',
          nonce: context.cspNonce,
        })
        committed.dataset.codeHighlighted = 'shiki'
        committed.dataset.markdownFeatureActivated = 'code-highlight'
        committed.dataset.markdownFeatureLanguage = language
        committed.dataset.markdownFeatureTheme = context.theme
        return committed
      },
    })
  } catch (error) {
    renderFeatureError(pre, 'code-highlight', error, source, true)
    throw error
  }
}

interface MarkdownFeatureActivationWork {
  readonly completed: Promise<void>
  readonly context: MarkdownFeatureActivationContext
  readonly dependencies: readonly MarkdownFeatureActivationWork[]
  readonly element: HTMLElement
  error?: MarkdownFeatureActivationError
  committed?: boolean
  complete: () => void
}

interface MarkdownFeatureActivationBatch {
  readonly context: MarkdownFeatureActivationContext
  readonly errors: MarkdownFeatureActivationError[]
  readonly work: MarkdownFeatureActivationWork[]
}

const markdownHeavyFeatureActivationRegistry = Object.freeze([
  Object.freeze({
    enabled: (features: Required<MarkdownFeatureActivationFeatureOptions>) =>
      features.mermaid,
    kind: 'mermaid' as const,
    selector:
      '.markdown-renderer__mermaid,[data-mermaid-placeholder],[data-mermaid-rendered]',
  }),
  Object.freeze({
    enabled: (features: Required<MarkdownFeatureActivationFeatureOptions>) =>
      features.latex,
    kind: 'latex' as const,
    selector:
      '.markdown-renderer__latex,[data-latex-placeholder],[data-latex-rendered]',
  }),
  Object.freeze({
    enabled: (features: Required<MarkdownFeatureActivationFeatureOptions>) =>
      features.codeHighlight,
    kind: 'code-highlight' as const,
    selector: 'pre code[class*="language-"],[data-code-highlighted="shiki"]',
  }),
])

const isElementInActivationRoot = (root: ParentNode, element: HTMLElement) => {
  const rootNode = root as Node
  return rootNode === element || rootNode.contains(element)
}

const createMarkdownFeatureActivationWork = (
  element: HTMLElement,
  context: MarkdownFeatureActivationContext,
  dependencies: readonly MarkdownFeatureActivationWork[],
): MarkdownFeatureActivationWork => {
  let complete: () => void = () => undefined
  const completed = new Promise<void>((resolve) => {
    complete = () => resolve()
  })
  return {
    complete,
    completed,
    context,
    dependencies,
    element,
  }
}

const activateMarkdownFeatureWork = async (
  batches: readonly MarkdownFeatureActivationBatch[],
  concurrency: number,
  signal?: AbortSignal,
) => {
  const work = batches.flatMap((batch) => batch.work)
  let nextIndex = 0

  const activateNext = async () => {
    while (!signal?.aborted) {
      const current = work[nextIndex++]
      if (!current) return

      try {
        await Promise.all(
          current.dependencies.map((dependency) => dependency.completed),
        )
        if (
          signal?.aborted ||
          !isElementInActivationRoot(current.context.root, current.element)
        ) {
          continue
        }

        const committed = await activateBuiltInFeature(
          current.element,
          current.context,
        )
        if (!signal?.aborted) {
          current.committed = committed
        }
      } catch (error) {
        current.error = createActivationError(current.context.kind, error)
      } finally {
        current.complete()
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(work.length, concurrency) }, () =>
      activateNext(),
    ),
  )
}

export const activateMarkdownFeatures = async (
  options: MarkdownFeatureActivationOptions,
): Promise<MarkdownFeatureActivationResult> => {
  const heavyOptions = options as MarkdownHeavyFeatureActivationOptions
  const features = toMarkdownFeatureOptions(options.features)
  const activated: MarkdownFeatureActivationItem[] = []
  const errors: MarkdownFeatureActivationError[] = []
  const theme = resolveFeatureTheme(options.root)
  const concurrency = Math.max(1, Math.min(4, options.concurrency ?? 3))
  let themeTokens: Readonly<MarkdownFeatureThemeTokens> | undefined
  const resolveTokens = (element: HTMLElement) =>
    (themeTokens ??= resolveMarkdownFeatureThemeTokens(element, options.root))

  if (options.signal?.aborted) return { activated, errors }

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

  const batches: MarkdownFeatureActivationBatch[] = []
  const priorWork: MarkdownFeatureActivationWork[] = []

  for (const {
    enabled,
    kind,
    selector,
  } of markdownHeavyFeatureActivationRegistry) {
    if (options.signal?.aborted) break
    if (!enabled(features)) continue

    const context: MarkdownFeatureActivationContext = {
      cspNonce: options.cspNonce,
      heavyLifecycle: heavyOptions.heavyLifecycle,
      isolatedRenderFactory: heavyOptions.isolatedRenderFactory,
      kind,
      resolveHeavyFeatureIdentity: heavyOptions.resolveHeavyFeatureIdentity,
      scheduleHeavyFeatureCommit: heavyOptions.scheduleHeavyFeatureCommit,
      resolveTokens,
      root: options.root,
      signal: options.signal,
      theme,
    }
    const batch: MarkdownFeatureActivationBatch = {
      context,
      errors: [],
      work: [],
    }
    batches.push(batch)

    try {
      selectMarkdownFeatureElements(options.root, selector).forEach(
        (element) => {
          const dependencies = priorWork.filter(
            (prior) =>
              prior.element !== element && prior.element.contains(element),
          )
          const current = createMarkdownFeatureActivationWork(
            element,
            context,
            dependencies,
          )
          batch.work.push(current)
          priorWork.push(current)
        },
      )
    } catch (error) {
      batch.errors.push(createActivationError(kind, error))
    }
  }

  await activateMarkdownFeatureWork(batches, concurrency, options.signal)

  batches.forEach((batch) => {
    pushActivation(
      activated,
      batch.context.kind,
      batch.work.filter((work) => work.committed).length,
    )
    errors.push(
      ...batch.errors,
      ...batch.work.flatMap((work) => (work.error ? [work.error] : [])),
    )
  })

  return { activated, errors }
}
