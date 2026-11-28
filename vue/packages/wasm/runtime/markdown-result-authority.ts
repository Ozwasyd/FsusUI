import {
  MarkdownRuntimeError,
  type MarkdownRuntimeErrorCode,
} from '../markdown-runtime-error'
import {
  MARKDOWN_RENDER_PARSER,
  MARKDOWN_RENDERER_VERSION,
  detectMarkdownFeatures,
  detectMarkdownPlaceholders,
  escapeMarkdownHtml,
  normalizeMarkdownSource,
  resolveMarkdownSourceIdentity,
  type MarkdownRenderChunk,
  type MarkdownRenderFeature,
  type MarkdownRenderMetadata,
  type MarkdownRenderRequest,
  type MarkdownRenderTimings,
  type MarkdownSafeHtml,
  type MarkdownSafeRenderAuthority,
  type MarkdownSafeRenderResult,
} from '../markdown'
import type {
  FsusErrorCode,
  FsusErrorDetail,
  FsusResult,
} from '@fsusui/core'

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

export const createFsusRuntimeError = (
  code: FsusErrorCode,
  message: string,
  cause?: unknown,
): FsusErrorDetail => ({
  category: fsusErrorCategories[code],
  code,
  message,
  ...(cause === undefined ? {} : { cause }),
})

export const fsusOk = <T>(value: T): FsusResult<T> => ({ ok: true, value })

export const fsusErr = <T = never>(error: FsusErrorDetail): FsusResult<T> => ({
  ok: false,
  error,
})

export const isFsusErr = <T>(
  result: FsusResult<T>,
): result is { ok: false; error: FsusErrorDetail } => result.ok === false

export const markdownErrorToFsusError = (
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

export function createMarkdownRuntimeError(
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

export type MarkdownRuntimeRenderResult = MarkdownSafeRenderResult & {
  readonly engine: MarkdownRuntimeKind
  readonly timings: MarkdownRenderTimings
}

export interface MarkdownRuntimeHtmlResult extends MarkdownSafeRenderAuthority {
  readonly html: MarkdownSafeHtml
  readonly parser: string
  readonly rawSource: string
  readonly normalizedSource: string
  readonly sourceIdentity: string
  readonly engine: MarkdownRuntimeKind
  readonly rendererVersion: string
  readonly timings: MarkdownRenderTimings
}

export interface MarkdownRuntimeSummaryResult extends MarkdownSafeRenderAuthority {
  readonly html: MarkdownSafeHtml
  readonly parser: string
  readonly rawSource: string
  readonly normalizedSource: string
  readonly sourceIdentity: string
  readonly engine: MarkdownRuntimeKind
  readonly features: readonly MarkdownRenderFeature[]
  readonly metadata: MarkdownRenderMetadata
  readonly rendererVersion: string
  readonly timings: MarkdownRenderTimings
}

export type MarkdownRuntimeChunkResult = MarkdownRuntimeRenderResult & {
  readonly chunks: readonly MarkdownRenderChunk[]
}

export interface MarkdownRuntimeProfile {
  engine: MarkdownRuntimeKind
  phase: MarkdownRuntimeProfilePhase
  rendererVersion: string
  timings: MarkdownRenderTimings
}

const markdownRuntimeAuthority = new WeakSet<object>()

const deepSealMarkdownRuntimeValue = <T>(value: T): T => {
  if (Object(value) !== value || Object.isFrozen(value)) {
    return value
  }
  Object.values(value as Record<string, unknown>).forEach(
    deepSealMarkdownRuntimeValue,
  )
  return Object.freeze(value)
}

export const authorizeMarkdownRuntimeResult = <TResult extends object>(
  result: TResult,
): TResult & MarkdownSafeRenderAuthority => {
  deepSealMarkdownRuntimeValue(result)
  markdownRuntimeAuthority.add(result)
  return result as TResult & MarkdownSafeRenderAuthority
}

export const isMarkdownRuntimeAuthorizedResult = (
  result: unknown,
): result is
  | MarkdownRuntimeChunkResult
  | MarkdownRuntimeHtmlResult
  | MarkdownRuntimeRenderResult
  | MarkdownRuntimeSummaryResult
  | MarkdownSafeRenderResult =>
  Object(result) === result &&
  Object.isFrozen(result) &&
  markdownRuntimeAuthority.has(result as object)

export const renderMarkdownFallbackWithRuntime = (
  request: MarkdownRenderRequest | string,
): MarkdownSafeRenderResult => {
  const payload = typeof request === 'string' ? { source: request } : request
  const normalizedSource = normalizeMarkdownSource(payload.source)
  return authorizeMarkdownRuntimeResult({
    html: `<div class="markdown-renderer__error"><p>Markdown 渲染失败，已回退为安全文本。</p><pre><code>${escapeMarkdownHtml(payload.source)}</code></pre></div>` as MarkdownSafeHtml,
    parser: MARKDOWN_RENDER_PARSER,
    rawSource: payload.source,
    normalizedSource,
    sourceIdentity: resolveMarkdownSourceIdentity(payload),
    features: detectMarkdownFeatures(normalizedSource),
    placeholders: detectMarkdownPlaceholders(normalizedSource),
    rendererVersion: MARKDOWN_RENDERER_VERSION,
  })
}
