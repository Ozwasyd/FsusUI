import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import {
  selectRenderBrowser,
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
test('native evidence job selects the pinned browser before capture', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/_quality.yml', import.meta.url),
    'utf8',
  )
  const pin = workflow.indexOf(
    'node scripts/pin-render-browser.mjs .tmp/conformance-browser-selection.json',
  )
  assert.ok(pin > workflow.indexOf('playwright install --with-deps chromium'))
  assert.ok(
    pin <
      workflow.indexOf(
        'xvfb-run -a dbus-run-session -- pnpm run conformance:v2',
      ),
  )
})
