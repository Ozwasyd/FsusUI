import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  cleanupSuccessfulVisualEvidence,
  visualEvidencePolicy,
} from '../../scripts/visual-evidence-policy.mjs'

test('direct Playwright server path fails clearly when runtime is missing', async (t) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'fsusui-runtime-missing-'))
  t.after(() => rm(temporaryRoot, { force: true, recursive: true }))
  const result = spawnSync(
    process.execPath,
    [
      'scripts/serve-visual-runtime.mjs',
      '--suite=preview',
      `--runtime-dir=${join(temporaryRoot, 'runtime')}`,
      '--port=4199',
    ],
    {
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    },
  )

  assert.equal(result.status, 1)
  assert.match(result.stderr, /runtime is missing, stale, or mismatched/u)
  assert.match(result.stderr, /pnpm visual:prepare/u)
  assert.doesNotMatch(result.stdout, /command=/u)
  await assert.rejects(
    readFile(join(temporaryRoot, 'runtime', 'manifest.json')),
  )
})

test('normal mode keeps only failure evidence while evidence mode is explicit', () => {
  assert.deepEqual(visualEvidencePolicy({}), {
    evidence: false,
    preserveOutput: 'failures-only',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  })
  assert.deepEqual(visualEvidencePolicy({ FSUS_VISUAL_EVIDENCE: '1' }), {
    evidence: true,
    preserveOutput: 'always',
    screenshot: 'on',
    trace: 'on',
  })
})

test('custom screenshots are cleaned normally and retained for evidence', async (t) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'fsusui-evidence-policy-'))
  t.after(() => rm(temporaryRoot, { force: true, recursive: true }))
  const screenshot = join(temporaryRoot, 'screenshots', 'success.png')
  await mkdir(join(temporaryRoot, 'screenshots'), { recursive: true })
  await writeFile(screenshot, 'fixture')
  await cleanupSuccessfulVisualEvidence({}, temporaryRoot)
  await assert.rejects(readFile(screenshot))

  await mkdir(join(temporaryRoot, 'screenshots'), { recursive: true })
  await writeFile(screenshot, 'fixture')
  await cleanupSuccessfulVisualEvidence(
    { FSUS_VISUAL_EVIDENCE: '1' },
    temporaryRoot,
  )
  assert.equal(await readFile(screenshot, 'utf8'), 'fixture')
})
