#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  resolveVisualCapacityPlan,
  serializeVisualCapacityPlan,
} from './visual-capacity.mjs'

const titlePattern = /^ui audit retry contract \/ bucket (\d+) of (\d+)$/u

export function createVisualAuditRetryEnvironment(baseEnvironment, overrides) {
  const environment = { ...baseEnvironment, ...overrides }
  // Playwright enables FORCE_COLOR for its workers and web server. Do not
  // forward the mutually exclusive NO_COLOR flag into those subprocesses.
  delete environment.NO_COLOR
  return environment
}

export function validateVisualAuditRetryResults(results) {
  assert.ok(Array.isArray(results), 'retry report must be an array')
  const byBucket = new Map()
  for (const result of results) {
    const match = String(result.title).match(titlePattern)
    assert.ok(match, `unexpected retry contract title: ${result.title}`)
    const bucket = Number(match[1])
    const total = Number(match[2])
    assert.equal(total, 2, 'retry contract must exercise exactly two buckets')
    const attempts = byBucket.get(bucket) ?? []
    attempts.push(result)
    byBucket.set(bucket, attempts)
  }

  assert.deepEqual([...byBucket.keys()].sort(), [1, 2])
  const injected = byBucket
    .get(1)
    .sort((left, right) => left.retry - right.retry)
  const unaffected = byBucket.get(2)
  assert.deepEqual(
    injected.map(({ retry, status }) => ({ retry, status })),
    [
      { retry: 0, status: 'failed' },
      { retry: 1, status: 'passed' },
    ],
    'only the injected bucket must retry once',
  )
  assert.deepEqual(
    unaffected.map(({ retry, status }) => ({ retry, status })),
    [{ retry: 0, status: 'passed' }],
    'the unaffected bucket must run exactly once',
  )

  const firstAttempts = [injected[0], unaffected[0]]
  assert.notEqual(
    firstAttempts[0].parallelIndex,
    firstAttempts[1].parallelIndex,
    'first attempts must occupy distinct Playwright workers',
  )
  const starts = firstAttempts.map((result) => Date.parse(result.startTime))
  const ends = firstAttempts.map(
    (result, index) => starts[index] + result.durationMs,
  )
  assert.ok(
    Math.max(...starts) < Math.min(...ends),
    'first-attempt bucket intervals must overlap',
  )
  return { bucketCount: byBucket.size, resultCount: results.length }
}

const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    cwd: process.cwd(),
    env: options.env ?? process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })

async function main() {
  const capacityPlan = resolveVisualCapacityPlan()
  if (capacityPlan.previewWorkers < 2) {
    throw new Error(
      'UI audit retry browser contract requires capacity for two preview workers',
    )
  }

  const preparation = run('pnpm', ['run', 'visual:prepare'])
  if (preparation.status !== 0) {
    throw new Error(
      `visual runtime preparation exited with ${preparation.status}`,
    )
  }

  const reportRoot = mkdtempSync(join(tmpdir(), 'fsusui-audit-retry-'))
  const reportPath = join(reportRoot, 'attempts.json')
  try {
    const execution = run(
      'pnpm',
      [
        'exec',
        'playwright',
        'test',
        '--config=vue/playwright.audit-retry.config.ts',
      ],
      {
        env: createVisualAuditRetryEnvironment(process.env, {
          FSUS_VISUAL_AUDIT_RETRY_REPORT: reportPath,
          FSUS_VISUAL_CAPACITY_PLAN: serializeVisualCapacityPlan(capacityPlan),
          FSUS_VISUAL_PROFILE: 'audit-retry-contract',
          FSUS_VISUAL_SHARD: 'local',
        }),
      },
    )
    if (execution.status !== 0) {
      throw new Error(
        `audit retry Playwright run exited with ${execution.status}`,
      )
    }
    const summary = validateVisualAuditRetryResults(
      JSON.parse(readFileSync(reportPath, 'utf8')),
    )
    console.log(
      `[visual-audit-retry] buckets=${summary.bucketCount} attempts=${summary.resultCount} isolated-retry=passed`,
    )
  } finally {
    rmSync(reportRoot, { force: true, recursive: true })
  }
}

const isMain =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (isMain) {
  main().catch((error) => {
    console.error(
      `[visual-audit-retry] ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  })
}
