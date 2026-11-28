import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const workflow = read('.github/workflows/_quality.yml')
const readinessWorkflow = read('.github/workflows/_quality-readiness.yml')
const qualityWorkflow = read('.github/workflows/quality.yml')
const publishWorkflow = read('.github/workflows/publish-npm.yml')
const packageJson = JSON.parse(read('package.json'))
const scripts = packageJson.scripts ?? {}
const readinessSpec = JSON.parse(read('spec/ci/readiness-gates.json'))
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
  const source = job(readinessWorkflow, name)
  assert(source, `${name} job is required in _quality-readiness.yml`)
  assert(
    !job(workflow, name),
    `${name} must live in _quality-readiness.yml for read-only aggregation`,
  )
  assert(
    source.includes('scripts/ci-readiness.mjs check'),
    `${name} must run the manifest aggregator`,
  )
  assert(
    source.includes('pattern: readiness-manifest-*'),
    `${name} must download only this run's leaf manifests`,
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

for (const gate of readinessSpec.profiles.release) {
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

assert(
  qualityWorkflow.includes('uses: ./.github/workflows/_quality.yml'),
  'quality.yml must call _quality.yml',
)
assert(
  publishWorkflow.includes('uses: ./.github/workflows/_quality-readiness.yml'),
  'publish-npm.yml must call the reusable readiness aggregator workflow for release',
)
assert(
  job(publishWorkflow, 'quality-readiness').includes('needs: [quality]') &&
    job(publishWorkflow, 'quality-readiness').includes(
      'uses: ./.github/workflows/_quality-readiness.yml',
    ) &&
    job(publishWorkflow, 'quality-readiness').includes('group: release'),
  'publish-npm.yml quality-readiness must wait for quality and aggregate release group',
)

if (failures.length) {
  console.error(
    failures.map((failure) => `[ci-readiness] ${failure}`).join('\n'),
  )
  process.exit(1)
}
console.log('[ci-readiness] workflow policy passed')
