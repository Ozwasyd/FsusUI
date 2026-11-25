import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkV1Authority, v1AuthorityPath } from './check-v1-authority.mjs'

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fsusui-v1-authority-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  const write = (file, content) => {
    const target = path.join(root, file)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(
      target,
      typeof content === 'string' ? content : JSON.stringify(content),
    )
  }
  git('init', '-b', 'main')
  git('config', 'user.name', 'Compatibility Test')
  git('config', 'user.email', 'test@example.invalid')
  write('vue/packages/element-plus/package.json', {
    version: '1.6.0-preview.11',
  })
  write('vue/packages/components/table.ts', 'export const Table = {}\n')
  write('spec/baselines/vue-current.json', {
    installableComponents: [{ name: 'ElTable' }],
  })
  write(
    'docs/components/table.md',
    '### Table Exposes\n\n| Name | Description |\n| --- | --- |\n| clearSelection | Clear |\n\n### Other\n',
  )
  git('add', '.')
  git('commit', '-m', 'original V1 fixture')
  const sourceSha = git('rev-parse', 'HEAD')
  const baseline = {
    schema: 'fsusui.v1-runtime-contract.v1',
    source: {
      kind: 'source-declarations',
      commitSha: sourceSha,
      packageVersion: '1.6.0-preview.11',
    },
    components: { ElTable: { props: [], emits: [] } },
    documentedInstanceMethods: { ElTable: ['clearSelection'] },
  }
  write(v1AuthorityPath, baseline)
  const freeze = () => {
    git('add', v1AuthorityPath)
    git('commit', '-m', 'freeze V1 fixture authority')
    return git('rev-parse', 'HEAD')
  }
  return { root, git, write, sourceSha, baseline, freeze }
}

test('initial capture is anchored to the original source commit', (t) => {
  const f = fixture(t)
  assert.equal(
    checkV1Authority({ root: f.root, baseSha: f.sourceSha }).status,
    'initial-source-freeze',
  )
})

test('initial capture rejects changed library source', (t) => {
  const f = fixture(t)
  f.write(
    'vue/packages/components/table.ts',
    'export const Table = { changed: true }\n',
  )
  assert.throws(() => checkV1Authority({ root: f.root, baseSha: f.sourceSha }))
})

test('initial capture rejects untracked library source', (t) => {
  const f = fixture(t)
  f.write('vue/packages/components/extra.ts', 'export const extra = true\n')
  assert.throws(
    () => checkV1Authority({ root: f.root, baseSha: f.sourceSha }),
    /Untracked/,
  )
})

test('initial capture cannot quietly omit components', (t) => {
  const f = fixture(t)
  f.baseline.components = {}
  f.write(v1AuthorityPath, f.baseline)
  assert.throws(
    () => checkV1Authority({ root: f.root, baseSha: f.sourceSha }),
    /every original/,
  )
})

test('initial capture cannot quietly omit documented instance methods', (t) => {
  const f = fixture(t)
  f.baseline.documentedInstanceMethods.ElTable = []
  f.write(v1AuthorityPath, f.baseline)
  assert.throws(
    () => checkV1Authority({ root: f.root, baseSha: f.sourceSha }),
    /Table instance/,
  )
})

test('source version and source kind must be explicit and correct', (t) => {
  const f = fixture(t)
  f.baseline.source.packageVersion = '2.0.0'
  f.write(v1AuthorityPath, f.baseline)
  assert.throws(
    () => checkV1Authority({ root: f.root, baseSha: f.sourceSha }),
    /version/,
  )
  f.baseline.source.kind = 'published-package'
  f.write(v1AuthorityPath, f.baseline)
  assert.throws(
    () => checkV1Authority({ root: f.root, baseSha: f.sourceSha }),
    /source kind/,
  )
})

test('a future candidate commit cannot redefine the initial V1 source', (t) => {
  const f = fixture(t)
  const future = f.freeze()
  f.baseline.source.commitSha = future
  f.write(v1AuthorityPath, f.baseline)
  assert.throws(() => checkV1Authority({ root: f.root, baseSha: f.sourceSha }))
})

test('an existing authority stays frozen while implementation evolves', (t) => {
  const f = fixture(t)
  const baseSha = f.freeze()
  f.write(
    'vue/packages/components/table.ts',
    'export const Table = { refactored: true }\n',
  )
  assert.equal(checkV1Authority({ root: f.root, baseSha }).status, 'frozen')
})

test('re-recording and deleting an existing authority both fail', (t) => {
  const f = fixture(t)
  const baseSha = f.freeze()
  f.baseline.components.ElTable.props = ['newProp']
  f.write(v1AuthorityPath, f.baseline)
  assert.throws(() => checkV1Authority({ root: f.root, baseSha }), /differs/)
  rmSync(path.join(f.root, v1AuthorityPath))
  assert.throws(() => checkV1Authority({ root: f.root, baseSha }), /missing/)
})

test('missing or malformed base identities fail closed', (t) => {
  const f = fixture(t)
  for (const baseSha of [undefined, 'main', '--help', '0'.repeat(40)])
    assert.throws(() => checkV1Authority({ root: f.root, baseSha }))
})

test('authority checks never modify the recorded file', (t) => {
  const f = fixture(t)
  const before = readFileSync(path.join(f.root, v1AuthorityPath), 'utf8')
  checkV1Authority({ root: f.root, baseSha: f.sourceSha })
  assert.equal(readFileSync(path.join(f.root, v1AuthorityPath), 'utf8'), before)
})
