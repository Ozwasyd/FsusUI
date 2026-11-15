import process from 'node:process'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, URL } from 'node:url'
import { platformEnvironment } from '../scripts/dotnet-platform-environment.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))

const fixture = (t) => {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), 'fsusui-native-revision-'),
  )
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  execFileSync('git', ['init', '--quiet', directory])
  execFileSync(
    'git',
    [
      '-c',
      'user.name=Native environment fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      'fixture',
    ],
    { cwd: directory },
  )
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: directory,
    encoding: 'utf8',
  }).trim()
  return { directory, sha }
}

test('local native execution receives the actual checkout identity', (t) => {
  const { directory, sha } = fixture(t)
  const original = { PATH: process.env.PATH, GITHUB_SHA: '0'.repeat(40) }
  const result = platformEnvironment(directory, original)
  assert.equal(result.GITHUB_SHA, sha)
  assert.equal(result.FSUS_WEBVIEW_CANDIDATE_SHA, sha)
  assert.equal(result.PATH, original.PATH)
  assert.equal(original.GITHUB_SHA, '0'.repeat(40))
  assert.equal(original.FSUS_WEBVIEW_CANDIDATE_SHA, undefined)
})

test('matching declared native candidate remains valid', (t) => {
  const { directory, sha } = fixture(t)
  const result = platformEnvironment(directory, {
    FSUS_WEBVIEW_CANDIDATE_SHA: sha,
  })
  assert.equal(result.FSUS_WEBVIEW_CANDIDATE_SHA, sha)
  assert.equal(result.GITHUB_SHA, sha)
})

test('a mismatched or empty declared native candidate is rejected', (t) => {
  const { directory } = fixture(t)
  for (const supplied of ['0'.repeat(40), ''])
    assert.throws(
      () =>
        platformEnvironment(directory, {
          FSUS_WEBVIEW_CANDIDATE_SHA: supplied,
        }),
      /Native platform candidate mismatch/,
    )
})

test('the real platform entry rejects wrong identity before replacing outputs', (t) => {
  const { directory } = fixture(t)
  const sentinel = path.join(directory, 'preserve.txt')
  writeFileSync(sentinel, 'existing evidence')
  const result = spawnSync(
    process.execPath,
    [
      'scripts/dotnet-platform-verify.mjs',
      '--output',
      path.join(directory, 'manifest.json'),
    ],
    {
      cwd: root,
      env: { ...process.env, FSUS_WEBVIEW_CANDIDATE_SHA: '0'.repeat(40) },
      encoding: 'utf8',
    },
  )
  assert.equal(result.status, 1)
  assert.match(result.stderr, /Native platform candidate mismatch/)
  assert.equal(readFileSync(sentinel, 'utf8'), 'existing evidence')
})
