import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { resolveConformanceInteractionIdentity } from '../scripts/conformance-playwright-runner.mjs'
import {
  assertMarkdownPlaywrightCollection,
  createMarkdownPlaywrightEnvironment,
  runMarkdownCell,
} from '../scripts/markdown-playwright-runner.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' })
const checkedGit = (cwd, args) => {
  const result = git(cwd, args)
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}
const fixture = (fn) => {
  const scratch = mkdtempSync(join(tmpdir(), 'fsus-conformance-identity-'))
  const producer = join(scratch, 'producer')
  mkdirSync(producer)
  checkedGit(producer, ['init', '--quiet', '--initial-branch=main'])
  checkedGit(producer, ['config', 'user.name', 'Identity regression'])
  checkedGit(producer, [
    'config',
    'user.email',
    'identity-regression@example.invalid',
  ])
  const commit = (name) => {
    writeFileSync(join(producer, name), name)
    checkedGit(producer, ['add', name])
    checkedGit(producer, ['commit', '--quiet', '-m', name])
    return checkedGit(producer, ['rev-parse', 'HEAD'])
  }
  const prior = commit('prior')
  const baseline = commit('baseline')
  checkedGit(producer, ['switch', '--quiet', '-c', 'feature'])
  const feature = commit('feature')
  checkedGit(producer, ['switch', '--quiet', 'main'])
  checkedGit(producer, [
    'merge',
    '--quiet',
    '--no-ff',
    'feature',
    '-m',
    'merge',
  ])
  const candidate = checkedGit(producer, ['rev-parse', 'HEAD'])
  checkedGit(producer, ['switch', '--quiet', '--orphan', 'unrelated'])
  const unrelated = commit('unrelated')
  checkedGit(producer, ['switch', '--quiet', 'main'])
  const checkout = join(scratch, 'checkout')
  checkedGit(scratch, [
    'clone',
    '--quiet',
    '--depth=1',
    `file://${producer}`,
    checkout,
  ])
  // Mirror the Actions merge-only remote namespace, not a default branch checkout.
  checkedGit(checkout, ['update-ref', '-d', 'refs/remotes/origin/main'])
  checkedGit(checkout, ['update-ref', '-d', 'refs/remotes/origin/HEAD'])
  const env = { GITHUB_SHA: candidate, GITHUB_REF: 'refs/pull/861/merge' }
  const options = {
    repositoryRoot: checkout,
    group: 'pr',
    impactPlan: { baseRef: baseline },
    env,
  }
  try {
    fn({
      scratch,
      producer,
      checkout,
      prior,
      baseline,
      feature,
      candidate,
      unrelated,
      env,
      options,
    })
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

const originalBaselineExpression = readFileSync(
  join(root, 'vue/tests/markdown-editor/markdown-interaction-trace.spec.ts'),
  'utf8',
)
  .split('const currentRevision = ')[1]
  .split('const moveToLineEndShortcut =')[0]
const probe = (cwd, env) =>
  spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { execFileSync } from 'node:child_process';\nconst currentRevision = ${originalBaselineExpression}\nconsole.log(JSON.stringify({baseline,candidate}))`,
    ],
    { cwd, env, encoding: 'utf8' },
  )

// Only these identity/diagnostic controls run here; no browser or audit suites.
test('real shallow merge reproduces collection failure, acquires exact base and uses existing inputs', () =>
  fixture(({ checkout, baseline, candidate, options }) => {
    assert.notEqual(
      git(checkout, ['cat-file', '-e', `${baseline}^{commit}`]).status,
      0,
    )
    const original = probe(checkout, {})
    assert.equal(original.status, 1)
    assert.match(original.stderr, /Not a valid object name origin\/main/u)
    const identity = resolveConformanceInteractionIdentity(options)
    assert.deepEqual(identity, { baseline, candidate })
    checkedGit(checkout, ['cat-file', '-e', `${baseline}^{commit}`])
    assert.equal(
      git(checkout, ['show-ref', '--verify', 'refs/remotes/origin/main'])
        .status,
      128,
    )
    const fixed = probe(
      checkout,
      createMarkdownPlaywrightEnvironment(identity, {}),
    )
    assert.equal(fixed.status, 0, fixed.stderr)
    assert.deepEqual(JSON.parse(fixed.stdout), identity)
  }))

test('full local history accepts the exact ancestor baseline', () =>
  fixture(({ producer, feature, baseline }) => {
    checkedGit(producer, ['checkout', '--quiet', '--detach', feature])
    assert.deepEqual(
      resolveConformanceInteractionIdentity({
        repositoryRoot: producer,
        group: 'pr',
        impactPlan: { baseRef: baseline },
        env: {},
      }),
      { baseline, candidate: feature },
    )
  }))

test('non-PR retains the origin/main merge-base behavior', () =>
  fixture(({ producer, feature, baseline }) => {
    checkedGit(producer, ['update-ref', 'refs/remotes/origin/main', baseline])
    checkedGit(producer, ['checkout', '--quiet', '--detach', feature])
    assert.deepEqual(
      resolveConformanceInteractionIdentity({
        repositoryRoot: producer,
        group: 'main',
        env: {},
      }),
      { baseline, candidate: feature },
    )
  }))

for (const [label, mutate, expected] of [
  [
    'missing base',
    (v) => ({ ...v.options, impactPlan: {} }),
    /exact commit SHA/u,
  ],
  [
    'malformed base',
    (v) => ({ ...v.options, impactPlan: { baseRef: 'main' } }),
    /exact commit SHA/u,
  ],
  [
    'stale GitHub candidate',
    (v) => ({ ...v.options, env: { ...v.env, GITHUB_SHA: v.baseline } }),
    /does not match checkout/u,
  ],
  [
    'stale explicit candidate',
    (v) => ({
      ...v.options,
      env: { ...v.env, FSUS_INTERACTION_CANDIDATE: v.baseline },
    }),
    /does not match checkout/u,
  ],
  [
    'wrong supplied baseline',
    (v) => ({
      ...v.options,
      env: { ...v.env, FSUS_INTERACTION_BASELINE: v.feature },
    }),
    /does not match baseline/u,
  ],
  [
    'stale merge base',
    (v) => ({ ...v.options, impactPlan: { baseRef: v.prior } }),
    /does not match merge checkout base/u,
  ],
  [
    'head parent used as base',
    (v) => ({ ...v.options, impactPlan: { baseRef: v.feature } }),
    /does not match merge checkout base/u,
  ],
]) {
  test(`${label} rejects before child spawn or baseline fetch`, () =>
    fixture((v) => {
      assert.throws(
        () => resolveConformanceInteractionIdentity(mutate(v)),
        expected,
      )
      assert.notEqual(
        git(v.checkout, ['cat-file', '-e', `${v.baseline}^{commit}`]).status,
        0,
      )
    }))
}

test('an unrelated existing commit is rejected', () =>
  fixture(({ producer, candidate, unrelated }) => {
    assert.throws(
      () =>
        resolveConformanceInteractionIdentity({
          repositoryRoot: producer,
          group: 'pr',
          impactPlan: { baseRef: unrelated },
          env: { GITHUB_SHA: candidate },
        }),
      /unrelated/u,
    )
  }))

test('an annotated tag SHA cannot substitute for the exact baseline commit', () =>
  fixture(({ producer, baseline }) => {
    checkedGit(producer, [
      'tag',
      '-a',
      'baseline-label',
      baseline,
      '-m',
      'baseline-label',
    ])
    const tag = checkedGit(producer, ['rev-parse', 'baseline-label'])
    assert.equal(checkedGit(producer, ['cat-file', '-t', tag]), 'tag')
    assert.throws(
      () =>
        resolveConformanceInteractionIdentity({
          repositoryRoot: producer,
          group: 'pr',
          impactPlan: { baseRef: tag },
          env: {},
        }),
      /unavailable or unrelated/u,
    )
  }))

test('an unavailable unrelated SHA is rejected without acquisition', () =>
  fixture(({ options }) => {
    assert.throws(
      () =>
        resolveConformanceInteractionIdentity({
          ...options,
          env: {},
          impactPlan: { baseRef: 'a'.repeat(40) },
        }),
      /unavailable or unrelated/u,
    )
  }))

test('failed exact baseline acquisition stays a failure', () =>
  fixture(({ checkout, options }) => {
    checkedGit(checkout, [
      'remote',
      'set-url',
      'origin',
      '/nonexistent/fsus-identity-regression',
    ])
    assert.throws(
      () => resolveConformanceInteractionIdentity(options),
      /object acquisition failed/u,
    )
  }))

test('non-PR missing baseline stays a failure', () =>
  fixture(({ checkout }) => {
    assert.throws(
      () =>
        resolveConformanceInteractionIdentity({
          repositoryRoot: checkout,
          group: 'main',
          env: {},
        }),
      /baseline unavailable/u,
    )
  }))

test('child environment retains other owners and rejects inconsistent inputs', () => {
  assert.deepEqual(
    createMarkdownPlaywrightEnvironment(undefined, {
      TOKEN_FREE_MARKER: 'retained',
    }),
    { TOKEN_FREE_MARKER: 'retained', CI: 'true' },
  )
  const identity = { baseline: 'b'.repeat(40), candidate: 'c'.repeat(40) }
  for (const [key, value] of [
    ['GITHUB_SHA', identity.baseline],
    ['FSUS_INTERACTION_CANDIDATE', identity.baseline],
    ['FSUS_INTERACTION_BASELINE', identity.candidate],
  ]) {
    assert.throws(
      () => createMarkdownPlaywrightEnvironment(identity, { [key]: value }),
      /does not match verified identity/u,
    )
  }
  assert.throws(
    () =>
      createMarkdownPlaywrightEnvironment(
        { ...identity, baseline: 'main' },
        {},
      ),
    /exact commit SHA/u,
  )
})

test('original report-level collection error survives diagnostic handling', () => {
  const parsed = {
    errors: [
      {
        message:
          'Error: Command failed: git merge-base merge origin/main\nfatal: Not a valid object name origin/main',
      },
    ],
    suites: [],
    stats: { expected: 0, unexpected: 0, skipped: 0, flaky: 0 },
  }
  assert.throws(
    () => assertMarkdownPlaywrightCollection(parsed, { status: 1 }),
    /Not a valid object name origin\/main/u,
  )
  assert.equal(parsed.suites.length, 0)
  assert.throws(
    () =>
      assertMarkdownPlaywrightCollection(null, {
        status: 1,
        stderr: 'process stderr retained',
      }),
    /process stderr retained/u,
  )
  assert.throws(
    () =>
      assertMarkdownPlaywrightCollection(
        {},
        { error: new Error('spawn failure') },
      ),
    /spawn failure/u,
  )
  assert.doesNotThrow(() =>
    assertMarkdownPlaywrightCollection({ errors: [] }, { status: 0 }),
  )
})

test('failed collection retains the original JSON report and counters in its failure receipt', async () => {
  mkdirSync(join(root, '.tmp'), { recursive: true })
  const scratch = mkdtempSync(join(root, '.tmp/identity-diagnostic-'))
  const bin = join(scratch, 'bin')
  mkdirSync(bin)
  const parsed = {
    errors: [{ message: 'fatal: Not a valid object name origin/main' }],
    suites: [],
    stats: { expected: 0, unexpected: 0, skipped: 0, flaky: 0 },
  }
  const stdout = `${JSON.stringify(parsed)}\n`
  writeFileSync(
    join(bin, 'pnpm'),
    `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(stdout)});process.stderr.write('unit collection stderr');process.exitCode=1;\n`,
    { mode: 0o755 },
  )
  const previousPath = process.env.PATH
  process.env.PATH = `${bin}:${previousPath}`
  const cell = {
    id: 'identity-unit/collection',
    suiteId: 'identity-unit',
    project: 'collection',
    config: 'unit-only-unused-config',
    dimensions: { browser: 'chromium' },
    receiptPath: join(scratch, 'receipt.json'),
  }
  try {
    const result = await runMarkdownCell('identity-unit', cell.id, 'main', {
      planLoader: () => ({ cells: [cell], gate: 'identity-unit' }),
      fingerprintInputsBySuite: {
        'identity-unit': ['scripts/markdown-playwright-runner.mjs'],
      },
      evidenceDir: join(scratch, 'evidence'),
      logPrefix: 'identity-unit',
      receiptExtension: () =>
        assert.fail('collection failure must precede attachment discovery'),
    })
    assert.equal(result.ok, false)
    const receipt = JSON.parse(readFileSync(cell.receiptPath, 'utf8'))
    assert.equal(receipt.status, 'failure')
    assert.match(receipt.failureReason, /Not a valid object name origin\/main/u)
    assert.deepEqual(receipt.tests, {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
    })
    assert.equal(
      readFileSync(resolve(root, receipt.report.path), 'utf8'),
      stdout,
    )
    assert.equal(
      readFileSync(join(dirname(receipt.report.path), 'stderr.log'), 'utf8'),
      'unit collection stderr',
    )
  } finally {
    process.env.PATH = previousPath
    rmSync(scratch, { recursive: true, force: true })
  }
})
