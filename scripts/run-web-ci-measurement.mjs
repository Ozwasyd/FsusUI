import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { collect, scalarScenario } from './web-ci-measurement-capture.mjs'
import { digest, score } from './web-ci-measurement-score.mjs'

// Declare the complete order before capturing anything. Reverse comparison order
// and interleave same-version controls instead of collecting them after the fact.
export function measurementPlan(pilot = false) {
  const cycles = [
    ['AB', 'AA', 'BA', 'BB'],
    ['BB', 'BA', 'AA', 'AB'],
    ['BA', 'BB', 'AB', 'AA'],
    ['AA', 'AB', 'BB', 'BA'],
    ['BB', 'AB', 'AA', 'BA'],
    ['BA', 'AA', 'AB', 'BB'],
  ]
  return (pilot ? cycles.slice(0, 1) : cycles).flat()
}

export async function runMeasurement(options, capture = collect) {
  const { baseline, candidate, output, pilot = false, samples = 61 } = options
  assert.match(baseline.sha, /^[a-f0-9]{40}$/u)
  assert.match(candidate.sha, /^[a-f0-9]{40}$/u)
  assert.notEqual(
    baseline.sha,
    candidate.sha,
    'different source commits required',
  )
  assert.notEqual(
    baseline.root,
    candidate.root,
    'separate source checkouts required',
  )
  assert.ok(
    [61, 101].includes(samples),
    'use 61 or 101 samples in every process',
  )
  await mkdir(path.dirname(output), { recursive: true })
  await mkdir(output)
  const kinds = measurementPlan(pilot)
  const write = (file, value) =>
    writeFile(path.join(output, file), JSON.stringify(value, null, 2) + '\n', {
      flag: 'wx',
    })
  await write('plan.json', {
    scenario: scalarScenario,
    formalAcceptance: false,
    baselineSha: baseline.sha,
    candidateSha: candidate.sha,
    pilot,
    samples,
    kinds,
  })

  const startedAt = new Date().toISOString()
  const deadline = performance.now() + 75 * 60_000
  const blocks = []
  const artifacts = Object.create(null)
  let identity
  try {
    for (const [sequence, kind] of kinds.entries()) {
      const runs = []
      for (const [index, side] of [...kind].entries()) {
        const product = side === 'A' ? baseline : candidate
        const name = `process-${sequence + 1}-${index + 1}`
        const remainingMs = Math.floor(deadline - performance.now())
        assert.ok(remainingMs > 0, 'diagnostic time budget exhausted')
        const { proof, bytes } = await capture({
          productRoot: product.root,
          expectedSha: product.sha,
          controllerRoot: options.controllerRoot,
          browser: options.browser,
          port: options.port,
          output: path.join(output, name),
          samples,
          timeoutMs: Math.min(90_000, remainingMs),
        })
        const current = {
          protocolDigest: proof.protocolDigest,
          environmentDigest: proof.environmentDigest,
        }
        identity ??= current
        assert.deepEqual(
          current,
          identity,
          'runner or measurement protocol changed',
        )
        const artifact = `${name}/${proof.capture.artifact}`
        artifacts[artifact] = bytes
        runs.push({ ...proof.capture, artifact })
      }
      blocks.push({ sequence, kind, runs })
    }
    const manifest = {
      schema: 'fsusui.paired-web-diagnostic.v1',
      baselineSha: baseline.sha,
      candidateSha: candidate.sha,
      scenario: scalarScenario,
      ...identity,
      samples,
      warmups: 1,
      threshold: 0.15,
      startedAt,
      endedAt: new Date().toISOString(),
      blocks,
    }
    manifest.manifestDigest = digest(JSON.stringify(manifest))
    const result = score(manifest, artifacts)
    await write('manifest.json', manifest)
    await write('diagnostic.json', result)
    return result
  } catch (error) {
    await write('diagnostic.json', {
      formalAcceptance: false,
      verdict: 'INCONCLUSIVE',
      reason: error instanceof Error ? error.message : String(error),
      completedBlocks: blocks.length,
      plannedBlocks: kinds.length,
    })
    throw error
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [
    baseRoot,
    baseSha,
    candidateRoot,
    candidateSha,
    browser,
    output,
    mode,
  ] = process.argv.slice(2)
  assert.ok(
    baseRoot &&
      baseSha &&
      candidateRoot &&
      candidateSha &&
      browser &&
      output &&
      [undefined, '--pilot'].includes(mode),
    'Usage: node scripts/run-web-ci-measurement.mjs BASE_ROOT BASE_SHA CANDIDATE_ROOT CANDIDATE_SHA PINNED_CHROME NEW_OUTPUT [--pilot]',
  )
  const result = await runMeasurement({
    baseline: { root: path.resolve(baseRoot), sha: baseSha },
    candidate: { root: path.resolve(candidateRoot), sha: candidateSha },
    controllerRoot: path.resolve(import.meta.dirname, '..'),
    browser: path.resolve(browser),
    output: path.resolve(output),
    pilot: mode === '--pilot',
  })
  console.log(JSON.stringify(result, null, 2))
}
