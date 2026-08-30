#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  auditRequiredChecks,
  evaluateAutomerge,
  loadPolicyModels,
} from './check-dependency-pr-policy.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const models = loadPolicyModels(root)
const clone = (value) => structuredClone(value)
const fixture = JSON.parse(
  readFileSync(
    path.join(root, 'tests/fixtures/dependencies/automerge-cases.json'),
    'utf8',
  ),
)

assert.deepEqual(
  auditRequiredChecks(models),
  [],
  'the repository dependency PR policy must pass',
)

function policyFor(group, updateType) {
  if (group === 'lockfile-maintenance') {
    assert.equal(updateType, 'lockfile-maintenance')
    return models.contract.lockfileMaintenance
  }
  const policy = models.contract.groups[group]
  assert.ok(policy?.updateTypes.includes(updateType))
  return policy
}

function passingCandidate(candidate = {}) {
  const group = candidate.group ?? 'vue-runtime-dependencies'
  const updateType = candidate.updateType ?? 'patch'
  const policy = policyFor(group, updateType)
  return {
    group,
    updateType,
    draft: false,
    mergeable: true,
    directPush: false,
    approvalsRequired: 0,
    platformAutomerge: true,
    projectionsFresh: true,
    branchBaseSha: 'a'.repeat(40),
    defaultBranchSha: 'a'.repeat(40),
    currentTarget: '10.0.0',
    latestStableTarget: '10.0.0',
    labels: [],
    securityUpdate: candidate.securityUpdate ?? false,
    securityUsesStandardGates: true,
    checks: Object.fromEntries(
      policy.requiredChecks.map((check) => [check, 'success']),
    ),
    gateEvidence: Object.fromEntries(
      policy.requiredGateEvidence.map((gate) => [gate, 'success']),
    ),
  }
}

for (const candidate of fixture.positive) {
  assert.deepEqual(
    evaluateAutomerge(models.contract, passingCandidate(candidate)),
    { eligible: true, labelsToAdd: [], reasons: [] },
    candidate.name,
  )
}

const negativeMutations = {
  draft(candidate) {
    candidate.draft = true
  },
  conflict(candidate) {
    candidate.mergeable = false
  },
  'blocking-label': function (candidate) {
    candidate.labels = ['dependency-blocked']
  },
  'stale-base': function (candidate) {
    candidate.branchBaseSha = 'b'.repeat(40)
  },
  'older-target': function (candidate) {
    candidate.currentTarget = '9.9.0'
  },
  'stale-projections': function (candidate) {
    candidate.projectionsFresh = false
  },
  'direct-push': function (candidate) {
    candidate.directPush = true
  },
  'manual-approval': function (candidate) {
    candidate.approvalsRequired = 1
  },
  'unknown-group': function (candidate) {
    candidate.group = 'unregistered'
  },
  'unknown-update-type': function (candidate) {
    candidate.updateType = 'pin'
  },
  'missing-check': function (candidate) {
    delete candidate.checks['pr-fast']
  },
  'action-required-check': function (candidate) {
    candidate.checks['pr-fast'] = 'action_required'
  },
  'failure-check': function (candidate) {
    candidate.checks['pr-fast'] = 'failure'
  },
  'skipped-check': function (candidate) {
    candidate.checks['pr-fast'] = 'skipped'
  },
  'neutral-check': function (candidate) {
    candidate.checks['pr-fast'] = 'neutral'
  },
  'pending-check': function (candidate) {
    candidate.checks['pr-fast'] = 'pending'
  },
  'cancelled-check': function (candidate) {
    candidate.checks['pr-fast'] = 'cancelled'
  },
  'timed-out-check': function (candidate) {
    candidate.checks['pr-fast'] = 'timed_out'
  },
  'missing-gate': function (candidate) {
    delete candidate.gateEvidence['build-package']
  },
  'failed-gate': function (candidate) {
    const gate = Object.keys(candidate.gateEvidence)[0]
    candidate.gateEvidence[gate] = 'failure'
  },
  'security-bypass': function (candidate) {
    candidate.securityUpdate = true
    candidate.securityUsesStandardGates = false
  },
  'overdue-failure': function (candidate) {
    candidate.checks['pr-fast'] = 'failure'
    candidate.failureAgeHours = 25
  },
  'overdue-draft': function (candidate) {
    candidate.draft = true
    candidate.failureAgeHours = 25
  },
}

for (const testCase of fixture.negative) {
  const candidate = passingCandidate()
  const mutate = negativeMutations[testCase.mutation]
  assert.ok(mutate, `unknown negative fixture mutation ${testCase.mutation}`)
  mutate(candidate)
  const result = evaluateAutomerge(models.contract, candidate)
  assert.equal(result.eligible, false, testCase.name)
  assert.ok(
    result.reasons.length > 0,
    `${testCase.name} must explain rejection`,
  )
  if (testCase.mutation === 'overdue-failure') {
    assert.deepEqual(result.labelsToAdd, ['dependency-blocked'])
  } else {
    assert.deepEqual(result.labelsToAdd, [])
  }
}

const governanceMutations = [
  {
    name: 'manifest check does not exist',
    mutate(next) {
      next.contract.checks['invented-check'] = clone(
        next.contract.checks['pr-fast'],
      )
    },
    expected: /check definitions/u,
  },
  {
    name: 'branch protection omits manifest check',
    mutate(next) {
      next.branchProtection.required_status_checks.contexts.pop()
    },
    expected: /bidirectional mismatch/u,
  },
  {
    name: 'branch protection adds an unregistered check',
    mutate(next) {
      next.branchProtection.required_status_checks.contexts.push('lint-only')
    },
    expected: /bidirectional mismatch/u,
  },
  {
    name: 'branch protection is not strict',
    mutate(next) {
      next.branchProtection.required_status_checks.strict = false
    },
    expected: /strict mode/u,
  },
  {
    name: 'branch protection requires manual review',
    mutate(next) {
      next.branchProtection.required_pull_request_reviews = {
        required_approving_review_count: 1,
      }
    },
    expected: /manual pull request approval/u,
  },
  {
    name: 'group is unregistered',
    mutate(next) {
      delete next.contract.groups['avalonia-platform']
    },
    expected: /groups do not match/u,
  },
  {
    name: 'package runtime uses lint-only evidence',
    mutate(next) {
      next.contract.groups['vue-runtime-dependencies'].requiredGateEvidence = [
        'static-quality',
      ]
    },
    expected: /package candidate and consumer install/u,
  },
  {
    name: 'peer build group omits consumer install',
    mutate(next) {
      next.contract.groups['vue-build-toolchain'].requiredGateEvidence = [
        'build-package',
        'static-quality',
      ]
    },
    expected: /package candidate and consumer install/u,
  },
  {
    name: 'Wasm group omits package candidate',
    mutate(next) {
      next.contract.groups['wasm-toolchain'].requiredGateEvidence = [
        'consumer-install',
        'static-quality',
      ]
    },
    expected: /package candidate and consumer install/u,
  },
  {
    name: 'release tooling omits package gates',
    mutate(next) {
      next.contract.groups['npm-release-tooling'].requiredGateEvidence = [
        'static-quality',
      ]
    },
    expected: /package candidate and consumer install/u,
  },
  {
    name: 'lockfile maintenance has no checks',
    mutate(next) {
      next.contract.lockfileMaintenance.requiredChecks = []
    },
    expected: /lockfile maintenance must require/u,
  },
  {
    name: 'skipped conclusion is accepted',
    mutate(next) {
      next.contract.requiredConclusions.push('skipped')
    },
    expected: /only accepted/u,
  },
  {
    name: 'Renovate branch automerge bypass',
    mutate(next) {
      next.renovate.automergeType = 'branch'
    },
    expected: /direct branch pushes/u,
  },
  {
    name: 'Renovate ignores tests',
    mutate(next) {
      next.renovate.ignoreTests = true
    },
    expected: /wait for required checks/u,
  },
  {
    name: 'Renovate merge window',
    mutate(next) {
      next.renovate.automergeSchedule = ['after 10pm']
    },
    expected: /merge time window/u,
  },
]

for (const mutation of governanceMutations) {
  const next = clone(models)
  mutation.mutate(next)
  assert.match(
    auditRequiredChecks(next).join('\n'),
    mutation.expected,
    mutation.name,
  )
}

console.log(
  `Dependency PR policy fixtures passed: positive=${fixture.positive.length} negative=${fixture.negative.length} governanceMutations=${governanceMutations.length}.`,
)
