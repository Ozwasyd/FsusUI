#!/usr/bin/env node
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  auditRequiredChecks,
  evaluateRequiredChecks,
  loadPolicyModels,
} from './check-dependency-pr-policy.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const models = loadPolicyModels(root)
const clone = (value) => structuredClone(value)
const requiredChecks = ['pr-fast', 'pr-real-render-performance']

assert.deepEqual(
  auditRequiredChecks(models),
  [],
  'the repository required-checks authority must pass',
)

const cases = [
  ['patch dependency', 'vue-runtime-dependencies', 'patch'],
  ['minor dependency', 'vue-build-toolchain', 'minor'],
  ['major dependency', 'avalonia-platform', 'major'],
  ['digest image', 'node-dotnet-sdk-images', 'digest'],
  ['lockfile maintenance', 'lockfile-maintenance', 'lockfile-maintenance'],
]

function policyFor(group) {
  return group === 'lockfile-maintenance'
    ? models.contract.lockfileMaintenance
    : models.contract.groups[group]
}

function passingCandidate(group, updateType) {
  const policy = policyFor(group)
  return {
    group,
    updateType,
    checks: Object.fromEntries(
      policy.requiredChecks.map((check) => [check, 'success']),
    ),
    gateEvidence: Object.fromEntries(
      policy.requiredGateEvidence.map((gate) => [gate, 'success']),
    ),
  }
}

for (const [name, group, updateType] of cases) {
  const policy = policyFor(group)
  assert.deepEqual(policy.requiredChecks, requiredChecks, name)
  assert.deepEqual(
    evaluateRequiredChecks(
      models.contract,
      passingCandidate(group, updateType),
    ),
    { success: true, reasons: [] },
    name,
  )
}

for (const conclusion of [
  'action_required',
  'cancelled',
  'failure',
  'missing',
  'neutral',
  'pending',
  'skipped',
  'stale',
  'timed_out',
]) {
  const candidate = passingCandidate('vue-runtime-dependencies', 'patch')
  if (conclusion === 'missing') delete candidate.checks['pr-fast']
  else candidate.checks['pr-fast'] = conclusion
  const result = evaluateRequiredChecks(models.contract, candidate)
  assert.equal(result.success, false, conclusion)
  assert.match(result.reasons.join('\n'), /required check pr-fast/u)
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
    name: 'Renovate automerge enabled too early',
    mutate(next) {
      next.renovate.automerge = true
    },
    expected: /must not enable Renovate automerge/u,
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
  `Dependency required-check fixtures passed: updateCases=${cases.length} nonSuccess=9 governanceMutations=${governanceMutations.length}.`,
)
