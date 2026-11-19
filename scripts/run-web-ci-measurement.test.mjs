import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { materializeDriver } from './run-quick-web-60hz.mjs'
import { digest } from './web-ci-measurement-score.mjs'
import { scalarDriver, scalarScenario } from './web-ci-measurement-capture.mjs'
import { measurementPlan, runMeasurement } from './run-web-ci-measurement.mjs'

test('full order interleaves fresh controls and both orientations; pilot cannot be scored', () => {
  const full = measurementPlan()
  assert.equal(full.length, 24)
  for (const kind of ['AB', 'BA', 'AA', 'BB']) {
    assert.equal(full.filter((value) => value === kind).length, 6)
  }
  for (let i = 0; i < full.length; i += 4)
    assert.equal(new Set(full.slice(i, i + 4)).size, 4)
  assert.equal(measurementPlan(true).length, 4)
})

test('known current driver preserves sandbox and targets the 60 Hz fixture', async () => {
  const product = path.resolve(import.meta.dirname, '..')
  const source = await readFile(
    path.join(product, 'scripts/web-render-performance.mjs'),
    'utf8',
  )
  const effective = scalarDriver(
    materializeDriver(source, product, '/test/playwright/index.mjs')
      .effectiveSource,
  )
  execFileSync(process.execPath, ['--check', '--input-type=module'], {
    input: effective,
  })
  assert.match(effective, /chromiumSandbox: true/u)
  assert.match(effective, /quickDimensions\[1\]/u)
  assert.match(effective, /captureIdleCadence\(browser\)/u)
  assert.match(effective, /browser\.version\(\) !== '147\.0\.7727\.15'/u)
})

test('runner drift aborts and does not publish a scored manifest or replace samples', async () => {
  const temp = await mkdtemp(
    path.join(os.tmpdir(), 'fsus-ci-measurement-test-'),
  )
  try {
    const output = path.join(temp, 'output')
    const seen = []
    const fake = async ({ expectedSha }) => {
      seen.push(expectedSha)
      return {
        proof: {
          protocolDigest: 'constant',
          environmentDigest: String(seen.length),
          capture: { artifact: 'capture.json' },
        },
        bytes: '{}',
      }
    }
    const a = 'a'.repeat(40)
    const b = 'b'.repeat(40)
    await assert.rejects(
      runMeasurement(
        {
          baseline: { root: '/baseline', sha: a },
          candidate: { root: '/candidate', sha: b },
          output,
        },
        fake,
      ),
      /runner or measurement protocol changed/u,
    )
    assert.deepEqual(seen, [a, b])
    const diagnostic = JSON.parse(
      await readFile(path.join(output, 'diagnostic.json'), 'utf8'),
    )
    assert.equal(diagnostic.formalAcceptance, false)
    assert.equal(diagnostic.verdict, 'INCONCLUSIVE')
    await assert.rejects(readFile(path.join(output, 'manifest.json')), {
      code: 'ENOENT',
    })
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})

test('a complete pilot emits auditable raw identities and stays inconclusive', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'fsus-ci-pilot-test-'))
  try {
    const output = path.join(temp, 'output')
    const a = 'a'.repeat(40)
    const b = 'b'.repeat(40)
    const protocolDigest = '1'.repeat(64)
    const environmentDigest = '2'.repeat(64)
    let completed = 0
    let previousEnd = 0
    const capture = async ({ expectedSha, output: processOutput, samples }) => {
      const processId = path.basename(processOutput)
      const startedAt = new Date(
        Math.max(Date.now(), previousEnd),
      ).toISOString()
      await new Promise((resolve) => setTimeout(resolve, 2))
      previousEnd = Date.now()
      completed += 1
      const endedAt = new Date(previousEnd).toISOString()
      const bytes = JSON.stringify({
        schema: 'fsusui.process-web-capture.v1',
        processId,
        productSha: expectedSha,
        scenario: scalarScenario,
        protocolDigest,
        environmentDigest,
        warmups: 1,
        idleIntervals: Array(20).fill(1000 / 60),
        generatedAt: endedAt,
        inputToFrame: Array(samples).fill(12),
        frameWork: Array(samples).fill(6),
      })
      return {
        bytes,
        proof: {
          protocolDigest,
          environmentDigest,
          capture: {
            artifact: 'capture.json',
            processId,
            productSha: expectedSha,
            startedAt,
            endedAt,
            sha256: digest(bytes),
          },
        },
      }
    }
    const result = await runMeasurement(
      {
        baseline: { root: '/baseline', sha: a },
        candidate: { root: '/candidate', sha: b },
        output,
        pilot: true,
      },
      capture,
    )
    assert.equal(completed, 8)
    assert.equal(result.verdict, 'INCONCLUSIVE')
    assert.equal(result.formalAcceptance, false)
    const manifest = JSON.parse(
      await readFile(path.join(output, 'manifest.json'), 'utf8'),
    )
    assert.deepEqual(
      manifest.blocks.map((block) => block.kind),
      ['AB', 'AA', 'BA', 'BB'],
    )
    assert.equal(
      new Set(
        manifest.blocks.flatMap((block) =>
          block.runs.map((run) => run.artifact),
        ),
      ).size,
      8,
    )
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})
