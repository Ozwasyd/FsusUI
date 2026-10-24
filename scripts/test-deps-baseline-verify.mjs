import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  MIGRATION_BASELINE_REL,
  MIGRATION_BASELINE_REVISION,
  verifyMigrationBaseline,
} from './deps-baseline-verify-lib.mjs'
import { runDepsCheck } from './deps-check-lib.mjs'
import { repoRoot, syncAllManifests } from './npm-authority-lib.mjs'

const files = [
  'pnpm-lock.yaml',
  'package.json',
  'vue/packages/element-plus/package.json',
  'config/dependencies/npm-authority.json',
]
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

const fixture = (t, { mutateRecord, mutateFiles } = {}) => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fsus-migration-history-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const root = path.join(directory, 'repository')
  mkdirSync(root)
  const write = (file, bytes) => {
    const target = path.join(root, file)
    mkdirSync(path.dirname(target), { recursive: true })
    writeFileSync(target, bytes)
  }
  const writeJson = (file, value) =>
    write(file, `${JSON.stringify(value, null, 2)}\n`)
  write(
    'config/dependencies/npm-authority.schema.json',
    readFileSync(
      path.join(repoRoot, 'config/dependencies/npm-authority.schema.json'),
    ),
  )
  const project = (version) => {
    const authority = {
      schemaVersion: 1,
      install: { vue: version },
      published: {
        dependencies: {},
        peerDependencies: { vue: '^3.5.0' },
        optionalDependencies: {},
      },
      consumerProfiles: {
        'npm-latest': { description: 'current', packages: { vue: version } },
        'pnpm-latest': { description: 'current', packages: { vue: version } },
        'npm-peer-floor': { description: 'floor', packages: { vue: '3.5.0' } },
      },
    }
    writeJson('config/dependencies/npm-authority.json', authority)
    writeJson('package.json', {
      name: 'fixture',
      dependencies: { vue: version },
    })
    writeJson('vue/packages/element-plus/package.json', {
      name: 'element-plus',
      peerDependencies: { vue: '^3.5.0' },
      devDependencies: { vue: version },
    })
    writeJson('vue/tests/consumer-install/template/package.json', {
      name: 'consumer',
      dependencies: { vue: version },
    })
    syncAllManifests(root, { authority })
    write(
      'pnpm-lock.yaml',
      `lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      vue:\n        specifier: ${version}\n        version: ${version}\n`,
    )
    const checked = runDepsCheck(root)
    assert.equal(checked.ok, true, JSON.stringify(checked.errors))
  }
  project('3.5.30')
  const baseline = {
    schemaVersion: 1,
    files: Object.fromEntries(
      files.map((file) => [file, sha256(readFileSync(path.join(root, file)))]),
    ),
    installPackageCount: 1,
  }
  mutateRecord?.(baseline)
  writeJson(MIGRATION_BASELINE_REL, baseline)
  mutateFiles?.({ root, directory, write })
  const env = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
  }
  for (const key of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_COMMON_DIR',
  ])
    delete env[key]
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  git('init', '--quiet', '--initial-branch=main')
  git('config', 'user.name', 'Migration evidence control')
  git('config', 'user.email', 'migration-evidence@example.invalid')
  git('config', 'core.hooksPath', directory)
  const commit = (message) => {
    git('add', '.')
    git('commit', '--quiet', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  const checkpoint = commit('capture migration evidence')
  return { root, directory, checkpoint, git, commit, project, write, writeJson }
}

test('historical evidence survives a real authority projection and lock update without changing the frozen record', (t) => {
  const { root, checkpoint, git, commit, project } = fixture(t)
  const frozen = readFileSync(path.join(root, MIGRATION_BASELINE_REL))
  assert.equal(verifyMigrationBaseline(root, checkpoint).files, 4)
  project('3.5.31')
  const current = commit('project governed current dependency update')
  assert.notEqual(current, checkpoint)
  for (const file of files) {
    assert.notDeepEqual(
      readFileSync(path.join(root, file)),
      execFileSync('git', ['show', `${checkpoint}:${file}`], { cwd: root }),
    )
  }
  const before = git('status', '--porcelain')
  assert.deepEqual(verifyMigrationBaseline(root, checkpoint), {
    revision: checkpoint,
    head: current,
    files: 4,
  })
  assert.equal(git('status', '--porcelain'), before)
  assert.deepEqual(
    readFileSync(path.join(root, MIGRATION_BASELINE_REL)),
    frozen,
  )
})

test('historical verification does not forgive current dependency projection drift', (t) => {
  const { root, checkpoint, writeJson } = fixture(t)
  writeJson('package.json', { name: 'fixture', dependencies: { vue: '0.0.1' } })
  assert.equal(verifyMigrationBaseline(root, checkpoint).files, 4)
  const current = runDepsCheck(root)
  assert.equal(current.ok, false)
  assert.ok(current.errors.some((error) => error.code === 'projection-drift'))
})

test('current frozen bytes cannot be changed or repinned to the current projections', (t) => {
  const { root, checkpoint, project, writeJson } = fixture(t)
  project('3.5.31')
  writeJson(MIGRATION_BASELINE_REL, {
    schemaVersion: 1,
    files: Object.fromEntries(
      files.map((file) => [file, sha256(readFileSync(path.join(root, file)))]),
    ),
  })
  assert.throws(
    () => verifyMigrationBaseline(root, checkpoint),
    /frozen-baseline-drift/u,
  )
})

test('committed frozen-record drift cannot be hidden by restoring only the working copy', (t) => {
  const { root, checkpoint, commit, write } = fixture(t)
  const original = readFileSync(path.join(root, MIGRATION_BASELINE_REL))
  write(MIGRATION_BASELINE_REL, Buffer.concat([original, Buffer.from('\n')]))
  commit('alter frozen record')
  write(MIGRATION_BASELINE_REL, original)
  assert.throws(
    () => verifyMigrationBaseline(root, checkpoint),
    /frozen-baseline-drift/u,
  )
})

test('missing frozen baseline fails closed', (t) => {
  const { root, checkpoint } = fixture(t)
  unlinkSync(path.join(root, MIGRATION_BASELINE_REL))
  assert.throws(() => verifyMigrationBaseline(root, checkpoint), /ENOENT/u)
})

test('current frozen baseline and parent directories cannot be symlinks', (t) => {
  for (const parent of [false, true]) {
    const { root, directory, checkpoint } = fixture(t)
    const relative = parent ? 'config/dependencies' : MIGRATION_BASELINE_REL
    const current = path.join(root, relative)
    const target = path.join(directory, 'moved')
    renameSync(current, target)
    symlinkSync(target, current, parent ? 'dir' : 'file')
    assert.throws(
      () => verifyMigrationBaseline(root, checkpoint),
      /nonregular-frozen-baseline/u,
    )
  }
})

test('missing, malformed and symbolic checkpoint refs are rejected', (t) => {
  const { root } = fixture(t)
  for (const revision of ['', 'HEAD', '--all', '../HEAD', '0'.repeat(40)]) {
    assert.throws(
      () => verifyMigrationBaseline(root, revision),
      /invalid-checkpoint|checkpoint-unavailable/u,
    )
  }
})

test('tree and blob objects are not trusted commits', (t) => {
  const { root, git } = fixture(t)
  for (const object of [
    git('rev-parse', 'HEAD^{tree}'),
    git('rev-parse', `HEAD:${MIGRATION_BASELINE_REL}`),
  ]) {
    assert.throws(
      () => verifyMigrationBaseline(root, object),
      /checkpoint-not-commit/u,
    )
  }
})

test('an available identical-tree commit still fails when it is unrelated to current HEAD', (t) => {
  const { root, git } = fixture(t)
  const unrelated = git(
    'commit-tree',
    git('rev-parse', 'HEAD^{tree}'),
    '-m',
    'unrelated same bytes',
  )
  assert.throws(
    () => verifyMigrationBaseline(root, unrelated),
    /checkpoint-not-ancestor/u,
  )
})

test('an ancestor without the frozen historical record fails closed', (t) => {
  const { root, checkpoint, git, commit } = fixture(t)
  git('rm', MIGRATION_BASELINE_REL)
  const missing = commit('remove frozen record')
  assert.throws(
    () => verifyMigrationBaseline(root, missing),
    /missing-or-nonregular-git-file/u,
  )
  assert.equal(git('cat-file', '-t', checkpoint), 'commit')
})

test('non-repository and nested repository roots are rejected', (t) => {
  const { root, directory, checkpoint } = fixture(t)
  for (const wrongRoot of [directory, path.join(root, 'config')]) {
    assert.throws(
      () => verifyMigrationBaseline(wrongRoot, checkpoint),
      /checkpoint-unavailable/u,
    )
  }
})

test('empty, missing, extra, absolute and traversing historical file paths are rejected', (t) => {
  for (const replacement of [
    null,
    '',
    'other.json',
    '/package.json',
    '../package.json',
  ]) {
    const { root, checkpoint } = fixture(t, {
      mutateRecord: (record) => {
        const hash = record.files['package.json']
        delete record.files['package.json']
        if (replacement !== null) record.files[replacement] = hash
      },
    })
    assert.throws(
      () => verifyMigrationBaseline(root, checkpoint),
      /invalid-migration-file-set/u,
    )
  }
  const { root, checkpoint } = fixture(t, {
    mutateRecord: (record) => {
      record.files = {}
    },
  })
  assert.throws(
    () => verifyMigrationBaseline(root, checkpoint),
    /invalid-migration-file-set/u,
  )
  const extra = fixture(t, {
    mutateRecord: (record) => {
      record.files['extra.json'] = '0'.repeat(64)
    },
  })
  assert.throws(
    () => verifyMigrationBaseline(extra.root, extra.checkpoint),
    /invalid-migration-file-set/u,
  )
})

test('the historical frozen record itself must be a regular Git file', (t) => {
  const { root, checkpoint } = fixture(t, {
    mutateFiles: ({ root: fixtureRoot, directory }) => {
      const original = path.join(fixtureRoot, MIGRATION_BASELINE_REL)
      const target = path.join(directory, 'historical-record')
      renameSync(original, target)
      symlinkSync(target, original, 'file')
    },
  })
  assert.throws(
    () => verifyMigrationBaseline(root, checkpoint),
    /missing-or-nonregular-git-file/u,
  )
})

for (const file of files) {
  test(`the historical hash for ${file} must match its actual Git blob`, (t) => {
    const { root, checkpoint } = fixture(t, {
      mutateRecord: (record) => {
        record.files[file] = '0'.repeat(64)
      },
    })
    assert.throws(
      () => verifyMigrationBaseline(root, checkpoint),
      /historical-hash-mismatch/u,
    )
  })
  test(`historical ${file} must be a regular Git file`, (t) => {
    const { root, checkpoint } = fixture(t, {
      mutateFiles: ({ root: fixtureRoot, directory }) => {
        const original = path.join(fixtureRoot, file)
        const target = path.join(directory, 'historical-target')
        renameSync(original, target)
        symlinkSync(target, original, 'file')
      },
    })
    assert.throws(
      () => verifyMigrationBaseline(root, checkpoint),
      /missing-or-nonregular-git-file/u,
    )
  })
}

test('missing historical files and malformed hashes fail closed', (t) => {
  const missing = fixture(t, {
    mutateFiles: ({ root }) => unlinkSync(path.join(root, 'pnpm-lock.yaml')),
  })
  assert.throws(
    () => verifyMigrationBaseline(missing.root, missing.checkpoint),
    /missing-or-nonregular-git-file/u,
  )
  for (const hash of [null, '', '../package.json', 'A'.repeat(64)]) {
    const { root, checkpoint } = fixture(t, {
      mutateRecord: (record) => {
        record.files['pnpm-lock.yaml'] = hash
      },
    })
    assert.throws(
      () => verifyMigrationBaseline(root, checkpoint),
      /invalid-migration-hash/u,
    )
  }
})

test('the real CLI uses the fixed checkpoint and rejects revision arguments', () => {
  const cli = path.join(repoRoot, 'scripts/deps-baseline-verify.mjs')
  const result = spawnSync(process.execPath, [cli], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.ok(result.stdout.includes(`checkpoint=${MIGRATION_BASELINE_REVISION}`))
  for (const args of [
    ['--revision', 'HEAD'],
    ['--ref=HEAD'],
    [MIGRATION_BASELINE_REVISION],
  ]) {
    const rejected = spawnSync(process.execPath, [cli, ...args], {
      encoding: 'utf8',
    })
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /unexpected CLI arguments/u)
  }
})

test('CLI environment cannot substitute an available fixture checkpoint for missing trusted history', (t) => {
  const { root, checkpoint } = fixture(t)
  mkdirSync(path.join(root, 'scripts'))
  for (const script of [
    'deps-baseline-verify.mjs',
    'deps-baseline-verify-lib.mjs',
    'npm-authority-lib.mjs',
  ]) {
    copyFileSync(
      path.join(repoRoot, 'scripts', script),
      path.join(root, 'scripts', script),
    )
  }
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/deps-baseline-verify.mjs')],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        MIGRATION_BASELINE_REVISION: checkpoint,
        FSUS_MIGRATION_BASELINE_REVISION: checkpoint,
      },
    },
  )
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /checkpoint-unavailable/u)
  assert.ok(result.stderr.includes(MIGRATION_BASELINE_REVISION))
})
