import assert from 'node:assert/strict'
import fs from 'node:fs'
import { registry, validatePlaywrightRegistry } from './playwright-suites-contract.mjs'

const clone = (value) => structuredClone(value)
const cases = JSON.parse(fs.readFileSync('tests/fixtures/playwright-registry/invalid-cases.json', 'utf8'))
const mutate = {
  'delete-webkit': (value) => value.suites.find((suite) => suite.id === 'view-transitions').cells.pop(),
  'browser-is-project': (value) => { value.suites.find((suite) => suite.id === 'dom-layout').cells[0].browser = 'desktop-light' },
  'project-renamed': (value) => { value.suites.find((suite) => suite.id === 'dom-layout').cells[0].project = 'desktop-bright' },
  'command-drift': (value) => { value.suites.find((suite) => suite.id === 'motion-ssr').command = 'pnpm test:view-transitions' },
  'namespace-collision': (value) => { value.suites.find((suite) => suite.id === 'geometry-smoke').artifacts.namespace = 'playwright-layout-dom-{project}' },
  'unknown-profile': (value) => value.suites.find((suite) => suite.id === 'motion-ssr').profiles.push('future'),
  'missing-browser': (value) => { delete value.suites.find((suite) => suite.id === 'geometry-smoke').cells[0].browser },
  'reuse-browser-coverage': (value) => { value.suites.find((suite) => suite.id === 'visual-runtime-reuse').coverageKind = 'browser-compatibility' },
  'empty-cells': (value) => { value.suites.find((suite) => suite.id === 'motion-ssr').cells = [] },
}

validatePlaywrightRegistry(registry)
for (const testCase of cases) {
  const candidate = clone(registry)
  mutate[testCase.mutation](candidate)
  assert.throws(() => validatePlaywrightRegistry(candidate), new RegExp(testCase.expected, 'iu'), testCase.name)
}
console.log(`[playwright-registry-fixtures] valid=1 invalid=${cases.length}`)
