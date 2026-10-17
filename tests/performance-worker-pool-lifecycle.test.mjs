import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { URL } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'

const fixture = readFileSync(
  new URL(
    '../vue/packages/demo-app/src/PerformanceFixture.vue',
    import.meta.url,
  ),
  'utf8',
)
const { descriptor } = parse(fixture)
const script = ts.createSourceFile(
  'PerformanceFixture.ts',
  descriptor.scriptSetup.content,
  ts.ScriptTarget.ES2022,
  true,
)
const declaration = (name) =>
  script.statements.find(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (item) => item.name.getText(script) === name,
      ),
  )
assert.ok(
  declaration('createBurstWorker') && declaration('workerPoolBurstProbe'),
)
const source = ts.transpileModule(
  script.text.slice(
    (
      declaration('workerPoolBurstCancels') ?? declaration('createBurstWorker')
    ).getStart(script),
    declaration('workerPoolBurstProbe').end,
  ),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText

function loadModule(relative, require, globals) {
  const module = { exports: {} }
  const output = ts.transpileModule(
    readFileSync(new URL(relative, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    },
  ).outputText
  runInNewContext(output, {
    exports: module.exports,
    module,
    require,
    ...globals,
  })
  return module.exports
}

function harness({
  workerFault,
  poolFault,
  realPool = false,
  scenario = 'select-v2',
} = {}) {
  const state = {
    workers: [],
    urls: new Set(),
    unmount: [],
    pools: [],
    clock: 0,
    timers: new Set(),
    listeners: new Set(),
  }
  const context = {
    props: { scenario },
    onBeforeUnmount: (callback) => state.unmount.push(callback),
    performance: { now: () => ++state.clock },
    Blob: class {
      constructor(parts) {
        this.source = parts.join('')
      }
    },
    URL: {
      createObjectURL: (blob) => {
        const url = `blob:${state.workers.length}`
        state.urls.add(url)
        state.lastSource = blob.source
        return url
      },
      revokeObjectURL: (url) => state.urls.delete(url),
    },
    Worker: class {
      constructor() {
        if (workerFault === 'constructor') throw Error('constructor failed')
        if (workerFault === 'pool-constructor' && state.workers.length > 0)
          throw Error('pool Worker failed')
        this.terminations = 0
        this.messages = []
        state.workers.push(this)
      }
      postMessage(message) {
        if (workerFault === 'post') throw Error('post failed')
        if (workerFault === 'pool-post' && this !== state.workers[0])
          throw Error('pool post failed')
        this.messages.push(message)
      }
      terminate() {
        this.terminations++
      }
    },
    createFsusWorkerExecutor: (_factory, options) => {
      if (poolFault === 'constructor')
        throw Error('executor constructor failed')
      const pool = {
        disposals: 0,
        requests: [],
        options,
        run(request, runOptions) {
          if (poolFault === 'run' && this.requests.length === 2)
            throw Error('run failed')
          let resolve, reject
          const promise = new Promise((yes, no) => {
            resolve = yes
            reject = no
          })
          this.requests.push({ request, runOptions, resolve, reject })
          if (poolFault === 'reject' && this.requests.length === 2)
            reject(Error('request failed'))
          return promise
        },
        dispose() {
          this.disposals++
          for (const request of this.requests)
            request.reject(Error('executor disposed'))
        },
        complete() {
          for (const [index, request] of this.requests.entries()) {
            options.onEvent({ type: 'request-resolve', queueDepth: index })
            request.resolve({ ok: true, value: 1 })
          }
        },
      }
      state.pools.push(pool)
      return pool
    },
  }
  if (realPool) {
    const utils = loadModule('../vue/packages/utils/result.ts', undefined, {})
    const poolModule = loadModule(
      '../vue/packages/hooks/use-render-pipeline/worker-pool.ts',
      (name) => {
        assert.equal(name, '@element-plus/utils')
        return utils
      },
      {
        performance: context.performance,
        navigator: { hardwareConcurrency: 8 },
        setTimeout: (callback) => {
          state.timers.add(callback)
          return callback
        },
        clearTimeout: (callback) => state.timers.delete(callback),
        document: {
          addEventListener: (_type, callback) => state.listeners.add(callback),
          removeEventListener: (_type, callback) =>
            state.listeners.delete(callback),
        },
      },
    )
    context.createFsusWorkerExecutor = (factory, options) => {
      const pool = poolModule.createFsusWorkerExecutor(factory, options)
      const dispose = pool.dispose
      pool.disposals = 0
      pool.dispose = () => {
        pool.disposals++
        dispose()
      }
      state.pools.push(pool)
      return pool
    }
  }
  const invoke = runInNewContext(`${source}\nworkerPoolBurstProbe`, context)
  const start = () => {
    const result = { status: 'pending', settlements: 0 }
    result.promise = invoke().then(
      (value) => {
        Object.assign(result, { status: 'resolved', value })
        result.settlements++
      },
      (error) => {
        Object.assign(result, { status: 'rejected', error: error.message })
        result.settlements++
      },
    )
    return result
  }
  const legacyComplete = (index = 0) =>
    state.workers[index].onmessage({ data: { id: 12 } })
  const unmount = () => state.unmount.forEach((callback) => callback())
  return { state, start, legacyComplete, unmount }
}

test('burst Worker constructor failure revokes its object URL', async () => {
  const { state, start } = harness({ workerFault: 'constructor' })
  const result = start()
  await result.promise
  assert.equal(result.error, 'constructor failed')
  assert.equal(state.urls.size, 0)
  assert.equal(state.workers.length, 0)
})

test('legacy postMessage failure rejects and terminates its Worker', async () => {
  const { state, start } = harness({ workerFault: 'post' })
  const result = start()
  await result.promise
  assert.equal(result.error, 'post failed')
  assert.equal(state.workers[0].terminations, 1)
  assert.equal(state.urls.size, 0)
  assert.equal(state.pools.length, 0)
})

for (const event of ['error', 'messageerror']) {
  test(`legacy ${event} rejects and terminates without starting the pool`, async () => {
    const { state, start } = harness()
    const result = start()
    let prevented = false
    state.workers[0][`on${event}`]?.({
      message: 'worker failed',
      preventDefault() {
        prevented = true
      },
    })
    await setImmediate()
    assert.equal(result.status, 'rejected')
    assert.equal(state.workers[0].terminations, 1)
    assert.equal(state.pools.length, 0)
    if (event === 'error') assert.ok(prevented)
  })
}

test('executor construction failure retains no legacy Worker', async () => {
  const { state, start, legacyComplete } = harness({ poolFault: 'constructor' })
  const result = start()
  legacyComplete()
  await result.promise
  assert.equal(result.error, 'executor constructor failed')
  assert.equal(state.workers[0].terminations, 1)
  assert.equal(state.urls.size, 0)
  assert.equal(state.pools.length, 0)
})

for (const poolFault of ['run', 'reject']) {
  test(`injected pool ${poolFault} failure disposes the executor and observes pending requests`, async () => {
    const { state, start, legacyComplete } = harness({ poolFault })
    const result = start()
    legacyComplete()
    await result.promise
    assert.equal(
      result.error,
      poolFault === 'run' ? 'run failed' : 'request failed',
    )
    assert.equal(state.pools[0].disposals, 1)
    await setImmediate() // Drain rejections from dispose; Node fails on unhandled rejection.
    assert.equal(result.settlements, 1)
  })
}

test('unmount cancels pending legacy calls and rejects retained stale APIs', async () => {
  const { state, start, unmount } = harness()
  const pending = [start(), start()]
  const late = state.workers.map((worker) => worker.onmessage)
  unmount()
  for (const callback of late) callback({ data: { id: 12 } })
  await setImmediate()
  assert.ok(
    pending.every(
      (result) => result.status === 'rejected' && result.settlements === 1,
    ),
  )
  assert.ok(state.workers.every((worker) => worker.terminations === 1))
  assert.equal(state.pools.length, 0)
  assert.equal(state.urls.size, 0)
  const stale = start()
  await setImmediate()
  assert.equal(stale.status, 'rejected')
  assert.equal(state.workers.length, 2)
})

test('unmount after legacy completion prevents the pending continuation from creating an executor', async () => {
  const { state, start, legacyComplete, unmount } = harness()
  const result = start()
  legacyComplete()
  unmount()
  await setImmediate()
  assert.equal(result.status, 'rejected')
  assert.equal(state.pools.length, 0)
  assert.equal(state.workers[0].terminations, 1)
})

test('unmount disposes concurrent pending pools and ignores late completion', async () => {
  const { state, start, legacyComplete, unmount } = harness()
  const pending = [start(), start()]
  legacyComplete(0)
  legacyComplete(1)
  await setImmediate()
  assert.equal(state.pools.length, 2)
  unmount()
  for (const pool of state.pools) pool.complete()
  await setImmediate()
  assert.ok(
    pending.every(
      (result) => result.status === 'rejected' && result.settlements === 1,
    ),
  )
  assert.ok(state.pools.every((pool) => pool.disposals === 1))
})

test('an older failure and finally cannot dispose the newer invocation pool', async () => {
  const { state, start, legacyComplete, unmount } = harness()
  const older = start()
  legacyComplete(0)
  await setImmediate()
  const newer = start()
  legacyComplete(1)
  await setImmediate()
  state.pools[0].requests[0].reject(Error('older failed'))
  await older.promise
  assert.equal(older.error, 'older failed')
  assert.equal(state.pools[0].disposals, 1)
  assert.equal(state.pools[1].disposals, 0)
  assert.equal(newer.status, 'pending')
  unmount()
  await setImmediate()
  assert.equal(newer.status, 'rejected')
  assert.equal(state.pools[1].disposals, 1)
})

test('an older successful finally leaves the newer legacy Worker owned until unmount', async () => {
  const { state, start, legacyComplete, unmount } = harness()
  const older = start()
  legacyComplete()
  await setImmediate()
  const newer = start()
  state.pools[0].complete()
  await older.promise
  assert.equal(older.status, 'resolved')
  assert.equal(state.workers[1].terminations, 0)
  unmount()
  await setImmediate()
  assert.equal(newer.status, 'rejected')
  assert.equal(state.workers[1].terminations, 1)
  assert.equal(state.pools.length, 1)
})

for (const scenario of ['select-v2', 'markdown-renderer']) {
  test(`repeated normal ${scenario} calls preserve 12 seeds, workload, pool sizing and metric formulas`, async () => {
    const { state, start, legacyComplete, unmount } = harness({ scenario })
    for (let index = 0; index < 3; index++) {
      const result = start()
      const worker = state.workers[index]
      assert.equal(worker.messages.length, 12)
      for (const [offset, message] of worker.messages.entries()) {
        assert.equal(message.id, offset + 1)
        assert.equal(message.type, 'run')
        assert.equal(message.request.seed, offset + 1)
        assert.equal(
          message.request.iterations,
          scenario.startsWith('markdown') ? 1_500_000 : 500_000,
        )
      }
      legacyComplete(index)
      await setImmediate()
      const pool = state.pools[index]
      assert.equal(pool.options.maxWorkers, 4)
      assert.equal(pool.options.maxQueue, 12)
      assert.equal(pool.requests.length, 12)
      for (const [offset, entry] of pool.requests.entries()) {
        assert.equal(entry.request.seed, offset + 1)
        assert.equal(
          entry.request.iterations,
          worker.messages[offset].request.iterations,
        )
        assert.equal(entry.runOptions.generation, offset + 1)
        assert.equal(entry.runOptions.key, `continuous-${scenario}`)
        assert.equal(entry.runOptions.lane, 'latency')
      }
      pool.complete()
      await result.promise
      assert.deepEqual(
        { ...result.value },
        {
          latestCompletions: 12,
          legacyInputMs: 1,
          maxQueueDepth: 11,
          poolInputMs: 1,
        },
      )
      assert.equal(pool.disposals, 1)
      assert.equal(worker.terminations, 1)
      assert.equal(worker.onmessage, null)
      assert.equal(worker.onerror, null)
      assert.equal(worker.onmessageerror, null)
      assert.equal(state.urls.size, 0)
    }
    unmount()
    assert.ok(state.pools.every((pool) => pool.disposals === 1))
  })
}

test('actual burst Worker body preserves checksum and compute clock calculation', async () => {
  const { state, start, unmount } = harness()
  const result = start()
  const messages = []
  const clocks = [21.25, 24.75]
  const workerRealm = {
    self: { postMessage: (data) => messages.push(data) },
    performance: { now: () => clocks.shift() },
  }
  runInNewContext(state.lastSource, workerRealm)
  workerRealm.self.onmessage({
    data: { type: 'run', id: 7, request: { seed: 7, iterations: 9 } },
  })
  let checksum = 7
  for (let index = 0; index < 9; index++)
    checksum = (checksum * 33 + index) >>> 0
  assert.equal(messages[0].result, checksum)
  assert.equal(messages[0].id, 7)
  assert.equal(messages[0].status, 'complete')
  assert.equal(messages[0].timings.computeDurationMs, 3.5)
  workerRealm.self.onmessage({ data: { type: 'cancel' } })
  assert.equal(messages.length, 1)
  assert.equal(clocks.length, 0)
  unmount()
  await setImmediate()
  assert.equal(result.status, 'rejected')
})

for (const workerFault of ['pool-constructor', 'pool-post']) {
  test(`real executor source preserves resolved FsusResult errors for ${workerFault} and releases resources`, async () => {
    const { state, start, legacyComplete } = harness({
      realPool: true,
      workerFault,
    })
    const result = start()
    legacyComplete()
    await result.promise
    assert.equal(
      result.status,
      'resolved',
      'existing result-valued errors remain unchanged',
    )
    assert.equal(result.value.latestCompletions, 0)
    assert.equal(state.pools[0].disposals, 1)
    assert.ok(state.workers.every((worker) => worker.terminations === 1))
    assert.equal(state.urls.size, 0)
    assert.equal(state.timers.size, 0)
    assert.equal(state.listeners.size, 0)
  })
}

test('real executor source unmount removes workers, request timers and visibility listener', async () => {
  const { state, start, legacyComplete, unmount } = harness({ realPool: true })
  const result = start()
  legacyComplete()
  await setImmediate()
  const pool = state.pools[0]
  assert.equal(pool.getWorkerCount(), 4)
  assert.ok(pool.getPendingCount() > 0)
  assert.ok(state.timers.size > 0)
  assert.equal(state.listeners.size, 1)
  unmount()
  await setImmediate()
  assert.equal(result.status, 'rejected')
  assert.equal(pool.disposals, 1)
  assert.equal(pool.getWorkerCount(), 0)
  assert.equal(pool.getPendingCount(), 0)
  assert.ok(state.workers.every((worker) => worker.terminations === 1))
  assert.equal(state.timers.size, 0)
  assert.equal(state.listeners.size, 0)
})
