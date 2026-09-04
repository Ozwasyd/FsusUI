import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync(
  '.github/workflows/_fsusblog-consumer-gate.yml',
  'utf8',
)

const validate = (source) => {
  for (const fragment of [
    'workflow_call:',
    'candidate-artifact-name:',
    'candidate-manifest-name:',
    'candidate-digest:',
    'quality-candidate-digest:',
    'matrix-artifact-name:',
    'default: Ozwasyd/FsusBlog',
    'FSUS_CROSS_REPO_APP_PRIVATE_KEY:',
    "if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')",
    'cross-repo-app-verifier.mjs',
    'actions/create-github-app-token@v2',
    'permission-contents: read',
    'Resolve and freeze FsusBlog default-branch head',
    'commit_sha="$(gh api "repos/$TARGET_REPOSITORY/commits/$default_branch"',
    "grep -Eq '^[a-f0-9]{40}$'",
    "test '${{ inputs.matrix-artifact-name }}' = 'consumer-matrix-release'",
    'name: ${{ inputs.matrix-artifact-name }}',
    'cross-repo-candidate-binding.mjs',
    "--candidate-digest '${{ inputs.candidate-digest }}'",
    "--quality-candidate-digest '${{ inputs.quality-candidate-digest }}'",
    '--matrix-directory consumer-matrix/receipts',
    'candidate-binding-before.json',
    'candidate-binding-after.json',
    'cmp candidate-binding-before.json candidate-binding-after.json',
    'ref: ${{ steps.resolve.outputs.commit_sha }}',
    'persist-credentials: false',
    'git diff --exit-code',
    'git status --porcelain',
    "p.scripts?.['verify:fsusui-candidate']",
    "for (const n of ['vue','vite','typescript','vue-tsc'])",
    'fsusblog-consumer-runner.mjs',
    'cross-repo-receipt.mjs',
    'name: fsusblog-consumer-gate',
    'fsusblog-consumer-gate.receipt.sha256',
    'if: always()',
  ]) {
    assert.ok(
      source.includes(fragment),
      `FsusBlog workflow is missing ${fragment}`,
    )
  }
  for (const forbidden of [
    'ref: ${{ steps.resolve.outputs.default_branch }}',
    'ref: main',
    'ref: master',
    'continue-on-error',
    'npm view',
    'npm pack',
    'npm.pkg.github.com',
    'repository_dispatch',
    'npm publish',
    'permissions:\n  contents: write',
  ]) {
    assert.ok(
      !source.includes(forbidden),
      `FsusBlog workflow contains forbidden contract: ${forbidden}`,
    )
  }
}

validate(workflow)

for (const [name, mutation, expected] of [
  [
    'floating checkout',
    (value) =>
      value.replace(
        'ref: ${{ steps.resolve.outputs.commit_sha }}',
        'ref: ${{ steps.resolve.outputs.default_branch }}',
      ),
    /missing ref|forbidden contract/u,
  ],
  [
    'missing formal command',
    (value) => value.replace('verify:fsusui-candidate', 'missing-command'),
    /missing .*verify:fsusui-candidate/u,
  ],
  [
    'missing clean postcondition',
    (value) => value.replaceAll('git diff --exit-code', 'git diff --stat'),
    /missing .*git diff --exit-code/u,
  ],
]) {
  assert.throws(() => validate(mutation(workflow)), expected, name)
}

console.log('FsusBlog pinned consumer workflow contract passed.')
