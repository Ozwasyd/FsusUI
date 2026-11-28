import type {
  MarkdownAssetKind,
  MarkdownRenderRequest,
  WasmAssetUrlPair,
} from '@fsusui/wasm'
import type { ParserDocument, ParserResponse } from './markdown-parser.worker'

type MarkdownWorkerConfigureRequest = {
  type: 'configure'
  parserWorkerUrl?: string
  markdownAssets?: Partial<Record<MarkdownAssetKind, WasmAssetUrlPair>>
}

type MarkdownWorkerRunRequest = {
  generation: number
  id: number
  key?: string
  request: MarkdownRenderRequest
  type?: 'run'
}

type MarkdownWorkerCancelRequest = {
  generation: number
  id: number
  key?: string
  type: 'cancel'
}

type MarkdownWorkerRequest =
  | MarkdownWorkerConfigureRequest
  | MarkdownWorkerRunRequest
  | MarkdownWorkerCancelRequest

type MarkdownWorkerResponse =
  | {
      generation: number
      id: number
      result: ParserDocument | null
      status?: 'complete'
      timings?: { computeDurationMs?: number }
    }
  | {
      error: { code?: string; message: string; name: string }
      generation: number
      id: number
    }
  | { generation: number; id: number; status: 'aborted' }

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<MarkdownWorkerRequest>) => void) | null
  postMessage: (message: MarkdownWorkerResponse) => void
}

let parser: Worker | null = null
let active: { generation: number; id: number } | undefined
let configuredParserWorkerUrl: string | undefined
let configuredMarkdownAssets:
  | Partial<Record<MarkdownAssetKind, WasmAssetUrlPair>>
  | undefined

const terminateParser = () => {
  parser?.terminate()
  parser = null
}

const ensureParser = () => {
  if (parser) return parser
  const parserUrl = configuredParserWorkerUrl
    ? new URL(configuredParserWorkerUrl, import.meta.url)
    : new URL('./markdown-parser.worker.ts', import.meta.url)
  parser = new Worker(parserUrl, {
    type: 'module',
  })
  parser.onmessage = (event: MessageEvent<ParserResponse>) => {
    const message = event.data
    if (!active || message.id !== active.id) return
    const completed = active
    active = undefined
    if ('error' in message) {
      workerScope.postMessage({
        error: message.error,
        generation: completed.generation,
        id: message.id,
      })
      return
    }
    workerScope.postMessage({
      generation: completed.generation,
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
      generation: current.generation,
      id: current.id,
    })
  }
  return parser
}

workerScope.onmessage = (event) => {
  const message = event.data
  if (message.type === 'configure') {
    if (typeof message.parserWorkerUrl === 'string' && message.parserWorkerUrl) {
      configuredParserWorkerUrl = message.parserWorkerUrl
    }
    if (message.markdownAssets) {
      configuredMarkdownAssets = message.markdownAssets
    }
    return
  }
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

  const generation = message.generation
  if (active) {
    terminateParser()
    workerScope.postMessage({
      generation: active.generation,
      id: active.id,
      status: 'aborted',
    })
  }
  active = { generation, id: message.id }
  ensureParser().postMessage({
    id: message.id,
    request: message.request,
    markdownAssets: configuredMarkdownAssets,
  })
}
