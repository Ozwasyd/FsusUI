import { afterEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  time: 0,
  available: true,
  worker: vi.fn(),
  record: vi.fn(),
  choose: vi.fn(() => 'worker-wasm'),
}))
vi.mock('@element-plus/wasm', () => ({
  createAsciiFilterIndex: vi.fn(),
  ensureWasmReady: vi.fn(),
  isWasmReady: vi.fn(),
  sortAsciiIndicesSync: vi.fn(),
  sortNumberIndicesSync: vi.fn(),
  warmupWasm: vi.fn(),
}))
vi.mock('../../_internal/data-pipeline-client', () => ({
  canUseDataPipelineWorker: () => mock.available,
  createFsusDataPipelineClient: () => ({
    sortNumbers: mock.worker,
    sortAscii: mock.worker,
    cancelSort: vi.fn(),
    dispose: vi.fn(),
    release: vi.fn(),
  }),
}))
vi.mock('../../_internal/data-pipeline-strategy', () => ({
  fsusDataPipelineStrategy: { choose: mock.choose, record: mock.record },
}))
import { createWasmSortController } from '../src/composables/use-wasm-sort'
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  mock.time = 0
  mock.available = true
})
const clock = () =>
  vi.spyOn(performance, 'now').mockImplementation(() => mock.time)
const rows = [
  { id: 0, score: 2 },
  { id: 1, score: 1 },
  { id: 2, score: 2 },
]
it('does not charge a failed worker wait to JS fallback cost', async () => {
  clock()
  mock.worker.mockImplementation(async () => {
    mock.time += 500
    return { ok: false, error: new Error('worker unavailable') }
  })
  const controller = createWasmSortController('failed-worker')
  const result = await controller.sort(rows, 'score', true)
  expect([...result!].map((r) => r.id)).toEqual([1, 0, 2])
  expect(mock.record).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ path: 'js', computeMs: 0, totalMs: 0 }),
  )
  controller.dispose()
})
it('retains successful worker end-to-end timing and ordering', async () => {
  clock()
  mock.worker.mockImplementation(async () => {
    mock.time += 12
    return { ok: true, value: { indices: Uint32Array.from([1, 0, 2]) } }
  })
  const controller = createWasmSortController('worker')
  const result = await controller.sort(rows, 'score', true)
  expect([...result!].map((r) => r.id)).toEqual([1, 0, 2])
  expect(mock.record).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      path: 'worker-wasm',
      computeMs: 12,
      totalMs: 12,
    }),
  )
  controller.dispose()
})
it('does not record canceled worker completions or fall back', async () => {
  clock()
  const controller = createWasmSortController('canceled')
  mock.worker.mockImplementation(async () => {
    mock.time += 500
    controller.cancel()
    return { ok: false, error: new Error('canceled') }
  })
  expect(await controller.sort(rows, 'score', true)).toBeNull()
  expect(mock.record).not.toHaveBeenCalled()
  controller.dispose()
})
it('explicit JS preserves descending stable ties without a worker call', async () => {
  clock()
  const controller = createWasmSortController('js')
  const result = await controller.sort(rows, 'score', false, { path: 'js' })
  expect([...result!].map((r) => r.id)).toEqual([0, 2, 1])
  expect(mock.worker).not.toHaveBeenCalled()
  expect(mock.record).toHaveBeenCalledWith(
    expect.objectContaining({ path: 'js' }),
  )
  controller.dispose()
})
