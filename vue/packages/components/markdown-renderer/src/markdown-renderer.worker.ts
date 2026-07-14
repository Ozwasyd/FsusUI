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
      timings?: { computeDurationMs?: number }
    }
  | {
      error: { code?: string; message: string; name: string }
      id: number
    }
  | { generation?: number; id: number; status: 'aborted' }

type ParserResponse =
  | { id: number; result: Exclude<MarkdownWorkerDocument, null> }
  | {
      error: { code?: string; message: string; name: string }
      id: number
    }

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<MarkdownWorkerRequest>) => void) | null
  postMessage: (message: MarkdownWorkerResponse) => void
}

let parser: Worker | null = null
let active: { generation: number; id: number } | undefined

const terminateParser = () => {
  parser?.terminate()
  parser = null
}

const ensureParser = () => {
  if (parser) return parser
  parser = new Worker(new URL('./markdown-parser.worker.ts', import.meta.url), {
    type: 'module',
  })
  parser.onmessage = (event: MessageEvent<ParserResponse>) => {
    const message = event.data
    if (!active || message.id !== active.id) return
    active = undefined
    if ('error' in message) {
      workerScope.postMessage({ error: message.error, id: message.id })
      return
    }
    workerScope.postMessage({
      id: message.id,
      result: message.result,
      status: 'complete',
      timings: {
        computeDurationMs: message.result.metadata.timings.totalMs,
      },
    })
  }
  parser.onerror = (event) => {
    const current = active
    active = undefined
    terminateParser()
    if (!current) return
    workerScope.postMessage({
      error: {
        message: event.message || 'markdown_parser_worker_failed',
        name: 'WorkerError',
      },
      id: current.id,
    })
  }
  return parser
}

workerScope.onmessage = (event) => {
  const message = event.data
  if (message.type === 'cancel') {
    if (active?.id === message.id) {
      active = undefined
      terminateParser()
    }
    workerScope.postMessage({
      generation: message.generation,
      id: message.id,
      status: 'aborted',
    })
    return
  }

  const generation = message.generation ?? 0
  if (active) {
    terminateParser()
    workerScope.postMessage({
      generation: active.generation,
      id: active.id,
      status: 'aborted',
    })
  }
  active = { generation, id: message.id }
  ensureParser().postMessage({ id: message.id, request: message.request })
}

export {}
