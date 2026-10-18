import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'
import { collectDataPipelineProbes } from '../scripts/render-performance-data-pipeline-probe.mjs'
import {
  createImpactPlan,
  loadOwnershipRegistry,
} from '../scripts/render-performance-impact.mjs'

test('comparison rejects mixed observation protocols and retains the original budget', async () => {
  const root = path.resolve(import.meta.dirname, '..')
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), 'fsus-probe-contract-'),
  )
  const protocol = 'isolated-context-after-measurement-v1'
  const plan = createImpactPlan({
    changedFiles: ['vue/packages/demo-app/src/PerformanceFixture.vue'],
    registry: await loadOwnershipRegistry(root),
  })
  const directories = ['base', 'head', 'base-repeat', 'head-repeat'].map(
    (name) => path.join(temporary, name),
  )
  const run = promisify(execFile)
  const compare = () =>
    run(process.execPath, [
      path.join(root, 'scripts/compare-render-performance.mjs'),
      directories[0],
      directories[1],
      '0.15',
      directories[2],
      directories[3],
    ])
  const write = async (protocols, values = [100, 100, 100, 100]) => {
    for (const [index, directory] of directories.entries()) {
      await mkdir(path.join(directory, 'web'), { recursive: true })
      await writeFile(
        path.join(directory, 'impact-plan.json'),
        JSON.stringify(plan),
      )
      await writeFile(
        path.join(directory, 'web/summary.json'),
        JSON.stringify({
          dataPipelineObservation: protocols[index],
          results: [
            {
              id: 'data-pipeline-table',
              inputToNextFrameMs: { p95: values[index] },
            },
          ],
        }),
      )
    }
  }
  try {
    await write([undefined, undefined, undefined, undefined])
    await compare()
    await write([protocol, protocol, protocol, protocol])
    await compare()
    await write([undefined, protocol, undefined, protocol])
    await assert.rejects(compare(), /observation protocol differs/u)
    await write([protocol, protocol, undefined, protocol])
    await assert.rejects(compare(), /observation protocol differs/u)
    await write([protocol, protocol, protocol, protocol], [100, 116, 100, 116])
    await assert.rejects(
      compare(),
      /Relative real-render performance regressions/u,
    )
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})

test('closes the diagnostic context when its original action rejects', async () => {
  const failure = new Error('real action failed')
  let closed = false
  const browser = {
    newContext: async () => ({
      close: async () => {
        closed = true
      },
      newPage: async () => ({
        goto: async () => {},
        locator: () => ({ waitFor: async () => {} }),
        evaluate: async () => {
          throw failure
        },
      }),
    }),
  }
  await assert.rejects(
    collectDataPipelineProbes({
      browser,
      url: 'http://fixture',
      warmups: 1,
      samples: 21,
    }),
    (error) => error === failure,
  )
  assert.equal(closed, true)
})

test('collects data-pipeline evidence after production metric capture and teardown', async () => {
  const source = await readFile(
    new URL('../scripts/web-render-performance.mjs', import.meta.url),
    'utf8',
  )
  const capture = source.indexOf('const pageMetrics = await page.evaluate(')
  const teardown = source.indexOf('await context.close()', capture)
  const diagnostic = source.indexOf('await collectDataPipelineProbes(')
  assert.ok(capture > 0 && teardown > capture && diagnostic > teardown)
  assert.equal(
    source.includes('.__FSUSUI_PERFORMANCE_FIXTURE__.dataPipelineProbe()'),
    false,
  )
})

const browserUrl = process.env.FSUSUI_DATA_PIPELINE_BROWSER_URL
test(
  'real fixture evidence cannot train a subsequent production auto sort',
  { skip: !browserUrl, timeout: 120_000 },
  async (t) => {
    const { chromium } = await import('@playwright/test')
    const browser = await chromium.launch({ headless: true })
    try {
      const contextOptions = {
        deviceScaleFactor: 2,
        reducedMotion: 'reduce',
        viewport: { width: 1280, height: 800 },
      }
      const context = await browser.newContext(contextOptions)
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      const url = new URL(
        '/?performance=data-pipeline-table&size=100000&motion=reduced',
        browserUrl,
      ).href
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await page
        .locator('[data-performance-ready="true"]')
        .waitFor({ timeout: 120_000 })
      const strategyPath = path
        .resolve(
          import.meta.dirname,
          '../vue/packages/components/_internal/data-pipeline-strategy.ts',
        )
        .replaceAll(path.sep, '/')
        .replace(/^\//u, '')
      const strategyUrl = `/@fs/${strategyPath}`
      const before = await page.evaluate(async (strategyUrl) => {
        const { fsusDataPipelineStrategy: strategy } = await import(strategyUrl)
        strategy.record({
          count: 100000,
          path: 'js',
          commitMs: 8.001,
          computeMs: 0,
          initializeMs: 0,
          copyMs: 0,
          totalMs: 8.001,
        })
        strategy.record({
          count: 100000,
          path: 'worker-wasm',
          commitMs: 0,
          computeMs: 0,
          initializeMs: 0,
          copyMs: 0,
          totalMs: 0,
        })
        return {
          state: strategy.snapshot(),
          choice: strategy.choose(100000, true),
        }
      }, strategyUrl)
      assert.equal(before.choice, 'worker-wasm')
      const evidence = await collectDataPipelineProbes({
        browser,
        contextOptions,
        url,
        warmups: 1,
        samples: 21,
      })
      assert.equal(evidence.length, 21)
      for (const sample of evidence) {
        assert.deepEqual(Object.keys(sample).sort(), [
          'legacyBlockMs',
          'workerEndToEndMs',
          'workerSubmitBlockMs',
        ])
        for (const value of Object.values(sample))
          assert.ok(Number.isFinite(value) && value >= 0)
        assert.ok(sample.workerEndToEndMs > 0)
      }
      const after = await page.evaluate(async (strategyUrl) => {
        const { fsusDataPipelineStrategy: strategy } = await import(strategyUrl)
        const state = strategy.snapshot()
        const decisions = []
        const choose = strategy.choose.bind(strategy)
        strategy.choose = (count, available) => {
          const choice = choose(count, available)
          decisions.push(choice)
          return choice
        }
        try {
          for (let iteration = 1; iteration <= 21; iteration++) {
            await window.__FSUSUI_PERFORMANCE_FIXTURE__.act(iteration)
          }
        } finally {
          delete strategy.choose
        }
        return { state, decisions, completed: strategy.snapshot() }
      }, strategyUrl)
      assert.deepEqual(after.state, before.state)
      assert.equal(after.decisions.length, 21)
      assert.equal(after.decisions[0], before.choice)
      assert.equal(
        after.completed.js.samples + after.completed.workerWasm.samples,
        before.state.js.samples + before.state.workerWasm.samples + 21,
      )
      assert.deepEqual(errors, [])

      // Negative control: the old in-page probe really changes this same model.
      const legacy = await page.evaluate(async (strategyUrl) => {
        const { fsusDataPipelineStrategy: strategy } = await import(strategyUrl)
        const before = strategy.snapshot()
        const evidence =
          await window.__FSUSUI_PERFORMANCE_FIXTURE__.dataPipelineProbe()
        return { before, after: strategy.snapshot(), evidence }
      }, strategyUrl)
      assert.notDeepEqual(legacy.after, legacy.before)
      assert.equal(
        legacy.after.workerWasm.samples,
        legacy.before.workerWasm.samples + 1,
      )
      assert.ok(legacy.evidence.workerEndToEndMs > 0)
      t.diagnostic(
        '21 evidence samples retained; production state unchanged; 21 subsequent actions record exactly 21 samples; original in-page control changes real strategy',
      )
      await context.close()
    } finally {
      await browser.close()
    }
  },
)
