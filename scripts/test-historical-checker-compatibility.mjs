import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  classifyHistoricalFailure,
  classifyHistoricalOutput,
} from './run-historical-render-baseline.mjs'

// Synthetic controls; never substitute for recorded baseline evidence.
const root = path.resolve(import.meta.dirname, '..')
const temporary = await mkdtemp(
  path.join(os.tmpdir(), 'fsus-historical-checkers-'),
)
const historical = path.join(temporary, 'historical')
const current = path.join(temporary, 'current')
const output = path.join(temporary, 'output')
const violation = 'avalonia/tree-expand-scroll frame p95 exceeded runaway limit'
const checker = {
  code: 1,
  signal: null,
  stderr: `Error: Absolute runaway performance limits failed:\n${violation}\n`,
}
const result = {
  ...checker,
  stderr: `${checker.stderr}Error: /usr/bin/node exited with 1\n`,
}
const calls = []
const execute = async (command, args, options) => {
  calls.push({ command, args, options })
  return checker
}
const policy = 'tests/performance/render-performance-policy.json'
try {
  for (const directory of [historical, current]) {
    await mkdir(path.join(directory, 'tests/performance'), { recursive: true })
    await mkdir(path.join(directory, 'scripts'), { recursive: true })
    await writeFile(
      path.join(directory, policy),
      await readFile(path.join(root, policy)),
    )
  }
  assert.deepEqual(classifyHistoricalFailure(result, checker), [violation])
  assert.deepEqual(
    await classifyHistoricalOutput(
      result,
      historical,
      output,
      current,
      execute,
    ),
    [violation],
  )
  assert.deepEqual(
    calls,
    [historical, current].map((directory) => ({
      command: process.execPath,
      args: [
        path.join(directory, 'scripts/check-render-performance-results.mjs'),
        output,
      ],
      options: { cwd: directory },
    })),
  )
  for (const arm of [0, 1]) {
    for (const mutation of [
      { code: 0 },
      { code: 2 },
      { code: null },
      { signal: 'SIGTERM' },
      { stderr: checker.stderr.replace('tree-expand-scroll', 'other') },
      { stderr: 'avalonia rendering backend was not resolved\n' },
      {
        stderr: checker.stderr.replace(
          'Absolute runaway performance limits failed:',
          'SyntaxError unrelated',
        ),
      },
      { stderr: `${checker.stderr}Error: additional failure\n` },
      { stderr: `${checker.stderr}TypeError: malformed checker\n` },
      {
        stderr: `${checker.stderr}avalonia/tree retained visuals must be a nonnegative integer\n`,
      },
    ]) {
      let invocation = 0
      await assert.rejects(
        classifyHistoricalOutput(
          result,
          historical,
          output,
          current,
          async () =>
            invocation++ === arm ? { ...checker, ...mutation } : checker,
        ),
      )
    }
  }
  await assert.rejects(
    classifyHistoricalOutput(result, historical, output, current, async () => {
      throw new Error('spawn ENOENT')
    }),
    /spawn ENOENT/u,
  )
  await writeFile(path.join(current, policy), '{}')
  let called = false
  await assert.rejects(
    classifyHistoricalOutput(result, historical, output, current, async () => {
      called = true
      return checker
    }),
    /acceptance contract changed/u,
  )
  assert.equal(called, false)
  await writeFile(
    path.join(current, policy),
    await readFile(path.join(root, policy)),
  )

  // Exercise real subprocess argv/cwd and real legacy/new checker implementations.
  const currentSource = await readFile(
    path.join(root, 'scripts/check-render-performance-results.mjs'),
    'utf8',
  )
  const legacySource = currentSource.replace(
    / {2}const retainedVisuals = result\.RetainedVisuals\?\.AfterUnload[\s\S]*? {2}\} else if \(retainedVisuals > policy\.avalonia\.maxRetainedVisuals\) \{/u,
    '  if (result.RetainedVisuals > policy.avalonia.maxRetainedVisuals) {',
  )
  assert.notEqual(
    legacySource,
    currentSource,
    'legacy control must restore original predicate',
  )
  await writeFile(
    path.join(historical, 'scripts/check-render-performance-results.mjs'),
    legacySource,
  )
  await writeFile(
    path.join(current, 'scripts/check-render-performance-results.mjs'),
    currentSource,
  )
  for (const platform of ['web', 'avalonia'])
    await mkdir(path.join(output, platform), { recursive: true })
  await writeFile(
    path.join(output, 'web/summary.json'),
    JSON.stringify({ results: [] }),
  )
  const summary = (retained) => ({
    Environment: { RenderingBackend: 'Skia', WindowPlatform: 'X11' },
    Results: [
      {
        Id: 'tree-expand-scroll',
        FrameMs: { P95: 3000 },
        AllocatedBytes: { Max: 1 },
        RetainedVisuals: { AfterUnload: retained },
      },
    ],
  })
  await writeFile(
    path.join(output, 'avalonia/summary.json'),
    JSON.stringify(summary(6)),
  )
  assert.deepEqual(
    await classifyHistoricalOutput(result, historical, output, current),
    [violation],
  )
  await writeFile(
    path.join(output, 'avalonia/summary.json'),
    JSON.stringify(summary(25001)),
  )
  await assert.rejects(
    classifyHistoricalOutput(result, historical, output, current),
    /checker failure disagreement/u,
  )
  await writeFile(path.join(output, 'avalonia/summary.json'), '{malformed')
  await assert.rejects(
    classifyHistoricalOutput(result, historical, output, current),
  )
  console.info(
    'Historical checker compatibility controls passed (legacy/current real processes, argv/cwd, exact diagnostics, malformed, status, signal and unchanged policy).',
  )
} finally {
  await rm(temporary, { recursive: true, force: true })
}
