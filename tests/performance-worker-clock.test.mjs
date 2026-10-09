import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { setImmediate } from 'node:timers'
import { fileURLToPath, URL } from 'node:url'
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
const declarations = script.statements.filter(
  (statement) =>
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(
      (declaration) => declaration.name.getText(script) === 'workerProbe',
    ),
)
assert.equal(declarations.length, 1, 'select exactly one actual workerProbe')
const lifecycleStart =
  script.statements.find(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          declaration.name.getText(script) === 'workerProbeCancels',
      ),
  ) ?? declarations[0]
const probe = ts.transpileModule(
  script.text.slice(lifecycleStart.getStart(script), declarations[0].end),
  {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  },
).outputText

async function runProbe(
  { windowOrigin, workerOrigin, queued, received, computed, completed },
  iteration = 0,
) {
  let source
  let terminated = false
  let revoked = false
  const windowTimes = [queued, completed]
  const workerTimes = [received, computed]
  class ProbeWorker {
    constructor(url) {
      assert.equal(url, 'blob:worker-clock-test')
      this.realm = {
        performance: {
          timeOrigin: workerOrigin,
          now: () => workerTimes.shift(),
        },
        self: { postMessage: (data) => this.onmessage({ data }) },
      }
      runInNewContext(source, this.realm)
    }
    postMessage(payload) {
      assert.equal(payload.length, 16_384 + iteration * 17)
      this.realm.self.onmessage({ data: payload })
    }
    terminate() {
      terminated = true
    }
  }
  const result = await runInNewContext(`${probe}\nworkerProbe(${iteration})`, {
    onBeforeUnmount: () => {},
    performance: { timeOrigin: windowOrigin, now: () => windowTimes.shift() },
    Blob: class {
      constructor(parts) {
        source = parts.join('')
      }
    },
    URL: {
      createObjectURL: () => 'blob:worker-clock-test',
      revokeObjectURL: () => {
        revoked = true
      },
    },
    Worker: ProbeWorker,
    Uint32Array,
  })
  assert.ok(terminated && revoked, 'preserve worker and object URL cleanup')
  assert.equal(windowTimes.length, 0)
  assert.equal(workerTimes.length, 0)
  return { ...result }
}

for (const [name, clocks] of [
  [
    'worker created later than window',
    {
      windowOrigin: 1_700_000_000_000,
      workerOrigin: 1_700_000_009_950,
      queued: 10_000,
      received: 60,
      computed: 62,
      completed: 10_015,
    },
  ],
  [
    'worker origin earlier than window',
    {
      windowOrigin: 1_700_000_009_950,
      workerOrigin: 1_700_000_000_000,
      queued: 100,
      received: 10_060,
      computed: 10_062,
      completed: 115,
    },
  ],
  [
    'equal time origins',
    {
      windowOrigin: 1_700_000_000_000,
      workerOrigin: 1_700_000_000_000,
      queued: 100,
      received: 110,
      computed: 112,
      completed: 115,
    },
  ],
]) {
  test(`worker probe preserves queue/compute/transfer: ${name}`, async () => {
    for (const iteration of [0, 20]) {
      const result = await runProbe(clocks, iteration)
      assert.deepEqual(result, { queueWaitMs: 10, computeMs: 2, transferMs: 3 })
      assert.equal(
        Object.values(result).reduce((sum, value) => sum + value, 0),
        clocks.completed - clocks.queued,
      )
    }
  })
}

test('worker probe preserves zero-duration coarsened timestamps', async () => {
  assert.deepEqual(
    await runProbe({
      windowOrigin: 1000,
      workerOrigin: 1100,
      queued: 100,
      received: 0,
      computed: 0,
      completed: 100,
    }),
    {
      queueWaitMs: 0,
      computeMs: 0,
      transferMs: 0,
    },
  )
})

function lifecycleProbe(mode = 'pending') {
  const state = { workers: [], urls: new Set(), unmount: [], status: 'pending' }
  class ProbeWorker {
    constructor() {
      if (mode === 'constructor') throw new Error('constructor failed')
      this.terminations = 0
      state.workers.push(this)
    }
    postMessage() {
      if (mode === 'post') throw new Error('post failed')
    }
    terminate() {
      this.terminations++
    }
  }
  const invoke = runInNewContext(`${probe}\nworkerProbe`, {
    onBeforeUnmount: (callback) => state.unmount.push(callback),
    performance: { timeOrigin: 1000, now: () => 100 },
    Blob: class {},
    URL: {
      createObjectURL: () => {
        state.urls.add('blob:lifecycle')
        return 'blob:lifecycle'
      },
      revokeObjectURL: (url) => state.urls.delete(url),
    },
    Worker: ProbeWorker,
    Uint32Array,
  })
  const start = (iteration = 0) => {
    const result = { status: 'pending' }
    invoke(iteration).then(
      () => {
        result.status = 'resolved'
      },
      (error) => {
        result.status = 'rejected'
        result.error = error.message
      },
    )
    return result
  }
  return { state, start }
}

test(
  'actual Chromium fixture worker lifecycle releases errors, repeated runs and component unmount',
  {
    skip: !process.env.FSUSUI_WORKER_CLOCK_BROWSER_URL,
    timeout: 120_000,
  },
  async (context) => {
    const target = new URL(process.env.FSUSUI_WORKER_CLOCK_BROWSER_URL)
    assert.equal(target.searchParams.get('performance'), 'virtual-grid')
    assert.equal(target.searchParams.get('size'), '100000')
    assert.equal(target.searchParams.get('motion'), 'disabled')
    const root = fileURLToPath(new URL('..', import.meta.url))
    mkdirSync(path.join(root, '.tmp'), { recursive: true })
    const directory = mkdtempSync(
      path.join(root, '.tmp', 'worker-probe-lifecycle-'),
    )
    const harness = path.join(directory, 'fixture.mjs')
    writeFileSync(
      harness,
      `
import { createApp, nextTick } from 'vue'
import { createDemoContract, resolveDemoLocale, resolveDemoRoot } from '/src/demo-contract.ts'
const { component, props, themeMode } = await resolveDemoRoot(new URLSearchParams(location.search))
if (props.scenario !== 'virtual-grid' || props.size !== 100000 || props.motion !== 'disabled') throw new Error('Wrong lifecycle fixture selection')
let app
async function mount() {
  app = createApp(component, props).use(createDemoContract(themeMode, resolveDemoLocale()))
  app.mount('#app')
  await nextTick()
}
window.__workerProbeLifecycleHarness = { mount, unmount: () => app.unmount() }
await mount()
`,
    )
    const { chromium } = await import('@playwright/test')
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
      })
      await page.route('**/worker-probe-lifecycle.html?*', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: `<div id="app"></div><script type="module" src="/@fs${harness}"></script>`,
        }),
      )
      target.pathname = '/worker-probe-lifecycle.html'
      await page.goto(target.href)
      await page.locator('[data-performance-ready="true"]').waitFor()
      const evidence = await page.evaluate(async () => {
        const fixture = window.__FSUSUI_PERFORMANCE_FIXTURE__
        for (const name of [
          'act',
          'workerProbe',
          'workerPoolBurstProbe',
          'wasmProbe',
          'markdownPhaseProbe',
          'dataPipelineProbe',
        ]) {
          if (typeof fixture?.[name] !== 'function')
            throw new Error(`Missing original fixture hook: ${name}`)
        }
        const NativeWorker = window.Worker
        const NativeBlob = window.Blob
        const nativeCreate = window.URL.createObjectURL.bind(window.URL)
        const nativeRevoke = window.URL.revokeObjectURL.bind(window.URL)
        const workers = new Set()
        const urls = new Set()
        const nativeErrors = []
        let mode = 'normal'
        let creationAttempts = 0
        window.URL.createObjectURL = (blob) => {
          const url = nativeCreate(blob)
          urls.add(url)
          return url
        }
        window.URL.revokeObjectURL = (url) => {
          urls.delete(url)
          nativeRevoke(url)
        }
        window.Blob = class extends NativeBlob {
          constructor(parts, options) {
            const suffix =
              mode === 'error'
                ? '\nthrow new Error("worker_probe_forced_error")'
                : mode === 'pending'
                  ? '\nself.onmessage = () => {}'
                  : ''
            super([...parts, suffix], options)
          }
        }
        window.Worker = class extends NativeWorker {
          constructor(url, options) {
            creationAttempts++
            // A different local origin forces a real native SecurityError without a request.
            super(
              mode === 'constructor' ? 'http://127.0.0.1:1/worker.js' : url,
              options,
            )
            workers.add(this)
            this.addEventListener('error', (event) =>
              nativeErrors.push(event.message),
            )
          }
          postMessage(...args) {
            if (mode === 'post') return super.postMessage(() => {})
            return super.postMessage(...args)
          }
          terminate() {
            workers.delete(this)
            super.terminate()
          }
        }
        const observe = (promise) => {
          const result = { status: 'pending' }
          const settled = promise.then(
            (value) => {
              result.status = 'resolved'
              result.value = value
            },
            (error) => {
              result.status = 'rejected'
              result.error = { name: error.name, message: error.message }
            },
          )
          return { result, settled }
        }
        const wait = (observed) =>
          Promise.race([
            observed.settled,
            new Promise((resolve) => window.setTimeout(resolve, 500)),
          ])
        const results = []
        try {
          for (const failure of [
            'constructor',
            'post',
            'allocation',
            'error',
          ]) {
            mode = failure
            const observed = observe(
              fixture.workerProbe(failure === 'allocation' ? -1000 : 0),
            )
            await wait(observed)
            results.push({
              case: failure,
              ...observed.result,
              liveWorkers: workers.size,
              activeUrls: urls.size,
            })
          }
          for (let round = 0; round < 2; round++) {
            mode = 'normal'
            const current = window.__FSUSUI_PERFORMANCE_FIXTURE__
            for (const iteration of [0, 10, 20]) {
              const observed = observe(current.workerProbe(iteration))
              await wait(observed)
              results.push({
                case: 'normal',
                round,
                iteration,
                ...observed.result,
                liveWorkers: workers.size,
                activeUrls: urls.size,
              })
            }
            mode = 'pending'
            const pending = [0, 1, 2].map((iteration) =>
              observe(current.workerProbe(iteration)),
            )
            window.__workerProbeLifecycleHarness.unmount()
            await Promise.all(pending.map(wait))
            const attemptsBeforeStaleCall = creationAttempts
            const stale = observe(current.workerProbe(0))
            await wait(stale)
            results.push({
              case: 'unmount',
              round,
              pending: pending.map((entry) => entry.result),
              stale: stale.result,
              staleCreatedWorkers: creationAttempts - attemptsBeforeStaleCall,
              liveWorkers: workers.size,
              activeUrls: urls.size,
              apiRemoved: !window.__FSUSUI_PERFORMANCE_FIXTURE__,
            })
            if (round === 0) await window.__workerProbeLifecycleHarness.mount()
          }
          return { results, nativeErrors, creationAttempts }
        } finally {
          for (const worker of workers) worker.terminate()
          for (const url of urls) nativeRevoke(url)
          window.Worker = NativeWorker
          window.Blob = NativeBlob
          window.URL.createObjectURL = nativeCreate
          window.URL.revokeObjectURL = nativeRevoke
        }
      })
      context.diagnostic(
        JSON.stringify({
          browser: browser.version(),
          fixtureUrl: target.href,
          evidence,
        }),
      )
      assert.equal(evidence.results.length, 12)
      assert.ok(
        evidence.nativeErrors.includes(
          'Uncaught Error: worker_probe_forced_error',
        ),
      )
      for (const result of evidence.results) {
        assert.equal(result.liveWorkers, 0, `${result.case}: no live Worker`)
        assert.equal(result.activeUrls, 0, `${result.case}: no object URL`)
        if (result.case === 'unmount') {
          assert.ok(
            result.pending.every((entry) => entry.status === 'rejected'),
          )
          assert.equal(result.stale.status, 'rejected')
          assert.equal(result.staleCreatedWorkers, 0)
          assert.ok(result.apiRemoved)
        } else
          assert.equal(
            result.status,
            result.case === 'normal' ? 'resolved' : 'rejected',
          )
      }
    } finally {
      await browser.close()
      rmSync(directory, { recursive: true, force: true })
    }
  },
)

for (const mode of ['constructor', 'post', 'allocation']) {
  test(`worker probe lifecycle cleans up synchronous ${mode} failure`, async () => {
    const { state, start } = lifecycleProbe(mode)
    const result = start(mode === 'allocation' ? -1000 : 0)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(result.status, 'rejected')
    assert.equal(state.urls.size, 0)
    assert.ok(state.workers.every((worker) => worker.terminations === 1))
  })
}

for (const event of ['error', 'messageerror']) {
  test(`worker probe lifecycle rejects and releases resources on ${event}`, async () => {
    const { state, start } = lifecycleProbe()
    const result = start()
    const worker = state.workers[0]
    worker[`on${event}`]?.({ message: 'worker failed', preventDefault() {} })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(result.status, 'rejected')
    assert.equal(worker.terminations, 1)
    assert.equal(state.urls.size, 0)
  })
}

test('worker probe lifecycle cancels concurrent pending probes on unmount and rejects stale calls', async () => {
  const { state, start } = lifecycleProbe()
  const pending = [start(0), start(1), start(2)]
  for (const unmount of state.unmount) unmount()
  await new Promise((resolve) => setImmediate(resolve))
  assert.ok(pending.every((result) => result.status === 'rejected'))
  assert.ok(state.workers.every((worker) => worker.terminations === 1))
  const stale = start()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(stale.status, 'rejected')
  assert.equal(state.workers.length, 3)
  assert.equal(state.urls.size, 0)
})

test('worker probe lifecycle ignores a queued completion after cancellation', async () => {
  const { state, start } = lifecycleProbe()
  const result = start()
  const worker = state.workers[0]
  const queuedCompletion = worker.onmessage
  for (const unmount of state.unmount) unmount()
  queuedCompletion({ data: { timeOrigin: 1000, received: 101, computed: 102 } })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(result.status, 'rejected')
  assert.equal(worker.terminations, 1)
  assert.equal(worker.onmessage, null)
  assert.equal(worker.onerror, null)
  assert.equal(worker.onmessageerror, null)
})

test('worker probe preserves fractional compute and reports epoch rounding without clamping', async () => {
  const windowOrigin = 1_700_000_000_000
  const result = await runProbe({
    windowOrigin,
    workerOrigin: windowOrigin + 100.1,
    queued: 100,
    received: 0,
    computed: 0.25,
    completed: 100.35,
  })
  const epochRoundingMs = 2 * Number.EPSILON * windowOrigin
  assert.ok(Math.abs(result.queueWaitMs - 0.1) <= epochRoundingMs)
  assert.equal(result.computeMs, 0.25)
  assert.ok(result.transferMs < 0 && result.transferMs >= -epochRoundingMs)
  assert.ok(
    Math.abs(result.queueWaitMs + result.computeMs + result.transferMs - 0.35) <
      1e-9,
  )
})

test(
  'actual Chromium fixture worker probe agrees with same-window elapsed time',
  {
    skip: !process.env.FSUSUI_WORKER_CLOCK_BROWSER_URL,
    timeout: 120_000,
  },
  async (context) => {
    const { chromium } = await import('@playwright/test')
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
      })
      await page.goto(process.env.FSUSUI_WORKER_CLOCK_BROWSER_URL)
      await page.locator('[data-performance-ready="true"]').waitFor()
      const evidence = await page.evaluate(async () => {
        const fixture = window.__FSUSUI_PERFORMANCE_FIXTURE__
        const performance = window.performance
        for (const name of [
          'act',
          'workerProbe',
          'workerPoolBurstProbe',
          'wasmProbe',
          'markdownPhaseProbe',
          'dataPipelineProbe',
        ]) {
          if (typeof fixture?.[name] !== 'function')
            throw new Error(`Missing original fixture hook: ${name}`)
        }
        const results = []
        for (const iteration of [0, 10, 20]) {
          const marks = []
          const descriptor = Object.getOwnPropertyDescriptor(performance, 'now')
          const nativeNow = performance.now.bind(performance)
          Object.defineProperty(performance, 'now', {
            configurable: true,
            value: () => {
              const value = nativeNow()
              marks.push(value)
              return value
            },
          })
          try {
            const result = await fixture.workerProbe(iteration)
            results.push({
              iteration,
              ...result,
              windowMarks: marks,
              windowTimeOrigin: performance.timeOrigin,
            })
          } finally {
            if (descriptor)
              Object.defineProperty(performance, 'now', descriptor)
            else delete performance.now
          }
        }
        return results
      })
      context.diagnostic(
        JSON.stringify({
          browser: browser.version(),
          fixtureUrl: process.env.FSUSUI_WORKER_CLOCK_BROWSER_URL,
          evidence,
        }),
      )
      assert.equal(evidence.length, 3)
      for (const result of evidence) {
        assert.equal(
          result.windowMarks.length,
          2,
          'actual queued and completed window timestamps',
        )
        // Subtracting two epoch-sized doubles can introduce sub-microsecond
        // rounding. Keep that bound explicit rather than clamping the telemetry.
        const epochRoundingMs = 2 * Number.EPSILON * result.windowTimeOrigin
        const elapsed = result.windowMarks[1] - result.windowMarks[0]
        for (const name of ['queueWaitMs', 'computeMs', 'transferMs']) {
          assert.ok(
            Number.isFinite(result[name]) &&
              result[name] >= -epochRoundingMs &&
              result[name] <= elapsed + epochRoundingMs,
            `${name} must be finite and within same-window elapsed time, allowing only epoch rounding`,
          )
        }
        const total = result.queueWaitMs + result.computeMs + result.transferMs
        assert.ok(
          Math.abs(total - elapsed) < 0.001,
          'phase sum agrees with same-window elapsed time to 1 microsecond',
        )
      }
    } finally {
      await browser.close()
    }
  },
)
