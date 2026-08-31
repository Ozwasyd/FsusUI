import assert from 'node:assert/strict'
import test from 'node:test'
import { captureDeterministicLocatorPng } from '../scripts/deterministic-render-evidence.mjs'

test('render evidence disables transitions and requires identical PNG samples', async () => {
  const options = []
  const png = Buffer.from('stable-png')
  const locator = {
    screenshot: async (value) => {
      options.push(value)
      return png
    },
  }
  assert.deepEqual(await captureDeterministicLocatorPng(locator), png)
  assert.deepEqual(options, [
    { animations: 'disabled' },
    { animations: 'disabled' },
  ])
})

test('render evidence rejects alternating pixels instead of selecting one digest', async () => {
  const frames = [Buffer.from('first'), Buffer.from('second')]
  await assert.rejects(
    () =>
      captureDeterministicLocatorPng({
        screenshot: async () => frames.shift(),
      }),
    /samples differ/u,
  )
})
