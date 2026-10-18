import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'
import { format } from 'prettier'

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
  git(cwd, 'add', '-A')
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
  await mkdir(path.join(cwd, 'scripts'), { recursive: true })
  for (const name of [
    'avalonia-vue-public-api-baseline.mjs',
    'vue-semantic-baseline.mjs',
    'vue-structured-emit-payload.mjs',
    'vue-structured-exposed-signature.mjs',
  ]) {
    await copyFile(
      path.join(root, 'scripts', name),
      path.join(cwd, 'scripts', name),
    )
  }
  await symlink(
    path.join(root, 'node_modules'),
    path.join(cwd, 'node_modules'),
    'dir',
  )
  await writeFile(path.join(cwd, '.gitignore'), 'node_modules/\n')
  await writeFile(
    path.join(cwd, 'package.json'),
    JSON.stringify({
      type: 'module',
      scripts: {
        'avalonia:baseline':
          'node scripts/avalonia-vue-public-api-baseline.mjs',
        'avalonia:baseline:check':
          'node scripts/avalonia-vue-public-api-baseline.mjs --check',
      },
    }),
  )
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

const cli = (cwd, check = false) => {
  try {
    const stdout = execFileSync(
      process.execPath,
      [
        'scripts/avalonia-vue-public-api-baseline.mjs',
        ...(check ? ['--check'] : []),
      ],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return { status: 0, stdout }
  } catch (error) {
    return { status: error.status, stderr: error.stderr?.toString() }
  }
}
const current = async (cwd) =>
  JSON.parse(await readFile(path.join(cwd, baselinePath), 'utf8'))
const sourcePath =
  'vue/packages/components/fixture-widget/src/fixture-widget.ts'
const addProp = async (cwd) => {
  const p = path.join(cwd, sourcePath)
  await writeFile(
    p,
    (await readFile(p, 'utf8')).replace(
      'label: String,',
      'label: String,\n  disabled: Boolean,',
    ),
  )
}
const assertRealInput = async (cwd) => {
  const revision = (await current(cwd)).source.commitSha
  assert.equal(
    git(cwd, 'show', `${revision}:${sourcePath}`),
    (await readFile(path.join(cwd, sourcePath), 'utf8')).trim(),
  )
}

test('baseline CLI rebinds a self-consistent capture with an available wrong ancestor', async (t) => {
  const { cwd, input } = await fixture(t)
  await addProp(cwd)
  const realInput = commit(cwd, 'committed real prop')
  await store(cwd, buildArtifacts(cwd, { commitShaOverride: input }))
  for (const file of [baselinePath, reportPath]) {
    const full = path.join(cwd, file)
    await writeFile(
      full,
      await format(await readFile(full, 'utf8'), { filepath: full }),
    )
  }
  assert.equal(cli(cwd, true).status, 0) // Existing read-only checker is not altered.
  assert.equal(cli(cwd).status, 0)
  assert.equal((await current(cwd)).source.commitSha, realInput)
  await assertRealInput(cwd)
})

test('baseline CLI binds a committed real source change and preserves its output fixed point', async (t) => {
  const { cwd } = await fixture(t)
  await addProp(cwd)
  const input = commit(cwd, 'committed source change')
  assert.equal(cli(cwd).status, 0)
  assert.equal((await current(cwd)).source.commitSha, input)
  await assertRealInput(cwd)
  const before = await readFile(path.join(cwd, baselinePath), 'utf8')
  commit(cwd, 'normal CLI output')
  assert.equal(cli(cwd).status, 0)
  assert.equal(await readFile(path.join(cwd, baselinePath), 'utf8'), before)
})

test('baseline CLI repairs the natural source-plus-output commit without any revision override', async (t) => {
  const { cwd } = await fixture(t)
  await addProp(cwd)
  const before = await readFile(path.join(cwd, baselinePath), 'utf8')
  const dirty = cli(cwd)
  if (dirty.status !== 0)
    assert.equal(await readFile(path.join(cwd, baselinePath), 'utf8'), before)
  commit(cwd, 'source and any generated output together')
  assert.equal(cli(cwd).status, 0)
  assert.ok(
    (await current(cwd)).components
      .find(({ name }) => name === 'ElFixtureWidget')
      .props.includes('disabled'),
  )
  await assertRealInput(cwd)
})

test('baseline CLI rejects uncommitted input before writing either output', async (t) => {
  const { cwd } = await fixture(t)
  const before = await Promise.all(
    [baselinePath, reportPath].map((p) => readFile(path.join(cwd, p), 'utf8')),
  )
  await addProp(cwd)
  const result = cli(cwd)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /uncommitted|does not match HEAD/)
  assert.deepEqual(
    await Promise.all(
      [baselinePath, reportPath].map((p) =>
        readFile(path.join(cwd, p), 'utf8'),
      ),
    ),
    before,
  )
})

for (const [name, file, content] of [
  ['config', 'vue/tsconfig.web.json', '{"compilerOptions":{"strict":true}}\n'],
  ['token', 'spec/tokens/tokens.json', '{"tokens":[]}\n'],
  ['icon', 'spec/icons/registry.yaml', 'icons: []\n'],
  [
    'selection',
    'spec/components/contracts/v2/semantic-member-bindings.json',
    '{"mappings":[]}\n',
  ],
]) {
  test(`baseline CLI verifies actual ${name} input blobs before retaining a revision`, async (t) => {
    const { cwd, input } = await fixture(t)
    await mkdir(path.dirname(path.join(cwd, file)), { recursive: true })
    await writeFile(path.join(cwd, file), content)
    const realInput = commit(cwd, `real ${name} input`)
    await store(cwd, buildArtifacts(cwd, { commitShaOverride: input }))
    assert.equal(cli(cwd).status, 0)
    assert.equal((await current(cwd)).source.commitSha, realInput)
    assert.equal(git(cwd, 'show', `${realInput}:${file}`), content.trim())
  })
}

test('baseline CLI excludes normal native build outputs from source provenance', async (t) => {
  const { cwd } = await fixture(t)
  const before = await readFile(path.join(cwd, baselinePath), 'utf8')
  const output = path.join(
    cwd,
    'vue/packages/wasm/build/CMakeFiles/CMakeConfigureLog.yaml',
  )
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, 'events: []\n')
  assert.equal(cli(cwd).status, 0)
  assert.deepEqual(await current(cwd), JSON.parse(before))
})
