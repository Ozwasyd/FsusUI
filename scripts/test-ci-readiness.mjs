import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { validateReadiness } from './ci-readiness-contract.mjs'

const fixtureRoot = path.resolve('tests/fixtures/ci-readiness/valid')
const cases = JSON.parse(
  fs.readFileSync('tests/fixtures/ci-readiness/invalid-cases.json', 'utf8'),
)
const load = (root) =>
  fs
    .readdirSync(path.join(root, 'manifests'))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      file,
      manifest: JSON.parse(
        fs.readFileSync(path.join(root, 'manifests', file), 'utf8'),
      ),
    }))
const check = (root, profile = 'stable', group = 'stable') =>
  validateReadiness({
    manifests: load(root).map(({ file, manifest }) => ({
      file,
      manifest: { ...manifest, workflowGroup: group },
    })),
    profile,
    group,
    commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    runId: '42',
    runAttempt: '1',
    root,
  })

check(fixtureRoot)
check(fixtureRoot, 'nightly', 'nightly')
check(fixtureRoot, 'release', 'release')
for (const testCase of cases) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsusui-readiness-'))
  fs.cpSync(fixtureRoot, root, { recursive: true })
  const manifests = path.join(root, 'manifests')
  if (testCase.mutation === 'missing')
    fs.rmSync(path.join(manifests, 'typecheck.json'))
  if (testCase.mutation === 'duplicate')
    fs.copyFileSync(
      path.join(manifests, 'unit-1.json'),
      path.join(manifests, 'unit-1-copy.json'),
    )
  const mutate = (file, change) => {
    const target = path.join(manifests, file)
    const manifest = JSON.parse(fs.readFileSync(target, 'utf8'))
    change(manifest)
    fs.writeFileSync(target, `${JSON.stringify(manifest)}\n`)
  }
  if (testCase.mutation === 'sha')
    mutate('visual.json', (manifest) => {
      manifest.commitSha = 'cccccccccccccccccccccccccccccccccccccccc'
    })
  if (testCase.mutation === 'stale')
    mutate('visual.json', (manifest) => {
      manifest.run.id = '41'
    })
  if (testCase.mutation === 'digest')
    mutate('build-package.json', (manifest) => {
      manifest.artifacts[0].sha256 =
        'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
    })
  if (testCase.mutation === 'cancelled')
    mutate('visual.json', (manifest) => {
      manifest.status = 'cancelled'
    })
  assert.throws(
    () => check(root),
    new RegExp(testCase.expected, 'iu'),
    testCase.name,
  )
  fs.rmSync(root, { recursive: true, force: true })
}
console.log(`[ci-readiness-fixtures] profiles=3 invalid=${cases.length}`)
