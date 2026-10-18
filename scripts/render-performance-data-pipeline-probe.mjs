/* global requestAnimationFrame */

export const collectDataPipelineProbes = async ({
  browser,
  contextOptions,
  url,
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

    // Replay the original sequence in its own realm: the probe must not train
    // the production controller or contribute to its trace/frame/heap metrics.
    const act = (iteration) =>
      page.evaluate(async (iteration) => {
        await window.__FSUSUI_PERFORMANCE_FIXTURE__.act(iteration)
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }, iteration)
    for (let index = 0; index < warmups; index++) await act(index)
    const results = []
    for (let index = 0; index < samples; index++) {
      await act(index + warmups)
      results.push(
        await page.evaluate(() =>
          window.__FSUSUI_PERFORMANCE_FIXTURE__.dataPipelineProbe(),
        ),
      )
    }
    return results
  } finally {
    await context.close()
  }
}
