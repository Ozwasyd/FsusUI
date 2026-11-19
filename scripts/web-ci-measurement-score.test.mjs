import { test } from 'node:test'
import assert from 'node:assert/strict'
import { score, digest, medianInterval } from './web-ci-measurement-score.mjs'
const A = 'a'.repeat(40),
  B = 'b'.repeat(40)
function fixture(ratio = 1, noise = 1, n = 12) {
  const m = {
      schema: 'fsusui.paired-web-diagnostic.v1',
      baselineSha: A,
      candidateSha: B,
      scenario: 'data-pipeline-table-100000-60hz-dpr2-reduced',
      protocolDigest: 'c'.repeat(64),
      environmentDigest: 'd'.repeat(64),
      samples: 61,
      warmups: 1,
      threshold: 0.15,
      startedAt: new Date(0).toISOString(),
      endedAt: new Date(1000000).toISOString(),
      blocks: [],
    },
    artifacts = {}
  let t = 0
  const kinds = [
    ...Array.from({ length: n }, (_, i) => (i % 2 ? 'BA' : 'AB')),
    ...Array(6).fill('AA'),
    ...Array(6).fill('BB'),
  ]
  for (const kind of kinds) {
    const block = { sequence: m.blocks.length, kind, runs: [] }
    for (let side = 0; side < 2; side++) {
      const processId = `process-${t}`,
        productSha = kind[side] === 'A' ? A : B,
        start = t++ * 1000,
        end = start + 999
      const input =
        10 *
        (productSha === B ? ratio : 1) *
        (['AA', 'BB'].includes(kind) && side === 1 ? noise : 1)
      const raw = {
        schema: 'fsusui.process-web-capture.v1',
        processId,
        productSha,
        scenario: m.scenario,
        protocolDigest: m.protocolDigest,
        environmentDigest: m.environmentDigest,
        warmups: 1,
        idleIntervals: Array(20).fill(1000 / 60),
        generatedAt: new Date(end).toISOString(),
        inputToFrame: Array(61).fill(input),
        frameWork: Array(61).fill(5),
      }
      const artifact = `raw/${processId}.json`,
        bytes = JSON.stringify(raw)
      artifacts[artifact] = bytes
      block.runs.push({
        processId,
        productSha,
        startedAt: new Date(start).toISOString(),
        endedAt: new Date(end).toISOString(),
        artifact,
        sha256: digest(bytes),
      })
    }
    m.blocks.push(block)
  }
  seal(m)
  return { m, artifacts }
}
function seal(m) {
  delete m.manifestDigest
  m.manifestDigest = digest(JSON.stringify(m))
}
test('clear same and changed populations; all samples retained; never formal acceptance', () => {
  for (const [ratio, wanted] of [
    [1, 'PASS'],
    [1.4, 'REGRESSION'],
    [1.14, 'PASS'],
  ]) {
    const { m, artifacts } = fixture(ratio)
    const r = score(m, artifacts)
    assert.equal(r.verdict, wanted)
    assert.equal(r.formalAcceptance, false)
    assert.equal(r.details.length, 48)
    assert.ok(r.details.every((x) => x.samples === 61))
  }
})
test('control noise makes marginal movement inconclusive', () => {
  const { m, artifacts } = fixture(1.16, 1.1)
  assert.equal(score(m, artifacts).verdict, 'INCONCLUSIVE')
})
test('old four arms and missing same-version controls cannot pass', () => {
  for (const kind of ['short', 'no-controls']) {
    const { m, artifacts } = fixture()
    m.blocks =
      kind === 'short'
        ? m.blocks.slice(0, 2)
        : m.blocks.filter((b) => ['AB', 'BA'].includes(b.kind))
    seal(m)
    assert.equal(score(m, artifacts).verdict, 'INCONCLUSIVE')
  }
})
test('stale, misordered, reused, wrong identity, digest and missing artifacts reject', () => {
  const mutations = [
    (m) => (m.blocks[0].sequence = 1),
    (m) => (m.blocks[1].runs[0].startedAt = m.blocks[0].runs[0].startedAt),
    (m) => (m.blocks[1].runs[0].processId = m.blocks[0].runs[0].processId),
    (m) => (m.blocks[0].runs[0].productSha = B),
    (m) => (m.blocks[0].runs[0].sha256 = '0'.repeat(64)),
  ]
  for (const change of mutations) {
    const { m, artifacts } = fixture()
    change(m)
    seal(m)
    assert.throws(() => score(m, artifacts))
  }
  const { m, artifacts } = fixture()
  delete artifacts[m.blocks[0].runs[0].artifact]
  assert.throws(() => score(m, artifacts))
})
test('within-envelope stale timestamp, protocol and sample loss reject even when byte hash renewed', () => {
  for (const modify of [
    (r) => (r.generatedAt = new Date(100000).toISOString()),
    (r) => (r.protocolDigest = 'e'.repeat(64)),
    (r) => r.inputToFrame.pop(),
    (r) => r.idleIntervals.fill(1000 / 120),
  ]) {
    const { m, artifacts } = fixture()
    const run = m.blocks[0].runs[0],
      raw = JSON.parse(artifacts[run.artifact])
    modify(raw)
    artifacts[run.artifact] = JSON.stringify(raw)
    run.sha256 = digest(artifacts[run.artifact])
    seal(m)
    assert.throws(() => score(m, artifacts))
  }
})
test('AB/BA bias is not a product verdict', () => {
  const { m, artifacts } = fixture()
  for (const b of m.blocks.filter((x) => x.kind === 'AB')) {
    const run = b.runs[1],
      r = JSON.parse(artifacts[run.artifact])
    r.inputToFrame.fill(20)
    artifacts[run.artifact] = JSON.stringify(r)
    run.sha256 = digest(artifacts[run.artifact])
  }
  seal(m)
  assert.equal(score(m, artifacts).verdict, 'INCONCLUSIVE')
})
test('exact order-statistic coverage, not bootstrap precision', () => {
  const x = medianInterval(Array.from({ length: 12 }, (_, i) => i))
  assert.equal(x.k, 3)
  assert.equal(x.low, 2)
  assert.equal(x.high, 9)
  assert.equal(x.coverage, 1 - 158 / 4096)
})
