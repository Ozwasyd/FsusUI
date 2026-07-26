import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const scripts = packageJson.scripts ?? {}
const reusableQualityWorkflow = readFileSync(
  '.github/workflows/_quality.yml',
  'utf8',
)
const publishWorkflow = readFileSync(
  '.github/workflows/publish-npm.yml',
  'utf8',
)
const releaseGovernance = readFileSync('docs/releases/governance.md', 'utf8')
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
  scripts['governance:check']?.includes('check:package-artifact-reuse') &&
    scripts['governance:check']?.includes('test:package-candidate'),
  'governance:check must include candidate policy and fixture guards',
)
assert(
  scripts['verify:release']?.includes('package:candidate:build') &&
    scripts['verify:release']?.includes('package:candidate:verify') &&
    scripts['verify:release']?.includes('test:consumer-install'),
  'verify:release must build, verify, and consume one immutable candidate',
)
assert(buildPackageJob, '_quality.yml must define build-package job')
assert(consumerInstallJob, '_quality.yml must define consumer-install job')
for (const fragment of [
  'pnpm run package:candidate:build',
  'fsusui-npm-candidate.tgz',
  'fsusui-npm-candidate.sha256',
  'fsusui-npm-candidate.manifest.json',
  'actions/upload-artifact@v4',
  'name: fsusui-npm-candidate',
  'candidate-digest',
]) {
  assert(
    buildPackageJob.includes(fragment),
    `build-package job must include ${fragment}`,
  )
}
for (const fragment of [
  'actions/download-artifact@v4',
  'name: fsusui-npm-candidate',
  'Verify immutable npm candidate and package smoke',
  'package:candidate:verify',
  'pnpm test:consumer-install -- .npm-candidate/fsusui-npm-candidate.tgz',
  'needs.build-package.outputs.candidate-digest',
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
  'name: fsusui-npm-candidate',
  'package:candidate:verify',
  'needs.quality.outputs.npm-candidate-digest',
  'npm publish ./.npm-candidate/fsusui-npm-candidate.tgz',
]) {
  assert(
    publishWorkflow.includes(fragment),
    `publish-npm.yml must publish the tested candidate: ${fragment}`,
  )
}
for (const forbidden of [
  'pnpm run build:npm-package',
  'pnpm run package:candidate:build',
  'working-directory: dist/element-plus',
]) {
  assert(
    !publishWorkflow.includes(forbidden),
    `publish-npm.yml must not rebuild or publish a mutable directory: ${forbidden}`,
  )
}
for (const fragment of [
  'fsusui-npm-candidate',
  'candidate manifest',
  '同一个 tarball',
  'consumer-install',
  'verify:release',
  'package:candidate:compare',
]) {
  assert(
    docs.includes(fragment),
    `docs must describe package artifact reuse: ${fragment}`,
  )
}

console.log('[package-artifact-reuse] ok')
