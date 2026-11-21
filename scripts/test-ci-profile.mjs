import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { verifyReleaseIdentity } from './release-profile-identity.mjs'

const run = (args) =>
  execFileSync(process.execPath, ['scripts/ci-profile.mjs', ...args], {
    encoding: 'utf8',
  })

for (const group of ['main', 'nightly', 'release']) {
  const plan = JSON.parse(run(['plan', '--group', group]))
  assert.equal(plan.group, group)
  assert.ok(plan.gates.length > 0)
  assert.equal(plan.execution, 'dry-run')
}
run(['check'])
const invalid = spawnSync(
  process.execPath,
  [
    'scripts/ci-profile.mjs',
    'check',
    '--workflow',
    'tests/fixtures/ci-profile/publish-missing-release-group.yml',
  ],
  { encoding: 'utf8' },
)
assert.notEqual(invalid.status, 0)
assert.match(`${invalid.stdout}\n${invalid.stderr}`, /group: release/u)

const sourceVersion = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), 'vue/packages/element-plus/package.json'),
    'utf8',
  ),
).version
const mismatchedTag = `v${sourceVersion}-mismatch`

const candidateRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'fsusui-release-profile-'),
)
try {
  const candidateManifestPath = path.join(candidateRoot, 'candidate.json')
  const commitSha = 'a'.repeat(40)
  const candidate = {
    sourceProfile: 'Release',
    commitSha,
    package: { name: '@ozwasyd/element-plus', version: sourceVersion },
    artifact: { sha256: 'b'.repeat(64) },
  }
  fs.writeFileSync(candidateManifestPath, `${JSON.stringify(candidate)}\n`)
  assert.equal(
    verifyReleaseIdentity({
      repoRoot: process.cwd(),
      candidateManifestPath,
      releaseTag: `v${sourceVersion}`,
      commitSha,
    }).packageVersion,
    sourceVersion,
  )
  assert.throws(
    () =>
      verifyReleaseIdentity({
        repoRoot: process.cwd(),
        candidateManifestPath,
        releaseTag: mismatchedTag,
        commitSha,
      }),
    /does not match/u,
  )
  assert.throws(
    () =>
      verifyReleaseIdentity({
        repoRoot: process.cwd(),
        candidateManifestPath,
        releaseTag: `v${sourceVersion}`,
        commitSha: 'c'.repeat(40),
      }),
    /commit SHA/u,
  )
} finally {
  fs.rmSync(candidateRoot, { recursive: true, force: true })
}
console.log(
  '[ci-profile-fixtures] plans=3 invalid-workflow=1 invalid-identity=2',
)
