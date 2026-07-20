/* global module, require */

const { readFileSync } = require('node:fs')
const {
  CAPACITY_PLAN_ENV,
  createCapacityPlan,
  parseCapacityPlan,
  probeCapacityHost,
} = require('./ci-capacity.cjs')

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

  const hasLegacyBaseOverride =
    env.FSUS_VISUAL_CPU_LIMIT !== undefined ||
    env.FSUS_VISUAL_MEMORY_LIMIT_MB !== undefined
  const sharedPlan =
    (hasLegacyBaseOverride
      ? undefined
      : parseCapacityPlan(env[CAPACITY_PLAN_ENV])) ??
    createCapacityPlan(
      snapshot,
      {
        ...env,
        FSUS_CI_CPU_LIMIT: env.FSUS_CI_CPU_LIMIT ?? env.FSUS_VISUAL_CPU_LIMIT,
        FSUS_CI_MEMORY_LIMIT_MB:
          env.FSUS_CI_MEMORY_LIMIT_MB ?? env.FSUS_VISUAL_MEMORY_LIMIT_MB,
      },
      { unitTestFileCount: 0 },
    )
  // cpuCount remains visibility evidence only; execution counts come from the
  // validated repository capacity base.
  reasons.push(
    ...sharedPlan.reasons.map((reason) => `capacity base: ${reason}`),
  )
  const cpu = {
    effectiveCpu: sharedPlan.effectiveCpu,
    constraints: {
      explicit: sharedPlan.limits.cpu.override,
      cgroupV2: sharedPlan.limits.cpu.cgroupV2,
      cgroupV1: sharedPlan.limits.cpu.cgroupV1,
      available: sharedPlan.limits.cpu.availableParallelism,
      visibilityFallback: sharedPlan.limits.cpu.visible,
    },
  }
  const memory = {
    effectiveMemoryMiB: sharedPlan.effectiveMemoryMiB,
    constraints: {
      explicitMiB: sharedPlan.limits.memory.overrideMiB,
      cgroupV2MiB: sharedPlan.limits.memory.cgroupV2MiB,
      cgroupV1MiB: sharedPlan.limits.memory.cgroupV1MiB,
      hostMiB: sharedPlan.limits.memory.hostMiB,
    },
  }
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
      { cause: error },
    )
  }
}

function probeVisualCapacityHost(dependencies = {}) {
  return probeCapacityHost(dependencies)
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
