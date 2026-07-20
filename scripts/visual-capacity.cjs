const { readFileSync } = require('node:fs')
const { availableParallelism, cpus, totalmem } = require('node:os')

const DEFAULT_VISUAL_CAPACITY_POLICY = Object.freeze({
  baseReserveMiB: 1024,
  serverReserveMiB: 512,
  memoryPerWorkerMiB: 768,
  maxWorkers: 16,
  maxAuditBuckets: 32,
  parallelMinimumCpu: 8,
  parallelMinimumWorkerSlots: 6,
})

const VISUAL_CAPACITY_PLAN_ENV = 'FSUS_VISUAL_CAPACITY_PLAN'

const MIB = 1024 * 1024

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
  return parsePositiveNumber(normalized)
}

function minimumDefined(values) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0)
  return valid.length > 0 ? Math.min(...valid) : undefined
}

function clampWorkerOverride(requested, safeLimit, label, reasons) {
  if (requested === undefined) return undefined
  const applied = Math.max(1, Math.min(requested, safeLimit))
  reasons.push(
    `${label} worker override requested ${requested}, applied ${applied}`,
  )
  if (applied < requested)
    reasons.push(
      `${label} worker override was capped by resource safety limits`,
    )
  return applied
}

function resolveCpu(snapshot, env, reasons) {
  const explicit = parsePositiveNumber(env.FSUS_VISUAL_CPU_LIMIT)
  const cgroupV2 = parseCgroupV2CpuMax(snapshot.cgroupV2CpuMax)
  const cgroupV1 = parseCgroupV1CpuQuota(
    snapshot.cgroupV1CpuQuota,
    snapshot.cgroupV1CpuPeriod,
  )
  const available = parsePositiveNumber(snapshot.availableParallelism)
  // cpuCount is visibility evidence only. It is never used when
  // availableParallelism is present and never becomes a worker count directly.
  const visibilityFallback =
    available === undefined ? parsePositiveNumber(snapshot.cpuCount) : undefined
  const raw =
    minimumDefined([
      explicit,
      cgroupV2,
      cgroupV1,
      available,
      visibilityFallback,
    ]) ?? 1
  const effectiveCpu = Math.max(1, Math.floor(raw))

  if (explicit !== undefined)
    reasons.push(`CPU limit override constrained capacity to ${explicit}`)
  if (cgroupV2 !== undefined && cgroupV2 <= raw)
    reasons.push(`cgroup v2 CPU quota constrained capacity to ${cgroupV2}`)
  if (cgroupV1 !== undefined && cgroupV1 <= raw)
    reasons.push(`cgroup v1 CPU quota constrained capacity to ${cgroupV1}`)
  if (visibilityFallback !== undefined)
    reasons.push(
      'availableParallelism unavailable; CPU visibility fallback recorded',
    )

  return {
    effectiveCpu,
    constraints: {
      explicit,
      cgroupV2,
      cgroupV1,
      available,
      visibilityFallback,
    },
  }
}

function resolveMemory(snapshot, env, reasons) {
  const explicitMiB = parsePositiveNumber(env.FSUS_VISUAL_MEMORY_LIMIT_MB)
  const cgroupV2Bytes = parseCgroupMemoryBytes(snapshot.cgroupV2MemoryMax)
  const cgroupV1Bytes = parseCgroupMemoryBytes(snapshot.cgroupV1MemoryLimit)
  const hostBytes = parsePositiveNumber(snapshot.totalMemoryBytes)
  const effectiveBytes =
    minimumDefined([
      explicitMiB === undefined ? undefined : explicitMiB * MIB,
      cgroupV2Bytes,
      cgroupV1Bytes,
      hostBytes,
    ]) ?? MIB
  const effectiveMemoryMiB = Math.max(1, Math.floor(effectiveBytes / MIB))

  if (explicitMiB !== undefined)
    reasons.push(
      `memory limit override constrained capacity to ${explicitMiB} MiB`,
    )
  if (cgroupV2Bytes !== undefined && cgroupV2Bytes <= effectiveBytes)
    reasons.push('cgroup v2 memory limit constrained capacity')
  if (cgroupV1Bytes !== undefined && cgroupV1Bytes <= effectiveBytes)
    reasons.push('cgroup v1 memory limit constrained capacity')

  return {
    effectiveMemoryMiB,
    constraints: {
      explicitMiB,
      cgroupV2MiB:
        cgroupV2Bytes === undefined
          ? undefined
          : Math.floor(cgroupV2Bytes / MIB),
      cgroupV1MiB:
        cgroupV1Bytes === undefined
          ? undefined
          : Math.floor(cgroupV1Bytes / MIB),
      hostMiB:
        hostBytes === undefined ? undefined : Math.floor(hostBytes / MIB),
    },
  }
}

function workerSlots({ cpu, memoryMiB, serverCount, policy }) {
  const cpuSlots = Math.max(1, Math.floor(cpu - serverCount))
  const memoryReserveMiB =
    policy.baseReserveMiB + policy.serverReserveMiB * serverCount
  const memorySlots = Math.max(
    1,
    Math.floor(
      Math.max(0, memoryMiB - memoryReserveMiB) / policy.memoryPerWorkerMiB,
    ),
  )
  return {
    safe: Math.max(1, Math.min(cpuSlots, memorySlots, policy.maxWorkers)),
    cpuSlots,
    memorySlots,
    memoryReserveMiB,
  }
}

function createVisualCapacityPlan(snapshot, env = {}, policyOverrides = {}) {
  const reasons = []
  const policy = {
    ...DEFAULT_VISUAL_CAPACITY_POLICY,
    ...policyOverrides,
  }
  const memoryPerWorkerOverride = parsePositiveInteger(
    env.FSUS_VISUAL_MEMORY_PER_WORKER_MB,
  )
  const maxWorkersOverride = parsePositiveInteger(env.FSUS_VISUAL_MAX_WORKERS)
  if (memoryPerWorkerOverride !== undefined) {
    policy.memoryPerWorkerMiB = memoryPerWorkerOverride
    reasons.push(
      `memory per worker override set to ${memoryPerWorkerOverride} MiB`,
    )
  }
  if (maxWorkersOverride !== undefined) {
    policy.maxWorkers = maxWorkersOverride
    reasons.push(`maximum worker override set to ${maxWorkersOverride}`)
  }

  const cpu = resolveCpu(snapshot, env, reasons)
  const memory = resolveMemory(snapshot, env, reasons)
  const serialSlots = workerSlots({
    cpu: cpu.effectiveCpu,
    memoryMiB: memory.effectiveMemoryMiB,
    serverCount: 1,
    policy,
  })
  const parallelSlots = workerSlots({
    cpu: cpu.effectiveCpu,
    memoryMiB: memory.effectiveMemoryMiB,
    serverCount: 2,
    policy,
  })

  if (serialSlots.memorySlots < serialSlots.cpuSlots)
    reasons.push('memory limited visual workers')
  if (serialSlots.cpuSlots < serialSlots.memorySlots)
    reasons.push('CPU limited visual workers')
  reasons.push(
    'reserved capacity for Node orchestration, reports, filesystem cache, and web server',
  )

  const requestedMode = ['auto', 'serial', 'parallel'].includes(
    env.FSUS_VISUAL_SUITE_MODE,
  )
    ? env.FSUS_VISUAL_SUITE_MODE
    : 'auto'
  const parallelSafe =
    cpu.effectiveCpu >= policy.parallelMinimumCpu &&
    parallelSlots.safe >= policy.parallelMinimumWorkerSlots
  let suiteMode =
    requestedMode === 'auto'
      ? parallelSafe
        ? 'parallel'
        : 'serial'
      : requestedMode
  if (suiteMode === 'parallel' && !parallelSafe) {
    suiteMode = 'serial'
    reasons.push(
      'parallel suite request downgraded because two server reserves leave insufficient capacity',
    )
  } else if (suiteMode === 'parallel') {
    reasons.push(
      'preview and dev suites may run in parallel after reserving two web servers',
    )
  } else {
    reasons.push(
      'preview and dev suites run serially to avoid nested overcommit',
    )
  }

  let previewDefault
  let devDefault
  if (suiteMode === 'parallel') {
    previewDefault = Math.max(1, Math.ceil(parallelSlots.safe / 2))
    devDefault = Math.max(1, Math.floor(parallelSlots.safe / 2))
  } else {
    previewDefault = serialSlots.safe
    devDefault = Math.max(1, Math.floor(serialSlots.safe / 2))
  }

  const previewOverride = parsePositiveInteger(env.FSUS_VISUAL_WORKERS)
  const devOverride = parsePositiveInteger(env.FSUS_VISUAL_DEV_WORKERS)
  const previewWorkers =
    clampWorkerOverride(
      previewOverride,
      suiteMode === 'parallel'
        ? Math.max(1, parallelSlots.safe - 1)
        : serialSlots.safe,
      'preview',
      reasons,
    ) ?? previewDefault
  const remainingParallelSlots = Math.max(
    1,
    parallelSlots.safe - previewWorkers,
  )
  const devWorkers =
    clampWorkerOverride(
      devOverride,
      suiteMode === 'parallel' ? remainingParallelSlots : serialSlots.safe,
      'dev',
      reasons,
    ) ??
    Math.min(
      devDefault,
      suiteMode === 'parallel' ? remainingParallelSlots : serialSlots.safe,
    )
  const auditBucketCount = Math.max(
    1,
    Math.min(policy.maxAuditBuckets, Math.max(previewWorkers, devWorkers) * 2),
  )

  return {
    effectiveCpu: cpu.effectiveCpu,
    effectiveMemoryMiB: memory.effectiveMemoryMiB,
    previewWorkers,
    devWorkers,
    auditBucketCount,
    suiteMode,
    limits: {
      cpu: cpu.constraints,
      memory: memory.constraints,
      maxWorkers: policy.maxWorkers,
    },
    budgets: {
      baseReserveMiB: policy.baseReserveMiB,
      serverReserveMiB: policy.serverReserveMiB,
      memoryPerWorkerMiB: policy.memoryPerWorkerMiB,
      serialMemoryReserveMiB: serialSlots.memoryReserveMiB,
      parallelMemoryReserveMiB: parallelSlots.memoryReserveMiB,
      serialWorkerSlots: serialSlots.safe,
      parallelWorkerSlots: parallelSlots.safe,
    },
    reasons,
  }
}

function validateVisualCapacityPlan(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('visual capacity plan must be an object')
  }
  for (const field of [
    'effectiveCpu',
    'effectiveMemoryMiB',
    'previewWorkers',
    'devWorkers',
    'auditBucketCount',
  ]) {
    if (!Number.isInteger(plan[field]) || plan[field] < 1) {
      throw new Error(
        `visual capacity plan ${field} must be a positive integer`,
      )
    }
  }
  if (!['serial', 'parallel'].includes(plan.suiteMode)) {
    throw new Error('visual capacity plan suiteMode must be serial or parallel')
  }
  return plan
}

function serializeVisualCapacityPlan(plan) {
  return JSON.stringify(validateVisualCapacityPlan(plan))
}

function parseVisualCapacityPlan(value) {
  if (!value || String(value).trim() === '') return undefined
  try {
    return validateVisualCapacityPlan(JSON.parse(value))
  } catch (error) {
    throw new Error(
      `invalid ${VISUAL_CAPACITY_PLAN_ENV}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function readFirst(paths, readFile = readFileSync) {
  for (const path of paths) {
    try {
      return readFile(path, 'utf8')
    } catch {
      // Missing controller files are expected outside Linux containers.
    }
  }
  return undefined
}

function probeVisualCapacityHost(dependencies = {}) {
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

function resolveVisualCapacityPlan(options = {}) {
  const env = options.env ?? process.env
  const serialized = parseVisualCapacityPlan(env[VISUAL_CAPACITY_PLAN_ENV])
  if (serialized) return serialized

  const snapshot =
    options.snapshot ?? probeVisualCapacityHost(options.dependencies)
  const plan = createVisualCapacityPlan(snapshot, env, options.policyOverrides)
  env[VISUAL_CAPACITY_PLAN_ENV] = serializeVisualCapacityPlan(plan)
  return plan
}

function formatVisualCapacitySummary(plan) {
  return [
    `Visual capacity: ${plan.effectiveCpu} CPU, ${plan.effectiveMemoryMiB} MiB`,
    `Suites: ${plan.suiteMode}; preview=${plan.previewWorkers}, dev=${plan.devWorkers}, audit buckets=${plan.auditBucketCount}`,
    `Budgets: reserve=${plan.budgets.baseReserveMiB} MiB, server=${plan.budgets.serverReserveMiB} MiB each, worker=${plan.budgets.memoryPerWorkerMiB} MiB`,
    ...plan.reasons.map((reason) => `- ${reason}`),
  ].join('\n')
}

function parseCliArguments(argv) {
  const options = { dryRun: false, fixture: undefined }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') options.dryRun = true
    else if (argument === '--fixture') options.fixture = argv[(index += 1)]
    else throw new Error(`unknown visual capacity argument: ${argument}`)
  }
  return options
}

function runVisualCapacityCli(argv = process.argv.slice(2), env = process.env) {
  const options = parseCliArguments(argv)
  if (!options.dryRun)
    throw new Error('visual-capacity currently requires --dry-run')
  const snapshot = options.fixture
    ? JSON.parse(readFileSync(options.fixture, 'utf8'))
    : probeVisualCapacityHost()
  const plan = createVisualCapacityPlan(snapshot, env)
  process.stdout.write(
    `${JSON.stringify(plan, null, 2)}\n${formatVisualCapacitySummary(plan)}\n`,
  )
  return plan
}

module.exports = {
  DEFAULT_VISUAL_CAPACITY_POLICY,
  VISUAL_CAPACITY_PLAN_ENV,
  createVisualCapacityPlan,
  formatVisualCapacitySummary,
  parseCgroupMemoryBytes,
  parseCgroupV1CpuQuota,
  parseCgroupV2CpuMax,
  parsePositiveInteger,
  parsePositiveNumber,
  parseVisualCapacityPlan,
  probeVisualCapacityHost,
  resolveVisualCapacityPlan,
  runVisualCapacityCli,
  serializeVisualCapacityPlan,
  validateVisualCapacityPlan,
}
