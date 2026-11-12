import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
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
import {
  measurementEnvironment,
  resolveRevision,
} from './render-performance-revision.mjs'

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

const compareRoot = await mkdtemp(path.join(os.tmpdir(), 'fsusui-impact-test-'))
try {
  const baseline = path.join(compareRoot, 'baseline')
  const current = path.join(compareRoot, 'current')
  const baselineRepeat = path.join(compareRoot, 'baseline-repeat')
  const currentRepeat = path.join(compareRoot, 'current-repeat')
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
    const inherited = { ...gitEnv, GITHUB_SHA: 'f'.repeat(40) }
    assert.equal(await resolveRevision(checkout), sha)
    assert.equal(
      (await measurementEnvironment(checkout, sha, inherited)).GITHUB_SHA,
      sha,
    )
    assert.equal(inherited.GITHUB_SHA, 'f'.repeat(40))
    await assert.rejects(
      measurementEnvironment(checkout, '0'.repeat(40), inherited),
      /Performance checkout mismatch/u,
    )
    const pnpm = path.join(bin, 'pnpm')
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
        'perf:render',
        '--',
        '--impact-plan',
        '../performance-impact-plan.json',
        '--profile',
        'quick',
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
