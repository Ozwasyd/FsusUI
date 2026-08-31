import assert from 'node:assert/strict'
import test from 'node:test'
import { captureDeterministicLocatorPng } from '../scripts/deterministic-render-evidence.mjs'

test('render evidence settles fonts and animations before requiring identical PNG samples', async () => {
  let settled = false
  const png = Buffer.from('stable-png')
  const locator = {
    evaluate: async () => {
      settled = true
    },
    screenshot: async () => png,
  }
  assert.deepEqual(await captureDeterministicLocatorPng(locator), png)
  assert.equal(settled, true)
})

test('render evidence rejects alternating pixels instead of selecting one digest', async () => {
  const frames = [Buffer.from('first'), Buffer.from('second')]
  await assert.rejects(
    () =>
      captureDeterministicLocatorPng({
        evaluate: async () => {},
        screenshot: async () => frames.shift(),
      }),
    /samples differ/u,
  )
})
