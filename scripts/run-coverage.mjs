#!/usr/bin/env node
import { rmSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const DEFAULT_SHARD_THRESHOLD_SECONDS = 180
const DEFAULT_SHARDS = 1
const BLOB_DIR = '.tmp/coverage-blobs'
const SHARD_COVERAGE_DIR = '.tmp/coverage-shard-reports'

const extraVitestArgs = process.argv.slice(2)

function readPositiveInteger(name, fallback) {
  const value = process.env[name]
  if (value == null || value === '') return fallback
  const parsed = Number.parseInt(value, 10)
  if (Number.isFinite(parsed) && parsed > 0) return parsed

  console.error(`[coverage] ${name} must be a positive integer`)
  process.exit(2)
}

function readPositiveNumber(name, fallback) {
  const value = process.env[name]
  if (value == null || value === '') return fallback
  const parsed = Number.parseFloat(value)
  if (Number.isFinite(parsed) && parsed > 0) return parsed

  console.error(`[coverage] ${name} must be a positive number`)
  process.exit(2)
}

function isEnabled(value) {
  return /^(1|true|yes|on)$/iu.test(String(value ?? ''))
}

function runPnpm(args) {
  console.log(`[coverage] command=pnpm ${args.join(' ')}`)
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) process.exit(result.status ?? 1)
}

function elapsedSeconds(startedAt) {
  return (Date.now() - startedAt) / 1000
}

function logDuration(durationSeconds, thresholdSeconds, mode) {
  console.log(`[coverage] mode=${mode}`)
  console.log(`[coverage] duration-seconds=${durationSeconds.toFixed(1)}`)
  console.log(`[coverage] shard-threshold-seconds=${thresholdSeconds}`)
}

function assertSingleLaneThreshold(durationSeconds, thresholdSeconds) {
  if (
    durationSeconds <= thresholdSeconds
    || isEnabled(process.env.FSUSUI_COVERAGE_ALLOW_OVER_THRESHOLD)
  ) {
    console.log('[coverage] duration-threshold=ok')
    return
  }

  console.error(
    `[coverage] single-lane coverage exceeded ${thresholdSeconds}s; set FSUSUI_COVERAGE_SHARDS>1 so shard blobs are merged before coverage thresholds`,
  )
  process.exit(1)
}

function runSingleLane(thresholdSeconds) {
  const startedAt = Date.now()
  runPnpm(['exec', 'vitest', 'run', '--coverage', ...extraVitestArgs])
  const durationSeconds = elapsedSeconds(startedAt)
  logDuration(durationSeconds, thresholdSeconds, 'single')
  assertSingleLaneThreshold(durationSeconds, thresholdSeconds)
}

function runSharded(shardCount, thresholdSeconds) {
  rmSync(BLOB_DIR, { recursive: true, force: true })
  rmSync(SHARD_COVERAGE_DIR, { recursive: true, force: true })
  mkdirSync(BLOB_DIR, { recursive: true })
  mkdirSync(SHARD_COVERAGE_DIR, { recursive: true })

  const startedAt = Date.now()
  console.log(`[coverage] coverage-shard-count=${shardCount}`)

  for (let index = 1; index <= shardCount; index += 1) {
    const shard = `${index}/${shardCount}`
    console.log(`[coverage] coverage-shard=${shard}`)
    runPnpm([
      'exec',
      'vitest',
      'run',
      '--coverage',
      `--shard=${shard}`,
      '--reporter=default',
      '--reporter=blob',
      `--outputFile.blob=${BLOB_DIR}/blob-${index}-${shardCount}.json`,
      `--coverage.reportsDirectory=${SHARD_COVERAGE_DIR}/shard-${index}`,
      '--coverage.reporter=json',
      '--coverage.thresholds.lines=0',
      '--coverage.thresholds.statements=0',
      '--coverage.thresholds.functions=0',
      '--coverage.thresholds.branches=0',
      ...extraVitestArgs,
    ])
  }

  console.log('[coverage] coverage-merge=before-thresholds')
  runPnpm([
    'exec',
    'vitest',
    '--merge-reports',
    BLOB_DIR,
    '--coverage',
    '--coverage.reportsDirectory=coverage',
  ])

  const durationSeconds = elapsedSeconds(startedAt)
  logDuration(durationSeconds, thresholdSeconds, 'sharded')
  console.log('[coverage] duration-threshold=informational-for-sharded-run')
}

const thresholdSeconds = readPositiveNumber(
  'FSUSUI_COVERAGE_SHARD_THRESHOLD_SECONDS',
  DEFAULT_SHARD_THRESHOLD_SECONDS,
)
const shardCount = readPositiveInteger(
  'FSUSUI_COVERAGE_SHARDS',
  DEFAULT_SHARDS,
)

if (shardCount === 1) {
  runSingleLane(thresholdSeconds)
} else {
  runSharded(shardCount, thresholdSeconds)
}
