import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  classifyHistoricalFailure,
  validateBaselineEvidence,
} from './run-historical-render-baseline.mjs'
import {
  createImpactPlan,
  loadOwnershipRegistry,
} from './render-performance-impact.mjs'

const root = path.resolve(import.meta.dirname, '..')
const plan = createImpactPlan({
  changedFiles: ['dotnet/FsusUI.Avalonia/Controls/FsusTreeControls.cs'],
  registry: await loadOwnershipRegistry(root),
  baseRef: 'fixture-base',
})
const sha = 'a'.repeat(40)
const directory = await mkdtemp(
  path.join(os.tmpdir(), 'fsus-historical-perf-test-'),
)
const write = async (file, value) =>
  writeFile(path.join(directory, file), JSON.stringify(value))
const metrics = Array(21).fill(3000)
const stats = { Max: 3000, P95: 3000 }
const raw = {
  Id: 'tree-expand-scroll',
  FrameMs: metrics,
  MeasureArrangeMs: metrics,
  DrawMs: metrics,
  MountUnmountMs: metrics,
  AllocatedBytes: metrics,
  LongScroll: { Iterations: 256 },
}
const entry = {
  Id: raw.Id,
  FrameMs: stats,
  MeasureArrangeMs: stats,
  DrawMs: stats,
  MountUnmountMs: stats,
  AllocatedBytes: stats,
  RetainedVisuals: { ReturnedToBaseline: true, AfterUnload: 6 },
}
const summary = {
  GitSha: sha,
  Profile: 'quick',
  GeneratedAt: new Date().toISOString(),
  Runner: {
    Samples: 21,
    Warmups: 1,
    ScenarioCount: 1,
    LongScrollIterations: 256,
  },
  Environment: {
    RenderingBackend: 'renderer',
    WindowPlatform: 'X11',
    PlatformGraphicsBackend: 'software',
  },
  Results: [entry],
}
const check = () => validateBaselineEvidence(directory, plan, sha, 0)
const violation = 'avalonia/tree-expand-scroll frame p95 exceeded runaway limit'
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
try {
  await mkdir(path.join(directory, 'avalonia/raw'), { recursive: true })
  await write('impact-plan.json', plan)
  await write('avalonia/summary.json', summary)
  await write('avalonia/raw/tree-expand-scroll.raw.json', raw)
  await check()
  assert.deepEqual(classifyHistoricalFailure(result, checker), [violation])
  for (const mutation of [
    { code: 2 },
    { signal: 'SIGTERM' },
    { stderr: 'Error: build failed\n' },
    { stderr: `${result.stderr}Error: infrastructure failure\n` },
    { stderr: result.stderr.replace('tree-expand-scroll', 'other-scenario') },
  ])
    assert.throws(() =>
      classifyHistoricalFailure({ ...result, ...mutation }, checker),
    )
  assert.throws(() =>
    classifyHistoricalFailure(result, { ...checker, code: 0 }),
  )
  assert.throws(() =>
    classifyHistoricalFailure(result, {
      ...checker,
      stderr: 'avalonia rendering backend was not resolved\n',
    }),
  )
  for (const mutation of [
    { GitSha: 'b'.repeat(40) },
    { GeneratedAt: 'invalid' },
    { Profile: 'full' },
    { Runner: { ...summary.Runner, Samples: 20 } },
    { Runner: { ...summary.Runner, ScenarioCount: 2 } },
    { Environment: { ...summary.Environment, WindowPlatform: 'unresolved' } },
    { Results: [{ ...entry, FrameMs: { P95: 1 } }] },
    { Results: [{ ...entry, RetainedVisuals: { ReturnedToBaseline: false } }] },
  ]) {
    await write('avalonia/summary.json', { ...summary, ...mutation })
    await assert.rejects(check())
  }
  await write('avalonia/summary.json', summary)
  await assert.rejects(
    validateBaselineEvidence(directory, plan, sha, Date.now() + 1000),
  )
  for (const mutation of [
    { FrameMs: metrics.slice(1) },
    { FrameMs: [...metrics.slice(1), null] },
    { LongScroll: { Iterations: 10 } },
    { AllocatedBytes: [] },
    { Id: 'other' },
  ]) {
    await write('avalonia/raw/tree-expand-scroll.raw.json', {
      ...raw,
      ...mutation,
    })
    await assert.rejects(check())
  }
  await rm(path.join(directory, 'avalonia/raw/tree-expand-scroll.raw.json'))
  await assert.rejects(check())
  console.info(
    'Historical baseline evidence/classification fixtures passed (positive over-limit; failure, identity, backend, incomplete, stale and raw mismatch rejections).',
  )
} finally {
  await rm(directory, { recursive: true, force: true })
}
