/* global module, require */

const { readFileSync } = require('node:fs')
const { availableParallelism, cpus, totalmem } = require('node:os')

const CAPACITY_PLAN_ENV = 'FSUS_CI_CAPACITY_PLAN'
const MIB = 1024 * 1024

const DEFAULT_CAPACITY_POLICY = Object.freeze({
  baseReserveMiB: 1024,
  coordinatorReserveMiB: 384,
  nativePerNodeProcessMiB: 256,
  laneMemoryMiB: 1024,
  unitFilesPerShard: 60,
  maxUnitShards: 8,
  maxVitestWorkersPerShard: 4,
  maxParallelLanes: 16,
  heapProfilesMiB: Object.freeze({
    small: 512,
    auto: 1536,
    unit: 1024,
    typecheck: 1536,
    build: 3072,
    coverage: 2048,
    visual: 2048,
  }),
})

function parsePositiveNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '')
    return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parsePositiveInteger(value) {
  const parsed = parsePositiveNumber(value)
  return parsed === undefined ? undefined : Math.floor(parsed)
}

function parseCgroupV2CpuMax(value) {
  const [quotaRaw, periodRaw] = String(value ?? '')
    .trim()
    .split(/\s+/u)
  if (!quotaRaw || quotaRaw === 'max') return undefined
  const quota = parsePositiveNumber(quotaRaw)
  const period = parsePositiveNumber(periodRaw)
  return quota && period ? quota / period : undefined
}

function parseCgroupV1CpuQuota(quotaValue, periodValue) {
  const quota = Number(String(quotaValue ?? '').trim())
  const period = parsePositiveNumber(periodValue)
  return Number.isFinite(quota) && quota > 0 && period
    ? quota / period
    : undefined
}

function parseCgroupMemoryBytes(value) {
  const normalized = String(value ?? '').trim()
  if (!normalized || normalized === 'max') return undefined
  const parsed = parsePositiveNumber(normalized)
  // Common cgroup v1 "unlimited" sentinels are close to LONG_MAX and must not
  // hide a smaller host limit.
  return parsed !== undefined && parsed < 2 ** 60 ? parsed : undefined
}

function minimumDefined(values) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0)
  return valid.length > 0 ? Math.min(...valid) : undefined
}

function chunk(values, size) {
  const result = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function readFirst(paths, readFile = readFileSync) {
  for (const path of paths) {
    try {
      return readFile(path, 'utf8')
    } catch {
      // Controller files are Linux-specific and may be absent on local hosts.
    }
  }
  return undefined
}

function probeCapacityHost(dependencies = {}) {
  const readFile = dependencies.readFile ?? readFileSync
  const resolveAvailableParallelism =
    dependencies.availableParallelism ?? availableParallelism
  const resolveCpuCount = dependencies.cpuCount ?? (() => cpus().length)
  const resolveTotalMemory = dependencies.totalMemoryBytes ?? totalmem
  return {
    availableParallelism: resolveAvailableParallelism?.(),
    cpuCount: resolveCpuCount(),
    totalMemoryBytes: resolveTotalMemory(),
    cgroupV2CpuMax: readFirst(['/sys/fs/cgroup/cpu.max'], readFile),
    cgroupV1CpuQuota: readFirst(
      [
        '/sys/fs/cgroup/cpu/cpu.cfs_quota_us',
        '/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_quota_us',
      ],
      readFile,
    ),
    cgroupV1CpuPeriod: readFirst(
      [
        '/sys/fs/cgroup/cpu/cpu.cfs_period_us',
        '/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_period_us',
      ],
      readFile,
    ),
    cgroupV2MemoryMax: readFirst(['/sys/fs/cgroup/memory.max'], readFile),
    cgroupV1MemoryLimit: readFirst(
      [
        '/sys/fs/cgroup/memory/memory.limit_in_bytes',
        '/sys/fs/cgroup/memory.limit_in_bytes',
      ],
      readFile,
    ),
  }
}

function resolveResourceBase(snapshot, env, reasons) {
  const cpuOverride = parsePositiveNumber(env.FSUS_CI_CPU_LIMIT)
  const cgroupV2Cpu = parseCgroupV2CpuMax(snapshot.cgroupV2CpuMax)
  const cgroupV1Cpu = parseCgroupV1CpuQuota(
    snapshot.cgroupV1CpuQuota,
    snapshot.cgroupV1CpuPeriod,
  )
  const availableCpu = parsePositiveNumber(snapshot.availableParallelism)
  const visibleCpu = parsePositiveNumber(snapshot.cpuCount)
  const effectiveCpu = Math.max(
    1,
    Math.floor(
      minimumDefined([
        cpuOverride,
        cgroupV2Cpu,
        cgroupV1Cpu,
        availableCpu,
        visibleCpu,
      ]) ?? 1,
    ),
  )

  const memoryOverrideMiB = parsePositiveNumber(env.FSUS_CI_MEMORY_LIMIT_MB)
  const cgroupV2MemoryBytes = parseCgroupMemoryBytes(snapshot.cgroupV2MemoryMax)
  const cgroupV1MemoryBytes = parseCgroupMemoryBytes(
    snapshot.cgroupV1MemoryLimit,
  )
  const hostMemoryBytes = parsePositiveNumber(snapshot.totalMemoryBytes)
  const effectiveMemoryMiB = Math.max(
    1,
    Math.floor(
      (minimumDefined([
        memoryOverrideMiB === undefined ? undefined : memoryOverrideMiB * MIB,
        cgroupV2MemoryBytes,
        cgroupV1MemoryBytes,
        hostMemoryBytes,
      ]) ?? MIB) / MIB,
    ),
  )

  if (cpuOverride !== undefined)
    reasons.push(
      `CPU override requested ${cpuOverride}, applied ${effectiveCpu}`,
    )
  if (memoryOverrideMiB !== undefined)
    reasons.push(
      `memory override requested ${memoryOverrideMiB} MiB, applied ${effectiveMemoryMiB} MiB`,
    )
  if (cgroupV2Cpu !== undefined)
    reasons.push(`cgroup v2 CPU quota ${cgroupV2Cpu} included in capacity`)
  if (cgroupV1Cpu !== undefined)
    reasons.push(`cgroup v1 CPU quota ${cgroupV1Cpu} included in capacity`)
  if (availableCpu === undefined && visibleCpu !== undefined)
    reasons.push(
      'availableParallelism unavailable; CPU visibility fallback recorded',
    )
  if (cgroupV2MemoryBytes !== undefined)
    reasons.push('cgroup v2 memory limit included in effective capacity')
  if (cgroupV1MemoryBytes !== undefined)
    reasons.push('cgroup v1 memory limit included in effective capacity')

  return {
    effectiveCpu,
    effectiveMemoryMiB,
    constraints: {
      cpu: {
        override: cpuOverride,
        cgroupV2: cgroupV2Cpu,
        cgroupV1: cgroupV1Cpu,
        availableParallelism: availableCpu,
        visible: visibleCpu,
      },
      memory: {
        overrideMiB: memoryOverrideMiB,
        cgroupV2MiB:
          cgroupV2MemoryBytes === undefined
            ? undefined
            : Math.floor(cgroupV2MemoryBytes / MIB),
        cgroupV1MiB:
          cgroupV1MemoryBytes === undefined
            ? undefined
            : Math.floor(cgroupV1MemoryBytes / MIB),
        hostMiB:
          hostMemoryBytes === undefined
            ? undefined
            : Math.floor(hostMemoryBytes / MIB),
      },
    },
  }
}

function calculateHeapProfiles({
  effectiveMemoryMiB,
  reserveMiB,
  laneCount,
  policy,
  env,
  reasons,
}) {
  const safeBudgetMiB = Math.max(256, effectiveMemoryMiB - reserveMiB)
  const safePerProcessMiB = Math.max(
    256,
    Math.floor(safeBudgetMiB / Math.max(1, laneCount)) -
      policy.nativePerNodeProcessMiB,
  )
  const absoluteSafeCapMiB = Math.max(
    256,
    Math.min(safePerProcessMiB, Math.floor(effectiveMemoryMiB * 0.5)),
  )
  const requestedHeapMiB = parsePositiveInteger(env.FSUS_NODE_HEAP_MB)
  const requestedProfile = Object.hasOwn(
    policy.heapProfilesMiB,
    env.FSUS_NODE_HEAP_PROFILE,
  )
    ? env.FSUS_NODE_HEAP_PROFILE
    : 'auto'

  const profiles = Object.fromEntries(
    Object.entries(policy.heapProfilesMiB).map(([name, desired]) => [
      name,
      Math.max(256, Math.min(desired, absoluteSafeCapMiB)),
    ]),
  )
  if (requestedHeapMiB !== undefined) {
    const appliedOverrideMiB = Math.max(
      256,
      Math.min(requestedHeapMiB, absoluteSafeCapMiB),
    )
    for (const profile of Object.keys(profiles))
      profiles[profile] = appliedOverrideMiB
    reasons.push(
      `manual Node heap override requested ${requestedHeapMiB} MiB, applied ${appliedOverrideMiB} MiB to every profile`,
    )
  }
  if (absoluteSafeCapMiB < policy.heapProfilesMiB.auto)
    reasons.push('Node heap profiles reduced by the effective memory budget')

  return {
    profiles,
    selectedProfile: requestedProfile,
    selectedMiB: profiles[requestedProfile],
    safePerProcessMiB: absoluteSafeCapMiB,
    requestedMiB: requestedHeapMiB,
  }
}

function createCapacityPlan(
  snapshot,
  env = {},
  options = {},
  policyOverrides = {},
) {
  const reasons = []
  const policy = {
    ...DEFAULT_CAPACITY_POLICY,
    ...policyOverrides,
    heapProfilesMiB: {
      ...DEFAULT_CAPACITY_POLICY.heapProfilesMiB,
      ...(policyOverrides.heapProfilesMiB ?? {}),
    },
  }
  const base = resolveResourceBase(snapshot, env, reasons)
  const maxParallelOverride = parsePositiveInteger(
    env.FSUS_CI_MAX_PARALLEL_LANES,
  )
  const baseReserveMiB = Math.min(
    base.effectiveMemoryMiB,
    policy.baseReserveMiB + policy.coordinatorReserveMiB,
  )
  const memoryLaneLimit = Math.max(
    1,
    Math.floor(
      Math.max(0, base.effectiveMemoryMiB - baseReserveMiB) /
        policy.laneMemoryMiB,
    ),
  )
  const cpuLaneLimit = Math.max(1, base.effectiveCpu - 1)
  const parallelLaneLimit = Math.max(
    1,
    Math.min(
      cpuLaneLimit,
      memoryLaneLimit,
      policy.maxParallelLanes,
      maxParallelOverride ?? Number.POSITIVE_INFINITY,
    ),
  )
  if (maxParallelOverride !== undefined)
    reasons.push(
      `parallel lane override requested ${maxParallelOverride}, applied ${parallelLaneLimit}`,
    )
  if (memoryLaneLimit <= cpuLaneLimit)
    reasons.push('memory constrained the repository parallel lane budget')
  else reasons.push('CPU constrained the repository parallel lane budget')
  reasons.push(
    `reserved ${baseReserveMiB} MiB for OS, filesystem cache, package coordinators, and native processes`,
  )

  const lanes = {
    typecheck: Math.min(4, parallelLaneLimit),
    unit: parallelLaneLimit,
    build: 1,
    coverage: 1,
    visual: parallelLaneLimit,
  }
  const unitTestFileCount = Math.max(
    0,
    parsePositiveInteger(options.unitTestFileCount) ?? 0,
  )
  const workloadShardLimit = Math.max(
    1,
    Math.ceil(unitTestFileCount / policy.unitFilesPerShard),
  )
  const requestedUnitShards = parsePositiveInteger(env.FSUS_CI_UNIT_SHARDS)
  const unitShards = Math.max(
    1,
    Math.min(
      requestedUnitShards ?? workloadShardLimit,
      workloadShardLimit,
      policy.maxUnitShards,
      lanes.unit,
    ),
  )
  const workerCpuLimit = Math.max(1, Math.floor(parallelLaneLimit / unitShards))
  const workerMemoryLimit = Math.max(
    1,
    Math.floor(
      Math.max(0, base.effectiveMemoryMiB - baseReserveMiB) /
        unitShards /
        policy.laneMemoryMiB,
    ),
  )
  const requestedVitestWorkers = parsePositiveInteger(
    env.FSUS_VITEST_WORKERS ?? env.FSUS_TEST_WORKERS,
  )
  const vitestWorkersPerShard = Math.max(
    1,
    Math.min(
      requestedVitestWorkers ?? policy.maxVitestWorkersPerShard,
      workerCpuLimit,
      workerMemoryLimit,
      policy.maxVitestWorkersPerShard,
    ),
  )
  if (requestedUnitShards !== undefined)
    reasons.push(
      `Unit shard override requested ${requestedUnitShards}, applied ${unitShards}`,
    )
  if (requestedVitestWorkers !== undefined)
    reasons.push(
      `Vitest worker override requested ${requestedVitestWorkers}, applied ${vitestWorkersPerShard}`,
    )
  reasons.push(
    `Unit workload ${unitTestFileCount} files selected ${unitShards} shard(s) with ${vitestWorkersPerShard} worker(s) each`,
  )

  const typecheckTasks = ['web', 'node', 'vite-config', 'vitest']
  const typecheckBatches = chunk(typecheckTasks, lanes.typecheck)
  const suiteBatches =
    lanes.typecheck < parallelLaneLimit
      ? [['typecheck', 'lint']]
      : [['typecheck'], ['lint']]
  suiteBatches.push(['unit'], ['build'], ['coverage'], ['visual'])
  const heap = calculateHeapProfiles({
    effectiveMemoryMiB: base.effectiveMemoryMiB,
    reserveMiB: baseReserveMiB,
    laneCount: Math.max(lanes.typecheck, unitShards * vitestWorkersPerShard),
    policy,
    env,
    reasons,
  })

  return {
    effectiveCpu: base.effectiveCpu,
    effectiveMemoryMiB: base.effectiveMemoryMiB,
    nodeHeapMiB: heap.selectedMiB,
    nodeHeapProfile: heap.selectedProfile,
    nodeHeapProfilesMiB: heap.profiles,
    lanes,
    unitTestFileCount,
    unitShards,
    vitestWorkersPerShard,
    typecheckBatches,
    suiteBatches,
    limits: base.constraints,
    overrides: {
      cpu: base.constraints.cpu.override,
      memoryMiB: base.constraints.memory.overrideMiB,
      maxParallelLanes: maxParallelOverride,
      unitShards: requestedUnitShards,
      vitestWorkers: requestedVitestWorkers,
      nodeHeapProfile: env.FSUS_NODE_HEAP_PROFILE,
      nodeHeapMiB: heap.requestedMiB,
    },
    overrideStatus: {
      cpu: {
        active: base.constraints.cpu.override !== undefined,
        requested: base.constraints.cpu.override,
        applied: base.effectiveCpu,
      },
      memory: {
        active: base.constraints.memory.overrideMiB !== undefined,
        requestedMiB: base.constraints.memory.overrideMiB,
        appliedMiB: base.effectiveMemoryMiB,
      },
      maxParallelLanes: {
        active: maxParallelOverride !== undefined,
        requested: maxParallelOverride,
        applied: parallelLaneLimit,
      },
      nodeHeap: {
        active: heap.requestedMiB !== undefined,
        requestedMiB: heap.requestedMiB,
        appliedMiB: heap.selectedMiB,
      },
    },
    budgets: {
      baseReserveMiB,
      allocatableMemoryMiB: Math.max(
        0,
        base.effectiveMemoryMiB - baseReserveMiB,
      ),
      laneMemoryMiB: policy.laneMemoryMiB,
      nativePerNodeProcessMiB: policy.nativePerNodeProcessMiB,
      memoryLaneLimit,
      cpuLaneLimit,
      parallelLaneLimit,
      safeNodeHeapPerProcessMiB: heap.safePerProcessMiB,
    },
    reasons,
  }
}

function validateCapacityPlan(plan) {
  if (!plan || typeof plan !== 'object')
    throw new Error('CI capacity plan must be an object')
  for (const field of [
    'effectiveCpu',
    'effectiveMemoryMiB',
    'nodeHeapMiB',
    'unitShards',
    'vitestWorkersPerShard',
  ]) {
    if (!Number.isInteger(plan[field]) || plan[field] < 1)
      throw new Error(`CI capacity plan ${field} must be a positive integer`)
  }
  if (
    plan.unitShards * plan.vitestWorkersPerShard >
    plan.budgets.parallelLaneLimit
  )
    throw new Error('Unit shards and workers exceed the parallel lane budget')
  if (
    plan.nodeHeapMiB + plan.budgets.nativePerNodeProcessMiB >
    plan.budgets.safeNodeHeapPerProcessMiB +
      plan.budgets.nativePerNodeProcessMiB
  )
    throw new Error('Node heap exceeds the safe per-process memory budget')
  return plan
}

function serializeCapacityPlan(plan) {
  return JSON.stringify(validateCapacityPlan(plan))
}

function parseCapacityPlan(value) {
  if (!value || String(value).trim() === '') return undefined
  try {
    return validateCapacityPlan(JSON.parse(value))
  } catch (error) {
    throw new Error(
      `invalid ${CAPACITY_PLAN_ENV}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}

function resolveCapacityPlan(options = {}) {
  const env = options.env ?? process.env
  const serialized = parseCapacityPlan(env[CAPACITY_PLAN_ENV])
  if (serialized) return serialized
  const snapshot = options.snapshot ?? probeCapacityHost(options.dependencies)
  const plan = createCapacityPlan(
    snapshot,
    env,
    options,
    options.policyOverrides,
  )
  env[CAPACITY_PLAN_ENV] = serializeCapacityPlan(plan)
  return plan
}

function resolveNodeHeapMiB(plan, profile = 'auto') {
  validateCapacityPlan(plan)
  return plan.nodeHeapProfilesMiB[profile] ?? plan.nodeHeapProfilesMiB.auto
}

function createUnitMatrix(plan) {
  validateCapacityPlan(plan)
  return Array.from({ length: plan.unitShards }, (_, index) => ({
    shard: `${index + 1}/${plan.unitShards}`,
    workers: plan.vitestWorkersPerShard,
  }))
}

function formatCapacitySummary(plan) {
  const overrideEntries = Object.entries(plan.overrides)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}=${value}`)
  return [
    `CI capacity: ${plan.effectiveCpu} CPU, ${plan.effectiveMemoryMiB} MiB`,
    `Lanes: typecheck=${plan.lanes.typecheck}, unit=${plan.lanes.unit}, build=${plan.lanes.build}, coverage=${plan.lanes.coverage}, visual=${plan.lanes.visual}`,
    `Unit: files=${plan.unitTestFileCount}, shards=${plan.unitShards}, workers/shard=${plan.vitestWorkersPerShard}`,
    `Node heap: profile=${plan.nodeHeapProfile}, cap=${plan.nodeHeapMiB} MiB, safe/process=${plan.budgets.safeNodeHeapPerProcessMiB} MiB`,
    `Overrides: ${overrideEntries.length > 0 ? overrideEntries.join(', ') : 'none'}`,
    ...plan.reasons.map((reason) => `- ${reason}`),
  ].join('\n')
}

module.exports = {
  CAPACITY_PLAN_ENV,
  DEFAULT_CAPACITY_POLICY,
  createCapacityPlan,
  createUnitMatrix,
  formatCapacitySummary,
  parseCapacityPlan,
  parseCgroupMemoryBytes,
  parseCgroupV1CpuQuota,
  parseCgroupV2CpuMax,
  parsePositiveInteger,
  parsePositiveNumber,
  probeCapacityHost,
  resolveCapacityPlan,
  resolveNodeHeapMiB,
  serializeCapacityPlan,
  validateCapacityPlan,
}
