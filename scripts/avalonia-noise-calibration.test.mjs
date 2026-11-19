import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  assess,
  diagnosticArms,
  diagnosticArguments,
  driverHash,
} from './run-avalonia-noise-calibration.mjs'

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
    '61',
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
    new URL('./run-avalonia-noise-calibration.mjs', import.meta.url),
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

import {plan,quantile,describe,controls} from './avalonia-noise-plan.mjs'
test('prespecified 61 P95 is fourth largest; formal 21 second largest',()=>{
 assert.equal(quantile(Array.from({length:61},(_,i)=>i+1),.95),58)
 assert.equal(quantile(Array.from({length:21},(_,i)=>i+1),.95),20)
 assert.deepEqual(plan.sequence,['A1','B1','B2','A2','B3','A3','A4','B4'])
})
test('same binary controls must be symmetric and hash-equal',()=>{
 const arms={B1:{p95:10,assemblySha256:'b'},B2:{p95:12,assemblySha256:'b'},A3:{p95:20,assemblySha256:'a'},A4:{p95:10,assemblySha256:'a'}}
 assert.deepEqual(controls(arms).map(x=>x.within15PercentBothWays),[false,false])
 arms.B2.assemblySha256='different'; assert.throws(()=>controls(arms))
})
test('descriptive phases and chronology cannot silently accept 21 samples',()=>{
 const raw={Id:plan.scenario,RemountPerSample:false,LongScroll:{Iterations:256}}
 for(const p of ['FrameMs','MeasureArrangeMs','DrawMs','ActionMs','RenderAwaitMs']) raw[p]=Array(61).fill(1)
 assert.equal(describe(raw).windows.length,3)
 raw.FrameMs=Array(21).fill(1);assert.throws(()=>describe(raw))
})

import { validateAvaloniaLayoutReady as validate61 } from './verify-avalonia-noise-calibration.mjs'
import { validateAvaloniaLayoutReady as validate21 } from './verify-avalonia-layout-ready.mjs'
test('61 validation is strict and formal 21 verifier is unchanged', async () => {
 const protocol='variable-list-layout-ready.v1'
 const metrics=['FrameMs','ActionMs','RenderAwaitMs','MeasureArrangeMs','DrawMs','MountUnmountMs','AllocatedBytes']
 const counts=['RealizedVisuals','RealizedContainers','PooledContainers','RetainedMeasurements','LoadedWindows']
 const raw={Id:plan.scenario,MeasurementProtocol:protocol,RemountPerSample:false,LongScroll:{Iterations:256},...Object.fromEntries([...metrics,...counts].map(k=>[k,Array(61).fill(1)]))}
 const summary={SchemaVersion:2,Kind:'real-avalonia-render-measurement',Profile:'quick',MeasurementProtocol:protocol,Runner:{Samples:61,Warmups:1,ScenarioCount:1,LongScrollIterations:256},Results:[{...raw,DisposalMs:1,...Object.fromEntries(metrics.map(k=>[k,{Samples:61,P50:1,P95:1,P99:1,Min:1,Max:1}]))}]}
 assert.equal((await validate61(summary,()=>raw,plan.scenario)).samples,61)
 await assert.rejects(()=>validate21(summary,()=>raw,plan.scenario))
 summary.Results[0].FrameMs.P95=2
 await assert.rejects(()=>validate61(summary,()=>raw,plan.scenario),/raw mismatch/)
 summary.Results[0].FrameMs.P95=1
 raw.DrawMs.pop()
 await assert.rejects(()=>validate61(summary,()=>raw,plan.scenario),/sample count/)
})
