export type FsusDataPipelinePath = 'js' | 'worker-wasm'

export type FsusDataPipelineSample = {
  commitMs: number
  computeMs: number
  copyMs: number
  count: number
  initializeMs: number
  path: FsusDataPipelinePath
  totalMs: number
}

type PathHistory = {
  fixedMs: number
  perItemMs: number
  samples: number
}

const defaultHistory = (): Record<FsusDataPipelinePath, PathHistory> => ({
  js: { fixedMs: 0.08, perItemMs: 0.0012, samples: 0 },
  'worker-wasm': { fixedMs: 3.5, perItemMs: 0.00012, samples: 0 },
})

export class FsusDataPipelineStrategy {
  private readonly history = defaultHistory()
  private frameBudgetMs = 8

  choose(count: number, workerAvailable: boolean): FsusDataPipelinePath {
    if (!workerAvailable) return 'js'
    const js = this.predict('js', count)
    const worker = this.predict('worker-wasm', count)
    return js > this.frameBudgetMs && worker < js ? 'worker-wasm' : 'js'
  }

  shouldChunkJs(count: number) {
    return this.predict('js', count) > this.frameBudgetMs
  }

  record(sample: FsusDataPipelineSample) {
    if (sample.count <= 0 || !Number.isFinite(sample.totalMs)) return
    const history = this.history[sample.path]
    const alpha = history.samples === 0 ? 1 : 0.25
    const observedFixed = Math.max(
      0,
      sample.initializeMs + sample.copyMs + sample.commitMs,
    )
    const observedPerItem = Math.max(
      0,
      sample.computeMs / Math.max(1, sample.count),
    )
    history.fixedMs += (observedFixed - history.fixedMs) * alpha
    history.perItemMs += (observedPerItem - history.perItemMs) * alpha
    history.samples += 1
  }

  observeFrame(durationMs: number) {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return
    this.frameBudgetMs = Math.max(4, Math.min(12, durationMs * 0.5))
  }

  snapshot() {
    return {
      frameBudgetMs: this.frameBudgetMs,
      js: { ...this.history.js },
      workerWasm: { ...this.history['worker-wasm'] },
    }
  }

  private predict(path: FsusDataPipelinePath, count: number) {
    const history = this.history[path]
    return history.fixedMs + history.perItemMs * Math.max(0, count)
  }
}

export const fsusDataPipelineStrategy = new FsusDataPipelineStrategy()
