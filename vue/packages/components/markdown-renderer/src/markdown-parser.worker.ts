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

export type ParserDocument = {
  metadata: MarkdownRuntimeChunkResult
  units: readonly MarkdownRenderChunk[]
}

export type ParserResponse =
  | { id: number; result: ParserDocument }
  | {
      error: { code?: string; message: string; name: string }
      id: number
    }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ParserRequest>) => void) | null
  postMessage: (message: ParserResponse) => void
}

const cache = new Map<string, ParserDocument>()
// Together these limits also cap the total cached HTML length.
const MAX_CACHE_ENTRIES = 2
const MAX_CACHE_ENTRY_LENGTH = 3 * 1024 * 1024

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
    request.allowLatex === false ? 0 : 1,
    request.allowMermaid === false ? 0 : 1,
  ].join('\u0000')

const cacheDocument = (key: string, value: ParserDocument) => {
  const length =
    value.metadata.html.length +
    value.units.reduce((sum, chunk) => sum + chunk.html.length, 0)
  if (length <= 0 || length > MAX_CACHE_ENTRY_LENGTH) return
  cache.delete(key)
  cache.set(key, value)
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
}

scope.onmessage = (event) => {
  const { id, request } = event.data
  const key = requestKey(request)
  const cached = cache.get(key)
  if (cached) {
    cache.delete(key)
    cache.set(key, cached)
    scope.postMessage({ id, result: cached })
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
