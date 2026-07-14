import type {
  MarkdownRenderChunk,
  MarkdownRuntimeChunkResult,
  MarkdownRuntimeHtmlResult,
  MarkdownRuntimeRenderResult,
} from '@element-plus/wasm'

export type MarkdownRendererRuntimeCacheKind = 'chunks' | 'html' | 'result'

export type MarkdownRendererRuntimeCacheValue =
  | MarkdownRuntimeChunkResult
  | MarkdownRuntimeHtmlResult
  | MarkdownRuntimeRenderResult

type MarkdownRendererRuntimeCacheEntry = {
  bytes: number
  kind: MarkdownRendererRuntimeCacheKind
  key: string
  value: MarkdownRendererRuntimeCacheValue
}

const MARKDOWN_CACHE_MAX_ENTRIES = 8
const MARKDOWN_CACHE_MAX_TOTAL_BYTES = 12 * 1024 * 1024
const MARKDOWN_CACHE_MAX_ENTRY_BYTES = 3 * 1024 * 1024
const MARKDOWN_CACHE_MIN_INLINE_BYTES = 1024

const getMarkdownRuntimeCaches = () => {
  const globalObject = globalThis as typeof globalThis & {
    __fsusMarkdownRendererRuntimeCaches?: MarkdownRendererRuntimeCacheStore
  }
  if (!globalObject.__fsusMarkdownRendererRuntimeCaches) {
    globalObject.__fsusMarkdownRendererRuntimeCaches = new Map()
  }
  return globalObject.__fsusMarkdownRendererRuntimeCaches
}

const estimateMarkdownCacheBytes = (value: unknown) => {
  if (!value || typeof value !== 'object') return 0
  const result = value as {
    chunks?: readonly MarkdownRenderChunk[]
    html?: string
  }
  const htmlBytes = result.html?.length ?? 0
  const chunkBytes =
    result.chunks?.reduce((sum, chunk) => sum + chunk.html.length, 0) ?? 0
  return htmlBytes + chunkBytes
}

type MarkdownRendererRuntimeCacheStore = Map<
  string,
  MarkdownRendererRuntimeCacheEntry
>

const pruneMarkdownCache = (cache: MarkdownRendererRuntimeCacheStore) => {
  while (cache.size > MARKDOWN_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) break
    cache.delete(oldestKey)
  }

  let totalBytes = Array.from(cache.values()).reduce(
    (sum, entry) => sum + entry.bytes,
    0,
  )
  while (totalBytes > MARKDOWN_CACHE_MAX_TOTAL_BYTES && cache.size > 0) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) break
    const entry = cache.get(oldestKey)
    cache.delete(oldestKey)
    totalBytes -= entry?.bytes ?? 0
  }
}

export const getMarkdownRendererRuntimeCache = <TValue>(
  kind: MarkdownRendererRuntimeCacheKind,
  key: string,
) => {
  const cache = getMarkdownRuntimeCaches()
  const entry = cache.get(key)
  if (!entry) return null
  if (kind === 'chunks' && entry.kind !== 'chunks') return null
  if (kind === 'result' && entry.kind === 'html') return null
  cache.delete(key)
  cache.set(key, entry)
  if (kind === 'html' && entry.kind !== 'html') {
    const result = entry.value as
      | MarkdownRuntimeChunkResult
      | MarkdownRuntimeRenderResult
    return {
      engine: result.engine,
      html: result.html,
      rendererVersion: result.rendererVersion,
      timings: result.timings,
    } as TValue
  }
  return entry.value as TValue
}

export const setMarkdownRendererRuntimeCache = <TValue>(
  kind: MarkdownRendererRuntimeCacheKind,
  key: string,
  value: TValue,
) => {
  const bytes = estimateMarkdownCacheBytes(value)
  if (bytes <= 0 || bytes > MARKDOWN_CACHE_MAX_ENTRY_BYTES) return
  if (kind !== 'chunks' && bytes < MARKDOWN_CACHE_MIN_INLINE_BYTES) return

  const cache = getMarkdownRuntimeCaches()
  const previous = cache.get(key)
  const rank = { chunks: 3, html: 1, result: 2 } as const
  if (previous && rank[previous.kind] > rank[kind]) return
  cache.delete(key)
  cache.set(key, {
    bytes,
    kind,
    key,
    value: value as MarkdownRendererRuntimeCacheValue,
  })
  pruneMarkdownCache(cache)
}

export const clearMarkdownRendererRuntimeCache = () => {
  getMarkdownRuntimeCaches().clear()
}
