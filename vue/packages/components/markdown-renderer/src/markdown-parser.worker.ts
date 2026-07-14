import { renderMarkdownChunksWithRuntime } from '@element-plus/wasm'

import type {
  MarkdownRenderChunk,
  MarkdownRenderRequest,
  MarkdownRuntimeChunkResult,
} from '@element-plus/wasm'

type ParserRequest = {
  id: number
  request: MarkdownRenderRequest
}

type ParserDocument = {
  metadata: MarkdownRuntimeChunkResult
  units: readonly MarkdownRenderChunk[]
}

type ParserResponse =
  | { id: number; result: ParserDocument }
  | {
      error: { code?: string; message: string; name: string }
      id: number
    }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ParserRequest>) => void) | null
  postMessage: (message: ParserResponse) => void
}

const cache = new Map<string, { bytes: number; value: ParserDocument }>()
const MAX_CACHE_ENTRIES = 2
const MAX_CACHE_BYTES = 6 * 1024 * 1024
const MAX_CACHE_ENTRY_BYTES = 3 * 1024 * 1024

const hashSource = (request: MarkdownRenderRequest) => {
  if (request.contentVersion !== null && request.contentVersion !== undefined) {
    return `version:${String(request.contentVersion)}`
  }
  let hash = 0x811c9dc5
  for (let index = 0; index < request.source.length; index += 1) {
    hash ^= request.source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `worker:${(hash >>> 0).toString(36)}`
}

const requestKey = (request: MarkdownRenderRequest) =>
  [
    hashSource(request),
    request.source.length,
    request.baseUrl ?? '',
    request.mode ?? 'article',
    request.allowHtml ? 1 : 0,
    request.allowLatex === false ? 0 : 1,
    request.allowMermaid === false ? 0 : 1,
  ].join('\u0000')

const cacheDocument = (key: string, value: ParserDocument) => {
  const bytes =
    value.metadata.html.length +
    value.units.reduce((sum, chunk) => sum + chunk.html.length, 0)
  if (bytes <= 0 || bytes > MAX_CACHE_ENTRY_BYTES) return
  cache.delete(key)
  cache.set(key, { bytes, value })
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    if (!oldest) break
    cache.delete(oldest)
  }
  let total = Array.from(cache.values()).reduce(
    (sum, entry) => sum + entry.bytes,
    0,
  )
  while (total > MAX_CACHE_BYTES && cache.size > 0) {
    const oldest = cache.keys().next().value
    if (!oldest) break
    total -= cache.get(oldest)?.bytes ?? 0
    cache.delete(oldest)
  }
}

scope.onmessage = (event) => {
  const { id, request } = event.data
  const key = requestKey(request)
  const cached = cache.get(key)
  if (cached) {
    cache.delete(key)
    cache.set(key, cached)
    scope.postMessage({ id, result: cached.value })
    return
  }

  void renderMarkdownChunksWithRuntime(request)
    .then((result) => {
      if (result.ok === false) {
        scope.postMessage({
          error: {
            code: result.error.code,
            message: result.error.message,
            name: 'FsusError',
          },
          id,
        })
        return
      }
      const document = {
        metadata: result.value,
        units: result.value.chunks,
      }
      cacheDocument(key, document)
      scope.postMessage({ id, result: document })
    })
    .catch((error: unknown) => {
      scope.postMessage({
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Error',
        },
        id,
      })
    })
}

export {}
