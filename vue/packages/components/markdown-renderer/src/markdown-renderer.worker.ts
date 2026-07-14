import { renderMarkdownChunksWithRuntime } from '@element-plus/wasm'

import type {
  MarkdownRenderChunk,
  MarkdownRenderRequest,
  MarkdownRuntimeChunkResult,
} from '@element-plus/wasm'

type MarkdownWorkerRunRequest = {
  generation?: number
  id: number
  key?: string
  request: MarkdownRenderRequest
  type?: 'run'
}

type MarkdownWorkerCancelRequest = {
  generation?: number
  id: number
  key?: string
  type: 'cancel'
}

type MarkdownWorkerRequest =
  | MarkdownWorkerRunRequest
  | MarkdownWorkerCancelRequest

type MarkdownWorkerDocument = {
  metadata: MarkdownRuntimeChunkResult
  units: readonly MarkdownRenderChunk[]
} | null

type MarkdownWorkerResponse =
  | {
      id: number
      result: MarkdownWorkerDocument
      status?: 'complete'
    }
  | {
      error: {
        code?: string
        message: string
        name: string
      }
      id: number
    }
  | {
      generation?: number
      id: number
      status: 'aborted'
    }

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<MarkdownWorkerRequest>) => void) | null
  postMessage: (message: MarkdownWorkerResponse) => void
}

const canceledTasks = new Set<number>()
const latestGenerationByKey = new Map<string, number>()

workerScope.onmessage = (event) => {
  const message = event.data
  if (message.type === 'cancel') {
    canceledTasks.add(message.id)
    if (message.key && message.generation !== undefined) {
      latestGenerationByKey.set(
        message.key,
        Math.max(
          latestGenerationByKey.get(message.key) ?? 0,
          message.generation + 1,
        ),
      )
    }
    return
  }

  const { id, request } = message
  const generation = message.generation ?? 0
  if (message.key) {
    const latest = latestGenerationByKey.get(message.key) ?? generation
    if (generation < latest) {
      workerScope.postMessage({ generation, id, status: 'aborted' })
      return
    }
    latestGenerationByKey.set(message.key, generation)
  }

  const isStale = () =>
    canceledTasks.has(id) ||
    Boolean(
      message.key &&
      (latestGenerationByKey.get(message.key) ?? generation) > generation,
    )
  const releaseTask = () => {
    canceledTasks.delete(id)
    if (message.key && latestGenerationByKey.get(message.key) === generation) {
      latestGenerationByKey.delete(message.key)
    }
  }

  void renderMarkdownChunksWithRuntime(request)
    .then((result) => {
      if (isStale()) {
        releaseTask()
        workerScope.postMessage({ generation, id, status: 'aborted' })
        return
      }
      if (result.ok === false) {
        releaseTask()
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

      releaseTask()
      workerScope.postMessage({
        id,
        result: {
          metadata: result.value,
          units: result.value.chunks,
        },
        status: 'complete',
      })
    })
    .catch((error: unknown) => {
      releaseTask()
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
