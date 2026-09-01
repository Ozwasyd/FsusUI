import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const workflow = fs.readFileSync('.github/workflows/_quality.yml', 'utf8')
const platformVerifier = fs.readFileSync(
  'scripts/dotnet-platform-verify.mjs',
  'utf8',
)

const job = (source, name) =>
  source.match(
    new RegExp(
      `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z][\\w-]*:\\n|$)`,
      'u',
    ),
  )?.[1] ?? ''

const validate = (source) => {
  const failures = []
  const assert = (condition, message) => {
    if (!condition) failures.push(message)
  }
  const platform = job(source, 'dotnet-platform')
  const packageJob = job(source, 'dotnet-package')
  const staticQuality = job(source, 'static-quality')
  const stable = job(source, 'stable-readiness')

  assert(platform, 'dotnet-platform job is required')
  assert(packageJob, 'dotnet-package job is required')
  assert(staticQuality, 'static-quality job is required')
  for (const value of ['linux', 'windows', 'macos']) {
    assert(
      platform.includes(`platform: ${value}`),
      `platform matrix must include ${value}`,
    )
  }
  for (const value of ['ubuntu-latest', 'windows-latest', 'macos-latest']) {
    assert(
      platform.includes(`os: ${value}`),
      `platform matrix must include ${value}`,
    )
  }
  assert(
    platform.includes('node scripts/dotnet-platform-verify.mjs'),
    'platform matrix must run only the platform verifier',
  )
  for (const forbidden of [
    'pnpm install',
    'dotnet pack',
    'dotnet:pack',
    'dotnet:package',
    'dotnet:metadata',
    'package-smoke',
    'stable-package',
    'icons:check',
    'tokens:check',
    'conformance',
    'governance',
    'a11y:check',
    'bin/Release',
  ]) {
    assert(
      !platform.includes(forbidden),
      `platform matrix must not contain ${forbidden}`,
    )
  }
  for (const input of [
    'runner.os',
    'runner.arch',
    'dotnet/global.json',
    'dotnet/**/*.csproj',
    'dotnet/**/*.props',
    'dotnet/**/*.targets',
    'dotnet/**/*.slnx',
    'dotnet/**/packages.lock.json',
  ]) {
    assert(platform.includes(input), `platform cache key must cover ${input}`)
  }
  assert(
    /dotnet-package:[\s\S]*?runs-on: ubuntu-latest/u.test(source),
    'dotnet-package must use the canonical Ubuntu runner',
  )
  assert(
    !packageJob.includes('matrix:'),
    'dotnet-package must not be a matrix job',
  )
  assert(
    packageJob.includes('node scripts/dotnet-package-verify.mjs'),
    'dotnet-package must run the package verifier once',
  )
  assert(
    packageJob.includes('dotnet-nuget-candidate'),
    'dotnet-package must upload one named candidate artifact',
  )
  assert(
    packageJob.includes('dotnet/artifacts/package/manifest.json'),
    'package artifact must include its digest manifest',
  )
  for (const command of [
    'icons:check',
    'tokens:check',
    'conformance',
    'governance:check',
    'a11y:check',
  ]) {
    assert(
      staticQuality.includes(command),
      `static-quality must own ${command}`,
    )
  }
  assert(
    stable.includes('dotnet-platform') && stable.includes('dotnet-package'),
    'stable-readiness must aggregate both .NET jobs',
  )
  assert(
    stable.includes('node scripts/ci-readiness.mjs check') &&
      stable.includes('--profile main'),
    'stable-readiness must verify platform and package manifests through the readiness aggregator',
  )
  assert(
    platform.includes('gate: dotnet-platform') &&
      platform.includes('platform=${{ matrix.platform }}'),
    'each .NET platform owner must emit its structured platform manifest',
  )
  assert(
    packageJob.includes('gate: dotnet-package') &&
      packageJob.includes('nuget-candidate=dotnet/artifacts'),
    'the unique NuGet owner must emit candidate digest evidence',
  )
  assert(
    !source.includes('pnpm run dotnet:verify'),
    'workflow must not use the legacy combined verifier',
  )
  return failures
}

const failures = validate(workflow)
for (const fixture of [
  'tests/fixtures/dotnet-matrix/package-in-platform.yml',
  'tests/fixtures/dotnet-matrix/governance-in-platform.yml',
  'tests/fixtures/dotnet-matrix/missing-platform.yml',
]) {
  const fixtureFailures = validate(fs.readFileSync(fixture, 'utf8'))
  if (fixtureFailures.length === 0) failures.push(`${fixture} must be rejected`)
}

for (const [name, fragment] of [
  ['dotnet:matrix:plan', 'scripts/dotnet-matrix-plan.mjs'],
  ['dotnet:platform:verify', 'scripts/dotnet-platform-verify.mjs'],
  ['dotnet:package:verify', 'scripts/dotnet-package-verify.mjs'],
  ['dotnet:manifests:check', 'scripts/check-dotnet-manifests.mjs'],
  ['check:dotnet-matrix', 'scripts/check-dotnet-matrix-policy.mjs'],
]) {
  if (!scripts[name]?.includes(fragment))
    failures.push(`package.json must expose ${name}`)
}
if (!scripts['governance:check']?.includes('check:dotnet-matrix')) {
  failures.push('governance:check must include check:dotnet-matrix')
}
for (const fragment of [
  'FSUS_DOTNET_MAX_CPU_COUNT',
  "'--max-cpu-count'",
  "'--disable-parallel'",
  '`--maxcpucount:${maxCpuCount}`',
  'restoreDisableParallel: true',
]) {
  if (!platformVerifier.includes(fragment))
    failures.push(`platform verifier must include ${fragment}`)
}
const invalidConcurrency = spawnSync(
  process.execPath,
  ['scripts/dotnet-platform-verify.mjs', '--max-cpu-count', '0'],
  { encoding: 'utf8' },
)
if (
  invalidConcurrency.status === 0 ||
  !`${invalidConcurrency.stdout}${invalidConcurrency.stderr}`.includes(
    '--max-cpu-count must be a positive integer',
  )
) {
  failures.push('platform verifier must reject invalid concurrency overrides')
}

if (failures.length > 0) {
  console.error(
    failures.map((failure) => `[dotnet-matrix] ${failure}`).join('\n'),
  )
  process.exit(1)
}
console.log('[dotnet-matrix] policy and negative fixtures passed')
