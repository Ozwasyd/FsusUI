import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { adaptQuickWebDriver, verifyAdaptation, verifyFourArmProtocol } from './quick-web-60hz-adapter.mjs'
const source = (ref) => execFileSync('git', ['show', `${ref}:scripts/web-render-performance.mjs`], { encoding: 'utf8' })
const historical = source('f2d929a5d045439c35e93b4771f912ce50ec2337')
const candidate = source('292a6ca6d7659b18574ac1f3ae7a8f66494af7d4')
const matrix = (text, profile = 'quick', scenarioFilter = '') => runInNewContext(`${text.slice(text.indexOf('const definitions ='), text.indexOf('const percentile ='))  }\nJSON.stringify(matrix)`, { profile, scenarioFilter })
const entry = (text) => ({source: text, ...adaptQuickWebDriver(text)})

test('historical and candidate actual matrices preserve every workload and only retarget second dimension', () => {
  for (const text of [historical, candidate]) {
    const adapted = adaptQuickWebDriver(text)
    verifyAdaptation(text, adapted.effectiveSource, adapted.evidence)
    const before = JSON.parse(matrix(text))
    const after = JSON.parse(matrix(adapted.effectiveSource))
    assert.equal(after.length, before.length)
    assert.deepEqual(after, before.map(([name,size,hz,dpr,motion]) => [name,size,hz === 120 ? 60 : hz,dpr,motion]))
    assert.ok(after.some(([name,size,hz,dpr,motion]) => name === 'virtual-list-variable' && size === 100000 && hz === 60 && dpr === 2 && motion === 'reduced'))
    assert.throws(() => matrix(adapted.effectiveSource, 'full'))
    assert.throws(() => matrix(adapted.effectiveSource, 'quick', 'virtual-list'))
  }
  assert.equal(matrix(adaptQuickWebDriver(historical).effectiveSource), matrix(adaptQuickWebDriver(candidate).effectiveSource))
})
test('four arms require the same protocol and correct source role', () => {
  const arms = {A:entry(historical), Aprime:entry(historical), B:entry(candidate), Bprime:entry(candidate)}
  verifyFourArmProtocol(arms)
  assert.throws(() => verifyFourArmProtocol({...arms, B:entry(historical)}))
  const wrong = structuredClone(arms)
  wrong.B.evidence.protocolDigest = 'unadapted-120'
  assert.throws(() => verifyFourArmProtocol(wrong))
})
test('unknown source, transformed bytes, identity/schema and missing arm fail closed', () => {
  assert.throws(() => adaptQuickWebDriver(`${candidate  }\n`))
  const good = entry(candidate)
  assert.throws(() => verifyAdaptation(candidate, `${good.effectiveSource  }\n`, good.evidence))
  assert.throws(() => verifyAdaptation(candidate, good.effectiveSource, {...good.evidence,schema:'other'}))
  assert.throws(() => verifyFourArmProtocol({B:good}))
})

test('both drivers remove only FrameViewer snapshot category, retaining trace and layer metrics', () => {
  for (const text of [historical, candidate]) {
    const {effectiveSource} = adaptQuickWebDriver(text)
    assert.ok(!effectiveSource.includes('disabled-by-default-devtools.timeline.layers'))
    for (const fragment of ["session.send('LayerTree.enable')", "session.send('Tracing.start'", "'devtools.timeline'", "'RecalculateStyles'", "'Layout'", "'Paint'", "'RasterTask'"]) {
      assert.ok(effectiveSource.includes(fragment), fragment)
    }
    const beforeMetrics = text.slice(text.indexOf('      trace: {'), text.indexOf('      browserMetrics:'))
    assert.ok(effectiveSource.includes(beforeMetrics))
  }
})
