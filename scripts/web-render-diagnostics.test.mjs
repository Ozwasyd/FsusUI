import { Buffer } from 'node:buffer'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  diagnosticIds,
  maxTraceEvents,
  maxDiagnosticBytes,
  encodeDiagnostic,
  sha256,
  writeDiagnostics,
} from './web-render-diagnostics.mjs'
const root = path.resolve(import.meta.dirname, '..')
const raw = {
  id: [...diagnosticIds][0],
  inputToFrame: [10],
  frameWork: [2],
  browserMetrics: { NavigationStart: 100, Timestamp: 101 },
}
const record = {
  raw,
  anchors: [
    {
      iteration: 1,
      started: 10,
      actionCompleted: 12,
      frameCompleted: 20,
      rafTimestamp: 19,
    },
  ],
  traceEvents: [{ name: 'Layout', ts: 100011000, dur: 1 }],
  totalTraceEvents: 1,
}
const identity = {
  gitSha: 'a'.repeat(40),
  runnerSha256: 'b'.repeat(64),
  diagnosticWriterSha256: 'c'.repeat(64),
  browser: 'Chromium fixture',
  profile: 'quick',
  warmups: 1,
  samples: 1,
}
test('exact identity, raw-byte digest and clock anchors are preserved', () => {
  const out = JSON.parse(encodeDiagnostic(record, identity))
  assert.equal(
    out.identity.rawSha256,
    sha256(`${JSON.stringify(raw, null, 2)}\n`),
  )
  assert.deepEqual(out.anchors, record.anchors)
  assert.equal(out.identity.scenarioId, raw.id)
  assert.equal(out.clocks.navigationStartSeconds, 100)
  assert.equal(out.truncated, false)
})
test('reject wrong identity, matrix and anchor/sample binding', () => {
  assert.throws(() =>
    encodeDiagnostic(record, { ...identity, gitSha: 'local-worktree' }),
  )
  assert.throws(() =>
    encodeDiagnostic(
      {
        ...record,
        raw: {
          ...raw,
          id: 'virtual-window-index-legacy-100000-60hz-dpr1-enabled',
        },
      },
      identity,
    ),
  )
  assert.throws(() => encodeDiagnostic({ ...record, anchors: [] }, identity))
  assert.throws(() =>
    encodeDiagnostic(
      { ...record, anchors: [{ ...record.anchors[0], frameCompleted: 21 }] },
      identity,
    ),
  )
})
test('bounded serialization explicitly labels truncation without dropping anchors', () => {
  const r = {
    ...record,
    traceEvents: Array.from({ length: 200 }, () => ({
      name: 'x'.repeat(1000),
    })),
    totalTraceEvents: 201,
  }
  const bytes = encodeDiagnostic(r, identity, 3000)
  assert(Buffer.byteLength(bytes) <= 3000)
  const out = JSON.parse(bytes)
  assert(out.truncated)
  assert.equal(out.totalTraceEvents, 201)
  assert.deepEqual(out.anchors, record.anchors)
})
test('writer emits only requested diagnostic file subtree', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'web-diagnostic-test-'))
  try {
    await writeDiagnostics(dir, [record], identity)
    assert.deepEqual(await readdir(dir), ['diagnostics'])
    assert.deepEqual(await readdir(path.join(dir, 'diagnostics')), [
      `${raw.id}.diagnostic.json`,
    ])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
test('runner emits after all measurements and does not add browser evaluations or clock reads', async () => {
  const s = await readFile(
    path.join(root, 'scripts/web-render-performance.mjs'),
    'utf8',
  )
  assert(
    s.indexOf('await writeDiagnostics(') > s.indexOf('await browser.close()'),
  )
  assert(!s.includes('cpu_profiler'))
  assert(
    s.includes(
      "'devtools.timeline,disabled-by-default-devtools.timeline.layers'",
    ),
  )
  assert(s.includes('requestAnimationFrame(resolve)'))
  assert(
    s.includes(
      'inputToNextFrameMs: (frameCompleted = performance.now()) - started',
    ),
  )
})
test('failure-only diagnostics upload is separated from unmodified normal output dirs', async () => {
  const y = await readFile(
    path.join(root, '.github/workflows/quality.yml'),
    'utf8',
  )
  assert(y.includes('            !performance-*/web/diagnostics/**'))
  const block = y.slice(
    y.indexOf('      - name: Preserve failed Web measurement diagnostics'),
    y.indexOf('\n  premerge-main:'),
  )
  assert(block.includes('        if: failure()'))
  assert(
    block.includes(
      '          path: performance-*/web/diagnostics/*.diagnostic.json',
    ),
  )
  assert(block.includes('          retention-days: 7'))
})

test('diagnostics opt-in is limited to two current CI measurements', async () => {
  const s = await readFile(
    path.join(root, 'scripts/web-render-performance.mjs'),
    'utf8',
  )
  const y = await readFile(
    path.join(root, '.github/workflows/quality.yml'),
    'utf8',
  )
  assert(s.includes("process.env.FSUSUI_WEB_FAILURE_DIAGNOSTICS === '1'"))
  assert(s.includes('const anchors = captureDiagnostic ? [] : null'))
  assert(s.includes('if (captureDiagnostic) anchors.push(sample.anchor)'))
  const blocks = y
    .split('      - ')
    .filter((block) => block.includes('FSUSUI_WEB_FAILURE_DIAGNOSTICS:'))
  assert.equal(blocks.length, 2)
  assert(blocks[0].startsWith('name: Measure current quick matrix'))
  assert(
    blocks[1].startsWith('name: Repeat current quick matrix for order balance'),
  )
})

test('four exact confirmed rows preserve the previous aggregate retention ceilings', () => {
  assert.deepEqual(
    [...diagnosticIds],
    [
      'virtual-list-fixed-100000-60hz-dpr1-enabled',
      'virtual-window-index-legacy-100000-120hz-dpr2-reduced',
      'virtual-grid-100000-60hz-dpr2-disabled',
      'data-pipeline-table-100000-120hz-dpr2-reduced',
    ],
  )
  assert.equal(diagnosticIds.size * maxTraceEvents, 200_000)
  assert.equal(diagnosticIds.size * maxDiagnosticBytes, 16 * 1024 * 1024)
  for (const id of diagnosticIds) {
    const input = { ...record, raw: { ...raw, id } }
    const out = JSON.parse(encodeDiagnostic(input, identity))
    assert.equal(out.identity.scenarioId, id)
    assert.equal(
      out.identity.rawSha256,
      sha256(`${JSON.stringify(input.raw, null, 2)}\n`),
    )
    assert.deepEqual(out.anchors, record.anchors)
  }
  for (const id of [
    'virtual-grid-100000-60hz-dpr1-enabled',
    'data-pipeline-table-100000-60hz-dpr1-enabled',
  ]) {
    assert.throws(() =>
      encodeDiagnostic({ ...record, raw: { ...raw, id } }, identity),
    )
  }
})
