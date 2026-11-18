import { Buffer } from 'node:buffer'
import { setImmediate } from 'node:timers'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import {
  bounded,
  guardMethods,
  waitForServer,
  readTrace,
  stopServer,
  observeServer,
  cleanupAll,
} from './web-render-liveness.mjs'
const hang = () => new Promise(() => {})
test('success, rejection, and late rejection settle without changing values', async () => {
  assert.equal(await bounded(() => 42, 'ok', 20), 42)
  await assert.rejects(
    bounded(() => Promise.reject(new Error('original')), 'bad', 20),
    /original/,
  )
  let reject
  await assert.rejects(
    bounded(
      () =>
        new Promise((_, r) => {
          reject = r
        }),
      'scenario/sample',
      5,
    ),
    /scenario\/sample/,
  )
  reject(new Error('late'))
  await new Promise((r) => setImmediate(r))
})
test('guard preserves this and arguments; names CDP command and scenario', async () => {
  const object = {
    value: 2,
    evaluate(n) {
      return this.value + n
    },
    send: hang,
  }
  const guarded = guardMethods(
    object,
    ['evaluate', 'send'],
    () => 'variable sample 3',
    5,
  )
  assert.equal(await guarded.evaluate(4), 6)
  await assert.rejects(
    guarded.send('Performance.getMetrics'),
    /variable sample 3 send:Performance.getMetrics/,
  )
})
test('readiness enforces overall budget even when fetch ignores abort', async () => {
  let signal
  await assert.rejects(
    waitForServer({ exitCode: null }, 'http://local', 10, (_, options) => {
      signal = options.signal
      return hang()
    }),
    /fixture server/,
  )
  assert.equal(signal.aborted, true)
})
test('readiness cancels body and propagates server exit', async () => {
  let cancelled = false
  await waitForServer({ exitCode: null }, 'http://local', 50, async () => ({
    ok: true,
    body: {
      async cancel() {
        cancelled = true
      },
    },
  }))
  assert(cancelled)
  await assert.rejects(
    waitForServer({ exitCode: 1 }, 'http://local', 50),
    /Vite exited with 1/,
  )
})
test('trace exact bytes retained and stream closed', async () => {
  const calls = []
  const session = {
    async send(method) {
      calls.push(method)
      return { data: '{"traceEvents":[{"name":"Layout"}]}', eof: true }
    },
  }
  assert.deepEqual(await readTrace(session, 's', 'scene', 100), [
    { name: 'Layout' },
  ])
  assert.deepEqual(calls, ['IO.read', 'IO.close'])
})
test('trace stalled read and absent EOF fail closed', async () => {
  await assert.rejects(
    readTrace({ send: hang }, 's', 'scene', 5),
    /scene IO.read/,
  )
  await assert.rejects(
    readTrace(
      {
        async send() {
          return { data: '', eof: false }
        },
      },
      's',
      'scene',
      5,
    ),
    /scene trace stream EOF/,
  )
})
test('missing tracingComplete deadline is explicit', async () => {
  await assert.rejects(
    bounded(hang, 'scene tracingComplete', 5),
    /scene tracingComplete/,
  )
})
test('server cleanup escalates and removes listener', async () => {
  const server = new EventEmitter()
  server.exitCode = null
  const signals = []
  server.kill = (signal) => {
    signals.push(signal)
    if (signal === 'SIGKILL') server.emit('exit', null, signal)
  }
  await stopServer(server, 5)
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL'])
  assert.equal(server.listenerCount('exit'), 0)
})

test('spawn error is handled immediately and bounded stderr tail is surfaced', async () => {
  const server = new EventEmitter()
  server.exitCode = null
  server.stderr = new EventEmitter()
  observeServer(server, 8)
  server.stderr.emit('data', Buffer.from('prefix-0123456789'))
  server.emit('error', new Error('ENOENT executable'))
  await assert.rejects(waitForServer(server, 'http://local', 5), (error) => {
    assert.match(error.message, /ENOENT executable/)
    assert.match(error.message, /23456789/)
    assert(!error.message.includes('prefix'))
    return true
  })
  await stopServer(server, 5)
})
test('signal exit is detected and already-exited child is not signalled', async () => {
  const server = {
    exitCode: null,
    signalCode: 'SIGTERM',
    kill() {
      throw new Error('must not kill')
    },
  }
  await assert.rejects(waitForServer(server, 'http://local', 5), /SIGTERM/)
  await stopServer(server, 5)
})
test('cleanup preserves primary failure and attempts every cleanup', async () => {
  const primary = new Error('scene sample timed out')
  const secondary = [new Error('browser'), new Error('server')]
  const reported = []
  await cleanupAll(
    primary,
    secondary.map((error) => async () => {
      throw error
    }),
    (...args) => reported.push(args),
  )
  assert.deepEqual(
    reported.map((args) => args[1]),
    secondary,
  )
  const executed = []
  await assert.rejects(
    cleanupAll(
      null,
      secondary.map((error) => async () => {
        executed.push(error)
        throw error
      }),
      () => {},
    ),
    (error) => error === secondary[0],
  )
  assert.deepEqual(executed, secondary)
})
