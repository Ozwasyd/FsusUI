import { afterEach, describe, expect, it, vi } from 'vitest'

import { createFsusDataPipelineClient } from '../data-pipeline-client'
import { FsusDataPipelineStrategy } from '../data-pipeline-strategy'

class FakeDataWorker {
  static instances: FakeDataWorker[] = []
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  terminated = false
  transfers: Transferable[][] = []
  messages: any[] = []

  constructor() {
    FakeDataWorker.instances.push(this)
  }

  postMessage(message: any, transfer: Transferable[] = []) {
    this.messages.push(message)
    this.transfers.push(transfer)
    if (message.type === 'cancel') {
      queueMicrotask(() =>
        this.onmessage?.({
          data: {
            generation: message.generation,
            id: message.id,
            status: 'aborted',
          },
        } as MessageEvent),
      )
      return
    }
    if (message.request.type === 'sort-number') {
      const indices = Uint32Array.from([1, 0])
      queueMicrotask(() =>
        this.onmessage?.({
          data: { id: message.id, result: { indices, kind: 'indices' } },
        } as MessageEvent),
      )
      return
    }
    setTimeout(
      () =>
        this.onmessage?.({
          data: {
            id: message.id,
            result: {
              indices: Uint32Array.from([message.generation]),
              kind: 'indices',
            },
          },
        } as MessageEvent),
      5,
    )
  }

  terminate() {
    this.terminated = true
  }
}

describe('data pipeline worker client', () => {
  afterEach(() => {
    FakeDataWorker.instances = []
    vi.unstubAllGlobals()
  })

  it('propagates generation cancellation and commits only the latest query', async () => {
    vi.stubGlobal('Worker', FakeDataWorker)
    const client = createFsusDataPipelineClient('generation-test')
    const first = client.filter('options', 1, 'a')
    const second = client.filter('options', 1, 'ab')
    const [firstResult, secondResult] = await Promise.all([first, second])
    expect(firstResult).toBeNull()
    expect(secondResult).toMatchObject({ ok: true })
    expect(
      FakeDataWorker.instances.flatMap((worker) => worker.messages),
    ).toContainEqual(expect.objectContaining({ type: 'cancel' }))
    client.dispose()
    expect(FakeDataWorker.instances.every((worker) => worker.terminated)).toBe(
      true,
    )
  })

  it('transfers numeric input buffers instead of cloning full row objects', async () => {
    vi.stubGlobal('Worker', FakeDataWorker)
    const client = createFsusDataPipelineClient('transfer-test')
    const values = Float64Array.from([2, 1])
    const result = await client.sortNumbers('rows', values, true)
    expect(result).toMatchObject({ ok: true })
    const worker = FakeDataWorker.instances[0]!
    const runIndex = worker.messages.findIndex(
      (message) => message.request?.type === 'sort-number',
    )
    expect(worker.transfers[runIndex]).toEqual([values.buffer])
    expect((result as any).value.indices).toEqual(Uint32Array.from([1, 0]))
    client.dispose()
  })

  it('cancels the previous sort generation even when the dataset key changes', async () => {
    vi.stubGlobal('Worker', FakeDataWorker)
    const client = createFsusDataPipelineClient('sort-generation-test')
    const first = client.sortNumbers(
      'score-v1',
      Float64Array.from([2, 1]),
      true,
    )
    const second = client.sortAscii('name-v2', ['beta', 'alpha'], true)

    const [firstResult, secondResult] = await Promise.all([first, second])
    expect(firstResult).toBeNull()
    expect(secondResult).toMatchObject({ ok: true })
    expect(
      FakeDataWorker.instances.flatMap((worker) => worker.messages),
    ).toContainEqual(expect.objectContaining({ type: 'cancel' }))
    client.dispose()
  })

  it('adapts end-to-end decisions from observed initialization and commit cost', () => {
    const strategy = new FsusDataPipelineStrategy()
    expect(strategy.choose(100_000, true)).toBe('worker-wasm')
    strategy.record({
      commitMs: 20,
      computeMs: 20,
      copyMs: 20,
      count: 100_000,
      initializeMs: 20,
      path: 'worker-wasm',
      totalMs: 80,
    })
    strategy.record({
      commitMs: 0.1,
      computeMs: 1,
      copyMs: 0.1,
      count: 100_000,
      initializeMs: 0.1,
      path: 'js',
      totalMs: 1.3,
    })
    expect(strategy.choose(100_000, true)).toBe('js')
  })
})
