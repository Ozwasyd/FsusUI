/* global requestAnimationFrame */

export const collectPerformanceProbes = async ({
  browser,
  contextOptions,
  url,
  scenario,
  warmups,
  samples,
}) => {
  const context = await browser.newContext(contextOptions)
  try {
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page
      .locator('[data-performance-ready="true"]')
      .waitFor({ timeout: 120_000 })

    // Replay every original action and active probe after production capture.
    // Worker startup, WASM work and forced sorts must not drive the next input.
    const act = (iteration) =>
      page.evaluate(async (iteration) => {
        await window.__FSUSUI_PERFORMANCE_FIXTURE__.act(iteration)
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }, iteration)
    for (let index = 0; index < warmups; index++) await act(index)
    const results = {
      dataPipeline: [],
      wasm: [],
      worker: [],
      workerPoolBursts: [],
    }
    for (let index = 0; index < samples; index++) {
      await act(index + warmups)
      results.worker.push(
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
        results.workerPoolBursts.push(
          await page.evaluate(() =>
            window.__FSUSUI_PERFORMANCE_FIXTURE__.workerPoolBurstProbe(),
          ),
        )
      }
      if (
        scenario.startsWith('markdown') &&
        scenario !== 'markdown-feature-activation'
      ) {
        results.wasm.push(
          await page.evaluate(() =>
            window.__FSUSUI_PERFORMANCE_FIXTURE__.wasmProbe(),
          ),
        )
      }
      if (scenario === 'data-pipeline-table') {
        results.dataPipeline.push(
          await page.evaluate(() =>
            window.__FSUSUI_PERFORMANCE_FIXTURE__.dataPipelineProbe(),
          ),
        )
      }
    }
    return results
  } finally {
    await context.close()
  }
}
