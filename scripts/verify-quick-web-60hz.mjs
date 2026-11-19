import { URL } from 'node:url'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { materializeDriver } from './run-quick-web-60hz.mjs'
import { describeCadence } from './web-render-cadence.mjs'
const hash = (v) => createHash('sha256').update(v).digest('hex')
export async function verifyWebMeasurement(directory, expectedKind, expectedSha) {
  const text = (name) => readFile(path.join(directory,name),'utf8')
  const json = async (name) => JSON.parse(await text(name))
  const binding = await json('measurement-binding.json')
  const source = await text('measurement-source.mjs')
  // materializeDriver first enforces the exact allowlisted immutable source digest.
  const expected = materializeDriver(source,binding.productRoot,binding.playwrightEntry,binding.cadenceModule,binding.idleModule)
  assert.equal(await text('measurement-effective.mjs'),expected.effectiveSource)
  for (const [key,value] of Object.entries(expected.evidence)) assert.deepEqual(binding[key],value)
  assert.equal(binding.cadenceHelperSha256,hash(await readFile(new URL('./web-render-cadence.mjs',import.meta.url))))
  assert.equal(binding.idleHelperSha256,hash(await readFile(new URL('./web-idle-cadence.mjs',import.meta.url))))
  assert.match(expectedSha,/^[a-f0-9]{40}$/u)
  assert.equal(binding.productSha,expectedSha,'measured product SHA differs from expected checkout')
  if(expectedKind) assert.equal(binding.sourceKind,expectedKind)
  if(binding.sourceKind==='f2d-historical') assert.equal(binding.productSha,'f2d929a5d045439c35e93b4771f912ce50ec2337')
  const matrix = JSON.parse(runInNewContext(`${expected.effectiveSource.slice(expected.effectiveSource.indexOf('const definitions ='),expected.effectiveSource.indexOf('const percentile ='))}\nJSON.stringify(matrix)`,{profile:'quick',scenarioFilter:''},{timeout:1000}))
  const summary = await json('summary.json')
  assert.deepEqual(summary.measurementProtocol,binding)
  const idle=summary.idleCadence
  assert.equal(idle?.schema,'fsusui.idle-raf-preflight.v1')
  assert.equal(idle.source,'same-browser-blank-context')
  assert.equal(idle.intervals.length,20)
  assert.deepEqual(idle.cadence,describeCadence(60,idle.intervals))
  assert.equal(idle.cadence.status,'consistent-with-request','idle rAF protocol calibration failed')
  assert.equal(summary.environment.browser,`Chromium ${idle.browserVersion}`)
  assert.equal(summary.gitSha,binding.productSha)
  assert.equal(summary.profile,'quick')
  assert.equal(summary.runner.samples,21)
  assert.equal(summary.runner.warmups,1)
  assert.equal(summary.runner.matrixSize,matrix.length)
  const ids=matrix.map(([scenario,size,hz,dpr,motion])=>`${scenario}-${size}-${hz}hz-dpr${dpr}-${motion}`)
  assert.deepEqual(summary.results.map(x=>x.id),ids)
  for(const [index,row] of summary.results.entries()) {
    assert.deepEqual([row.scenario,row.size,row.refreshHz,row.dpr,row.motion],matrix[index])
    const raw=await json(`${row.id}.raw.json`)
    assert.equal(raw.id,row.id)
    assert.deepEqual(raw.measurementProtocol,binding)
    assert.deepEqual(raw.idleCadence,idle)
    assert.deepEqual(row.idleCadence,idle)
    for(const key of ['scenario','size','refreshHz','dpr','motion']) assert.equal(raw[key],row[key])
    assert.equal(row.refreshHz,60)
    const observed=describeCadence(60,raw.frameIntervals)
    assert.deepEqual(raw.cadence,observed)
    assert.deepEqual(row.cadence,observed)
    assert.ok(raw.inputToFrame.length===21 && raw.inputToFrame.every(x=>Number.isFinite(x)&&x>=0))
    const sorted=[...raw.inputToFrame].sort((a,b)=>a-b)
    assert.equal(row.inputToNextFrameMs.p95,sorted[Math.ceil(sorted.length*.95)-1])
    const drops=raw.frameIntervals.filter(x=>x>(1000/60)*1.5).length/Math.max(1,raw.frameIntervals.length)
    assert.equal(raw.droppedFrameRate,drops)
    assert.equal(row.droppedFrameRate,drops)
  }
  return binding
}
