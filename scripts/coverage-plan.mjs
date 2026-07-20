#!/usr/bin/env node

import { appendFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import {
  formatCapacitySummary,
  probeCapacityHost,
  resolveCapacityPlan,
} from './ci-capacity.mjs'

export const COVERAGE_TEST_PATTERNS = [
  'vue/packages/**/__tests__/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}',
  'vue/tests/boundary/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}',
]

export const DEFAULT_COVERAGE_POLICY = Object.freeze({
  autoShardFileThreshold: 300,
  minFilesPerShard: 60,
  maxShards: 8,
  maxWorkersPerShard: 2,
  shardMemoryMiB: 2048,
  thresholdSeconds: 180,
})

function positiveInteger(value) {
  if (value == null || String(value).trim() === '') return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function positiveNumber(value) {
  if (value == null || String(value).trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export function countCoverageTestFiles() {
  return globSync(COVERAGE_TEST_PATTERNS, {
    exclude: ['**/node_modules/**'],
  }).length
}

export function createCoveragePlan(
  capacity,
  { testFileCount, env = {}, policy: overrides = {} },
) {
  const policy = { ...DEFAULT_COVERAGE_POLICY, ...overrides }
  const files = Math.max(0, Math.floor(Number(testFileCount) || 0))
  const thresholdSeconds =
    positiveNumber(env.FSUSUI_COVERAGE_SHARD_THRESHOLD_SECONDS) ??
    policy.thresholdSeconds
  const knownDurationSeconds = positiveNumber(env.FSUSUI_COVERAGE_KNOWN_SECONDS)
  const durationBudgetSeconds = positiveNumber(
    env.FSUSUI_COVERAGE_DURATION_BUDGET_SECONDS,
  )
  const requestedShards = positiveInteger(env.FSUSUI_COVERAGE_SHARDS)
  const requestedWorkers = positiveInteger(env.FSUSUI_COVERAGE_WORKERS)
  const parallelLaneLimit = capacity.budgets.parallelLaneLimit
  const memoryShardLimit = Math.max(
    1,
    Math.floor(capacity.budgets.allocatableMemoryMiB / policy.shardMemoryMiB),
  )
  const workloadShardLimit = Math.max(
    1,
    Math.floor(Math.max(files, 1) / policy.minFilesPerShard),
  )
  const resourceShardLimit = Math.max(
    1,
    Math.min(
      parallelLaneLimit,
      memoryShardLimit,
      workloadShardLimit,
      policy.maxShards,
    ),
  )
  const shouldAutoShard =
    files >= policy.autoShardFileThreshold ||
    (knownDurationSeconds !== undefined &&
      knownDurationSeconds > thresholdSeconds)
  const desiredShards =
    requestedShards ??
    (shouldAutoShard
      ? Math.max(2, Math.ceil(files / policy.minFilesPerShard))
      : 1)
  const shardCount = Math.max(1, Math.min(desiredShards, resourceShardLimit))
  const workerLimit = Math.max(1, Math.floor(parallelLaneLimit / shardCount))
  const workersPerShard = Math.max(
    1,
    Math.min(
      requestedWorkers ?? policy.maxWorkersPerShard,
      workerLimit,
      policy.maxWorkersPerShard,
    ),
  )
  if (shardCount * workersPerShard > parallelLaneLimit)
    throw new Error(
      'coverage shards and workers exceed the shared capacity plan',
    )
  const reasons = [
    `coverage workload has ${files} test files`,
    `coverage resource limit is ${resourceShardLimit} shard(s): cpu-lanes=${parallelLaneLimit}, memory=${memoryShardLimit}, workload=${workloadShardLimit}`,
    `coverage selected ${shardCount} shard(s) with ${workersPerShard} worker(s) each`,
  ]
  if (!shouldAutoShard && requestedShards === undefined)
    reasons.push(
      'single channel selected because the workload is below automatic sharding signals',
    )
  if (requestedShards !== undefined)
    reasons.push(
      `shard override requested ${requestedShards}, applied ${shardCount}`,
    )
  if (requestedWorkers !== undefined)
    reasons.push(
      `worker override requested ${requestedWorkers}, applied ${workersPerShard}`,
    )

  return {
    schemaVersion: 1,
    mode: shardCount === 1 ? 'single' : 'sharded',
    testFileCount: files,
    shardCount,
    workersPerShard,
    thresholdSeconds,
    durationBudgetSeconds,
    knownDurationSeconds,
    capacity: {
      effectiveCpu: capacity.effectiveCpu,
      effectiveMemoryMiB: capacity.effectiveMemoryMiB,
      parallelLaneLimit,
      allocatableMemoryMiB: capacity.budgets.allocatableMemoryMiB,
      shardMemoryMiB: policy.shardMemoryMiB,
    },
    reasons,
  }
}

export function createCoverageMatrix(plan) {
  return Array.from({ length: plan.shardCount }, (_, offset) => ({
    index: offset + 1,
    total: plan.shardCount,
    shard: `${offset + 1}/${plan.shardCount}`,
    workers: plan.workersPerShard,
  }))
}

export function resolveCoveragePlan(env = process.env, options = {}) {
  const testFileCount = options.testFileCount ?? countCoverageTestFiles()
  const capacity = resolveCapacityPlan({
    env,
    snapshot: options.snapshot ?? probeCapacityHost(),
    unitTestFileCount: testFileCount,
  })
  return {
    capacity,
    coverage: createCoveragePlan(capacity, {
      testFileCount,
      env,
      policy: options.policy,
    }),
  }
}

function parseArguments(argv) {
  const options = { dryRun: false }
  for (const argument of argv) {
    if (argument === '--dry-run') options.dryRun = true
    else if (argument.startsWith('--github-output='))
      options.githubOutput = argument.slice('--github-output='.length)
    else throw new Error(`unknown coverage plan argument: ${argument}`)
  }
  return options
}

export function runCoveragePlanCli(
  argv = process.argv.slice(2),
  env = process.env,
) {
  const options = parseArguments(argv)
  if (!options.dryRun) throw new Error('coverage:plan requires --dry-run')
  const result = resolveCoveragePlan(env)
  const matrix = { include: createCoverageMatrix(result.coverage) }
  process.stdout.write(
    `${JSON.stringify(result.coverage, null, 2)}\n${formatCapacitySummary(result.capacity)}\n`,
  )
  if (options.githubOutput) {
    appendFileSync(options.githubOutput, `mode=${result.coverage.mode}\n`)
    appendFileSync(
      options.githubOutput,
      `shard_count=${result.coverage.shardCount}\n`,
    )
    appendFileSync(options.githubOutput, `matrix=${JSON.stringify(matrix)}\n`)
  }
  return result
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  runCoveragePlanCli()
