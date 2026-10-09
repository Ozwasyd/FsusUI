import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
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
const declarations = script.statements.filter(
  (statement) =>
    ts.isVariableStatement(statement) &&
    statement.declarationList.declarations.some(
      (declaration) => declaration.name.getText(script) === 'workerProbe',
    ),
)
assert.equal(declarations.length, 1, 'select exactly one actual workerProbe')
const probe = ts.transpileModule(declarations[0].getText(script), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

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
