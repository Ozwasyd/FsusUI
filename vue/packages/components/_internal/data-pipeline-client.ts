import { createFsusWorkerExecutor } from '@element-plus/hooks'

import { fsusDataPipelineStrategy } from './data-pipeline-strategy'

import type { FsusResult } from '@element-plus/utils'
import type { WasmDataSessionStats } from '@element-plus/wasm'

type DataRequest =
  | {
      datasetId: string
      labels: string[]
      type: 'build-filter'
      version: number
    }
  | {
      caseSensitive: boolean
      datasetId: string
      keyword: string
      type: 'filter'
      version: number
    }
  | {
      ascending: boolean
      changedStart?: number
      datasetId: string
      type: 'sort-number'
      values: Float64Array
    }
  | {
      ascending: boolean
      datasetId: string
      labels: string[]
      type: 'sort-ascii'
    }
  | { datasetId: string; type: 'release' }

export type DataPipelineResponse = {
  count?: number
  indices?: Uint32Array
  initializeMs?: number
  kind: 'built' | 'indices' | 'released'
  stats?: WasmDataSessionStats
  version?: number
}

export const canUseDataPipelineWorker = () =>
  typeof Worker !== 'undefined' && typeof URL !== 'undefined'

const createWorker = () =>
  new Worker(new URL('./data-pipeline.worker.ts', import.meta.url), {
    type: 'module',
  })

export const createFsusDataPipelineClient = (componentId: string) => {
  const executor = canUseDataPipelineWorker()
    ? createFsusWorkerExecutor<DataRequest, DataPipelineResponse>(
        createWorker,
        {
          maxQueue: 8,
          maxWorkers: 1,
          name: `fsus-data-${componentId}`,
          structuredCloneLimitBytes: 16 * 1024 * 1024,
        },
      )
    : null
  const controllers = new Map<string, AbortController>()
  const generations = new Map<string, number>()
  let disposed = false

  const cancelLatest = (key: string) => {
    controllers.get(key)?.abort()
    controllers.delete(key)
    generations.set(key, (generations.get(key) ?? 0) + 1)
  }

  const runLatest = async (
    key: string,
    request: DataRequest,
    options: {
      lane: 'latency' | 'throughput' | 'background'
      transfer?: Transferable[]
    },
  ): Promise<FsusResult<DataPipelineResponse> | null> => {
    if (!executor || disposed) return null
    controllers.get(key)?.abort()
    const controller = new AbortController()
    controllers.set(key, controller)
    const generation = (generations.get(key) ?? 0) + 1
    generations.set(key, generation)
    const result = await executor.run(request, {
      generation,
      key: `${componentId}:${key}`,
      lane: options.lane,
      signal: controller.signal,
      transfer: options.transfer,
    })
    if (controllers.get(key) === controller) controllers.delete(key)
    if (generations.get(key) !== generation) return null
    return result
  }

  return {
    buildFilterIndex: (datasetId: string, version: number, labels: string[]) =>
      runLatest(
        `build:${datasetId}`,
        { datasetId, labels, type: 'build-filter', version },
        { lane: 'throughput' },
      ),
    cancelSort: () => cancelLatest('sort'),
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const controller of controllers.values()) controller.abort()
      controllers.clear()
      executor?.dispose()
    },
    filter: (datasetId: string, version: number, keyword: string) =>
      runLatest(
        `filter:${datasetId}`,
        { caseSensitive: false, datasetId, keyword, type: 'filter', version },
        { lane: 'latency' },
      ),
    release: (datasetId: string) =>
      runLatest(
        `release:${datasetId}`,
        { datasetId, type: 'release' },
        { lane: 'background' },
      ),
    sortAscii: (datasetId: string, labels: string[], ascending: boolean) =>
      runLatest(
        'sort',
        { ascending, datasetId, labels, type: 'sort-ascii' },
        { lane: 'throughput' },
      ),
    sortNumbers: (
      datasetId: string,
      values: Float64Array,
      ascending: boolean,
      changedStart?: number,
    ) =>
      runLatest(
        'sort',
        { ascending, changedStart, datasetId, type: 'sort-number', values },
        { lane: 'throughput', transfer: [values.buffer] },
      ),
    strategy: fsusDataPipelineStrategy,
  }
}
