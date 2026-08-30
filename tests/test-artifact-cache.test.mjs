import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  inspectArtifactGroup,
  inspectFingerprint,
  writeFingerprint,
} from '../scripts/test-artifact-cache.mjs'

test('invalidates an existing bundle when postinstall replaces it with a stub', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'fsusui-artifact-cache-'))
  const fingerprint = {
    id: 'bundle',
    fingerprintPath: 'dist/.artifact-fingerprint',
    artifactFiles: ['dist/index.d.ts', 'dist/index.mjs'],
    inputPatterns: ['src/**/*.ts'],
  }
  const nativeFingerprint = {
    id: 'native',
    fingerprintPath: 'dist/.native-artifact-fingerprint',
    artifactFiles: ['dist/runtime.wasm'],
    inputPatterns: ['native/**/*.cpp'],
  }
  const group = {
    id: 'wasm',
    fingerprints: [fingerprint, nativeFingerprint],
  }
  const productionDeclaration = [
    'export type {',
    '  MarkdownSafeHtml,',
    '  MarkdownSafeRenderResult,',
    "} from './markdown'",
    '',
  ].join('\n')

  try {
    await mkdir(join(fixtureRoot, 'src'), { recursive: true })
    await mkdir(join(fixtureRoot, 'native'), { recursive: true })
    await mkdir(join(fixtureRoot, 'dist'), { recursive: true })
    await writeFile(
      join(fixtureRoot, 'src/index.ts'),
      "export * from './markdown'\n",
    )
    await writeFile(join(fixtureRoot, 'dist/index.d.ts'), productionDeclaration)
    await writeFile(
      join(fixtureRoot, 'dist/index.mjs'),
      'export const ready = true\n',
    )
    await writeFile(
      join(fixtureRoot, 'native/runtime.cpp'),
      'int main() { return 0; }\n',
    )
    await writeFile(
      join(fixtureRoot, 'dist/runtime.wasm'),
      new Uint8Array([0, 97, 115, 109]),
    )

    const initial = await inspectFingerprint(fingerprint, fixtureRoot)
    const initialNative = await inspectFingerprint(
      nativeFingerprint,
      fixtureRoot,
    )
    assert.equal(initial.cachedFingerprint, null)
    await writeFingerprint(initial, fixtureRoot)
    await writeFingerprint(initialNative, fixtureRoot)

    const readyGroup = await inspectArtifactGroup(group, fixtureRoot)
    const ready = readyGroup.fingerprints.find(({ id }) => id === 'bundle')
    const readyNative = readyGroup.fingerprints.find(
      ({ id }) => id === 'native',
    )
    assert.equal(ready.fresh, true)
    assert.equal(readyNative.fresh, true)
    assert.equal(
      ready.currentArtifactFingerprint,
      ready.cachedArtifactFingerprint,
    )

    const localProxy = join(fixtureRoot, 'src/index.js')
    await writeFile(
      join(fixtureRoot, 'dist/index.d.ts'),
      `export * from ${JSON.stringify(localProxy)};\n`,
    )

    const stubbedGroup = await inspectArtifactGroup(group, fixtureRoot)
    const stubbed = stubbedGroup.fingerprints.find(({ id }) => id === 'bundle')
    const unchangedNative = stubbedGroup.fingerprints.find(
      ({ id }) => id === 'native',
    )
    assert.equal(stubbed.currentFingerprint, ready.currentFingerprint)
    assert.equal(stubbed.cachedFingerprint, ready.cachedFingerprint)
    assert.equal(stubbed.fresh, false)
    assert.ok(stubbed.staleReasons.includes('bundle artifact contents changed'))
    assert.equal(unchangedNative.fresh, true)

    await writeFile(join(fixtureRoot, 'dist/index.d.ts'), productionDeclaration)
    await writeFingerprint(stubbed, fixtureRoot)

    const recovered = await inspectFingerprint(fingerprint, fixtureRoot)
    assert.equal(recovered.fresh, true)
    const recoveredDeclaration = await readFile(
      join(fixtureRoot, 'dist/index.d.ts'),
      'utf8',
    )
    assert.match(recoveredDeclaration, /\bMarkdownSafeHtml\b/u)
    assert.match(recoveredDeclaration, /\bMarkdownSafeRenderResult\b/u)
    assert.ok(!recoveredDeclaration.includes(fixtureRoot))
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true })
  }
})
