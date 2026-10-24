import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { sourceDockerfiles } from './update-surface-lib.mjs'

const fixture = (t, git = true) => {
  const root = mkdtempSync(path.join(tmpdir(), 'update-surface-source-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  if (git) execFileSync('git', ['init', '--quiet', root], { stdio: 'pipe' })
  return root
}
const write = (root, file, content) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  writeFileSync(path.join(root, file), content)
}

test('tracked Dockerfiles remain source even under an ignored directory', (t) => {
  const root = fixture(t)
  write(root, '.gitignore', '/vendor/\n')
  write(root, 'Dockerfile', 'FROM node:22\n')
  write(root, 'vendor/retained/Dockerfile', 'FROM ubuntu:24.04\n')
  execFileSync(
    'git',
    ['add', '-f', 'Dockerfile', 'vendor/retained/Dockerfile'],
    { cwd: root, stdio: 'pipe' },
  )
  assert.deepEqual(sourceDockerfiles(root), [
    'Dockerfile',
    'vendor/retained/Dockerfile',
  ])
})

test('new nonignored Dockerfiles are discovered before staging', (t) => {
  const root = fixture(t)
  write(root, 'new service/Dockerfile.worker', 'FROM busybox:1.36\n')
  assert.deepEqual(sourceDockerfiles(root), ['new service/Dockerfile.worker'])
})

test('ignored vendor Dockerfiles do not become dependency update targets', (t) => {
  const root = fixture(t)
  write(root, '.gitignore', '/emsdk-cache/\n')
  write(root, 'emsdk-cache/emsdk-main/docker/Dockerfile', 'FROM ubuntu:22.04\n')
  assert.deepEqual(sourceDockerfiles(root), [])
})

test('Git ignore exceptions retain new source and NUL-delimited paths', (t) => {
  const root = fixture(t)
  write(root, '.gitignore', '/vendor/*\n!/vendor/source/\n')
  write(root, 'vendor/cache/Dockerfile', 'FROM ubuntu:22.04\n')
  write(root, 'vendor/source/Dockerfile', 'FROM node:22\n')
  write(root, 'space and\nnewline/Dockerfile.test', 'FROM node:22\n')
  assert.deepEqual(sourceDockerfiles(root), [
    'space and\nnewline/Dockerfile.test',
    'vendor/source/Dockerfile',
  ])
})

test('a repository subdirectory cannot silently change the source root', (t) => {
  const root = fixture(t)
  const nested = path.join(root, 'nested')
  mkdirSync(nested)
  assert.throws(() => sourceDockerfiles(nested), /Git repository root/u)
})

test('a nonrepository root fails instead of falling back to filesystem discovery', (t) => {
  const root = fixture(t, false)
  write(root, 'Dockerfile', 'FROM node:22\n')
  assert.throws(() => sourceDockerfiles(root), /not a git repository/u)
})

test('both new and tracked symlink Dockerfiles fail closed', (t) => {
  const root = fixture(t)
  const outside = fixture(t, false)
  write(outside, 'Dockerfile', 'FROM node:22\n')
  symlinkSync(path.join(outside, 'Dockerfile'), path.join(root, 'Dockerfile'))
  assert.throws(() => sourceDockerfiles(root), /without symlinks/u)
  execFileSync('git', ['add', 'Dockerfile'], { cwd: root, stdio: 'pipe' })
  assert.throws(() => sourceDockerfiles(root), /without symlinks/u)
})

test('a tracked Dockerfile cannot escape through a symlink parent directory', (t) => {
  const root = fixture(t)
  const outside = fixture(t, false)
  write(root, 'source/Dockerfile', 'FROM node:22\n')
  write(outside, 'Dockerfile', 'FROM ubuntu:22.04\n')
  execFileSync('git', ['add', 'source/Dockerfile'], {
    cwd: root,
    stdio: 'pipe',
  })
  rmSync(path.join(root, 'source'), { recursive: true })
  symlinkSync(outside, path.join(root, 'source'), 'dir')
  assert.throws(() => sourceDockerfiles(root), /without symlinks/u)
})
