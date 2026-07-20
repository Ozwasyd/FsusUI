import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import {
  inspectVisualRuntime,
  prepareVisualRuntime,
} from '../../scripts/visual-runtime-core.mjs'

const fixtureRoot = resolve('tests/fixtures/visual-runtime')
const fixedTools = {
  node: 'fixture-node',
  playwright: 'fixture-playwright',
  pnpm: 'fixture-pnpm',
}

function fixtureConfig(repositoryRoot) {
  return {
    groups: ['icons', 'wasm', 'demo'].map((id) => ({
      command: ['fixture-build', id],
      id,
      inputPaths: [`inputs/${id}`],
      runtimePath: id === 'demo' ? 'demo-dist' : `artifacts/${id}`,
      sourceArtifactPath: `outputs/${id}`,
    })),
    repositoryRoot,
    runtimeRoot: 'runtime',
    tools: fixedTools,
  }
}

async function createWorkspace(t) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'fsusui-visual-runtime-'))
  const repositoryRoot = join(temporaryRoot, 'workspace')
  await cp(fixtureRoot, repositoryRoot, { recursive: true })
  t.after(() => rm(temporaryRoot, { force: true, recursive: true }))
  return { config: fixtureConfig(repositoryRoot), repositoryRoot }
}

function fixtureBuilder(repositoryRoot, counts, options = {}) {
  return async (group) => {
    counts.set(group.id, (counts.get(group.id) ?? 0) + 1)
    if (options.fail === group.id) throw new Error('fixture build failed')

    const source = await readFile(
      join(repositoryRoot, 'inputs', group.id, 'source.txt'),
      'utf8',
    )
    const output = join(repositoryRoot, group.sourceArtifactPath)
    await mkdir(output, { recursive: true })
    await writeFile(join(output, 'bundle.txt'), `${group.id}:${source}`)
  }
}

const quietLogger = { info() {} }
const prepare = (config, buildGroup, overrides = {}) =>
  prepareVisualRuntime(config, {
    buildGroup,
    clock: () => new Date('2026-07-20T00:00:00.000Z'),
    logger: quietLogger,
    tools: fixedTools,
    ...overrides,
  })

test('prepares an empty runtime and writes a ready manifest', async (t) => {
  const { config, repositoryRoot } = await createWorkspace(t)
  const counts = new Map()
  const result = await prepare(config, fixtureBuilder(repositoryRoot, counts))

  assert.deepEqual(Object.fromEntries(counts), { demo: 1, icons: 1, wasm: 1 })
  assert.equal(result.inspection.ready, true)
  assert.equal(result.manifest.schemaVersion, 1)
  assert.equal(result.manifest.paths.demoDist, 'demo-dist')
  assert.deepEqual(result.manifest.tools, fixedTools)
  assert.match(result.manifest.sourceFingerprint, /^[a-f0-9]{64}$/u)
  assert.equal(
    JSON.parse(
      await readFile(join(repositoryRoot, 'runtime', 'manifest.json'), 'utf8'),
    ).readiness.ready,
    true,
  )
})

test('reuses every layer when inputs and runtime outputs are unchanged', async (t) => {
  const { config, repositoryRoot } = await createWorkspace(t)
  const counts = new Map()
  const buildGroup = fixtureBuilder(repositoryRoot, counts)
  await prepare(config, buildGroup)
  const second = await prepare(config, buildGroup, {
    clock: () => new Date('2026-07-21T00:00:00.000Z'),
  })

  assert.deepEqual(Object.fromEntries(counts), { demo: 1, icons: 1, wasm: 1 })
  assert.deepEqual(
    second.actions.map(({ id, state }) => ({ id, state })),
    [
      { id: 'icons', state: 'reuse' },
      { id: 'wasm', state: 'reuse' },
      { id: 'demo', state: 'reuse' },
    ],
  )
  assert.equal(second.inspection.ready, true)
})

test('invalidates icons, WASM, and Demo layers independently', async (t) => {
  const { config, repositoryRoot } = await createWorkspace(t)
  const counts = new Map()
  const buildGroup = fixtureBuilder(repositoryRoot, counts)
  await prepare(config, buildGroup)

  for (const id of ['icons', 'wasm', 'demo']) {
    await writeFile(
      join(repositoryRoot, 'inputs', id, 'source.txt'),
      `${id}-source-v2`,
    )
    const result = await prepare(config, buildGroup)
    assert.deepEqual(
      result.actions
        .filter((action) => action.state === 'rebuild')
        .map((action) => action.id),
      [id],
    )
  }

  assert.deepEqual(Object.fromEntries(counts), { demo: 2, icons: 2, wasm: 2 })
})

test('detects missing, stale, corrupt, and mismatched runtime state', async (t) => {
  const { config, repositoryRoot } = await createWorkspace(t)
  const counts = new Map()
  await prepare(config, fixtureBuilder(repositoryRoot, counts))

  await rm(join(repositoryRoot, 'runtime', 'artifacts', 'icons'), {
    force: true,
    recursive: true,
  })
  await writeFile(
    join(repositoryRoot, 'inputs', 'wasm', 'source.txt'),
    'wasm-source-stale',
  )
  await writeFile(
    join(repositoryRoot, 'runtime', 'demo-dist', 'bundle.txt'),
    'tampered-demo',
  )
  const inspection = await inspectVisualRuntime(config)

  assert.equal(inspection.ready, false)
  assert(
    inspection.groups
      .find((group) => group.id === 'icons')
      .reasons.includes('icons runtime output is missing'),
  )
  assert(
    inspection.groups
      .find((group) => group.id === 'wasm')
      .reasons.includes('wasm source fingerprint changed'),
  )
  assert(
    inspection.groups
      .find((group) => group.id === 'demo')
      .reasons.includes('demo runtime artifact fingerprint mismatch'),
  )

  await writeFile(join(repositoryRoot, 'runtime', 'manifest.json'), '{not-json')
  const corrupt = await inspectVisualRuntime(config)
  assert(corrupt.reasons.includes('runtime manifest is invalid JSON'))
})

test('detects manifest configuration and fingerprint-file mismatches', async (t) => {
  const { config, repositoryRoot } = await createWorkspace(t)
  await prepare(config, fixtureBuilder(repositoryRoot, new Map()))
  const manifestPath = join(repositoryRoot, 'runtime', 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.configurationFingerprint = 'mismatched-configuration'
  manifest.tools.node = 'mismatched-node'
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(
    join(repositoryRoot, 'runtime', 'fingerprints', 'icons.sha256'),
    'mismatched-artifact\n',
  )

  const inspection = await inspectVisualRuntime(config)
  assert(
    inspection.reasons.includes(
      'runtime manifest configuration fingerprint mismatch',
    ),
  )
  assert(inspection.reasons.includes('runtime manifest tool versions mismatch'))
  assert(
    inspection.groups
      .find((group) => group.id === 'icons')
      .reasons.includes('icons runtime fingerprint file mismatch'),
  )
})

test('dry-run reports rebuild reasons without commands or writes', async (t) => {
  const { config, repositoryRoot } = await createWorkspace(t)
  const messages = []
  let builds = 0
  const result = await prepareVisualRuntime(config, {
    buildGroup: async () => {
      builds += 1
    },
    dryRun: true,
    logger: { info: (message) => messages.push(message) },
    tools: fixedTools,
  })

  assert.equal(builds, 0)
  assert.deepEqual(
    result.actions.map(({ id, state }) => ({ id, state })),
    [
      { id: 'icons', state: 'rebuild' },
      { id: 'wasm', state: 'rebuild' },
      { id: 'demo', state: 'rebuild' },
    ],
  )
  assert(messages.some((message) => message.includes('manifest is missing')))
  assert(messages.some((message) => message.includes('dry-run')))
  await assert.rejects(
    readFile(join(repositoryRoot, 'runtime', 'manifest.json')),
  )
})

test('works without Actions variables and exposes a local fallback command', async (t) => {
  const { config, repositoryRoot } = await createWorkspace(t)
  const previousActions = process.env.GITHUB_ACTIONS
  delete process.env.GITHUB_ACTIONS
  t.after(() => {
    if (previousActions === undefined) delete process.env.GITHUB_ACTIONS
    else process.env.GITHUB_ACTIONS = previousActions
  })

  const result = await prepare(
    config,
    fixtureBuilder(repositoryRoot, new Map()),
  )
  assert.equal(result.inspection.ready, true)

  await rm(join(repositoryRoot, 'runtime'), { force: true, recursive: true })
  await assert.rejects(
    prepare(
      config,
      fixtureBuilder(repositoryRoot, new Map(), { fail: 'icons' }),
    ),
    /Local fallback: fixture-build icons/u,
  )
})
