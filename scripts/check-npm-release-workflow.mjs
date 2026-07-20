import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const publish = readFileSync('.github/workflows/publish-npm.yml', 'utf8')
const recovery = readFileSync(
  '.github/workflows/recover-npm-dist-tag.yml',
  'utf8',
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
