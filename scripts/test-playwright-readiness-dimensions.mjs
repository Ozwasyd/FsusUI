#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const gates = JSON.parse(
  readFileSync(path.join(root, 'spec/ci/readiness-gates.json'), 'utf8'),
)
const owners = JSON.parse(
  readFileSync(path.join(root, 'spec/ci/playwright-owners.json'), 'utf8'),
)
const suites = JSON.parse(
  readFileSync(path.join(root, 'spec/ci/playwright-suites.json'), 'utf8'),
)

const required = [
  'playwright-motion',
  'playwright-layout',
  'playwright-boundary',
  'playwright-markdown',
  'playwright-conformance',
  'visual-runtime-reuse',
]
for (const owner of required) {
  assert.ok(
    gates.playwright.ownerIds.includes(owner),
    `${owner} must be a readiness owner`,
  )
  assert.ok(owners.owners[owner], `${owner} must exist in playwright-owners`)
}
assert.ok(gates.owners.visual, 'visual owner must remain')

const suiteList = Array.isArray(suites.suites)
  ? suites.suites
  : Object.values(suites.suites ?? {})
for (const suite of suiteList) {
  assert.ok(suite.id, 'suite id required')
  for (const cell of suite.cells ?? []) {
    assert.ok(cell.dimensions, `${suite.id} cell must have dimensions`)
    assert.ok(
      !('unknown' in (cell.dimensions ?? {})),
      'unknown dimensions are forbidden',
    )
  }
}
assert.equal(Object.keys(owners.owners).length, 6)
console.log(
  'Playwright readiness owners import the registry and keep visual plus six suite owners.',
)
