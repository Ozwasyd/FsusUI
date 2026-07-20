import fs from 'node:fs'

const workflow = fs.readFileSync('.github/workflows/_quality.yml', 'utf8')
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}
const job = (name) =>
  workflow.match(
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
  const source = job(name)
  assert(source, `${name} job is required`)
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
    'playwright',
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
    job(gate).includes('uses: ./.github/actions/readiness-manifest'),
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

if (failures.length) {
  console.error(
    failures.map((failure) => `[ci-readiness] ${failure}`).join('\n'),
  )
  process.exit(1)
}
console.log('[ci-readiness] workflow policy passed')
