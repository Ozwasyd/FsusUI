import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import { generateComponentSurfaceSemanticRegistryBindings } from '../scripts/check-component-surface-semantic-registry.mjs'

const repositoryRoot = path.resolve(
  fileURLToPath(new URL('..', import.meta.url)),
)
const targets = [
  ['spec/components/component-surface-semantic-registry.json', '.'],
  [
    'tests/fixtures/component-surface-semantic-registry/valid-registry.json',
    '.',
  ],
  [
    'tests/fixtures/component-semantic-style-evaluator/registry.json',
    'tests/fixtures/component-semantic-style-evaluator',
  ],
]
const authorityPath = 'spec/components/contracts/v1/vue-public-contracts.json'
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'))
const git = (root, ...args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe',
  }).trim()

const createFixture = async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'fsusui-registry-bindings-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const files = new Set([
    'spec/components/component-surface-semantic-registry.schema.json',
    'tests/fixtures/component-surface-semantic-registry/production-rule-inventory.json',
    'tests/fixtures/component-surface-semantic-registry/semantic-ownership-contract.json',
  ])
  for (const [target, implementationRoot] of targets) {
    files.add(target)
    const registry = await readJson(path.join(repositoryRoot, target))
    for (const source of Object.values(registry.sourceDigests)) {
      files.add(
        path.posix.join(
          source.kind === 'authority' ? '.' : implementationRoot,
          source.path,
        ),
      )
    }
  }
  for (const file of files) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await cp(path.join(repositoryRoot, file), path.join(root, file))
  }
  git(root, 'init', '-q')
  git(root, 'add', '.')
  git(
    root,
    '-c',
    'user.name=Registry fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'Record real registry inputs',
  )
  return root
}

const snapshot = (root) =>
  Promise.all(targets.map(([file]) => readFile(path.join(root, file), 'utf8')))
const withoutBindings = (registry) => {
  const copy = structuredClone(registry)
  delete copy.generated.producer
  delete copy.generated.sourceRevision
  for (const source of Object.values(copy.sourceDigests)) delete source.digest
  return copy
}

test('binding producer uses committed authority and implementation bytes and reaches a fixed point', async (t) => {
  const root = await createFixture(t)
  const before = await snapshot(root)
  await generateComponentSurfaceSemanticRegistryBindings({ root })
  const generated = await snapshot(root)
  const revision = git(root, 'rev-parse', 'HEAD')
  for (const [index, [file, implementationRoot]] of targets.entries()) {
    const registry = JSON.parse(generated[index])
    assert.deepEqual(
      withoutBindings(registry),
      withoutBindings(JSON.parse(before[index])),
      file,
    )
    assert.equal(registry.generated.sourceRevision, revision)
    assert.equal(
      registry.generated.producer,
      'scripts/check-component-surface-semantic-registry.mjs',
    )
    for (const source of Object.values(registry.sourceDigests)) {
      const input = path.posix.join(
        source.kind === 'authority' ? '.' : implementationRoot,
        source.path,
      )
      const committed = execFileSync('git', ['show', `${revision}:${input}`], {
        cwd: root,
      })
      assert.deepEqual(committed, await readFile(path.join(root, input)))
      assert.equal(
        source.digest,
        createHash('sha256').update(committed).digest('hex'),
        input,
      )
    }
  }
  await generateComponentSurfaceSemanticRegistryBindings({ root })
  assert.deepEqual(await snapshot(root), generated)
  git(root, 'add', '.')
  git(
    root,
    '-c',
    'user.name=Registry fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'Record generated bindings',
  )
  assert.notEqual(git(root, 'rev-parse', 'HEAD'), revision)
  await generateComponentSurfaceSemanticRegistryBindings({ root })
  assert.deepEqual(await snapshot(root), generated)

  const authority = path.join(root, authorityPath)
  await writeFile(authority, `${await readFile(authority, 'utf8')}\n`)
  git(root, 'add', authorityPath)
  git(
    root,
    '-c',
    'user.name=Registry fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'Change committed authority bytes',
  )
  const updatedRevision = git(root, 'rev-parse', 'HEAD')
  await generateComponentSurfaceSemanticRegistryBindings({ root })
  for (const output of await snapshot(root)) {
    const registry = JSON.parse(output)
    assert.equal(registry.generated.sourceRevision, updatedRevision)
    const source = registry.sourceDigests['component-contracts']
    assert.equal(
      source.digest,
      createHash('sha256')
        .update(await readFile(authority))
        .digest('hex'),
    )
  }
})

test('dirty authority bytes cannot be blessed and leave all bindings untouched', async (t) => {
  const root = await createFixture(t)
  const before = await snapshot(root)
  const file = path.join(root, authorityPath)
  await writeFile(file, `${await readFile(file, 'utf8')}\n`)
  await assert.rejects(
    generateComponentSurfaceSemanticRegistryBindings({ root }),
    { code: 'registry-source-uncommitted' },
  )
  assert.deepEqual(await snapshot(root), before)
})

test('invalid fixture semantics reject the whole generation before production bindings are written', async (t) => {
  const root = await createFixture(t)
  const file = path.join(root, targets[2][0])
  const registry = await readJson(file)
  delete registry.rules[0].owner
  await writeFile(file, JSON.stringify(registry))
  const before = await snapshot(root)
  await assert.rejects(
    generateComponentSurfaceSemanticRegistryBindings({ root }),
    { code: 'registry-rule-owner-required' },
  )
  assert.deepEqual(await snapshot(root), before)
})

test('missing source bytes cannot reuse stale bindings or partially generate output', async (t) => {
  const root = await createFixture(t)
  const before = await snapshot(root)
  await rm(path.join(root, authorityPath))
  await assert.rejects(
    generateComponentSurfaceSemanticRegistryBindings({ root }),
    { code: 'ENOENT' },
  )
  assert.deepEqual(await snapshot(root), before)
})
