import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import {
  createImpactPlan,
  loadOwnershipRegistry,
  verifyImpactPlan,
} from './render-performance-impact.mjs'

const root = path.resolve(import.meta.dirname, '..')
const execFileAsync = promisify(execFile)
const registry = await loadOwnershipRegistry(root)
const cases = JSON.parse(
  await readFile(
    path.join(root, 'tests/fixtures/render-performance-impact-plan/cases.json'),
    'utf8',
  ),
)

for (const fixture of cases) {
  const plan = createImpactPlan({
    changedFiles: fixture.files,
    registry,
    baseRef: 'fixture-base',
  })
  verifyImpactPlan(plan)
  assert.equal(plan.scope, fixture.scope, fixture.name)
  if ('webScenario' in fixture)
    assert.equal(plan.platforms.web.scenario, fixture.webScenario, fixture.name)
  if ('avaloniaScenario' in fixture)
    assert.equal(
      plan.platforms.avalonia.scenario,
      fixture.avaloniaScenario,
      fixture.name,
    )
}

const fallback = createImpactPlan({
  changedFiles: [],
  registry,
  fallbackReason: 'fixture missing base',
})
assert.equal(fallback.scope, 'both')
assert.equal(fallback.platforms.web.scenario, null)
assert.equal(fallback.platforms.avalonia.scenario, null)
assert.equal(
  createImpactPlan({
    changedFiles: cases[0].files,
    registry,
    baseRef: 'fixture-base',
  }).planDigest,
  createImpactPlan({
    changedFiles: cases[0].files,
    registry,
    baseRef: 'fixture-base',
  }).planDigest,
)

const scopedWebInputs = {
  changedFiles: ['dotnet/FsusUI.Avalonia/Controls/FsusTreeControls.cs'],
  registry,
  baseRef: 'f2d929a5d045439c35e93b4771f912ce50ec2337',
  webOnlyForPr1085: true,
}
const scopedWebPlan = createImpactPlan(scopedWebInputs)
assert.throws(
  () => createImpactPlan({ ...scopedWebInputs, baseRef: 'fixture-base' }),
  /exact historical baseline/u,
)
const { planDigest: scopedDigest, ...scopedPayload } = scopedWebPlan
for (const patch of [
  { baseRef: 'a'.repeat(40) },
  { platforms: { ...scopedPayload.platforms, web: { run: true, scenario: 'tree' } } },
]) {
  const invalid = { ...scopedPayload, ...patch }
  const planDigest = createHash('sha256').update(JSON.stringify(invalid)).digest('hex')
  assert.notEqual(planDigest, scopedDigest)
  assert.throws(() => verifyImpactPlan({ ...invalid, planDigest }), /exact historical baseline and full Web-only matrix/u)
}
assert.equal(verifyImpactPlan(scopedWebPlan).acceptanceException, 'pr-1085-web-only')
assert.equal(scopedWebPlan.scope, 'web-only')
assert.deepEqual(scopedWebPlan.platforms, {
  web: { run: true, scenario: null },
  avalonia: { run: false, scenario: null },
})
assert.deepEqual(scopedWebPlan.measurement, fallback.measurement)
assert.notEqual(scopedWebPlan.planDigest, fallback.planDigest)

const compareRoot = await mkdtemp(path.join(os.tmpdir(), 'fsusui-impact-test-'))
try {
  const baseline = path.join(compareRoot, 'baseline')
  const current = path.join(compareRoot, 'current')
  const baselineRepeat = path.join(compareRoot, 'baseline-repeat')
  const currentRepeat = path.join(compareRoot, 'current-repeat')
  const absoluteWeb = path.join(compareRoot, 'absolute', 'web')
  await mkdir(absoluteWeb, { recursive: true })
  const absoluteSummary = path.join(absoluteWeb, 'summary.json')
  const checkAbsolute = (...flags) => execFileAsync(process.execPath, [
    path.join(root, 'scripts/check-render-performance-results.mjs'),
    path.dirname(absoluteWeb),
    ...flags,
  ])
  const row = {
    id: 'fixture',
    inputToNextFrameMs: { p95: 1 },
    droppedFrameRate: 0,
    longTasks: { longestMs: 1 },
    domNodes: 1,
  }
  await writeFile(absoluteSummary, JSON.stringify({ results: [row] }))
  await checkAbsolute('--web-only')
  await assert.rejects(checkAbsolute(), /ENOENT.*avalonia/u)
  await writeFile(absoluteSummary, JSON.stringify({
    results: [{ ...row, inputToNextFrameMs: { p95: Number.MAX_SAFE_INTEGER } }],
  }))
  await assert.rejects(checkAbsolute('--web-only'), /input p95 exceeded runaway limit/u)
  await writeFile(absoluteSummary, JSON.stringify({ results: [{ ...row, domNodes: null }] }))
  await assert.rejects(checkAbsolute('--web-only'), /missing or invalid absolute metrics/u)
  await writeFile(absoluteSummary, JSON.stringify({ results: [] }))
  await assert.rejects(checkAbsolute('--web-only'), /missing its scenario matrix/u)

  const webPlan = createImpactPlan({
    changedFiles: cases[0].files,
    registry,
    baseRef: 'fixture-base',
  })
  const summary = {
    results: [
      {
        id: 'markdown-cold-fixture',
        inputToNextFrameMs: { p95: 10 },
      },
    ],
  }
  for (const directory of [baseline, current, baselineRepeat, currentRepeat]) {
    await mkdir(path.join(directory, 'web'), { recursive: true })
    await writeFile(
      path.join(directory, 'impact-plan.json'),
      `${JSON.stringify(webPlan)}\n`,
    )
    await writeFile(
      path.join(directory, 'web/summary.json'),
      `${JSON.stringify(summary)}\n`,
    )
  }
  await execFileAsync(
    process.execPath,
    [
      path.join(root, 'scripts/compare-render-performance.mjs'),
      baseline,
      current,
    ],
    { cwd: root },
  )
  const compare = (limit = '0.15') =>
    execFileAsync(
      process.execPath,
      [
        path.join(root, 'scripts/compare-render-performance.mjs'),
        baseline,
        current,
        limit,
        baselineRepeat,
        currentRepeat,
      ],
      { cwd: root },
    )
  for (const limit of ['', 'NaN', 'Infinity', '-0.01', '1.01']) {
    await assert.rejects(compare(limit), /limit must be a number/u)
  }
  const scenario = summary.results[0]
  for (const [badSummary, reason] of [
    [{ results: [] }, /empty scenario matrix/u],
    [{ results: [scenario, scenario] }, /duplicate scenario/u],
    [
      { results: [{ ...scenario, inputToNextFrameMs: { p95: 0 } }] },
      /p95 must be finite and positive/u,
    ],
    [
      { results: [{ ...scenario, inputToNextFrameMs: { p95: '10' } }] },
      /p95 must be finite and positive/u,
    ],
    [
      { results: [{ ...scenario, inputToNextFrameMs: { p95: null } }] },
      /p95 must be finite and positive/u,
    ],
  ]) {
    await writeFile(
      path.join(baseline, 'web/summary.json'),
      JSON.stringify(badSummary),
    )
    await assert.rejects(compare(), reason)
  }
  await writeFile(
    path.join(baseline, 'web/summary.json'),
    JSON.stringify(summary),
  )
  const unrepresentable = {
    results: [{ ...scenario, inputToNextFrameMs: { p95: Number.MAX_VALUE } }],
  }
  for (const directory of [baseline, baselineRepeat]) {
    await writeFile(
      path.join(directory, 'web/summary.json'),
      JSON.stringify(unrepresentable),
    )
  }
  await assert.rejects(compare(), /aggregate p95 must be finite and positive/u)
  for (const directory of [baseline, baselineRepeat]) {
    await writeFile(
      path.join(directory, 'web/summary.json'),
      JSON.stringify(summary),
    )
  }
  await writeFile(
    path.join(currentRepeat, 'web/summary.json'),
    JSON.stringify({
      results: [scenario, { ...scenario, id: 'unexpected-repeat' }],
    }),
  )
  await assert.rejects(compare(), /extra order-balanced repeat scenario/u)
  await writeFile(
    path.join(currentRepeat, 'web/summary.json'),
    JSON.stringify(summary),
  )
  const slower = {
    results: [
      {
        id: 'markdown-cold-fixture',
        inputToNextFrameMs: { p95: 20 },
      },
    ],
  }
  await writeFile(
    path.join(current, 'web/summary.json'),
    `${JSON.stringify(slower)}\n`,
  )
  await writeFile(
    path.join(baselineRepeat, 'web/summary.json'),
    `${JSON.stringify(slower)}\n`,
  )
  await execFileAsync(
    process.execPath,
    [
      path.join(root, 'scripts/compare-render-performance.mjs'),
      baseline,
      current,
      '0.15',
      baselineRepeat,
      currentRepeat,
    ],
    { cwd: root },
  )
  await writeFile(
    path.join(baselineRepeat, 'web/summary.json'),
    `${JSON.stringify(summary)}\n`,
  )
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        path.join(root, 'scripts/compare-render-performance.mjs'),
        baseline,
        current,
        '0.15',
        baselineRepeat,
        currentRepeat,
      ],
      { cwd: root },
    ),
    /order-balanced p95/u,
  )
  await writeFile(
    path.join(current, 'impact-plan.json'),
    `${JSON.stringify(
      createImpactPlan({
        changedFiles: cases[0].files,
        registry,
        baseRef: 'different-fixture-base',
      }),
    )}\n`,
  )
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        path.join(root, 'scripts/compare-render-performance.mjs'),
        baseline,
        current,
      ],
      { cwd: root },
    ),
    /Performance plan digest mismatch/u,
  )
} finally {
  await rm(compareRoot, { recursive: true, force: true })
}

// Execute the real Linux CI baseline commands against a temporary Git checkout.
// A PR merge SHA in the parent environment must not be recorded as the base.
if (process.platform !== 'win32') {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'fsusui-perf-base-sha-'))
  try {
    const bin = path.join(temp, 'bin')
    const checkout = path.join(temp, 'checkout')
    const result = path.join(temp, 'result.json')
    await mkdir(bin)
    await mkdir(checkout)
    const gitEnv = {
      ...process.env,
      GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_SYSTEM: os.devNull,
      GIT_TERMINAL_PROMPT: '0',
    }
    await execFileAsync('git', ['init', '-q', '--template=', checkout], {
      env: gitEnv,
    })
    await execFileAsync(
      'git',
      [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '--allow-empty',
        '-qm',
        'base',
      ],
      { cwd: checkout, env: gitEnv },
    )
    const sha = (
      await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: checkout,
        env: gitEnv,
      })
    ).stdout.trim()
    const pnpm = path.join(bin, 'node')
    await writeFile(
      pnpm,
      '#!/bin/sh\nprintf "%s\\n" "$GITHUB_SHA" "$@" > "$RESULT_FILE"\n',
    )
    await chmod(pnpm, 0o755)
    const workflow = await readFile(
      path.join(root, '.github/workflows/quality.yml'),
      'utf8',
    )
    for (const [name, output] of [
      ['Measure same-runner baseline first', '../performance-baseline'],
      [
        'Repeat baseline quick matrix last for order balance',
        '../performance-baseline-repeat',
      ],
    ]) {
      const start = workflow.indexOf(`      - name: ${name}\n`)
      assert.notEqual(start, -1, name)
      const end = workflow.indexOf('\n      - name:', start + 1)
      assert.notEqual(end, -1, name)
      const block = workflow.slice(start, end)
      assert.match(
        block,
        /EXPECTED_BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/u,
      )
      const marker = '        run: |\n'
      assert.ok(block.includes(marker), name)
      const command = block
        .slice(block.indexOf(marker) + marker.length)
        .split('\n')
        .map((line) => line.replace(/^ {10}/u, ''))
        .join('\n')
      const env = {
        ...gitEnv,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        GITHUB_SHA: 'f'.repeat(40),
        EXPECTED_BASE_SHA: sha,
        RESULT_FILE: result,
      }
      await execFileAsync('bash', ['-e', '-c', command], { cwd: checkout, env })
      assert.deepEqual((await readFile(result, 'utf8')).trim().split('\n'), [
        sha,
        '../current/scripts/run-historical-render-baseline.mjs',
        '--directory',
        '.',
        '--expected-sha',
        sha,
        '--impact-plan',
        '../performance-impact-plan.json',
        '--output',
        output,
      ])
      await rm(result)
      await assert.rejects(
        execFileAsync('bash', ['-e', '-c', command], {
          cwd: checkout,
          env: { ...env, EXPECTED_BASE_SHA: '0'.repeat(40) },
        }),
      )
      await assert.rejects(readFile(result), { code: 'ENOENT' })
    }
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

console.info(
  `PR render impact fixtures passed (${cases.length} classifications + fallback + digest comparison; baseline checkout identity ${process.platform === 'win32' ? 'skipped on Windows' : 'passed'}).`,
)
