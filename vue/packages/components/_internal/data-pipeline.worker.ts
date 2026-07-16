import {
  createAsciiFilterIndex,
  createWasmDataSession,
  type WasmDataSession,
} from '@element-plus/wasm'

type BuildFilterRequest = {
  datasetId: string
  labels: string[]
  type: 'build-filter'
  version: number
}

type FilterRequest = {
  caseSensitive: boolean
  datasetId: string
  keyword: string
  type: 'filter'
  version: number
}

type SortNumberRequest = {
  ascending: boolean
  changedStart?: number
  datasetId: string
  type: 'sort-number'
  values: Float64Array
}

type SortAsciiRequest = {
  ascending: boolean
  datasetId: string
  labels: string[]
  type: 'sort-ascii'
}

type ReleaseRequest = { datasetId: string; type: 'release' }
type DataRequest =
  | BuildFilterRequest
  | FilterRequest
  | SortNumberRequest
  | SortAsciiRequest
  | ReleaseRequest

type RunMessage = {
  generation: number
  id: number
  key?: string
  request: DataRequest
  type: 'run'
}
type CancelMessage = {
  generation: number
  id: number
  key?: string
  type: 'cancel'
}

type FilterDataset = {
  previousCandidates: Uint32Array | null
  previousQuery: string
  session: WasmDataSession
  version: number
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<RunMessage | CancelMessage>) => void) | null
  postMessage: (message: unknown, transfer?: Transferable[]) => void
}
const canceled = new Set<number>()
const latestGeneration = new Map<string, number>()
const filterDatasets = new Map<string, FilterDataset>()
const sessions = new Map<string, WasmDataSession>()

const sessionFor = async (datasetId: string) => {
  const existing = sessions.get(datasetId)
  if (existing) return existing
  const result = await createWasmDataSession()
  if (result.ok === false) throw result.error
  sessions.set(datasetId, result.value)
  return result.value
}

const releaseDataset = (datasetId: string) => {
  filterDatasets.delete(datasetId)
  sessions.get(datasetId)?.dispose()
  sessions.delete(datasetId)
}

const serializeError = (error: unknown) => ({
  message: error instanceof Error ? error.message : String(error),
  name: error instanceof Error ? error.name : 'Error',
})

scope.onmessage = (event) => {
  const message = event.data
  if (message.type === 'cancel') {
    canceled.add(message.id)
    if (message.key) {
      latestGeneration.set(
        message.key,
        Math.max(
          latestGeneration.get(message.key) ?? 0,
          message.generation + 1,
        ),
      )
    }
    return
  }
  const { generation, id, key, request } = message
  if (key) {
    const latest = latestGeneration.get(key) ?? generation
    if (generation < latest) {
      scope.postMessage({ generation, id, status: 'aborted' })
      return
    }
    latestGeneration.set(key, generation)
  }
  const stale = () =>
    canceled.has(id) ||
    Boolean(key && (latestGeneration.get(key) ?? generation) > generation)
  const done = () => {
    canceled.delete(id)
    if (key && latestGeneration.get(key) === generation)
      latestGeneration.delete(key)
  }
  const started = performance.now()
  void (async () => {
    let result: Record<string, unknown>
    if (request.type === 'release') {
      releaseDataset(request.datasetId)
      result = { kind: 'released' }
    } else if (request.type === 'build-filter') {
      const initializedAt = performance.now()
      const index = createAsciiFilterIndex(request.labels)
      if (stale()) return null
      const session = await sessionFor(request.datasetId)
      session.setAsciiIndex(index)
      filterDatasets.set(request.datasetId, {
        previousCandidates: null,
        previousQuery: '',
        session,
        version: request.version,
      })
      result = {
        count: index.lengths.length,
        initializeMs: performance.now() - initializedAt,
        kind: 'built',
        stats: session.stats(),
        version: request.version,
      }
    } else if (request.type === 'filter') {
      const dataset = filterDatasets.get(request.datasetId)
      if (!dataset || dataset.version !== request.version) {
        throw new Error('fsus_data_filter_index_stale')
      }
      const candidates =
        request.keyword.startsWith(dataset.previousQuery) &&
        dataset.previousQuery.length > 0
          ? (dataset.previousCandidates ?? undefined)
          : undefined
      const indices = dataset.session.filterLoadedAsciiIndices(
        request.keyword,
        request.caseSensitive,
        candidates,
      )
      dataset.previousQuery = request.keyword
      // The response buffer is transferred to the main thread below. Keep a
      // worker-owned copy so the next prefix query can still narrow from it.
      dataset.previousCandidates = indices.slice()
      result = {
        indices,
        kind: 'indices',
        stats: dataset.session.stats(),
        version: dataset.version,
      }
    } else if (request.type === 'sort-number') {
      const session = await sessionFor(request.datasetId)
      result = {
        indices: session.sortNumberIndices(
          request.values,
          request.ascending,
          request.changedStart,
        ),
        kind: 'indices',
        stats: session.stats(),
      }
    } else {
      const session = await sessionFor(request.datasetId)
      const index = createAsciiFilterIndex(request.labels)
      result = {
        indices: session.sortAsciiIndices(index, request.ascending),
        kind: 'indices',
        stats: session.stats(),
      }
    }
    if (result === null || stale()) return null
    return result
  })()
    .then((result) => {
      if (result === null || stale()) {
        done()
        scope.postMessage({ generation, id, status: 'aborted' })
        return
      }
      done()
      const indices = result.indices
      const transfer = indices instanceof Uint32Array ? [indices.buffer] : []
      scope.postMessage(
        {
          id,
          result,
          status: 'complete',
          timings: { computeDurationMs: performance.now() - started },
        },
        transfer,
      )
    })
    .catch((error) => {
      done()
      scope.postMessage({ error: serializeError(error), id })
    })
}

export {}
