import assert from 'node:assert/strict'
import {
  countOccurrences,
  deepClone,
  expectThrows,
  extractWorkflowJob,
  readRepoText,
  repoRoot,
} from './ci-policy-utils.mjs'
import {
  assertOwnerFixedCells,
  loadPlaywrightOwners,
  planOwnerCells,
  validatePlanIsolation,
} from '../layout-playwright-plan.mjs'
import {
  loadPlaywrightSuiteRegistry,
  validatePlaywrightSuiteRegistry,
} from '../playwright-suites.mjs'

export const collectPlaywrightInstallBrowsers = (jobSource) =>
  [...jobSource.matchAll(/playwright install --with-deps([^\n]+)/gu)].map(
    (match) => match[1].trim().split(/\s+/u),
  )

export const validatePlaywrightOwnerWorkflow = (
  source,
  {
    jobName,
    ownerScript,
    forbiddenCommands = [],
    requiredBrowsers = [],
    forbiddenBrowsers = [],
    requireNonPrGate = false,
    requireEvidenceUpload = true,
    extraChecks = [],
  },
) => {
  const failures = []
  if (!source.includes(`${jobName}:`)) {
    failures.push(`reusable workflow must define a ${jobName} job`)
    return failures
  }
  const job = extractWorkflowJob(source, jobName)
  if (!job) {
    failures.push(`cannot extract ${jobName} job`)
    return failures
  }
  if (/\n\s+(?:strategy|matrix):/u.test(job)) {
    failures.push(`${jobName} job must not use strategy/matrix`)
  }
  if (!job.includes(ownerScript)) {
    failures.push(`${jobName} job must run ${ownerScript}`)
  }
  for (const command of forbiddenCommands) {
    if (job.includes(command)) {
      failures.push(
        `${jobName} job must not invoke full-config suite commands`,
      )
      break
    }
  }
  if (requireNonPrGate && !/^\s+if:\s*inputs\.group != 'pr'\s*$/mu.test(job)) {
    failures.push(`${jobName} job must be gated on inputs.group != pr`)
  }
  if (requiredBrowsers.length > 0) {
    const installCommands = collectPlaywrightInstallBrowsers(job)
    for (const browser of requiredBrowsers) {
      const count = installCommands.filter((browsers) =>
        browsers.includes(browser),
      ).length
      if (count !== 1) {
        failures.push(
          `${jobName} job must install ${browser} exactly once`,
        )
      }
    }
  }
  for (const browser of forbiddenBrowsers) {
    if (job.includes(`playwright install --with-deps ${browser}`)) {
      failures.push(`${jobName} job must not install ${browser}`)
    }
  }
  if (
    requireEvidenceUpload &&
    !job.includes(`${jobName}-evidence-\${{ inputs.group }}`)
  ) {
    failures.push(`${jobName} job must upload per-group evidence`)
  }
  for (const check of extraChecks) {
    const message = check(job, source)
    if (message) failures.push(message)
  }
  return failures
}

export const assertTopWorkflowPlaywrightJobs = (
  topWorkflow,
  {
    requirePremergePrGroup = false,
    requirePrResultConsumption = false,
  } = {},
) => {
  for (const job of [
    'premerge-playwright',
    'main-playwright',
    'nightly-playwright',
    'release-playwright',
  ]) {
    assert.ok(topWorkflow.includes(`${job}:`), `quality.yml must define ${job}`)
  }
  if (requirePremergePrGroup) {
    assert.equal(
      countOccurrences(
        topWorkflow,
        'uses: ./.github/workflows/_quality-playwright.yml',
      ),
      4,
    )
    const premergeJob = extractWorkflowJob(topWorkflow, 'premerge-playwright')
    assert.ok(
      /uses: \.\/\.github\/workflows\/_quality-playwright\.yml[\s\S]*?group: pr/u.test(
        premergeJob,
      ),
      'premerge-playwright must run the PR registry group',
    )
    assert.ok(
      !premergeJob.includes('group: main'),
      'premerge-playwright must not run the main registry group',
    )
  }
  if (requirePrResultConsumption) {
    assert.ok(
      topWorkflow.includes('PR_PLAYWRIGHT_RESULT'),
      'pr-fast must consume premerge-playwright result',
    )
    assert.ok(
      /needs:[\s\S]*premerge-playwright/u.test(topWorkflow),
      'pr-fast must need premerge-playwright',
    )
  }
}

export const assertOwnerPlans = ({
  groups = ['main', 'nightly', 'release'],
  loadPlan,
  fixedCells,
  fixedNamespaces,
  checkIsolation = false,
  checkDirectCommand = true,
  extraPlanAssert,
}) => {
  const plans = new Map()
  for (const group of groups) {
    const plan = loadPlan(group)
    plans.set(group, plan)
    assert.deepEqual(
      plan.cells.map((cell) => cell.id),
      [...fixedCells],
    )
    if (fixedNamespaces) {
      assert.deepEqual(
        plan.cells.map((cell) => cell.artifactNamespace),
        fixedCells.map((cellId) => fixedNamespaces[cellId]),
        `${group} artifact namespaces must match the fixed issue namespace`,
      )
    }
    if (checkIsolation) {
      assert.deepEqual(
        validatePlanIsolation(plan),
        [],
        `${group} plan must isolate reports/output`,
      )
    }
    if (checkDirectCommand) {
      for (const cell of plan.cells) {
        const projectFlags = cell.command.match(/--project=\S+/gu) ?? []
        assert.equal(
          projectFlags.length,
          1,
          `${cell.id} must target exactly one project`,
        )
        assert.ok(
          !/npm-run-all|\brun-[ps]\b/u.test(cell.command),
          `${cell.id} must not use npm-run-all passthrough`,
        )
        assert.equal(
          cell.command.startsWith('pnpm exec playwright test --config='),
          true,
          `${cell.id} must invoke Playwright directly via pnpm exec`,
        )
      }
    }
    if (extraPlanAssert) extraPlanAssert(plan, group)
  }
  return plans
}

export const assertMissingCellRejected = ({
  label,
  registry,
  owners,
  owner,
  suiteId,
  project,
  fixedCells,
  loadPlan,
}) => {
  expectThrows(label, () => {
    const mutated = deepClone(registry)
    const suite = mutated.suites.find((entry) => entry.id === suiteId)
    suite.cells = suite.cells.filter((cell) => cell.project !== project)
    if (loadPlan) {
      loadPlan('main', mutated, owners)
    } else {
      const plan = planOwnerCells(owner, 'main', mutated, owners)
      assertOwnerFixedCells(plan, [...fixedCells])
    }
  })
}

export const loadPlaywrightPolicyContext = () => {
  const registry = loadPlaywrightSuiteRegistry()
  const owners = loadPlaywrightOwners()
  validatePlaywrightSuiteRegistry(registry, repoRoot)
  const reusableWorkflow = readRepoText('.github/workflows/_quality-playwright.yml')
  const topWorkflow = readRepoText('.github/workflows/quality.yml')
  return { registry, owners, reusableWorkflow, topWorkflow }
}

export { deepClone, expectThrows, extractWorkflowJob, countOccurrences, readRepoText, repoRoot }
