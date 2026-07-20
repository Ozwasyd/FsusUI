import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  createVisualCapacityPlan,
  parseCgroupMemoryBytes,
  parseCgroupV1CpuQuota,
  parseCgroupV2CpuMax,
  probeVisualCapacityHost,
} from '../scripts/visual-capacity.mjs'

const fixture = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/visual-capacity/${name}.json`, import.meta.url),
      'utf8',
    ),
  )

test('parses cgroup v1 and v2 CPU and memory controllers', () => {
  assert.equal(parseCgroupV2CpuMax('250000 100000'), 2.5)
  assert.equal(parseCgroupV2CpuMax('max 100000'), undefined)
  assert.equal(parseCgroupV1CpuQuota('300000', '100000'), 3)
  assert.equal(parseCgroupV1CpuQuota('-1', '100000'), undefined)
  assert.equal(parseCgroupMemoryBytes('1073741824'), 1073741824)
  assert.equal(parseCgroupMemoryBytes('max'), undefined)
})

test('uses cgroup v1 memory to reduce workers even when CPU is plentiful', () => {
  const plan = createVisualCapacityPlan(fixture('cgroup-v1-low-memory'))

  assert.equal(plan.effectiveCpu, 4)
  assert.equal(plan.effectiveMemoryMiB, 3072)
  assert.equal(plan.previewWorkers, 2)
  assert.equal(plan.devWorkers, 1)
  assert.equal(plan.suiteMode, 'serial')
  assert.match(plan.reasons.join('\n'), /memory limited visual workers/)
})

test('uses availableParallelism instead of the larger visible CPU count without cgroups', () => {
  const plan = createVisualCapacityPlan(fixture('no-cgroup'), {
    FSUS_VISUAL_SUITE_MODE: 'serial',
  })

  assert.equal(plan.effectiveCpu, 8)
  assert.equal(plan.effectiveMemoryMiB, 16384)
  assert.equal(plan.previewWorkers, 7)
  assert.equal(plan.devWorkers, 3)
})

test('uses a fractional cgroup v2 CPU quota as the strict CPU constraint', () => {
  const plan = createVisualCapacityPlan(fixture('cgroup-v2-low-cpu'))

  assert.equal(plan.effectiveCpu, 1)
  assert.equal(plan.previewWorkers, 1)
  assert.equal(plan.devWorkers, 1)
  assert.equal(plan.suiteMode, 'serial')
  assert.ok(plan.budgets.serialMemoryReserveMiB >= 0)
})

test('scales workers and audit buckets on high-resource hosts without nested overcommit', () => {
  const low = createVisualCapacityPlan(fixture('cgroup-v1-low-memory'))
  const high = createVisualCapacityPlan(fixture('high-resource'))

  assert.equal(high.suiteMode, 'parallel')
  assert.ok(high.previewWorkers > low.previewWorkers)
  assert.ok(high.devWorkers > low.devWorkers)
  assert.ok(high.auditBucketCount > low.auditBucketCount)
  assert.ok(
    high.previewWorkers + high.devWorkers <= high.budgets.parallelWorkerSlots,
  )
})

test('applies explicit limits and marks worker overrides without exceeding safety caps', () => {
  const plan = createVisualCapacityPlan(fixture('high-resource'), {
    FSUS_VISUAL_CPU_LIMIT: '6',
    FSUS_VISUAL_MEMORY_LIMIT_MB: '4096',
    FSUS_VISUAL_MEMORY_PER_WORKER_MB: '1024',
    FSUS_VISUAL_MAX_WORKERS: '10',
    FSUS_VISUAL_WORKERS: '9',
    FSUS_VISUAL_DEV_WORKERS: '7',
    FSUS_VISUAL_SUITE_MODE: 'parallel',
  })

  assert.equal(plan.effectiveCpu, 6)
  assert.equal(plan.effectiveMemoryMiB, 4096)
  assert.equal(plan.suiteMode, 'serial')
  assert.equal(plan.previewWorkers, 2)
  assert.equal(plan.devWorkers, 2)
  assert.match(plan.reasons.join('\n'), /override requested/)
  assert.match(plan.reasons.join('\n'), /downgraded/)
})

test('falls back to CPU visibility only when availableParallelism is unavailable', () => {
  const plan = createVisualCapacityPlan({
    cpuCount: 12,
    totalMemoryBytes: 8 * 1024 * 1024 * 1024,
  })

  assert.equal(plan.effectiveCpu, 12)
  assert.match(plan.reasons.join('\n'), /visibility fallback recorded/)
})

test('host probe supports virtual cgroup files without browser or network dependencies', () => {
  const files = new Map([
    ['/sys/fs/cgroup/cpu.max', '200000 100000'],
    ['/sys/fs/cgroup/memory.max', '4294967296'],
  ])
  const snapshot = probeVisualCapacityHost({
    readFile: (path) => {
      if (!files.has(path)) throw new Error('ENOENT')
      return files.get(path)
    },
    availableParallelism: () => 16,
    cpuCount: () => 32,
    totalMemoryBytes: () => 64 * 1024 * 1024 * 1024,
  })

  assert.equal(snapshot.cgroupV2CpuMax, '200000 100000')
  assert.equal(snapshot.cgroupV2MemoryMax, '4294967296')
  assert.equal(createVisualCapacityPlan(snapshot).effectiveCpu, 2)
})

test('dry-run is deterministic from a fixture and imports no browser or network client', () => {
  const moduleSource = readFileSync(
    new URL('../scripts/visual-capacity.mjs', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(
    moduleSource,
    /playwright|puppeteer|fetch\(|node:https|node:http/u,
  )

  const fixturePath = fileURLToPath(
    new URL('./fixtures/visual-capacity/no-cgroup.json', import.meta.url),
  )
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('../scripts/visual-capacity.mjs', import.meta.url)),
      '--dry-run',
      '--fixture',
      fixturePath,
    ],
    {
      encoding: 'utf8',
      env: {
        PATH: '',
        FSUS_VISUAL_SUITE_MODE: 'serial',
      },
    },
  )

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /"suiteMode": "serial"/)
  assert.match(result.stdout, /Visual capacity:/)
})

test('policy source prevents cpus length from becoming a visual worker count', () => {
  const source = readFileSync(
    new URL('../scripts/visual-capacity.mjs', import.meta.url),
    'utf8',
  )

  assert.doesNotMatch(
    source,
    /(?:previewWorkers|devWorkers)\s*[:=][^\n]*cpus\(\)\.length/u,
  )
  assert.match(source, /availableParallelism/)
  assert.match(source, /visibility evidence only/)
})
