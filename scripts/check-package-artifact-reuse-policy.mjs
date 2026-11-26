import {
  assertExcludesAll,
  assertIncludesAll,
  assertRegisteredGovernanceScript,
  createPolicyAssert,
  extractWorkflowJob,
  loadGovernanceDocs,
  loadScriptsMap,
  readRepoText,
} from './lib/ci-policy-utils.mjs'

const assert = createPolicyAssert('package-artifact-reuse')
const scripts = loadScriptsMap()
const reusableQualityWorkflow = readRepoText('.github/workflows/_quality.yml')
const publishWorkflow = readRepoText('.github/workflows/publish-npm.yml')
const buildPackageJob = extractWorkflowJob(
  reusableQualityWorkflow,
  'build-package',
)
const consumerInstallJob = extractWorkflowJob(
  reusableQualityWorkflow,
  'consumer-install',
)
const docs = loadGovernanceDocs()

assertRegisteredGovernanceScript(
  assert,
  scripts,
  'check:package-artifact-reuse',
  'scripts/check-package-artifact-reuse-policy.mjs',
  'candidate policy guard',
)
assert(
  scripts['governance:check']?.includes('test:package-candidate'),
  'governance:check must include candidate fixture guard',
)
assertIncludesAll(
  assert,
  scripts['verify:release'] ?? '',
  [
    'package:candidate:build',
    'package:candidate:verify',
    'test:consumer-matrix',
  ],
  (fragment) => `verify:release must include ${fragment}`,
)
assert(buildPackageJob, '_quality.yml must define build-package job')
assert(consumerInstallJob, '_quality.yml must define consumer-install job')

assertIncludesAll(
  assert,
  buildPackageJob,
  [
    'pnpm run package:candidate:build',
    'fsusui-npm-candidate.tgz',
    'fsusui-npm-candidate.sha256',
    'fsusui-npm-candidate.manifest.json',
    'actions/upload-artifact@v4',
    'name: fsusui-npm-candidate',
    'candidate-digest',
    'artifacts: npm-candidate=dist/npm-candidate',
  ],
  (fragment) => `build-package job must include ${fragment}`,
)
assertIncludesAll(
  assert,
  consumerInstallJob,
  [
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
  ],
  (fragment) => `consumer-install job must include ${fragment}`,
)

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

assertExcludesAll(
  assert,
  consumerInstallJob,
  [
    'pnpm run build:npm-package',
    'emscripten-core/setup-emsdk',
    'actions/cache@v4',
    'continue-on-error',
  ],
  (forbidden) => `consumer-install must not contain ${forbidden}`,
)
assertIncludesAll(
  assert,
  publishWorkflow,
  [
    'name: fsusui-npm-candidate',
    'package:candidate:verify',
    'needs.quality.outputs.npm-candidate-digest',
    'npm publish ./.npm-candidate/fsusui-npm-candidate.tgz',
  ],
  (fragment) => `publish-npm.yml must publish the tested candidate: ${fragment}`,
)
assertExcludesAll(
  assert,
  publishWorkflow,
  [
    'pnpm run build:npm-package',
    'pnpm run package:candidate:build',
    'working-directory: dist/element-plus',
  ],
  (forbidden) =>
    `publish-npm.yml must not rebuild or publish a mutable directory: ${forbidden}`,
)
assertIncludesAll(
  assert,
  docs,
  [
    'fsusui-npm-candidate',
    'candidate manifest',
    '同一个 tarball',
    'consumer-install',
    'verify:release',
    'package:candidate:compare',
  ],
  (fragment) => `docs must describe package artifact reuse: ${fragment}`,
)

console.log('[package-artifact-reuse] ok')
