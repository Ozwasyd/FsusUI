import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const workflow = read('.github/workflows/_quality.yml')
const playwrightWorkflow = read('.github/workflows/_quality-playwright.yml')
const qualityWorkflow = read('.github/workflows/quality.yml')
const publishWorkflow = read('.github/workflows/publish-npm.yml')
const packageJson = JSON.parse(read('package.json'))
const scripts = packageJson.scripts ?? {}
const ownersSpec = JSON.parse(read('spec/ci/playwright-owners.json'))
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}
const job = (source, name) =>
  source.match(
    new RegExp(
      `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z][\\w-]*:\\n|$)`,
      'u',
    ),
  )?.[1] ?? ''

for (const name of [
  'stable-readiness',
  'nightly-readiness',
  'release-readiness',
]) {
  const source = job(workflow, name)
  assert(source, `${name} job is required`)
  assert(
    source.includes('scripts/ci-readiness.mjs check'),
    `${name} must run the manifest aggregator`,
  )
  assert(
    source.includes('pattern: readiness-manifest-*'),
    `${name} must download only this run's leaf manifests`,
  )
  assert(
    source.includes('--playwright-group'),
    `${name} must declare the playwright evidence group`,
  )
  for (const forbidden of [
    'verify:full',
    'verify:stable',
    'verify:nightly',
    'verify:release',
    'dotnet:verify',
    'test:coverage',
    'coverage:run',
    'coverage:merge',
    'test:visual',
    'package:candidate:build',
    'build:demo',
    'pnpm install',
    'pnpm test',
    'pnpm build',
    'dotnet ',
    'npm ',
    'playwright test',
    'playwright install',
    'pnpm exec playwright',
    'vitest',
  ]) {
    assert(!source.includes(forbidden), `${name} must not execute ${forbidden}`)
  }
}

for (const gate of [
  'real-render-performance',
  'static-quality',
  'dotnet-platform',
  'dotnet-package',
  'typecheck',
  'unit',
  'coverage',
  'build-package',
  'consumer-install',
  'build-demo',
  'visual',
]) {
  assert(
    job(workflow, gate).includes('uses: ./.github/actions/readiness-manifest'),
    `${gate} must upload a structured readiness manifest`,
  )
}
for (const [name, fragment] of [
  ['ci:readiness:plan', 'scripts/ci-readiness.mjs plan'],
  ['ci:readiness:check', 'scripts/ci-readiness.mjs check'],
  ['test:ci-readiness', 'scripts/test-ci-readiness.mjs'],
  ['check:readiness-workflow', 'scripts/check-readiness-workflow-policy.mjs'],
]) {
  assert(scripts[name]?.includes(fragment), `package.json must expose ${name}`)
}
assert(
  scripts['governance:check']?.includes('check:readiness-workflow'),
  'governance:check must retain the readiness workflow guard',
)
assert(
  scripts['governance:check']?.includes('test:ci-readiness'),
  'governance:check must retain readiness negative fixtures',
)

// Playwright owner jobs must be wired into the reusable playwright workflow.
const pwOwners = Object.entries(ownersSpec.owners ?? {})
assert(
  pwOwners.length === 6,
  'playwright-owners must declare exactly six owners',
)
for (const [ownerId, owner] of pwOwners) {
  assert(owner.gate === ownerId, `owner ${ownerId} gate must equal its id`)
  const source = job(playwrightWorkflow, ownerId)
  assert(source, `_quality-playwright.yml must contain owner job ${ownerId}`)
  assert(
    source.includes('uses: ./.github/actions/readiness-manifest'),
    `${ownerId} must call readiness-manifest`,
  )
  assert(
    source.includes(`gate: ${ownerId}`),
    `${ownerId} manifest must record gate ${ownerId}`,
  )
  assert(
    source.includes('playwright-receipts:'),
    `${ownerId} must pass playwright receipts`,
  )
  assert(
    source.includes('playwright-plan:'),
    `${ownerId} must pass the playwright plan input`,
  )
  assert(
    source.includes('--impact-plan'),
    `${ownerId} owner run must consume the PR impact plan`,
  )
  assert(
    source.includes('needs: playwright-pr-impact-plan'),
    `${ownerId} must wait for the PR impact plan job`,
  )
  assert(
    !/gate:\s*visual\s*$/mu.test(source),
    `${ownerId} must not reuse the generic visual owner`,
  )
}
const planJob = job(playwrightWorkflow, 'playwright-pr-impact-plan')
assert(planJob, 'playwright-pr-impact-plan job is required')
assert(
  planJob.includes('scripts/playwright-impact-plan.mjs'),
  'playwright-pr-impact-plan must generate the #485 impact plan',
)
assert(
  planJob.includes('name: playwright-pr-impact-plan'),
  'playwright-pr-impact-plan must upload the plan receipt artifact',
)
const prAgg = job(playwrightWorkflow, 'playwright-pr-readiness')
assert(prAgg, 'playwright-pr-readiness job is required')
assert(
  prAgg.includes('--profile pr-playwright'),
  'playwright-pr-readiness must aggregate the pr-playwright profile',
)
assert(
  prAgg.includes('--plan-receipt'),
  'playwright-pr-readiness must bind the impact plan receipt',
)
for (const [ownerId] of pwOwners) {
  assert(
    prAgg.includes(ownerId),
    `playwright-pr-readiness must depend on ${ownerId}`,
  )
}
assert(
  !/continue-on-error:\s*true/u.test(prAgg),
  'playwright-pr-readiness must fail closed without continue-on-error',
)

// Caller workflows must order playwright evidence before the aggregators.
assert(
  qualityWorkflow.includes('uses: ./.github/workflows/_quality-playwright.yml'),
  'quality.yml must call the reusable playwright workflow',
)
for (const group of ['main', 'nightly', 'release']) {
  const groupJob = job(qualityWorkflow, group)
  const playwrightJob = job(qualityWorkflow, `${group}-playwright`)
  assert(groupJob, `quality.yml must call _quality.yml for ${group}`)
  assert(
    playwrightJob,
    `quality.yml must call playwright workflow for ${group}`,
  )
  assert(
    groupJob.includes(`needs: ${group}-playwright`),
    `quality.yml ${group} must wait for ${group}-playwright evidence`,
  )
  assert(
    playwrightJob.includes(`group: ${group}`),
    `quality.yml ${group}-playwright must use group ${group}`,
  )
}
assert(
  publishWorkflow.includes('uses: ./.github/workflows/_quality-playwright.yml'),
  'publish-npm.yml must call the reusable playwright workflow for release',
)
assert(
  job(publishWorkflow, 'quality-playwright').includes('group: release'),
  'publish-npm.yml playwright workflow must use group release',
)
assert(
  job(publishWorkflow, 'quality').includes('needs: quality-playwright'),
  'publish-npm.yml quality must wait for release playwright evidence',
)

if (failures.length) {
  console.error(
    failures.map((failure) => `[ci-readiness] ${failure}`).join('\n'),
  )
  process.exit(1)
}
console.log('[ci-readiness] workflow policy passed')
