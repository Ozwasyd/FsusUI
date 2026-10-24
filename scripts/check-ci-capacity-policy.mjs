#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import glob from 'fast-glob'
import {
  createCapacityPlan,
  createUnitMatrix,
  parseCgroupMemoryBytes,
  parseCgroupV1CpuQuota,
  parseCgroupV2CpuMax,
  probeCapacityHost,
  validateCapacityPlan,
} from './ci-capacity.mjs'
import { createVisualCapacityPlan } from './visual-capacity.mjs'

const fixtureRoot = 'tests/fixtures/ci-capacity'
const load = (name) =>
  JSON.parse(readFileSync(`${fixtureRoot}/${name}.json`, 'utf8'))
const plan = (name) => {
  const fixture = load(name)
  return createCapacityPlan(fixture.snapshot, fixture.env ?? {}, {
    unitTestFileCount: fixture.unitTestFileCount,
  })
}

assert.equal(parseCgroupV2CpuMax('250000 100000'), 2.5)
assert.equal(parseCgroupV2CpuMax('max 100000'), undefined)
assert.equal(parseCgroupV1CpuQuota('200000', '100000'), 2)
assert.equal(parseCgroupV1CpuQuota('-1', '100000'), undefined)
assert.equal(parseCgroupMemoryBytes('8589934592'), 8589934592)
assert.equal(parseCgroupMemoryBytes('max'), undefined)
assert.equal(parseCgroupMemoryBytes('9223372036854771712'), undefined)

const noCgroup = plan('no-cgroup')
const cgroupV1 = plan('cgroup-v1')
const cgroupV2 = plan('cgroup-v2')
const memoryConstrained = plan('memory-constrained')
const cpuConstrained = plan('cpu-constrained')
const twoCpu = plan('two-cpu-8gb')
const fourCpu = plan('four-cpu-16gb')
const highResource = plan('high-resource')
const override = plan('override')

assert.equal(noCgroup.effectiveCpu, 8)
assert.equal(noCgroup.effectiveMemoryMiB, 16384)
assert.equal(cgroupV1.effectiveCpu, 2)
assert.equal(cgroupV1.effectiveMemoryMiB, 8192)
assert.equal(cgroupV2.effectiveCpu, 4)
assert.equal(cgroupV2.effectiveMemoryMiB, 16384)
assert.equal(memoryConstrained.effectiveMemoryMiB, 4096)
assert.equal(cpuConstrained.effectiveCpu, 2)
assert.ok(
  memoryConstrained.budgets.parallelLaneLimit <
    highResource.budgets.parallelLaneLimit,
)
assert.ok(
  cpuConstrained.budgets.parallelLaneLimit <
    highResource.budgets.parallelLaneLimit,
)
assert.ok(fourCpu.unitShards > twoCpu.unitShards)
assert.ok(highResource.unitShards > fourCpu.unitShards)

for (const candidate of [
  noCgroup,
  cgroupV1,
  cgroupV2,
  memoryConstrained,
  cpuConstrained,
  twoCpu,
  fourCpu,
  highResource,
  override,
]) {
  validateCapacityPlan(candidate)
  assert.ok(
    candidate.unitShards * candidate.vitestWorkersPerShard <=
      candidate.budgets.parallelLaneLimit,
  )
  assert.ok(
    candidate.nodeHeapMiB <= candidate.budgets.safeNodeHeapPerProcessMiB,
  )
  assert.ok(
    Object.values(candidate.nodeHeapProfilesMiB).every(
      (heapMiB) => heapMiB <= candidate.budgets.safeNodeHeapPerProcessMiB,
    ),
  )
  assert.ok(candidate.budgets.baseReserveMiB <= candidate.effectiveMemoryMiB)
  assert.ok(candidate.budgets.allocatableMemoryMiB >= 0)
  assert.ok(candidate.reasons.length >= 3)
  const matrix = createUnitMatrix(candidate)
  assert.equal(matrix.length, candidate.unitShards)
  assert.equal(new Set(matrix.map((entry) => entry.shard)).size, matrix.length)
  assert.deepEqual(
    matrix.map((entry) => entry.shard),
    Array.from(
      { length: candidate.unitShards },
      (_, index) => `${index + 1}/${candidate.unitShards}`,
    ),
  )
}

assert.equal(override.effectiveCpu, 4)
assert.equal(override.effectiveMemoryMiB, 8192)
assert.equal(override.budgets.parallelLaneLimit, 2)
assert.ok(override.unitShards <= 2)
assert.ok(override.vitestWorkersPerShard <= 1)
assert.equal(override.nodeHeapMiB, override.budgets.safeNodeHeapPerProcessMiB)
assert.deepEqual(override.overrideStatus.cpu, {
  active: true,
  requested: 4,
  applied: 4,
})
assert.equal(override.overrideStatus.nodeHeap.active, true)
assert.equal(
  override.overrideStatus.nodeHeap.appliedMiB,
  override.budgets.safeNodeHeapPerProcessMiB,
)
assert.ok(
  override.reasons.some((reason) =>
    reason.includes('manual Node heap override'),
  ),
)
assert.deepEqual(highResource.typecheckBatches.flat(), [
  'web',
  'node',
  'vite-config',
  'vitest',
])
assert.deepEqual(twoCpu.typecheckBatches, [
  ['web'],
  ['node'],
  ['vite-config'],
  ['vitest'],
])
for (const candidate of [twoCpu, fourCpu, highResource]) {
  for (const batch of candidate.suiteBatches) {
    const heavy = batch.filter((task) =>
      ['unit', 'build', 'coverage', 'visual'].includes(task),
    )
    assert.ok(heavy.length <= 1)
    const batchLanes = batch.reduce(
      (total, task) =>
        total + (task === 'typecheck' ? candidate.lanes.typecheck : 1),
      0,
    )
    assert.ok(batchLanes <= candidate.budgets.parallelLaneLimit)
  }
}

const files = new Map([
  ['/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_quota_us', '300000'],
  ['/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_period_us', '100000'],
  ['/sys/fs/cgroup/memory/memory.limit_in_bytes', '8589934592'],
])
const probed = probeCapacityHost({
  readFile: (path) => {
    if (!files.has(path)) throw new Error('missing')
    return files.get(path)
  },
  availableParallelism: () => 12,
  cpuCount: () => 16,
  totalMemoryBytes: () => 32 * 1024 ** 3,
})
assert.equal(probed.cgroupV1CpuQuota, '300000')
assert.equal(probed.cgroupV1CpuPeriod, '100000')
assert.equal(probed.cgroupV1MemoryLimit, '8589934592')

const visual = createVisualCapacityPlan(load('cgroup-v2').snapshot)
assert.equal(visual.effectiveCpu, cgroupV2.effectiveCpu)
assert.equal(visual.effectiveMemoryMiB, cgroupV2.effectiveMemoryMiB)

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const workflow = readFileSync('.github/workflows/_quality.yml', 'utf8')
const heapSource = readFileSync('scripts/with-node-heap.mjs', 'utf8')
const visualSource = readFileSync('scripts/visual-capacity.cjs', 'utf8')
const parallelismSource = readFileSync('scripts/test-parallelism.ts', 'utf8')
const capacityCliSource = readFileSync('scripts/ci-capacity.mjs', 'utf8')
const unitRunnerSource = readFileSync('scripts/run-capacity-unit.mjs', 'utf8')
const verifyRunner = readFileSync('scripts/run-capacity-suite.mjs', 'utf8')
const consumerInstallSource = readFileSync(
  'scripts/test-consumer-install.mjs',
  'utf8',
)
assert.ok(packageJson.scripts['ci:capacity:plan']?.includes('--dry-run'))
assert.ok(
  packageJson.scripts['ci:capacity:check']?.includes('check-ci-capacity'),
)
assert.ok(packageJson.scripts.typecheck?.includes('run-capacity-typecheck'))
assert.ok(
  packageJson.scripts['_test:unit:parallel']?.includes('run-capacity-unit'),
)
assert.ok(!heapSource.includes('18_432'))
assert.ok(heapSource.includes('resolveNodeHeapMiB'))
assert.ok(
  heapSource.includes('unitTestFileCount: countUnitTestFiles()'),
  'heap wrapper must seed the shared plan with the authoritative unit workload',
)
assert.ok(visualSource.includes("require('./ci-capacity.cjs')"))
assert.ok(parallelismSource.includes("from './ci-capacity.cjs'"))
assert.ok(capacityCliSource.includes("from 'fast-glob'"))
assert.ok(!capacityCliSource.includes('globSync'))
assert.ok(
  unitRunnerSource.includes(
    'resolveCapacityPlan({\n  unitTestFileCount: countUnitTestFiles(),',
  ),
  'unit runner must consume the shared authoritative capacity plan',
)
assert.ok(!unitRunnerSource.includes("from 'fast-glob'"))
assert.ok(!unitRunnerSource.includes('createCapacityPlan'))
assert.ok(!unitRunnerSource.includes('probeCapacityHost'))
assert.ok(
  capacityCliSource.includes('cwd: repoRoot'),
  'unit discovery must be independent of the caller working directory',
)
assert.ok(verifyRunner.includes('Promise.all(batch.map(runTask))'))
assert.ok(
  verifyRunner.includes(
    'resolveCapacityPlan({ unitTestFileCount: countUnitTestFiles() })',
  ),
  'suite scheduler must plan from the authoritative unit workload',
)
assert.ok(workflow.includes('fromJSON(needs.capacity.outputs.unit-matrix)'))
assert.ok(workflow.includes('FSUS_VITEST_WORKERS: ${{ matrix.workers }}'))
assert.ok(!workflow.includes("shard: ['1/4', '2/4', '3/4', '4/4']"))
const consumerTypecheckCall = consumerInstallSource.match(
  /stage\('typecheck', \(\) => \{\s*run\(\s*'node',\s*\[\s*path\.join\(repoRoot, 'scripts', 'with-node-heap\.mjs'\),\s*packageManager,\s*\.\.\.execArgs\('vue-tsc', \['--noEmit'\]\),\s*\],\s*\{\s*cwd: fixtureRoot,\s*env: \{\s*FSUS_NODE_HEAP_PROFILE: 'typecheck',\s*NODE_OPTIONS: '',\s*\},\s*\},\s*\)\s*\}\)/u,
)
assert.ok(
  consumerTypecheckCall,
  'consumer typecheck must use the governed package manager and shared typecheck heap profile without inheriting small-task NODE_OPTIONS',
)
const consumerViteBuildCall = consumerInstallSource.match(
  /const viteOutput = stage\('build', \(\) =>\s*runAndCollect\(\s*'node',\s*\[\s*path\.join\(repoRoot, 'scripts', 'with-node-heap\.mjs'\),\s*packageManager,\s*\.\.\.execArgs\('vite', \['build'\]\),\s*\],\s*\{\s*cwd: fixtureRoot,\s*env: \{\s*FSUS_NODE_HEAP_PROFILE: 'build',\s*NODE_OPTIONS: '',\s*\},\s*\},\s*\),\s*\)/u,
)
assert.ok(
  consumerViteBuildCall,
  'consumer Vite build must use the governed package manager and shared build heap profile without inheriting small-task NODE_OPTIONS',
)

// Exercise the actual internal scheduler without replacing or invoking Rollup.
const require = createRequire(import.meta.url)
require('tsx/cjs')
const {
  runFullBuildTasks,
} = require('../vue/internal/build/src/utils/full-build-tasks.ts')
const fullBundleSource = readFileSync(
  'vue/internal/build/src/tasks/full-bundle.ts',
  'utf8',
)
assert.match(
  fullBundleSource,
  /export const buildFullUnminified: TaskFunction = buildFull\(false\)/u,
  'the unminified child must retain the original complete variant',
)
assert.match(
  fullBundleSource,
  /export const buildFullMinified: TaskFunction = buildFull\(true\)/u,
  'the minified child must retain the original complete variant',
)
assert.match(
  fullBundleSource,
  /export const buildFullBundle: TaskFunction = series\(\s*withTaskName\('buildFull', \(\) =>\s*run\('pnpm run -C vue\/internal\/build start buildFullUnminified'\),?\s*\),\s*withTaskName\('buildFullMinified', \(\) =>\s*run\('pnpm run -C vue\/internal\/build start buildFullMinified'\),?\s*\),?\s*\)/u,
  'complete variants must run sequentially in separate original-entry children',
)
assert.match(
  fullBundleSource,
  /await runFullBuildTasks\(\s*\(\) => buildFullEntry\(minify\),\s*files,\s*\(file\) => buildFullLocale\(file, minify\),?\s*\)/u,
  'full builds must await the scheduler with the entry, all discovered locales, and the same minify mode',
)
const localeFiles = glob.sync('**/*.ts', {
  cwd: 'vue/packages/locale/lang',
  absolute: true,
})
assert.ok(localeFiles.length >= 3, 'exercise the complete source locale set')
const deferred = () => {
  let release
  const promise = new Promise((resolve) => {
    release = resolve
  })
  return { promise, release }
}
for (const minify of [false, true]) {
  const calls = []
  let active = 0
  let maxActive = 0
  let settled = false
  const entryGate = deferred()
  const localeGate = deferred()
  const firstLocaleStarted = deferred()
  const run = async (file, gate) => {
    calls.push({ file, minify })
    active += 1
    maxActive = Math.max(maxActive, active)
    if (gate) await gate.promise
    await Promise.resolve()
    active -= 1
  }
  const work = runFullBuildTasks(
    () => run('entry', entryGate),
    localeFiles,
    async (file) => {
      if (file === localeFiles[0]) firstLocaleStarted.release()
      await run(file, file === localeFiles[0] ? localeGate : undefined)
    },
  ).then(() => {
    settled = true
  })
  assert.deepEqual(calls, [{ file: 'entry', minify }])
  assert.equal(settled, false)
  entryGate.release()
  await Promise.race([
    firstLocaleStarted.promise,
    work.then(() => {
      throw new Error('scheduler finished without starting the first locale')
    }),
  ])
  assert.deepEqual(calls, [
    { file: 'entry', minify },
    { file: localeFiles[0], minify },
  ])
  assert.equal(active, 1)
  assert.equal(settled, false)
  localeGate.release()
  await work
  assert.deepEqual(calls, [
    { file: 'entry', minify },
    ...localeFiles.map((file) => ({ file, minify })),
  ])
  assert.equal(active, 0)
  assert.equal(maxActive, 1)
  assert.equal(settled, true)
}
const entryError = new Error('entry failure')
const localesAfterEntryError = []
await assert.rejects(
  runFullBuildTasks(
    async () => {
      throw entryError
    },
    localeFiles,
    async (file) => {
      localesAfterEntryError.push(file)
    },
  ),
  (error) => error === entryError,
)
assert.deepEqual(localesAfterEntryError, [])
const localeError = new Error('locale failure')
const localesBeforeError = []
await assert.rejects(
  runFullBuildTasks(
    async () => {},
    localeFiles,
    async (file) => {
      localesBeforeError.push(file)
      if (file === localeFiles[1]) throw localeError
    },
  ),
  (error) => error === localeError,
)
assert.deepEqual(localesBeforeError, localeFiles.slice(0, 2))
let emptySetEntries = 0
await runFullBuildTasks(
  async () => {
    emptySetEntries += 1
  },
  [],
  async () => {
    assert.fail('an empty locale set must not schedule a locale')
  },
)
assert.equal(emptySetEntries, 1)
console.log(
  `[ci-capacity] full-build scheduler: ${localeFiles.length} locales, both variants, serial/await/error controls ok`,
)

const {
  writeBundles,
} = require('../vue/internal/build/src/utils/output-writes.ts')
for (const outputOptions of [
  [
    { format: 'esm', sourcemap: true },
    { format: 'cjs', sourcemap: true },
  ],
  [
    { format: 'umd', sourcemap: false },
    { format: 'esm', sourcemap: false },
  ],
]) {
  const options = outputOptions.map((option) => Object.freeze(option))
  const results = options.map(() => ({ output: [] }))
  const calls = []
  let active = 0
  let maxActive = 0
  let settled = false
  const firstGate = deferred()
  const secondGate = deferred()
  const secondStarted = deferred()
  const work = writeBundles(
    {
      write: async (option) => {
        calls.push(option)
        active += 1
        maxActive = Math.max(maxActive, active)
        if (option === options[0]) await firstGate.promise
        else {
          secondStarted.release()
          await secondGate.promise
        }
        active -= 1
        return results[options.indexOf(option)]
      },
    },
    options,
  ).then((outputs) => {
    settled = true
    return outputs
  })
  console.log(
    `[ci-capacity] writer initial dispatch=${calls.map((option) => option.format).join(',')} active=${active} max=${maxActive}`,
  )
  assert.equal(maxActive, 1, 'output writers must not overlap')
  assert.deepEqual(calls, [options[0]])
  assert.equal(settled, false)
  firstGate.release()
  await Promise.race([
    secondStarted.promise,
    work.then(() => {
      throw new Error('writer finished without starting its second output')
    }),
  ])
  assert.equal(active, 1)
  assert.equal(maxActive, 1)
  assert.equal(settled, false)
  assert.equal(calls.length, 2)
  assert.equal(calls[0], options[0])
  assert.equal(calls[1], options[1])
  secondGate.release()
  const outputs = await work
  assert.equal(settled, true)
  assert.equal(active, 0)
  assert.equal(maxActive, 1)
  assert.equal(outputs.length, results.length)
  for (const [index, result] of results.entries()) {
    assert.equal(
      outputs[index],
      result,
      'preserve each original output identity',
    )
  }
}
const writerOptions = [
  { format: 'esm', sourcemap: true },
  { format: 'cjs', sourcemap: true },
]
for (const failingIndex of [0, 1]) {
  const error = new Error(`output writer ${failingIndex} failure`)
  const calls = []
  await assert.rejects(
    writeBundles(
      {
        write: async (option) => {
          calls.push(option)
          if (option === writerOptions[failingIndex]) throw error
          return { output: [] }
        },
      },
      writerOptions,
    ),
    (actualError) => actualError === error,
  )
  assert.deepEqual(calls, writerOptions.slice(0, failingIndex + 1))
}
const emptyOutputs = await writeBundles(
  {
    write: async () => {
      assert.fail('an empty output list must not invoke a writer')
    },
  },
  [],
)
assert.deepEqual(emptyOutputs, [])
console.log(
  '[ci-capacity] output writer order/identity/await/error controls ok',
)

console.log('[ci-capacity] fixtures ok')
