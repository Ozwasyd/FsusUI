export const MARKDOWN_RENDERER_VERSION = 'markdown-wasm-contract@2026-07-28'

declare const markdownSafeHtmlBrand: unique symbol
declare const markdownSafeRenderResultBrand: unique symbol

export type MarkdownSafeHtml = string & {
  readonly [markdownSafeHtmlBrand]: true
}

export interface MarkdownSafeRenderAuthority {
  readonly [markdownSafeRenderResultBrand]: true
}

export type MarkdownRenderMode = 'article' | 'about' | 'preview' | 'editor'
export type MarkdownRenderFeature =
  | 'code_block'
  | 'latex'
  | 'mermaid'
  | 'table'
  | 'image'
  | 'heading'
  | 'link'
  | 'emphasis'
  | 'footnote'
export type MarkdownPlaceholderKind =
  | 'latex_inline'
  | 'latex_block'
  | 'mermaid_block'

export interface MarkdownRenderMetadata {
  readonly mode: MarkdownRenderMode
  readonly baseUrl: string | null
  readonly allowLatex: boolean
  readonly allowMermaid: boolean
  readonly sourceLength: number
  readonly sourceLineCount?: number
  readonly normalizedSourceLength?: number
  readonly featureCount: number
  readonly placeholderCount: number
  readonly rendererVersion: string
}

export interface MarkdownRenderRequest {
  source: string
  baseUrl?: string | null
  mode?: MarkdownRenderMode
  allowLatex?: boolean
  allowMermaid?: boolean
  contentVersion?: number | string | null
}

export interface MarkdownRenderPlaceholder {
  readonly kind: MarkdownPlaceholderKind
  readonly token: string
  readonly label: string
  readonly line: number
  readonly source?: string
  readonly column?: number
  readonly endLine?: number
  readonly endColumn?: number
  readonly startOffset?: number
  readonly endOffset?: number
}

export interface MarkdownSafeRenderResult extends MarkdownSafeRenderAuthority {
  readonly html: MarkdownSafeHtml
  readonly normalizedSource: string
  readonly sourceIdentity: string
  readonly features: readonly MarkdownRenderFeature[]
  readonly placeholders: readonly MarkdownRenderPlaceholder[]
  readonly rendererVersion: string
  readonly metadata?: MarkdownRenderMetadata
}

export type MarkdownRenderChunkKind =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'code'
  | 'blockquote'
  | 'latex'
  | 'mermaid'
  | 'footnotes'
  | 'rule'
  | 'generated'

export interface MarkdownRenderChunk {
  readonly key: string
  readonly kind: MarkdownRenderChunkKind
  readonly html: MarkdownSafeHtml
  readonly estimatedSize: number
  readonly htmlStartOffset: number
  readonly htmlEndOffset: number
}

export interface MarkdownRenderTimings {
  readonly initMs: number
  readonly encodeMs: number
  readonly wasmRenderMs: number
  readonly readHtmlMs: number
  readonly readFeaturesMs: number
  readonly readPlaceholdersMs: number
  readonly readMetadataMs: number
  readonly totalMs: number
}

export interface MarkdownRendererSurfaceContract {
  root: string
  detail: string
  body: string
  text: string
  textInlineCode: string
  listItem: string
  listItemInlineCode: string
  paragraph: string
  placeholder: string
  error: string
  mermaid: string
  latex: string
  code: string
}

export const MARKDOWN_RENDERER_SURFACE_CLASSES: MarkdownRendererSurfaceContract =
  Object.freeze({
    root: 'markdown-renderer',
    detail: 'markdown-renderer markdown-renderer--detail',
    body: 'markdown-renderer__body',
    text: 'markdown-renderer__text',
    textInlineCode: 'markdown-renderer__text--inline-code',
    listItem: 'markdown-renderer__list-item',
    listItemInlineCode: 'markdown-renderer__list-item--inline-code',
    paragraph: 'markdown-renderer__paragraph',
    placeholder: 'markdown-renderer__placeholder',
    error: 'markdown-renderer__error',
    mermaid: 'markdown-renderer__mermaid',
    latex: 'markdown-renderer__latex',
    code: 'markdown-renderer__code',
  })

export function normalizeMarkdownSource(input: string): string {
  const raw = typeof input === 'string' ? input : ''
  return raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
}

export function resolveMarkdownSourceIdentity(
  request: MarkdownRenderRequest | string,
): string {
  const payload = typeof request === 'string' ? { source: request } : request
  const source = normalizeMarkdownSource(payload.source)
  let hash = 0x811c9dc5
  const identityInput = [
    MARKDOWN_RENDERER_VERSION,
    source,
    payload.baseUrl ?? '',
    payload.mode ?? 'article',
    payload.allowLatex === false ? 'no-latex' : 'latex',
    payload.allowMermaid === false ? 'no-mermaid' : 'mermaid',
  ].join('\u0000')

  for (let index = 0; index < identityInput.length; index += 1) {
    hash ^= identityInput.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return `markdown:${identityInput.length}:${(hash >>> 0).toString(36)}`
}

export function escapeMarkdownHtml(input: string): string {
  return String(input).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })
}

export function detectMarkdownFeatures(
  source: string,
): MarkdownRenderFeature[] {
  const normalized = normalizeMarkdownSource(source)
  const features = new Set<MarkdownRenderFeature>()

  if (normalized.includes('```') || normalized.includes('~~~')) {
    features.add('code_block')
  }
  if (
    normalized.includes('$$') ||
    normalized.includes('\\(') ||
    normalized.includes('\\[')
  ) {
    features.add('latex')
  }
  if (normalized.includes('```mermaid') || normalized.includes(':::mermaid')) {
    features.add('mermaid')
  }
  if (normalized.includes('|')) {
    features.add('table')
  }
  if (normalized.includes('![')) {
    features.add('image')
  }
  if (normalized.includes('#')) {
    features.add('heading')
  }
  if (normalized.includes('](')) {
    features.add('link')
  }
  if (normalized.includes('[^')) {
    features.add('footnote')
  }

  return [...features]
}

export function detectMarkdownPlaceholders(
  source: string,
): MarkdownRenderPlaceholder[] {
  const normalized = normalizeMarkdownSource(source)
  const placeholders: MarkdownRenderPlaceholder[] = []
  const lines = normalized.split('\n')

  lines.forEach((line, index) => {
    const trimmed = line.trimStart()
    if (trimmed.startsWith('```mermaid')) {
      placeholders.push({
        kind: 'mermaid_block',
        token: 'mermaid',
        label: 'Mermaid 图表将在 Wasm 渲染器中占位',
        line: index + 1,
      })
      return
    }

    if (trimmed === '$$' || trimmed.startsWith('$$ ')) {
      placeholders.push({
        kind: 'latex_block',
        token: 'latex-block',
        label: 'LaTeX 块公式将在 Wasm 渲染器中占位',
        line: index + 1,
      })
      return
    }

    if (line.includes('\\(') || line.includes('\\[')) {
      placeholders.push({
        kind: 'latex_inline',
        token: 'latex-inline',
        label: 'LaTeX 行内公式将在 Wasm 渲染器中占位',
        line: index + 1,
      })
    }
  })

  return placeholders
}
