import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { dockerEntries } from './update-surface-lib.mjs'

test('SDK cache Dockerfiles do not enter the repository update surface', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fsus-update-surface-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(path.join(root, 'emsdk-cache/emsdk-main/docker'), {
    recursive: true,
  })
  mkdirSync(path.join(root, 'owned/emsdk-cache'), { recursive: true })
  writeFileSync(path.join(root, 'Dockerfile'), 'FROM node:24\n')
  writeFileSync(
    path.join(root, 'emsdk-cache/emsdk-main/docker/Dockerfile'),
    'FROM ubuntu:24.04\n',
  )
  writeFileSync(
    path.join(root, 'owned/emsdk-cache/Dockerfile'),
    'FROM alpine:3\n',
  )
  const entries = dockerEntries(root)
  assert.deepEqual(entries.map((entry) => entry.packageName).sort(), [
    'alpine',
    'node',
  ])
  assert.equal(
    entries.find((entry) => entry.packageName === 'alpine').files[0],
    'owned/emsdk-cache/Dockerfile',
  )
})
