import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const hash = (value) => createHash('sha256').update(value).digest('hex')
const allowedDrivers = new Map([
  ['a90312a4b2887fd5c2015cc1cdfe02d50f1ee09f45a039e7705d99accc42f0b2', 'f2d-historical'],
  ['6c1d70347be01841c21eb53afaa9bec0190311225105714d648bfef63a0f1db8', '292-candidate'],
])
const originalDimensions = `const quickDimensions = [
  [60, 1, 'enabled'],
  [120, 2, 'reduced'],
  [60, 2, 'disabled'],
]`
const effectiveDimensions = originalDimensions.replace('[120, 2', '[60, 2')
const guard = `if (profile !== 'quick' || scenarioFilter !== '')
  throw new Error('quick-web-60hz.v1 requires the complete unfiltered quick matrix')
`
export const protocol = Object.freeze({
  schema: 'fsusui.quick-web-cadence.v1',
  requestedHz: 60,
  profile: 'quick',
  dimensions: [[60, 1, 'enabled'], [60, 2, 'reduced'], [60, 2, 'disabled']],
  transformation: 'quick-second-dimension-120-to-60-without-frame-viewer-snapshots',
  traceCategories: ['devtools.timeline'],
  layerTreeDomain: 'preserved',
  chromiumSandbox: true,
  calibration: 'same-browser-blank-context-20-idle-raf-intervals',
})
export const protocolDigest = hash(JSON.stringify(protocol))

// Pure transformation: no source files, artifacts, or existing identities are written.
export function adaptQuickWebDriver(source) {
  const sourceSha256 = hash(source)
  assert.ok(allowedDrivers.has(sourceSha256), 'unsupported measurement driver digest')
  assert.equal(source.split(originalDimensions).length, 2, 'unsupported dimensions layout')
  const oldCategories = 'devtools.timeline,disabled-by-default-devtools.timeline.layers'
  assert.equal(source.split(oldCategories).length, 2, 'unsupported tracing layout')
  assert.equal(source.split('    headless: true,').length, 2, 'unsupported launch layout')
  const effectiveSource = source
    .replace(originalDimensions, guard + effectiveDimensions)
    .replace(oldCategories, 'devtools.timeline')
    .replace('    headless: true,', '    headless: true,\n    chromiumSandbox: true,')
  return {
    effectiveSource,
    evidence: {
      schema: 'fsusui.quick-web-driver-adaptation.v1',
      protocolDigest,
      sourceSha256,
      effectiveSha256: hash(effectiveSource),
      sourceKind: allowedDrivers.get(sourceSha256),
    },
  }
}

export function verifyAdaptation(source, effectiveSource, evidence) {
  const expected = adaptQuickWebDriver(source)
  assert.equal(effectiveSource, expected.effectiveSource, 'effective driver drift')
  assert.deepEqual(evidence, expected.evidence, 'adaptation identity mismatch')
}

export function verifyFourArmProtocol(arms) {
  assert.deepEqual(Object.keys(arms).sort(), ['A', 'Aprime', 'B', 'Bprime'])
  for (const [arm, entry] of Object.entries(arms)) {
    verifyAdaptation(entry.source, entry.effectiveSource, entry.evidence)
    assert.equal(entry.evidence.sourceKind, arm.startsWith('A') ? 'f2d-historical' : '292-candidate')
  }
}
