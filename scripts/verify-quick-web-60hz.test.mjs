import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { runInNewContext } from 'node:vm'
import { materializeDriver } from './run-quick-web-60hz.mjs'
import { describeCadence } from './web-render-cadence.mjs'
import { verifyWebMeasurement } from './verify-quick-web-60hz.mjs'
const sha='292a6ca6d7659b18574ac1f3ae7a8f66494af7d4'
test('synthetic artifact controls: exact binding/raw cadence/P95 accepted; stock, tampered, relabelled fail',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'fsus-cadence-synthetic-test-'))
 const json=(name,v)=>writeFile(path.join(dir,name),JSON.stringify(v))
 try {
  const source=execFileSync('git',['show',`${sha}:scripts/web-render-performance.mjs`],{encoding:'utf8'})
  const generated=materializeDriver(source,'/synthetic/product','/synthetic/playwright.mjs')
  const binding={...generated.evidence,productSha:sha,productRoot:'/synthetic/product',playwrightEntry:'/synthetic/playwright.mjs',idleModule:new URL('./web-idle-cadence.mjs',import.meta.url).pathname,idleHelperSha256:createHash('sha256').update(await readFile(new URL('./web-idle-cadence.mjs',import.meta.url))).digest('hex'),cadenceModule:new URL('./web-render-cadence.mjs',import.meta.url).pathname,cadenceHelperSha256:createHash('sha256').update(await readFile(new URL('./web-render-cadence.mjs',import.meta.url))).digest('hex')}
  await writeFile(path.join(dir,'measurement-source.mjs'),source)
  await writeFile(path.join(dir,'measurement-effective.mjs'),generated.effectiveSource)
  await json('measurement-binding.json',binding)
  const matrix=JSON.parse(runInNewContext(generated.effectiveSource.slice(generated.effectiveSource.indexOf('const definitions ='),generated.effectiveSource.indexOf('const percentile ='))+'\nJSON.stringify(matrix)',{profile:'quick',scenarioFilter:''}))
  const idle={schema:'fsusui.idle-raf-preflight.v1',source:'same-browser-blank-context',browserVersion:'147.0.7727.15',intervals:Array(20).fill(1000/60),cadence:describeCadence(60,Array(20).fill(1000/60))}
  const rows=[]
  for(const [scenario,size,refreshHz,dpr,motion] of matrix){
   const id=`${scenario}-${size}-${refreshHz}hz-dpr${dpr}-${motion}`
   const cadence=describeCadence(60,[1000/60,1000/60])
   const common={id,scenario,size,refreshHz,dpr,motion,measurementProtocol:binding,idleCadence:idle,cadence,droppedFrameRate:0}
   rows.push({...common,inputToNextFrameMs:{p95:10}})
   await json(`${id}.raw.json`,{...common,frameIntervals:[1000/60,1000/60],inputToFrame:Array(21).fill(10)})
  }
  const summary={idleCadence:idle,environment:{browser:'Chromium 147.0.7727.15'},gitSha:sha,profile:'quick',runner:{samples:21,warmups:1,matrixSize:matrix.length},measurementProtocol:binding,results:rows}
  await json('summary.json',summary)
  await verifyWebMeasurement(dir,'292-candidate',sha)
  // Loaded jank remains real measurement; only idle context calibrates the protocol.
  const loadedRaw=JSON.parse(await readFile(path.join(dir,`${rows[0].id}.raw.json`),'utf8'))
  loadedRaw.frameIntervals=[33.3,33.3]
  loadedRaw.cadence=describeCadence(60,loadedRaw.frameIntervals)
  loadedRaw.droppedFrameRate=1
  rows[0].cadence=loadedRaw.cadence
  rows[0].droppedFrameRate=1
  await json(`${rows[0].id}.raw.json`,loadedRaw)
  await json('summary.json',summary)
  await verifyWebMeasurement(dir,'292-candidate',sha)
  loadedRaw.frameIntervals=[1000/60,1000/60]
  loadedRaw.cadence=describeCadence(60,loadedRaw.frameIntervals)
  loadedRaw.droppedFrameRate=0
  rows[0].cadence=loadedRaw.cadence
  rows[0].droppedFrameRate=0
  await json(`${rows[0].id}.raw.json`,loadedRaw)
  await json('summary.json',summary)

  await assert.rejects(verifyWebMeasurement(dir,'292-candidate','f'.repeat(40)))
  await json('summary.json',{...summary,measurementProtocol:undefined})
  await assert.rejects(verifyWebMeasurement(dir,undefined,sha))
  await json('summary.json',summary)
  rows[0].cadence={...rows[0].cadence,observedRafHz:120}
  await json('summary.json',summary)
  await assert.rejects(verifyWebMeasurement(dir,undefined,sha))
  rows[0].cadence=describeCadence(60,[1000/60,1000/60])
  rows[0].inputToNextFrameMs.p95=1
  await json('summary.json',summary)
  await assert.rejects(verifyWebMeasurement(dir,undefined,sha))
  rows[0].inputToNextFrameMs.p95=10
  rows[0].id=rows[0].id.replace('60hz','120hz')
  await json('summary.json',summary)
  await assert.rejects(verifyWebMeasurement(dir,undefined,sha))
 }finally{await rm(dir,{recursive:true,force:true})}
})
