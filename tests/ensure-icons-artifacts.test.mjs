import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  artifactGroups,
  inspectArtifactGroup,
  root,
} from '../scripts/test-artifact-cache.mjs'

const group = artifactGroups.icons
const indexPath = path.join(
  root,
  'vue/packages/icons-vue/src/components/index.ts',
)
const markerPath = path.join(root, group.fingerprints[0].fingerprintPath)
const declarationPath = path.join(
  root,
  'vue/packages/icons-vue/dist/types/index.d.ts',
)
const buildPath = path.join(root, 'vue/packages/icons-vue/build/build.ts')
const run = (args) =>
  execFileSync('pnpm', args, { cwd: root, encoding: 'utf8' })
const ensure = () => run(['run', 'ensure:icons'])
const build = (script) => run(['-C', 'vue/packages/icons-vue', 'run', script])

test('certifies the actual generated alias tree and reaches a cache fixed point', async () => {
  rmSync(indexPath)
  try {
    ensure()
    const generated = readFileSync(indexPath, 'utf8')
    for (const alias of [
      'AddDocument',
      'ApplicationMenu',
      'RefreshReplace',
      'Replace',
      'SearchFilter',
    ]) {
      assert.ok(generated.includes(`as ${alias} }`), alias)
    }
    const status = await inspectArtifactGroup(group)
    assert.equal(status.fresh, true)
    assert.equal(
      readFileSync(markerPath, 'utf8').trim(),
      status.fingerprints[0].currentFingerprint,
    )
    const before = readFileSync(indexPath)
    build('build:generate')
    assert.deepEqual(readFileSync(indexPath), before)
    assert.match(ensure(), /cache-hit/u)
    assert.equal((await inspectArtifactGroup(group)).fresh, true)
  } finally {
    if (!existsSync(indexPath)) build('build:generate')
  }
})

test('direct bundle builds preserve declarations but invalidate certification until ensure completes', async () => {
  ensure()
  const declarations = readFileSync(declarationPath)
  build('build:build')
  assert.deepEqual(readFileSync(declarationPath), declarations)
  assert.equal(existsSync(markerPath), false)
  assert.equal((await inspectArtifactGroup(group)).fresh, false)
  build('build:types')
  assert.equal(existsSync(markerPath), false)
  assert.equal((await inspectArtifactGroup(group)).fresh, false)
  ensure()
  assert.equal((await inspectArtifactGroup(group)).fresh, true)
})

test('rejects changed build inputs, failed builds and missing outputs before recovering', async () => {
  ensure()
  const original = readFileSync(buildPath)
  try {
    writeFileSync(
      buildPath,
      Buffer.concat([
        Buffer.from("throw new Error('icons producer failure control')\n"),
        original,
      ]),
    )
    assert.equal((await inspectArtifactGroup(group)).fresh, false)
    const failed = spawnSync('pnpm', ['run', 'ensure:icons'], {
      cwd: root,
      encoding: 'utf8',
    })
    assert.notEqual(failed.status, 0)
    assert.match(
      failed.stdout + failed.stderr,
      /icons producer failure control/u,
    )
    assert.equal(existsSync(markerPath), false)
    assert.equal((await inspectArtifactGroup(group)).fresh, false)
  } finally {
    writeFileSync(buildPath, original)
  }
  ensure()
  assert.equal((await inspectArtifactGroup(group)).fresh, true)
  const bundlePath = path.join(root, 'vue/packages/icons-vue/dist/index.cjs')
  rmSync(bundlePath)
  const missing = await inspectArtifactGroup(group)
  assert.equal(missing.fresh, false)
  assert.ok(missing.fingerprints[0].missingArtifacts.includes(bundlePath))
  ensure()
  assert.equal((await inspectArtifactGroup(group)).fresh, true)
})

test('does not certify a successful build whose source changes during compilation', async () => {
  ensure()
  const original = readFileSync(buildPath)
  try {
    writeFileSync(
      buildPath,
      Buffer.concat([
        original,
        Buffer.from(
          "\nawait import('node:fs/promises').then(({ appendFile }) => appendFile(__filename, '\\n// input drift control\\n'))\n",
        ),
      ]),
    )
    const failed = spawnSync('pnpm', ['run', 'ensure:icons'], {
      cwd: root,
      encoding: 'utf8',
    })
    assert.notEqual(failed.status, 0)
    assert.match(failed.stdout + failed.stderr, /inputs changed during build/u)
    assert.equal(existsSync(markerPath), false)
    assert.equal((await inspectArtifactGroup(group)).fresh, false)
  } finally {
    writeFileSync(buildPath, original)
  }
  ensure()
  assert.equal((await inspectArtifactGroup(group)).fresh, true)
})
