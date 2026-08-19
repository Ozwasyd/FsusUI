#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateManifest } from './native-ime-matrix.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixtures = resolve(root, 'tests/fixtures/native-ime-matrix')
const candidate = 'c2e4b80738ccb54ad21a2d13883a12f6fb11c8c2'
const load = (name) => JSON.parse(readFileSync(resolve(fixtures, name), 'utf8'))

assert.equal(validateManifest(load('valid-manifest.json'), candidate).valid, true)
for (const name of [
  'invalid-manifest-missing-trace.json',
  'invalid-manifest-synthetic-only.json',
  'invalid-manifest-wrong-candidate.json',
]) {
  assert.equal(validateManifest(load(name), candidate).valid, false, name)
}

const synthetic = validateManifest(load('invalid-manifest-synthetic-only.json'), candidate)
assert.match(synthetic.errors.join('\n'), /synthetic/)

console.log('[native-ime-matrix-self-test] PASS manifest integrity cases')
