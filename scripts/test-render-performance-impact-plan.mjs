import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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
  for (const directory of [baseline, current]) {
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
  const execFileAsync = promisify(execFile)
  await execFileAsync(
    process.execPath,
    [
      path.join(root, 'scripts/compare-render-performance.mjs'),
      baseline,
      current,
    ],
    { cwd: root },
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

console.info(
  `PR render impact fixtures passed (${cases.length} classifications + fallback + digest comparison).`,
)
