import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { clearTimeout, setTimeout } from 'node:timers'
import {
  runHistoricalProcess,
  execHistoricalProcess,
  historicalDeadlines,
} from './historical-bounded-process.mjs'
import {
  classifyHistoricalFailure,
  writeHistoricalFailure,
} from './run-historical-render-baseline.mjs'

const run = (source, options = {}) =>
  runHistoricalProcess(process.execPath, ['-e', source], {
    timeoutMs: 1_200,
    graceMs: 100,
    stage: 'fixture',
    ...options,
  })
const listeners = ['SIGINT', 'SIGTERM'].map((s) => process.listenerCount(s))
assert.equal(historicalDeadlines.benchmark, 15 * 60_000)
assert.deepEqual(
  await run(
    "process.stdout.write('normal');process.stderr.write('diagnostic')",
  ),
  { code: 0, signal: null, stdout: 'normal', stderr: 'diagnostic' },
)
await assert.rejects(
  execHistoricalProcess(process.execPath, ['-e', 'process.exit(1)'], {
    timeoutMs: 1000,
    stage: 'git-control',
  }),
  (e) => e.code === 1,
)
await assert.rejects(
  runHistoricalProcess('/nonexistent-fsus-command', [], {
    timeoutMs: 200,
    stage: 'missing',
  }),
  (e) => e.code === 'ENOENT',
)
await assert.rejects(
  run("console.log('before-hang');setInterval(()=>{},1000)"),
  (e) =>
    e.code === 'HISTORICAL_TIMEOUT' &&
    e.timedOut &&
    e.stdout.includes('before-hang'),
)
await assert.rejects(
  run("process.stdout.write('x'.repeat(4096));setInterval(()=>{},1000)", {
    maxOutputBytes: 1024,
  }),
  (e) =>
    e.code === 'HISTORICAL_OUTPUT_LIMIT' &&
    Buffer.byteLength(e.stdout) + Buffer.byteLength(e.stderr) <= 1024,
)
if (process.platform !== 'win32') {
  // Leader exits on TERM, descendant ignores it and keeps inherited output descriptors.
  const source = `const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{stdio:'inherit'});console.log(c.pid);setInterval(()=>{},1000)`
  let failure
  try {
    await run(source)
  } catch (e) {
    failure = e
  }
  assert.equal(failure.code, 'HISTORICAL_TIMEOUT')
  const pid = Number(failure.stdout.trim())
  assert.ok(pid > 1 && pid !== process.pid)
  if (process.platform === 'linux') {
    const state = fs.existsSync(`/proc/${pid}/stat`)
      ? fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(' ')[2]
      : null
    assert.ok(
      state === null || state === 'Z',
      `descendant ${pid} remains live: ${state}`,
    )
  } else assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
  // The launcher exits immediately; its descendant alone keeps the pipe open.
  await assert.rejects(
    run(
      `require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});process.exit(0)`,
    ),
    (e) => e.timedOut,
  )
  for (const signal of ['SIGTERM', 'SIGINT']) {
    const timer = setTimeout(() => process.emit(signal), 150)
    try {
      await assert.rejects(
        run("process.on('SIGTERM',()=>{});setInterval(()=>{},1000)", {
          timeoutMs: 2000,
        }),
        (e) => e.code === 'HISTORICAL_CANCELLED' && e.cancelled,
      )
    } finally {
      clearTimeout(timer)
    }
  }
}
assert.deepEqual(
  ['SIGINT', 'SIGTERM'].map((s) => process.listenerCount(s)),
  listeners,
)
const violation = 'avalonia/tree frame p95 exceeded runaway limit'
const result = {
  code: 1,
  signal: null,
  stderr: `Error: Absolute runaway performance limits failed:\n${violation}\nError: /usr/bin/node exited with 1\n`,
}
const checker = {
  code: 1,
  signal: null,
  stderr: `Error: Absolute runaway performance limits failed:\n${violation}\n`,
}
assert.throws(() =>
  classifyHistoricalFailure({ ...result, timedOut: true }, checker),
)
assert.throws(() =>
  classifyHistoricalFailure({ ...result, cancelled: true }, checker),
)
console.log(
  'Historical bounded process controls passed (normal, spawn failure, numeric failure, output cap, hang, pipe leak, descendant KILL, cancellation, listener cleanup, classification).',
)

const output = fs.mkdtempSync(
  path.join(os.tmpdir(), 'historical-failure-control-'),
)
try {
  fs.mkdirSync(path.join(output, 'web'))
  fs.writeFileSync(path.join(output, 'web', 'one.raw.json'), '{}')
  await writeHistoricalFailure(
    output,
    Object.assign(new Error('fixture deadline'), {
      code: 'HISTORICAL_TIMEOUT',
      stage: 'benchmark',
      stdout: 'saved-out',
      stderr: 'saved-err',
    }),
    Date.now(),
  )
  const status = JSON.parse(
    fs.readFileSync(
      path.join(output, 'historical-failure-status.json'),
      'utf8',
    ),
  )
  assert.equal(status.status, 'failed')
  assert.equal(status.partialOutput.webRawFiles, 1)
  assert.equal(status.partialOutput.avaloniaSummary, false)
  assert.match(
    fs.readFileSync(path.join(output, 'historical-process.log'), 'utf8'),
    /saved-out\nsaved-err\nfixture deadline/,
  )
  assert.equal(
    fs.existsSync(path.join(output, 'historical-measurement-status.json')),
    false,
  )
} finally {
  fs.rmSync(output, { recursive: true, force: true })
}
