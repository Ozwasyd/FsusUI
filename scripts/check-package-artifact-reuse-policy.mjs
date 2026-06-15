import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const reusableQualityWorkflow = readFileSync(
  '.github/workflows/_quality.yml',
  'utf8',
)
const releaseGovernance = readFileSync('docs/release-governance.md', 'utf8')
const engineeringHandoff = readFileSync('docs/engineering-handoff.md', 'utf8')

function assert(condition, message) {
  if (!condition) {
    console.error(`[package-artifact-reuse] ${message}`)
    process.exit(1)
  }
}

function workflowJob(name) {
  const match = reusableQualityWorkflow.match(
    new RegExp(
      `\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z][\\w-]*:\\n|$)`,
      'u',
    ),
  )
  return match?.[1] ?? ''
}

const buildPackageJob = workflowJob('build-package')
const consumerInstallJob = workflowJob('consumer-install')
const docs = `${releaseGovernance}\n${engineeringHandoff}`

assert(
  scripts['check:package-artifact-reuse']?.includes(
    'scripts/check-package-artifact-reuse-policy.mjs',
  ),
  'package.json must expose check:package-artifact-reuse',
)
assert(
  scripts['governance:check']?.includes('check:package-artifact-reuse'),
  'governance:check must include the package artifact reuse guard',
)
assert(
  scripts['verify:release']?.includes('build:npm-package')
    && scripts['verify:release']?.includes('test:consumer-install'),
  'verify:release must keep an independent package build before consumer install',
)
assert(buildPackageJob, '_quality.yml must define build-package job')
assert(consumerInstallJob, '_quality.yml must define consumer-install job')
for (const fragment of [
  'pnpm run build:npm-package',
  'fsusui-npm-package-dist.tgz',
  'fsusui-npm-package-dist.sha256',
  'dist/element-plus',
  'sha256sum',
  'actions/upload-artifact@v4',
  'name: fsusui-npm-package-dist',
]) {
  assert(
    buildPackageJob.includes(fragment),
    `build-package job must include ${fragment}`,
  )
}
for (const fragment of [
  'actions/download-artifact@v4',
  'name: fsusui-npm-package-dist',
  'sha256sum -c',
  'tar -xzf',
  'pnpm run build:package-smoke',
  'pnpm test:consumer-install',
]) {
  assert(
    consumerInstallJob.includes(fragment),
    `consumer-install job must include ${fragment}`,
  )
}
for (const forbidden of [
  'pnpm run build:npm-package',
  'emscripten-core/setup-emsdk',
  'actions/cache@v4',
]) {
  assert(
    !consumerInstallJob.includes(forbidden),
    `consumer-install must consume the package artifact instead of running ${forbidden}`,
  )
}
for (const fragment of [
  'fsusui-npm-package-dist',
  'sha256sum',
  'consumer-install',
  'verify:release',
  'independent rebuild',
]) {
  assert(
    docs.includes(fragment),
    `docs must describe package artifact reuse: ${fragment}`,
  )
}

console.log('[package-artifact-reuse] ok')
