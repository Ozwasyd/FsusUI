import { renderMarkdownChunksWithRuntime } from '@element-plus/wasm'

import type {
  MarkdownRenderChunk,
  MarkdownRenderRequest,
  MarkdownRuntimeChunkResult,
} from '@element-plus/wasm'

type MarkdownWorkerRequest = {
  id: number
  request: MarkdownRenderRequest
}

type MarkdownWorkerDocument = {
  metadata: MarkdownRuntimeChunkResult
  units: readonly MarkdownRenderChunk[]
} | null

type MarkdownWorkerResponse =
  | {
      id: number
      result: MarkdownWorkerDocument
    }
  | {
      error: {
        code?: string
        message: string
        name: string
      }
      id: number
    }

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<MarkdownWorkerRequest>) => void) | null
  postMessage: (message: MarkdownWorkerResponse) => void
}

workerScope.onmessage = (event) => {
  const { id, request } = event.data

  void renderMarkdownChunksWithRuntime(request)
    .then((result) => {
      if (result.ok === false) {
        workerScope.postMessage({
          error: {
            code: result.error.code,
            message: result.error.message,
            name: 'FsusError',
          },
          id,
        })
        return
      }

      workerScope.postMessage({
        id,
        result: {
          metadata: result.value,
          units: result.value.chunks,
        },
      })
    })
    .catch((error: unknown) => {
      workerScope.postMessage({
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Error',
        },
        id,
      })
    })
}

export {}
