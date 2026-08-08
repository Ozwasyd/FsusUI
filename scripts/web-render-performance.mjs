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
const samples = Number(valueOf('--samples', profile === 'full' ? '12' : '21'))
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
  ['data-pipeline-table', 5_000],
  ['data-pipeline-table', 10_000],
  ['data-pipeline-table', 100_000],
  ['render-pipeline-monolithic', 2_000_000],
  ['render-pipeline-cooperative', 2_000_000],
  ['virtual-window-index-legacy', 100_000],
  ['virtual-window-index-incremental', 100_000],
  ['markdown-feature-activation', 4_096],
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
  definitions[17],
  definitions[18],
  definitions[19],
  definitions[20],
  definitions[21],
  definitions[22],
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

const domParseOperationNames = [
  'elementInnerHTML',
  'elementOuterHTML',
  'elementInsertAdjacentHTML',
  'rangeCreateContextualFragment',
  'domParserParseFromString',
  'shadowRootInnerHTML',
]

const domParseOperationTotal = (counts) =>
  domParseOperationNames.reduce((total, name) => total + (counts[name] ?? 0), 0)

const domParseOperationStats = (samples) => ({
  total: stats(samples.map((sample) => domParseOperationTotal(sample.counts))),
  byEntryPoint: Object.fromEntries(
    domParseOperationNames.map((name) => [
      name,
      stats(samples.map((sample) => sample.counts[name] ?? 0)),
    ]),
  ),
  unsupported: [...new Set(samples.flatMap((sample) => sample.unsupported))],
})

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
    const measureDomParses = scenario === 'markdown-feature-activation'
    await page.addInitScript(
      ({ measureDomParses, targetHz }) => {
        if (measureDomParses) {
          const counts = {
            domParserParseFromString: 0,
            elementInnerHTML: 0,
            elementInsertAdjacentHTML: 0,
            elementOuterHTML: 0,
            rangeCreateContextualFragment: 0,
            shadowRootInnerHTML: 0,
          }
          const unsupported = []
          const installSetter = (
            prototype,
            property,
            counter,
            optional = false,
          ) => {
            const descriptor = Object.getOwnPropertyDescriptor(
              prototype,
              property,
            )
            if (!descriptor && optional) return
            if (
              !descriptor?.configurable ||
              !descriptor.get ||
              !descriptor.set
            ) {
              unsupported.push(counter)
              return
            }
            Object.defineProperty(prototype, property, {
              ...descriptor,
              set(value) {
                counts[counter] += 1
                return descriptor.set.call(this, value)
              },
            })
          }
          const installMethod = (prototype, property, counter) => {
            const descriptor = Object.getOwnPropertyDescriptor(
              prototype,
              property,
            )
            if (
              !descriptor?.configurable ||
              typeof descriptor.value !== 'function'
            ) {
              unsupported.push(counter)
              return
            }
            Object.defineProperty(prototype, property, {
              ...descriptor,
              value(...args) {
                counts[counter] += 1
                return descriptor.value.apply(this, args)
              },
            })
          }
          installSetter(Element.prototype, 'innerHTML', 'elementInnerHTML')
          installSetter(Element.prototype, 'outerHTML', 'elementOuterHTML')
          installMethod(
            Element.prototype,
            'insertAdjacentHTML',
            'elementInsertAdjacentHTML',
          )
          installMethod(
            Range.prototype,
            'createContextualFragment',
            'rangeCreateContextualFragment',
          )
          installMethod(
            DOMParser.prototype,
            'parseFromString',
            'domParserParseFromString',
          )
          installSetter(
            ShadowRoot.prototype,
            'innerHTML',
            'shadowRootInnerHTML',
            true,
          )
          window.__fsusDomParseOperations = {
            snapshot: () => ({
              counts: { ...counts },
              unsupported: [...unsupported],
            }),
          }
        }
        window.__fsusFrameIntervals = []
        window.__fsusLongTasks = []
        let previous = performance.now()
        let measurementWindowStartedAt = Number.POSITIVE_INFINITY
        const tick = (now) => {
          window.__fsusFrameIntervals.push(now - previous)
          previous = now
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        let longTaskObserver
        try {
          longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.startTime >= measurementWindowStartedAt)
                window.__fsusLongTasks.push(entry.duration)
            }
          })
          longTaskObserver.observe({ type: 'longtask', buffered: true })
        } catch {}
        window.__fsusResetMeasurementWindow = () => {
          longTaskObserver?.takeRecords()
          window.__fsusFrameIntervals = []
          window.__fsusLongTasks = []
          previous = performance.now()
          measurementWindowStartedAt = previous
        }
        window.__fsusTargetHz = targetHz
      },
      { measureDomParses, targetHz: refreshHz },
    )
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

    await page.evaluate(() => {
      if (typeof window.__fsusResetMeasurementWindow !== 'function')
        throw new Error('Performance measurement window reset is unavailable')
      window.__fsusResetMeasurementWindow()
    })

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
    const markdownPhases = []
    const dataPipeline = []
    const domParseOperations = []
    for (let index = 0; index < samples; index++) {
      const sample = await page.evaluate(
        async ({ iteration, measureDomParses }) => {
          const before = measureDomParses
            ? window.__fsusDomParseOperations?.snapshot()
            : null
          if (measureDomParses && !before) {
            throw new Error('DOM parser instrumentation is unavailable')
          }
          const started = performance.now()
          await window.__FSUSUI_PERFORMANCE_FIXTURE__.act(iteration)
          const actionCompleted = performance.now()
          const after = measureDomParses
            ? window.__fsusDomParseOperations.snapshot()
            : null
          await new Promise((resolve) => requestAnimationFrame(() => resolve()))
          return {
            domParseOperations:
              before && after
                ? {
                    counts: Object.fromEntries(
                      Object.entries(after.counts).map(([name, count]) => [
                        name,
                        count - (before.counts[name] ?? 0),
                      ]),
                    ),
                    unsupported: after.unsupported,
                  }
                : null,
            frameWorkMs: actionCompleted - started,
            inputToNextFrameMs: performance.now() - started,
          }
        },
        { iteration: index + warmups, measureDomParses },
      )
      frameWork.push(sample.frameWorkMs)
      inputToFrame.push(sample.inputToNextFrameMs)
      if (scenario === 'markdown-feature-activation') {
        if (!sample.domParseOperations) {
          throw new Error('DOM parser instrumentation is unavailable')
        }
        domParseOperations.push(sample.domParseOperations)
      }
      worker.push(
        await page.evaluate(
          (iteration) =>
            window.__FSUSUI_PERFORMANCE_FIXTURE__.workerProbe(iteration),
          index,
        ),
      )
      if (
        (scenario.startsWith('markdown') &&
          scenario !== 'markdown-feature-activation') ||
        scenario === 'select-v2'
      ) {
        workerPoolBursts.push(
          await page.evaluate(() =>
            window.__FSUSUI_PERFORMANCE_FIXTURE__.workerPoolBurstProbe(),
          ),
        )
      }
      if (scenario.startsWith('markdown')) {
        if (scenario !== 'markdown-feature-activation') {
          wasm.push(
            await page.evaluate(() =>
              window.__FSUSUI_PERFORMANCE_FIXTURE__.wasmProbe(),
            ),
          )
        }
        markdownPhases.push(
          await page.evaluate(() =>
            window.__FSUSUI_PERFORMANCE_FIXTURE__.markdownPhaseProbe(),
          ),
        )
      }
      if (scenario === 'data-pipeline-table') {
        dataPipeline.push(
          await page.evaluate(() =>
            window.__FSUSUI_PERFORMANCE_FIXTURE__.dataPipelineProbe(),
          ),
        )
      }
      const sampleMetrics = await session.send('Performance.getMetrics')
      heapSamples.push(
        sampleMetrics.metrics.find(({ name }) => name === 'JSHeapUsedSize')
          ?.value ?? 0,
      )
    }
    if (scenario === 'markdown-feature-activation') {
      const activationRevisions = markdownPhases.map(
        (entry) => entry.activationRevision,
      )
      if (
        samples < 5 ||
        markdownPhases.length !== samples ||
        activationRevisions.some(
          (revision, index) =>
            index > 0 && revision !== activationRevisions[index - 1] + 1,
        ) ||
        activationRevisions.some((revision) => revision <= 0) ||
        markdownPhases.some((entry) => entry.activationMs <= 0) ||
        domParseOperations.length !== samples ||
        domParseOperations.some((entry) => entry.unsupported.length > 0) ||
        domParseOperations.some(
          (entry) => domParseOperationTotal(entry.counts) <= 0,
        ) ||
        new Set(
          domParseOperations.map((entry) =>
            domParseOperationTotal(entry.counts),
          ),
        ).size !== 1
      ) {
        throw new Error(
          'Markdown feature activation samples must be consecutive and have stable DOM parser instrumentation.',
        )
      }
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
      markdownPhases,
      domParseOperations,
      dataPipeline,
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
      markdownPhases: markdownPhases.length
        ? {
            activationMs: stats(
              markdownPhases.map((entry) => entry.activationMs),
            ),
            commitMs: stats(markdownPhases.map((entry) => entry.commitMs)),
            parseMs: stats(markdownPhases.map((entry) => entry.parseMs)),
            transferMs: stats(markdownPhases.map((entry) => entry.transferMs)),
            paintMs: raw.trace.paintMs,
          }
        : null,
      domParseOperations: domParseOperations.length
        ? domParseOperationStats(domParseOperations)
        : null,
      dataPipeline: dataPipeline.length
        ? {
            legacyBlockMs: stats(
              dataPipeline.map((entry) => entry.legacyBlockMs),
            ),
            workerEndToEndMs: stats(
              dataPipeline.map((entry) => entry.workerEndToEndMs),
            ),
            workerSubmitBlockMs: stats(
              dataPipeline.map((entry) => entry.workerSubmitBlockMs),
            ),
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
      if (!previous) {
        return entry.scenario === 'markdown-feature-activation'
          ? [`${entry.id}: missing Markdown feature activation baseline`]
          : []
      }
      if (
        entry.scenario === 'markdown-feature-activation' &&
        previous.markdownPhases &&
        entry.markdownPhases
      ) {
        const regressions = ['p50', 'p95'].flatMap((percentile) => {
          const before = previous.markdownPhases.activationMs[percentile]
          const after = entry.markdownPhases.activationMs[percentile]
          if (
            !Number.isFinite(before) ||
            !Number.isFinite(after) ||
            before <= 0 ||
            after <= 0
          ) {
            return [`${entry.id}: invalid activation ${percentile} evidence`]
          }
          return after > before * 1.05
            ? [
                `${entry.id}: activation ${percentile} ${after.toFixed(2)}ms > baseline ${before.toFixed(2)}ms + 5%`,
              ]
            : []
        })
        const beforeDom = previous.domParseOperations?.total
        const afterDom = entry.domParseOperations?.total
        if (!beforeDom || !afterDom) {
          return [
            ...regressions,
            `${entry.id}: missing DOM parser baseline or current evidence`,
          ]
        }
        if (
          !Number.isFinite(beforeDom.max) ||
          !Number.isFinite(afterDom.max) ||
          beforeDom.samples !== samples ||
          afterDom.samples !== samples
        ) {
          return [
            ...regressions,
            `${entry.id}: incomplete DOM parser sample evidence`,
          ]
        }
        if (afterDom.max > beforeDom.max) {
          regressions.push(
            `${entry.id}: DOM parser operations max ${afterDom.max} > baseline ${beforeDom.max}`,
          )
        }
        return regressions
      }
      if (entry.scenario === 'markdown-feature-activation') {
        return [`${entry.id}: incomplete Markdown feature activation baseline`]
      }
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
