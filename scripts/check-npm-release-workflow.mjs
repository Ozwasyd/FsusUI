import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const publish = readFileSync('.github/workflows/publish-npm.yml', 'utf8')
const recovery = readFileSync(
  '.github/workflows/recover-npm-dist-tag.yml',
  'utf8',
)
const payloadSchema = JSON.parse(
  readFileSync('spec/releases/fsusui-npm-published-v1.schema.json', 'utf8'),
)
const receiptSchema = JSON.parse(
  readFileSync(
    'spec/releases/fsusui-release-dispatch-receipt.schema.json',
    'utf8',
  ),
)

for (const fragment of [
  'release:concurrency:plan',
  'needs: [quality, plan]',
  'needs: [quality, plan, preflight]',
  'group: ${{ needs.plan.outputs.concurrency-group }}',
  '--candidate-manifest .npm-candidate/fsusui-npm-candidate.manifest.json',
  'Check channel monotonicity before lock',
  'Check channel monotonicity after lock',
  "if: steps.monotonicity.outputs.action == 'publish'",
]) {
  assert.ok(
    publish.includes(fragment),
    `publish workflow is missing ${fragment}`,
  )
}
assert.ok(!publish.includes('publish-npm-${{ github.ref }}'))
assert.ok(!publish.includes('NPM_RECOVERY_TOKEN'))

for (const fragment of [
  'name: fsusblog-consumer-gate',
  'Verify stable release against the #318 receipt',
  'fsusblog-consumer-gate.receipt.sha256',
  'fsusui-release-dispatch.mjs verify',
  'id: publish',
  'echo "published=true" >> "$GITHUB_OUTPUT"',
  "if: steps.publish.outputs.published == 'true' && needs.plan.outputs.dist-tag == 'latest'",
  'FSUS_RELEASE_TRAIN_APP_ID: ${{ vars.FSUS_RELEASE_TRAIN_APP_ID }}',
  'FSUS_RELEASE_TRAIN_APP_PRIVATE_KEY: ${{ secrets.FSUS_RELEASE_TRAIN_APP_PRIVATE_KEY }}',
  'fsusui-release-dispatch.mjs dispatch',
  '--publish-run-id "$GITHUB_RUN_ID"',
  'name: fsusui-release-dispatch-${{ github.run_id }}',
  'if-no-files-found: error',
]) {
  assert.ok(
    publish.includes(fragment),
    `publish workflow is missing release dispatch contract: ${fragment}`,
  )
}
for (const forbidden of [
  'PERSONAL_ACCESS_TOKEN',
  'FSUS_RELEASE_TRAIN_TOKEN',
  'GH_TOKEN',
  'github.token',
  'secrets.GITHUB_TOKEN',
]) {
  assert.ok(
    !publish.includes(forbidden),
    `publish workflow must not use ${forbidden} for cross-repository dispatch`,
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
assert.equal(payloadSchema.additionalProperties, false)
assert.deepEqual(
  [...payloadSchema.required].sort(),
  Object.keys(payloadSchema.properties).sort(),
)
assert.equal(payloadSchema.properties.schemaVersion.const, 1)
assert.equal(payloadSchema.properties.distTag.const, 'latest')
assert.equal(
  payloadSchema.properties.registry.const,
  'https://registry.npmjs.org/',
)
assert.equal(receiptSchema.additionalProperties, false)
assert.deepEqual(
  [...receiptSchema.required].sort(),
  Object.keys(receiptSchema.properties).sort(),
)

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

await import('./check-fsusblog-consumer-workflow.mjs')
await import('./test-fsusui-release-dispatch.mjs')
await import('./test-cross-repo-app-verifier.mjs')
