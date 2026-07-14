/* global PerformanceObserver, fetch, performance, requestAnimationFrame, setTimeout */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const root = path.resolve(import.meta.dirname, '..')
const argv = process.argv.slice(2)
const valueOf = (name, fallback) => {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : fallback
}
const has = (name) => argv.includes(name)
const profile = valueOf('--profile', 'quick')
const scenarioFilter = valueOf('--scenario', '')
const output = path.resolve(root, valueOf('--output', '.tmp/performance/web'))
const baselinePath = valueOf('--baseline', '')
const port = Number(valueOf('--port', '5188'))
const warmups = Number(valueOf('--warmups', profile === 'full' ? '3' : '1'))
const samples = Number(valueOf('--samples', profile === 'full' ? '12' : '5'))
const regressionLimit = Number(valueOf('--regression-limit', '0.15'))
const baseURL = `http://127.0.0.1:${port}`

const definitions = [
  ['virtual-list-fixed', 1_000],
  ['virtual-list-fixed', 10_000],
  ['virtual-list-fixed', 100_000],
  ['virtual-list-variable', 1_000],
  ['virtual-list-variable', 10_000],
  ['virtual-list-variable', 100_000],
  ['virtual-grid', 10_000],
  ['virtual-grid', 100_000],
  ['markdown-cold', 24 * 1024],
  ['markdown-hot', 256 * 1024],
  ['markdown-hot', 1024 * 1024],
  ['select-v2', 2_000],
  ['select-v2', 10_000],
  ['select-v2', 100_000],
  ['table', 1_000],
  ['render-pipeline-monolithic', 2_000_000],
  ['render-pipeline-cooperative', 2_000_000],
  ['virtual-window-index-legacy', 100_000],
  ['virtual-window-index-incremental', 100_000],
]

const quickDimensions = [
  [60, 1, 'enabled'],
  [120, 2, 'reduced'],
  [60, 2, 'disabled'],
]
const fullDimensions = [60, 120].flatMap((refreshHz) =>
  [1, 2].flatMap((dpr) =>
    ['enabled', 'reduced', 'disabled'].map((motion) => [
      refreshHz,
      dpr,
      motion,
    ]),
  ),
)
const quickDefinitions = [
  definitions[2],
  definitions[5],
  definitions[7],
  definitions[8],
  definitions[10],
  definitions[13],
  definitions[14],
  definitions[15],
  definitions[16],
  definitions[17],
  definitions[18],
]
const dimensions = profile === 'full' ? fullDimensions : quickDimensions
const scenarioDefinitions = (
  profile === 'full' ? definitions : quickDefinitions
).filter(([scenario]) => !scenarioFilter || scenario.startsWith(scenarioFilter))
const matrix = scenarioFilter
  ? scenarioDefinitions.map((definition) => [
      ...definition,
      ...quickDimensions[0],
    ])
  : profile === 'full'
    ? scenarioDefinitions.flatMap((definition) =>
        dimensions.map((dimension) => [...definition, ...dimension]),
      )
    : scenarioDefinitions.map((definition, index) => [
        ...definition,
        ...dimensions[index % dimensions.length],
      ])

const percentile = (values, p) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
}
const stats = (values) => ({
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95),
  p99: percentile(values, 0.99),
  min: Math.min(...values),
  max: Math.max(...values),
  samples: values.length,
})
const sumTrace = (events, names) =>
  events
    .filter((event) => names.has(event.name) && typeof event.dur === 'number')
    .reduce((sum, event) => sum + event.dur / 1000, 0)

const waitForServer = async (server) => {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`Vite exited with ${server.exitCode}`)
    try {
      const response = await fetch(baseURL)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('Timed out waiting for performance fixture server')
}

const readTrace = async (session, stream) => {
  let text = ''
  while (true) {
    const chunk = await session.send('IO.read', { handle: stream })
    text += chunk.data
    if (chunk.eof) break
  }
  await session.send('IO.close', { handle: stream })
  return JSON.parse(text).traceEvents ?? []
}

const server = has('--no-server')
  ? null
  : spawn(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      [
        '-C',
        'vue/packages/demo-app',
        'exec',
        'vite',
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--strictPort',
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    )

try {
  if (server) await waitForServer(server)
  await mkdir(output, { recursive: true })
  const configuredBrowser = process.env.FSUSUI_PERF_BROWSER_EXECUTABLE
  const systemBrowser =
    process.platform === 'linux' && existsSync('/usr/bin/google-chrome')
      ? '/usr/bin/google-chrome'
      : undefined
  const browser = await chromium.launch({
    headless: true,
    executablePath: configuredBrowser || systemBrowser,
  })
  const results = []

  for (const [scenario, size, refreshHz, dpr, motion] of matrix) {
    const context = await browser.newContext({
      deviceScaleFactor: dpr,
      reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
      viewport: { width: 1280, height: 800 },
    })
    const page = await context.newPage()
    const session = await context.newCDPSession(page)
    await session.send('Performance.enable')
    await session.send('LayerTree.enable')
    let layerCount = 0
    let layerArea = 0
    session.on('LayerTree.layerTreeDidChange', ({ layers }) => {
      layerCount = Math.max(layerCount, layers.length)
      layerArea = Math.max(
        layerArea,
        layers.reduce(
          (sum, layer) => sum + (layer.width ?? 0) * (layer.height ?? 0),
          0,
        ),
      )
    })
    await page.addInitScript((targetHz) => {
      window.__fsusFrameIntervals = []
      window.__fsusLongTasks = []
      let previous = performance.now()
      const tick = (now) => {
        window.__fsusFrameIntervals.push(now - previous)
        previous = now
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            window.__fsusLongTasks.push(entry.duration)
        }).observe({ type: 'longtask', buffered: true })
      } catch {}
      window.__fsusTargetHz = targetHz
    }, refreshHz)
    const url = `${baseURL}/?performance=${scenario}&size=${size}&motion=${motion}`
    const navigationStarted = performance.now()
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page
      .locator('[data-performance-ready="true"]')
      .waitFor({ timeout: 120_000 })
    const navigationMs = performance.now() - navigationStarted

    for (let index = 0; index < warmups; index++) {
      await page.evaluate(
        (iteration) => window.__FSUSUI_PERFORMANCE_FIXTURE__.act(iteration),
        index,
      )
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => resolve())),
      )
    }

    const traceComplete = new Promise((resolve) => {
      session.once('Tracing.tracingComplete', ({ stream }) => resolve(stream))
    })
    await session.send('Tracing.start', {
      categories:
        'devtools.timeline,disabled-by-default-devtools.timeline.layers',
      transferMode: 'ReturnAsStream',
    })
    const inputToFrame = []
    const frameWork = []
    const heapSamples = []
    const worker = []
    const workerPoolBursts = []
    const wasm = []
    for (let index = 0; index < samples; index++) {
      const sample = await page.evaluate(async (iteration) => {
        const started = performance.now()
        await window.__FSUSUI_PERFORMANCE_FIXTURE__.act(iteration)
        const actionCompleted = performance.now()
        await new Promise((resolve) => requestAnimationFrame(() => resolve()))
        return {
          frameWorkMs: actionCompleted - started,
          inputToNextFrameMs: performance.now() - started,
        }
      }, index + warmups)
      frameWork.push(sample.frameWorkMs)
      inputToFrame.push(sample.inputToNextFrameMs)
      worker.push(
        await page.evaluate(
          (iteration) =>
            window.__FSUSUI_PERFORMANCE_FIXTURE__.workerProbe(iteration),
          index,
        ),
      )
      if (scenario.startsWith('markdown') || scenario === 'select-v2') {
        workerPoolBursts.push(
          await page.evaluate(() =>
            window.__FSUSUI_PERFORMANCE_FIXTURE__.workerPoolBurstProbe(),
          ),
        )
      }
      if (scenario.startsWith('markdown')) {
        wasm.push(
          await page.evaluate(() =>
            window.__FSUSUI_PERFORMANCE_FIXTURE__.wasmProbe(),
          ),
        )
      }
      const sampleMetrics = await session.send('Performance.getMetrics')
      heapSamples.push(
        sampleMetrics.metrics.find(({ name }) => name === 'JSHeapUsedSize')
          ?.value ?? 0,
      )
    }
    await session.send('Tracing.end')
    const traceStream = await traceComplete
    const traceEvents = await readTrace(session, traceStream)
    const browserMetrics = await session.send('Performance.getMetrics')
    const metrics = Object.fromEntries(
      browserMetrics.metrics.map(({ name, value }) => [name, value]),
    )
    const stableHeapBytes = metrics.JSHeapUsedSize ?? 0
    const pageMetrics = await page.evaluate(
      ({ refreshHz }) => {
        const intervals = window.__fsusFrameIntervals.slice(2)
        const budget = 1000 / refreshHz
        const nodes = document.querySelectorAll('*').length
        return {
          frameIntervals: intervals,
          droppedFrameRate:
            intervals.filter((value) => value > budget * 1.5).length /
            Math.max(1, intervals.length),
          longTasks: window.__fsusLongTasks,
          domNodes: nodes,
        }
      },
      { refreshHz },
    )
    const raw = {
      id: `${scenario}-${size}-${refreshHz}hz-dpr${dpr}-${motion}`,
      scenario,
      size,
      refreshHz,
      dpr,
      motion,
      navigationMs,
      inputToFrame,
      frameWork,
      frameIntervals: pageMetrics.frameIntervals,
      longTasks: pageMetrics.longTasks,
      worker,
      workerPoolBursts,
      wasm,
      trace: {
        styleMs: sumTrace(
          traceEvents,
          new Set(['UpdateLayoutTree', 'RecalculateStyles']),
        ),
        layoutMs: sumTrace(traceEvents, new Set(['Layout'])),
        paintMs: sumTrace(traceEvents, new Set(['Paint', 'RasterTask'])),
        compositeMs: sumTrace(
          traceEvents,
          new Set(['CompositeLayers', 'DrawFrame']),
        ),
      },
      browserMetrics: metrics,
      heapSamples,
      stableHeapBytes,
      domNodes: pageMetrics.domNodes,
      layerCount,
      layerArea,
      droppedFrameRate: pageMetrics.droppedFrameRate,
    }
    await writeFile(
      path.join(output, `${raw.id}.raw.json`),
      `${JSON.stringify(raw, null, 2)}\n`,
    )
    results.push({
      id: raw.id,
      scenario,
      size,
      refreshHz,
      dpr,
      motion,
      frameWorkMs: stats(frameWork),
      frameIntervalMs: stats(pageMetrics.frameIntervals),
      droppedFrameRate: pageMetrics.droppedFrameRate,
      longTasks: {
        count: pageMetrics.longTasks.length,
        longestMs: Math.max(0, ...pageMetrics.longTasks),
      },
      inputToNextFrameMs: stats(inputToFrame),
      phases: raw.trace,
      domNodes: raw.domNodes,
      layers: { count: layerCount, estimatedArea: layerArea },
      heap: {
        peakBytes: Math.max(metrics.JSHeapUsedSize ?? 0, ...heapSamples),
        stableBytes: stableHeapBytes,
      },
      worker: {
        queueWaitMs: stats(worker.map((entry) => entry.queueWaitMs)),
        computeMs: stats(worker.map((entry) => entry.computeMs)),
        transferMs: stats(worker.map((entry) => entry.transferMs)),
      },
      workerPoolBurst: workerPoolBursts.length
        ? {
            latestCompletions: workerPoolBursts.map(
              (entry) => entry.latestCompletions,
            ),
            legacyInputMs: stats(
              workerPoolBursts.map((entry) => entry.legacyInputMs),
            ),
            maxQueueDepth: Math.max(
              ...workerPoolBursts.map((entry) => entry.maxQueueDepth),
            ),
            poolInputMs: stats(
              workerPoolBursts.map((entry) => entry.poolInputMs),
            ),
          }
        : null,
      wasm: wasm.length
        ? {
            coldStartupMs: wasm[0].initial?.startupMs ?? navigationMs,
            coldComputeMs: wasm[0].initial?.computeMs ?? navigationMs,
            coldEndToEndMs: wasm[0].initial?.endToEndMs ?? navigationMs,
            hotStartupMs: stats(wasm.map((entry) => entry.startupMs)),
            hotEndToEndMs: stats(wasm.map((entry) => entry.endToEndMs)),
            engine: wasm[0].initial?.engine ?? wasm.at(-1).engine,
          }
        : null,
    })
    await context.close()
  }
  const version = browser.version()
  await browser.close()
  const artifact = {
    schemaVersion: 1,
    kind: 'real-web-render-measurement',
    generatedAt: new Date().toISOString(),
    gitSha:
      process.env.GITHUB_SHA || process.env.GIT_COMMIT || 'local-worktree',
    profile,
    environment: {
      os: `${os.platform()} ${os.release()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model ?? 'unknown',
      logicalCores: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      node: process.version,
      browser: `Chromium ${version}`,
      dpr: [...new Set(matrix.map((entry) => entry[3]))],
      refreshTargetsHz: [...new Set(matrix.map((entry) => entry[2]))],
    },
    runner: { warmups, samples, matrixSize: matrix.length },
    results,
  }
  await writeFile(
    path.join(output, 'summary.json'),
    `${JSON.stringify(artifact, null, 2)}\n`,
  )

  if (baselinePath) {
    const baseline = JSON.parse(
      await readFile(path.resolve(root, baselinePath), 'utf8'),
    )
    const baselineMap = new Map(
      baseline.results.map((entry) => [entry.id, entry]),
    )
    const regressions = results.flatMap((entry) => {
      const previous = baselineMap.get(entry.id)
      if (!previous) return []
      const before = previous.inputToNextFrameMs.p95
      const after = entry.inputToNextFrameMs.p95
      return before > 0 && after > before * (1 + regressionLimit)
        ? [
            `${entry.id}: p95 ${after.toFixed(2)}ms > baseline ${before.toFixed(2)}ms + ${regressionLimit * 100}%`,
          ]
        : []
    })
    if (regressions.length)
      throw new Error(
        `Relative web performance regression:\n${regressions.join('\n')}`,
      )
  }
  console.info(
    `Web real-render performance: ${results.length} scenarios -> ${path.relative(root, output)}`,
  )
} finally {
  if (server && server.exitCode === null) server.kill('SIGTERM')
}
