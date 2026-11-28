import {
  assertExcludesAll,
  assertIncludesAll,
  assertRegisteredGovernanceScript,
  createPolicyAssert,
  extractWorkflowJob,
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
const consumerVerifyJob = extractWorkflowJob(
  reusableQualityWorkflow,
  'consumer-verify',
)

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
  ['package:candidate:build', 'package:candidate:verify'],
  (fragment) => `verify:release must include ${fragment}`,
)
assert(buildPackageJob, '_quality.yml must define build-package job')
assert(consumerVerifyJob, '_quality.yml must define consumer-verify job')

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
    'artifacts: npm-candidate=dist/npm-candidate/fsusui-npm-candidate.tgz',
  ],
  (fragment) => `build-package job must include ${fragment}`,
)
assertIncludesAll(
  assert,
  consumerVerifyJob,
  [
    'actions/download-artifact@v4',
    'name: fsusui-npm-candidate',
    'node scripts/package-candidate.mjs verify',
    'node scripts/verify-v2-consumer-candidate.mjs',
    'npm-candidate=.npm-candidate/fsusui-npm-candidate.tgz',
    'needs.build-package.outputs.candidate-digest',
  ],
  (fragment) => `consumer-verify job must include ${fragment}`,
)

assertExcludesAll(
  assert,
  consumerVerifyJob,
  [
    'pnpm run build:npm-package',
    'emscripten-core/setup-emsdk',
    'actions/cache@v4',
    'continue-on-error',
  ],
  (forbidden) => `consumer-verify must not contain ${forbidden}`,
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
    'working-directory: dist/fsusui',
  ],
  (forbidden) =>
    `publish-npm.yml must not rebuild or publish a mutable directory: ${forbidden}`,
)

console.log('[package-artifact-reuse] ok')
