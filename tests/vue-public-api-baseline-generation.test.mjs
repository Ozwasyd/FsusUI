import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import {
  buildArtifacts,
  buildWriteArtifacts,
} from '../scripts/avalonia-vue-public-api-baseline.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const baselinePath = 'spec/baselines/vue-current.json'
const reportPath = 'docs/avalonia/vue-public-api-baseline.md'
const git = (cwd, ...args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
const commit = (cwd, message) => {
  git(cwd, 'add', 'spec', 'vue', 'docs')
  git(
    cwd,
    '-c',
    'user.name=Baseline Test',
    '-c',
    'user.email=baseline-test@example.invalid',
    'commit',
    '-qm',
    message,
  )
  return git(cwd, 'rev-parse', 'HEAD')
}
const store = async (cwd, artifacts) => {
  for (const [file, content] of [
    [baselinePath, `${JSON.stringify(artifacts.baseline, null, 2)}\n`],
    [reportPath, artifacts.report],
  ]) {
    await mkdir(path.dirname(path.join(cwd, file)), { recursive: true })
    await writeFile(path.join(cwd, file), content)
  }
}
const fixture = async (t) => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'fsus-baseline-generation-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  await cp(path.join(root, 'tests/fixtures/vue-public-api-baseline'), cwd, {
    recursive: true,
  })
  await mkdir(path.join(cwd, 'docs'), { recursive: true })
  git(cwd, 'init', '-q')
  const input = commit(cwd, 'real fixture inputs')
  const original = buildWriteArtifacts(cwd)
  assert.equal(original.baseline.source.commitSha, input)
  await store(cwd, original)
  const output = commit(cwd, 'generated fixture outputs')
  return { cwd, input, output, original }
}

test('baseline generation keeps the real input revision across output commits', async (t) => {
  const { cwd, input, output, original } = await fixture(t)
  assert.notEqual(input, output)
  assert.deepEqual(buildWriteArtifacts(cwd), original)
  // Rebuilding must repair the report even when the stored baseline is current.
  await writeFile(path.join(cwd, reportPath), 'stale report\n')
  commit(cwd, 'report-only drift')
  const rebuilt = buildWriteArtifacts(cwd)
  assert.deepEqual(rebuilt, original)
  assert.notEqual(
    rebuilt.report,
    await readFile(path.join(cwd, reportPath), 'utf8'),
  )
})

test('baseline generation binds a real source change, then reaches a fixed point', async (t) => {
  const { cwd, original } = await fixture(t)
  const source = path.join(
    cwd,
    'vue/packages/components/fixture-widget/src/fixture-widget.ts',
  )
  await writeFile(
    source,
    (await readFile(source, 'utf8')).replace(
      'label: String,',
      'label: String,\n  disabled: Boolean,',
    ),
  )
  const input = commit(cwd, 'add real disabled prop')
  const changed = buildWriteArtifacts(cwd)
  assert.equal(changed.baseline.source.commitSha, input)
  assert.notEqual(
    changed.baseline.source.inputTreeHash,
    original.baseline.source.inputTreeHash,
  )
  assert.ok(
    changed.baseline.components
      .find(({ name }) => name === 'ElFixtureWidget')
      .props.includes('disabled'),
  )
  await store(cwd, changed)
  commit(cwd, 'generated changed outputs')
  assert.deepEqual(buildWriteArtifacts(cwd), changed)
})

test('baseline generation does not preserve a tampered artifact as current input', async (t) => {
  const { cwd, original } = await fixture(t)
  const tampered = structuredClone(original)
  tampered.baseline.components[0].props.push('forged-prop')
  await store(cwd, tampered)
  const input = commit(cwd, 'invalid artifact')
  const rebuilt = buildWriteArtifacts(cwd)
  assert.equal(rebuilt.baseline.source.commitSha, input)
  assert.deepEqual(rebuilt.baseline.components, original.baseline.components)
})

test('baseline generation rejects an unavailable previous revision', async (t) => {
  const { cwd } = await fixture(t)
  await store(cwd, buildArtifacts(cwd, { commitShaOverride: '0'.repeat(40) }))
  const input = commit(cwd, 'unavailable provenance')
  assert.equal(buildWriteArtifacts(cwd).baseline.source.commitSha, input)
})
