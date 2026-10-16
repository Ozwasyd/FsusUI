import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  checkComponentSurfaceSemanticRegistry,
  refreshComponentSurfaceSemanticRegistrySourceDigests,
} from '../scripts/check-component-surface-semantic-registry.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productionPath = path.join(
  root,
  'spec/components/component-surface-semantic-registry.json',
)
const temporaryRegistry = async (t) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'semantic-registry-'),
  )
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const registryPath = path.join(directory, 'registry.json')
  const registry = JSON.parse(await fs.readFile(productionPath, 'utf8'))
  await fs.writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
  return { registryPath, registry }
}
const semanticPayload = (registry) => {
  const copy = structuredClone(registry)
  delete copy.generated
  for (const source of Object.values(copy.sourceDigests)) delete source.digest
  return copy
}

test('explicit digest refresh preserves registry semantics and default validation remains read-only', async (t) => {
  const { registryPath, registry } = await temporaryRegistry(t)
  for (const source of Object.values(registry.sourceDigests)) {
    source.digest = '0'.repeat(64)
  }
  await fs.writeFile(registryPath, JSON.stringify(registry))
  await assert.rejects(
    checkComponentSurfaceSemanticRegistry({ root, registryPath }),
    { code: 'registry-source-digest-drift' },
  )
  const result = await refreshComponentSurfaceSemanticRegistrySourceDigests({
    root,
    registryPath,
  })
  assert.deepEqual(result.writePaths, [registryPath])
  assert.deepEqual(result.executedCommands, ['git rev-parse HEAD'])
  const serialized = await fs.readFile(registryPath, 'utf8')
  const refreshed = JSON.parse(serialized)
  assert.equal(
    refreshed.generated.producer,
    'scripts/check-component-surface-semantic-registry.mjs',
  )
  assert.deepEqual(semanticPayload(refreshed), semanticPayload(registry))
  for (const source of Object.values(refreshed.sourceDigests)) {
    assert.equal(
      source.digest,
      createHash('sha256')
        .update(await fs.readFile(path.join(root, source.path)))
        .digest('hex'),
    )
  }
  const checked = await checkComponentSurfaceSemanticRegistry({
    root,
    registryPath,
  })
  assert.deepEqual(checked.writePaths, [])
  assert.deepEqual(checked.executedCommands, [])
  assert.equal(await fs.readFile(registryPath, 'utf8'), serialized)
})

test('digest refresh refuses invalid ownership and unresolved authority pointers without writing', async (t) => {
  const { registryPath, registry } = await temporaryRegistry(t)
  for (const mutate of [
    (value) => delete value.rules[0].owner,
    (value) => {
      value.rules[0].canonicalSources[0].pointer = '/missing-authority'
    },
  ]) {
    const invalid = structuredClone(registry)
    mutate(invalid)
    const serialized = `${JSON.stringify(invalid, null, 2)}\n`
    await fs.writeFile(registryPath, serialized)
    await assert.rejects(
      refreshComponentSurfaceSemanticRegistrySourceDigests({
        root,
        registryPath,
      }),
    )
    assert.equal(await fs.readFile(registryPath, 'utf8'), serialized)
  }
})
