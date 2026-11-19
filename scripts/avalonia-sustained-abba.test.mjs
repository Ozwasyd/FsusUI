import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  assess,
  diagnosticArms,
  diagnosticArguments,
  driverHash,
} from './run-avalonia-sustained-abba.mjs'

test('fixed eight fresh arm orders ABBA then BAAB use sustained only', () => {
  assert.deepEqual(
    diagnosticArms.map((a) => a.name),
    ['A1', 'B1', 'B2', 'A2', 'B3', 'A3', 'A4', 'B4'],
  )
  assert.deepEqual(
    diagnosticArms.map((a) => a.product),
    [
      'baseline',
      'candidate',
      'candidate',
      'baseline',
      'candidate',
      'baseline',
      'baseline',
      'candidate',
    ],
  )
  assert.ok(
    diagnosticArms.every(
      (a) => a.scenario === 'virtual-list-variable-100k-sustained',
    ),
  )
})
test('unchanged work and native backend selection', () => {
  const args = diagnosticArguments(
    '/demo.dll',
    '/out',
    diagnosticArms[0].scenario,
  )
  assert.deepEqual(args, [
    '/demo.dll',
    '--render-performance',
    '--profile',
    'quick',
    '--warmups',
    '1',
    '--samples',
    '21',
    '--long-scroll-iterations',
    '256',
    '--output',
    '/out/summary.json',
    '--scenario',
    'virtual-list-variable-100k-sustained',
  ])
})
test('both order directions remain visible even when block passes', () => {
  const result = assess({
    A1: 10,
    A2: 10,
    B1: 12,
    B2: 10,
    A3: 10,
    A4: 10,
    B3: 10,
    B4: 10,
  })
  assert.equal(result.bothBlocksPass, true)
  assert.equal(result.allDirectionsPass, false)
  assert.equal(result.blocks[0].directions[0].pass15Percent, false)
  assert.equal(result.blocks[0].ratio, Math.sqrt(1.2))
})
test('15 percent unchanged, no averaged-away block failure, same-product drift', () => {
  const result = assess({
    A1: 10,
    A2: 10,
    B1: 11.5,
    B2: 11.5,
    A3: 20,
    A4: 20,
    B3: 24,
    B4: 24,
  })
  assert.equal(result.blocks[0].pass15Percent, true)
  assert.equal(result.blocks[1].pass15Percent, false)
  assert.equal(result.bothBlocksPass, false)
  assert.equal(result.sameProductDrift.A.secondBlockOverFirst, 2)
  assert.equal(result.sameProductDrift.A.maxMinRatio, 2)
  assert.throws(() => assess({ A1: 0 }))
  assert.throws(() => assess({ A1: NaN }))
})
test('unmodified immutable driver, real builds once, no tracing and bound evidence', async () => {
  const source = await readFile(
    new URL('./run-avalonia-sustained-abba.mjs', import.meta.url),
    'utf8',
  )
  assert.equal(
    driverHash,
    '00177df9361a989eee97bfe5d0d9e2cb29888352c908e5072498d334ab8b7701',
  )
  assert.match(source, /assert.equal\(sha256\(driver\), driverHash/)
  assert.match(source, /writeFile\(adapted, driver\)/)
  assert.doesNotMatch(
    source,
    /createGcOverlay|gc.nettrace|DOTNET_EnableEventPipe:|EventPipeConfig:/,
  )
  assert.match(source, /delete cleanEnv\[key\]/)
  assert.match(source, /10\\.0\\.401/)
  assert.match(source, /'--fx-version',\s*'10.0.15'/)
  assert.match(source, /for \(const arm of diagnosticArms\)/)
  assert.match(source, /sha256\(await readFile\(path.join\(directory, f\)\)\)/)
  assert.match(source, /summary.Environment,\s*environment/)
  assert.match(
    source,
    /assert.equal\(summary.Runner.LongScrollIterations, 256\)/,
  )
  assert.match(
    source,
    /mkdtemp\(\s*path\.join\(tmpdir\(\), 'fsus-sustained-build-'/,
  )
})
