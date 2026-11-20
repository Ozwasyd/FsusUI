import assert from 'node:assert/strict'
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

const root = process.cwd()

test('Wasm bundle identity follows real Markdown source inputs but excludes test fixtures', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'fsus-wasm-inputs-'))
  t.after(() => rm(fixture, { recursive: true, force: true }))
  await mkdir(path.join(fixture, 'scripts'), { recursive: true })
  await mkdir(path.join(fixture, 'vue/packages/wasm/__tests__'), {
    recursive: true,
  })
  await mkdir(path.join(fixture, 'vue/packages/wasm/nested'), {
    recursive: true,
  })
  await symlink(
    path.join(root, 'node_modules'),
    path.join(fixture, 'node_modules'),
    'dir',
  )
  await writeFile(
    path.join(fixture, 'scripts/test-artifact-cache.mjs'),
    await readFile(path.join(root, 'scripts/test-artifact-cache.mjs')),
  )
  const source = path.join(
    fixture,
    'vue/packages/wasm/markdown-syntax-identity.ts',
  )
  const worker = path.join(
    fixture,
    'vue/packages/wasm/markdown-projection-worker.ts',
  )
  const testSource = path.join(
    fixture,
    'vue/packages/wasm/__tests__/fixture.test.ts',
  )
  const nested = path.join(fixture, 'vue/packages/wasm/nested/runtime.ts')
  await writeFile(source, 'export const source = 1\n')
  await writeFile(worker, 'export const worker = 1\n')
  await writeFile(nested, 'export const nested = 1\n')
  await writeFile(testSource, 'test fixture\n')
  const cache = await import(
    pathToFileURL(path.join(fixture, 'scripts/test-artifact-cache.mjs')).href
  )
  const patterns = cache.artifactGroups.wasm.fingerprints.find(
    (value) => value.id === 'bundle',
  ).inputPatterns
  const before = await cache.hashInputPatterns(patterns)
  assert.ok(
    before.files.includes('vue/packages/wasm/markdown-syntax-identity.ts'),
  )
  assert.ok(
    before.files.includes('vue/packages/wasm/markdown-projection-worker.ts'),
  )
  assert.ok(before.files.includes('vue/packages/wasm/nested/runtime.ts'))
  assert.ok(
    !before.files.includes('vue/packages/wasm/__tests__/fixture.test.ts'),
  )
  await writeFile(source, 'export const source = 2\n')
  const afterSource = await cache.hashInputPatterns(patterns)
  assert.notEqual(afterSource.hash, before.hash)
  await writeFile(worker, 'export const worker = 2\n')
  const afterWorker = await cache.hashInputPatterns(patterns)
  assert.notEqual(afterWorker.hash, afterSource.hash)
  await writeFile(nested, 'export const nested = 2\n')
  const afterNested = await cache.hashInputPatterns(patterns)
  assert.notEqual(afterNested.hash, afterWorker.hash)
  await writeFile(testSource, 'changed test fixture\n')
  assert.equal((await cache.hashInputPatterns(patterns)).hash, afterNested.hash)
})
