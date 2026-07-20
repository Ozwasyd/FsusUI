import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { URL } from 'node:url'

import {
  createAffectedSelection,
  createSmokeSelection,
  createVisualCaptureTestTitle,
  loadVisualProfileRegistry,
  resolveAffectedFiles,
  selectAffectedVisualTargets,
  validateVisualProfileRegistry,
} from '../scripts/visual-profiles.mjs'
import {
  createVisualPlan,
  parseVisualArgs,
  resolveProfileCapacityPlan,
  runVisualPlanAsync,
  validateVisualPlan,
} from '../scripts/run-visual-tests.mjs'
import { createVisualCapacityPlan } from '../scripts/visual-capacity.mjs'
import { writeVisualEvidenceManifest } from '../scripts/visual-evidence-policy.mjs'

const repositoryRoot = new URL('..', import.meta.url).pathname
const registry = loadVisualProfileRegistry(repositoryRoot)
const cases = JSON.parse(
  await readFile(
    new URL('./fixtures/visual-profiles/affected-cases.json', import.meta.url),
    'utf8',
  ),
)
const capacityPlan = createVisualCapacityPlan({
  availableParallelism: 8,
  cpuCount: 8,
  totalMemoryBytes: 16 * 1024 * 1024 * 1024,
})

test('registry assigns every component package exactly one visual owner', () => {
  assert.doesNotThrow(() =>
    validateVisualProfileRegistry(registry, repositoryRoot),
  )
})

test('registry rejects a smoke grep that selects no canonical capture test', () => {
  assert.equal(createVisualCaptureTestTitle('basic'), 'capture basic')
  assert.throws(
    () =>
      validateVisualProfileRegistry(
        {
          ...registry,
          smoke: {
            ...registry.smoke,
            grep: 'capture basic in (light|dark) mode',
          },
        },
        repositoryRoot,
      ),
    /smoke grep does not select "capture basic"/u,
  )
})

test('registry rejects new public packages until an owner is registered', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'fsusui-visual-registry-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, 'vue/packages/components/button'), { recursive: true })
  await mkdir(join(root, 'vue/packages/components/unowned-public-widget'), {
    recursive: true,
  })
  const fixture = {
    ...registry,
    auditComponentOverrides: {},
    componentGroups: [{ section: 'basic', packages: ['button'] }],
    nonAuditPackages: [],
  }
  assert.throws(
    () => validateVisualProfileRegistry(fixture, root),
    /without a visual owner: unowned-public-widget/u,
  )
})

for (const fixture of cases) {
  test(fixture.name, () => {
    const selected = selectAffectedVisualTargets(fixture.files, registry)
    assert.deepEqual(selected.auditComponents, fixture.expected.auditComponents)
    assert.deepEqual(selected.sections, fixture.expected.sections)
    assert.equal(selected.fullRequired, fixture.expected.fullRequired)
    assert.ok(selected.specs.length > 0)
  })
}

test('affected explicit files are browser-free and need no Git or network', () => {
  const selection = createAffectedSelection({
    cwd: repositoryRoot,
    env: {
      FSUS_VISUAL_AFFECTED_FILES:
        'vue/packages/components/button/src/button.vue',
    },
    git: () => {
      throw new Error('explicit files must not invoke Git')
    },
    registry,
  })
  assert.equal(selection.profile, 'affected')
  assert.deepEqual(selection.auditComponents, ['ElButton'])
  assert.match(selection.grep, /capture \(basic\)\$/u)
  assert.match(selection.grep, /ui audit/u)
})

test('missing base, shallow checkout, and non-Git workspace fall back to smoke', () => {
  const responses = new Map([
    ['rev-parse --is-inside-work-tree', { status: 0, stdout: 'true\n' }],
    ['rev-parse --is-shallow-repository', { status: 0, stdout: 'false\n' }],
    ['rev-parse --abbrev-ref @{upstream}', { status: 1, stdout: '' }],
  ])
  const noBase = createAffectedSelection({
    cwd: repositoryRoot,
    env: {},
    git: (args) => responses.get(args.join(' ')) ?? { status: 1, stdout: '' },
    registry,
  })
  assert.equal(noBase.profile, 'smoke')
  assert.equal(noBase.requestedProfile, 'affected')
  assert.match(noBase.fallbackReason, /no local comparison base/u)

  const shallow = resolveAffectedFiles({
    git: (args) => ({
      status: 0,
      stdout:
        args.join(' ') === 'rev-parse --is-shallow-repository'
          ? 'true\n'
          : 'true\n',
    }),
  })
  assert.match(shallow.fallbackReason, /shallow/u)

  const notGit = resolveAffectedFiles({
    git: () => ({ status: 1, stdout: '' }),
  })
  assert.match(notGit.fallbackReason, /not a Git worktree/u)
})

test('explicit local base selects committed, staged, working, and untracked changes', () => {
  const responses = new Map([
    ['rev-parse --is-inside-work-tree', 'true\n'],
    ['rev-parse --is-shallow-repository', 'false\n'],
    ['rev-parse --verify base^{commit}', 'abc123\n'],
    ['merge-base HEAD base', 'merge123\n'],
    [
      'diff --name-only merge123...HEAD',
      'vue/packages/components/button/index.ts\n',
    ],
    ['diff --name-only HEAD', 'vue/packages/theme-chalk/src/input.scss\n'],
    [
      'diff --cached --name-only',
      'vue/packages/demo-app/src/sections/FormSection.vue\n',
    ],
    ['ls-files --others --exclude-standard', 'docs/local.md\n'],
  ])
  const result = resolveAffectedFiles({
    base: 'base',
    git: (args) => {
      const output = responses.get(args.join(' '))
      return output === undefined
        ? { status: 1, stdout: '' }
        : { status: 0, stdout: output }
    },
  })
  assert.equal(result.base, 'base')
  assert.deepEqual(result.files, [
    'docs/local.md',
    'vue/packages/components/button/index.ts',
    'vue/packages/demo-app/src/sections/FormSection.vue',
    'vue/packages/theme-chalk/src/input.scss',
  ])
})

test('smoke is representative and capped to one shared-plan worker', () => {
  const selection = createSmokeSelection(registry)
  const smokeCapacityPlan = resolveProfileCapacityPlan('smoke', capacityPlan)
  const plan = createVisualPlan(
    parseVisualArgs(['--profile=smoke', '--dry-run']),
    smokeCapacityPlan,
    selection,
  )
  validateVisualPlan(plan, smokeCapacityPlan)
  assert.equal(plan.length, 1)
  assert.deepEqual(plan[0].selectedProjects, ['desktop-light', 'mobile-dark'])
  assert.equal(plan[0].workers, 1)
  assert.ok(plan[0].argv.includes('vue/tests/visual/capture-all.spec.ts'))
  assert.match(plan[0].argv.join(' '), /capture basic\$/u)
})

test('smoke passes its one-worker capacity plan to Playwright', async () => {
  const selection = createSmokeSelection(registry)
  const smokeCapacityPlan = resolveProfileCapacityPlan('smoke', capacityPlan)
  const plan = createVisualPlan(
    parseVisualArgs(['--profile=smoke']),
    smokeCapacityPlan,
    selection,
  )
  let serializedPlan
  const status = await runVisualPlanAsync(plan, {
    capacityPlan: smokeCapacityPlan,
    spawn: (_command, _args, options) => {
      serializedPlan = JSON.parse(options.env.FSUS_VISUAL_CAPACITY_PLAN)
      const child = new EventEmitter()
      globalThis.queueMicrotask(() => child.emit('close', 0))
      return child
    },
  })
  assert.equal(status, 0)
  assert.equal(serializedPlan.previewWorkers, 1)
})

test('full and evidence select identical coverage with one Dev suite', () => {
  const full = createVisualPlan(
    parseVisualArgs(['--profile=full']),
    capacityPlan,
  )
  const evidence = createVisualPlan(
    parseVisualArgs(['--profile=evidence']),
    capacityPlan,
  )
  assert.deepEqual(
    full.map(({ suite, selectedProjects, argv }) => ({
      suite,
      selectedProjects,
      argv,
    })),
    evidence.map(({ suite, selectedProjects, argv }) => ({
      suite,
      selectedProjects,
      argv,
    })),
  )
  assert.deepEqual(full[0].selectedProjects, [
    'desktop-light',
    'mobile-light',
    'desktop-dark',
    'mobile-dark',
  ])
  assert.equal(full.filter((entry) => entry.suite === 'dev').length, 1)
  assert.ok(
    evidence
      .flatMap((entry) => entry.projectResultNamespaces)
      .every(
        (path) =>
          path.includes('/suite-') &&
          path.includes('/project-') &&
          path.includes('/shard-'),
      ),
  )
})

test('evidence writes a manifest without changing the full-equivalent plan', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'fsusui-visual-evidence-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const plan = createVisualPlan(
    parseVisualArgs(['--profile=evidence', '--shard=1/3']),
    capacityPlan,
  )
  const path = await writeVisualEvidenceManifest(
    plan,
    capacityPlan,
    0,
    {
      FSUS_VISUAL_EVIDENCE: '1',
      FSUS_VISUAL_PROFILE: 'evidence',
      FSUS_VISUAL_SHARD: '1/3',
    },
    root,
  )
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  assert.equal(manifest.profile, 'evidence')
  assert.equal(manifest.shard, '1/3')
  assert.equal(manifest.suites.length, 2)
  assert.equal(
    manifest.suites.filter((suite) => suite.suite === 'dev').length,
    1,
  )
})

test('distributed full shards run Preview everywhere and Dev exactly on shard one', () => {
  const plans = [1, 2, 3].map((index) =>
    createVisualPlan(
      parseVisualArgs(['--profile=full', `--shard=${index}/3`]),
      capacityPlan,
    ),
  )
  assert.ok(
    plans.every((plan) => plan.some((entry) => entry.suite === 'preview')),
  )
  assert.equal(plans.flat().filter((entry) => entry.suite === 'dev').length, 1)
})
