#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  loadPlaywrightSuiteRegistry,
  planPlaywrightSuites,
  validatePlaywrightSuiteRegistry,
} from './playwright-suites.mjs'

const root = process.cwd()
const deepClone = (value) => JSON.parse(JSON.stringify(value))

function expectFailure(label, fn) {
  let failed = false
  let message = ''
  try {
    fn()
  } catch (error) {
    failed = true
    message = error instanceof Error ? error.message : String(error)
  }
  assert.equal(failed, true, `${label}: expected failure`)
  assert.ok(message.length > 0, `${label}: empty error`)
}

const registry = loadPlaywrightSuiteRegistry()
validatePlaywrightSuiteRegistry(registry)

const releasePlan = planPlaywrightSuites('release', registry)
assert.equal(releasePlan.suites.length, 8)
assert.equal(releasePlan.runBinding, 'current-workflow-run')
assert.ok(releasePlan.digest)

assert.equal(planPlaywrightSuites('main', registry).suites.length, 8)
assert.equal(planPlaywrightSuites('pr', registry).suites.length, 4)
assert.equal(planPlaywrightSuites('nightly', registry).suites.length, 8)

const reuse = registry.suites.find(
  (suite) => suite.id === 'visual-runtime-reuse',
)
assert.equal(reuse.countsTowardProductBrowserCoverage, false)
assert.equal(reuse.runtime, 'runtime-contract')

for (const suite of registry.suites) {
  for (const cell of suite.cells) {
    assert.ok(cell.dimensions.browser, `${cell.id} missing browser`)
    assert.equal(
      cell.dimensions.browser.includes('-'),
      false,
      `${cell.id} composite browser ${cell.dimensions.browser}`,
    )
  }
}

// Fixed eight suite ids
assert.deepEqual(registry.suites.map((suite) => suite.id).sort(), [
  'dom-layout',
  'geometry-smoke',
  'markdown-editor-interaction',
  'motion-ssr',
  'view-transitions',
  'visual-boundary-audit',
  'visual-runtime-reuse',
  'web-interaction-conformance',
])

// --- Negative fixtures (mutate in-memory registry) ---

expectFailure('delete webkit cell', () => {
  const next = deepClone(registry)
  const suite = next.suites.find((entry) => entry.id === 'view-transitions')
  suite.cells = suite.cells.filter((cell) => cell.project !== 'webkit')
  validatePlaywrightSuiteRegistry(next, root)
})

expectFailure('desktop-dark as browser', () => {
  const next = deepClone(registry)
  const suite = next.suites.find((entry) => entry.id === 'dom-layout')
  suite.cells[0].dimensions.browser = 'desktop-dark'
  validatePlaywrightSuiteRegistry(next, root)
})

expectFailure('config project rename drift', () => {
  const next = deepClone(registry)
  const suite = next.suites.find((entry) => entry.id === 'view-transitions')
  suite.cells[2].project = 'safari'
  validatePlaywrightSuiteRegistry(next, root)
})

expectFailure('command package.json mismatch', () => {
  const next = deepClone(registry)
  const suite = next.suites.find((entry) => entry.id === 'geometry-smoke')
  suite.command = 'pnpm totally-missing-script'
  validatePlaywrightSuiteRegistry(next, root)
})

expectFailure('duplicate artifact namespace', () => {
  const next = deepClone(registry)
  next.suites[1].artifacts.namespace = next.suites[0].artifacts.namespace
  validatePlaywrightSuiteRegistry(next, root)
})

expectFailure('release unknown suite', () => {
  const next = deepClone(registry)
  next.profiles.release.suiteIds = [
    ...next.profiles.release.suiteIds,
    'not-a-suite',
  ]
  validatePlaywrightSuiteRegistry(next, root)
})

expectFailure('chromium-only without browser', () => {
  const next = deepClone(registry)
  const suite = next.suites.find((entry) => entry.id === 'geometry-smoke')
  delete suite.cells[0].dimensions.browser
  validatePlaywrightSuiteRegistry(next, root)
})

expectFailure('reuse counted as product coverage', () => {
  const next = deepClone(registry)
  const suite = next.suites.find((entry) => entry.id === 'visual-runtime-reuse')
  suite.countsTowardProductBrowserCoverage = true
  validatePlaywrightSuiteRegistry(next, root)
})

expectFailure('empty cells', () => {
  const next = deepClone(registry)
  const suite = next.suites.find((entry) => entry.id === 'motion-ssr')
  suite.cells = []
  validatePlaywrightSuiteRegistry(next, root)
})

console.log('[playwright-suites] fixtures ok')
