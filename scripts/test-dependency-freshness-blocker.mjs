#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BLOCKER_ISSUE_TITLE,
  BLOCKER_LABEL,
  reconcileFreshnessReport,
} from './dependency-freshness-blocker-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const clone = (value) => structuredClone(value)
const cases = JSON.parse(
  readFileSync(
    path.join(root, 'tests/fixtures/dependencies/freshness-blocker-cases.json'),
    'utf8',
  ),
)

function dependency(id, overrides = {}) {
  return {
    dependencyId: id,
    datasource: 'npm',
    packageName: id,
    currentVersion: '1.0.0',
    targetVersion: '2.0.0',
    state: 'stale',
    pullRequests: [],
    exception: null,
    ...overrides,
  }
}

function report(generatedAt, results, errors = []) {
  return {
    schemaVersion: 1,
    generatedAt,
    requiredChecks: ['pr-fast', 'pr-real-render-performance'],
    results,
    errors,
  }
}

class MemoryGithub {
  constructor() {
    this.issues = []
    this.labels = new Map()
    this.operations = []
    this.nextIssue = 100
    this.clock = 0
    this.permissionError = null
    this.listError = null
    this.writeError = null
  }

  timestamp() {
    this.clock += 1
    return new Date(Date.UTC(2026, 0, 1, 0, 0, this.clock)).toISOString()
  }

  async assertWritable() {
    if (this.permissionError) throw this.permissionError
  }

  async listIssuesByTitle(title) {
    if (this.listError) throw this.listError
    return clone(this.issues.filter((issue) => issue.title === title))
  }

  async createIssue(fields) {
    if (this.writeError) throw this.writeError
    const issue = {
      number: this.nextIssue++,
      state: 'open',
      updatedAt: this.timestamp(),
      ...fields,
    }
    this.issues.push(issue)
    this.operations.push({ action: 'create-issue', number: issue.number })
    return clone(issue)
  }

  async updateIssue(number, fields) {
    if (this.writeError) throw this.writeError
    const issue = this.issues.find((entry) => entry.number === number)
    assert.ok(issue, `missing issue #${number}`)
    Object.assign(issue, fields, { updatedAt: this.timestamp() })
    this.operations.push({ action: 'update-issue', number, fields })
    return clone(issue)
  }

  async setPullRequestLabel(number, label, action) {
    const labels = this.labels.get(number) ?? new Set()
    if (action === 'add') labels.add(label)
    else labels.delete(label)
    this.labels.set(number, labels)
    this.operations.push({ action: `${action}-label`, number, label })
  }
}

async function lifecycleTransitions() {
  const github = new MemoryGithub()
  const initial = report('2026-08-30T00:00:00.000Z', [dependency('npm-z')])
  const created = await reconcileFreshnessReport({
    report: initial,
    client: github,
  })
  assert.equal(created.action, 'created')
  assert.equal(github.issues.length, 1)
  assert.equal(github.issues[0].state, 'open')
  const issueNumber = github.issues[0].number
  const initialBody = github.issues[0].body

  const rerun = await reconcileFreshnessReport({
    report: initial,
    client: github,
  })
  assert.equal(rerun.action, 'updated')
  assert.equal(github.issues.length, 1, 'idempotent update must not duplicate')
  assert.equal(github.issues[0].body, initialBody, 'content must be stable')

  const recovered = report('2026-08-30T01:00:00.000Z', [
    dependency('npm-z', {
      currentVersion: '2.0.0',
      targetVersion: '2.0.0',
      state: 'current',
    }),
  ])
  const closed = await reconcileFreshnessReport({
    report: recovered,
    client: github,
  })
  assert.equal(closed.action, 'closed')
  assert.equal(github.issues[0].state, 'closed')
  assert.match(github.issues[0].body, /2026-08-30T01:00:00\.000Z/u)

  const afterRecovery = clone(github.operations)
  await assert.rejects(
    reconcileFreshnessReport({
      report: report('2026-08-30T00:30:00.000Z', [dependency('npm-old')]),
      client: github,
    }),
    /older than applied result/u,
  )
  assert.deepEqual(github.operations, afterRecovery)

  const returned = report('2026-08-30T02:00:00.000Z', [dependency('npm-z')])
  await reconcileFreshnessReport({ report: returned, client: github })
  assert.equal(github.issues.length, 1, 'reappearance must reuse the issue')
  assert.equal(github.issues[0].number, issueNumber)
  assert.equal(github.issues[0].state, 'open')
  assert.match(github.issues[0].body, /2026-08-30T00:00:00\.000Z/u)
}

async function stableContentAndSupersedingPullRequest() {
  const github = new MemoryGithub()
  const input = clone(cases.positive)
  await reconcileFreshnessReport({ report: input, client: github })
  const body = github.issues[0].body
  assert.ok(body.indexOf('a-package') < body.indexOf('z-package'))
  assert.match(body, /#42.*superseding/u)
  assert.match(body, /@release-owner \/ 2026-09-01T00:00:00Z/u)
  assert.match(body, /1\.0\.0 → 2\.0\.0/u)
  assert.match(body, /nuget/u)
}

async function overdueAndRecoveredRequiredChecks() {
  const github = new MemoryGithub()
  const pullRequest = {
    number: 77,
    url: 'https://example.invalid/pull/77',
    state: 'OPEN',
    createdAt: '2026-08-28T00:00:00Z',
    superseding: false,
    labels: [],
    checks: [
      {
        name: 'pr-fast',
        conclusion: 'failure',
        completedAt: '2026-08-28T01:00:00Z',
      },
      {
        name: 'pr-real-render-performance',
        conclusion: 'success',
        completedAt: '2026-08-28T01:00:00Z',
      },
    ],
  }
  await reconcileFreshnessReport({
    report: report('2026-08-30T06:00:00.000Z', [
      dependency('npm-checks', {
        state: 'latest-target-pr',
        pullRequests: [pullRequest],
      }),
    ]),
    client: github,
  })
  assert.ok(github.labels.get(77).has(BLOCKER_LABEL))
  assert.match(github.issues[0].body, /pr-fast \(failure\)/u)

  await reconcileFreshnessReport({
    report: report('2026-08-30T07:00:00.000Z', [
      dependency('npm-checks', {
        currentVersion: '2.0.0',
        targetVersion: '2.0.0',
        state: 'current',
        pullRequests: [
          {
            ...pullRequest,
            labels: [BLOCKER_LABEL],
            checks: pullRequest.checks.map((check) => ({
              ...check,
              conclusion: 'success',
            })),
          },
        ],
      }),
    ]),
    client: github,
  })
  assert.equal(github.labels.get(77).has(BLOCKER_LABEL), false)
  assert.equal(github.issues[0].state, 'closed')
}

async function failuresAreFailClosed() {
  for (const fixture of cases.negative) {
    const github = new MemoryGithub()
    await assert.rejects(
      reconcileFreshnessReport({
        report: clone(fixture.report),
        client: github,
      }),
      new RegExp(fixture.expected, 'u'),
    )
    assert.deepEqual(github.operations, [])
  }

  const permission = new MemoryGithub()
  permission.permissionError = new Error('permission denied')
  await assert.rejects(
    reconcileFreshnessReport({
      report: report('2026-08-30T00:00:00.000Z', [dependency('npm-a')]),
      client: permission,
    }),
    /permission denied/u,
  )
  assert.deepEqual(permission.operations, [])

  const writePermission = new MemoryGithub()
  await reconcileFreshnessReport({
    report: report('2026-08-30T00:00:00.000Z', [dependency('npm-a')]),
    client: writePermission,
  })
  writePermission.writeError = new Error('issue write permission denied')
  await assert.rejects(
    reconcileFreshnessReport({
      report: report('2026-08-30T01:00:00.000Z', [
        dependency('npm-a', {
          currentVersion: '2.0.0',
          targetVersion: '2.0.0',
          state: 'current',
        }),
      ]),
      client: writePermission,
    }),
    /write permission denied/u,
  )
  assert.equal(
    writePermission.issues[0].state,
    'open',
    'write permission failure must not falsely close the blocker issue',
  )

  const api = new MemoryGithub()
  api.listError = new Error('GitHub API unavailable')
  await assert.rejects(
    reconcileFreshnessReport({
      report: report('2026-08-30T00:00:00.000Z', [dependency('npm-a')]),
      client: api,
    }),
    /GitHub API unavailable/u,
  )
  assert.deepEqual(api.operations, [])
}

async function concurrencyAndStaleWrites() {
  const github = new MemoryGithub()
  const first = report('2026-08-30T12:00:00.000Z', [dependency('npm-a')])
  const concurrent = await Promise.allSettled([
    reconcileFreshnessReport({ report: first, client: github }),
    reconcileFreshnessReport({ report: first, client: github }),
  ])
  assert.ok(
    concurrent.some((result) => result.status === 'fulfilled'),
    'at least one concurrent run must apply the result',
  )
  for (const result of concurrent.filter(
    (entry) => entry.status === 'rejected',
  )) {
    assert.match(result.reason.message, /concurrently|stale/u)
  }
  assert.equal(
    github.issues.filter(
      (issue) => issue.title === BLOCKER_ISSUE_TITLE && issue.state === 'open',
    ).length,
    1,
  )

  const before = clone(github.operations)
  await assert.rejects(
    reconcileFreshnessReport({
      report: report('2026-08-30T11:59:59.000Z', [dependency('npm-old')]),
      client: github,
    }),
    /older than applied result/u,
  )
  assert.deepEqual(
    github.operations,
    before,
    'stale result must perform no write',
  )
}

async function closedPullRequestsAreNeverMutated() {
  const github = new MemoryGithub()
  await reconcileFreshnessReport({
    report: report('2026-08-30T00:00:00.000Z', [
      dependency('npm-closed', {
        pullRequests: [
          {
            number: 91,
            state: 'CLOSED',
            createdAt: '2026-08-01T00:00:00Z',
            labels: [BLOCKER_LABEL],
            checks: [],
          },
        ],
      }),
    ]),
    client: github,
  })
  assert.equal(
    github.operations.some((operation) => operation.number === 91),
    false,
    'closed PR must not be closed, relabeled, downgraded, or replaced',
  )
}

function workflowContract() {
  const workflow = readFileSync(
    path.join(root, '.github/workflows/dependency-freshness.yml'),
    'utf8',
  )
  assert.match(workflow, /cron: '17 \*\/6 \* \* \*'/u)
  assert.match(workflow, /workflow_dispatch:/u)
  assert.match(workflow, /group: dependency-freshness-blockers/u)
  assert.match(workflow, /cancel-in-progress: false/u)
  assert.match(workflow, /issues: write/u)
  assert.match(workflow, /pull-requests: write/u)
  assert.match(
    workflow,
    /pnpm deps:freshness -- --output \.tmp\/dependency-freshness\.json/u,
  )
  assert.equal(workflow.match(/pnpm deps:freshness/gu)?.length, 1)
  assert.match(workflow, /dependency-freshness-blocker\.mjs/u)
  assert.doesNotMatch(workflow, /automerge|ignoreDeps|exceptions\.json|grep/u)
}

await lifecycleTransitions()
await stableContentAndSupersedingPullRequest()
await overdueAndRecoveredRequiredChecks()
await failuresAreFailClosed()
await concurrencyAndStaleWrites()
await closedPullRequestsAreNeverMutated()
workflowContract()

console.log('Dependency freshness blocker lifecycle tests passed.')
