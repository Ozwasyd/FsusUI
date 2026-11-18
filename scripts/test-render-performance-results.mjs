import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createImpactPlan } from './render-performance-impact.mjs'

// Synthetic negative controls only, never performance acceptance evidence.
const root = path.resolve(import.meta.dirname, '..')
const temporary = mkdtempSync(path.join(tmpdir(), 'fsus-checker-controls-'))
const failures = []
let count = 0
const json = (file, value) => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value))
}
const check = (label, script, args, reason = null) => {
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts', script), ...args],
    { encoding: 'utf8' },
  )
  try {
    if (reason) {
      assert.notEqual(result.status, 0, 'must reject invalid evidence')
      assert.match(result.stderr, reason)
    } else assert.equal(result.status, 0, result.stderr)
    count++
  } catch (error) {
    failures.push(`${label}: ${error.message}`)
  }
}
try {
  const absolute = path.join(temporary, 'absolute')
  json(path.join(absolute, 'web/summary.json'), {
    results: [
      {
        id: 'web-control',
        inputToNextFrameMs: { p95: 10 },
        droppedFrameRate: 0,
        longTasks: { longestMs: 0 },
        domNodes: 10,
      },
    ],
  })
  for (const [label, value, reason] of [
    ['zero retained', { AfterUnload: 0 }, null],
    ['at retained limit', { AfterUnload: 25000 }, null],
    [
      'above retained limit',
      { AfterUnload: 25001 },
      /retained visuals exceeded runaway limit/u,
    ],
    [
      'missing retained count',
      {},
      /retained visuals must be a nonnegative integer/u,
    ],
    [
      'legacy scalar is not producer shape',
      5,
      /retained visuals must be a nonnegative integer/u,
    ],
    [
      'string retained count',
      { AfterUnload: '1' },
      /retained visuals must be a nonnegative integer/u,
    ],
    [
      'null retained count',
      { AfterUnload: null },
      /retained visuals must be a nonnegative integer/u,
    ],
    [
      'negative retained count',
      { AfterUnload: -1 },
      /retained visuals must be a nonnegative integer/u,
    ],
    [
      'fractional retained count',
      { AfterUnload: 0.5 },
      /retained visuals must be a nonnegative integer/u,
    ],
  ]) {
    json(path.join(absolute, 'avalonia/summary.json'), {
      Environment: { RenderingBackend: 'Skia', WindowPlatform: 'X11' },
      Results: [
        {
          Id: 'native-control',
          FrameMs: { P95: 10 },
          AllocatedBytes: { Max: 10 },
          RetainedVisuals: value,
        },
      ],
    })
    check(label, 'check-render-performance-results.mjs', [absolute], reason)
  }
  const arms = ['baseline', 'current', 'baseline-repeat', 'current-repeat'].map(
    (name) => path.join(temporary, name),
  )
  for (const platform of ['web', 'avalonia']) {
    const scenario = platform === 'web' ? 'markdown-' : 'virtual-'
    const plan = createImpactPlan({
      changedFiles: ['fixture'],
      registry: {
        schemaVersion: 1,
        rules: [
          {
            id: 'fixture',
            patterns: ['fixture'],
            scope: `${platform}-only`,
            [`${platform}Scenario`]: scenario,
          },
        ],
      },
    })
    const write = (id, value = 10, arm = null) => {
      for (const directory of arm === null ? arms : [arms[arm]]) {
        json(path.join(directory, 'impact-plan.json'), plan)
        json(
          path.join(directory, platform, 'summary.json'),
          platform === 'web'
            ? { results: [{ id, inputToNextFrameMs: { p95: value } }] }
            : { Results: [{ Id: id, FrameMs: { P95: value } }] },
        )
      }
    }
    const args = [arms[0], arms[1], '0.15', arms[2], arms[3]]
    const valid = `${scenario}control`
    write(valid)
    check(`${platform} matching plan`, 'compare-render-performance.mjs', args)
    write('unrelated-case')
    check(
      `${platform} all four unrelated`,
      'compare-render-performance.mjs',
      args,
      /outside the selected impact plan scope/u,
    )
    for (let arm = 0; arm < arms.length; arm++) {
      write(valid)
      write('unrelated-case', 10, arm)
      check(
        `${platform} unrelated arm ${arm}`,
        'compare-render-performance.mjs',
        args,
        /outside the selected impact plan scope/u,
      )
    }
    write(valid)
    write(valid, 11.5, 1)
    write(valid, 11.5, 3)
    check(
      `${platform} exactly 15 percent remains allowed`,
      'compare-render-performance.mjs',
      args,
    )
    write(valid, 11.51, 1)
    write(valid, 11.51, 3)
    check(
      `${platform} above 15 percent remains rejected`,
      'compare-render-performance.mjs',
      args,
      /Relative real-render performance regressions/u,
    )
    // Native producer uses case-insensitive Contains; Web uses case-sensitive StartsWith.
    write(
      platform === 'avalonia'
        ? 'prefix-VIRTUAL-control'
        : 'prefix-markdown-control',
    )
    check(
      `${platform} producer selection semantics`,
      'compare-render-performance.mjs',
      args,
      platform === 'web' ? /outside the selected impact plan scope/u : null,
    )
  }
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
assert.equal(failures.length, 0, failures.join('\n'))
console.info(`Render performance result controls passed (${count} cases).`)
