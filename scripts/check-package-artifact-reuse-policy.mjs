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
    scripts['verify:release']?.includes('test:consumer-matrix'),
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
  'Verify immutable npm candidate',
  'node scripts/package-candidate.mjs verify',
  'npm-candidate=.npm-candidate',
  'scripts/consumer-matrix-impact.mjs',
  'pnpm test:consumer-matrix:fixtures',
  'pnpm test:consumer-matrix --',
  '--candidate .npm-candidate/fsusui-npm-candidate.tgz',
  '--output .consumer-matrix/receipts',
  'name: consumer-matrix-${{ inputs.group }}',
  'consumer-matrix=.consumer-matrix',
  'no-package-impact',
  'needs.build-package.outputs.candidate-digest',
]) {
  assert(
    consumerInstallJob.includes(fragment),
    `consumer-install job must include ${fragment}`,
  )
}
const npmCandidateDownload = consumerInstallJob.match(
  /^ {6}- uses: actions\/download-artifact@v4\n {8}with:\n {10}name: fsusui-npm-candidate\n {10}path: \.npm-candidate$/mu,
)
const npmCandidateVerify = consumerInstallJob.match(
  /^ {6}- name: Verify immutable npm candidate\n {8}env:\n {10}EXPECTED_CANDIDATE_DIGEST:[^\n]*needs\.build-package\.outputs\.candidate-digest[^\n]*\n {8}run: \|\n {10}node scripts\/package-candidate\.mjs verify --tarball \.npm-candidate\/fsusui-npm-candidate\.tgz --commit "\$GITHUB_SHA"\n {10}digest=[^\n]+\n {10}test -n "\$EXPECTED_CANDIDATE_DIGEST"\n {10}test "\$digest" = "\$EXPECTED_CANDIDATE_DIGEST"$/mu,
)
assert(
  npmCandidateDownload &&
    npmCandidateVerify &&
    npmCandidateDownload.index < npmCandidateVerify.index &&
    npmCandidateVerify.index < consumerInstallJob.indexOf('pnpm/action-setup'),
  'consumer-install must unconditionally download and verify the npm candidate before impact-gated dependencies',
)
assert(
  buildPackageJob.includes('artifacts: npm-candidate=dist/npm-candidate'),
  'build-package must record the same npm candidate in its readiness manifest',
)
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
assert(
  !consumerInstallJob.includes('continue-on-error'),
  'consumer-install required matrix must not continue on error',
)
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
