import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describeCadence } from './web-render-cadence.mjs'

export const digest = (bytes) =>
  createHash('sha256').update(bytes).digest('hex')
const canonical = (value) => JSON.stringify(value)
const quantile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]
const median = (values) => {
  const a = [...values].sort((a, b) => a - b)
  return (a[Math.floor((a.length - 1) / 2)] + a[Math.floor(a.length / 2)]) / 2
}
const finiteSamples = (a, n) =>
  Array.isArray(a) &&
  a.length === n &&
  a.every((x) => Number.isFinite(x) && x >= 0)
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
// Exact distribution-free order-statistic interval for the median of independent
// paired log P95 ratios. No resampling, sample removal, or per-frame pseudoreplication.
export function medianInterval(values) {
  const n = values.length,
    sorted = [...values].sort((a, b) => a - b)
  let choose = 1,
    tail = 0,
    k = 0,
    coverage = 1
  for (let j = 0; j < Math.floor(n / 2); j++) {
    if (j > 0) choose = (choose * (n - j + 1)) / j
    tail += choose / 2 ** n
    if (2 * tail <= 0.05) {
      k = j + 1
      coverage = 1 - 2 * tail
    }
  }
  return k ? { low: sorted[k - 1], high: sorted[n - k], coverage, k, n } : null
}

export function score(manifest, artifacts) {
  assert.equal(manifest.schema, 'fsusui.paired-web-diagnostic.v1')
  assert.equal(manifest.threshold, 0.15, 'threshold cannot be relaxed')
  assert.ok(
    sha(manifest.baselineSha) &&
      sha(manifest.candidateSha) &&
      manifest.baselineSha !== manifest.candidateSha,
  )
  assert.ok(
    [21, 61, 101].includes(manifest.samples),
    'supported exact sample count',
  )
  assert.equal(manifest.warmups, 1)
  const { manifestDigest, ...unsigned } = manifest
  assert.equal(manifestDigest, digest(canonical(unsigned)), 'manifest digest')
  assert.ok(Array.isArray(manifest.blocks) && manifest.blocks.length > 0)
  assert.ok(
    typeof manifest.scenario === 'string' && manifest.scenario.length > 0,
  )
  for (const key of ['protocolDigest', 'environmentDigest'])
    assert.match(manifest[key], /^[a-f0-9]{64}$/)
  const identities = new Set(),
    effects = [],
    aa = [],
    bb = [],
    orientations = [],
    details = []
  let previousEnd = -Infinity
  for (const [index, block] of manifest.blocks.entries()) {
    assert.equal(block.sequence, index, 'misordered block')
    assert.ok(['AB', 'BA', 'AA', 'BB'].includes(block.kind))
    assert.equal(block.runs.length, 2)
    const scored = []
    for (let side = 0; side < 2; side++) {
      const run = block.runs[side]
      assert.ok(
        typeof run.processId === 'string' &&
          run.processId.length > 0 &&
          !identities.has(run.processId),
        'independent unique process identity',
      )
      identities.add(run.processId)
      const start = Date.parse(run.startedAt),
        end = Date.parse(run.endedAt)
      assert.ok(
        Number.isFinite(start) && end > start && start >= previousEnd,
        'stale/misordered or overlapping process blocks',
      )
      previousEnd = end
      assert.ok(
        start >= Date.parse(manifest.startedAt) &&
          end <= Date.parse(manifest.endedAt),
        'manifest time range',
      )
      const expectedSha =
        block.kind[side] === 'A' ? manifest.baselineSha : manifest.candidateSha
      assert.equal(run.productSha, expectedSha)
      const bytes = artifacts[run.artifact]
      assert.ok(bytes, 'missing raw artifact')
      assert.equal(digest(bytes), run.sha256, 'raw byte digest')
      const raw = JSON.parse(bytes)
      // Envelope is emitted by a trusted capture controller, not inferred from mtime.
      assert.equal(raw.schema, 'fsusui.process-web-capture.v1')
      assert.equal(raw.processId, run.processId)
      assert.equal(raw.productSha, expectedSha)
      assert.equal(raw.scenario, manifest.scenario)
      assert.equal(raw.protocolDigest, manifest.protocolDigest)
      assert.equal(raw.environmentDigest, manifest.environmentDigest)
      assert.equal(raw.warmups, manifest.warmups)
      assert.equal(raw.idleIntervals?.length, 20, 'incomplete idle cadence')
      assert.equal(
        describeCadence(60, raw.idleIntervals).status,
        'consistent-with-request',
        'idle cadence mismatch',
      )
      assert.ok(
        Date.parse(raw.generatedAt) >= start &&
          Date.parse(raw.generatedAt) <= end,
        'stale capture',
      )
      assert.ok(
        finiteSamples(raw.inputToFrame, manifest.samples) &&
          finiteSamples(raw.frameWork, manifest.samples),
      )
      assert.ok(
        raw.inputToFrame.every((v, i) => v >= raw.frameWork[i]),
        'negative action-to-frame interval',
      )
      const p95 = quantile(raw.inputToFrame, 0.95)
      assert.ok(p95 > 0)
      const wait = raw.inputToFrame.map((v, i) => v - raw.frameWork[i])
      scored.push(p95)
      details.push({
        processId: run.processId,
        p95,
        inputMedian: median(raw.inputToFrame),
        actionP95: quantile(raw.frameWork, 0.95),
        waitP95: quantile(wait, 0.95),
        samples: raw.inputToFrame.length,
      })
    }
    const log = Math.log(scored[1] / scored[0])
    if (block.kind === 'AA') aa.push(log)
    else if (block.kind === 'BB') bb.push(log)
    else {
      effects.push(block.kind === 'AB' ? log : -log)
      orientations.push(block.kind)
    }
  }
  const enough =
    effects.length >= 12 &&
    aa.length >= 6 &&
    bb.length >= 6 &&
    orientations.filter((x) => x === 'AB').length >= 6 &&
    orientations.filter((x) => x === 'BA').length >= 6
  const base = {
    formalAcceptance: false,
    threshold: 0.15,
    counts: { paired: effects.length, AA: aa.length, BB: bb.length },
    details,
    limitations: [
      'Diagnostic only; independent process blocks and comparable controlled environment are prerequisites, not established by JSON alone.',
      'Targets median paired process P95 ratio, not pooled-frame P95.',
      'Control envelope is observed noise, not a population noise confidence bound.',
    ],
  }
  if (!enough)
    return {
      ...base,
      verdict: 'INCONCLUSIVE',
      reason:
        'Need >=12 independent AB/BA blocks (>=6 each) plus >=6 AA and >=6 BB controls; old four arms cannot pass.',
    }
  const interval = medianInterval(effects)
  const noise = Math.max(...aa.map(Math.abs), ...bb.map(Math.abs))
  const lower = Math.exp(interval.low - noise),
    upper = Math.exp(interval.high + noise)
  const orderDifference = Math.abs(
    median(effects.filter((_, i) => orientations[i] === 'AB')) -
      median(effects.filter((_, i) => orientations[i] === 'BA')),
  )
  // Order bias exceeding the actual same-version noise invalidates attribution.
  const orderBiased = orderDifference > Math.max(noise, 0.01)
  const verdict = orderBiased
    ? 'INCONCLUSIVE'
    : lower > 1.15
      ? 'REGRESSION'
      : upper <= 1.15
        ? 'PASS'
        : 'INCONCLUSIVE'
  return {
    ...base,
    verdict,
    reason: orderBiased
      ? 'AB/BA order asymmetry exceeds observed controls'
      : 'Paired median interval expanded by worst observed same-version log drift',
    ratio: Math.exp(median(effects)),
    interval: { lower, upper, nominalMedianCoverage: interval.coverage },
    observedNoiseFactor: Math.exp(noise),
    orderDifference,
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const file = path.resolve(process.argv[2] ?? 'manifest.json')
  const m = JSON.parse(await readFile(file, 'utf8')),
    artifacts = {}
  for (const b of m.blocks)
    for (const r of b.runs) {
      const target = path.resolve(path.dirname(file), r.artifact)
      assert.ok(
        target.startsWith(`${path.dirname(file)}${path.sep}`),
        'artifact must remain within manifest directory',
      )
      artifacts[r.artifact] = await readFile(target)
    }
  console.log(JSON.stringify(score(m, artifacts), null, 2))
}
