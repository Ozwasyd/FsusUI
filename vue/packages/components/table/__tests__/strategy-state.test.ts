import { expect, it } from 'vitest'
import { FsusDataPipelineStrategy } from '../../_internal/data-pipeline-strategy'
it('explains cold worker cost and forced probe updates without changing the policy', () => {
  const strategy = new FsusDataPipelineStrategy()
  const record = (path: 'js' | 'worker-wasm', totalMs: number) =>
    strategy.record({
      path,
      totalMs,
      computeMs: totalMs,
      initializeMs: 0,
      copyMs: 0,
      commitMs: 0,
      count: 100_000,
    })
  expect(strategy.choose(100_000, true)).toBe('worker-wasm')
  record('worker-wasm', 500) // cold warmup: first observation replaces prior
  expect(strategy.snapshot().workerWasm.perItemMs * 100_000).toBe(500)
  expect(strategy.choose(100_000, true)).toBe('js')
  record('js', 300) // first measured action
  record('worker-wasm', 20) // existing forced post-sample probe
  expect(strategy.snapshot().workerWasm.perItemMs * 100_000).toBeCloseTo(380)
  expect(strategy.choose(100_000, true)).toBe('js')
  record('js', 300)
  record('worker-wasm', 20)
  expect(strategy.snapshot().workerWasm.perItemMs * 100_000).toBeCloseTo(290)
  expect(strategy.choose(100_000, true)).toBe('worker-wasm')
})
