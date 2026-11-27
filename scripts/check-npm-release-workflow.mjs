import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const publish = readFileSync('.github/workflows/publish-npm.yml', 'utf8')
const recovery = readFileSync(
  '.github/workflows/recover-npm-dist-tag.yml',
  'utf8',
)

for (const fragment of [
  'release:concurrency:plan',
  'needs: [quality, quality-playwright]',
  'uses: ./.github/workflows/_quality-readiness.yml',
  'needs: [quality, quality-readiness, plan]',
  'needs: [quality, quality-readiness, plan, preflight]',
  'group: ${{ needs.plan.outputs.concurrency-group }}',
  '--candidate-manifest .npm-candidate/fsusui-npm-candidate.manifest.json',
  'Check channel monotonicity before lock',
  'Check channel monotonicity after lock',
  "if: steps.monotonicity.outputs.action == 'publish'",
  'id: publish',
  'echo "published=true" >> "$GITHUB_OUTPUT"',
  'verify-published-consumer-contracts:',
  'tests/consumer-contracts/run-consumer-contracts.mjs',
]) {
  assert.ok(
    publish.includes(fragment),
    `publish workflow is missing ${fragment}`,
  )
}
assert.ok(!publish.includes('publish-npm-${{ github.ref }}'))
assert.ok(!publish.includes('NPM_RECOVERY_TOKEN'))

for (const forbidden of [
  'PERSONAL_ACCESS_TOKEN',
  'FSUS_RELEASE_TRAIN_TOKEN',
  'FSUS_RELEASE_TRAIN_APP_ID',
  'FSUS_RELEASE_TRAIN_APP_PRIVATE_KEY',
  'FSUS_CROSS_REPO_APP_ID',
  'FSUS_CROSS_REPO_APP_PRIVATE_KEY',
  '_fsusblog-consumer-gate.yml',
  'fsusblog-consumer',
  'fsusui-release-dispatch',
  'GH_TOKEN',
  'github.token',
]) {
  assert.ok(
    !publish.includes(forbidden),
    `publish workflow must not contain ${forbidden}`,
  )
}

for (const forbidden of [
  'pnpm run package:candidate:build',
  'pnpm run build:npm-package',
  'npm pack',
  'working-directory: dist/element-plus',
]) {
  assert.ok(
    !publish.includes(forbidden),
    `publish workflow must not rebuild/repack the candidate with ${forbidden}`,
  )
}

for (const fragment of [
  'workflow_dispatch:',
  'expected_current:',
  'reason:',
  'environment: npm-recovery',
  'group: ${{ needs.plan.outputs.concurrency-group }}',
  '--mode recovery',
  'NPM_RECOVERY_TOKEN',
  'npm dist-tag add',
]) {
  assert.ok(
    recovery.includes(fragment),
    `recovery workflow is missing ${fragment}`,
  )
}
assert.ok(!recovery.includes('npm publish'))

console.log('npm release workflow lock and recovery policy passed.')
