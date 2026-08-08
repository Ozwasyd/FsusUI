#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
} from './layout-playwright-plan.mjs'
import {
  loadPlaywrightSuiteRegistry,
  validatePlaywrightSuiteRegistry,
} from './playwright-suites.mjs'
import {
  MARKDOWN_FIXED_CELLS,
  MARKDOWN_FIXED_NAMESPACES,
  MARKDOWN_OWNER,
  loadMarkdownOwnerPlan,
} from './markdown-playwright-plan.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readSync = (relative) => readFileSync(resolve(root, relative), 'utf8')

const workflowJob = (source, name) =>
  source.match(
    new RegExp(
      `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z][\\w-]*:\\n|$)`,
      'u',
    ),
  )?.[1] ?? ''

const occurrences = (value, fragment) =>
  value.split(fragment).length - 1

const validateMarkdownWorkflowSource = (source) => {
  const failures = []
  if (!source.includes('playwright-markdown:')) {
    failures.push('reusable workflow must define a playwright-markdown job')
    return failures
  }
  const job = workflowJob(source, 'playwright-markdown')
  if (!job) {
    failures.push('cannot extract playwright-markdown job')
    return failures
  }
  if (/\n\s+(?:strategy|matrix):/u.test(job)) {
    failures.push('playwright-markdown job must not use strategy/matrix')
  }
  if (!job.includes('markdown-playwright-owner-run.mjs')) {
    failures.push('playwright-markdown job must run markdown-playwright-owner-run.mjs')
  }
  if (job.includes('pnpm test:markdown-editor:interaction')) {
    failures.push('playwright-markdown job must not invoke full-config suite commands')
  }
  if (occurrences(job, 'playwright install --with-deps chromium') !== 1) {
    failures.push('playwright-markdown job must install exactly one fixed Chromium')
  }
  if (occurrences(job, 'playwright install --with-deps firefox') !== 1) {
    failures.push('playwright-markdown job must install Firefox for non-PR groups')
  }
  if (occurrences(job, 'playwright install --with-deps webkit') !== 1) {
    failures.push('playwright-markdown job must install WebKit for non-PR groups')
  }
  if (occurrences(job, "inputs.group != 'pr'") < 2) {
    failures.push('Firefox/WebKit installs must be gated on group != pr')
  }
  if (!job.includes('playwright-markdown-evidence-${{ inputs.group }}')) {
    failures.push('playwright-markdown job must upload per-group evidence')
  }
  return failures
}

const deepClone = (value) => JSON.parse(JSON.stringify(value))

const registry = loadPlaywrightSuiteRegistry()
const owners = loadPlaywrightOwners()
validatePlaywrightSuiteRegistry(registry)

for (const group of ['main', 'nightly', 'release']) {
  const plan = loadMarkdownOwnerPlan(group)
  assert.deepEqual(plan.cells.map((cell) => cell.id), [...MARKDOWN_FIXED_CELLS])
  assert.deepEqual(
    plan.cells.map((cell) => cell.artifactNamespace),
    MARKDOWN_FIXED_CELLS.map((cellId) => MARKDOWN_FIXED_NAMESPACES[cellId]),
    `${group} artifact namespaces must match the fixed issue namespace`,
  )
  for (const cell of plan.cells) {
    const projectFlags = cell.command.match(/--project=\S+/gu) ?? []
    assert.equal(projectFlags.length, 1, `${cell.id} must target exactly one project`)
    assert.ok(!/npm-run-all|\brun-[ps]\b/u.test(cell.command), `${cell.id} must not use npm-run-all passthrough`)
    assert.equal(
      cell.command.startsWith('pnpm exec playwright test --config='),
      true,
      `${cell.id} must invoke Playwright directly via pnpm exec`,
    )
  }
}

const reusableWorkflow = readSync('.github/workflows/_quality-playwright.yml')
const topWorkflow = readSync('.github/workflows/quality.yml')
const markdownWorkflowFailures = validateMarkdownWorkflowSource(reusableWorkflow)
assert.deepEqual(
  markdownWorkflowFailures,
  [],
  `_quality-playwright.yml markdown policy failures: ${markdownWorkflowFailures.join('; ')}`,
)

for (const job of ['premerge-playwright', 'main-playwright', 'nightly-playwright', 'release-playwright']) {
  assert.ok(topWorkflow.includes(`${job}:`), `quality.yml must define ${job}`)
}

// ---- Negative workflow fixtures ----

expectFailure('missing firefox cell must fail policy', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'markdown-editor-interaction')
  suite.cells = suite.cells.filter((cell) => cell.project !== 'firefox')
  const plan = planOwnerCells(MARKDOWN_OWNER, 'main', mutated, owners)
  assertOwnerFixedCells(plan, [...MARKDOWN_FIXED_CELLS])
})

expectFailure('missing webkit cell must fail policy', () => {
  const mutated = deepClone(registry)
  const suite = mutated.suites.find((entry) => entry.id === 'markdown-editor-interaction')
  suite.cells = suite.cells.filter((cell) => cell.project !== 'webkit')
  const plan = planOwnerCells(MARKDOWN_OWNER, 'main', mutated, owners)
  assertOwnerFixedCells(plan, [...MARKDOWN_FIXED_CELLS])
})

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

console.log('[check-playwright-markdown-owner-policy] passed')
