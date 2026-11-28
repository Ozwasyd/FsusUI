import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
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

const check = (root, profile = 'main', group = 'main') =>
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

const copyFixture = (root) => {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'fsusui-readiness-'))
  fs.cpSync(root, copy, { recursive: true })
  return copy
}
const mutate = (root, file, change) => {
  const target = path.join(root, 'manifests', file)
  const manifest = JSON.parse(fs.readFileSync(target, 'utf8'))
  change(manifest)
  fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`)
}

for (const testCase of cases) {
  const root = copyFixture(fixtureRoot)
  try {
    const manifests = path.join(root, 'manifests')
    if (testCase.mutation === 'missing')
      fs.rmSync(path.join(manifests, 'typecheck.json'))
    if (testCase.mutation === 'duplicate')
      fs.copyFileSync(
        path.join(manifests, 'dotnet-platform-linux.json'),
        path.join(manifests, 'dotnet-platform-linux-copy.json'),
      )
    if (testCase.mutation === 'sha')
      mutate(root, 'visual.json', (manifest) => {
        manifest.commitSha = 'cccccccccccccccccccccccccccccccccccccccc'
      })
    if (testCase.mutation === 'stale')
      mutate(root, 'visual.json', (manifest) => {
        manifest.run.id = '41'
      })
    if (testCase.mutation === 'attempt-mix')
      mutate(root, 'visual.json', (manifest) => {
        manifest.run.attempt = '2'
      })
    if (testCase.mutation === 'digest')
      mutate(root, 'build-package.json', (manifest) => {
        manifest.artifacts[0].sha256 = 'd'.repeat(64)
      })
    if (testCase.mutation === 'binding-mismatch') {
      fs.writeFileSync(
        path.join(root, 'artifacts/other-candidate.tgz'),
        'different-candidate\n',
      )
      mutate(root, 'consumer-verify.json', (manifest) => {
        manifest.artifacts[0].path = 'artifacts/nonexistent-remote-only.tgz'
        manifest.artifacts[0].sha256 = 'e'.repeat(64)
      })
    }
    if (testCase.mutation === 'cancelled')
      mutate(root, 'visual.json', (manifest) => {
        manifest.status = 'cancelled'
      })
    if (testCase.mutation === 'missing-platform')
      fs.rmSync(path.join(manifests, 'dotnet-platform-macos.json'))

    assert.throws(
      () => check(root),
      new RegExp(testCase.expected, 'iu'),
      testCase.name,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

// Release aggregation must reject a manifest emitted by the nightly workflow group.
{
  const root = copyFixture(fixtureRoot)
  try {
    const manifests = load(root).map(({ file, manifest }) => ({
      file,
      manifest: { ...manifest, workflowGroup: 'release' },
    }))
    manifests[0].manifest.workflowGroup = 'nightly'
    assert.throws(
      () =>
        validateReadiness({
          manifests,
          profile: 'release',
          group: 'release',
          commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          runId: '42',
          runAttempt: '1',
          root,
        }),
      /workflow group mismatch/iu,
      'release must reject nightly-workflow manifests',
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

// Exercise emit + check CLI end-to-end on a temporary root.
{
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fsusui-readiness-cli-'))
  try {
    const tarball = path.join(root, 'candidate.tgz')
    fs.writeFileSync(tarball, 'cli-candidate\n')
    const env = {
      ...process.env,
      GITHUB_SHA: 'b'.repeat(40),
      GITHUB_RUN_ID: '99',
      GITHUB_RUN_ATTEMPT: '1',
    }
    const emit = (extraArgs) => {
      const result = spawnSync(
        process.execPath,
        [
          path.resolve('scripts/ci-readiness.mjs'),
          'emit',
          '--root',
          root,
          '--evidence-root',
          path.join(root, '.readiness'),
          '--group',
          'main',
          '--status',
          'success',
          ...extraArgs,
        ],
        { encoding: 'utf8', env },
      )
      assert.equal(result.status, 0, result.stderr || result.stdout)
    }
    for (const gate of [
      'static-quality',
      'typecheck',
      'unit',
      'markdown-xss',
      'build-demo',
      'dotnet-package',
    ]) {
      emit(['--gate', gate])
    }
    emit(['--gate', 'visual', '--dimension', 'profile=full'])
    emit([
      '--gate',
      'build-package',
      '--artifact',
      'npm-candidate=candidate.tgz',
    ])
    emit([
      '--gate',
      'consumer-verify',
      '--artifact',
      'npm-candidate=candidate.tgz',
    ])
    for (const platform of ['linux', 'windows', 'macos']) {
      emit([
        '--gate',
        'dotnet-platform',
        '--dimension',
        `platform=${platform}`,
      ])
    }
    const checkResult = spawnSync(
      process.execPath,
      [
        path.resolve('scripts/ci-readiness.mjs'),
        'check',
        '--root',
        path.join(root, '.readiness'),
        '--profile',
        'main',
        '--workflow-group',
        'main',
        '--commit',
        'b'.repeat(40),
        '--run-id',
        '99',
        '--run-attempt',
        '1',
      ],
      { encoding: 'utf8' },
    )
    assert.equal(checkResult.status, 0, checkResult.stderr || checkResult.stdout)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

console.log(
  `[ci-readiness] fixtures passed (profiles=3, invalid=${cases.length}, cli=ok)`,
)
