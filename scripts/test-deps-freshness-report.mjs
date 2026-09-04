#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { writeFreshnessReport } from './deps-freshness-report.mjs'

const directory = mkdtempSync(path.join(tmpdir(), 'fsusui-freshness-report-'))
const report = {
  schemaVersion: 1,
  generatedAt: '2026-08-30T00:00:00.000Z',
  requiredChecks: ['pr-fast', 'pr-real-render-performance'],
  results: [
    {
      dependencyId: 'npm-vue',
      datasource: 'npm',
      packageName: 'vue',
      currentVersion: '3.5.0',
      targetVersion: '3.6.0',
      state: 'latest-target-pr',
      pullRequests: [{ number: 412, superseding: false }],
      exception: null,
      blockerReasons: [],
    },
  ],
  errors: [],
  summary: { total: 1 },
}

try {
  writeFreshnessReport('nested/result.json', report, directory)
  const actual = JSON.parse(
    readFileSync(path.join(directory, 'nested/result.json'), 'utf8'),
  )
  assert.deepEqual(actual, report)
  assert.deepEqual(Object.keys(actual.results[0]), [
    'dependencyId',
    'datasource',
    'packageName',
    'currentVersion',
    'targetVersion',
    'state',
    'pullRequests',
    'exception',
    'blockerReasons',
  ])
} finally {
  rmSync(directory, { recursive: true })
}

console.log('Dependency freshness structured report transport passed.')
