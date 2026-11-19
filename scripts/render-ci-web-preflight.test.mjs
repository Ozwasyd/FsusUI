import assert from 'node:assert/strict'
import test from 'node:test'
import { verifyWebRunner } from './render-ci-web-preflight.mjs'

function fixture(version = '147.0.7727.15', error = null) {
  const calls = []
  return {
    calls,
    async run() {
      const browser = {
        version: () => version,
        close: async () => calls.push('close'),
      }
      return verifyWebRunner('/pinned/chromium', {
        select: (executable) => ({ executable }),
        launch: async (options) => {
          assert.deepEqual(options, {
            executablePath: '/pinned/chromium',
            chromiumSandbox: true,
            headless: true,
            timeout: 10_000,
          })
          calls.push('launch')
          return browser
        },
        capture: async () => {
          calls.push('capture')
          if (error) throw error
          return { intervals: Array(20).fill(1000 / 60) }
        },
      })
    },
  }
}

test('runner preflight uses pinned sandboxed Chromium and exits before collection', async () => {
  const f = fixture()
  const details = await f.run()
  assert.equal(details.idleCadence.intervals.length, 20)
  assert.deepEqual(f.calls, ['launch', 'capture', 'close'])
})

test('wrong browser or cadence mismatch fail and still close browser', async () => {
  const wrong = fixture('157.0.0.0')
  await assert.rejects(wrong.run(), /differs from pin/u)
  assert.deepEqual(wrong.calls, ['launch', 'close'])
  const mismatch = fixture(
    undefined,
    new Error('idle browser cadence is inconsistent'),
  )
  await assert.rejects(mismatch.run(), /cadence is inconsistent/u)
  assert.deepEqual(mismatch.calls, ['launch', 'capture', 'close'])
})
