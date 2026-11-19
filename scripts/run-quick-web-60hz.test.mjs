import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { readFile, access, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { materializeDriver, launchQuickWeb } from './run-quick-web-60hz.mjs'
const sha='292a6ca6d7659b18574ac1f3ae7a8f66494af7d4'
const repository=fileURLToPath(new URL('..',import.meta.url))
const temp=await mkdtemp(path.join(os.tmpdir(),'fsus-adapter-test-'))
const root=path.join(temp,'product')
execFileSync('git',['worktree','add','--detach',root,sha],{cwd:repository,stdio:'pipe'})
after(async()=>{execFileSync('git',['worktree','remove','--force',root],{cwd:repository});await rm(temp,{recursive:true,force:true})})

test('sidecar launch binds raw/summary at generation, fixed samples, real product cwd, and cleans up', async () => {
 let sidecar
 const result = await launchQuickWeb({productRoot:root,dependenciesRoot:root,expectedSha:sha,output:'/tmp/nonexistent-fake-measurement'}, {
  playwrightEntry:'/tmp/fake-playwright-entry.mjs',
  run:async (_node,args,options)=>{
   sidecar=args[0]
   const source=await readFile(sidecar,'utf8')
   assert.ok(source.includes(`const root = "${root}"`))
   assert.ok(source.includes('const cadence = describeCadence(refreshHz, pageMetrics.frameIntervals)'))
   assert.equal(source.split('      measurementProtocol,').length-1,2)
   assert.ok(source.includes('    measurementProtocol,\n    idleCadence,\n    gitSha:'))
   assert.equal(options.cwd,root)
   assert.equal(options.timeoutMs,900000)
   assert.equal(options.env.GITHUB_SHA,sha)
   assert.equal(options.env.FSUSUI_WEB_FAILURE_DIAGNOSTICS,'0')
   assert.equal(JSON.parse(options.env.FSUSUI_WEB_PROTOCOL_BINDING).productSha,sha)
   assert.deepEqual(args.slice(1,7),['--profile','quick','--warmups','1','--samples','21'])
   return {code:0,signal:null}
  },
 })
 assert.equal(result.binding.productSha,sha)
 await assert.rejects(access(sidecar))
})
test('historical sidecar resolves its product root, preserves LayerTree and source file bytes', () => {
 const before=execFileSync('git',['show','f2d929a5d045439c35e93b4771f912ce50ec2337:scripts/web-render-performance.mjs'],{cwd:root,encoding:'utf8'})
 const result=materializeDriver(before,'/explicit/historical/product','/explicit/current/dependencies/playwright.mjs')
 assert.ok(result.effectiveSource.includes('const root = "/explicit/historical/product"'))
 assert.ok(result.effectiveSource.includes("session.send('LayerTree.enable')"))
 assert.ok(!result.effectiveSource.includes('disabled-by-default-devtools.timeline.layers'))
 assert.equal(result.evidence.sourceKind,'f2d-historical')
 assert.equal(execFileSync('git',['show','f2d929a5d045439c35e93b4771f912ce50ec2337:scripts/web-render-performance.mjs'],{cwd:root,encoding:'utf8'}),before)
})
test('incorrect checkout and failed fake process cannot report success', async () => {
 await assert.rejects(launchQuickWeb({productRoot:root,expectedSha:'wrong',dependenciesRoot:root,output:'/tmp/not-created'}))
 await assert.rejects(launchQuickWeb({productRoot:root,expectedSha:sha,dependenciesRoot:root,output:'/tmp/not-created'}, {playwrightEntry:'/tmp/fake.mjs',run:async()=>({code:1,signal:null})}))
})

test('both orchestrators opt into the same sidecar; old pnpm route remains default',async()=>{
 const current=await readFile(new URL('./run-render-performance.mjs',import.meta.url),'utf8')
 const historical=await readFile(new URL('./run-historical-render-baseline.mjs',import.meta.url),'utf8')
 const comparator=await readFile(new URL('./compare-render-performance.mjs',import.meta.url),'utf8')
 assert.ok(current.includes("process.env.FSUSUI_WEB_MEASUREMENT_PROTOCOL"))
 assert.ok(current.includes('await launchQuickWeb({productRoot:root,dependenciesRoot:controllerRoot'))
 assert.ok(current.includes("await verifyWebMeasurement(path.join(output,'web'),undefined,expectedSha)"))
 assert.ok(historical.includes("? [path.join(root, 'scripts/run-render-performance.mjs'), '--product-root', directory]"))
 assert.ok(historical.includes(": ['perf:render', '--']"))
 assert.ok(comparator.includes("if (limit !== 0.15)"))
 assert.ok(comparator.includes("candidate driver differs from expected checkout"))
 assert.ok(comparator.includes("currentPlan?.platforms.web.run !== false"))
 assert.ok(comparator.includes("await verifyWebMeasurement(path.join(directory,'web'),kind,"))
})

test('materialized exact Playwright import supports CJS default and ESM named exports without launching',async()=>{
 const source=execFileSync('git',['show',`${sha}:scripts/web-render-performance.mjs`],{cwd:repository,encoding:'utf8'})
 for(const [name,body] of [['playwright.cjs','module.exports={chromium:{launch(){throw new Error("must not launch")}}}'],['playwright.mjs','export const chromium={launch(){throw new Error("must not launch")}}']]){
  const file=path.join(temp,name)
  await (await import('node:fs/promises')).writeFile(file,body)
  const effective=materializeDriver(source,root,file).effectiveSource
  const snippet=effective.match(/import \* as playwrightModule[^\n]+\nconst chromium[^\n]+\nif \(typeof chromium[^\n]+/u)?.[0]
  assert.ok(snippet)
  execFileSync(process.execPath,['--input-type=module','-e',`${snippet}\nif(typeof chromium.launch!=="function") process.exit(1)`])
 }
})
