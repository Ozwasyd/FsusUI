import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  selectRenderBrowser,
  verifyRenderBrowsers,
} from './pin-render-browser.mjs'
const executable =
  '/home/runner/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome'
test('selects exact installed full Chromium, with bounded version preflight', () => {
  const selected = selectRenderBrowser(executable, (file, args, options) => {
    assert.equal(file, executable)
    assert.deepEqual(args, ['--version'])
    assert.equal(options.timeout, 10_000)
    return 'Google Chrome for Testing 147.0.7727.15\n'
  })
  assert.equal(selected.version, '147.0.7727.15')
  assert.equal(selected.revision, '1217')
})
test('rejects system browser and other revisions before execution', () => {
  for (const file of [
    '/usr/bin/google-chrome',
    executable.replace('1217', '1317'),
    executable.replace('chromium-1217', 'chromium_headless_shell-1217'),
  ]) {
    assert.throws(() =>
      selectRenderBrowser(file, () => assert.fail('must not run')),
    )
  }
})
test('rejects other versions, malformed output, and failed or timed-out probes', () => {
  for (const value of [
    'Chromium 149.0.7827.102',
    'Chromium 157.0.8103.50',
    'Chromium 147.0.7727.16',
    'unknown',
  ]) {
    assert.throws(() => selectRenderBrowser(executable, () => value))
  }
  assert.throws(
    () =>
      selectRenderBrowser(executable, () => {
        throw new Error('ETIMEDOUT')
      }),
    /ETIMEDOUT/,
  )
})
test('workflow pins once before all four arms and uploads selection evidence', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/quality.yml', import.meta.url),
    'utf8',
  )
  const pin = workflow.indexOf('node scripts/pin-render-browser.mjs')
  assert.ok(
    pin >
      workflow.indexOf('Install Chromium and web display dependencies once'),
  )
  for (const name of [
    'Measure same-runner baseline first',
    'Measure current quick matrix',
    'Repeat current quick matrix for order balance',
    'Repeat baseline quick matrix last for order balance',
  ]) {
    assert.ok(workflow.indexOf(name) > pin)
  }
  assert.ok(workflow.includes('            performance-browser-selection.json'))
})

test('requires exact measured browser metadata in every requested arm', () => {
  const arms = ['A', 'B', 'B-repeat', 'A-repeat']
  const seen = []
  verifyRenderBrowsers(arms, (file) => {
    seen.push(file)
    return JSON.stringify({
      environment: { browser: 'Chromium 147.0.7727.15' },
    })
  })
  assert.equal(seen.length, 4)
  assert.throws(() =>
    verifyRenderBrowsers(arms, () =>
      JSON.stringify({ environment: { browser: 'Chromium 157.0.8103.50' } }),
    ),
  )
  assert.throws(() => verifyRenderBrowsers(arms, () => '{}'))
  assert.throws(
    () =>
      verifyRenderBrowsers(arms, () => {
        throw new Error('ENOENT')
      }),
    /ENOENT/,
  )
})

test('reusable render job pins and verifies without touching visual jobs', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/_quality.yml', import.meta.url),
    'utf8',
  )
  const job = workflow.slice(
    workflow.indexOf('  real-render-performance:'),
    workflow.indexOf('  static-quality:'),
  )
  const install = job.indexOf(
    'pnpm exec playwright install --with-deps chromium',
  )
  const pin = job.indexOf(
    'node scripts/pin-render-browser.mjs .tmp/performance/current/browser-selection.json',
  )
  const measure = job.indexOf('pnpm perf:render --')
  const verify = job.indexOf(
    'node scripts/pin-render-browser.mjs --verify .tmp/performance/current',
  )
  const upload = job.indexOf('uses: actions/upload-artifact@v4')
  assert.ok(
    install < pin && pin < measure && measure < verify && verify < upload,
  )
  assert.ok(job.includes('path: .tmp/performance/current'))
  assert.equal(
    (workflow.match(/node scripts\/pin-render-browser.mjs/gu) ?? []).length,
    2,
  )
})

test('current and historical child launchers preserve the selected executable', async () => {
  const { spawn } = await import('node:child_process')
  const { runInNewContext } = await import('node:vm')
  const { runHistoricalProcess } =
    await import('./historical-bounded-process.mjs')
  const env = { ...process.env, FSUSUI_PERF_BROWSER_EXECUTABLE: executable }
  const source = readFileSync(
    new URL('./run-render-performance.mjs', import.meta.url),
    'utf8',
  )
  const start = source.indexOf('const run = ')
  const end = source.indexOf('\nawait mkdir(output', start)
  assert.ok(start >= 0 && end > start)
  const runCurrent = runInNewContext(`${source.slice(start, end)}; run`, {
    spawn,
    root: process.cwd(),
    process: { env },
  })
  const code = `
    const assert = require('node:assert/strict');
    assert.equal(process.env.FSUSUI_PERF_BROWSER_EXECUTABLE, process.argv[1]);
    const child = require('node:child_process').spawnSync(process.execPath, [
      '-e', 'process.stdout.write(process.env.FSUSUI_PERF_BROWSER_EXECUTABLE)'
    ], { encoding: 'utf8' });
    assert.equal(child.status, 0);
    assert.equal(child.stdout, process.argv[1]);
  `
  await runCurrent(process.execPath, ['-e', code, executable], {
    stdio: 'pipe',
  })
  await runHistoricalProcess(process.execPath, ['-e', code, executable], {
    env: { ...env, GITHUB_SHA: 'fixture-sha' },
    timeoutMs: 5000,
  })
  const historical = readFileSync(
    new URL('./run-historical-render-baseline.mjs', import.meta.url),
    'utf8',
  )
  assert.ok(historical.includes('env: process.env'))
  assert.ok(historical.includes('env: { ...sdk.env, GITHUB_SHA: sha }'))
})
