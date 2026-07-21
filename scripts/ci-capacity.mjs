#!/usr/bin/env node

import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import glob from 'fast-glob'
import capacity from './ci-capacity.cjs'

export const {
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
} = capacity

export function countUnitTestFiles() {
  return glob.sync(
    [
      'vue/packages/**/__tests__/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}',
      'vue/tests/boundary/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}',
    ],
    { ignore: ['**/node_modules/**'] },
  ).length
}

function parseArguments(argv) {
  const options = { dryRun: false, check: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dry-run') options.dryRun = true
    else if (argument === '--check') options.check = true
    else if (argument === '--fixture') options.fixture = argv[(index += 1)]
    else if (argument.startsWith('--github-output='))
      options.githubOutput = argument.slice('--github-output='.length)
    else throw new Error(`unknown CI capacity argument: ${argument}`)
  }
  return options
}

export function runCapacityCli(
  argv = process.argv.slice(2),
  env = process.env,
) {
  const options = parseArguments(argv)
  if (!options.dryRun && !options.check)
    throw new Error('ci-capacity requires --dry-run or --check')
  const snapshot = options.fixture
    ? JSON.parse(readFileSync(options.fixture, 'utf8'))
    : probeCapacityHost()
  const plan = createCapacityPlan(snapshot, env, {
    unitTestFileCount: countUnitTestFiles(),
  })
  validateCapacityPlan(plan)
  process.stdout.write(
    `${JSON.stringify(plan, null, 2)}\n${formatCapacitySummary(plan)}\n`,
  )
  if (options.githubOutput) {
    appendFileSync(
      options.githubOutput,
      `unit-matrix=${JSON.stringify({ include: createUnitMatrix(plan) })}\n`,
    )
  }
  return plan
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runCapacityCli()
}
