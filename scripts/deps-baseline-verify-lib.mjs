import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { devNull } from 'node:os'
import path from 'node:path'

export const MIGRATION_BASELINE_REVISION =
  'f7e0e2d526c43ec4a24f06fe649a38797e1fbd9a'
export const MIGRATION_BASELINE_REL =
  'config/dependencies/migration-baseline.json'

const migrationFiles = [
  'pnpm-lock.yaml',
  'package.json',
  'vue/packages/element-plus/package.json',
  'config/dependencies/npm-authority.json',
]

const requireEvidence = (condition, code, file, detail = '') => {
  if (!condition)
    throw new Error(`file=${file} ${code}${detail ? ` ${detail}` : ''}`)
}

// The revision parameter is only for isolated Git fixtures. The CLI never accepts it.
export function verifyMigrationBaseline(
  root,
  revision = MIGRATION_BASELINE_REVISION,
) {
  requireEvidence(
    typeof revision === 'string' && /^[0-9a-f]{40}$/u.test(revision),
    'invalid-checkpoint',
    MIGRATION_BASELINE_REL,
  )
  const env = {
    ...process.env,
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_NO_LAZY_FETCH: '1',
    GIT_GRAFT_FILE: devNull,
  }
  for (const name of [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_COMMON_DIR',
    'GIT_INDEX_FILE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  ])
    delete env[name]
  const git = (...args) =>
    execFileSync(
      'git',
      ['--no-replace-objects', '--literal-pathspecs', ...args],
      {
        cwd: root,
        env,
        maxBuffer: 32 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  let head
  try {
    requireEvidence(
      realpathSync(git('rev-parse', '--show-toplevel').toString().trim()) ===
        realpathSync(root),
      'wrong-repository-root',
      MIGRATION_BASELINE_REL,
    )
    requireEvidence(
      git('cat-file', '-t', revision).toString().trim() === 'commit',
      'checkpoint-not-commit',
      MIGRATION_BASELINE_REL,
    )
    head = git('rev-parse', '--verify', 'HEAD').toString().trim()
  } catch (error) {
    throw new Error(
      `checkpoint-unavailable revision=${revision}: ${error.message}`,
      { cause: error },
    )
  }
  try {
    git('merge-base', '--is-ancestor', revision, head)
  } catch {
    throw new Error(`checkpoint-not-ancestor revision=${revision} head=${head}`)
  }

  const historicalFile = (commit, file) => {
    const entries = git('ls-tree', '-z', commit, '--', file)
      .toString()
      .split('\0')
      .filter(Boolean)
    const match = entries[0]?.match(
      /^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/u,
    )
    requireEvidence(
      entries.length === 1 && match?.[3] === file,
      'missing-or-nonregular-git-file',
      file,
      `revision=${commit}`,
    )
    return git('cat-file', 'blob', match[2])
  }
  const frozen = historicalFile(revision, MIGRATION_BASELINE_REL)
  let current = root
  const components = MIGRATION_BASELINE_REL.split('/')
  for (const [index, component] of components.entries()) {
    current = path.join(current, component)
    const stat = lstatSync(current)
    requireEvidence(
      !stat.isSymbolicLink() &&
        (index === components.length - 1 ? stat.isFile() : stat.isDirectory()),
      'nonregular-frozen-baseline',
      MIGRATION_BASELINE_REL,
    )
  }
  requireEvidence(
    readFileSync(current).equals(frozen) &&
      historicalFile(head, MIGRATION_BASELINE_REL).equals(frozen),
    'frozen-baseline-drift',
    MIGRATION_BASELINE_REL,
    `revision=${revision}`,
  )
  const baseline = JSON.parse(frozen.toString('utf8'))
  requireEvidence(
    baseline?.schemaVersion === 1 &&
      baseline.files &&
      typeof baseline.files === 'object' &&
      !Array.isArray(baseline.files) &&
      Object.keys(baseline.files).length === migrationFiles.length &&
      migrationFiles.every((file) => Object.hasOwn(baseline.files, file)),
    'invalid-migration-file-set',
    MIGRATION_BASELINE_REL,
  )
  for (const file of migrationFiles) {
    const expected = baseline.files[file]
    requireEvidence(
      typeof expected === 'string' && /^[0-9a-f]{64}$/u.test(expected),
      'invalid-migration-hash',
      file,
    )
    const actual = createHash('sha256')
      .update(historicalFile(revision, file))
      .digest('hex')
    requireEvidence(
      actual === expected,
      'historical-hash-mismatch',
      file,
      `expected=${expected} actual=${actual}`,
    )
  }
  return { revision, head, files: migrationFiles.length }
}
