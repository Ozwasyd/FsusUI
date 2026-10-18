import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'
import { promisify } from 'node:util'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import { collectPerformanceProbes } from '../scripts/render-performance-probes.mjs'
import { waitForPerformanceFixture } from '../scripts/render-performance-fixture.mjs'
import {
  createImpactPlan,
  loadOwnershipRegistry,
} from '../scripts/render-performance-impact.mjs'

const readyFixture = async () => ({
  jsonValue: async () => ({ ready: 'true', error: null, scenario: 'fixture' }),
  dispose: async () => {},
})

test('fixture errors take precedence over fallback completion', async () => {
  for (const [ready, error] of [
    ['true', 'markdown_safe_result_authority_invalid'],
    ['error', null],
    ['true', ''],
    ['true', null],
  ]) {
    let disposed = false
    const page = {
      waitForFunction: async (callback, argument, options) => {
        assert.equal(argument, undefined)
        assert.equal(options.timeout, 120_000)
        const state = vm.runInNewContext(`(${callback})`, {
          document: {
            querySelector: () => ({
              getAttribute: (name) =>
                ({
                  'data-performance-ready': ready,
                  'data-performance-error': error,
                  'data-performance-scenario': 'markdown-hot',
                })[name],
            }),
          },
        })()
        return {
          jsonValue: async () => state,
          dispose: async () => {
            disposed = true
          },
        }
      },
    }
    if (error !== null || ready === 'error') {
      await assert.rejects(
        waitForPerformanceFixture(page),
        /Performance fixture failed \(markdown-hot\):/u,
      )
    } else {
      await waitForPerformanceFixture(page)
    }
    assert.equal(disposed, true)
  }
})

test('raw window witnesses preserve the original action and single-RAF timing', async () => {
  const source = await readFile(
    new URL('../scripts/web-render-performance.mjs', import.meta.url),
    'utf8',
  )
  const parsed = ts.createSourceFile(
    'web-render-performance.mjs',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  )
  let callback
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'evaluate'
    ) {
      const first = node.arguments[0]
      if (
        first &&
        ts.isArrowFunction(first) &&
        first.getText(parsed).includes('inputToNextFrameMs:')
      )
        callback = first.getText(parsed)
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  assert.ok(callback)
  const times = [100, 106, 116]
  const calls = []
  const fixtureWindow = {
    __fsusLastFrameTimestamp: 90,
    __FSUSUI_PERFORMANCE_FIXTURE__: {
      act: async (iteration) => calls.push(iteration),
    },
  }
  let frames = 0
  const measure = vm.runInNewContext(`(${callback})`, {
    window: fixtureWindow,
    performance: { now: () => times.shift() },
    requestAnimationFrame: (resolve) => {
      frames++
      fixtureWindow.__fsusLastFrameTimestamp = 115
      resolve(115)
    },
  })
  const sample = await measure({ iteration: 7, measureDomParses: false })
  assert.deepEqual(calls, [7])
  assert.equal(frames, 1)
  assert.equal(sample.frameWorkMs, 6)
  assert.equal(sample.inputToNextFrameMs, 16)
  assert.deepEqual(JSON.parse(JSON.stringify(sample.measurementWindow)), {
    actionCompletedAtMs: 106,
    inputStartedAtMs: 100,
    nextFrameCallbackAtMs: 116,
    nextFrameTimestampMs: 115,
    previousFrameTimestampMs: 90,
  })
  assert.equal(times.length, 0)
})

test('replays every original active probe with unchanged counts and order', async () => {
  for (const scenario of [
    'virtual-list-fixed',
    'select-v2',
    'markdown-cold',
    'markdown-feature-activation',
    'data-pipeline-table',
  ]) {
    const calls = []
    const fixture = Object.fromEntries(
      [
        'act',
        'workerProbe',
        'workerPoolBurstProbe',
        'wasmProbe',
        'dataPipelineProbe',
      ].map((name) => [
        name,
        async (iteration) => {
          calls.push([name, iteration])
          return { name, iteration }
        },
      ]),
    )
    const browser = {
      newContext: async () => ({
        close: async () => {},
        newPage: async () => ({
          goto: async () => {},
          waitForFunction: readyFixture,
          evaluate: (fn, arg) =>
            vm.runInNewContext(`(${fn})`, {
              window: { __FSUSUI_PERFORMANCE_FIXTURE__: fixture },
              requestAnimationFrame: (resolve) => resolve(0),
            })(arg),
        }),
      }),
    }
    const result = await collectPerformanceProbes({
      browser,
      url: 'http://fixture',
      scenario,
      warmups: 1,
      samples: 21,
    })
    assert.equal(result.worker.length, 21)
    const active = ['act', 'workerProbe']
    if (
      (scenario.startsWith('markdown') &&
        scenario !== 'markdown-feature-activation') ||
      scenario === 'select-v2'
    )
      active.push('workerPoolBurstProbe')
    if (
      scenario.startsWith('markdown') &&
      scenario !== 'markdown-feature-activation'
    )
      active.push('wasmProbe')
    if (scenario === 'data-pipeline-table') active.push('dataPipelineProbe')
    assert.deepEqual(calls[0], ['act', 0])
    for (let index = 0; index < 21; index++) {
      const round = calls.slice(
        1 + index * active.length,
        1 + (index + 1) * active.length,
      )
      assert.deepEqual(
        round.map((x) => x[0]),
        active,
      )
      assert.equal(round[0][1], index + 1)
      assert.equal(round[1][1], index)
    }
    assert.equal(calls.length, 1 + 21 * active.length)
  }
})

test('comparison rejects mixed observation protocols and retains the original budget', async () => {
  const root = path.resolve(import.meta.dirname, '..')
  const temporary = await mkdtemp(
    path.join(os.tmpdir(), 'fsus-probe-contract-'),
  )
  const protocol = 'all-active-probes-isolated-context-v2'
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
    await write([
      'isolated-context-after-measurement-v1',
      protocol,
      'isolated-context-after-measurement-v1',
      protocol,
    ])
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
        waitForFunction: readyFixture,
        evaluate: async () => {
          throw failure
        },
      }),
    }),
  }
  await assert.rejects(
    collectPerformanceProbes({
      browser,
      url: 'http://fixture',
      scenario: 'data-pipeline-table',
      warmups: 1,
      samples: 21,
    }),
    (error) => error === failure,
  )
  assert.equal(closed, true)
})

test('collects every active probe after production metric capture and teardown', async () => {
  const source = await readFile(
    new URL('../scripts/web-render-performance.mjs', import.meta.url),
    'utf8',
  )
  const capture = source.indexOf('const pageMetrics = await page.evaluate(')
  const teardown = source.indexOf('await context.close()', capture)
  const diagnostic = source.indexOf('await collectPerformanceProbes(')
  const replay = source.indexOf('for (const { raw, url } of capturedCases)')
  assert.ok(capture > 0 && teardown > capture && diagnostic > teardown)
  assert.ok(replay > teardown && diagnostic > replay)
  for (const probe of [
    'dataPipelineProbe',
    'wasmProbe',
    'workerPoolBurstProbe',
    'workerProbe',
  ]) {
    assert.equal(
      source.includes(`.__FSUSUI_PERFORMANCE_FIXTURE__.${probe}(`),
      false,
    )
  }
})

const browserUrl = process.env.FSUSUI_DATA_PIPELINE_BROWSER_URL
test(
  'real Markdown fixture readiness preserves its reported render error',
  { skip: !browserUrl, timeout: 120_000 },
  async (t) => {
    const { chromium } = await import('@playwright/test')
    const browser = await chromium.launch({ headless: true })
    try {
      const context = await browser.newContext({
        deviceScaleFactor: 2,
        reducedMotion: 'reduce',
        viewport: { width: 1280, height: 800 },
      })
      const page = await context.newPage()
      const url = new URL(
        '/?performance=markdown-hot&size=1048576&motion=reduced',
        browserUrl,
      ).href
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      // Keep the original predicate as the real negative control. The
      // component can report an error and then complete its safe fallback.
      await page
        .locator('[data-performance-ready="true"]')
        .waitFor({ timeout: 120_000 })
      const reported = await page
        .locator('[data-performance-scenario]')
        .getAttribute('data-performance-error')
      await page.evaluate(() => {
        window.__readinessControlActions = 0
        const fixture = window.__FSUSUI_PERFORMANCE_FIXTURE__
        const original = fixture.act
        fixture.act = (...args) => {
          window.__readinessControlActions++
          return original(...args)
        }
      })
      if (reported !== null) {
        await assert.rejects(
          waitForPerformanceFixture(page),
          (error) => error.message.endsWith(`: ${reported || 'render error'}`),
        )
        t.diagnostic(`Original readiness accepted a real render error: ${reported}`)
      } else {
        await waitForPerformanceFixture(page)
        t.diagnostic('Real Markdown runtime completed without a retained error')
      }
      assert.equal(
        await page.evaluate(() => window.__readinessControlActions),
        0,
      )
      await context.close()
    } finally {
      await browser.close()
    }
  },
)
test(
  'real browser rejects the observed fallback DOM before diagnostic actions',
  { skip: !browserUrl, timeout: 120_000 },
  async () => {
    const { chromium } = await import('@playwright/test')
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.setContent(
        '<main data-performance-scenario="markdown-hot" data-performance-ready="true" data-performance-error="markdown_safe_result_authority_invalid">Safe text fallback</main>',
      )
      // Original readiness accepts the real DOM state captured from both arms.
      await page.locator('[data-performance-ready="true"]').waitFor()
      await assert.rejects(
        waitForPerformanceFixture(page),
        /Performance fixture failed \(markdown-hot\): markdown_safe_result_authority_invalid/u,
      )
      await page.setContent(
        '<main data-performance-scenario="markdown-hot" data-performance-ready="true">Healthy fixture</main>',
      )
      await waitForPerformanceFixture(page)
      let closed = false
      const diagnosticBrowser = {
        newContext: async () => ({
          close: async () => {
            closed = true
          },
          newPage: async () => page,
        }),
      }
      const fallback = `data:text/html,${encodeURIComponent(
        '<main data-performance-scenario="markdown-hot" data-performance-ready="true" data-performance-error="markdown_safe_result_authority_invalid"></main>',
      )}`
      await assert.rejects(
        collectPerformanceProbes({
          browser: diagnosticBrowser,
          url: fallback,
          scenario: 'markdown-hot',
          warmups: 1,
          samples: 21,
        }),
        /markdown_safe_result_authority_invalid/u,
      )
      assert.equal(closed, true)
    } finally {
      await browser.close()
    }
  },
)
test(
  'real fixed-list Worker evidence never calls the production fixture probes',
  { skip: !browserUrl, timeout: 120_000 },
  async () => {
    const { chromium } = await import('@playwright/test')
    const browser = await chromium.launch({ headless: true })
    try {
      const contextOptions = { viewport: { width: 1280, height: 800 } }
      const context = await browser.newContext(contextOptions)
      const page = await context.newPage()
      const url = new URL(
        '/?performance=virtual-list-fixed&size=100000&motion=enabled',
        browserUrl,
      ).href
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await page
        .locator('[data-performance-ready="true"]')
        .waitFor({ timeout: 120_000 })
      const before = await page.evaluate(() => {
        const fixture = window.__FSUSUI_PERFORMANCE_FIXTURE__
        window.__performanceProbeCalls = []
        for (const name of [
          'workerProbe',
          'workerPoolBurstProbe',
          'wasmProbe',
          'dataPipelineProbe',
        ]) {
          const original = fixture[name]
          fixture[name] = (...args) => {
            window.__performanceProbeCalls.push(name)
            return original(...args)
          }
        }
        return [...document.querySelectorAll('.performance-row')].map(
          (row) => row.textContent,
        )
      })
      const result = await collectPerformanceProbes({
        browser,
        contextOptions,
        url,
        scenario: 'virtual-list-fixed',
        warmups: 1,
        samples: 21,
      })
      assert.equal(result.worker.length, 21)
      assert.equal(result.workerPoolBursts.length, 0)
      assert.equal(result.wasm.length, 0)
      assert.equal(result.dataPipeline.length, 0)
      const after = await page.evaluate(() => ({
        calls: window.__performanceProbeCalls,
        rows: [...document.querySelectorAll('.performance-row')].map(
          (row) => row.textContent,
        ),
      }))
      assert.deepEqual(after.calls, [])
      assert.deepEqual(after.rows, before)
      await page.evaluate(() =>
        window.__FSUSUI_PERFORMANCE_FIXTURE__.workerProbe(0),
      )
      assert.deepEqual(
        await page.evaluate(() => window.__performanceProbeCalls),
        ['workerProbe'],
      )
      await context.close()
    } finally {
      await browser.close()
    }
  },
)
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
      const probes = await collectPerformanceProbes({
        browser,
        contextOptions,
        url,
        scenario: 'data-pipeline-table',
        warmups: 1,
        samples: 21,
      })
      const evidence = probes.dataPipeline
      assert.equal(evidence.length, 21)
      assert.equal(probes.worker.length, 21)
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
