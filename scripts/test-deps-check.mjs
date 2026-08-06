#!/usr/bin/env node
/**
 * Mutation / negative tests for deps:check (#408).
 *
 * Kills:
 * - auto-fix-and-pass (checker must not write / not run deps:sync)
 * - wide-range bypass (range that satisfies install must still fail when exact expected)
 * - missing fixture scan
 *
 * Also covers: root/workspace/fixture drift, published range excludes install,
 * peer floor unresolvable, unregistered dep, multi exact version, candidate
 * mismatch, authority/schema missing fields.
 */

import assert from 'node:assert/strict'
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  repoRoot,
  loadAuthority,
  runDepsCheck,
  formatDriftError,
  checkAuthority,
  checkManifestProjections,
  checkPackageCandidateFields,
  peerFloorFromRange,
  rangeContainsInstall,
  isForbiddenSpecifier,
  isExactVersion,
  AUTHORITY_REL,
  SCHEMA_REL,
  PUBLISHED_PACKAGE_REL,
  CONSUMER_FIXTURE_RELS,
  projectPublishedExternalFields,
  assertReadOnlyWorkingTree,
} from './deps-check-lib.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const checkCliPath = path.join(scriptDir, 'deps-check.mjs')
const checkLibPath = path.join(scriptDir, 'deps-check-lib.mjs')

function fail(message) {
  console.error(`[test-deps-check] FAIL: ${message}`)
  process.exit(1)
}

function ok(message) {
  console.log(`[test-deps-check] ok: ${message}`)
}

function hasCode(errors, code) {
  return errors.some((error) => error.code === code)
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function setupMinimalTree(tempRoot, authority, options = {}) {
  mkdirSync(path.join(tempRoot, 'config/dependencies'), { recursive: true })
  mkdirSync(path.join(tempRoot, 'vue/packages/element-plus'), {
    recursive: true,
  })
  mkdirSync(path.join(tempRoot, 'vue/packages'), { recursive: true })
  mkdirSync(path.join(tempRoot, 'vue/internal'), { recursive: true })
  if (options.withFixture !== false) {
    mkdirSync(path.join(tempRoot, 'vue/tests/consumer-install/template'), {
      recursive: true,
    })
  }
  cpSync(path.join(repoRoot, AUTHORITY_REL), path.join(tempRoot, AUTHORITY_REL))
  cpSync(path.join(repoRoot, SCHEMA_REL), path.join(tempRoot, SCHEMA_REL))

  const projected = projectPublishedExternalFields(authority)
  writeJson(path.join(tempRoot, PUBLISHED_PACKAGE_REL), {
    name: 'element-plus',
    dependencies: { ...projected.dependencies },
    peerDependencies: { ...projected.peerDependencies },
  })
  if (options.withFixture !== false) {
    writeJson(path.join(tempRoot, CONSUMER_FIXTURE_RELS[0]), {
      name: 'consumer',
      dependencies: { vue: authority.install.vue },
    })
  }
}

// --- 0) Source hygiene: no auto-fix / no registry / no deps:sync invocation ---
{
  const sources = [
    readFileSync(checkCliPath, 'utf8'),
    readFileSync(checkLibPath, 'utf8'),
  ].join('\n')

  assert.equal(
    /writeFileSync|writePackageJson|syncAllManifests|syncManifestFile/.test(
      sources,
    ),
    false,
    'deps:check must not write files or call sync helpers (auto-fix-and-pass)',
  )
  assert.equal(
    /from ['"]\.\/deps-sync\.mjs['"]|spawnSync\([^)]*deps-sync|execFileSync\([^)]*deps-sync/.test(
      sources,
    ),
    false,
    'deps:check must not invoke the sync command',
  )
  assert.equal(
    /registry\.npmjs|npm view|pacote|fetch\(['"`]https:\/\/registry/i.test(
      sources,
    ),
    false,
    'deps:check must not contact the npm registry',
  )
  ok('source hygiene (no write / no sync / no registry)')
}

// --- 1) Positive: real repo is green & read-only ---
{
  const before = assertReadOnlyWorkingTree(repoRoot)
  const result = runDepsCheck(repoRoot)
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(formatDriftError(error))
    }
    fail(
      `expected clean tree to pass deps:check, drifts=${result.errors.length}`,
    )
  }
  const after = assertReadOnlyWorkingTree(repoRoot)
  for (const [rel, snap] of before) {
    assert.equal(after.get(rel)?.text, snap.text, `deps:check mutated ${rel}`)
  }
  ok('positive projection green + working tree unchanged')
}

// --- 2) Root / workspace / fixture projection drift ---
{
  const authority = loadAuthority()
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'fsusui-deps-check-drift-'))
  try {
    setupMinimalTree(tempRoot, authority)
    mkdirSync(path.join(tempRoot, 'vue/packages/components'), {
      recursive: true,
    })
    writeJson(path.join(tempRoot, 'package.json'), {
      name: 'root',
      private: true,
      dependencies: { vue: '0.0.0' },
      peerDependencies: { vue: authority.published.peerDependencies.vue },
    })
    writeJson(path.join(tempRoot, 'vue/packages/components/package.json'), {
      name: '@element-plus/components',
      dependencies: { dayjs: '9.9.9' },
    })
    writeJson(path.join(tempRoot, CONSUMER_FIXTURE_RELS[0]), {
      name: 'consumer',
      dependencies: { vue: '1.2.3' },
    })
    const result = runDepsCheck(tempRoot, { skipLockfile: true })
    assert.equal(result.ok, false, 'drift fixture must fail')
    assert.ok(
      result.errors.some(
        (e) =>
          e.file === 'package.json' &&
          e.field === 'dependencies.vue' &&
          e.expected === authority.install.vue &&
          e.actual === '0.0.0',
      ),
      'root drift must report file/field/expected/actual',
    )
    assert.ok(
      result.errors.some(
        (e) =>
          e.file === 'vue/packages/components/package.json' &&
          e.field === 'dependencies.dayjs',
      ),
      'workspace drift',
    )
    assert.ok(
      result.errors.some(
        (e) =>
          e.file === CONSUMER_FIXTURE_RELS[0] && e.field === 'dependencies.vue',
      ),
      'fixture drift',
    )
    const sample = result.errors[0]
    assert.ok(sample.file && sample.field && sample.expected && sample.actual)
    ok('root/workspace/fixture drift field-level errors')
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

// --- 3) Published range does not contain install ---
{
  const authority = structuredClone(loadAuthority())
  authority.published.dependencies.dayjs = '^9.0.0'
  const { errors } = checkAuthority(repoRoot, authority)
  assert.ok(
    hasCode(errors, 'published-range-excludes-install'),
    'must fail when published range excludes install',
  )
  assert.ok(
    errors.some((e) => e.field.includes('published.dependencies.dayjs')),
    'field points at published.dependencies.dayjs',
  )
  ok('published range excludes install')
}

// --- 4) Peer floor unresolvable ---
{
  const authority = structuredClone(loadAuthority())
  authority.published.peerDependencies.vue = 'not-a-range!!!'
  const { errors } = checkAuthority(repoRoot, authority)
  assert.ok(
    errors.some((e) =>
      ['peer-floor-unresolvable', 'published-unresolvable'].includes(e.code),
    ),
    'unresolvable peer range must fail',
  )
  ok('peer floor unresolvable')
}

// --- 5) Peer floor profile mismatch ---
{
  const authority = structuredClone(loadAuthority())
  const floor = peerFloorFromRange(authority.published.peerDependencies.vue)
  assert.ok(floor, 'fixture authority must have resolvable vue peer floor')
  authority.consumerProfiles['npm-peer-floor'].packages.vue = '0.0.1'
  const { errors } = checkAuthority(repoRoot, authority)
  assert.ok(hasCode(errors, 'peer-floor-mismatch'))
  const err = errors.find((e) => e.code === 'peer-floor-mismatch')
  assert.equal(err.expected, floor)
  assert.equal(err.actual, '0.0.1')
  ok('peer floor profile mismatch')
}

// --- 6) Unregistered external dependency ---
{
  const authority = loadAuthority()
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'fsusui-deps-check-unreg-'))
  try {
    setupMinimalTree(tempRoot, authority)
    writeJson(path.join(tempRoot, 'package.json'), {
      name: 'root',
      dependencies: {
        vue: authority.install.vue,
        'totally-unknown-pkg': '1.0.0',
      },
    })
    const result = runDepsCheck(tempRoot, { skipLockfile: true })
    assert.equal(result.ok, false)
    assert.ok(
      result.errors.some(
        (e) =>
          e.code === 'unregistered-external' &&
          e.field.includes('totally-unknown-pkg'),
      ),
      'unregistered external must fail',
    )
    ok('unregistered external dependency')
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

// --- 7) Same package different exact versions ---
{
  const authority = loadAuthority()
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'fsusui-deps-check-uniq-'))
  try {
    setupMinimalTree(tempRoot, authority)
    mkdirSync(path.join(tempRoot, 'vue/packages/a'), { recursive: true })
    mkdirSync(path.join(tempRoot, 'vue/packages/b'), { recursive: true })
    writeJson(path.join(tempRoot, 'package.json'), {
      name: 'root',
      dependencies: { vue: authority.install.vue },
    })
    writeJson(path.join(tempRoot, 'vue/packages/a/package.json'), {
      name: 'a',
      dependencies: { dayjs: '1.11.20' },
    })
    writeJson(path.join(tempRoot, 'vue/packages/b/package.json'), {
      name: 'b',
      dependencies: { dayjs: '1.11.0' },
    })
    const result = runDepsCheck(tempRoot, { skipLockfile: true })
    assert.equal(result.ok, false)
    assert.ok(
      hasCode(result.errors, 'install-not-unique') ||
        result.errors.some((e) => e.field.includes('dayjs')),
      'multi exact version must fail',
    )
    ok('same package different exact versions')
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

// --- 8) Candidate / published-source external fields mismatch authority ---
{
  const authority = loadAuthority()
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'fsusui-deps-check-cand-'))
  try {
    setupMinimalTree(tempRoot, authority)
    writeJson(path.join(tempRoot, 'package.json'), {
      name: 'root',
      dependencies: { vue: authority.install.vue },
    })
    const projected = projectPublishedExternalFields(authority)
    writeJson(path.join(tempRoot, PUBLISHED_PACKAGE_REL), {
      name: 'element-plus',
      dependencies: {
        ...projected.dependencies,
        dayjs: '^0.0.1',
      },
      peerDependencies: projected.peerDependencies,
    })
    const errors = checkPackageCandidateFields(tempRoot, authority)
    assert.ok(
      errors.some(
        (e) =>
          e.field === 'dependencies.dayjs' &&
          e.code === 'candidate-source-drift',
      ),
      'candidate external drift must fail',
    )
    ok('candidate vs authority mismatch')
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

// --- 9) Authority / schema missing fields ---
{
  const incomplete = {
    schemaVersion: 1,
    install: { vue: '3.5.32' },
  }
  const { errors } = checkAuthority(repoRoot, incomplete)
  assert.ok(
    errors.some((e) => e.field === 'published' || e.code === 'schema'),
    'missing published must fail',
  )
  assert.ok(
    errors.some((e) => e.field === 'consumerProfiles' || e.code === 'schema'),
    'missing consumerProfiles must fail',
  )
  ok('authority/schema missing fields')
}

// --- 10) Forbidden forms: *, latest, git, file ---
{
  assert.equal(isForbiddenSpecifier('*'), true)
  assert.equal(isForbiddenSpecifier('latest'), true)
  assert.equal(isForbiddenSpecifier('git+https://example.com/x.git'), true)
  assert.equal(isForbiddenSpecifier('file:../local'), true)
  assert.equal(isForbiddenSpecifier('link:../local'), true)
  assert.equal(isExactVersion('3.5.32'), true)
  assert.equal(isExactVersion('^3.5.32'), false)

  const authority = structuredClone(loadAuthority())
  authority.install.vue = '*'
  const { errors } = checkAuthority(repoRoot, authority)
  assert.ok(
    errors.some((e) =>
      ['install-not-exact', 'install-forbidden', 'schema'].includes(e.code),
    ),
  )
  ok('forbidden * / latest / git / file')
}

// --- 11) Wide-range bypass mutation ---
{
  const authority = loadAuthority()
  const pin = authority.install.vue
  assert.equal(
    rangeContainsInstall('^3.0.0', pin) || rangeContainsInstall(`^${pin}`, pin),
    true,
  )

  const tempRoot = mkdtempSync(path.join(tmpdir(), 'fsusui-deps-check-wide-'))
  try {
    setupMinimalTree(tempRoot, authority)
    writeJson(path.join(tempRoot, 'package.json'), {
      name: 'root',
      dependencies: { vue: '^3.5.0' },
      peerDependencies: { vue: authority.published.peerDependencies.vue },
    })
    const result = runDepsCheck(tempRoot, { skipLockfile: true })
    assert.equal(result.ok, false, 'wide-range install must not pass')
    assert.ok(
      result.errors.some(
        (e) =>
          e.file === 'package.json' &&
          e.field === 'dependencies.vue' &&
          (e.code === 'projection-drift' || e.code === 'wide-range-install') &&
          e.expected.includes(pin) &&
          e.actual === '^3.5.0',
      ),
      'wide-range bypass must be killed with expected exact pin',
    )
    ok('wide-range bypass killed')
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

// --- 12) Missing fixture scan mutation ---
{
  const authority = loadAuthority()
  const tempRoot = mkdtempSync(path.join(tmpdir(), 'fsusui-deps-check-fix-'))
  try {
    setupMinimalTree(tempRoot, authority, { withFixture: false })
    writeJson(path.join(tempRoot, 'package.json'), {
      name: 'root',
      dependencies: { vue: authority.install.vue },
    })
    const errors = checkManifestProjections(tempRoot, authority)
    assert.ok(
      errors.some((e) =>
        ['missing-fixture', 'missing-fixture-scan'].includes(e.code),
      ),
      'missing consumer fixture must fail scan',
    )
    ok('missing fixture scan killed')
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

// --- 13) Auto-fix-and-pass runtime: mutated file stays mutated after fail ---
{
  const authority = loadAuthority()
  const tempRoot = mkdtempSync(
    path.join(tmpdir(), 'fsusui-deps-check-autofix-'),
  )
  try {
    setupMinimalTree(tempRoot, authority)
    const rootPath = path.join(tempRoot, 'package.json')
    writeJson(rootPath, {
      name: 'root',
      dependencies: { vue: '0.0.1' },
    })
    const beforeText = readFileSync(rootPath, 'utf8')
    const result = runDepsCheck(tempRoot, { skipLockfile: true })
    assert.equal(result.ok, false)
    const afterText = readFileSync(rootPath, 'utf8')
    assert.equal(
      afterText,
      beforeText,
      'checker must not auto-fix drifted package.json',
    )
    assert.ok(afterText.includes('0.0.1'))
    ok('auto-fix-and-pass killed (file unchanged after fail)')
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

// --- 14) formatDriftError contract ---
{
  const line = formatDriftError({
    file: 'package.json',
    field: 'dependencies.vue',
    expected: '3.5.32',
    actual: '0.0.0',
    code: 'projection-drift',
  })
  assert.match(line, /file=package\.json/)
  assert.match(line, /field=dependencies\.vue/)
  assert.match(line, /expected=3\.5\.32/)
  assert.match(line, /actual=0\.0\.0/)
  ok('formatDriftError file/field/expected/actual')
}

// --- 15) Real lockfile resolved versions align with install ---
{
  const result = runDepsCheck(repoRoot)
  assert.equal(result.ok, true)
  assert.equal(
    result.errors.some((e) => e.code === 'lockfile-resolved-mismatch'),
    false,
  )
  ok('lockfile resolved matches install pins')
}

console.log('[test-deps-check] all mutation tests passed')
