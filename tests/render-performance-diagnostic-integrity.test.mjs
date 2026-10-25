import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { Script } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createImpactPlan } from '../scripts/render-performance-impact.mjs'
import {
  readOriginalQuickScenarios,
  verifyDiagnosticMeasurements,
} from '../scripts/render-performance-diagnostic-integrity.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workflow = await readFile(
  path.join(root, '.github/workflows/quality.yml'),
  'utf8',
)
const baseSha = 'a'.repeat(40)
const currentSha = 'b'.repeat(40)
const json = (file, value) => writeFile(file, JSON.stringify(value))

const fullPlan = createImpactPlan({
  changedFiles: ['unknown.ts'],
  registry: { schemaVersion: 1, rules: [] },
  baseRef: baseSha,
})
const originalScenarios = await readOriginalQuickScenarios(fullPlan)
const webRawRelative = `web/${originalScenarios.web[0].id}.raw.json`
const nativeRawRelative = `avalonia/raw/${originalScenarios.avalonia[0]}.raw.json`

const fixture = async (t) => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'fsus-perf-integrity-'),
  )
  t.after(() => rm(directory, { recursive: true, force: true }))
  const plan = createImpactPlan({
    changedFiles: ['unknown.ts'],
    registry: { schemaVersion: 1, rules: [] },
    baseRef: baseSha,
  })
  const directories = [
    'baseline',
    'current',
    'current-repeat',
    'baseline-repeat',
  ].map((name) => path.join(directory, name))
  const identities = [baseSha, currentSha, currentSha, baseSha]
  for (const [index, measurement] of directories.entries()) {
    await mkdir(path.join(measurement, 'web'), { recursive: true })
    await mkdir(path.join(measurement, 'avalonia/raw'), { recursive: true })
    await json(path.join(measurement, 'impact-plan.json'), plan)
    const value = index === 0 || index === 3 ? 4402 : 64
    const webMetric = { p95: value, samples: 21 }
    const nativeMetric = { P95: value, Samples: 21 }
    await json(path.join(measurement, 'web/summary.json'), {
      gitSha: identities[index],
      profile: 'quick',
      runner: {
        warmups: 1,
        samples: 21,
        matrixSize: originalScenarios.web.length,
      },
      results: originalScenarios.web.map((scenario) => ({
        ...scenario,
        inputToNextFrameMs: webMetric,
        frameWorkMs: webMetric,
      })),
    })
    for (const scenario of originalScenarios.web)
      await json(path.join(measurement, `web/${scenario.id}.raw.json`), {
        ...scenario,
        inputToFrame: Array(21).fill(value),
        frameWork: Array(21).fill(value),
      })
    await json(path.join(measurement, 'avalonia/summary.json'), {
      GitSha: identities[index],
      Profile: 'quick',
      Runner: {
        Warmups: 1,
        Samples: 21,
        ScenarioCount: originalScenarios.avalonia.length,
      },
      Results: originalScenarios.avalonia.map((Id) => ({
        Id,
        FrameMs: nativeMetric,
        MeasureArrangeMs: nativeMetric,
        DrawMs: nativeMetric,
        AllocatedBytes: nativeMetric,
      })),
    })
    for (const Id of originalScenarios.avalonia)
      await json(path.join(measurement, `avalonia/raw/${Id}.raw.json`), {
        Id,
        FrameMs: Array(21).fill(value),
        MeasureArrangeMs: Array(21).fill(value),
        DrawMs: Array(21).fill(value),
        AllocatedBytes: Array(21).fill(value),
      })
  }
  const mutate = async (relative, change, index = 0) => {
    const file = path.join(directories[index], relative)
    const value = JSON.parse(await readFile(file, 'utf8'))
    change(value)
    await json(file, value)
  }
  return { directory, plan, baseSha, currentSha, directories, mutate }
}

test('complete twenty-one-sample fixture data remains diagnostic when base timing is above its guard', async (t) => {
  const f = await fixture(t)
  const result = await verifyDiagnosticMeasurements(f)
  assert.equal(result.measurementCount, 4)
  assert.deepEqual(result.scenarios, originalScenarios)
  assert.equal(Object.hasOwn(result, 'passed'), false)
})

test('rejects a foreign declared base and an incomplete ABBA directory set', async (t) => {
  const f = await fixture(t)
  await assert.rejects(
    verifyDiagnosticMeasurements({ ...f, baseSha: 'c'.repeat(40) }),
  )
  await assert.rejects(
    verifyDiagnosticMeasurements({
      ...f,
      directories: f.directories.slice(0, 3),
    }),
  )
})

test('rejects a common dropped case even when all four summaries and raw sets agree', async (t) => {
  const f = await fixture(t)
  for (const [index, directory] of f.directories.entries()) {
    await f.mutate(
      'web/summary.json',
      (summary) => {
        summary.results.shift()
        summary.runner.matrixSize = summary.results.length
      },
      index,
    )
    await rm(path.join(directory, webRawRelative))
  }
  await assert.rejects(verifyDiagnosticMeasurements(f), /original producer/u)
})

test('rejects all four directories measuring the wrong family under a genuine selected ownership plan', async (t) => {
  const f = await fixture(t)
  const registry = JSON.parse(
    await readFile(
      path.join(root, 'spec/ci/pr-render-performance-ownership.json'),
      'utf8',
    ),
  )
  const plan = createImpactPlan({
    changedFiles: ['vue/packages/components/select-v2/src/select.vue'],
    registry,
    baseRef: baseSha,
  })
  assert.equal(plan.platforms.web.scenario, 'select-v2')
  for (const directory of f.directories)
    await json(path.join(directory, 'impact-plan.json'), plan)
  await assert.rejects(
    verifyDiagnosticMeasurements({ ...f, plan }),
    /original producer/u,
  )
})

test('derives original complete matrices and their original prefix/ordinal-ignore-case selectors', async () => {
  assert.equal(originalScenarios.web.length, 13)
  assert.equal(originalScenarios.avalonia.length, 7)
  const selected = await readOriginalQuickScenarios({
    platforms: {
      web: { run: true, scenario: 'markdown-' },
      avalonia: { run: true, scenario: 'INPUT-' },
    },
  })
  assert.ok(selected.web.length > 0)
  assert.ok(
    selected.web.every(
      (entry) =>
        entry.scenario.startsWith('markdown-') &&
        entry.refreshHz === 60 &&
        entry.dpr === 1 &&
        entry.motion === 'enabled',
    ),
  )
  assert.deepEqual(selected.avalonia, ['input-continuous'])
})

for (const [name, relative, change] of [
  [
    'wrong source',
    'web/summary.json',
    (d) => {
      d.gitSha = currentSha
    },
  ],
  [
    'changed warmups',
    'avalonia/summary.json',
    (d) => {
      d.Runner.Warmups = 0
    },
  ],
  [
    'changed samples',
    'web/summary.json',
    (d) => {
      d.runner.samples = 20
    },
  ],
  [
    'missing scenario',
    'web/summary.json',
    (d) => {
      d.results = []
    },
  ],
  [
    'duplicate scenario',
    'web/summary.json',
    (d) => {
      d.results.push(d.results[0])
      d.runner.matrixSize = d.results.length
    },
  ],
  [
    'partial raw',
    webRawRelative,
    (d) => {
      d.inputToFrame.pop()
    },
  ],
  [
    'nonfinite raw',
    nativeRawRelative,
    (d) => {
      d.FrameMs[0] = null
    },
  ],
  [
    'invalid plan digest',
    'impact-plan.json',
    (d) => {
      d.scope = 'skip'
    },
  ],
  [
    'raw identity mismatch',
    webRawRelative,
    (d) => {
      d.id = 'foreign-case'
    },
  ],
]) {
  test(`rejects ${name}`, async (t) => {
    const f = await fixture(t)
    await f.mutate(relative, change)
    await assert.rejects(verifyDiagnosticMeasurements(f))
  })
}

test('rejects missing raw files, extra raw files, and symlinked external artifacts', async (t) => {
  const missing = await fixture(t)
  await rm(path.join(missing.directories[0], webRawRelative))
  await assert.rejects(verifyDiagnosticMeasurements(missing))
  const extra = await fixture(t)
  await json(path.join(extra.directories[0], 'web/extra.raw.json'), {})
  await assert.rejects(verifyDiagnosticMeasurements(extra))
  const outside = await fixture(t)
  const raw = path.join(outside.directories[0], webRawRelative)
  const foreign = path.join(outside.directory, 'foreign.json')
  await writeFile(foreign, await readFile(raw))
  await rm(raw)
  await symlink(foreign, raw)
  await assert.rejects(verifyDiagnosticMeasurements(outside))
})

const step = (name) => {
  const start = workflow.indexOf(`      - name: ${name}\n`)
  assert.notEqual(start, -1, name)
  const next = workflow.indexOf('\n      - ', start + 1)
  return workflow.slice(start, next < 0 ? undefined : next)
}
const evaluateCondition = (
  name,
  {
    available = 'true',
    first = 'success',
    current = 'success',
    repeat = 'success',
    baselineRepeat = 'success',
    integrity = 'success',
    run = 'true',
    cancelled = false,
    success = false,
  } = {},
) => {
  const expression = step(name)
    .match(/ {8}if: >-\n([\s\S]*?)(?=\n {8}\S)/u)?.[1]
    .trim()
    .replaceAll('\n', ' ')
    .replace(/steps\.([\w-]+)/gu, 'steps["$1"]')
  assert.ok(expression, name)
  return new Script(expression).runInNewContext({
    steps: {
      'render-impact': { outputs: { run } },
      'baseline-contract': { outputs: { available } },
      'baseline-first': { outcome: first },
      'current-first': { outcome: current },
      'current-repeat': { outcome: repeat },
      'baseline-repeat': { outcome: baselineRepeat },
      'paired-integrity': { outcome: integrity },
    },
    cancelled: () => cancelled,
    success: () => success,
  })
}

test('actual workflow continues diagnostics only after an attempted measurement and preserves scope/cancellation', () => {
  const current = 'Measure current quick matrix'
  assert.equal(evaluateCondition(current, { first: 'failure' }), true)
  assert.equal(evaluateCondition(current, { first: 'skipped' }), false)
  assert.equal(evaluateCondition(current, { run: 'false' }), false)
  assert.equal(evaluateCondition(current, { cancelled: true }), false)
  assert.equal(
    evaluateCondition(current, { available: 'false', success: true }),
    true,
  )
  assert.equal(
    evaluateCondition(current, { available: 'false', success: false }),
    false,
  )
  for (const [name, field] of [
    ['Repeat current quick matrix for order balance', 'current'],
    ['Repeat baseline quick matrix last for order balance', 'repeat'],
    [
      'Verify complete source-bound ABBA diagnostic artifacts',
      'baselineRepeat',
    ],
  ]) {
    assert.equal(evaluateCondition(name, { [field]: 'failure' }), true)
    assert.equal(evaluateCondition(name, { [field]: 'skipped' }), false)
    assert.equal(evaluateCondition(name, { available: 'false' }), false)
    assert.equal(evaluateCondition(name, { cancelled: true }), false)
  }
  assert.equal(
    evaluateCondition('Compare against base revision on the same runner', {
      integrity: 'failure',
    }),
    false,
  )
})

test('actual final Bash gate rejects every failed/missing original stage even after a successful comparison', () => {
  const command = step(
    'Require every original measurement and comparison to pass',
  )
    .split('        run: |\n')[1]
    .split('\n')
    .map((line) => line.replace(/^ {10}/u, ''))
    .join('\n')
  const env = {
    FSUS_BASE_AVAILABLE: 'true',
    FSUS_BASE_FIRST: 'success',
    FSUS_CURRENT_FIRST: 'success',
    FSUS_CURRENT_REPEAT: 'success',
    FSUS_BASE_REPEAT: 'success',
    FSUS_INTEGRITY: 'success',
    FSUS_COMPARISON: 'success',
  }
  const run = (values) =>
    spawnSync('/bin/bash', ['-e', '-c', command], {
      env: { ...process.env, ...values },
    }).status
  assert.equal(run(env), 0)
  for (const available of ['', 'unknown'])
    assert.notEqual(run({ ...env, FSUS_BASE_AVAILABLE: available }), 0)
  for (const field of Object.keys(env).filter(
    (key) => key !== 'FSUS_BASE_AVAILABLE',
  ))
    for (const failure of ['failure', 'skipped', ''])
      assert.notEqual(
        run({ ...env, [field]: failure }),
        0,
        `${field}:${failure}`,
      )
  assert.equal(
    run({
      ...env,
      FSUS_BASE_AVAILABLE: 'false',
      FSUS_BASE_FIRST: 'skipped',
      FSUS_CURRENT_REPEAT: 'skipped',
      FSUS_BASE_REPEAT: 'skipped',
      FSUS_INTEGRITY: 'skipped',
      FSUS_COMPARISON: 'skipped',
    }),
    0,
  )
  assert.doesNotMatch(
    step('Measure same-runner baseline first'),
    /continue-on-error/u,
  )
})
