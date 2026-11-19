import assert from 'node:assert/strict'
import { test } from 'node:test'
import { captureIdleCadence } from './web-idle-cadence.mjs'
const fake = (evaluate) => {
 let closed=false
 return {browser:{version:()=> '147.0.7727.15',newContext:async()=>({newPage:async()=>({evaluate}),close:async()=>{closed=true}})},closed:()=>closed}
}
test('idle capture uses separate context and closes before reporting',async()=>{
 const f=fake(async()=>Array(20).fill(1000/60))
 const result=await captureIdleCadence(f.browser)
 assert.equal(result.cadence.status,'consistent-with-request')
 assert.equal(result.cadence.displayRefreshRateVerified,false)
 assert.ok(f.closed())
})
test('idle 120Hz, missing samples and hung preflight fail and close',async()=>{
 for(const evaluate of [async()=>Array(20).fill(1000/120),async()=>[],()=>new Promise(()=>{})]) {
  const f=fake(evaluate)
  await assert.rejects(captureIdleCadence(f.browser,10))
  assert.ok(f.closed())
 }
})
