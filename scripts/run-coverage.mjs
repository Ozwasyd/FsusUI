#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import glob from 'fast-glob'
import {
  assertFinalThresholdResult,
  sha256File,
  validateShardManifests,
} from './coverage-contract.mjs'
import {
  COVERAGE_TEST_PATTERNS,
  countCoverageTestFiles,
  createCoverageMatrix,
  resolveCoveragePlan,
} from './coverage-plan.mjs'
import { serializeCapacityPlan } from './ci-capacity.mjs'

const DEFAULT_RUN_ROOT = '.tmp/coverage-run'
const FINAL_COVERAGE_DIR = 'coverage'
const require = createRequire(import.meta.url)

function enabled(value) {
  return /^(1|true|yes|on)$/iu.test(String(value ?? ''))
}

function command(commandName, args, options = {}) {
  console.log(`[coverage] command=${commandName} ${args.join(' ')}`)
  return new Promise((resolveCommand) => {
    const child = spawn(commandName, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    })
    child.on('error', (error) => {
      console.error(`[coverage] failed to start ${commandName}:`, error)
      resolveCommand(1)
    })
    child.on('close', (code) => resolveCommand(code ?? 1))
  })
}

function repositoryCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}

function digestJson(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function toolchainIdentity() {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  const packageVersion = (name) =>
    JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8'))
      .version
  return {
    node: process.version,
    packageManager: packageJson.packageManager,
    vitest: packageVersion('vitest'),
    coverageV8: packageVersion('@vitest/coverage-v8'),
  }
}

function selectionIdentity(extraArgs) {
  return {
    patterns: COVERAGE_TEST_PATTERNS,
    files: glob.sync(COVERAGE_TEST_PATTERNS, {
      ignore: ['**/node_modules/**'],
    }).sort(),
    extraArgs,
  }
}

function buildIdentities(extraArgs) {
  const toolchain = toolchainIdentity()
  return {
    commitSha: repositoryCommit(),
    configDigest: digestJson({
      vitestConfig: readFileSync('vue/vitest.config.ts', 'utf8'),
      coverageRunner: readFileSync('scripts/run-coverage.mjs', 'utf8'),
    }),
    selectionDigest: digestJson(selectionIdentity(extraArgs)),
    toolchain,
    toolchainDigest: digestJson(toolchain),
  }
}

function pathsForShard(runRoot, index, total) {
  const name = `shard-${index}-${total}`
  return {
    blobPath: join('blobs', `${name}.json`),
    coverageDirectory: join('fragments', name),
    manifestPath: join('manifests', `${name}.json`),
  }
}

function prepareRunRoot(runRoot) {
  rmSync(runRoot, { recursive: true, force: true })
  mkdirSync(join(runRoot, 'blobs'), { recursive: true })
  mkdirSync(join(runRoot, 'fragments'), { recursive: true })
  mkdirSync(join(runRoot, 'manifests'), { recursive: true })
}

function vitestShardArgs(entry, paths, extraArgs) {
  return [
    'exec',
    'vitest',
    'run',
    '--config',
    'vue/vitest.config.ts',
    '--coverage',
    `--shard=${entry.shard}`,
    '--reporter=default',
    '--reporter=blob',
    `--outputFile.blob=${paths.blobPath}`,
    `--coverage.reportsDirectory=${paths.coverageDirectory}`,
    '--coverage.reporter=json',
    '--coverage.thresholds.lines=0',
    '--coverage.thresholds.statements=0',
    '--coverage.thresholds.functions=0',
    '--coverage.thresholds.branches=0',
    ...extraArgs,
  ]
}

async function runShard({ entry, runRoot, plan, identities, extraArgs }) {
  const paths = pathsForShard(runRoot, entry.index, entry.total)
  const absolute = {
    blobPath: resolve(runRoot, paths.blobPath),
    coverageDirectory: resolve(runRoot, paths.coverageDirectory),
    manifestPath: resolve(runRoot, paths.manifestPath),
  }
  mkdirSync(absolute.coverageDirectory, { recursive: true })
  const startedAt = Date.now()
  console.log(
    `[coverage] coverage-shard=${entry.shard} workers=${entry.workers}`,
  )
  const exitCode = await command(
    'pnpm',
    vitestShardArgs(entry, absolute, extraArgs),
    {
      env: {
        ...process.env,
        FSUS_CI_CAPACITY_PLAN: serializeCapacityPlan(plan.capacity),
        FSUS_NODE_HEAP_PROFILE: 'coverage',
        FSUS_VITEST_WORKERS: String(entry.workers),
      },
    },
  )
  if (exitCode !== 0) return exitCode

  const fragment = join(absolute.coverageDirectory, 'coverage-final.json')
  const durationSeconds = (Date.now() - startedAt) / 1000
  const manifest = {
    schemaVersion: 1,
    index: entry.index,
    total: entry.total,
    shard: entry.shard,
    commitSha: identities.commitSha,
    configDigest: identities.configDigest,
    selectionDigest: identities.selectionDigest,
    selectionArgs: extraArgs,
    toolchain: identities.toolchain,
    toolchainDigest: identities.toolchainDigest,
    blobPath: paths.blobPath,
    blobDigest: sha256File(absolute.blobPath),
    coverageFragmentPath: join(paths.coverageDirectory, 'coverage-final.json'),
    coverageFragmentDigest: sha256File(fragment),
    durationSeconds,
    peakMemoryMiB: null,
    workers: entry.workers,
    thresholdSeconds: plan.coverage.thresholdSeconds,
    durationBudgetSeconds: plan.coverage.durationBudgetSeconds,
    thresholdsApplied: false,
  }
  writeFileSync(absolute.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`[coverage] shard-manifest=${absolute.manifestPath}`)
  return 0
}

function readManifests(runRoot) {
  const directory = join(runRoot, 'manifests')
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')))
}

async function mergeCoverage(runRoot, options = {}) {
  const manifests = readManifests(runRoot)
  const expectedIdentity = buildIdentities(manifests[0]?.selectionArgs ?? [])
  const validation = validateShardManifests(manifests, {
    rootDir: runRoot,
    expectedIdentity,
    durationBudgetSeconds: options.durationBudgetSeconds,
    allowOverThreshold: enabled(
      process.env.FSUSUI_COVERAGE_ALLOW_OVER_THRESHOLD,
    ),
  })
  rmSync(FINAL_COVERAGE_DIR, { recursive: true, force: true })
  console.log('[coverage] coverage-merge=before-thresholds')
  console.log('[coverage] final-threshold-evaluation=once')
  const exitCode = await command('pnpm', [
    'exec',
    'vitest',
    '--config',
    'vue/vitest.config.ts',
    '--merge-reports',
    resolve(runRoot, 'blobs'),
    '--coverage',
    `--coverage.reportsDirectory=${resolve(FINAL_COVERAGE_DIR)}`,
  ])
  assertFinalThresholdResult(exitCode)
  const mergeManifest = {
    schemaVersion: 1,
    commitSha: validation.reference.commitSha,
    configDigest: validation.reference.configDigest,
    selectionDigest: validation.reference.selectionDigest,
    shardCount: validation.total,
    thresholdsApplied: true,
    thresholdExitCode: exitCode,
    mergedAt: new Date().toISOString(),
  }
  writeFileSync(
    join(runRoot, 'merge-manifest.json'),
    `${JSON.stringify(mergeManifest, null, 2)}\n`,
  )
  return mergeManifest
}

function assertDuration(
  durationSeconds,
  schedulingTargetSeconds,
  durationBudgetSeconds,
) {
  console.log(`[coverage] duration-seconds=${durationSeconds.toFixed(1)}`)
  console.log(`[coverage] scheduling-target-seconds=${schedulingTargetSeconds}`)
  if (durationSeconds > schedulingTargetSeconds)
    console.log('[coverage] scheduling-signal=consider-parallel-shards')
  if (durationBudgetSeconds === undefined) {
    console.log('[coverage] duration-budget=not-configured')
    return
  }
  console.log(`[coverage] duration-budget-seconds=${durationBudgetSeconds}`)
  if (
    durationSeconds <= durationBudgetSeconds ||
    enabled(process.env.FSUSUI_COVERAGE_ALLOW_OVER_THRESHOLD)
  ) {
    console.log('[coverage] duration-threshold=ok')
    return
  }
  throw new Error(`coverage exceeded duration budget ${durationBudgetSeconds}s`)
}

async function runSingle(plan, extraArgs) {
  rmSync(FINAL_COVERAGE_DIR, { recursive: true, force: true })
  const startedAt = Date.now()
  console.log('[coverage] mode=single')
  console.log('[coverage] final-threshold-evaluation=once')
  const exitCode = await command(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      '--config',
      'vue/vitest.config.ts',
      '--coverage',
      ...extraArgs,
    ],
    {
      env: {
        ...process.env,
        FSUS_CI_CAPACITY_PLAN: serializeCapacityPlan(plan.capacity),
        FSUS_NODE_HEAP_PROFILE: 'coverage',
        FSUS_VITEST_WORKERS: String(plan.coverage.workersPerShard),
      },
    },
  )
  assertFinalThresholdResult(exitCode)
  assertDuration(
    (Date.now() - startedAt) / 1000,
    plan.coverage.thresholdSeconds,
    plan.coverage.durationBudgetSeconds,
  )
}

function shardEntryFromEnvironment(plan) {
  const index = Number(process.env.FSUSUI_COVERAGE_SHARD_INDEX)
  const total = Number(process.env.FSUSUI_COVERAGE_SHARD_TOTAL)
  if (!Number.isInteger(index) && !Number.isInteger(total)) return undefined
  if (
    !Number.isInteger(index) ||
    !Number.isInteger(total) ||
    index < 1 ||
    index > total
  )
    throw new Error(
      'FSUSUI_COVERAGE_SHARD_INDEX/TOTAL must describe one valid shard',
    )
  if (total !== plan.coverage.shardCount)
    throw new Error(
      `CI shard total ${total} does not match capacity plan ${plan.coverage.shardCount}`,
    )
  return {
    index,
    total,
    shard: `${index}/${total}`,
    workers: plan.coverage.workersPerShard,
  }
}

async function runCoverage(extraArgs) {
  const plan = resolveCoveragePlan(process.env, {
    testFileCount: countCoverageTestFiles(),
  })
  const externalShard = shardEntryFromEnvironment(plan)
  console.log(
    `[coverage] mode=${externalShard ? 'ci-shard' : plan.coverage.mode}`,
  )
  console.log(`[coverage] coverage-shard-count=${plan.coverage.shardCount}`)
  for (const reason of plan.coverage.reasons)
    console.log(`[coverage] ${reason}`)
  if (!externalShard && plan.coverage.shardCount === 1)
    return runSingle(plan, extraArgs)

  const runRoot = resolve(
    process.env.FSUSUI_COVERAGE_RUN_ROOT ?? DEFAULT_RUN_ROOT,
  )
  if (!externalShard) prepareRunRoot(runRoot)
  else {
    mkdirSync(join(runRoot, 'blobs'), { recursive: true })
    mkdirSync(join(runRoot, 'fragments'), { recursive: true })
    mkdirSync(join(runRoot, 'manifests'), { recursive: true })
  }
  const identities = buildIdentities(extraArgs)
  if (externalShard)
    return (process.exitCode = await runShard({
      entry: externalShard,
      runRoot,
      plan,
      identities,
      extraArgs,
    }))

  const startedAt = Date.now()
  const statuses = await Promise.all(
    createCoverageMatrix(plan.coverage).map((entry) =>
      runShard({ entry, runRoot, plan, identities, extraArgs }),
    ),
  )
  if (statuses.some((status) => status !== 0))
    throw new Error('one or more parallel coverage shards failed')
  await mergeCoverage(runRoot, {
    durationBudgetSeconds: plan.coverage.durationBudgetSeconds,
  })
  assertDuration(
    (Date.now() - startedAt) / 1000,
    plan.coverage.thresholdSeconds,
    plan.coverage.durationBudgetSeconds,
  )
}

function usage() {
  console.error('usage: run-coverage.mjs run [vitest args] | merge <blob-dir>')
}

export async function runCoverageCli(argv = process.argv.slice(2)) {
  const [subcommand = 'run', ...args] = argv
  if (subcommand === 'run') return runCoverage(args)
  if (subcommand === 'merge') {
    if (args.length !== 1) {
      usage()
      throw new Error('coverage merge requires exactly one blob directory')
    }
    return mergeCoverage(resolve(args[0]))
  }
  usage()
  throw new Error(`unknown coverage command: ${subcommand}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    await runCoverageCli()
  } catch (error) {
    console.error(
      `[coverage] ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  }
}
