import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const [root, output] = process.argv.slice(2)
const require = createRequire(path.join(root, 'package.json'))
const { chromium } = require('@playwright/test')
const query = '?performance=markdown-cold&size=24576&motion=enabled'
const url = 'http://127.0.0.1:5173/' + query
const executablePath = process.env.FSUSUI_PERF_BROWSER_EXECUTABLE
assert.ok(executablePath && path.isAbsolute(executablePath), 'Pinned browser is mandatory')
const errors = []
let observed
let browser
try {
  browser = await chromium.launch({
    executablePath,
    headless: true,
    chromiumSandbox: true,
    timeout: 15_000,
  })
  assert.equal(browser.version(), '147.0.7727.15')
  const page = await browser.newPage({
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
    viewport: { width: 1280, height: 800 },
  })
  page.on('pageerror', (error) => errors.push(error.message))
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  assert.equal(response?.status(), 200)
  await page
    .locator('[data-performance-ready="true"], [data-performance-error]')
    .waitFor({ state: 'attached', timeout: 120_000 })
  observed = await page.evaluate(() => {
    const fixture = document.querySelector('[data-performance-scenario]')
    const renderer = fixture?.querySelector('[data-markdown-renderer]')
    return {
      query: location.search,
      ready: fixture?.getAttribute('data-performance-ready') ?? null,
      fixtureError: fixture?.getAttribute('data-performance-error') ?? null,
      renderer: renderer?.getAttribute('data-markdown-renderer') ?? null,
      strategy: renderer?.getAttribute('data-fsus-render-strategy') ?? null,
      busy: renderer?.getAttribute('aria-busy') ?? null,
      visibleChunks: renderer?.querySelectorAll('.markdown-renderer__virtual-unit').length ?? 0,
      chineseRendered: renderer?.textContent?.includes('中文文本') ?? false,
    }
  })
  assert.equal(observed.query, query)
  assert.equal(observed.fixtureError, null)
  assert.equal(observed.ready, 'true')
  assert.equal(observed.renderer, 'wasm')
  assert.equal(observed.strategy, 'chunked-worker')
  assert.equal(observed.busy, 'false')
  assert.ok(observed.visibleChunks > 0)
  assert.equal(observed.chineseRendered, true)
  // The probe's top-level engine describes a fresh call; only its previously
  // captured initial profile can attest the original navigation's render.
  observed.initial = await page.evaluate(async () => {
    const fixture = window.__FSUSUI_PERFORMANCE_FIXTURE__
    return (await fixture.wasmProbe()).initial
  })
  assert.equal(observed.initial?.engine, 'SIMD-128')
  assert.deepEqual(errors, [])
  console.log('Original Chinese Markdown fixture committed through the real SIMD WASM worker')
} finally {
  try {
    writeFileSync(output, JSON.stringify({ browser: browser?.version(), observed, errors }, null, 2) + '\n')
  } finally {
    if (browser) await browser.close()
  }
}
