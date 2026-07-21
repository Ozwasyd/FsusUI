#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
assert.ok(visualSource.includes("require('./ci-capacity.cjs')"))
assert.ok(parallelismSource.includes("from './ci-capacity.cjs'"))
for (const [label, source] of [
  ['capacity CLI', capacityCliSource],
  ['unit runner', unitRunnerSource],
]) {
  assert.ok(source.includes("from 'fast-glob'"), `${label} must use stable globbing`)
  assert.ok(!source.includes('globSync'), `${label} must not emit Node glob warnings`)
}
assert.ok(verifyRunner.includes('Promise.all(batch.map(runTask))'))
assert.ok(workflow.includes('fromJSON(needs.capacity.outputs.unit-matrix)'))
assert.ok(workflow.includes('FSUS_VITEST_WORKERS: ${{ matrix.workers }}'))
assert.ok(!workflow.includes("shard: ['1/4', '2/4', '3/4', '4/4']"))

console.log('[ci-capacity] fixtures ok')
