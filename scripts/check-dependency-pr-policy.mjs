#!/usr/bin/env node
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FIXED_GROUPS,
  packageGroupsFromSurface,
} from './update-surface-lib.mjs'

const require = createRequire(import.meta.url)
const JSON5 = require('json5')
const defaultRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const UPDATE_TYPES = ['digest', 'major', 'minor', 'patch']
const REQUIRED_CHECKS = ['pr-fast', 'pr-real-render-performance']
const REJECTED_CONCLUSIONS = [
  'action_required',
  'cancelled',
  'failure',
  'missing',
  'neutral',
  'pending',
  'skipped',
  'stale',
  'timed_out',
]
const PACKAGE_CONSUMER_GROUPS = [
  'node-dotnet-sdk-images',
  'npm-release-tooling',
  'vue-build-toolchain',
  'vue-runtime-dependencies',
  'wasm-toolchain',
]
const DOTNET_GROUPS = [
  'avalonia-platform',
  'dotnet-build-toolchain',
  'dotnet-test-performance',
  'node-dotnet-sdk-images',
]
const PLAYWRIGHT_GROUPS = ['github-actions', 'js-test-quality-tooling']

const sorted = (values) =>
  [...values].sort((left, right) => left.localeCompare(right))
const same = (left, right) =>
  JSON.stringify(sorted(left ?? [])) === JSON.stringify(sorted(right ?? []))
const duplicate = (values) =>
  (values ?? []).find((value, index) => values.indexOf(value) !== index)
const workflowJob = (source, name) => {
  const marker = `\n  ${name}:\n`
  const start = source.indexOf(marker)
  if (start < 0) return ''
  const rest = source.slice(start + marker.length)
  const next = rest.search(/^ {2}[a-zA-Z0-9_-]+:\n/mu)
  return next < 0 ? rest : rest.slice(0, next)
}

function policyFor(contract, group, updateType) {
  if (group === 'lockfile-maintenance') {
    if (updateType !== contract.lockfileMaintenance?.updateType) return null
    return contract.lockfileMaintenance
  }
  const policy = contract.groups?.[group]
  if (!policy?.updateTypes?.includes(updateType)) return null
  return policy
}

export function auditRequiredChecks({
  contract,
  surface,
  branchProtection,
  readiness,
  renovate,
  qualityWorkflow,
}) {
  const errors = []
  const fail = (message) => errors.push(message)

  if (contract.schemaVersion !== 1)
    fail('required-checks schemaVersion must be 1')
  if (contract.defaultBranch !== 'main') fail('defaultBranch must be main')
  if (!same(contract.requiredConclusions, ['success'])) {
    fail('success must be the only accepted check conclusion')
  }
  if (!same(contract.rejectedConclusions, REJECTED_CONCLUSIONS)) {
    fail('rejected conclusions must cover every non-success terminal state')
  }
  if (!same(contract.blockingLabels, ['dependency-blocked'])) {
    fail('dependency-blocked must be the unique dependency blocking label')
  }
  if (contract.branchProtection?.strict !== true) {
    fail('branch protection must require the latest default branch')
  }
  if (!same(contract.branchProtection?.requiredChecks, REQUIRED_CHECKS)) {
    fail('branch protection check names drifted from the stable PR contexts')
  }

  const checkNames = Object.keys(contract.checks ?? {})
  if (!same(checkNames, REQUIRED_CHECKS)) {
    fail('required check definitions must exactly match branch protection')
  }
  for (const checkName of REQUIRED_CHECKS) {
    const check = contract.checks?.[checkName]
    if (
      check?.workflow !== '.github/workflows/quality.yml' ||
      typeof check?.job !== 'string'
    ) {
      fail(`${checkName} must bind an exact workflow job`)
      continue
    }
    if (!workflowJob(qualityWorkflow, check.job)) {
      fail(`${checkName} references missing workflow job ${check.job}`)
    }
  }
  if (
    !same(contract.checks?.['pr-fast']?.aggregates, [
      'premerge-main',
      'premerge-playwright',
      'pr-feedback',
      'pr-real-render-performance',
    ])
  ) {
    fail('pr-fast aggregate ownership is incomplete or contains extras')
  }
  const prFast = workflowJob(qualityWorkflow, 'pr-fast')
  for (const aggregate of contract.checks?.['pr-fast']?.aggregates ?? []) {
    if (!prFast.includes(`- ${aggregate}`)) {
      fail(`pr-fast no longer aggregates ${aggregate}`)
    }
  }
  if (
    !workflowJob(qualityWorkflow, 'merge-group-pr-fast').includes(
      'name: pr-fast',
    ) ||
    !workflowJob(
      qualityWorkflow,
      'merge-group-real-render-performance',
    ).includes('name: pr-real-render-performance')
  ) {
    fail('merge-group workflow must preserve both required check contexts')
  }

  const branchChecks = branchProtection?.required_status_checks
  if (branchChecks?.strict !== contract.branchProtection?.strict) {
    fail(
      'branch protection strict mode does not match required-checks authority',
    )
  }
  if (!same(branchChecks?.contexts, REQUIRED_CHECKS)) {
    fail('branch protection required checks have a bidirectional mismatch')
  }
  if (branchProtection?.required_pull_request_reviews !== null) {
    fail('branch protection must not require manual pull request approval')
  }

  const groupNames = Object.keys(contract.groups ?? {})
  if (!same(groupNames, FIXED_GROUPS)) {
    fail('required-checks groups do not match the governed dependency groups')
  }
  const registeredGroups = new Set(packageGroupsFromSurface(surface).values())
  for (const group of FIXED_GROUPS) {
    if (!registeredGroups.has(group)) fail(`group is not registered: ${group}`)
    const policy = contract.groups?.[group]
    if (!policy) continue
    if (!same(policy.updateTypes, UPDATE_TYPES)) {
      fail(`${group} must cover patch, minor, major, and digest updates`)
    }
    if (!same(policy.requiredChecks, REQUIRED_CHECKS)) {
      fail(`${group} required checks drifted from branch protection`)
    }
    if (duplicate(policy.requiredGateEvidence)) {
      fail(`${group} repeats required gate evidence`)
    }
    for (const gate of policy.requiredGateEvidence ?? []) {
      if (!readiness.profiles?.main?.includes(gate)) {
        fail(`${group} references unknown main readiness gate ${gate}`)
      }
    }
    if (!(policy.requiredGateEvidence ?? []).includes('static-quality')) {
      fail(`${group} omits static-quality`)
    }
  }
  for (const group of PACKAGE_CONSUMER_GROUPS) {
    const gates = contract.groups?.[group]?.requiredGateEvidence ?? []
    if (
      !gates.includes('build-package') ||
      !gates.includes('consumer-install')
    ) {
      fail(`${group} must require package candidate and consumer install gates`)
    }
  }
  for (const group of DOTNET_GROUPS) {
    const gates = contract.groups?.[group]?.requiredGateEvidence ?? []
    if (
      !gates.includes('dotnet-platform') ||
      !gates.includes('dotnet-package')
    ) {
      fail(`${group} must require both .NET platform and package gates`)
    }
  }
  for (const group of PLAYWRIGHT_GROUPS) {
    const gates = contract.groups?.[group]?.requiredGateEvidence ?? []
    if (!gates.some((gate) => gate.startsWith('playwright-'))) {
      fail(`${group} must require real Playwright gate evidence`)
    }
  }

  const lockfile = contract.lockfileMaintenance
  if (lockfile?.updateType !== 'lockfile-maintenance') {
    fail('lockfile maintenance update type is missing')
  }
  if (!same(lockfile?.requiredChecks, REQUIRED_CHECKS)) {
    fail('lockfile maintenance must require every branch protection check')
  }
  for (const gate of [
    'build-package',
    'consumer-install',
    'dotnet-platform',
    'dotnet-package',
  ]) {
    if (!lockfile?.requiredGateEvidence?.includes(gate)) {
      fail(`lockfile maintenance omits ${gate}`)
    }
  }

  if (renovate.automerge !== true) fail('Renovate automerge must be enabled')
  if (renovate.automergeType !== 'pr') {
    fail('Renovate must use PR automerge instead of direct branch pushes')
  }
  if (renovate.platformAutomerge !== true) {
    fail('Renovate must use platform-native automerge')
  }
  if (renovate.ignoreTests !== false) {
    fail('Renovate must wait for required checks')
  }
  if (renovate.dependencyDashboardApproval !== false) {
    fail('Renovate updates must not require manual dashboard approval')
  }
  if (renovate.rebaseWhen !== 'behind-base-branch') {
    fail('Renovate must refresh branches that are behind the default branch')
  }
  if ('automergeSchedule' in renovate) {
    fail('Renovate automerge must not use a merge time window')
  }
  for (const [key, value] of Object.entries({
    automerge: renovate.lockFileMaintenance?.automerge,
    automergeType: renovate.lockFileMaintenance?.automergeType,
    platformAutomerge: renovate.lockFileMaintenance?.platformAutomerge,
  })) {
    const expected = key === 'automergeType' ? 'pr' : true
    if (value !== expected) {
      fail(`lockfile maintenance ${key} must be ${JSON.stringify(expected)}`)
    }
  }

  return errors
}

export function evaluateAutomerge(contract, candidate) {
  const reasons = []
  const labelsToAdd = []
  let hasFailedRequiredGate = false
  const reject = (reason) => reasons.push(reason)
  const policy = policyFor(contract, candidate.group, candidate.updateType)

  if (!policy) reject('unregistered group or update type')
  if (candidate.draft) reject('draft pull request')
  if (!candidate.mergeable) reject('merge conflict or unknown mergeability')
  if (candidate.directPush) reject('direct push is forbidden')
  if (candidate.approvalsRequired !== 0) reject('manual approval is forbidden')
  if (!candidate.platformAutomerge) reject('platform automerge is required')
  if (!candidate.projectionsFresh) reject('controlled projections are stale')
  if (candidate.branchBaseSha !== candidate.defaultBranchSha) {
    reject('branch is behind the default branch')
  }
  if (candidate.currentTarget !== candidate.latestStableTarget) {
    reject('dependency target is not the latest stable version')
  }
  if (
    (candidate.labels ?? []).some((label) =>
      contract.blockingLabels.includes(label),
    )
  ) {
    reject('blocking label is present')
  }
  if (candidate.securityUpdate && !candidate.securityUsesStandardGates) {
    reject('security update attempted to bypass standard gates')
  }

  for (const check of policy?.requiredChecks ?? []) {
    const conclusion = candidate.checks?.[check] ?? 'missing'
    if (!contract.requiredConclusions.includes(conclusion)) {
      hasFailedRequiredGate = true
      reject(`required check ${check} is ${conclusion}`)
    }
  }
  for (const gate of policy?.requiredGateEvidence ?? []) {
    const conclusion = candidate.gateEvidence?.[gate] ?? 'missing'
    if (!contract.requiredConclusions.includes(conclusion)) {
      hasFailedRequiredGate = true
      reject(`required gate ${gate} is ${conclusion}`)
    }
  }

  if (candidate.failureAgeHours > 24 && hasFailedRequiredGate) {
    labelsToAdd.push('dependency-blocked')
  }

  return { eligible: reasons.length === 0, labelsToAdd, reasons }
}

export function loadPolicyModels(root = defaultRoot) {
  const read = (relative) => readFileSync(path.join(root, relative), 'utf8')
  return {
    contract: JSON.parse(read('config/dependencies/required-checks.json')),
    surface: JSON.parse(read('config/dependencies/update-surface.json')),
    branchProtection: JSON.parse(
      read('tests/fixtures/dependencies/branch-protection-main.json'),
    ),
    readiness: JSON.parse(read('spec/ci/readiness-gates.json')),
    renovate: JSON5.parse(read('renovate.json5')),
    qualityWorkflow: read('.github/workflows/quality.yml'),
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  const errors = auditRequiredChecks(loadPolicyModels())
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`[dependency-pr-policy] FAIL ${error}`)
    }
    process.exitCode = 1
  } else {
    console.log(
      `Dependency PR policy passed: groups=${FIXED_GROUPS.length} updateTypes=${UPDATE_TYPES.length + 1} requiredChecks=${REQUIRED_CHECKS.length}.`,
    )
  }
}
