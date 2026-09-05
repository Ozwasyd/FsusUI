import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  parseAtspiResult,
  resolveAtspiBusAddress,
} from '../scripts/native-screen-reader-harness.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('AT-SPI bus resolution preserves an explicit address', () => {
  let called = false
  const address = resolveAtspiBusAddress(
    { AT_SPI_BUS_ADDRESS: 'unix:path=/explicit' },
    () => {
      called = true
    },
  )

  assert.equal(address, 'unix:path=/explicit')
  assert.equal(called, false)
})

test('AT-SPI bus resolution reads the accessibility bus from gdbus', () => {
  const environment = { DBUS_SESSION_BUS_ADDRESS: 'unix:path=/session' }
  const address = resolveAtspiBusAddress(
    environment,
    (command, args, options) => {
      assert.equal(command, 'gdbus')
      assert.deepEqual(args, [
        'call',
        '--session',
        '--dest',
        'org.a11y.Bus',
        '--object-path',
        '/org/a11y/bus',
        '--method',
        'org.a11y.Bus.GetAddress',
      ])
      assert.equal(options.env, environment)
      return {
        status: 0,
        stdout: "('unix:path=/run/user/1000/at-spi/bus_0',)\n",
      }
    },
  )

  assert.equal(address, 'unix:path=/run/user/1000/at-spi/bus_0')
})

test('AT-SPI bus resolution fails closed for unavailable or malformed buses', () => {
  assert.equal(
    resolveAtspiBusAddress({}, () => ({ status: 1, stdout: '' })),
    null,
  )
  assert.equal(
    resolveAtspiBusAddress({}, () => ({ status: 0, stdout: '(true,)' })),
    null,
  )
})

test('AT-SPI helper failures remain explicit and fail closed', () => {
  assert.deepEqual(
    parseAtspiResult({
      error: Object.assign(new Error('helper timed out'), {
        code: 'ETIMEDOUT',
      }),
      status: null,
      stderr: 'timeout',
    }),
    {
      ok: false,
      runnerError: {
        code: 'ETIMEDOUT',
        message: 'helper timed out',
      },
      stderr: 'timeout',
    },
  )

  assert.deepEqual(parseAtspiResult({ status: 4, stderr: 'bus unavailable' }), {
    ok: false,
    runnerError: {
      code: 'exit-4',
      message: 'AT-SPI helper exited unsuccessfully',
    },
    stderr: 'bus unavailable',
  })
})

test('AT-SPI helper output rejects invalid JSON and accepts real results', () => {
  assert.deepEqual(
    parseAtspiResult({
      status: 0,
      stdout: '{not-json',
      stderr: 'warning',
    }),
    {
      ok: false,
      parseError: true,
      stdout: '{not-json',
      stderr: 'warning',
    },
  )

  assert.deepEqual(
    parseAtspiResult({
      status: 0,
      stdout: '{}',
    }),
    {
      ok: false,
      runnerError: {
        code: 'invalid-result',
        message: 'AT-SPI helper did not report a successful result',
      },
    },
  )

  assert.deepEqual(
    parseAtspiResult({
      status: 0,
      stdout: '{"ok":true,"markdownEditableCount":1}',
    }),
    { ok: true, markdownEditableCount: 1 },
  )
})

test('interaction performance stops before accessibility evidence collection', () => {
  const source = fs.readFileSync(
    path.join(root, 'scripts/native-screen-reader-harness.mjs'),
    'utf8',
  )
  const interactionEnd = source.indexOf(
    'const interactionElapsedMilliseconds =',
  )
  const browserTreeCollection = source.indexOf(
    "cdp.send('Accessibility.getFullAXTree')",
  )
  const atspiCollection = source.indexOf("const atspi = spawnSync('python3'")

  assert.notEqual(interactionEnd, -1)
  assert.ok(interactionEnd < browserTreeCollection)
  assert.ok(interactionEnd < atspiCollection)
})
